"""
Portfolio Data Gateway Tool Lambda

Provides portfolio persistence and CSV parsing via DynamoDB.
Handles three tools:
- read_portfolio: Reads a user's portfolio from DynamoDB.
- read_analysis_cache: Reads cached analysis results from DynamoDB.
- parse_csv_holdings: Parses base64-encoded brokerage CSV into structured holdings.

Environment variables:
- PORTFOLIO_TABLE_NAME: DynamoDB table for portfolio data.
- ANALYSIS_CACHE_TABLE_NAME: DynamoDB table for analysis cache.
"""

import base64
import csv
import io
import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# DynamoDB resources (initialised lazily to support unit testing)
# ---------------------------------------------------------------------------
_dynamodb_resource = None
_portfolio_table = None
_analysis_cache_table = None


def _get_dynamodb():
    """Return a cached DynamoDB resource."""
    global _dynamodb_resource
    if _dynamodb_resource is None:
        _dynamodb_resource = boto3.resource("dynamodb")
    return _dynamodb_resource


def _get_portfolio_table():
    """Return the DynamoDB Table object for portfolios."""
    global _portfolio_table
    if _portfolio_table is None:
        table_name = os.environ.get("PORTFOLIO_TABLE_NAME", "portfolio-table")
        _portfolio_table = _get_dynamodb().Table(table_name)
    return _portfolio_table


def _get_analysis_cache_table():
    """Return the DynamoDB Table object for analysis cache."""
    global _analysis_cache_table
    if _analysis_cache_table is None:
        table_name = os.environ.get("ANALYSIS_CACHE_TABLE_NAME", "analysis-cache-table")
        _analysis_cache_table = _get_dynamodb().Table(table_name)
    return _analysis_cache_table


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


def _decimal_to_native(obj):
    """Recursively convert Decimal values from DynamoDB to int/float.

    Args:
        obj: Value to convert (dict, list, Decimal, or passthrough).

    Returns:
        Converted value with Decimals replaced by int or float.
    """
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_native(i) for i in obj]
    return obj


# ---------------------------------------------------------------------------
# Common brokerage CSV column name mappings
# ---------------------------------------------------------------------------
_TICKER_COLUMNS = {"ticker", "symbol", "stock", "stock symbol", "security"}
_SHARES_COLUMNS = {"shares", "quantity", "qty", "units", "number of shares"}
_PRICE_COLUMNS = {"price", "current price", "last price", "market price", "cost basis", "avg cost"}
_VALUE_COLUMNS = {"value", "market value", "total value", "current value", "amount"}


def _find_column(headers: list, candidates: set) -> int | None:
    """Find the index of a column whose lowercase/stripped name matches one of the candidates.

    Args:
        headers: List of header strings from the CSV.
        candidates: Set of lowercase candidate names.

    Returns:
        Column index or None if not found.
    """
    for idx, header in enumerate(headers):
        if header.strip().lower() in candidates:
            return idx
    return None


def _parse_number(value: str) -> float | None:
    """Parse a string into a float, stripping currency symbols and commas.

    Args:
        value: Raw string value from CSV.

    Returns:
        Float or None if parsing fails.
    """
    if not value:
        return None
    cleaned = value.strip().replace("$", "").replace(",", "").replace('"', "")
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def read_portfolio(arguments: dict) -> dict:
    """Read a user's portfolio from DynamoDB.

    Args:
        arguments: Dict containing 'user_id' (str) and optional 'portfolio_id' (str).

    Returns:
        Dict with portfolio data or error.
    """
    user_id = arguments.get("user_id", "").strip()
    if not user_id:
        return {"error": "Missing required parameter: user_id"}

    portfolio_id = arguments.get("portfolio_id", "").strip() if arguments.get("portfolio_id") else None

    try:
        table = _get_portfolio_table()

        if portfolio_id:
            # Get specific portfolio
            response = table.get_item(
                Key={"user_id": user_id, "portfolio_id": portfolio_id}
            )
            item = response.get("Item")
            if not item:
                return {
                    "error": f"Portfolio '{portfolio_id}' not found for user '{user_id}'.",
                    "user_id": user_id,
                    "portfolio_id": portfolio_id,
                }
            return {
                "user_id": user_id,
                "portfolio_id": portfolio_id,
                "portfolio": _decimal_to_native(item),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            # Query all portfolios for user
            response = table.query(
                KeyConditionExpression=Key("user_id").eq(user_id)
            )
            items = response.get("Items", [])

            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = table.query(
                    KeyConditionExpression=Key("user_id").eq(user_id),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            return {
                "user_id": user_id,
                "portfolio_count": len(items),
                "portfolios": _decimal_to_native(items),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
            }

    except Exception as exc:
        logger.exception("Error reading portfolio for user %s", user_id)
        return {"error": f"Failed to read portfolio: {str(exc)}"}


def read_analysis_cache(arguments: dict) -> dict:
    """Read cached analysis results from DynamoDB.

    Args:
        arguments: Dict containing 'ticker' (str) and 'analysis_type' (str).

    Returns:
        Dict with cached analysis or indication that no cache exists.
    """
    ticker = arguments.get("ticker", "").strip().upper()
    analysis_type = arguments.get("analysis_type", "").strip()

    if not ticker:
        return {"error": "Missing required parameter: ticker"}
    if not analysis_type:
        return {"error": "Missing required parameter: analysis_type"}

    try:
        table = _get_analysis_cache_table()

        response = table.get_item(
            Key={"ticker": ticker, "analysis_type": analysis_type}
        )
        item = response.get("Item")

        if not item:
            return {
                "ticker": ticker,
                "analysis_type": analysis_type,
                "cached": False,
                "message": "No cached analysis found.",
            }

        return {
            "ticker": ticker,
            "analysis_type": analysis_type,
            "cached": True,
            "data": _decimal_to_native(item),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        logger.exception("Error reading analysis cache for %s/%s", ticker, analysis_type)
        return {"error": f"Failed to read analysis cache: {str(exc)}"}


def parse_csv_holdings(arguments: dict) -> dict:
    """Parse a base64-encoded brokerage CSV into structured holdings.

    Supports common brokerage CSV formats by looking for standard column
    names (ticker/symbol, shares/quantity, price, value).

    Args:
        arguments: Dict containing 'csv_content' (str, base64-encoded CSV).

    Returns:
        Dict with parsed holdings list and summary statistics.
    """
    csv_content_b64 = arguments.get("csv_content", "")
    if not csv_content_b64:
        return {"error": "Missing required parameter: csv_content"}

    try:
        csv_bytes = base64.b64decode(csv_content_b64)
        csv_text = csv_bytes.decode("utf-8-sig")  # utf-8-sig handles BOM from Excel exports
    except Exception as decode_err:
        logger.error("Failed to decode base64 CSV content: %s", decode_err)
        return {"error": f"Failed to decode CSV content: {str(decode_err)}"}

    try:
        reader = csv.reader(io.StringIO(csv_text))
        rows = list(reader)

        if len(rows) < 2:
            return {"error": "CSV must contain at least a header row and one data row."}

        headers = rows[0]

        # Identify columns
        ticker_col = _find_column(headers, _TICKER_COLUMNS)
        shares_col = _find_column(headers, _SHARES_COLUMNS)
        price_col = _find_column(headers, _PRICE_COLUMNS)
        value_col = _find_column(headers, _VALUE_COLUMNS)

        if ticker_col is None:
            return {
                "error": "Could not identify a ticker/symbol column in the CSV.",
                "detected_headers": headers,
            }

        holdings = []
        parse_errors = []

        for row_idx, row in enumerate(rows[1:], start=2):
            if not row or all(cell.strip() == "" for cell in row):
                continue  # skip empty rows

            try:
                ticker_val = row[ticker_col].strip().upper() if ticker_col < len(row) else ""
                if not ticker_val:
                    continue

                holding = {"ticker": ticker_val}

                if shares_col is not None and shares_col < len(row):
                    shares = _parse_number(row[shares_col])
                    holding["shares"] = shares

                if price_col is not None and price_col < len(row):
                    price = _parse_number(row[price_col])
                    holding["price"] = price

                if value_col is not None and value_col < len(row):
                    value = _parse_number(row[value_col])
                    holding["market_value"] = value
                elif holding.get("shares") and holding.get("price"):
                    holding["market_value"] = round(holding["shares"] * holding["price"], 2)

                holdings.append(holding)

            except Exception as row_err:
                parse_errors.append({"row": row_idx, "error": str(row_err)})

        # Summary
        total_value = sum(h.get("market_value", 0) or 0 for h in holdings)

        # Add weight percentages
        if total_value > 0:
            for h in holdings:
                mv = h.get("market_value", 0) or 0
                h["weight_pct"] = round((mv / total_value) * 100, 2)

        result = {
            "holding_count": len(holdings),
            "holdings": holdings,
            "total_estimated_value": round(total_value, 2) if total_value else None,
            "detected_columns": {
                "ticker": headers[ticker_col] if ticker_col is not None else None,
                "shares": headers[shares_col] if shares_col is not None else None,
                "price": headers[price_col] if price_col is not None else None,
                "value": headers[value_col] if value_col is not None else None,
            },
            "parsed_at": datetime.now(timezone.utc).isoformat(),
        }

        if parse_errors:
            result["parse_errors"] = parse_errors

        return result

    except Exception as exc:
        logger.exception("Error parsing CSV holdings")
        return {"error": f"Failed to parse CSV: {str(exc)}"}


# ---------------------------------------------------------------------------
# Tool dispatch map
# ---------------------------------------------------------------------------
_TOOL_DISPATCH = {
    "read_portfolio": read_portfolio,
    "read_analysis_cache": read_analysis_cache,
    "parse_csv_holdings": parse_csv_holdings,
}


def handler(event, context):
    """AWS Lambda entry point for the portfolio_data gateway tool.

    Args:
        event: Tool arguments dict (passed directly by Bedrock Agent Core).
        context: Lambda context carrying the tool name in client_context.

    Returns:
        Response dict with 'content' list matching the FAST template pattern.
    """
    logger.info("portfolio_data handler invoked | event=%s", json.dumps(event, default=str))

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
