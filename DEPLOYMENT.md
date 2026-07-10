# Knight Kings API — Cloud Run

## Live service

| Setting | Value |
|---------|--------|
| GCP account | `ravatrajsinh@gmail.com` |
| Project | `knight-kings-prod` |
| Region | `us-central1` (Iowa, USA) |
| Service | `knight-kings-api` |
| URL | https://knight-kings-api-361196162422.us-central1.run.app |
| Health | https://knight-kings-api-361196162422.us-central1.run.app/health |

## Redeploy

```bash
cd stream-server
./deploy.sh
```

## Netlify frontend env vars

Set these in the Netlify dashboard for `stream-frontend`, then redeploy:

```
NEXT_PUBLIC_API_URL=https://knight-kings-api-361196162422.us-central1.run.app
NEXT_PUBLIC_SOCKET_URL=https://knight-kings-api-361196162422.us-central1.run.app
```
