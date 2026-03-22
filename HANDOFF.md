# InvestSmart - Handoff Document

## Deployment

### Prerequisites
- AWS CLI configured (`aws sts get-caller-identity`)
- Node.js 20+, Python 3.11+, Docker
- AWS CDK CLI (`npm install -g aws-cdk`)

### Deploy Backend
```bash
cd infra-cdk
npm install
cdk bootstrap   # First time only
cdk deploy
```

### Deploy Frontend
```bash
cd ..
python scripts/deploy-frontend.py
```

### Create First User
1. Go to AWS Cognito Console
2. Find `invest-smart-user-pool`
3. Create user with email + temporary password
4. Or set `admin_user_email` in `infra-cdk/config.yaml` before deploying

## Architecture Summary

- **Frontend**: React + TypeScript + Vite + Tailwind, hosted on AWS Amplify
- **Auth**: Cognito OAuth2 Authorization Code flow
- **Agents**: 8 Strands agents on AgentCore Runtime
- **Tools**: 6 Lambda-based gateway tools via AgentCore Gateway
- **Data**: 5 DynamoDB tables, analysis results cached with TTL
- **Region**: us-east-1

## Adding New Agents

1. Copy `patterns/strands-single-agent/` to `patterns/your-agent/`
2. Modify `basic_agent.py` system prompt and agent name
3. Add tools in `gateway/tools/your-tool/`
4. Update `infra-cdk/lib/backend-stack.ts` with new Lambda + Gateway Target
5. Deploy: `cd infra-cdk && cdk deploy`

## Adding New Gateway Tools

1. Create `gateway/tools/your-tool/your_tool_lambda.py`
2. Create `gateway/tools/your-tool/tool_spec.json`
3. Add Lambda + CfnGatewayTarget in `backend-stack.ts`
4. Deploy: `cd infra-cdk && cdk deploy`

## Modifying Frontend

1. Edit components in `frontend/src/`
2. Routes: `frontend/src/routes/index.tsx`
3. Stores: `frontend/src/stores/`
4. Services: `frontend/src/services/`
5. Build: `cd frontend && npm run build`
6. Deploy: `python scripts/deploy-frontend.py`

## Running Tests

```bash
# Python tests
python -m pytest tests/ -v

# Frontend tests
cd frontend && npm test

# Lint + unit tests
make all
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `infra-cdk/config.yaml` | Project name, region, agent pattern |
| `frontend/src/styles/globals.css` | Theme colors, fonts, design tokens |
| `patterns/*/basic_agent.py` | Agent system prompts and config |
| `gateway/tools/*/tool_spec.json` | Tool schemas for Gateway |

## External Data Sources

| Source | Purpose | Rate Limit |
|--------|---------|------------|
| yfinance | Stock prices, fundamentals, history | Free, no key needed |
| NewsAPI.org | News articles | 500 req/day (free tier) |

## Known Limitations

- Analysis agents use a single AgentCore Runtime (all share one runtime). For production, consider separate runtimes per agent.
- Free API rate limits may affect analysis quality under heavy use.
- CSV import supports common brokerage formats but may need extension for specific brokerages.
- Composite score normalization uses heuristic mappings - may need tuning.

## Cleanup

```bash
cd infra-cdk
cdk destroy --force
```
