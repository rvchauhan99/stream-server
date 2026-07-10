# NightKing / knight-kings ops runbook

## Deploy API (Cloud Run)

```bash
cd stream-server
# Ensure .env points at streaming-prod and CORS includes Vercel origin
./deploy.sh
```

- Project: `knight-kings-prod`
- Region: `us-central1`
- Service: `knight-kings-api`
- Health: `GET /health` (checks Mongo)

## Deploy Frontend (Vercel)

Repo: `cryptovideo8/stream-frontend` branch `main`

Env:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`

## Rollback API

```bash
gcloud run revisions list --service=knight-kings-api --region=us-central1
gcloud run services update-traffic knight-kings-api --region=us-central1 --to-revisions=REVISION=100
```

## Secrets

Prefer GCP Secret Manager for production. Until then, keep `.env` mode `600` and never commit it.
Rotate: JWT_SECRET, Bunny keys, Brevo SMTP key, Mongo password.

## Incidents

| Symptom | Check |
|---------|--------|
| CORS errors | `CORS_ALLOWED_ORIGINS` includes exact Vercel origin; redeploy |
| Video won't play | `TOKEN_AUTH_KEY`, `BUNNY_LIBRARY_ID`, `BASE_URL` clean (no spaces) |
| OTP fails | Brevo SMTP credentials; `/auth/send-otp` logs |
| Cron missed | Cloud Run min-instances >= 1; JobLock collection |

## Dangerous scripts

- `SCRIPTS/resetUsers.js` — requires `CONFIRM_PROD_RESET=YES` against streaming-prod
- Never point migrate/reset scripts at prod without a backup

## Atlas

- Enable continuous backup / PITR on `streaming-prod`
- Keep `streaming-dev` separate; avoid shared destructive scripts
