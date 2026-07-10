#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-knight-kings-prod}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-knight-kings-api}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from your local secrets before deploying."
  exit 1
fi

# Cloud Run env-vars-file expects YAML: KEY: "value"
ENV_VARS_FILE="$(mktemp)"
trap 'rm -f "$ENV_VARS_FILE"' EXIT

{
  echo "# generated from $ENV_FILE"
  grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | while IFS= read -r line; do
    key="$(echo "$line" | sed 's/[[:space:]]*=[[:space:]]*/=/' | cut -d= -f1)"
    value="$(echo "$line" | sed 's/[[:space:]]*=[[:space:]]*/=/' | cut -d= -f2-)"
    value="${value#\'}"; value="${value%\'}"
    value="${value#\"}"; value="${value%\"}"
  [[ -n "$key" && -n "$value" ]] && printf '%s: "%s"\n' "$key" "$(printf '%s' "$value" | sed 's/"/\\"/g')"
  done
} > "$ENV_VARS_FILE"

if ! grep -q '^NODE_ENV:' "$ENV_VARS_FILE"; then
  echo 'NODE_ENV: "production"' >> "$ENV_VARS_FILE"
fi

echo "Deploying $SERVICE_NAME to Cloud Run..."
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --env-vars-file "$ENV_VARS_FILE" \
  --quiet

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
echo ""
echo "Deployed successfully."
echo "Service URL: $SERVICE_URL"
echo "Health check: $SERVICE_URL/health"
