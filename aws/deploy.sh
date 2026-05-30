#!/bin/bash

export AWS_DEFAULT_REGION=eu-central-1

echo "Upload static content"
aws s3 sync --delete ../dist/ s3://gir.tax/

echo "Update API Gateway"
aws apigateway put-rest-api --rest-api-id j2drfg83q4 --mode overwrite --body 'fileb://api.yaml'
aws apigateway create-deployment --rest-api-id j2drfg83q4 --stage-name prod

