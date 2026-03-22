"""
News & Sentiment Gateway Tool Lambda

Provides news articles and derived sentiment analysis for stocks using yfinance.
Handles two tools:
- get_recent_news: Returns recent news articles for a ticker.
- get_sentiment_data: Returns sentiment analysis derived from news headlines.
"""

import json
import logging
import re
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Simple keyword-based sentiment scoring
# Since we rely on free APIs only, we derive sentiment from headline keywords
# rather than calling an external NLP service.
# ---------------------------------------------------------------------------
POSITIVE_KEYWORDS = {
    "surge", "surges", "soar", "soars", "jump", "jumps", "rally", "rallies",
    "gain", "gains", "rise", "rises", "beat", "beats", "upgrade", "upgrades",
    "outperform", "bullish", "record", "high", "growth", "profit", "positive",
    "strong", "recover", "recovery", "boost", "boosts", "optimistic", "upbeat",
    "breakout", "buy", "innovation", "expand", "expansion", "dividend",
    "exceeded", "exceeds", "surprise", "upside",
}

NEGATIVE_KEYWORDS = {
    "crash", "crashes", "plunge", "plunges", "drop", "drops", "fall", "falls",
    "decline", "declines", "loss", "losses", "miss", "misses", "downgrade",
    "downgrades", "underperform", "bearish", "low", "weak", "warning",
    "risk", "cut", "cuts", "layoff", "layoffs", "recall", "recalls",
    "bankruptcy", "debt", "sell", "selloff", "concern", "fears", "slump",
    "lawsuit", "investigation", "fraud", "default", "downside", "negative",
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


def _score_headline(headline: str) -> float:
    """Compute a simple sentiment score for a headline based on keyword matching.

    Args:
        headline: News headline text.

    Returns:
        Float between -1.0 (very negative) and 1.0 (very positive).
    """
    words = set(re.findall(r"[a-z]+", headline.lower()))
    pos_count = len(words & POSITIVE_KEYWORDS)
    neg_count = len(words & NEGATIVE_KEYWORDS)
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    return round((pos_count - neg_count) / total, 2)


def _classify_score(score: float) -> str:
    """Classify a numeric sentiment score into a label.

    Args:
        score: Numeric sentiment score.

    Returns:
        One of 'positive', 'negative', or 'neutral'.
    """
    if score > 0.15:
        return "positive"
    elif score < -0.15:
        return "negative"
    return "neutral"


def _fetch_news(ticker: str) -> list:
    """Fetch news articles from yfinance for a ticker.

    Args:
        ticker: Uppercase ticker symbol.

    Returns:
        List of article dicts with title, publisher, link, publish_time.
    """
    stock = yf.Ticker(ticker)
    raw_news = stock.news or []

    articles = []
    for item in raw_news:
        # yfinance >= 0.2.31 nests article data under 'content'
        content = item.get("content", item)

        publish_time = content.get("providerPublishTime") or content.get("pubDate")
        if isinstance(publish_time, (int, float)):
            publish_time = datetime.fromtimestamp(publish_time, tz=timezone.utc).isoformat()

        # Resolve the link — may be under 'link', 'url', or nested in 'clickThroughUrl'
        link = (
            content.get("link")
            or content.get("url")
            or (content.get("clickThroughUrl") or {}).get("url", "")
        )

        title = content.get("title", "")
        publisher = content.get("publisher") or content.get("provider", {}).get("displayName", "Unknown")

        articles.append({
            "title": title,
            "publisher": publisher,
            "link": link,
            "publish_time": publish_time,
        })

    return articles


def get_recent_news(arguments: dict) -> dict:
    """Fetch recent news articles for a given ticker symbol.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with ticker and list of news articles.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        articles = _fetch_news(ticker)

        if not articles:
            return {
                "ticker": ticker,
                "article_count": 0,
                "articles": [],
                "message": f"No recent news found for '{ticker}'.",
            }

        return {
            "ticker": ticker,
            "article_count": len(articles),
            "articles": articles,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Error fetching news for %s", ticker)
        return {"error": f"Failed to fetch news for '{ticker}': {str(exc)}"}


def get_sentiment_data(arguments: dict) -> dict:
    """Derive sentiment analysis from recent news headlines for a ticker.

    Since we use free APIs, sentiment is computed via keyword matching on
    headlines rather than a dedicated NLP model.

    Args:
        arguments: Dict containing 'ticker' (str).

    Returns:
        Dict with overall sentiment, score, and per-article breakdown.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    if not ticker:
        return {"error": "Missing required parameter: ticker"}

    try:
        articles = _fetch_news(ticker)

        if not articles:
            return {
                "ticker": ticker,
                "overall_sentiment": "neutral",
                "overall_score": 0.0,
                "article_count": 0,
                "article_sentiments": [],
                "message": "No recent news available for sentiment analysis.",
            }

        article_sentiments = []
        scores = []
        for article in articles:
            title = article.get("title", "")
            score = _score_headline(title)
            scores.append(score)
            article_sentiments.append({
                "title": title,
                "sentiment_score": score,
                "sentiment_label": _classify_score(score),
            })

        overall_score = round(sum(scores) / len(scores), 3) if scores else 0.0
        positive_count = sum(1 for s in article_sentiments if s["sentiment_label"] == "positive")
        negative_count = sum(1 for s in article_sentiments if s["sentiment_label"] == "negative")
        neutral_count = sum(1 for s in article_sentiments if s["sentiment_label"] == "neutral")

        return {
            "ticker": ticker,
            "overall_sentiment": _classify_score(overall_score),
            "overall_score": overall_score,
            "article_count": len(articles),
            "positive_count": positive_count,
            "negative_count": negative_count,
            "neutral_count": neutral_count,
            "article_sentiments": article_sentiments,
            "methodology": "keyword-based headline analysis",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Error computing sentiment for %s", ticker)
        return {"error": f"Failed to compute sentiment for '{ticker}': {str(exc)}"}


# ---------------------------------------------------------------------------
# Tool dispatch map
# ---------------------------------------------------------------------------
_TOOL_DISPATCH = {
    "get_recent_news": get_recent_news,
    "get_sentiment_data": get_sentiment_data,
}


def handler(event, context):
    """AWS Lambda entry point for the news_sentiment gateway tool.

    Args:
        event: Tool arguments dict (passed directly by Bedrock Agent Core).
        context: Lambda context carrying the tool name in client_context.

    Returns:
        Response dict with 'content' list matching the FAST template pattern.
    """
    logger.info("news_sentiment handler invoked | event=%s", json.dumps(event, default=str))

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
