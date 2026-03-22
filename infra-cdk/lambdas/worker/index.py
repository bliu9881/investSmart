"""
Worker Lambda for async portfolio generation and health analysis.

Invoked asynchronously by the API Lambda. Calls AgentCore Runtime to generate
a portfolio or analyze holdings, parses the response, saves results to DynamoDB,
and updates job status.
"""

import json
import logging
import os
import re
import time
import uuid
from decimal import Decimal
from urllib import request as urllib_request
from urllib.parse import urlencode

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

JOBS_TABLE = os.environ.get("JOBS_TABLE", "invest-smart-jobs")
PORTFOLIOS_TABLE = os.environ.get("PORTFOLIOS_TABLE", "invest-smart-portfolios")
HOLDINGS_TABLE = os.environ.get("HOLDINGS_TABLE", "invest-smart-holdings")
HEALTH_REPORTS_TABLE = os.environ.get("HEALTH_REPORTS_TABLE", "invest-smart-health-reports")
RUNTIME_ARN = os.environ.get("RUNTIME_ARN", "")
STACK_NAME = os.environ.get("STACK_NAME", "invest-smart")


def update_job(job_id: str, updates: dict) -> None:
    """Update a job record in DynamoDB.

    Args:
        job_id: The job identifier.
        updates: Dict of field names to new values.
    """
    table = dynamodb.Table(JOBS_TABLE)
    update_parts = []
    values = {}
    names = {}

    for i, (key, val) in enumerate(updates.items()):
        placeholder = f":v{i}"
        name_placeholder = f"#k{i}"
        update_parts.append(f"{name_placeholder} = {placeholder}")
        values[placeholder] = val
        names[name_placeholder] = key

    update_parts.append("#updatedAt = :now")
    values[":now"] = int(time.time())
    names["#updatedAt"] = "updatedAt"

    table.update_item(
        Key={"jobId": job_id},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names,
    )


def get_m2m_access_token() -> str:
    """Get a machine-to-machine access token from Cognito using client credentials flow.

    Reads the machine client ID and secret from SSM/Secrets Manager,
    then exchanges them for an access token via the Cognito token endpoint.

    Returns:
        OAuth2 access token string.
    """
    ssm = boto3.client("ssm")
    sm = boto3.client("secretsmanager")

    # Read machine client config from SSM
    client_id = ssm.get_parameter(
        Name=f"/{STACK_NAME}/machine_client_id"
    )["Parameter"]["Value"]

    cognito_domain = ssm.get_parameter(
        Name=f"/{STACK_NAME}/cognito_provider"
    )["Parameter"]["Value"]

    # Read machine client secret from Secrets Manager
    secret_resp = sm.get_secret_value(
        SecretId=f"/{STACK_NAME}/machine_client_secret"
    )
    client_secret = secret_resp["SecretString"]

    # Exchange credentials for access token
    token_url = f"https://{cognito_domain}/oauth2/token"
    import base64
    auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    data = urlencode({
        "grant_type": "client_credentials",
        "scope": f"{STACK_NAME}-gateway/read {STACK_NAME}-gateway/write",
    }).encode("utf-8")

    req = urllib_request.Request(token_url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("Authorization", f"Basic {auth_header}")

    with urllib_request.urlopen(req) as resp:
        token_data = json.loads(resp.read().decode("utf-8"))

    logger.info("M2M access token obtained successfully")
    return token_data["access_token"]


def invoke_agent(prompt: str) -> str:
    """Invoke the AgentCore Runtime via HTTPS with OAuth2 Bearer token.

    The agent runtime is configured with JWT auth (Cognito), so we can't use
    the boto3 SDK (which uses SigV4). Instead we make a direct HTTPS request
    with a Bearer token, same as the frontend does.

    Args:
        prompt: The prompt to send to the agent.

    Returns:
        The complete text response from the agent.
    """
    session_id = str(uuid.uuid4())
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

    logger.info(f"Invoking AgentCore runtime via HTTPS: {RUNTIME_ARN[:80]}...")

    # Get M2M token
    access_token = get_m2m_access_token()

    # Build the HTTPS endpoint (same URL pattern as frontend AgentCoreClient)
    escaped_arn = RUNTIME_ARN.replace("/", "%2F").replace(":", "%3A")
    url = f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{escaped_arn}/invocations?qualifier=DEFAULT"

    payload = json.dumps({
        "prompt": prompt,
        "runtimeSessionId": session_id,
    }).encode("utf-8")

    req = urllib_request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Amzn-Bedrock-AgentCore-Runtime-Session-Id", session_id)

    resp = urllib_request.urlopen(req, timeout=270)

    # Stream-read the SSE response line by line to avoid loading 100MB+ into memory
    full_text = ""
    buffer = ""
    try:
        while True:
            chunk = resp.read(8192)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")

            # Process complete lines from the buffer
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if line.startswith("data: "):
                    try:
                        parsed = json.loads(line[6:])
                        if isinstance(parsed.get("data"), str):
                            full_text += parsed["data"]
                    except (json.JSONDecodeError, TypeError):
                        continue
    except Exception as e:
        # Stream may drop on long responses — use whatever text we've collected
        logger.warning(f"Stream read interrupted: {e}. Collected {len(full_text)} chars so far.")
    finally:
        resp.close()

    logger.info(f"Agent response: {len(full_text)} chars")
    return full_text


def parse_portfolio_json(text: str) -> dict:
    """Extract portfolio JSON from agent response text.

    Tries multiple strategies to find and parse valid JSON.

    Args:
        text: Raw agent response that may contain JSON in markdown code blocks.

    Returns:
        Parsed portfolio dict with recommendations and summary.

    Raises:
        ValueError: If no valid JSON found.
    """
    logger.info(f"Parsing portfolio JSON from {len(text)} chars of text")
    logger.info(f"First 500 chars: {text[:500]}")
    logger.info(f"Last 500 chars: {text[-500:]}")

    # Strategy 1: markdown code block
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError as e:
            logger.warning(f"Markdown JSON parse failed: {e}")

    # Strategy 2: Find balanced braces containing "recommendations"
    # Find the start of the JSON object
    start = text.find('{"recommendations')
    if start == -1:
        start = text.find('{\n  "recommendations')
    if start == -1:
        start = text.find('{ "recommendations')

    if start != -1:
        # Find matching closing brace by counting
        depth = 0
        end = start
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        if end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError as e:
                logger.warning(f"Balanced brace parse failed: {e}")
                # Try fixing common issues: trailing commas
                fixed = re.sub(r',\s*}', '}', text[start:end])
                fixed = re.sub(r',\s*]', ']', fixed)
                try:
                    return json.loads(fixed)
                except json.JSONDecodeError as e2:
                    logger.warning(f"Fixed JSON parse also failed: {e2}")

    # Strategy 3: Try parsing the entire text as JSON
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Strategy 4: Find any JSON object with "ticker" fields (partial extraction)
    recs = []
    for match in re.finditer(r'\{[^{}]*"ticker"\s*:\s*"([A-Z]+)"[^{}]*\}', text):
        try:
            rec = json.loads(match.group(0))
            if "ticker" in rec:
                recs.append(rec)
        except json.JSONDecodeError:
            continue

    if recs:
        logger.info(f"Extracted {len(recs)} recommendations via partial parsing")
        return {"recommendations": recs, "portfolio_summary": {}}

    raise ValueError(f"No valid portfolio JSON found in {len(text)} chars of agent response")


def parse_health_report_json(text: str) -> dict:
    """Extract health report JSON from agent response text.

    Tries multiple strategies to find and parse valid JSON.

    Args:
        text: Raw agent response that may contain JSON in markdown code blocks.

    Returns:
        Parsed health report dict.

    Raises:
        ValueError: If no valid JSON found.
    """
    logger.info(f"Parsing health report JSON from {len(text)} chars of text")
    logger.info(f"First 500 chars: {text[:500]}")
    logger.info(f"Last 500 chars: {text[-500:]}")

    # Strategy 1: markdown code block
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError as e:
            logger.warning(f"Markdown JSON parse failed: {e}")

    # Strategy 2: Find balanced braces containing "diversificationScore"
    for key in ['"diversificationScore"', '"sectorAllocation"', '"riskProfile"']:
        start = text.find('{')
        while start != -1:
            # Check if this object contains our key
            next_brace = text.find('{', start + 1)
            key_pos = text.find(key, start)
            if key_pos != -1 and (next_brace == -1 or key_pos < next_brace or key_pos > start):
                # Find matching closing brace by counting
                depth = 0
                end = start
                for i in range(start, len(text)):
                    if text[i] == '{':
                        depth += 1
                    elif text[i] == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break

                if end > start:
                    try:
                        return json.loads(text[start:end])
                    except json.JSONDecodeError as e:
                        logger.warning(f"Balanced brace parse failed: {e}")
                        # Try fixing common issues: trailing commas
                        fixed = re.sub(r',\s*}', '}', text[start:end])
                        fixed = re.sub(r',\s*]', ']', fixed)
                        try:
                            return json.loads(fixed)
                        except json.JSONDecodeError as e2:
                            logger.warning(f"Fixed JSON parse also failed: {e2}")
                break
            start = text.find('{', start + 1)

    # Strategy 3: Try parsing the entire text as JSON
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    raise ValueError(f"No valid health report JSON found in {len(text)} chars of agent response")


def save_portfolio(user_id: str, parsed: dict, preferences: dict) -> str:
    """Save a generated portfolio and its holdings to DynamoDB.

    Args:
        user_id: The authenticated user ID.
        parsed: Parsed portfolio data from the agent.
        preferences: User preferences used for generation.

    Returns:
        The generated portfolio ID.
    """
    portfolio_id = str(uuid.uuid4())
    now = int(time.time())
    summary = parsed.get("portfolio_summary", {})
    recommendations = parsed.get("recommendations", [])

    # Save portfolio metadata
    table = dynamodb.Table(PORTFOLIOS_TABLE)
    table.put_item(Item={
        "userId": user_id,
        "portfolioId": portfolio_id,
        "name": f"AI Portfolio — {summary.get('risk_profile', preferences.get('riskTolerance', 'Balanced'))}",
        "type": "generated",
        "typeCreated": f"generated#{now}",
        "preferenceSnapshot": preferences,
        "createdAt": now,
        "updatedAt": now,
    })

    # Check if allocations are present — if all zero, distribute evenly
    has_allocations = any(
        float(r.get("allocation_pct", r.get("allocationPct", r.get("allocation", 0)))) > 0
        for r in recommendations
    )
    even_alloc = round(100.0 / len(recommendations), 1) if recommendations else 0

    # Save holdings
    holdings_table = dynamodb.Table(HOLDINGS_TABLE)
    with holdings_table.batch_writer() as batch:
        for rec in recommendations:
            raw_alloc = float(
                rec.get("allocation_pct",
                    rec.get("allocationPct",
                        rec.get("allocation",
                            rec.get("weight", 0))))
            )
            alloc = raw_alloc if has_allocations else even_alloc

            batch.put_item(Item={
                "portfolioId": portfolio_id,
                "holdingId": str(uuid.uuid4()),
                "ticker": rec.get("ticker", ""),
                "companyName": rec.get("company_name", rec.get("companyName", rec.get("name", ""))),
                "allocationPct": Decimal(str(alloc)),
                "sector": rec.get("sector", ""),
                "rationale": rec.get("rationale", rec.get("reason", rec.get("description", ""))),
                "createdAt": now,
            })

    logger.info(f"Saved portfolio {portfolio_id} with {len(recommendations)} holdings (allocations: {'from agent' if has_allocations else 'evenly distributed'})")
    return portfolio_id


def handle_portfolio_generation(event, context):
    """Handle async portfolio generation.

    Args:
        event: Dict with jobId, userId, and preferences.
        context: Lambda context.
    """
    job_id = event.get("jobId")
    user_id = event.get("userId")
    preferences = event.get("preferences", {})

    logger.info(f"Worker started (generate): job={job_id}, user={user_id}")

    if not job_id or not user_id:
        logger.error("Missing jobId or userId")
        return

    try:
        # Mark as processing
        update_job(job_id, {"status": "processing"})

        # Build the prompt
        risk = preferences.get("riskTolerance", "Moderate")
        horizon = preferences.get("investmentHorizon", "Long-term")
        sectors = preferences.get("preferredSectors", [])
        favorites = preferences.get("favoriteStocks", [])
        sectors_str = ", ".join(sectors) if sectors else "All sectors"
        favorites_str = ", ".join(favorites) if favorites else "None specified"

        prompt = (
            f"Generate a diversified investment portfolio with these preferences:\n"
            f"- Risk Tolerance: {risk}\n"
            f"- Investment Horizon: {horizon}\n"
            f"- Preferred Sectors: {sectors_str}\n"
            f"- Favorite Stocks: {favorites_str}\n\n"
            f"Research 3 representative stocks (one per sector) using gateway___get_stock_data "
            f"and gateway___get_fundamentals. Then build a portfolio of 8-12 stocks.\n\n"
            f"CRITICAL: Your FINAL output MUST be ONLY a JSON code block — no text before or after. "
            f"Use this EXACT format:\n\n"
            f"```json\n"
            f'{{"recommendations": [\n'
            f'  {{"ticker": "AAPL", "company_name": "Apple Inc.", "allocation_pct": 15.0, '
            f'"sector": "Technology", "rationale": "Specific data-backed reason..."}},\n'
            f'  ...\n'
            f'], "portfolio_summary": {{"total_stocks": 10, "risk_profile": "{risk}"}}}}\n'
            f"```\n\n"
            f"RULES:\n"
            f"- allocation_pct values MUST sum to exactly 100\n"
            f"- Each stock MUST have a different allocation_pct based on conviction (not equal weights)\n"
            f"- Your response MUST end with the JSON code block — nothing after it"
        )

        # Invoke agent with retry (stream may drop on long responses)
        max_attempts = 3
        parsed = None
        last_error = None

        for attempt in range(1, max_attempts + 1):
            logger.info(f"Attempt {attempt}/{max_attempts}")
            update_job(job_id, {"status": f"processing (attempt {attempt})"})

            agent_text = invoke_agent(prompt)

            if not agent_text.strip():
                last_error = "Agent returned empty response"
                logger.warning(f"Attempt {attempt}: {last_error}")
                continue

            try:
                parsed = parse_portfolio_json(agent_text)
                if parsed.get("recommendations"):
                    break
                last_error = "Agent response has no recommendations"
                logger.warning(f"Attempt {attempt}: {last_error}")
                parsed = None
            except ValueError as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt}: {last_error}")
                parsed = None

        if not parsed or not parsed.get("recommendations"):
            raise ValueError(f"Failed after {max_attempts} attempts: {last_error}")

        # Save portfolio
        portfolio_id = save_portfolio(user_id, parsed, preferences)

        # Mark as completed
        update_job(job_id, {
            "status": "completed",
            "portfolioId": portfolio_id,
        })

        logger.info(f"Job {job_id} completed: portfolio={portfolio_id}")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        update_job(job_id, {
            "status": "failed",
            "error": str(e)[:500],
        })


def handle_health_analysis(event, context):
    """Handle async portfolio health analysis.

    Args:
        event: Dict with jobId, userId, and portfolioId.
        context: Lambda context.
    """
    job_id = event.get("jobId")
    user_id = event.get("userId")
    portfolio_id = event.get("portfolioId")

    logger.info(f"Worker started (analyze): job={job_id}, user={user_id}, portfolio={portfolio_id}")

    if not job_id or not user_id or not portfolio_id:
        logger.error("Missing jobId, userId, or portfolioId")
        return

    try:
        # Mark as processing
        update_job(job_id, {"status": "processing"})

        # Fetch holdings for this portfolio
        holdings_table = dynamodb.Table(HOLDINGS_TABLE)
        h_result = holdings_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("portfolioId").eq(portfolio_id)
        )
        holdings = h_result.get("Items", [])

        if not holdings:
            raise ValueError(f"No holdings found for portfolio {portfolio_id}")

        # Build holdings description for the prompt
        holdings_lines = []
        for h in holdings:
            ticker = h.get("ticker", "Unknown")
            quantity = h.get("quantity", h.get("allocationPct", "N/A"))
            sector = h.get("sector", "Unknown")
            holdings_lines.append(f"- {ticker}: quantity/allocation={quantity}, sector={sector}")
        holdings_str = "\n".join(holdings_lines)

        prompt = (
            f"Analyze this portfolio of holdings and provide a health report:\n"
            f"{holdings_str}\n\n"
            f"Use gateway___get_stock_data and gateway___get_fundamentals for each holding.\n\n"
            f"Return ONLY a JSON code block with this format:\n"
            f"```json\n"
            f'{{\n'
            f'  "diversificationScore": 72,\n'
            f'  "sectorAllocation": {{"Technology": 45, "Healthcare": 30}},\n'
            f'  "riskProfile": "Moderate",\n'
            f'  "marketCapDistribution": {{"largeCap": 60, "midCap": 25, "smallCap": 15}},\n'
            f'  "sectorConcentrationRisks": ["Technology at 45% exceeds 30% threshold"],\n'
            f'  "rebalancingSuggestions": [\n'
            f'    {{"action": "Decrease", "ticker": "AAPL", "targetAllocationPct": 10, "rationale": "..."}},\n'
            f'    {{"action": "Add", "ticker": "XLF", "targetAllocationPct": 5, "rationale": "..."}}\n'
            f'  ]\n'
            f'}}\n'
            f"```\n\n"
            f"RULES:\n"
            f"- diversificationScore is 0-100 (higher = more diversified)\n"
            f"- sectorAllocation percentages must sum to 100\n"
            f"- Include specific, data-backed rationale for each suggestion\n"
            f"- Your response MUST end with the JSON code block — nothing after it"
        )

        # Invoke agent with retry (stream may drop on long responses)
        max_attempts = 3
        parsed = None
        last_error = None

        for attempt in range(1, max_attempts + 1):
            logger.info(f"Attempt {attempt}/{max_attempts}")
            update_job(job_id, {"status": f"processing (attempt {attempt})"})

            agent_text = invoke_agent(prompt)

            if not agent_text.strip():
                last_error = "Agent returned empty response"
                logger.warning(f"Attempt {attempt}: {last_error}")
                continue

            try:
                parsed = parse_health_report_json(agent_text)
                if parsed.get("diversificationScore") is not None or parsed.get("sectorAllocation"):
                    break
                last_error = "Agent response missing health report fields"
                logger.warning(f"Attempt {attempt}: {last_error}")
                parsed = None
            except ValueError as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt}: {last_error}")
                parsed = None

        if not parsed:
            raise ValueError(f"Failed after {max_attempts} attempts: {last_error}")

        # Save health report — convert floats to Decimal for DynamoDB
        def to_dynamo(obj):
            """Recursively convert floats to Decimal for DynamoDB."""
            if isinstance(obj, float):
                return Decimal(str(obj))
            if isinstance(obj, dict):
                return {k: to_dynamo(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [to_dynamo(i) for i in obj]
            return obj

        report_id = str(uuid.uuid4())
        now = int(time.time())

        report_table = dynamodb.Table(HEALTH_REPORTS_TABLE)
        report_item = to_dynamo({
            "portfolioId": portfolio_id,
            "reportId": report_id,
            "userId": user_id,
            "diversificationScore": parsed.get("diversificationScore"),
            "sectorAllocation": parsed.get("sectorAllocation", {}),
            "riskProfile": parsed.get("riskProfile", "Unknown"),
            "marketCapDistribution": parsed.get("marketCapDistribution", {}),
            "sectorConcentrationRisks": parsed.get("sectorConcentrationRisks", []),
            "rebalancingSuggestions": parsed.get("rebalancingSuggestions", []),
            "createdAt": now,
        })
        report_table.put_item(Item=report_item)

        logger.info(f"Saved health report {report_id} for portfolio {portfolio_id}")

        # Mark as completed
        update_job(job_id, {
            "status": "completed",
            "reportId": report_id,
        })

        logger.info(f"Job {job_id} completed: reportId={report_id}")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        update_job(job_id, {
            "status": "failed",
            "error": str(e)[:500],
        })


def handler(event, context):
    """Worker Lambda handler — routes to generation or analysis based on job type.

    Args:
        event: Dict with jobId, userId, and type-specific fields.
        context: Lambda context.
    """
    job_type = event.get("type", "generate")
    if job_type == "analyze":
        handle_health_analysis(event, context)
    else:
        handle_portfolio_generation(event, context)
