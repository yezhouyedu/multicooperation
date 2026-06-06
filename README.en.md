# Multi Cooperation

> English | [中文](README.md)

A full-stack experimental platform for studying human-AI collaboration in a "Due Diligence Analyst — Investment Manager" cooperative scenario.

## Overview

This platform supports dual-participant experiments: one participant plays the "Due Diligence Analyst" (responsible for due diligence), and the other plays the "Investment Manager" (responsible for investment decisions). Through randomized role assignment, company sequencing, AI upgrade timing, side task reminder frequency, and cooperative narrative variables, the system supports crossed experimental conditions.

### Core Features

- **Participant Experiment Flow**: Login → Auto-pairing → Instructions → Quiz → Practice round (with tutorial) → 3 formal work segments + 2 break questionnaire segments → End
- **Unified Runtime & Stage Engine**: Real-time SSE state push with automatic stage switching, countdowns, and A-info unlocking
- **A/B Workbench Three-Panel Layout**: Materials panel (txt/docx/pdf/xlsx hybrid viewer), Answer panel (structured forms), AI panel (streaming output, Markdown, image upload)
- **Draft/Snapshot/Restore System**: Cross-segment content freezing and automatic restoration
- **AI Context System**: Basic/Advanced AI, main/side task isolation, company isolation, phase isolation
- **Side Task System**: 900-question bank, continuous/batch reminder frequency, neutral/cooperative narrative groups
- **Admin Backend**: Experiment mode switching (Experiment 1/2/3), material management, question import, export jobs
- **Variable Recording & Server Export**: A/B directory partitioned archiving, event/content/AI/side-task complete recording, zip export + dynamic self-check

### Experiment 1/2/3

| Experiment | Randomized Variable | Fixed Variables |
|------------|---------------------|-----------------|
| Exp 1: AI Capability Upgrade | `upgradeCohort` (early/late) | Side: continuous + neutral narrative |
| Exp 2: Side Task Reminder Frequency | `sideDispatchMode` (continuous/batch) | Basic AI + neutral narrative |
| Exp 3: Cooperative Narrative | `narrativeGroup` (coop/neutral) + theme order | Basic AI + continuous side tasks |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + React 19 + Tailwind CSS v4 |
| Backend | NestJS + Prisma 6 + PostgreSQL 16 |
| AI | Alibaba Cloud Qwen (qwen-turbo / qwen3.6-plus) |
| Deployment | Docker Compose (production-style single-server) |
| Package Manager | pnpm (monorepo workspace) |

## Project Structure

```
multi cooperation/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── server/               # NestJS backend
├── infra/                    # Infrastructure (Docker, etc.)
├── packages/                 # Shared packages (reserved)
├── scripts/                  # Scripts (start/stop/deploy)
├── 00_start_materials/       # Source materials (not tracked)
├── 01_rules/                 # Collaboration rules
├── 02_specs/                 # Specification documents
│   ├── 00_overview/          # Overview (APP_FLOW, PRD, etc.)
│   ├── 01_frontend/          # Frontend specs
│   ├── 02_backend/           # Backend specs
│   ├── 03_execution/         # Execution & acceptance
│   ├── 04_pre_deploy/        # Pre-deploy data preparation
│   └── 05_server_deploy/     # Server deployment
├── 03_tracking/              # Progress tracking
├── 04_archive/               # Archive
└── storage/                  # Runtime storage
```

## Quick Start

### Local Development

```powershell
# Install dependencies
corepack pnpm install

# Start database
docker compose up -d postgres

# Generate Prisma Client
corepack pnpm --filter server prisma:generate

# Initialize database
corepack pnpm --filter server prisma migrate dev

# Seed test data
corepack pnpm --filter server prisma:seed

# Start dev servers
corepack pnpm run dev:local
```

Or use the one-click startup script:

```powershell
启动本地开发环境.bat
```

### Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Admin | http://localhost:3000/admin |

### Production Deployment

```powershell
# Upload to server
powershell -ExecutionPolicy Bypass -File scripts/deploy/upload-project.ps1 -User ubuntu

# Create production environment variables
powershell -ExecutionPolicy Bypass -File scripts/deploy/create-prod-env.ps1 -User ubuntu
```

Then SSH into the server:

```bash
cd /opt/multi-cooperation
sudo bash scripts/deploy/deploy-prod.sh
```

See `02_specs/05_server_deploy/运维命令快速参考.md` for运维 commands.

## Documentation

| Document | Purpose |
|----------|---------|
| [APP_FLOW.md](02_specs/00_overview/APP_FLOW.md) | Experiment main flow (source of truth) |
| [PROJECT_RULES.md](01_rules/PROJECT_RULES.md) | Collaboration rules |
| [progress.md](03_tracking/progress.md) | Project progress (source of truth) |
| [实验123计划.md](02_specs/03_execution/实验123计划.md) | Experiment 1/2/3 mode switching |
| [变量记录与服务器导出方案.md](02_specs/04_pre_deploy/变量记录与服务器导出方案.md) | Variable recording design |
| [数据库文件夹手册.md](02_specs/04_pre_deploy/数据库文件夹手册.md) | Export package reading guide |
| [运维命令快速参考.md](02_specs/05_server_deploy/运维命令快速参考.md) | Server运维 commands |

## Current Status

**Phase: Long-term implementation + Local testing + Pre-launch wrap-up**

- ✅ P0 Server bare IP deployment completed
- ⏳ P1 Awaiting ICP approval → Domain + HTTPS
- ⏳ P2 Pre-experiment backup, rehearsal,运维 wrap-up

## License

This project is for academic research purposes only.
