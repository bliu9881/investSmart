# FAST Template Overview

Quick reference for the Fullstack AgentCore Solution Template structure and key components.

Source: https://github.com/awslabs/fullstack-solution-template-for-agentcore

## Project Structure

```
fullstack-agentcore-solution-template/
├── frontend/                          # React TypeScript application
│   ├── src/routes/                    # Page components + route definitions
│   │   ├── index.tsx                  # React Router route config
│   │   ├── DashboardPage.tsx          # Individual page components
│   │   └── ...
│   ├── src/components/                # UI components
│   │   ├── layout/                    # Navbar, AppShell
│   │   ├── shared/                    # Reusable components
│   │   ├── ui/                        # shadcn/ui base components
│   │   └── <feature>/                 # Feature-specific (e.g., analysis/, chat/)
│   ├── src/services/                  # API service layers
│   ├── src/stores/                    # Zustand state management
│   ├── src/hooks/                     # Custom hooks (useAuth, etc.)
│   ├── src/lib/                       # Utilities, agentcore-client
│   │   └── agentcore-client/          # Streaming WebSocket client
│   ├── src/styles/                    # Global styles (Tailwind v4 @theme)
│   ├── src/types/                     # TypeScript type definitions
│   ├── public/aws-exports.json        # Generated at deploy time (not in git)
│   ├── vite.config.ts                 # Build config
│   └── components.json               # shadcn/ui registry
├── infra-cdk/                         # CDK infrastructure
│   ├── bin/fast-cdk.ts                # CDK app entry point
│   ├── lib/                           # Stack definitions
│   │   ├── fast-main-stack.ts         # Parent stack (orchestrates nested stacks)
│   │   ├── amplify-hosting-stack.ts   # Amplify + S3 staging bucket
│   │   ├── cognito-stack.ts           # User Pool, OAuth, managed login
│   │   ├── database-stack.ts          # DynamoDB tables
│   │   └── backend-stack.ts           # AgentCore runtime, gateway, APIs
│   ├── lambdas/                       # Lambda function source code
│   │   ├── api/                       # REST API endpoint handlers
│   │   ├── feedback/                  # Feedback API handler
│   │   ├── oauth2-provider/           # M2M auth provider
│   │   └── zip-packager/              # Deployment packaging
│   └── config.yaml                    # Deployment parameters
├── patterns/                          # Agent implementations
│   ├── strands-single-agent/          # Strands SDK pattern (default)
│   │   ├── basic_agent.py             # Main entry point
│   │   ├── tools/                     # Agent-specific tools
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── langgraph-single-agent/        # LangGraph alternative
│   ├── claude-agent-sdk-single-agent/ # Claude Agent SDK pattern
│   ├── claude-agent-sdk-multi-agent/  # Multi-agent Claude pattern
│   └── utils/                         # Shared auth + SSM helpers
├── gateway/                           # Gateway tools (Lambda-based)
│   └── tools/                         # Tool implementations
│       ├── sample_tool/               # Reference implementation
│       └── <custom-tools>/            # Your custom gateway tools
├── scripts/                           # Deployment & utility scripts
│   ├── deploy.sh                      # Full deploy (CDK + frontend)
│   ├── deploy-frontend.py             # Frontend-only deployment
│   └── deploy-with-codebuild.py       # CI/CD ephemeral deploy
├── docs/                              # Comprehensive guides
│   ├── DEPLOYMENT.md
│   ├── AGENT_CONFIGURATION.md
│   ├── GATEWAY.md
│   ├── LOCAL_DEVELOPMENT.md
│   ├── STREAMING.md
│   ├── MEMORY_INTEGRATION.md
│   └── RUNTIME_GATEWAY_AUTH.md
├── vibe-context/                      # AI assistant steering
│   ├── AGENTS.md
│   ├── coding-conventions.md
│   └── development-best-practices.md
├── tests/                             # Test suites
│   ├── unit/
│   └── integration/
├── test-scripts/                      # Manual test utilities
├── docker/                            # Local dev containers
├── Makefile                           # Linting + unit tests
└── pyproject.toml                     # Python config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Hosting | AWS Amplify |
| Auth | AWS Cognito (OAuth2 Authorization Code) |
| Agents | Strands SDK (default), LangGraph, Claude Agent SDK |
| Runtime | Amazon Bedrock AgentCore |
| Infra | AWS CDK (default) or Terraform |
| Tools | Lambda functions via AgentCore Gateway |
| Code Exec | AgentCore Code Interpreter (sandboxed Python) |
| Animation | Framer Motion |
| Charts | Recharts |

## CDK Stack Architecture

The CDK uses a **nested stack** pattern:

```
FastMainStack (parent)
├── AmplifyHostingStack    → S3 staging bucket + Amplify app
├── CognitoStack           → User Pool + OAuth client + managed login
├── DatabaseStack          → DynamoDB tables
└── BackendStack           → AgentCore Runtime + Gateway + APIs + Lambdas
```

Stack outputs feed into `deploy-frontend.py` to generate `aws-exports.json`.

## Authentication Architecture

Three distinct auth flows:

1. **User → Frontend**: Cognito User Pool, Authorization Code grant → JWT
2. **Frontend → Agent Runtime**: **access_token** in Authorization header (NOT id_token)
3. **Runtime → Gateway**: OAuth2 Client Credentials (M2M), managed by AgentCore Identity

IMPORTANT: AgentCore Runtime requires `access_token`. Using `id_token` produces:
`401: Claim 'client_id' value mismatch with configuration.`

## Agent Pattern (Strands)

The default Strands agent pattern (`patterns/strands-single-agent/basic_agent.py`):
- Creates a `BedrockAgentCoreApp` instance
- Streams responses token-by-token via `agent.stream_async()`
- Persists conversations via `AgentCoreMemorySessionManager`
- Validates user identity from JWT tokens
- Registers tools for code execution and gateway services

## Adding New Agents

1. Copy `patterns/strands-single-agent/` to `patterns/<your-agent>/`
2. Modify `basic_agent.py`:
   - Update the system prompt
   - Register new tools
   - Configure model and memory
3. Create tools in `patterns/<your-agent>/tools/` or `gateway/tools/`
4. Update CDK stack to deploy the new agent

## Adding Gateway Tools

1. Create `gateway/tools/<tool-name>/`
2. Implement Lambda handler
3. Create `tool_spec.json` as a **plain JSON array** `[{...}]` (NOT `{"tools": [...]}`)
4. Register in CDK stack under API Gateway
5. Agent accesses via MCP protocol through AgentCore Gateway

## Adding API Endpoints

1. Create Lambda handler in `infra-cdk/lambdas/api/<endpoint-name>/`
2. Wire up in `backend-stack.ts` with API Gateway route
3. Add `CfnOutput` if frontend deploy script needs the URL
4. Create service layer in `frontend/src/services/` to call the endpoint

## Key Config Files

- `infra-cdk/config.yaml` — Project name, agent pattern, deployment type, network mode
- `frontend/vite.config.ts` — Build configuration
- `frontend/components.json` — shadcn/ui component registry
- `frontend/src/styles/globals.css` — Tailwind v4 theme configuration
- `pyproject.toml` — Python dependencies

## Deployment

```bash
# Full deploy (recommended)
./scripts/deploy.sh

# Or manually:
cd infra-cdk && npm install && npm run build && cdk bootstrap && cdk deploy --all --require-approval never
cd .. && python3 scripts/deploy-frontend.py
```
