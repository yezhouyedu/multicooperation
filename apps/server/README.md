# apps/server

这是 `multi cooperation` 项目的后端应用，负责实验运行时、自动配对、阶段引擎、草稿与快照、AI 接口、admin 配置与材料管理。

## 1. 技术基线

- 框架：NestJS
- 数据库：PostgreSQL
- ORM：Prisma

## 2. 主要职责

- 手机号准入校验
- 先按进入顺序完成配对，再在组内随机分配 A / B
- 维护 session、阶段切换、工作段 / 休息段推进
- 维护 A 的 5 分钟窗口、A 信息解锁、B 查看 A 信息行为记录
- 草稿保存、冻结快照、恢复链路
- 主线 / 副线 AI 调用与消息日志
- 实验事件审计、变量记录、服务器导出任务
- admin 配置、材料管理、题库自动导入、数据导出 zip

## 3. 关键目录

- `src/auth/`
  - 登录与准入校验
- `src/experiment/`
  - 实验主运行时、阶段引擎、任务推进、SSE
- `src/ai/`
  - AI 聊天接口与历史记录
- `src/admin/`
  - admin 接口、材料系统、题库导入
- `src/recording/`
  - 实验审计事件、服务器导出、附件与导出存储
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
- `src/recording/export.service.ts`
  - 生成 session / participant 树状导出包
- `src/recording/experiment-audit.service.ts`
  - 统一记录关键实验事件
- `src/recording/storage.service.ts`
  - 本地导出、附件存储与 zip 创建
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
- `GET /experiment/session/:code`
- `GET /experiment/session/:code/runtime`
- `GET /experiment/session/:code/events`
- `GET /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/ready-practice`
- `POST /experiment/session/:code/ready-formal`
- `POST /experiment/session/:code/complete-practice`
- `POST /experiment/session/:code/progress`
- `GET /experiment/session/:code/tasks`
- `POST /experiment/session/:code/tasks/:taskId/draft`
- `GET /experiment/session/:code/tasks/:taskId/snapshots`
- `POST /experiment/session/:code/tasks/:taskId/restore-latest`
- `POST /experiment/session/:code/tasks/:taskId/a-submit`
- `POST /experiment/session/:code/tasks/:taskId/view-a-info`
- `POST /experiment/session/:code/tasks/:taskId/b-complete`
- `GET /admin/sessions`
- `POST /admin/export-jobs`
- `GET /admin/export-jobs/:id`
- `GET /admin/export-jobs/:id/download`
- `GET /admin/export`（兼容入口）
- `GET /admin/experiment-config`
- `POST /admin/experiment-config`
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
- 图片附件和导出包默认写入本地 `storage/`，后续上线可接 Docker volume、MinIO/S3 或其他对象存储

## 8. 当前协作约定

- 后端要以 `02_specs/00_overview/*` 和 `02_specs/02_backend/*` 为准
- 不恢复旧的手动角色分配逻辑
- 不把旧版 B 独立等待页重新做回状态机节点
- 高影响改动先做最小验证，再继续扩散
- 变量导出结构以 `02_specs/04_pre_deploy/数据库文件夹手册.md` 为准

## 9. 一句话说明

这个服务本质上是实验调度引擎 + 数据采集层 + 服务器导出层 + admin 后台服务，不只是一个普通 API 壳子。
