"""
Financial Data Gateway Tool Lambda

Provides fundamental analysis data, price history, and sector benchmarks via yfinance.
Handles three tools:
- get_fundamentals: Key financial ratios and metrics for a ticker.
- get_price_history: Historical OHLCV price data.
- get_sector_medians: Sector-level median financial ratios (hardcoded benchmarks).
"""

import json
import logging
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Hardcoded sector median benchmarks
# Real-time computation across all sector constituents is prohibitively
# expensive for a Lambda invocation, so we use representative medians.
# ---------------------------------------------------------------------------
SECTOR_MEDIANS = {
    "Technology": {"pe_ratio": 28.5, "pb_ratio": 6.2, "de_ratio": 0.45, "roe": 0.22},
    "Healthcare": {"pe_ratio": 22.0, "pb_ratio": 4.1, "de_ratio": 0.55, "roe": 0.15},
    "Financial Services": {"pe_ratio": 13.5, "pb_ratio": 1.4, "de_ratio": 1.80, "roe": 0.12},
    "Financials": {"pe_ratio": 13.5, "pb_ratio": 1.4, "de_ratio": 1.80, "roe": 0.12},
    "Consumer Cyclical": {"pe_ratio": 20.0, "pb_ratio": 3.8, "de_ratio": 0.70, "roe": 0.18},
    "Consumer Defensive": {"pe_ratio": 21.0, "pb_ratio": 3.5, "de_ratio": 0.65, "roe": 0.16},
    "Industrials": {"pe_ratio": 20.5, "pb_ratio": 3.2, "de_ratio": 0.75, "roe": 0.14},
    "Energy": {"pe_ratio": 11.0, "pb_ratio": 1.6, "de_ratio": 0.40, "roe": 0.13},
    "Utilities": {"pe_ratio": 17.0, "pb_ratio": 1.8, "de_ratio": 1.30, "roe": 0.10},
    "Real Estate": {"pe_ratio": 35.0, "pb_ratio": 2.0, "de_ratio": 1.10, "roe": 0.08},
    "Basic Materials": {"pe_ratio": 14.0, "pb_ratio": 2.1, "de_ratio": 0.50, "roe": 0.12},
    "Communication Services": {"pe_ratio": 18.0, "pb_ratio": 3.0, "de_ratio": 0.60, "roe": 0.14},
}


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


def get_fundamentals(arguments: dict) -> dict:
    """Fetch key fundamental financial metrics for a ticker.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with P/E, P/B, D/E, ROE, FCF yield, earnings date,
        revenue, and net income.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        if not info or not _safe_get(info, "shortName"):
            return {"error": f"No fundamental data found for ticker '{ticker}'."}

        # Free cash flow yield = FCF / Market Cap
        fcf = _safe_get(info, "freeCashflow")
        market_cap = _safe_get(info, "marketCap")
        fcf_yield = None
        if fcf is not None and market_cap and market_cap > 0:
            fcf_yield = round(fcf / market_cap, 4)

        # Earnings date — yfinance stores as a list of timestamps
        earnings_dates_raw = _safe_get(info, "earningsTimestamp")
        earnings_date = None
        if earnings_dates_raw:
            try:
                earnings_date = datetime.fromtimestamp(earnings_dates_raw, tz=timezone.utc).isoformat()
            except (TypeError, ValueError, OSError):
                earnings_date = str(earnings_dates_raw)

        result = {
            "ticker": ticker,
            "company_name": _safe_get(info, "shortName", "N/A"),
            "pe_ratio": _safe_get(info, "trailingPE"),
            "forward_pe": _safe_get(info, "forwardPE"),
            "pb_ratio": _safe_get(info, "priceToBook"),
            "de_ratio": _safe_get(info, "debtToEquity"),
            "roe": _safe_get(info, "returnOnEquity"),
            "roa": _safe_get(info, "returnOnAssets"),
            "fcf_yield": fcf_yield,
            "free_cashflow": fcf,
            "earnings_date": earnings_date,
            "revenue": _safe_get(info, "totalRevenue"),
            "net_income": _safe_get(info, "netIncomeToCommon"),
            "profit_margin": _safe_get(info, "profitMargins"),
            "operating_margin": _safe_get(info, "operatingMargins"),
            "sector": _safe_get(info, "sector", "N/A"),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
        return result

    except Exception as exc:
        logger.exception("Error fetching fundamentals for %s", ticker)
        return {"error": f"Failed to fetch fundamentals for '{ticker}': {str(exc)}"}


def get_price_history(arguments: dict) -> dict:
    """Fetch historical OHLCV price data for a ticker.

    Args:
        arguments: Dict containing 'ticker' (str) and optional 'period' (str, default '1y').
                   Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max.

    Returns:
        Dict with ticker, period, and a 'data' list of OHLCV records.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    period = arguments.get("period", "1y").strip()
    valid_periods = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
    if period not in valid_periods:
        return {"error": f"Invalid period '{period}'. Must be one of: {sorted(valid_periods)}"}

    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)

        if hist.empty:
            return {"error": f"No price history found for ticker '{ticker}' with period '{period}'."}

        records = []
        for date, row in hist.iterrows():
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(row["Open"], 4),
                "high": round(row["High"], 4),
                "low": round(row["Low"], 4),
                "close": round(row["Close"], 4),
                "volume": int(row["Volume"]),
            })

        # For large datasets, limit to a reasonable number of records
        max_records = 500
        if len(records) > max_records:
            # Sample evenly across the range
            step = len(records) // max_records
            records = records[::step]

        return {
            "ticker": ticker,
            "period": period,
            "record_count": len(records),
            "data": records,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Error fetching price history for %s", ticker)
        return {"error": f"Failed to fetch price history for '{ticker}': {str(exc)}"}


def get_sector_medians(arguments: dict) -> dict:
    """Return median financial ratios for a given sector.

    Uses hardcoded benchmark data since real-time sector-wide computation
    is prohibitively expensive.

    Args:
        arguments: Dict containing 'sector' (str).

    Returns:
        Dict with sector name and median P/E, P/B, D/E, ROE.
    """
    sector = arguments.get("sector", "").strip()
    if not sector:
        return {"error": "Missing required parameter: sector"}

    # Try case-insensitive match
    sector_key = None
    for key in SECTOR_MEDIANS:
        if key.lower() == sector.lower():
            sector_key = key
            break

    if sector_key is None:
        return {
            "error": f"Sector '{sector}' not found.",
            "available_sectors": sorted(SECTOR_MEDIANS.keys()),
        }

    medians = SECTOR_MEDIANS[sector_key]
    return {
        "sector": sector_key,
        "median_pe_ratio": medians["pe_ratio"],
        "median_pb_ratio": medians["pb_ratio"],
        "median_de_ratio": medians["de_ratio"],
        "median_roe": medians["roe"],
        "note": "These are representative sector medians used as benchmarks. Actual medians may vary.",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Tool dispatch map
# ---------------------------------------------------------------------------
_TOOL_DISPATCH = {
    "get_fundamentals": get_fundamentals,
    "get_price_history": get_price_history,
    "get_sector_medians": get_sector_medians,
}


def handler(event, context):
    """AWS Lambda entry point for the financial_data gateway tool.

    Args:
        event: Tool arguments dict (passed directly by Bedrock Agent Core).
        context: Lambda context carrying the tool name in client_context.

    Returns:
        Response dict with 'content' list matching the FAST template pattern.
    """
    logger.info("financial_data handler invoked | event=%s", json.dumps(event, default=str))

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
