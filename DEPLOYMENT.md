# NightKing API — Cloud Run

## Live service

| Setting | Value |
|---------|--------|
| GCP account | `ravatrajsinh@gmail.com` |
| Project | `knight-kings-prod` |
| Region | `us-central1` |
| Service | `knight-kings-api` |
| URL | https://knight-kings-api-361196162422.us-central1.run.app |
| Health | https://knight-kings-api-361196162422.us-central1.run.app/health |

## Database

- Prod MongoDB: `streaming-prod`
- Seed indexes: `node SCRIPTS/ensureIndexes.js`
- Migrate from dev: `node SCRIPTS/migrateDevToProd.js`

## Redeploy

```bash
cd stream-server
./deploy.sh
```

See [RUNBOOK.md](./RUNBOOK.md) for rollback and incidents.

## Frontend env vars (Vercel)

```
NEXT_PUBLIC_API_URL=https://knight-kings-api-361196162422.us-central1.run.app
NEXT_PUBLIC_SOCKET_URL=https://knight-kings-api-361196162422.us-central1.run.app
```

CORS allowlist must include `https://knightkings.vercel.app`.
