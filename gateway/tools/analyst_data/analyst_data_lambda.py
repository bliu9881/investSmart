"""
Analyst Data Gateway Tool Lambda

Provides analyst recommendations, consensus ratings, and price targets via yfinance.
Handles one tool:
- get_analyst_reports: Returns analyst recommendations, consensus, and price targets.
"""

import json
import logging
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _extract_tool_name(context):
    """Extract the tool name from Bedrock Agent Core context.

    Args:
        context: Lambda context with client_context custom payload.

    Returns:
        Resolved tool name string.
    """
    original_tool_name = context.client_context.custom["bedrockAgentCoreToolName"]
    delimiter = "___"
    if delimiter in original_tool_name:
        return original_tool_name[original_tool_name.index(delimiter) + len(delimiter) :]
    return original_tool_name


def _safe_get(info: dict, key: str, default=None):
    """Safely retrieve a non-None value from a dict.

    Args:
        info: Source dictionary.
        key: Key to look up.
        default: Fallback value.

    Returns:
        The value if present and not None, otherwise *default*.
    """
    value = info.get(key)
    return value if value is not None else default


def get_analyst_reports(arguments: dict) -> dict:
    """Fetch analyst recommendations, consensus ratings, and price targets for a ticker.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with recommendation summary, price targets, and recent
        analyst actions.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        if not info or not _safe_get(info, "shortName"):
            return {"error": f"No analyst data found for ticker '{ticker}'."}

        # --- Price targets ---
        target_high = _safe_get(info, "targetHighPrice")
        target_low = _safe_get(info, "targetLowPrice")
        target_mean = _safe_get(info, "targetMeanPrice")
        target_median = _safe_get(info, "targetMedianPrice")
        current_price = _safe_get(info, "currentPrice") or _safe_get(info, "regularMarketPrice")
        num_analysts = _safe_get(info, "numberOfAnalystOpinions")

        # Upside calculation
        upside_pct = None
        if target_mean and current_price and current_price > 0:
            upside_pct = round(((target_mean - current_price) / current_price) * 100, 2)

        # --- Recommendation summary ---
        recommendation = _safe_get(info, "recommendationKey", "N/A")
        recommendation_mean = _safe_get(info, "recommendationMean")

        # --- Recent analyst recommendations (upgrades/downgrades) ---
        recent_recommendations = []
        try:
            recs_df = stock.recommendations
            if recs_df is not None and not recs_df.empty:
                # Take the most recent 20 recommendations
                recent = recs_df.tail(20)
                for idx, row in recent.iterrows():
                    rec_entry = {}
                    # Handle both old and new yfinance recommendation formats
                    if hasattr(idx, "isoformat"):
                        rec_entry["date"] = idx.strftime("%Y-%m-%d")
                    elif "period" in row:
                        rec_entry["date"] = str(row.get("period", ""))

                    rec_entry["firm"] = str(row.get("Firm", row.get("firm", "N/A")))
                    rec_entry["to_grade"] = str(row.get("To Grade", row.get("toGrade", "N/A")))
                    rec_entry["from_grade"] = str(row.get("From Grade", row.get("fromGrade", "")))
                    rec_entry["action"] = str(row.get("Action", row.get("action", "N/A")))
                    recent_recommendations.append(rec_entry)
        except Exception as rec_err:
            logger.warning("Could not fetch recommendations history for %s: %s", ticker, rec_err)

        # --- Recommendation trend (if available) ---
        recommendation_trend = {}
        try:
            trend_df = stock.recommendations_summary
            if trend_df is not None and not trend_df.empty:
                for _, row in trend_df.iterrows():
                    period_label = str(row.get("period", "unknown"))
                    recommendation_trend[period_label] = {
                        "strong_buy": int(row.get("strongBuy", 0)),
                        "buy": int(row.get("buy", 0)),
                        "hold": int(row.get("hold", 0)),
                        "sell": int(row.get("sell", 0)),
                        "strong_sell": int(row.get("strongSell", 0)),
                    }
        except Exception as trend_err:
            logger.warning("Could not fetch recommendation trend for %s: %s", ticker, trend_err)

        result = {
            "ticker": ticker,
            "company_name": _safe_get(info, "shortName", "N/A"),
            "consensus_recommendation": recommendation,
            "recommendation_mean_score": recommendation_mean,
            "number_of_analysts": num_analysts,
            "price_targets": {
                "current_price": current_price,
                "target_high": target_high,
                "target_low": target_low,
                "target_mean": target_mean,
                "target_median": target_median,
                "upside_percentage": upside_pct,
            },
            "recommendation_trend": recommendation_trend if recommendation_trend else None,
            "recent_recommendations": recent_recommendations if recent_recommendations else None,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
        return result

    except Exception as exc:
        logger.exception("Error fetching analyst data for %s", ticker)
        return {"error": f"Failed to fetch analyst data for '{ticker}': {str(exc)}"}


# ---------------------------------------------------------------------------
# Tool dispatch map
# ---------------------------------------------------------------------------
_TOOL_DISPATCH = {
    "get_analyst_reports": get_analyst_reports,
}


def handler(event, context):
    """AWS Lambda entry point for the analyst_data gateway tool.

    Args:
        event: Tool arguments dict (passed directly by Bedrock Agent Core).
        context: Lambda context carrying the tool name in client_context.

    Returns:
        Response dict with 'content' list matching the FAST template pattern.
    """
    logger.info("analyst_data handler invoked | event=%s", json.dumps(event, default=str))

    tool_name = _extract_tool_name(context)
    logger.info("Resolved tool name: %s", tool_name)

    tool_fn = _TOOL_DISPATCH.get(tool_name)
    if tool_fn is None:
        error_msg = f"Unknown tool: {tool_name}. Available tools: {list(_TOOL_DISPATCH.keys())}"
        logger.error(error_msg)
        return {"content": [{"type": "text", "text": json.dumps({"error": error_msg})}]}

    try:
        result = tool_fn(event)
        return {"content": [{"type": "text", "text": json.dumps(result, default=str)}]}
    except Exception as exc:
        logger.exception("Unhandled exception in tool %s", tool_name)
        return {
            "content": [
                {"type": "text", "text": json.dumps({"error": f"Internal error: {str(exc)}"})}
            ]
        }
