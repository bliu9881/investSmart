"""
Orchestrator Lambda for the Portfolio Intelligence Platform.

Coordinates parallel invocation of analysis agents, manages timeouts,
computes composite scores, and handles partial results.
"""

import json
import logging
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AGENT_TIMEOUT_SECONDS = 15
TOTAL_TIMEOUT_SECONDS = 30

COMPOSITE_WEIGHTS = {
    "sentiment": 0.20,
    "fundamental": 0.25,
    "technical": 0.20,
    "news": 0.15,
    "analyst": 0.20,
}

ANALYSIS_AGENTS = ["sentiment", "fundamental", "technical", "news", "analyst"]


def get_dynamodb_table(table_name: str):
    """Get a DynamoDB table resource.

    Args:
        table_name: Name of the DynamoDB table.

    Returns:
        DynamoDB Table resource.
    """
    dynamodb = boto3.resource("dynamodb")
    return dynamodb.Table(table_name)


def check_analysis_cache(ticker: str, analysis_type: str) -> dict | None:
    """Check DynamoDB cache for existing analysis results.

    Args:
        ticker: Stock ticker symbol.
        analysis_type: Type of analysis (sentiment, fundamental, etc.).

    Returns:
        Cached analysis result or None if not found/expired.
    """
    table_name = os.environ.get("ANALYSIS_CACHE_TABLE")
    if not table_name:
        return None

    try:
        table = get_dynamodb_table(table_name)
        response = table.get_item(
            Key={"ticker": ticker, "analysisType": analysis_type}
        )
        item = response.get("Item")
        if item and item.get("ttl", 0) > int(time.time()):
            return json.loads(item["result"])
        return None
    except Exception as e:
        logger.warning(f"Cache check failed for {ticker}/{analysis_type}: {e}")
        return None


def cache_analysis_result(
    ticker: str, analysis_type: str, result: dict, ttl_hours: int = 1
) -> None:
    """Store analysis result in DynamoDB cache.

    Args:
        ticker: Stock ticker symbol.
        analysis_type: Type of analysis.
        result: Analysis result to cache.
        ttl_hours: Hours until cache entry expires.
    """
    table_name = os.environ.get("ANALYSIS_CACHE_TABLE")
    if not table_name:
        return

    try:
        table = get_dynamodb_table(table_name)
        table.put_item(
            Item={
                "ticker": ticker,
                "analysisType": analysis_type,
                "result": json.dumps(result),
                "computedAt": int(time.time()),
                "ttl": int(time.time()) + (ttl_hours * 3600),
            }
        )
    except Exception as e:
        logger.warning(f"Cache write failed for {ticker}/{analysis_type}: {e}")


def invoke_analysis_agent(
    agent_type: str, ticker: str, request_id: str
) -> dict:
    """Invoke a single analysis agent via AgentCore Runtime.

    Args:
        agent_type: Type of analysis agent to invoke.
        ticker: Stock ticker to analyze.
        request_id: Unique request identifier for logging.

    Returns:
        Dict with status, result, and timing metadata.
    """
    start_time = time.time()
    logger.info(
        f"[{request_id}] Invoking {agent_type} agent for {ticker}"
    )

    # Check cache first
    cached = check_analysis_cache(ticker, agent_type)
    if cached:
        duration = time.time() - start_time
        logger.info(
            f"[{request_id}] {agent_type} cache hit for {ticker} ({duration:.2f}s)"
        )
        return {
            "agent": agent_type,
            "status": "success",
            "result": cached,
            "cached": True,
            "duration_ms": int(duration * 1000),
        }

    try:
        # Invoke the agent via AgentCore Runtime API
        client = boto3.client("bedrock-agent-runtime")
        runtime_arn = os.environ.get(f"{agent_type.upper()}_RUNTIME_ARN")

        if not runtime_arn:
            # Fall back to single runtime with prompt routing
            runtime_arn = os.environ.get("AGENT_RUNTIME_ARN")

        if not runtime_arn:
            raise ValueError(f"No runtime ARN configured for {agent_type}")

        response = client.invoke_agent(
            agentId=runtime_arn.split("/")[-1],
            agentAliasId="TSTALIASID",
            sessionId=f"{request_id}-{agent_type}",
            inputText=f"Analyze {ticker} - provide {agent_type} analysis in JSON format.",
        )

        # Collect streamed response
        result_text = ""
        for event in response.get("completion", []):
            if "chunk" in event:
                result_text += event["chunk"].get("bytes", b"").decode("utf-8")

        result = json.loads(result_text) if result_text else {}

        duration = time.time() - start_time
        logger.info(
            f"[{request_id}] {agent_type} completed for {ticker} ({duration:.2f}s)"
        )

        # Cache the result with type-specific TTL
        ttl_map = {
            "sentiment": 1,
            "news": 1,
            "technical": 1,
            "fundamental": 24,
            "analyst": 12,
        }
        cache_analysis_result(ticker, agent_type, result, ttl_map.get(agent_type, 1))

        return {
            "agent": agent_type,
            "status": "success",
            "result": result,
            "cached": False,
            "duration_ms": int(duration * 1000),
        }

    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f"[{request_id}] {agent_type} failed for {ticker}: {e} ({duration:.2f}s)"
        )
        return {
            "agent": agent_type,
            "status": "error",
            "error": str(e),
            "duration_ms": int(duration * 1000),
        }


def compute_composite_score(results: dict[str, dict]) -> dict:
    """Compute weighted composite score from analysis results.

    Weights: sentiment(20%), fundamental(25%), technical(20%), news(15%), analyst(20%).
    Normalizes each dimension to 0-100 scale. If dimensions are missing,
    redistributes weights proportionally.

    Args:
        results: Dict mapping dimension name to analysis result.

    Returns:
        Composite score dict with score, color, breakdown, and missing dimensions.
    """
    available = {}
    missing = []
    breakdown = {}

    for dimension in ANALYSIS_AGENTS:
        agent_result = results.get(dimension)
        if agent_result and agent_result.get("status") == "success":
            # Normalize each dimension's output to 0-100
            result_data = agent_result.get("result", {})
            score = normalize_dimension_score(dimension, result_data)
            if score is not None:
                available[dimension] = score
                breakdown[dimension] = score
            else:
                missing.append(dimension)
                breakdown[dimension] = None
        else:
            missing.append(dimension)
            breakdown[dimension] = None

    if not available:
        return {
            "score": 0,
            "color": "red",
            "breakdown": breakdown,
            "missingDimensions": missing,
        }

    # Redistribute weights proportionally among available dimensions
    total_available_weight = sum(
        COMPOSITE_WEIGHTS[d] for d in available
    )
    weighted_sum = sum(
        available[d] * (COMPOSITE_WEIGHTS[d] / total_available_weight)
        for d in available
    )

    score = round(weighted_sum, 1)
    color = "green" if score >= 70 else "yellow" if score >= 40 else "red"

    return {
        "score": score,
        "color": color,
        "breakdown": breakdown,
        "missingDimensions": missing,
    }


def normalize_dimension_score(dimension: str, data: dict) -> float | None:
    """Normalize a dimension's analysis result to a 0-100 score.

    Args:
        dimension: Analysis dimension name.
        data: Raw analysis result data.

    Returns:
        Normalized score (0-100) or None if data is insufficient.
    """
    try:
        if dimension == "sentiment":
            # Sentiment is -100 to +100, normalize to 0-100
            raw = data.get("score", 0)
            return max(0, min(100, (raw + 100) / 2))

        elif dimension == "fundamental":
            rating_map = {"Strong": 85, "Moderate": 55, "Weak": 25}
            rating = data.get("health_rating", data.get("healthRating"))
            return rating_map.get(rating, 50)

        elif dimension == "technical":
            # Count bullish vs bearish signals
            indicators = data.get("indicators", [])
            if not indicators:
                return None
            bullish = sum(1 for i in indicators if i.get("signal") == "bullish")
            total = len(indicators)
            return round((bullish / total) * 100) if total > 0 else 50

        elif dimension == "news":
            articles = data.get("articles", [])
            if not articles:
                return 50  # Neutral if no news
            positive = sum(
                1 for a in articles if a.get("impact_direction", a.get("impactDirection")) == "Positive"
            )
            negative = sum(
                1 for a in articles if a.get("impact_direction", a.get("impactDirection")) == "Negative"
            )
            total = len(articles)
            return round(((positive - negative) / total + 1) / 2 * 100) if total > 0 else 50

        elif dimension == "analyst":
            consensus_map = {
                "Strong Buy": 90,
                "Buy": 75,
                "Hold": 50,
                "Sell": 25,
                "Strong Sell": 10,
            }
            consensus = data.get("consensus")
            return consensus_map.get(consensus, 50)

        return None
    except Exception as e:
        logger.warning(f"Score normalization failed for {dimension}: {e}")
        return None


def handle_full_analysis(event: dict, request_id: str) -> dict:
    """Handle full stock analysis request - invoke all 5 agents in parallel.

    Args:
        event: Request event with ticker.
        request_id: Unique request identifier.

    Returns:
        Consolidated analysis results with composite score.
    """
    ticker = event.get("ticker", "").upper()
    if not ticker:
        raise ValueError("ticker is required")

    logger.info(f"[{request_id}] Starting full analysis for {ticker}")
    start_time = time.time()

    results = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(invoke_analysis_agent, agent_type, ticker, request_id): agent_type
            for agent_type in ANALYSIS_AGENTS
        }

        for future in futures:
            agent_type = futures[future]
            try:
                result = future.result(timeout=AGENT_TIMEOUT_SECONDS)
                results[agent_type] = result
            except FuturesTimeoutError:
                logger.warning(
                    f"[{request_id}] {agent_type} timed out for {ticker}"
                )
                results[agent_type] = {
                    "agent": agent_type,
                    "status": "timeout",
                    "error": "Analysis timed out - retry available",
                }
            except Exception as e:
                logger.error(
                    f"[{request_id}] {agent_type} exception for {ticker}: {e}"
                )
                results[agent_type] = {
                    "agent": agent_type,
                    "status": "error",
                    "error": str(e),
                }

    composite = compute_composite_score(results)
    total_duration = time.time() - start_time

    logger.info(
        f"[{request_id}] Full analysis complete for {ticker} "
        f"({total_duration:.2f}s, composite={composite['score']})"
    )

    return {
        "ticker": ticker,
        "analyses": results,
        "composite": composite,
        "request_id": request_id,
        "total_duration_ms": int(total_duration * 1000),
    }


def handle_single_analysis(event: dict, request_id: str) -> dict:
    """Handle single dimension analysis or retry.

    Args:
        event: Request with ticker and analysis_type.
        request_id: Unique request identifier.

    Returns:
        Single analysis result.
    """
    ticker = event.get("ticker", "").upper()
    analysis_type = event.get("analysis_type", "")

    if not ticker or not analysis_type:
        raise ValueError("ticker and analysis_type are required")

    if analysis_type not in ANALYSIS_AGENTS:
        raise ValueError(f"Invalid analysis_type: {analysis_type}")

    result = invoke_analysis_agent(analysis_type, ticker, request_id)
    return result


def handle_portfolio_generation(event: dict, request_id: str) -> dict:
    """Route portfolio generation request to Portfolio Builder agent.

    Args:
        event: Request with user preferences.
        request_id: Unique request identifier.

    Returns:
        Generated portfolio recommendations.
    """
    logger.info(f"[{request_id}] Routing to Portfolio Builder agent")

    preferences = event.get("preferences", {})
    if not preferences:
        raise ValueError("preferences are required for portfolio generation")

    result = invoke_analysis_agent("portfolio_builder", "", request_id)
    return result


def handler(event: dict, context: Any) -> dict:
    """Main Lambda handler for the orchestrator.

    Routes requests to appropriate handlers based on action type.

    Args:
        event: Lambda event containing action and parameters.
        context: Lambda context object.

    Returns:
        Response dict with content array in MCP format.
    """
    request_id = str(uuid.uuid4())[:8]

    try:
        # Get tool name from context (Gateway pattern)
        original_tool_name = ""
        if hasattr(context, "client_context") and context.client_context:
            original_tool_name = context.client_context.custom.get(
                "bedrockAgentCoreToolName", ""
            )

        delimiter = "___"
        if delimiter in original_tool_name:
            tool_name = original_tool_name[
                original_tool_name.index(delimiter) + len(delimiter) :
            ]
        else:
            tool_name = original_tool_name or event.get("action", "full_analysis")

        logger.info(
            f"[{request_id}] Orchestrator invoked: tool={tool_name}, event={json.dumps(event)}"
        )

        if tool_name == "full_analysis":
            result = handle_full_analysis(event, request_id)
        elif tool_name == "single_analysis":
            result = handle_single_analysis(event, request_id)
        elif tool_name == "generate_portfolio":
            result = handle_portfolio_generation(event, request_id)
        else:
            raise ValueError(f"Unknown action: {tool_name}")

        return {
            "content": [
                {"type": "text", "text": json.dumps(result, default=str)}
            ]
        }

    except Exception as e:
        logger.error(f"[{request_id}] Orchestrator error: {e}", exc_info=True)
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {"status": "error", "error": str(e), "request_id": request_id}
                    ),
                }
            ]
        }
