# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FAST (Fullstack AgentCore Solution Template) is a starter template for building full-stack AI agent applications on AWS Bedrock AgentCore. It combines a React frontend, Python agent patterns (Strands/LangGraph), and infrastructure-as-code (CDK or Terraform).

## Build & Development Commands

### Linting & Formatting (from repo root)
- `make lint` — runs ruff lint+format (Python) and ESLint (frontend)
- `make lint-cicd` — check-only mode (must pass before push)
- `make format` — auto-format Python with ruff

### Frontend (`cd frontend`)
- `npm run dev` — start Vite dev server
- `npm run build` — TypeScript check + production build
- `npm run test` — run Vitest tests
- `npm run test:watch` — Vitest in watch mode
- `npm run lint` / `npm run lint:fix` — ESLint

### Python
- `ruff check --fix` — lint Python code
- `ruff format` — format Python code
- `pytest tests/` — run unit tests

### Integration Testing
- `uv run test-scripts/test-agent.py` — test deployed agent
- `uv run test-scripts/test-memory.py` — test memory service
- `uv run test-scripts/test-gateway.py` — test gateway
- `python test-scripts/test-agent-docker.py` — test Docker image

### Deployment
- CDK: `cd infra-cdk && npm install && cdk deploy --all`
- Terraform: `cd infra-terraform && terraform init && terraform apply`
- Frontend: `python scripts/deploy-frontend.py`

## Architecture

```
frontend/          → React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui
patterns/          → Python agent implementations (strands-single-agent, langgraph-single-agent)
infra-cdk/         → AWS CDK stacks (TypeScript)
infra-terraform/   → Terraform alternative (HCL)
gateway/           → AgentCore Gateway tool utilities (Python)
tools/             → Reusable agent tools (e.g., code_interpreter)
scripts/           → Deployment and utility scripts
test-scripts/      → Integration test scripts
docs/              → Authoritative project documentation (MkDocs)
vibe-context/      → AI assistant rules and conventions
```

### Key data flow
1. User interacts with React frontend, authenticates via Cognito OAuth
2. Frontend streams messages to agent via AgentCore Runtime
3. Agent (Strands or LangGraph) processes request, accesses tools via AgentCore Gateway (MCP protocol)
4. Gateway routes tool calls to Lambda-based tools
5. AgentCore Memory persists conversation history by session ID

### Agent pattern selection
Configured in `infra-cdk/config.yaml` (`backend.pattern`): `strands-single-agent` or `langgraph-single-agent`. Each pattern has its own `Dockerfile`, `requirements.txt`, and entry point in `patterns/`.

## Coding Conventions (from vibe-context/)

- **Docstrings required** on every function: purpose, parameter names/types, return type
- **Explicit strong types** in all method signatures and return types
- **No silent fallbacks** — fail loudly rather than defaulting to make things work
- **Named parameters** preferred over positional
- **Comment non-obvious code** assuming the reader has moderate-to-low familiarity

## Important Rules

- **Read the relevant README** before working on any component (e.g., `frontend/README.md`, `infra-cdk/README.md`)
- **docs/ is authoritative** — domain experts wrote these guides. Read relevant docs before implementing (e.g., `docs/GATEWAY.md` before gateway work, `docs/STREAMING.md` before streaming changes)
- **Exclude noise from searches** — always filter out `node_modules` and `cdk.out` from grep/search results
- **Run `make lint-cicd`** before pushing — CI/CD will reject code that fails linting

## Python Config

- Ruff: line-length 88, target Python 3.11, lint rules `E,F,W,I,N,UP,S,B,A,C4,T20` (see `pyproject.toml`)
- `ruff.toml` extends excludes for `patterns/` and `src/` directories
- mypy: strict mode, `disallow_untyped_defs`
- pytest: test paths in `tests/`, files matching `test_*.py` or `*_test.py`

## Frontend Config

- React 19, React Router v6, Vite 7, Tailwind CSS 4, shadcn/ui
- Path alias: `@/` maps to `src/`
- UI components: shadcn/ui + Radix primitives, Lucide icons
- Auth: `react-oidc-context` + `aws-amplify`

## Terraform Config

- 3 modules mirror CDK's 3 stacks: `amplify-hosting`, `cognito`, `backend`
- **CDK is source of truth**: read `infra-cdk/lib/backend-stack.ts` before modifying `infra-terraform/modules/backend/`
- Backend module uses split files (`memory.tf`, `gateway.tf`, `runtime.tf`, etc.), each annotated with `# Maps to: backend-stack.ts <methodName>()`
- Prefer direct internal references within a module (e.g., `aws_bedrockagentcore_memory.main.arn`) over passing values through variables
- Lambda code is shared from `infra-cdk/lambdas/` — never duplicate under `infra-terraform/`
- License: `# SPDX-License-Identifier: Apache-2.0` on all files
- Run `terraform fmt` and `terraform validate` before committing `.tf` changes
- Deployment is a 3-step process: `terraform apply` (infra) → `build-and-push-image.sh` (Docker) → `terraform apply` (runtime)
