# Product decisions (Stage 3)

## Rent monetization
**Decision:** Keep `monetization.type: 'rent'` as an alias of `paid` for now (platform subscription required). True per-video rental (time-boxed purchase) is deferred until a payment product owner defines pricing UX.

## DRM
**Decision:** `drmEnabled` remains a storage flag only. Bunny DRM is not enabled. Do not advertise DRM in marketing until configured in Bunny and verified in playback.

## Brand
**Decision:** Public brand = **NightKing**. GCP project/service names remain `knight-kings-*` until a rename window. Support email target: `support@nightking.tv` (verify mailbox).

## Payments
**Decision:** UPI + PaymentAudit is the only activation path. Direct `POST /subscription/subscribe` stays disabled.

## Sessions
**Decision:** Bearer JWT in localStorage + middleware cookies (`nk_token`/`nk_role`) for route guards. httpOnly cookie migration is Stage 1 follow-up when FE/API cookie domain strategy is ready.

## Scale follow-ups (not in this PR)
- GCP Secret Manager wiring for Cloud Run
- Memorystore Redis for Socket.io adapter + shared rate limits
- Cloud Scheduler HTTP triggers replacing in-process cron (locks already mitigate multi-instance)
- Separate Atlas cluster for prod
