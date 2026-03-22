#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse stack name from config.yaml
STACK_NAME="${1:-$(grep '^stack_name_base:' "$PROJECT_ROOT/infra-cdk/config.yaml" | awk '{print $2}')}"

echo "========================================="
echo "  InvestSmart Full Deploy"
echo "  Stack: $STACK_NAME"
echo "========================================="

# Verify AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' or set AWS_PROFILE."
  exit 1
fi

REGION=$(aws configure get region 2>/dev/null || echo "${AWS_DEFAULT_REGION:-us-east-1}")
echo "Region: $REGION"
echo ""

# ---- Step 1: CDK Deploy ----
echo ">> Step 1/2: Deploying CDK stacks..."
echo "-----------------------------------------"
cd "$PROJECT_ROOT/infra-cdk"

npm install --silent
npm run build

npx cdk bootstrap --quiet 2>/dev/null || true
npx cdk deploy --all --require-approval never --outputs-file cdk-outputs.json

echo ""
echo ">> CDK deploy complete."
echo ""

# ---- Step 2: Frontend Deploy ----
echo ">> Step 2/2: Building and deploying frontend..."
echo "-----------------------------------------"
cd "$PROJECT_ROOT"

python3 scripts/deploy-frontend.py "$STACK_NAME"

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "========================================="

# Print the Amplify URL from stack outputs
if [ -f "$PROJECT_ROOT/infra-cdk/cdk-outputs.json" ]; then
  URL=$(python3 -c "
import json
with open('$PROJECT_ROOT/infra-cdk/cdk-outputs.json') as f:
    data = json.load(f)
for stack in data.values():
    for k, v in stack.items():
        if 'AmplifyUrl' in k:
            print(v)
            break
" 2>/dev/null || true)
  if [ -n "$URL" ]; then
    echo "  Frontend URL: $URL"
  fi
fi
echo "========================================="
