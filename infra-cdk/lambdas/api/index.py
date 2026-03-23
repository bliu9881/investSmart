"""
REST API Lambda handler for InvestSmart.

Handles CRUD operations for user preferences, portfolios, and holdings,
backed by DynamoDB. Authenticates via Cognito JWT (user ID from token claims).
"""

import json
import logging
import os
import re
import time
import uuid
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

USERS_TABLE = os.environ.get("USERS_TABLE", "invest-smart-users")
PORTFOLIOS_TABLE = os.environ.get("PORTFOLIOS_TABLE", "invest-smart-portfolios")
HOLDINGS_TABLE = os.environ.get("HOLDINGS_TABLE", "invest-smart-holdings")
CORS_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
HEALTH_REPORTS_TABLE = os.environ.get("HEALTH_REPORTS_TABLE", "invest-smart-health-reports")


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that converts Decimal to float."""

    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def json_dumps(obj):
    """Serialize to JSON handling Decimals."""
    return json.dumps(obj, cls=DecimalEncoder)


def cors_headers(origin: str = "*") -> dict:
    """Return CORS headers allowing the given origin."""
    allowed = [o.strip() for o in CORS_ORIGINS.split(",")]
    allow_origin = origin if origin in allowed else allowed[0]
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }


def response(status: int, body: dict, origin: str = "*") -> dict:
    """Build an API Gateway proxy response."""
    return {
        "statusCode": status,
        "headers": {**cors_headers(origin), "Content-Type": "application/json"},
        "body": json_dumps(body),
    }


def get_user_id(event: dict) -> str:
    """Extract authenticated user ID from Cognito JWT claims.

    Args:
        event: API Gateway proxy event.

    Returns:
        Cognito user sub (unique user ID).

    Raises:
        ValueError: If claims are missing.
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )
    user_id = claims.get("sub")
    if not user_id:
        raise ValueError("Missing user identity in token")
    return user_id


def parse_body(event: dict) -> dict:
    """Parse JSON body from event."""
    body = event.get("body", "{}")
    if isinstance(body, str):
        return json.loads(body) if body else {}
    return body or {}


# ---------------------------------------------------------------------------
#  Preferences handlers
# ---------------------------------------------------------------------------

def get_preferences(event: dict) -> dict:
    """GET /api/preferences — fetch user's saved preferences."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")

    table = dynamodb.Table(USERS_TABLE)
    result = table.get_item(Key={"userId": user_id})
    item = result.get("Item")

    if not item:
        return response(200, {"preferences": None}, origin)

    prefs = {
        "riskTolerance": item.get("riskTolerance"),
        "preferredSectors": item.get("preferredSectors", []),
        "favoriteStocks": item.get("favoriteStocks", []),
        "investmentHorizon": item.get("investmentHorizon"),
    }
    return response(200, {"preferences": prefs}, origin)


def save_preferences(event: dict) -> dict:
    """POST /api/preferences — create or update user preferences."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    body = parse_body(event)

    risk = body.get("riskTolerance")
    horizon = body.get("investmentHorizon")
    if not risk or not horizon:
        return response(400, {"error": "riskTolerance and investmentHorizon are required"}, origin)

    table = dynamodb.Table(USERS_TABLE)
    item = {
        "userId": user_id,
        "riskTolerance": risk,
        "preferredSectors": body.get("preferredSectors", []),
        "favoriteStocks": body.get("favoriteStocks", []),
        "investmentHorizon": horizon,
        "updatedAt": int(time.time()),
    }
    table.put_item(Item=item)

    return response(200, {"preferences": item}, origin)


# ---------------------------------------------------------------------------
#  Portfolio handlers
# ---------------------------------------------------------------------------

def list_portfolios(event: dict) -> dict:
    """GET /api/portfolios — list all portfolios for the user."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")

    table = dynamodb.Table(PORTFOLIOS_TABLE)
    result = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("userId").eq(user_id)
    )
    portfolios = result.get("Items", [])

    # Fetch holdings count and add id field for frontend
    holdings_table = dynamodb.Table(HOLDINGS_TABLE)
    for p in portfolios:
        pid = p.get("portfolioId")
        p["id"] = pid
        h_result = holdings_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("portfolioId").eq(pid),
            Select="COUNT",
        )
        p["holdingsCount"] = h_result.get("Count", 0)

    return response(200, {"portfolios": portfolios}, origin)


def get_portfolio(event: dict) -> dict:
    """GET /api/portfolios/{id} — get a portfolio with its holdings."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    portfolio_id = event.get("pathParameters", {}).get("id")

    if not portfolio_id:
        return response(400, {"error": "Portfolio ID is required"}, origin)

    # Get portfolio
    table = dynamodb.Table(PORTFOLIOS_TABLE)
    result = table.get_item(Key={"userId": user_id, "portfolioId": portfolio_id})
    item = result.get("Item")

    if not item:
        return response(404, {"error": "Portfolio not found"}, origin)

    # Get holdings and map to frontend-expected format
    holdings_table = dynamodb.Table(HOLDINGS_TABLE)
    h_result = holdings_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("portfolioId").eq(portfolio_id)
    )
    holdings = h_result.get("Items", [])

    # Map to frontend format
    item["id"] = item.get("portfolioId", portfolio_id)
    item["recommendations"] = [
        {
            "ticker": h.get("ticker", ""),
            "companyName": h.get("companyName", ""),
            "allocationPct": float(h.get("allocationPct", 0)),
            "sector": h.get("sector", ""),
            "rationale": h.get("rationale", ""),
            "compositeScore": float(h.get("compositeScore", 0)),
        }
        for h in holdings
    ]
    item["holdings"] = holdings
    item["createdAt"] = item.get("createdAt", "")

    return response(200, {"portfolio": item}, origin)


def create_portfolio(event: dict) -> dict:
    """POST /api/portfolios — create a new portfolio with holdings."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    body = parse_body(event)

    portfolio_id = str(uuid.uuid4())
    now = int(time.time())

    portfolio_type = body.get("type", "generated")
    name = body.get("name", f"Portfolio {portfolio_id[:8]}")

    # Save portfolio metadata
    table = dynamodb.Table(PORTFOLIOS_TABLE)
    portfolio_item = {
        "userId": user_id,
        "portfolioId": portfolio_id,
        "name": name,
        "type": portfolio_type,
        "typeCreated": f"{portfolio_type}#{now}",
        "preferenceSnapshot": body.get("preferenceSnapshot"),
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=portfolio_item)

    # Save holdings/recommendations
    holdings = body.get("holdings", body.get("recommendations", []))
    holdings_table = dynamodb.Table(HOLDINGS_TABLE)
    saved_holdings = []

    with holdings_table.batch_writer() as batch:
        for h in holdings:
            holding_id = str(uuid.uuid4())
            holding_item = {
                "portfolioId": portfolio_id,
                "holdingId": holding_id,
                "ticker": h.get("ticker"),
                "companyName": h.get("companyName", h.get("company_name", "")),
                "sector": h.get("sector", ""),
                "createdAt": now,
            }
            # Generated portfolio fields
            if "allocationPct" in h or "allocation_pct" in h:
                holding_item["allocationPct"] = Decimal(
                    str(h.get("allocationPct", h.get("allocation_pct", 0)))
                )
                holding_item["rationale"] = h.get("rationale", "")
                holding_item["compositeScore"] = Decimal(
                    str(h.get("compositeScore", h.get("composite_score", 0)))
                )
            # Imported portfolio fields
            if "quantity" in h:
                holding_item["quantity"] = Decimal(str(h["quantity"]))
            if "costBasis" in h or "cost_basis" in h:
                holding_item["costBasis"] = Decimal(
                    str(h.get("costBasis", h.get("cost_basis", 0)))
                )

            batch.put_item(Item=holding_item)
            saved_holdings.append(holding_item)

    portfolio_item["holdings"] = saved_holdings
    return response(201, {"portfolio": portfolio_item}, origin)


def update_portfolio(event: dict) -> dict:
    """PUT /api/portfolios/{id} — update portfolio name or holdings."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    portfolio_id = event.get("pathParameters", {}).get("id")
    body = parse_body(event)

    if not portfolio_id:
        return response(400, {"error": "Portfolio ID is required"}, origin)

    table = dynamodb.Table(PORTFOLIOS_TABLE)

    update_expr = "SET updatedAt = :now"
    expr_values: dict = {":now": int(time.time())}

    if "name" in body:
        update_expr += ", #n = :name"
        expr_values[":name"] = body["name"]

    table.update_item(
        Key={"userId": user_id, "portfolioId": portfolio_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ExpressionAttributeNames={"#n": "name"} if "name" in body else {},
    )

    return response(200, {"success": True}, origin)


def delete_portfolio(event: dict) -> dict:
    """DELETE /api/portfolios/{id} — delete a portfolio and its holdings."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    portfolio_id = event.get("pathParameters", {}).get("id")

    if not portfolio_id:
        return response(400, {"error": "Portfolio ID is required"}, origin)

    # Delete holdings first
    holdings_table = dynamodb.Table(HOLDINGS_TABLE)
    h_result = holdings_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("portfolioId").eq(portfolio_id)
    )
    with holdings_table.batch_writer() as batch:
        for item in h_result.get("Items", []):
            batch.delete_item(Key={
                "portfolioId": item["portfolioId"],
                "holdingId": item["holdingId"],
            })

    # Delete portfolio
    table = dynamodb.Table(PORTFOLIOS_TABLE)
    table.delete_item(Key={"userId": user_id, "portfolioId": portfolio_id})

    return response(200, {"success": True}, origin)


# ---------------------------------------------------------------------------
#  Async portfolio generation + job status
# ---------------------------------------------------------------------------

JOBS_TABLE = os.environ.get("JOBS_TABLE", "invest-smart-jobs")
WORKER_LAMBDA_ARN = os.environ.get("WORKER_LAMBDA_ARN", "")
lambda_client = boto3.client("lambda")


def generate_portfolio(event: dict) -> dict:
    """POST /api/portfolios/generate — start async portfolio generation.

    Creates a job record, async-invokes the Worker Lambda, returns immediately.
    """
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    body = parse_body(event)

    preferences = body.get("preferences", {})
    if not preferences.get("riskTolerance"):
        return response(400, {"error": "preferences.riskTolerance is required"}, origin)

    job_id = str(uuid.uuid4())
    now = int(time.time())

    # Create job record
    jobs_table = dynamodb.Table(JOBS_TABLE)
    jobs_table.put_item(Item={
        "jobId": job_id,
        "userId": user_id,
        "status": "queued",
        "preferences": preferences,
        "createdAt": now,
        "updatedAt": now,
        "expiresAt": now + 86400,  # TTL: 24 hours
    })

    # Async-invoke worker Lambda
    if not WORKER_LAMBDA_ARN:
        return response(500, {"error": "Worker Lambda not configured"}, origin)

    try:
        lambda_client.invoke(
            FunctionName=WORKER_LAMBDA_ARN,
            InvocationType="Event",  # Async — returns immediately
            Payload=json.dumps({
                "jobId": job_id,
                "userId": user_id,
                "preferences": preferences,
            }),
        )
    except Exception as e:
        logger.error(f"Failed to invoke worker: {e}")
        jobs_table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET #s = :s, #e = :e",
            ExpressionAttributeNames={"#s": "status", "#e": "error"},
            ExpressionAttributeValues={":s": "failed", ":e": str(e)},
        )
        return response(500, {"error": "Failed to start portfolio generation"}, origin)

    return response(202, {"jobId": job_id, "status": "queued"}, origin)


def get_job_status(event: dict) -> dict:
    """GET /api/jobs/{jobId} — check async job status."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    job_id = event.get("pathParameters", {}).get("jobId")

    if not job_id:
        return response(400, {"error": "Job ID is required"}, origin)

    jobs_table = dynamodb.Table(JOBS_TABLE)
    result = jobs_table.get_item(Key={"jobId": job_id})
    item = result.get("Item")

    if not item:
        return response(404, {"error": "Job not found"}, origin)

    # Verify ownership
    if item.get("userId") != user_id:
        return response(404, {"error": "Job not found"}, origin)

    return response(200, {
        "jobId": item["jobId"],
        "status": item.get("status", "unknown"),
        "portfolioId": item.get("portfolioId"),
        "error": item.get("error"),
        "createdAt": item.get("createdAt"),
    }, origin)


# ---------------------------------------------------------------------------
#  Analyze portfolio (health analysis)
# ---------------------------------------------------------------------------

def analyze_portfolio(event: dict) -> dict:
    """POST /api/portfolios/analyze — start async health analysis.

    Creates a job record, async-invokes the Worker Lambda, returns immediately.
    """
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    body = parse_body(event)

    portfolio_id = body.get("portfolioId")
    if not portfolio_id:
        return response(400, {"error": "portfolioId is required"}, origin)

    job_id = str(uuid.uuid4())
    now = int(time.time())

    # Create job record
    jobs_table = dynamodb.Table(JOBS_TABLE)
    jobs_table.put_item(Item={
        "jobId": job_id,
        "userId": user_id,
        "status": "queued",
        "type": "analyze",
        "portfolioId": portfolio_id,
        "createdAt": now,
        "updatedAt": now,
        "expiresAt": now + 86400,  # TTL: 24 hours
    })

    # Async-invoke worker Lambda
    if not WORKER_LAMBDA_ARN:
        return response(500, {"error": "Worker Lambda not configured"}, origin)

    try:
        lambda_client.invoke(
            FunctionName=WORKER_LAMBDA_ARN,
            InvocationType="Event",  # Async — returns immediately
            Payload=json.dumps({
                "jobId": job_id,
                "userId": user_id,
                "portfolioId": portfolio_id,
                "type": "analyze",
            }),
        )
    except Exception as e:
        logger.error(f"Failed to invoke worker: {e}")
        jobs_table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET #s = :s, #e = :e",
            ExpressionAttributeNames={"#s": "status", "#e": "error"},
            ExpressionAttributeValues={":s": "failed", ":e": str(e)},
        )
        return response(500, {"error": "Failed to start health analysis"}, origin)

    return response(202, {"jobId": job_id, "status": "queued"}, origin)


def get_health_report(event: dict) -> dict:
    """GET /api/portfolios/{id}/health — fetch the latest health report."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    portfolio_id = event.get("pathParameters", {}).get("id")

    if not portfolio_id:
        return response(400, {"error": "Portfolio ID is required"}, origin)

    table = dynamodb.Table(HEALTH_REPORTS_TABLE)
    result = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("portfolioId").eq(portfolio_id),
    )
    items = result.get("Items", [])

    if not items:
        return response(404, {"error": "No health report found"}, origin)

    # Sort by createdAt descending (UUID sort keys don't give chronological order)
    items.sort(key=lambda x: float(x.get("createdAt", 0)), reverse=True)
    items = [items[0]]

    return response(200, {"report": items[0]}, origin)


def accept_rebalancing(event: dict) -> dict:
    """POST /api/portfolios/{id}/rebalance/accept — accept a rebalancing suggestion."""
    user_id = get_user_id(event)
    origin = event.get("headers", {}).get("origin", "*")
    portfolio_id = event.get("pathParameters", {}).get("id")
    body = parse_body(event)

    suggestion_id = body.get("suggestionId")
    if not suggestion_id:
        return response(400, {"error": "suggestionId is required"}, origin)

    # Placeholder — full implementation would update holdings
    return response(200, {"success": True}, origin)


# ---------------------------------------------------------------------------
#  Router
# ---------------------------------------------------------------------------

ROUTES = {
    ("GET", "/api/preferences"): get_preferences,
    ("POST", "/api/preferences"): save_preferences,
    ("GET", "/api/portfolios"): list_portfolios,
    ("POST", "/api/portfolios"): create_portfolio,
    ("POST", "/api/portfolios/generate"): generate_portfolio,
    ("POST", "/api/portfolios/analyze"): analyze_portfolio,
    ("GET", "/api/portfolios/{id}"): get_portfolio,
    ("PUT", "/api/portfolios/{id}"): update_portfolio,
    ("DELETE", "/api/portfolios/{id}"): delete_portfolio,
    ("GET", "/api/portfolios/{id}/health"): get_health_report,
    ("POST", "/api/portfolios/{id}/rebalance/accept"): accept_rebalancing,
    ("GET", "/api/jobs/{jobId}"): get_job_status,
}


def handler(event, context):
    """Main Lambda handler — routes requests to the appropriate function.

    Args:
        event: API Gateway proxy event.
        context: Lambda context.

    Returns:
        API Gateway proxy response.
    """
    logger.info(f"Event: {json.dumps(event, default=str)}")

    method = event.get("httpMethod", "GET")
    path = event.get("resource", event.get("path", ""))
    origin = event.get("headers", {}).get("origin", "*")

    # Handle CORS preflight
    if method == "OPTIONS":
        return response(200, {}, origin)

    # Match route
    route_key = (method, path)
    handler_fn = ROUTES.get(route_key)

    if not handler_fn:
        return response(404, {"error": f"Not found: {method} {path}"}, origin)

    try:
        return handler_fn(event)
    except ValueError as e:
        logger.warning(f"Auth error: {e}")
        return response(401, {"error": str(e)}, origin)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return response(500, {"error": "Internal server error"}, origin)
