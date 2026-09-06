# 技术栈

> 状态：2026-09-06 当前生产实现口径
> 位置：`02_specs/00_overview/TECH_STACK.md`

## 1. 当前架构

项目采用 pnpm monorepo 和前后端分离架构：

- `apps/web`：Next.js 参与者前端与 Admin。
- `apps/server`：NestJS API、实验状态机、AI、记录和导出。
- PostgreSQL：结构化运行数据与实验审计数据。
- Docker Compose：生产服务编排。
- Nginx：HTTPS、域名跳转和 `/api/*` 反向代理。

## 2. 已锁定版本

| 层 | 当前实现 |
|---|---|
| Web | Next.js 16.2.4、React 19.2.4、TypeScript 5、Tailwind CSS 4 |
| Server | NestJS 11、Express 5、TypeScript 5.7 |
| ORM | Prisma 6.16.2 |
| Database | PostgreSQL 16 |
| Realtime | SSE 为运行态主通道，普通 HTTP API 负责写入与查询 |
| AI | 服务端 provider 兼容层；数据库 `AiSettings` 优先，环境变量兜底 |
| Documents | `docx-preview`、`react-pdf`、`pdfjs-dist`、`xlsx` |
| Images | `browser-image-compression`、`modern-screenshot` |
| Package manager | pnpm 10.11.0 workspace |

准确小版本以根目录、`apps/web/package.json`、`apps/server/package.json` 和 `pnpm-lock.yaml` 为准；本文记录架构口径，不代替锁文件。

## 3. 运行和存储

- 本地默认地址：web `3000`、server `3001`、PostgreSQL `5432`。
- 生产入口：`https://aiseek.tech`，API 使用 `https://aiseek.tech/api`。
- 生产服务：`postgres`、`server`、`web`、`nginx`。
- PostgreSQL 数据保存在 Docker volume `multi-cooperation_postgres_data`。
- 材料运行时副本、AI 图片附件和导出包保存在 `multi-cooperation_server_storage`，容器内路径为 `/app/storage`。
- 正式环境变量保存在服务器 `/opt/multi-cooperation/.env.production`，不得提交真实密码、AI key 或证书私钥。

## 4. 当前技术边界

- 前端不得直接持有 AI provider key。
- 参与者流程以服务端 runtime 和数据库状态为准，不能只依赖浏览器内存。
- 正式 session 的实验条件、随机种子、线上质量参数和指导语计划必须在创建时快照。
- 材料文件和图片不以 base64 写入分析 JSON；JSON 保存引用和相对路径。
- 生产部署不得使用会删除 volume 的命令。

## 5. 变更规则

升级框架、ORM、数据库、实时通信、存储或部署方式时，必须同时更新：

1. 对应 `package.json`、锁文件或基础设施配置。
2. 本文档。
3. 受影响模块 README 和规格。
4. `03_tracking/progress.md`。
