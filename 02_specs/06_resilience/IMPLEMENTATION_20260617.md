# 2026-06-17 Resilience Implementation

本文件记录本轮“Admin 强认证 + 稳健性 P0/P1 主干”的实际落地范围。

## Implemented

- Admin backend auth: `POST /admin/auth/login`; password from `ADMIN_PASSWORD`, default `20260617`.
- Admin API guard: `AdminController` and `SideTaskAdminController` are protected by bearer token.
- Token design: HMAC token, default 12 hour TTL, default signing secret follows `ADMIN_PASSWORD`; changing password invalidates old tokens.
- SSE resilience: server emits `id` and `retry`, keeps a short in-memory replay cache, and supports replay by `Last-Event-ID` or `lastEventId` query.
- Runtime fallback: frontend reconnects with exponential backoff and polls runtime every 5 seconds while SSE is disconnected.
- Draft resilience: A main form, B main form, and B feedback write to IndexedDB first; failed saves are merged into a local pending queue and flushed after reconnect.
- Key POST idempotency: `IdempotencyRecord` stores route/scope/response and key paths use `Idempotency-Key`.
- Business duplicate guards: questionnaire submit, A submit, B complete, and B view A info avoid duplicate state advancement.
- UX: topbar shows connection state and pending draft count; dirty workbench warns on close; offline AI/final submit is surfaced as unavailable.

## Password Change

Local:

```powershell
# Set ADMIN_PASSWORD in the server env file, then restart the server.
ADMIN_PASSWORD=your_new_password
```

Production:

```bash
cd /opt/multi-cooperation
sudo nano .env.production
# set ADMIN_PASSWORD=your_new_password
sudo bash scripts/deploy/deploy-prod.sh server
```

If only `ADMIN_PASSWORD` changes, web does not need a rebuild because the password is not hardcoded in the frontend.

## Deferred

- Sentry or equivalent error monitoring.
- Full Service Worker offline shell.
- PostgreSQL WAL/PITR backup automation.
- AI cached-answer fallback. If added later, cached answers must be visibly marked as cached/fallback and exported as such.
