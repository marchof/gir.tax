#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
API_SPEC="$SCRIPT_DIR/api.yaml"

export AWS_DEFAULT_REGION=eu-central-1
export AWS_PAGER=""

echo "Upload static content"
aws s3 sync --delete "$DIST_DIR/" s3://gir.tax/

echo "Update API Gateway"
aws apigateway put-rest-api --rest-api-id j2drfg83q4 --mode overwrite --body "fileb://$API_SPEC"
aws apigateway create-deployment --rest-api-id j2drfg83q4 --stage-name prod

