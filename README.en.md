# Multi Cooperation

> English | [中文](README.md)

Multi Cooperation is a full-stack A/B collaboration experiment platform for studying how AI capability, Task 2 reminder frequency, and cooperation narratives affect human-AI teamwork.

## Current experiment

Two participants are paired in arrival order and then randomly assigned role A or B. A formal session atomically claims one slot from an A0-A8 balanced block. Condition assignment, role assignment, company order, and instruction order use separate auditable seeds.

The participant flow is:

`login → pairing → instructions → task preview → practice quiz → practice round → formal ready → three pre-segment instructions and work segments → segment surveys and breaks → final survey → payment confirmation`

The production participant interface uses only “role A/B” and “Task 1/Task 2”. Older role names and Experiment 1/2/3 labels are retained only for historical data compatibility.

## Formal conditions

| Paper condition | Code | AI | Task 2 reminder | Narrative |
|---:|---|---|---|---|
| 1 | A0 | None | continuous | neutral information |
| 2 | A1 | BASIC | continuous | neutral information |
| 3 | A2 | ADVANCED | continuous | neutral information |
| 4 | A7 | None | batch | neutral information |
| 5 | A3 | BASIC | batch | neutral information |
| 6 | A8 | None | continuous | cooperation narrative |
| 7 | A4 | BASIC | continuous | cooperation narrative |
| 8 | A6 | ADVANCED | batch | neutral information |
| 9 | A5 | ADVANCED | continuous | cooperation narrative |

Each nine-session block contains every condition once. Claimed slots are never recycled after withdrawal or cancellation. A0, A7, and A8 have no participant-facing AI and the server rejects AI requests for those sessions.

## Implemented capabilities

- SSE-backed runtime and synchronized stage transitions.
- Role-specific materials, structured Task 1 forms, and BASIC/ADVANCED AI panels.
- A shared 900-item Task 2 bank with continuous or batch reminders.
- V0.4 pre-segment instruction randomization and V3.0 questionnaires.
- Fullscreen gating, all off-screen intervals, a strict greater-than-two-second violation threshold, 120+20 second inactivity handling, heartbeats, disconnects, and role-specific dropout closure.
- Structured database records plus participant-scoped export packages containing content, AI, Task 2, questionnaires, timestamps, and online-integrity data.
- Admin management for formal runs, A0-A8 blocks, timing, online-integrity parameters, materials, questionnaires, Task 2 imports, and exports.

## Technology

| Layer | Current implementation |
|---|---|
| Web | Next.js 16.2.4, React 19.2.4, Tailwind CSS 4 |
| Server | NestJS 11, Express 5, Prisma 6.16.2 |
| Database | PostgreSQL 16 |
| Realtime | Server-Sent Events |
| Deployment | Docker Compose and Nginx HTTPS reverse proxy |
| Package manager | pnpm workspace |

## Local development

```powershell
corepack pnpm install
docker compose up -d postgres
corepack pnpm --filter server prisma:generate
corepack pnpm --filter server prisma migrate dev
corepack pnpm --filter server prisma:seed
corepack pnpm run dev:local
```

Local endpoints:

- Web: `http://localhost:3000`
- Server: `http://localhost:3001`
- Admin: `http://localhost:3000/admin`

## Production

The current public endpoint is `https://aiseek.tech`; `/api/*` is proxied to the server through Nginx.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/upload-git-archive.ps1 -Service all
```

Use [deployment commands](02_specs/05_server_deploy/命令运行清单.md), the [deployment runbook](02_specs/05_server_deploy/部署运行手册.md), and the [HTTPS runbook](02_specs/05_server_deploy/HTTPS部署/HTTPS域名接入方案.md). Do not run commands that delete production Docker volumes.

## Documentation

- [Experiment flow](02_specs/00_overview/APP_FLOW.md)
- [Project rules](01_rules/PROJECT_RULES.md)
- [Implementation timeline](03_tracking/progress.md)
- [A0-A8 design](02_specs/03_execution/实验条件与区组随机方案.md)
- [Online integrity](02_specs/03_execution/线上实验质量与行为监测方案.md)
- [Questionnaires](02_specs/03_execution/问卷流程方案.md)
- [Pre-segment instructions](02_specs/03_execution/段前指导语方案.md)
- [Export package manual](02_specs/04_pre_deploy/数据库文件夹手册.md)

## Current status

The implementation, HTTPS deployment, nine-condition randomization, V3.0 questionnaires, V0.4 instruction plan, and online-integrity state machine are live. A complete two-participant, three-segment rehearsal, backup restoration drill, export review, and closure of public fallback ports remain formal-launch checks.

## License

Academic research use only. No public license is granted.
