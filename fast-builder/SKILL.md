---
name: fast-builder
description: >
  Use this skill whenever the user wants to build a full-stack application, web app, or any
  software project and provides requirements, a spec, SOW, feature list, or detailed description.
  This skill takes ANY project idea and builds it as a production-grade application using the
  AWS FAST (Fullstack AgentCore Solution Template) framework with Amazon Bedrock AgentCore,
  React frontend, and Cognito authentication. Trigger on requests like "build me an app",
  "here are my requirements", "turn this spec into a working app", "I need a web app that does X",
  "create an application for Y", or any variation where the user has a project idea they want
  built. Also trigger when the user provides a PDF, document, or description of what they want
  built. The stack is always FAST/AgentCore — the user provides the WHAT, this skill provides
  the HOW.
---

# FAST Builder

Takes any project requirements and builds a production-grade full-stack application on AWS using
the FAST (Fullstack AgentCore Solution Template) framework. You provide the idea — this skill
handles architecture, implementation, and deployment.

## What This Skill Produces

Given any set of requirements, this skill produces a deployed application with:
- **Frontend**: React + TypeScript + Vite, hosted on AWS Amplify, premium UI design
- **Backend**: AI agents (Strands SDK) running on Amazon Bedrock AgentCore with custom tools
- **Auth**: AWS Cognito (OAuth2 Authorization Code flow)
- **Infrastructure**: CDK-deployed nested stacks (Amplify, Cognito, Database, Backend)
- **API Layer**: API Gateway + Lambda for REST endpoints, AgentCore Gateway for agent tools
- **Async Processing**: Worker Lambdas for long-running agent tasks (async invoke + DynamoDB polling)
- **Data**: DynamoDB tables as needed by the application domain
- **Tests**: Unit and integration tests

## Prerequisites

Before starting, verify these are available:
- AWS CLI configured with appropriate credentials (`aws sts get-caller-identity`)
- Node.js 18+ and npm
- Python 3.11+ and pip (use `python3` on macOS — `python` doesn't exist)
- Docker Desktop **running** (not just installed — CDK synth/deploy will fail without it)
- AWS CDK CLI (`npm install -g aws-cdk`)
- Git

Run a quick check:
```bash
aws sts get-caller-identity && node --version && python3 --version && docker info >/dev/null 2>&1 && echo "Docker OK" && cdk --version && git --version
```

If anything is missing, help the user install it before proceeding.

## Workflow

### Phase 1: Understand Requirements and Plan

The user provides requirements in any format — a PDF, Word doc, markdown file, conversation
message, feature list, SOW, or even a rough idea. Whatever format, extract:

1. **Application purpose** — What problem does this solve? Who are the users?
2. **Core features** — What are the must-have capabilities?
3. **Agent behaviors** — What should AI agents handle? What decisions/analysis/generation?
4. **Data models** — What entities exist? What are their relationships?
5. **API endpoints** — What operations does the frontend need?
6. **Frontend pages/views** — What screens and interactions does the user need?
7. **External integrations** — Any third-party APIs, data sources, or services?
8. **Long-running tasks** — Which features take >10 seconds? These MUST use async processing.

**Map requirements to the FAST architecture:**

| Requirement Type | FAST Component |
|-----------------|----------------|
| AI/analysis/generation features | Strands agents in `patterns/` |
| Data fetching from external APIs | Gateway tools in `gateway/tools/` |
| CRUD operations on app data | API Lambdas in `infra-cdk/lambdas/api/` + DynamoDB |
| Long-running AI tasks (>10s) | Worker Lambda (async) + DynamoDB job table + frontend polling |
| Real-time AI chat/conversation | AgentCore streaming client (frontend direct to AgentCore) |
| User-facing screens | React pages in `frontend/src/routes/` |
| User management | Cognito (built-in) |
| File storage | S3 buckets (add to CDK) |

**CRITICAL DISTINCTION — Streaming vs Async:**

| Use Case | Pattern | Example |
|----------|---------|---------|
| Chat / conversational AI | **Streaming** — frontend calls AgentCore directly via `AgentCoreClient.invoke()` | Chat interface, Q&A |
| Research / report generation / portfolio building | **Async** — API creates job, Worker Lambda invokes AgentCore in background, frontend polls | Portfolio generation, analysis reports, document creation |

**Why?** Streaming has a timeout (~60-90s) after which the HTTP/2 connection drops. Long-running
agent tasks that make many tool calls (20+) will exceed this. The async pattern has no timeout
because the Worker Lambda runs independently (up to 15 minutes).

Create a `PLAN.md` in the project root with:
- Architecture diagram (text-based) showing how requirements map to FAST components
- List of agents with their tools and behaviors
- List of frontend pages with their purposes
- List of API endpoints and data models
- Clear identification of which features use streaming vs async
- Mapping table: requirement → implementation component
- Any assumptions or decisions

**Get user approval before building.**

### Phase 2: Scaffold and Build

#### 2a: Set Up the Project

If starting fresh:
```bash
git clone https://github.com/awslabs/fullstack-solution-template-for-agentcore.git <project-name>
cd <project-name>
```

Read the template's own docs first — they are the source of truth:
- `docs/DEPLOYMENT.md`, `docs/AGENT_CONFIGURATION.md`, `docs/GATEWAY.md`
- `docs/STREAMING.md`, `docs/MEMORY_INTEGRATION.md`
- `vibe-context/` for coding conventions

Remove `infra-terraform/` (use CDK). Update `infra-cdk/config.yaml` with the project name.

If the project already exists (user is extending it), read the existing codebase first to
understand what's already built before making changes.

#### 2b: Build the Backend

**For each AI agent** identified in the plan:

1. Copy `patterns/strands-single-agent/` to `patterns/<agent-name>/`
2. Customize `basic_agent.py`:
   - System prompt tailored to the agent's domain role
   - Model configuration
   - Memory integration via `AgentCoreMemorySessionManager`
   - Tool registrations

**For each gateway tool** (external API integrations the agent uses):

1. Create `gateway/tools/<tool-name>/` with Lambda handler + `tool_spec.json`
2. Use `PythonFunction` (NOT `lambda.Function`) in CDK if the tool has pip dependencies
3. Create `requirements.txt` in the tool directory listing dependencies
4. `tool_spec.json` MUST be a **plain JSON array** `[{...}]` (NOT `{"tools": [...]}`)
5. Register as `CfnGatewayTarget` in CDK stack

**For REST API endpoints** (frontend CRUD operations):

1. Create Lambda handler in `infra-cdk/lambdas/api/`
2. Wire up in `backend-stack.ts` with API Gateway routes + Cognito authorizer
3. Always add CORS Gateway Responses for 4XX/5XX errors (see gotcha #14)
4. Map DynamoDB field names to frontend-expected format in API responses (add `id` field, etc.)

**For long-running tasks** (see Async Pattern section below):

1. Create Worker Lambda in `infra-cdk/lambdas/worker/`
2. Create DynamoDB jobs table with TTL
3. Create API endpoints for job submission + status polling
4. Build frontend polling UI

#### Async Pattern for Long-Running Agent Tasks

Any feature where the agent makes multiple tool calls (research, analysis, report generation,
recommendations) MUST use this async pattern. Do NOT use streaming for these.

**Architecture:**
```
Frontend                    API Gateway (29s limit)        Background
   │                              │                           │
   ├─POST /generate──────────────►│                           │
   │                              ├─API Lambda────────────────┤
   │                              │  1. Create job in DynamoDB│
   │                              │  2. Async-invoke Worker   │
   │◄─── { jobId, status }───────┤  3. Return immediately    │
   │                              │                           │
   │                              │                    Worker Lambda (5min+)
   │                              │                    ├─Get M2M token from Cognito
   │                              │                    ├─Invoke AgentCore via HTTPS
   │                              │                    ├─Stream-read SSE response
   │                              │                    ├─Parse agent output
   │                              │                    ├─Save results to DynamoDB
   │                              │                    └─Update job status
   │                              │                           │
   │─GET /jobs/{id} (poll 5s)────►│                           │
   │◄─── { status, resultId }────┤                           │
```

**Key implementation details:**

1. **Worker Lambda invokes AgentCore via HTTPS, NOT boto3 SDK.**
   AgentCore Runtime uses JWT auth (Cognito OAuth2). The boto3 SDK uses SigV4 auth which
   produces: `AccessDeniedException: Authorization method mismatch`. Instead:
   - Worker gets an M2M access token using Cognito client credentials flow
   - Makes direct HTTPS POST to `https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{arn}/invocations`
   - Passes `Authorization: Bearer {m2m_token}` header

2. **AgentCore Runtime JWT authorizer must allow BOTH client IDs.**
   The runtime's `allowedClients` must include both the user-facing Cognito client ID (for
   frontend chat) AND the machine client ID (for Worker Lambda):
   ```typescript
   const authorizerConfiguration = agentcore.RuntimeAuthorizerConfiguration.usingJWT(
     discoveryUrl,
     [this.userPoolClientId, this.machineClient.userPoolClientId]  // BOTH!
   )
   ```

3. **Worker Lambda needs SSM + Secrets Manager permissions** to read M2M credentials:
   - SSM: `/{stack-name}/machine_client_id`, `/{stack-name}/cognito_provider`
   - Secrets Manager: `/{stack-name}/machine_client_secret`

4. **Stream-read the SSE response in chunks** — do NOT `resp.read()` the entire body.
   AgentCore streams 50-100MB+ of SSE events. Reading it all at once causes `IncompleteRead`
   errors. Instead read in 8KB chunks and parse line-by-line:
   ```python
   buffer = ""
   while True:
       chunk = resp.read(8192)
       if not chunk: break
       buffer += chunk.decode("utf-8", errors="replace")
       while "\n" in buffer:
           line, buffer = buffer.split("\n", 1)
           if line.strip().startswith("data: "):
               # parse SSE event, extract text tokens
   ```

5. **Implement retry logic** — the SSE stream drops intermittently (`IncompleteRead`).
   Retry up to 3 times. On each retry, the agent starts fresh and may succeed where the
   previous attempt's stream dropped.

6. **Parse agent output robustly** — the agent may return JSON in a markdown code block,
   raw JSON, or plain text. Use multiple parsing strategies:
   - Strategy 1: Extract from ````json ... ``` `` code block
   - Strategy 2: Find balanced braces containing expected keys
   - Strategy 3: Fix common JSON issues (trailing commas)
   - Strategy 4: Extract individual items via regex (fallback)

7. **Prompt engineering for structured output** — explicitly show the JSON format with
   a code block example in the prompt. State "Your FINAL output MUST be ONLY a JSON code
   block." The agent tends to write markdown prose unless strongly instructed.

8. **DynamoDB jobs table** — PK: `jobId`, with TTL for auto-cleanup (24h). Status values:
   `queued` → `processing` → `processing (attempt N)` → `completed` / `failed`.
   Store `portfolioId` (or result reference) on completion, `error` message on failure.

9. **Frontend polling** — poll `GET /api/jobs/{jobId}` every 5 seconds. The `onUpdate`
   callback MUST be awaited (use `await onUpdate(status)`) or the navigation/state updates
   won't complete before the poll loop exits.

10. **API Gateway 29-second hard limit** — this is why the async pattern exists. The API
    Lambda that receives the generate request MUST return within 29s. It only creates the
    job record and async-invokes the Worker — no waiting.

#### 2c: Build the Frontend

Read `references/taste-design-principles.md` BEFORE writing any frontend code.

**For each page:**

1. Create route component in `frontend/src/routes/<PageName>.tsx`
2. Register in `frontend/src/routes/index.tsx`
3. Build feature components in `frontend/src/components/<feature>/`
4. Create API service in `frontend/src/services/`
5. Add Zustand store in `frontend/src/stores/` if the page needs shared state
6. Use `persist` middleware for stores that should survive page refresh (preferences, portfolios)

**Design requirements** (applied to ALL projects):
- No Inter font — use Geist, Outfit, Cabinet Grotesk, or Satoshi
- No pure black (#000000) — use Zinc-950 or off-black
- No centered hero sections — use split-screen, asymmetric layouts
- No 3-column equal card grids — use asymmetric grids or zig-zag layouts
- Max 1 accent color, saturation < 80%
- Every interactive element needs loading, empty, and error states
- Spring physics for animations: `type: "spring" as const, stiffness: 100, damping: 20`
- Mobile-responsive: single-column collapse below 768px
- Use `min-h-[100dvh]` instead of `h-screen`

#### 2d: Wire Frontend to Backend

1. `aws-exports.json` is generated by `deploy-frontend.py` from CDK stack outputs
2. API services read the base URL from `aws-exports.json` at runtime
3. Auth tokens: use `id_token` for API Gateway (Cognito authorizer), `access_token` for AgentCore
4. Token retrieval: search BOTH `localStorage` and `sessionStorage` for `oidc.user:*` keys
   (the OIDC library's storage location depends on `WebStorageStateStore` config)
5. API responses: always include `Bearer ` prefix in Authorization header
6. DynamoDB field mapping: API should transform `portfolioId` → `id`, `holdings` → `recommendations`
   to match frontend type expectations

### Phase 3: Test

```bash
python3 -m pytest tests/ -v --tb=short
cd frontend && npm test
make all
```

### Phase 4: Deploy

```bash
cd infra-cdk && npm install && cdk bootstrap && cdk deploy --all --require-approval never
cd .. && python3 scripts/deploy-frontend.py
```

### Phase 5: Handoff

Create `HANDOFF.md` with deployment instructions, architecture summary, and extension guide.

---

## Critical Gotchas (Complete List)

### Backend / CDK

1. **Gateway tool_spec.json must be plain array** — `[{...}]`, NOT `{"tools": [...]}`.

2. **Docker must be running** — check with `docker info` before any CDK command.

3. **macOS Python** — always `python3`, never `python`.

4. **CDK nested stacks order** — FastMainStack → Amplify → Cognito → Database → Backend.

5. **CfnOutput for frontend** — `deploy-frontend.py` reads stack outputs for `aws-exports.json`.

6. **PythonFunction for Lambda dependencies** — gateway tools with pip dependencies (yfinance,
   requests, etc.) MUST use `PythonFunction` from `@aws-cdk/aws-lambda-python-alpha`, NOT
   `lambda.Function`. `PythonFunction` auto-installs `requirements.txt` via Docker.
   `lambda.Function` with `Code.fromAsset` only copies source files — no pip install.

7. **API Gateway CORS on error responses** — when using Cognito authorizer, rejected requests
   return 401 without CORS headers. Browser reports "CORS error" instead of 401. Fix:
   ```typescript
   api.addGatewayResponse("CorsDefault4XX", {
     type: apigateway.ResponseType.DEFAULT_4XX,
     responseHeaders: {
       "Access-Control-Allow-Origin": `'${frontendUrl}'`,
       "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
       "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
     },
   })
   ```

8. **API Gateway 29s timeout** — hard limit, cannot be changed. Any agent task that may
   exceed this MUST use the async Worker Lambda pattern.

### Authentication

9. **access_token vs id_token** — AgentCore Runtime needs `access_token`. API Gateway Cognito
    authorizer needs `id_token` with `Bearer ` prefix. Getting them mixed up produces cryptic errors.

10. **AgentCore JWT authorizer must allow both clients** — user client (frontend) AND machine
    client (Worker Lambda M2M). Otherwise Worker gets 401.

11. **Worker Lambda uses M2M client credentials** — NOT boto3 SigV4. Must get token from
    Cognito token endpoint using client_id + client_secret, then call AgentCore via HTTPS
    with `Bearer` token.

12. **Cognito callback URLs** — set in `fast-main-stack.ts`. Must include production Amplify URL.

13. **OIDC token storage location** — the library may use `localStorage` or `sessionStorage`
    depending on config. Token retrieval code must check BOTH.

### Frontend

14. **Routes in `src/routes/`** — NOT `src/app/`. Index at `src/routes/index.tsx`.

15. **Framer Motion `as const`** — `type: "spring" as const` in all transition objects.

16. **Zustand for state** — with `persist` middleware for data that should survive refresh.
    `partialize` to exclude transient state like `isLoading`.

17. **Zustand stores load from server on mount** — call `loadFromServer()` in `AppShell`
    only AFTER `isAuthenticated && !isLoading` to avoid token-not-ready errors.

18. **`aws-exports.json`** — generated at deploy time, not in git. Must redeploy frontend
    after any backend URL changes.

19. **Tailwind CSS v4** — CSS-based config in `src/styles/globals.css` with `@theme` blocks.

20. **Async poll callback must be awaited** — `await onUpdate(status)` in the poll loop,
    otherwise navigate/setState calls inside the callback won't complete.

21. **API response field mapping** — DynamoDB uses `portfolioId` but frontend expects `id`.
    API Lambda must transform fields to match frontend types. Don't show `compositeScore: 0`
    — only display scores > 0 (scores are 0 when analysis hasn't been run yet).

### Data / DynamoDB

22. **DynamoDB rejects Python floats** — `json.loads()` returns `float` values, but DynamoDB
    requires `Decimal`. Always convert before `put_item`:
    ```python
    def to_dynamo(obj):
        if isinstance(obj, float): return Decimal(str(obj))
        if isinstance(obj, dict): return {k: to_dynamo(v) for k, v in obj.items()}
        if isinstance(obj, list): return [to_dynamo(i) for i in obj]
        return obj
    report_table.put_item(Item=to_dynamo(report_item))
    ```

23. **DynamoDB sort key ordering** — UUIDs are NOT chronological. If you need "latest" record,
    don't rely on `ScanIndexForward=False` with UUID sort keys. Either use a timestamp-based
    sort key or query all and sort client-side.

24. **API response field mapping is critical** — DynamoDB field names (camelCase, `portfolioId`)
    must be mapped to frontend expectations (`id`, `recommendations` vs `holdings`). Do this
    in the API Lambda, not the frontend. Map in BOTH list and detail endpoints.

### Frontend Data Flow

25. **Zustand `loadFromServer` must MERGE, not replace** — when loading data from the server,
    merge with local state instead of overwriting. Server provides metadata, local cache may
    have full details (holdings, recommendations) that the list API doesn't return:
    ```typescript
    const localMap = new Map(local.map((p) => [p.id, p]))
    const merged = serverPortfolios.map((sp) => {
      const lp = localMap.get(sp.id)
      return lp ? { ...sp, recommendations: lp.recommendations } : sp
    })
    ```

26. **Load existing results on page mount** — for pages that show async job results (health
    reports, analysis), always try to load existing results on mount via `useEffect`. This
    handles the case where the user navigates away and comes back after completion.

27. **Handle 404 gracefully in service layer** — API endpoints that may not have data yet
    (e.g., health report before analysis) should return `null` on 404, not throw:
    ```typescript
    try {
      const result = await apiRequest(url)
      return result.data
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null
      throw err
    }
    ```

28. **Progress bar for async jobs** — use asymptotic progress (`p += (95 - p) * 0.03` every
    500ms) that approaches but never reaches 95%. Jump to 100% on completion. Include a
    "Stop" button that cancels the poll loop and resets UI state.

### Agent Prompts

29. **Force JSON output** — agents default to markdown prose. Prompt must include an explicit
    JSON code block example and state "Your FINAL output MUST be ONLY a JSON code block."

30. **Agent streaming produces 50-100MB+ of SSE data** — tool call inputs/outputs are huge.
    Always stream-read in chunks, never `resp.read()` the entire body.

31. **Stream drops are normal** — `IncompleteRead` after 60-90s is expected behavior, not a
    bug. The async Worker pattern with retry handles this gracefully.

32. **Worker Lambda should support multiple job types** — route by `event.type` field:
    ```python
    def handler(event, context):
        job_type = event.get("type", "generate")
        if job_type == "analyze": handle_health_analysis(event, context)
        else: handle_portfolio_generation(event, context)
    ```
    This avoids creating separate Worker Lambdas for each async task.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Docker errors during CDK | Start Docker Desktop, `docker info` |
| "Resource already exists" | `cdk destroy` then redeploy |
| Python bundling errors | Ensure `python3` on PATH, correct version |
| Frontend can't reach backend | Re-run `python3 scripts/deploy-frontend.py` |
| 401 client_id mismatch | Use `access_token` for AgentCore, `id_token` for API Gateway |
| CORS error on API calls | Add `addGatewayResponse` for 4XX/5XX in CDK |
| Cognito redirect fails | Check callback URLs in `fast-main-stack.ts` |
| Framer Motion TS errors | Add `as const` to transition `type` |
| Agent returns markdown not JSON | Strengthen prompt with explicit JSON example + "ONLY JSON" |
| `No module named 'yfinance'` | Switch from `lambda.Function` to `PythonFunction` in CDK |
| `Authorization method mismatch` | Worker must use HTTPS + Bearer token, not boto3 SDK |
| `IncompleteRead` in Worker | Stream-read in 8KB chunks, add retry logic (3 attempts) |
| Job completes but frontend stuck | Ensure `await onUpdate(status)` in poll loop |
| All scores showing 0 | Only display `compositeScore` when > 0; scores need separate analysis |
| Equal allocations (8.3% each) | Agent returned text not JSON; fix prompt to force JSON output |
| Token not found at login | Check both localStorage AND sessionStorage for `oidc.user:*` keys |
| `Float types are not supported` | DynamoDB rejects Python floats; convert with `Decimal(str(val))` recursively |
| Data disappears on page refresh | `loadFromServer` replacing local state; merge instead of replace |
| 404 on health report | Expected if not analyzed yet; handle 404 as `null` return, not error |
| Report saves but fields are None | Agent JSON field names don't match what you're saving; log the parsed output |
| Progress stuck at 95% | Poll callback not firing; check if job status matches expected string exactly |

## Important Notes

- **The FAST repo evolves.** Always read the cloned repo's docs/ — they override this skill.
- **Extend, don't rewrite.** The streaming client, auth flow, and CDK patterns are battle-tested.
- **Frontend is where you differentiate.** Backend is mostly config. Invest design effort in the UI.
- **Any domain works.** Whether it's finance, healthcare, e-commerce, education, or internal tools —
  the FAST framework handles the infrastructure. You focus on the domain logic.
- **Streaming for chat, async for everything else.** If the agent makes more than a few tool calls,
  use the async Worker Lambda pattern. The streaming connection WILL drop on long tasks.

## File Reference

- `references/taste-design-principles.md` — Complete design system for premium frontend UI
- `references/fast-template-overview.md` — FAST template architecture and structure reference
