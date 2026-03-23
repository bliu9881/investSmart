"""
Market data Lambda for InvestSmart dashboard.

Fetches major indices and market movers via yfinance.
Results are cached in-memory for 5 minutes to avoid excessive API calls.
"""

import json
import logging
import os
import time

import yfinance as yf

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

# Hardcoded name mapping (replaces slow ticker.info call)
STOCK_NAMES = {
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
    "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "JPM": "JPMorgan Chase",
    "V": "Visa", "JNJ": "Johnson & Johnson", "UNH": "UnitedHealth", "XOM": "ExxonMobil",
    "PG": "Procter & Gamble", "HD": "Home Depot", "BAC": "Bank of America",
    "PFE": "Pfizer", "TSM": "TSMC", "INTC": "Intel", "AMD": "AMD",
    "DIS": "Disney", "NFLX": "Netflix", "CRM": "Salesforce", "COST": "Costco",
}

# In-memory cache (persists across warm Lambda invocations)
_cache = {"data": None, "timestamp": 0}
CACHE_TTL = 300  # 5 minutes


def cors_headers(origin: str = "*") -> dict:
    """Return CORS headers."""
    allowed = [o.strip() for o in CORS_ORIGINS.split(",")]
    allow_origin = origin if origin in allowed else allowed[0]
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }


def response(status: int, body: dict, origin: str = "*") -> dict:
    """Build API Gateway proxy response."""
    return {
        "statusCode": status,
        "headers": {**cors_headers(origin), "Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def fetch_market_data(requested_tickers: list[str] | None = None) -> dict:
    """Fetch market indices and movers from yfinance.

    Args:
        requested_tickers: Optional list of ticker symbols to fetch prices for.

    Returns:
        Dict with indices, movers, prices (if requested), and timestamp.
    """
    now = time.time()

    # Check cache
    if _cache["data"] and (now - _cache["timestamp"]) < CACHE_TTL:
        logger.info("Returning cached market data")
        return _cache["data"]

    logger.info("Fetching fresh market data from yfinance")

    # Fetch major indices
    indices = []
    index_tickers = {
        "^GSPC": "S&P 500",
        "^IXIC": "NASDAQ",
        "^DJI": "Dow Jones",
        "^RUT": "Russell 2000",
    }

    for symbol, name in index_tickers.items():
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            current = info.get("lastPrice", 0)
            prev_close = info.get("previousClose", 0)
            change = current - prev_close if prev_close else 0
            change_pct = (change / prev_close * 100) if prev_close else 0

            indices.append({
                "symbol": symbol,
                "name": name,
                "price": round(current, 2),
                "change": round(change, 2),
                "changePct": round(change_pct, 2),
                "direction": "up" if change >= 0 else "down",
            })
        except Exception as e:
            logger.warning(f"Failed to fetch {symbol}: {e}")
            indices.append({
                "symbol": symbol,
                "name": name,
                "price": 0,
                "change": 0,
                "changePct": 0,
                "direction": "flat",
                "error": str(e),
            })

    # Fetch market movers from popular stocks
    mover_symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
        "JPM", "V", "JNJ", "UNH", "XOM", "PG", "HD",
    ]

    movers = []
    for symbol in mover_symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            current = info.get("lastPrice", 0)
            prev_close = info.get("previousClose", 0)
            change = current - prev_close if prev_close else 0
            change_pct = (change / prev_close * 100) if prev_close else 0

            movers.append({
                "ticker": symbol,
                "name": STOCK_NAMES.get(symbol, symbol),
                "price": round(current, 2),
                "change": round(change, 2),
                "changePct": round(change_pct, 2),
                "direction": "up" if change >= 0 else "down",
            })
        except Exception as e:
            logger.warning(f"Failed to fetch mover {symbol}: {e}")

    # Sort movers: top 3 gainers and top 3 losers
    movers.sort(key=lambda x: x["changePct"], reverse=True)
    top_gainers = [m for m in movers if m["changePct"] > 0][:3]
    top_losers = [m for m in movers if m["changePct"] < 0][-3:]
    top_losers.reverse()  # Most negative first

    # Fetch prices for requested tickers
    prices = {}
    if requested_tickers:
        for t in requested_tickers:
            try:
                ticker = yf.Ticker(t)
                fi = ticker.fast_info
                current = fi.get("lastPrice", 0)
                prev_close = fi.get("previousClose", 0)
                change = current - prev_close if prev_close else 0
                change_pct = (change / prev_close * 100) if prev_close else 0
                sector = ""
                try:
                    sector = fi.get("sector", "")
                except Exception:
                    pass
                prices[t] = {
                    "price": round(current, 2),
                    "prevClose": round(prev_close, 2),
                    "change": round(change, 2),
                    "changePct": round(change_pct, 2),
                    "name": STOCK_NAMES.get(t, t),
                    "sector": sector,
                }
            except Exception as e:
                logger.warning(f"Failed to fetch price for {t}: {e}")

    result = {
        "indices": indices,
        "gainers": top_gainers,
        "losers": top_losers,
        "prices": prices,
        "timestamp": int(now),
    }

    # Update cache
    _cache["data"] = result
    _cache["timestamp"] = now

    return result


def handler(event, context):
    """Lambda handler for market data.

    Args:
        event: API Gateway proxy event.
        context: Lambda context.

    Returns:
        API Gateway proxy response with market data.
    """
    origin = event.get("headers", {}).get("origin", "*")
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return response(200, {}, origin)

    try:
        params = event.get("queryStringParameters") or {}
        tickers_param = params.get("tickers", "")
        requested_tickers = [t.strip() for t in tickers_param.split(",") if t.strip()] if tickers_param else []
        data = fetch_market_data(requested_tickers=requested_tickers)
        return response(200, data, origin)
    except Exception as e:
        logger.error(f"Market data error: {e}", exc_info=True)
        return response(500, {"error": "Failed to fetch market data"}, origin)
