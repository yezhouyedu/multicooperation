# Admin Auth and Idempotency Implementation

Status: implemented on 2026-06-17.

## Admin Auth

- Public entry: `POST /admin/auth/login`.
- Password source: `ADMIN_PASSWORD`; default is `20260617`.
- Token: HMAC bearer token, default 12 hour TTL.
- Token secret: `ADMIN_TOKEN_SECRET` if set; otherwise follows `ADMIN_PASSWORD`.
- Protected controllers: `AdminController` and `SideTaskAdminController`.
- Frontend: `/admin` stores the token in `sessionStorage`; admin API requests send `Authorization: Bearer <token>`.

Changing the password:

- Local: set `ADMIN_PASSWORD=your_new_password` in the server env and restart server.
- Production: edit `/opt/multi-cooperation/.env.production`, set `ADMIN_PASSWORD=your_new_password`, then redeploy/restart server.
- Existing tokens become invalid when the password changes unless `ADMIN_TOKEN_SECRET` is manually kept unchanged.

## Idempotency

Model: `IdempotencyRecord`.

Fields:

- `key`: client-provided idempotency key, unique.
- `route`: logical route name.
- `scope`: session/participant/task scope.
- `response`: JSON-safe first response.
- `status`: `pending`, `completed`, or `failed`.
- `expiresAt`: cleanup horizon, currently 24h.

Covered runtime POST paths:

- practice quiz submit.
- ready practice/formal.
- pre-segment instruction open/complete.
- progress record.
- draft save.
- view A info / view A materials.
- A submit.
- B complete.
- questionnaire submit.
- side-task answer.

Business-level duplicate guards also remain necessary and implemented for questionnaire, A submit, B complete, and view A info.
