"""
Stock Data Gateway Tool Lambda

Provides stock market data via yfinance. Handles two tools:
- get_stock_data: Returns current price, 52-week range, market cap, sector, and key metrics.
- validate_ticker: Validates whether a ticker symbol exists and returns the company name.
"""

import json
import logging
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _extract_tool_name(context):
    """Extract the tool name from the Bedrock Agent Core context.

    Args:
        context: Lambda context object with client_context custom payload.

    Returns:
        The resolved tool name string.
    """
    original_tool_name = context.client_context.custom["bedrockAgentCoreToolName"]
    delimiter = "___"
    if delimiter in original_tool_name:
        tool_name = original_tool_name[original_tool_name.index(delimiter) + len(delimiter) :]
    else:
        tool_name = original_tool_name
    return tool_name


def _safe_get(info: dict, key: str, default=None):
    """Safely retrieve a value from a dict, returning *default* when the value is None or missing.

    Args:
        info: Source dictionary (e.g. yfinance info dict).
        key: Key to look up.
        default: Fallback value.

    Returns:
        The value if present and not None, otherwise *default*.
    """
    value = info.get(key)
    return value if value is not None else default


def get_stock_data(arguments: dict) -> dict:
    """Fetch current stock data for a given ticker symbol.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with price, 52-week range, market cap, sector, industry,
        dividend yield, PE ratio, and beta.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            return {"error": f"No data found for ticker '{ticker}'. It may be invalid or delisted."}

        current_price = _safe_get(info, "currentPrice") or _safe_get(info, "regularMarketPrice")

        result = {
            "ticker": ticker,
            "company_name": _safe_get(info, "shortName", "N/A"),
            "current_price": current_price,
            "currency": _safe_get(info, "currency", "USD"),
            "fifty_two_week_high": _safe_get(info, "fiftyTwoWeekHigh"),
            "fifty_two_week_low": _safe_get(info, "fiftyTwoWeekLow"),
            "market_cap": _safe_get(info, "marketCap"),
            "sector": _safe_get(info, "sector", "N/A"),
            "industry": _safe_get(info, "industry", "N/A"),
            "dividend_yield": _safe_get(info, "dividendYield"),
            "pe_ratio": _safe_get(info, "trailingPE"),
            "forward_pe": _safe_get(info, "forwardPE"),
            "beta": _safe_get(info, "beta"),
            "volume": _safe_get(info, "volume"),
            "average_volume": _safe_get(info, "averageVolume"),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
        return result

    except Exception as exc:
        logger.exception("Error fetching stock data for %s", ticker)
        return {"error": f"Failed to fetch stock data for '{ticker}': {str(exc)}"}


def validate_ticker(arguments: dict) -> dict:
    """Validate whether a ticker symbol exists and return the company name.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with 'valid' (bool) and 'company_name' (str) if valid.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        # yfinance returns a minimal dict even for invalid tickers; check for a meaningful field.
        company_name = _safe_get(info, "shortName") or _safe_get(info, "longName")

        if company_name:
            return {
                "ticker": ticker,
                "valid": True,
                "company_name": company_name,
                "exchange": _safe_get(info, "exchange", "N/A"),
                "quote_type": _safe_get(info, "quoteType", "N/A"),
            }
        else:
            return {"ticker": ticker, "valid": False, "company_name": None}

    except Exception as exc:
        logger.exception("Error validating ticker %s", ticker)
        return {"ticker": ticker, "valid": False, "company_name": None, "error": str(exc)}


# ---------------------------------------------------------------------------
# Tool dispatch map
# ---------------------------------------------------------------------------
_TOOL_DISPATCH = {
    "get_stock_data": get_stock_data,
    "validate_ticker": validate_ticker,
}


def handler(event, context):
    """AWS Lambda entry point for the stock_data gateway tool.

    Args:
        event: Tool arguments dict (passed directly by Bedrock Agent Core).
        context: Lambda context carrying the tool name in client_context.

    Returns:
        Response dict with 'content' list matching the FAST template pattern.
    """
    logger.info("stock_data handler invoked | event=%s", json.dumps(event, default=str))

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
