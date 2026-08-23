# apps/web

这是 `multi cooperation` 项目的前端应用，负责参与者实验主流程、测试题与同步准备页、A/B 工作台、工作段回顾/最终问卷、支付确认和 admin 后台界面。

## 1. 技术基线

- 框架：Next.js
- 目录：`app router`
- 主要职责：
  - 参与者登录与自动配对后的页面流转
  - A / B 主工作台
  - 任务2展开页
  - 材料区阅读器
  - 任务1 / 任务2 AI 聊天区
  - admin 管理后台

## 2. 关键目录

- `src/app/`
  - 页面路由
- `src/components/`
  - 工作台、材料区、答题区、AI 区、admin 面板等组件
- `src/lib/`
  - runtime、草稿读取、缩放等前端运行时逻辑
- `指导文件/`
  - 当前高优先级前端母版参考

## 3. 关键页面

- `/login`
- `/waiting-room`
- `/instruction`
- `/instruction/task-preview`
- `/ready`
- `/practice-quiz`
- `/practice`
- `/break`
- `/pre-segment-instruction`
- `/workspace/a`
- `/workspace/b`
- `/workspace/b-waiting`
- `/workspace/b-feedback`
- `/workspace/end`
- `/admin`

当前正式实验入口为 `manual / formal`；正式模式按实验局 A0-A8 九条件平衡区组槽位分配条件。参与者前台不显示实验条件编号。正式工作段使用全屏门禁、切屏/无效行为监听和心跳，其他阶段不判定。

## 4. 关键组件

- `src/components/workbench-layout.tsx`
  - A/B 主工作台与任务2展开页的三区骨架
- `src/components/company-material-panel.tsx`
  - 材料区混合阅读器，支持 `txt / docx / pdf / xlsx`
- `src/components/ai-chat-panel.tsx`
  - 任务1 / 任务2 AI 聊天区
- `src/components/sidetask-strip.tsx`
  - 顶部任务2入口与任务2展开页入口
- `src/components/session-topbar.tsx`
  - 顶栏与倒计时

## 5. 运行方式

在项目根目录执行：

```powershell
corepack pnpm --filter web dev
corepack pnpm --filter web build
```

默认本地地址：

- `http://localhost:3000`

## 6. 环境变量

前端主要使用：

- `NEXT_PUBLIC_SERVER_BASE_URL`

未配置时默认请求：

- `http://localhost:3001`

## 7. 当前协作约定

- 前端不是自由发挥设计，优先对齐：
  - `apps/web/指导文件/index.html`
  - `02_specs/01_frontend/*`
- 先保护稳定布局，再优化细节
- 不要把浏览器整页滚动重新带回来
- 不要擅自恢复旧版独立 B 等待页

## 8. 一句话说明

这个应用不是普通管理站点，而是实验参与者主流程 + A/B 协作工作台 + admin 后台 的统一前端入口。
