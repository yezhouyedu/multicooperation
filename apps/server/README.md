# apps/server

这是 `multi cooperation` 项目的后端应用，负责实验运行时、自动配对、阶段引擎、草稿与快照、AI 接口、admin 配置与材料管理。

## 1. 技术基线

- 框架：NestJS
- 数据库：PostgreSQL
- ORM：Prisma

## 2. 主要职责

- 手机号准入校验
- 自动分配 A / B 并完成配对
- 维护 session、阶段切换、工作段 / 休息段推进
- 维护 A 的 5 分钟窗口、A 信息解锁、B 查看门槛
- 草稿保存、冻结快照、恢复链路
- 主线 / 副线 AI 调用与消息日志
- admin 配置、材料管理、题库自动导入、数据导出

## 3. 关键目录

- `src/auth/`
  - 登录与准入校验
- `src/experiment/`
  - 实验主运行时、阶段引擎、任务推进、SSE
- `src/ai/`
  - AI 聊天接口与历史记录
- `src/admin/`
  - admin 接口、材料系统、题库导入
- `src/prisma/`
  - Prisma 模块与数据库服务
- `prisma/`
  - schema、migration、seed

## 4. 关键文件

- `src/main.ts`
  - 应用启动、静态材料暴露、body limit
- `src/app.module.ts`
  - 后端模块总入口
- `src/experiment/experiment.controller.ts`
  - 实验主接口入口
- `src/experiment/experiment.service.ts`
  - 运行时主逻辑
- `src/ai/ai.service.ts`
  - AI provider 兼容层
- `src/admin/admin.service.ts`
  - admin 主逻辑
- `src/admin/materials.ts`
  - 材料处理与题库扫描逻辑
- `prisma/schema.prisma`
  - 数据模型真相源

## 5. 运行方式

在项目根目录执行：

```powershell
corepack pnpm --filter server start:dev
corepack pnpm --filter server build
```

默认本地地址：

- `http://localhost:3001`

健康检查：

- `GET /health`

## 6. 常用接口

- `POST /auth/login`
- `GET /experiment/session/:code/runtime`
- `GET /experiment/session/:code/events`
- `POST /experiment/session/:code/tasks/:taskId/draft`
- `POST /experiment/session/:code/tasks/:taskId/a-submit`
- `POST /experiment/session/:code/tasks/:taskId/view-a-info`
- `POST /experiment/session/:code/tasks/:taskId/b-complete`
- `GET /admin/sessions`
- `GET /admin/export`
- `GET/POST /admin/ai-settings`

## 7. 环境变量

主要使用：

- `DATABASE_URL`
- `SERVER_PORT`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

说明：

- 当前 AI 配置优先可从数据库 `AiSettings` 读取
- 数据库为空时再回退 `.env`

## 8. 当前协作约定

- 后端要以 `02_specs/00_overview/*` 和 `02_specs/02_backend/*` 为准
- 不恢复旧的手动角色分配逻辑
- 不把旧版 B 独立等待页重新做回状态机节点
- 高影响改动先做最小验证，再继续扩散

## 9. 一句话说明

这个服务本质上是实验调度引擎 + 数据采集层 + admin 后台服务，不只是一个普通 API 壳子。
