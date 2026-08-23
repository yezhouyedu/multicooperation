# Multi Cooperation

> [English](README.en.md) | 中文

一个基于 A/B 协作场景的全栈实验平台，用于研究不同 AI、任务2提醒和合作叙事条件下的人机协作行为。

## 项目简介

本平台支持双人协作实验：两名参与者先按进入顺序成组，再在组内随机分配为 A / B，并在任务1、任务2及对应实验条件下完成协作判断。正式实验以团队/session 为单位，从 A0-A8 九条件平衡区组中原子领取处理槽位；实验条件、角色和公司顺序使用相互独立的 seed，并分别审计。

### 核心功能

- **参与者实验主流程**：登录 → 自动配对 → 开场指导语第 1 页 → 任务表预览第 2 页 → 测试题 → 测试轮（含教学引导）→ formal ready → 段前阅读材料 → 3 个正式工作段 + 段后问卷/休息 → 最终长问卷 → 结束
- **统一运行态与阶段引擎**：基于 SSE 的实时状态推送，支持自动阶段切换、倒计时、A 信息解锁
- **A/B 主工作台三区**：材料区（支持 txt/docx/pdf/xlsx 混合阅读）、答题区（结构化表单）、AI 区（支持流式输出、Markdown、图片上传）
- **草稿/快照/恢复系统**：跨工作段内容冻结与自动恢复
- **AI 上下文系统**：无 AI / BASIC / ADVANCED 三类正式条件、任务1/任务2隔离、分公司隔离、按阶段隔离
- **任务2系统**：900 题题库、continuous/batch 提醒频率、neutral_info/coop_narrative 叙事组别
- **admin 管理后台**：手动/正式模式、实验局创建与暂停续领、A0-A8 区组进度、线上实验质量参数、材料管理、题库导入和导出任务
- **线上实验质量**：正式工作段全屏门禁、每次切屏区间、2 秒违规阈值、120+20 秒无效行为、心跳/掉线/正式退出与 A/B 非对称收尾
- **变量记录与服务器导出**：A/B 分目录归档、事件/内容/AI/任务2/问卷/线上质量完整记录、zip 导出包 + 动态自检

### A0-A8 九个正式实验条件

| 论文条件 | 系统码 | AI 条件 | 任务2提醒 | 叙事条件 |
|---:|---|---|---|---|
| 1 | A0 | 无 AI | continuous 高频 | neutral_info 中性 |
| 2 | A1 | BASIC | continuous 高频 | neutral_info 中性 |
| 3 | A2 | ADVANCED | continuous 高频 | neutral_info 中性 |
| 4 | A7 | 无 AI | batch 低频 | neutral_info 中性 |
| 5 | A3 | BASIC | batch 低频 | neutral_info 中性 |
| 6 | A8 | 无 AI | continuous 高频 | coop_narrative 合作叙事 |
| 7 | A4 | BASIC | continuous 高频 | coop_narrative 合作叙事 |
| 8 | A6 | ADVANCED | batch 低频 | neutral_info 中性 |
| 9 | A5 | ADVANCED | continuous 高频 | coop_narrative 合作叙事 |

每个正式实验区组包含 A0-A8 各一次。已分配槽位不因退出或 session 取消而回收；Admin 切换实验局只影响后续新组成的 session，旧 session 始终使用创建时保存的快照。

## 技术栈

| 层     | 技术                                                   |
| ------ | ------------------------------------------------------ |
| 前端   | Next.js 15 + React 19 + Tailwind CSS v4                |
| 后端   | NestJS + Prisma 6 + PostgreSQL 16                      |
| AI     | 阿里云千问（qwen-turbo / qwen3.6-plus）                |
| 部署   | Docker Compose（生产式单机部署，Nginx HTTPS 反向代理） |
| 包管理 | pnpm（monorepo workspace）                             |

## 项目结构

```
multi cooperation/
├── apps/
│   ├── web/                  # Next.js 前端
│   └── server/               # NestJS 后端
├── infra/                    # 基础设施（Docker 等）
├── packages/                 # 共享包（预留）
├── scripts/                  # 脚本（启动/停止/部署）
├── 00_start_materials/       # 原始材料（不入库）
├── 01_rules/                 # 协作规则
├── 02_specs/                 # 规格文档
│   ├── 00_overview/          # 总览（APP_FLOW, PRD 等）
│   ├── 01_frontend/          # 前端规格
│   ├── 02_backend/           # 后端规格
│   ├── 03_execution/         # 执行验收
│   ├── 04_pre_deploy/        # 上线前数据准备
│   └── 05_server_deploy/     # 服务器部署
├── 03_tracking/              # 进度跟踪
├── 04_archive/               # 归档
└── storage/                  # 运行态存储
```

## 快速开始

### 本地开发

```powershell
# 安装依赖
corepack pnpm install

# 启动数据库
docker compose up -d postgres

# 生成 Prisma Client
corepack pnpm --filter server prisma:generate

# 初始化数据库
corepack pnpm --filter server prisma migrate dev

# 填充测试数据
corepack pnpm --filter server prisma:seed

# 启动开发服务器
corepack pnpm run dev:local
```

或者直接运行一键启动脚本：

```powershell
启动本地开发环境.bat
```

### 访问地址

| 服务  | 地址                        |
| ----- | --------------------------- |
| 前端  | http://localhost:3000       |
| 后端  | http://localhost:3001       |
| Admin | http://localhost:3000/admin |

### 生产部署

```powershell
# 从当前 git HEAD 打包上传并部署
powershell -ExecutionPolicy Bypass -File scripts/deploy/upload-git-archive.ps1 -Service all -AllowDirty
```

生产入口：

| 服务        | 地址                           |
| ----------- | ------------------------------ |
| Web / Admin | https://aiseek.tech            |
| Server API  | https://aiseek.tech/api        |
| Health      | https://aiseek.tech/api/health |

详见 [命令运行清单.md](02_specs/05_server_deploy/命令运行清单.md) 与 [HTTPS域名接入方案.md](02_specs/05_server_deploy/HTTPS部署/HTTPS域名接入方案.md)。

## 文档导航

| 文档                                                                           | 用途                          |
| ------------------------------------------------------------------------------ | ----------------------------- |
| [APP_FLOW.md](02_specs/00_overview/APP_FLOW.md)                                   | 实验主流程真相源              |
| [PROJECT_RULES.md](01_rules/PROJECT_RULES.md)                                     | 协作规则                      |
| [progress.md](03_tracking/progress.md)                                            | 项目进度真相源                |
| [实验条件与区组随机方案.md](02_specs/03_execution/实验条件与区组随机方案.md)      | A0-A8 与实验局区组随机真相源  |
| [线上实验质量与行为监测方案.md](02_specs/03_execution/线上实验质量与行为监测方案.md) | 全屏、切屏、无效行为、掉线与退出真相源 |
| [实验123计划.md](02_specs/03_execution/实验123计划.md)                            | 旧 session 历史兼容说明       |
| [问卷流程方案.md](02_specs/03_execution/问卷流程方案.md)                          | 正式问卷流程与保存口径        |
| [段前指导语方案.md](02_specs/03_execution/段前指导语方案.md)                      | 正式工作段前阅读材料流程      |
| [变量记录与服务器导出方案.md](02_specs/04_pre_deploy/变量记录与服务器导出方案.md) | 变量记录设计                  |
| [时间戳变量保存方案.md](02_specs/04_pre_deploy/时间戳变量保存方案.md)             | 任务1/任务2/AI 等待时间戳变量 |
| [数据库文件夹手册.md](02_specs/04_pre_deploy/数据库文件夹手册.md)                 | 导出包阅读指南                |
| [命令运行清单.md](02_specs/05_server_deploy/命令运行清单.md)                      | 服务器运维命令                |

## 当前状态

**阶段：A0-A8 九条件与线上质量逻辑实现 + HTTPS 域名部署 + 正式实验前验收**

- ✅ P0 服务器裸 IP 部署完成
- ✅ P1 域名 + HTTPS + Nginx 反向代理已接入：`https://aiseek.tech`
- ✅ A0-A8 九条件区组随机、V2.2 问卷与实验局管理已实现
- ✅ 正式工作段线上质量状态机、数据库区间与导出 JSON 已实现
- ⏳ 双被试三段人工验收、备份恢复演练、导出审查与公网端口收口

## 许可证

本项目为学术研究用途，不公开许可。

### Admin 安全

`/admin` 使用后端认证。密码由服务端环境变量 `ADMIN_PASSWORD` 提供，公开文档不记录真实生产密码。

- 本地：在 server 环境文件中设置 `ADMIN_PASSWORD=新密码`，然后重启 server。
- 线上：修改 `/opt/multi-cooperation/.env.production` 中的 `ADMIN_PASSWORD`，然后重启或重新部署 server。
- 前端不硬编码密码；修改 `ADMIN_PASSWORD` 后，旧 admin token 会失效。
- 如果真实密码曾出现在已提交文档或日志中，应立即轮换线上 `ADMIN_PASSWORD`。
