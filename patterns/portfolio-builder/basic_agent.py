import json
import os
import traceback

import boto3
from bedrock_agentcore.identity.auth import requires_access_token
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from bedrock_agentcore.runtime import BedrockAgentCoreApp, RequestContext
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from strands_code_interpreter import StrandsCodeInterpreterTools

from utils.auth import extract_user_id_from_context
from utils.ssm import get_ssm_parameter

app = BedrockAgentCoreApp()

PORTFOLIO_BUILDER_SYSTEM_PROMPT = """You are an expert investment portfolio construction specialist. Your role is to generate \
diversified stock portfolio recommendations based on a user's investment preferences.

You have access to a comprehensive suite of research tools through the Gateway. You MUST use them \
thoroughly before making any recommendations. Do NOT rely on training data — use live data only.

CRITICAL WORKFLOW — you MUST follow ALL steps in order:

=== PHASE 1: CANDIDATE SELECTION ===

Step 1: IDENTIFY CANDIDATES — Based on the user's preferred sectors, risk tolerance, and \
investment horizon, identify 12-15 candidate stocks to research. Include any user favorites.

Step 2: VALIDATE TICKERS — Call gateway___validate_ticker for each candidate (especially user \
favorites) to confirm they are valid, actively-traded securities. Drop invalid ones.

Step 3: FETCH STOCK DATA — Call gateway___get_stock_data for every validated candidate to get \
current price, market cap, sector, P/E ratio, dividend yield, and beta.

=== PHASE 2: DEEP ANALYSIS ===

Step 4: FUNDAMENTAL ANALYSIS — Call gateway___get_fundamentals for each candidate to get P/E, \
P/B, debt-to-equity, ROE, and free cash flow yield. Filter out stocks with deteriorating \
fundamentals (negative ROE, excessive debt-to-equity > 3.0, negative FCF yield).

Step 5: SECTOR BENCHMARKING — Call gateway___get_sector_medians for each sector represented in \
your candidates. Compare each stock's ratios against its sector median to identify relative \
value (below-median P/E = potential value, above-median ROE = quality).

Step 6: TECHNICAL SIGNALS — Call gateway___get_price_history for each remaining candidate \
(use period "6mo"). Look at recent price trends. Identify stocks trading near 52-week lows \
(potential value) vs highs (momentum). For Aggressive profiles, favor uptrending stocks. \
For Conservative profiles, avoid highly volatile names.

Step 7: NEWS & SENTIMENT CHECK — Call gateway___get_recent_news for each candidate. Review \
recent headlines for red flags (lawsuits, earnings misses, regulatory issues, downgrades). \
Eliminate or downweight stocks with significant negative news. Call gateway___get_sentiment_data \
for the top candidates to gauge market mood.

Step 8: ANALYST CONSENSUS — Call gateway___get_analyst_reports for each candidate. Factor in \
analyst consensus (Strong Buy/Buy = positive signal, Sell/Strong Sell = negative signal) and \
whether the current price is above or below the average price target (upside potential).

=== PHASE 3: PORTFOLIO CONSTRUCTION ===

Step 9: RANK & SELECT — Based on ALL the data gathered, rank candidates by overall quality. \
Select the final 5-20 stocks for the portfolio. Apply these rules:
- Diversify across at least 3 distinct sectors (unless user preferences restrict to fewer)
- Conservative: weight toward beta < 1.0, dividend yield > 2%, Strong/Moderate fundamental health, Buy/Hold+ analyst consensus
- Moderate: balance growth and value, mix of dividend payers and growth names
- Aggressive: weight toward higher beta, strong revenue growth, momentum, Buy/Strong Buy consensus
- Short-term horizon: favor stocks with positive technical momentum and near-term catalysts
- Long-term horizon: favor strong fundamentals, competitive moats, consistent earnings growth
- Allocation percentages MUST sum to exactly 100%

Step 10: RETURN RESULTS — Return the portfolio as valid JSON:
{
  "recommendations": [
    {
      "ticker": "AAPL",
      "company_name": "Apple Inc.",
      "allocation_pct": 15.0,
      "sector": "Technology",
      "rationale": "P/E of 28.5 vs Tech median of 32.1 (undervalued). ROE 147%, FCF yield 3.8%. Beta 1.2. RSI neutral at 52. Analyst consensus: Buy with avg target $198 (12% upside). No negative news flags. Dividend yield 0.55%.",
      "composite_signals": {
        "fundamental": "Strong",
        "technical": "Neutral",
        "sentiment": "Positive",
        "analyst": "Buy",
        "news": "No red flags"
      }
    }
  ],
  "portfolio_summary": {
    "total_stocks": 10,
    "sector_breakdown": {"Technology": 30, "Healthcare": 25},
    "risk_profile": "Moderate",
    "investment_horizon": "Long-term",
    "research_summary": "Analyzed 15 candidates across 5 sectors. Filtered 5 due to weak fundamentals or negative news. Final 10 stocks selected based on fundamental strength, technical positioning, positive analyst consensus, and sector diversification."
  }
}

IMPORTANT RULES:
- Each rationale MUST cite specific numbers from tool calls (P/E, ROE, beta, analyst target, etc.)
- Each recommendation MUST include composite_signals summarizing all 5 analysis dimensions
- Generic rationales like "strong fundamentals" without numbers are NOT acceptable
- The research_summary MUST describe how many candidates were screened and why some were eliminated
- If a tool call fails for a stock, note "data unavailable" for that dimension — do NOT guess"""


# OAuth2 Credential Provider decorator from AgentCore Identity SDK.
# Automatically retrieves OAuth2 access tokens from the Token Vault (with caching)
# or fetches fresh tokens from the configured OAuth2 provider when expired.
# The provider_name references an OAuth2 Credential Provider registered in AgentCore Identity.
@requires_access_token(
    provider_name=os.environ["GATEWAY_CREDENTIAL_PROVIDER_NAME"],
    auth_flow="M2M",
    scopes=[]
)
def _fetch_gateway_token(access_token: str) -> str:
    """
    Fetch fresh OAuth2 token for AgentCore Gateway authentication.

    The @requires_access_token decorator handles token retrieval and refresh:
    1. Token Retrieval: Calls GetResourceOauth2Token API to fetch token from Token Vault
    2. Automatic Refresh: Uses refresh tokens to renew expired access tokens
    3. Error Orchestration: Handles missing tokens and OAuth flow management

    For M2M (Machine-to-Machine) flows, the decorator uses Client Credentials grant type.
    The provider_name must match the Name field in the CDK OAuth2CredentialProvider resource.

    This MUST be synchronous because it's called inside the MCPClient lambda factory.
    If it were async, the lambda would receive a coroutine object instead of a string,
    breaking authentication.
    """
    return access_token


def create_gateway_mcp_client() -> MCPClient:
    """
    Create MCP client for AgentCore Gateway with OAuth2 authentication.

    MCP (Model Context Protocol) is how agents communicate with tool providers.
    This creates a client that can talk to the AgentCore Gateway using OAuth2
    authentication. The Gateway then provides access to Lambda-based tools.

    This implementation avoids the "closure trap" by calling _fetch_gateway_token()
    inside the lambda factory. This ensures a fresh token is fetched on every MCP reconnection,
    preventing stale token errors.
    """
    stack_name = os.environ.get("STACK_NAME")
    if not stack_name:
        raise ValueError("STACK_NAME environment variable is required")

    # Validate stack name format to prevent injection
    if not stack_name.replace("-", "").replace("_", "").isalnum():
        raise ValueError("Invalid STACK_NAME format")

    print(f"[AGENT] Creating Gateway MCP client for stack: {stack_name}")

    # Fetch Gateway URL from SSM
    gateway_url = get_ssm_parameter(f"/{stack_name}/gateway_url")
    print(f"[AGENT] Gateway URL from SSM: {gateway_url}")

    # Create MCP client with Bearer token authentication
    # CRITICAL: Call _fetch_gateway_token() INSIDE the lambda to get fresh token on reconnection
    gateway_client = MCPClient(
        lambda: streamablehttp_client(
            url=gateway_url, headers={"Authorization": f"Bearer {_fetch_gateway_token()}"}
        ),
        prefix="gateway",
    )

    print("[AGENT] Gateway MCP client created successfully")
    return gateway_client


def create_portfolio_builder_agent(user_id: str, session_id: str) -> Agent:
    """
    Create a portfolio builder agent with AgentCore Gateway MCP tools and memory integration.

    This function sets up an agent that can access tools through the AgentCore Gateway
    and maintains conversation memory. It handles authentication, creates the MCP client
    connection, and configures the agent with access to all tools available through
    the Gateway. If Gateway connection fails, it raises an exception.
    """
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0", temperature=0.1
    )

    memory_id = os.environ.get("MEMORY_ID")
    if not memory_id:
        raise ValueError("MEMORY_ID environment variable is required")

    # Configure AgentCore Memory
    agentcore_memory_config = AgentCoreMemoryConfig(
        memory_id=memory_id, session_id=session_id, actor_id=user_id
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=agentcore_memory_config,
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )

    # Initialize Code Interpreter tools with boto3 session
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    session = boto3.Session(region_name=region)
    code_tools = StrandsCodeInterpreterTools(region)

    try:
        print("[AGENT] Starting agent creation with Gateway tools...")

        # Get OAuth2 access token and create Gateway MCP client
        # The @requires_access_token decorator handles token fetching automatically
        print("[AGENT] Step 1: Creating Gateway MCP client (decorator handles OAuth2)...")
        gateway_client = create_gateway_mcp_client()
        print("[AGENT] Gateway MCP client created successfully")

        print(
            "[AGENT] Step 2: Creating PortfolioBuilderAgent with Gateway tools and Code Interpreter..."
        )
        agent = Agent(
            name="PortfolioBuilderAgent",
            system_prompt=PORTFOLIO_BUILDER_SYSTEM_PROMPT,
            tools=[gateway_client, code_tools.execute_python_securely],
            model=bedrock_model,
            session_manager=session_manager,
            trace_attributes={
                "user.id": user_id,
                "session.id": session_id,
            },
        )
        print(
            "[AGENT] Agent created successfully with Gateway tools and Code Interpreter"
        )
        return agent

    except Exception as e:
        print(f"[AGENT ERROR] Error creating Gateway client: {e}")
        print(f"[AGENT ERROR] Exception type: {type(e).__name__}")
        print("[AGENT ERROR] Traceback:")
        traceback.print_exc()
        print(
            "[AGENT] Gateway connection failed - raising exception instead of fallback"
        )
        raise


@app.entrypoint
async def agent_stream(payload, context: RequestContext):
    """
    Main entrypoint for the portfolio builder agent using streaming with Gateway integration.

    This is the function that AgentCore Runtime calls when the agent receives a request.
    It extracts the user's query from the payload, securely obtains the user ID from
    the validated JWT token in the request context, creates an agent with Gateway tools
    and memory, and streams the response back. This function handles the complete
    request lifecycle with token-level streaming. The user ID is extracted from the
    JWT token (via RequestContext).
    """
    user_query = payload.get("prompt")
    session_id = payload.get("runtimeSessionId")

    if not all([user_query, session_id]):
        yield {
            "status": "error",
            "error": "Missing required fields: prompt or runtimeSessionId",
        }
        return

    try:
        # Extract user ID securely from the validated JWT token
        # instead of trusting the payload body (which could be manipulated)
        user_id = extract_user_id_from_context(context)

        print(
            f"[STREAM] Starting streaming invocation for user: {user_id}, session: {session_id}"
        )
        print(f"[STREAM] Query: {user_query}")

        agent = create_portfolio_builder_agent(user_id, session_id)

        # Use the agent's stream_async method for true token-level streaming
        async for event in agent.stream_async(user_query):
            yield json.loads(json.dumps(dict(event), default=str))

    except Exception as e:
        print(f"[STREAM ERROR] Error in agent_stream: {e}")
        traceback.print_exc()
        yield {"status": "error", "error": str(e)}


if __name__ == "__main__":
    app.run()
