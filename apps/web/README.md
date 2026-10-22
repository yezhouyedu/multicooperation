# apps/web

这是 `multi cooperation` 项目的前端应用，负责参与者实验主流程、测试题与同步准备页、A/B 工作台、工作段回顾/最终问卷、支付确认和 admin 后台界面。

## 1. 技术基线

- 框架：Next.js 16.2.4 + React 19.2.4
- 目录：`app router`
- 主要职责：
  - 参与者登录与自动配对后的页面流转
  - A / B 主工作台
  - 任务2展开页
  - 材料区阅读器，以及 B 查看 A 原始材料时的公司级前台可见区间记录
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

测试轮所有条件均不渲染 AI 区，教学只覆盖材料区、任务表和任务2，且后端拒绝测试轮 AI 请求。进入正式工作段后再按条件启用：A0/A7/A8 无 AI；ADVANCED 在任务1和任务2都支持站内框选截图与粘贴图片，不打开本地文件选择器；BASIC 不支持图片。

2026-10-10公共品牌统一为“实验任务平台”，包括浏览器标签页和页面顶部。ICP备案与公安备案只在 `/login` 登录首页底部以紧凑悬浮块展示；登录后的指导语、测试轮、正式工作台和 Admin 页面不渲染备案块，避免遮挡 AI 输入区和正式退出按钮。

测试轮A/B各自默认5分钟、Admin分别可调，完成个人教学后各自计时；到点自动提交，不提前提交。B仅显示“测试轮不显示本信息”占位，无真实A材料交互或反馈页。正式注意事项/报酬确认始终显示，监测文案按Session实际配置显示。最终定稿见 `../../02_specs/03_execution/1002反馈与测试轮最终方案.md`。

2026-10-22测试轮总览逐字采用研究者《测试轮指导语.txt》，只做排版；可提交内容在`src/content/practice-instructions.ts`。从仓库根运行`node scripts/verify-practice-instructions.cjs`，核对批准文本SHA-256、存在时与会议原件逐字比较，以及A/B在不同AI等级/时长下的实际渲染全文；会议原件不随部署上传。后续修改该文案必须经研究者批准，不得自行润色或插入Admin时长。

主动退出入口仅出现在正式任务1主工作台顶部状态栏的网络状态左侧，复用原确认弹窗；任务2展开后移除，返回后恢复。入口不是悬浮层，质量监测器不因任务2切换重复挂载，退出API和记录格式不变。

## 4. 关键组件

- `src/components/workbench-layout.tsx`
  - A/B 主工作台与任务2展开页的三区骨架
- `src/components/company-material-panel.tsx`
  - 材料区混合阅读器，支持 `txt / docx / pdf / xlsx` 与页面内截图
- `src/lib/use-b-a-material-exposure.ts`
  - 当 B 的活动标签属于 A 原始材料且网页可见、获焦时记录公司级开始/结束事件；A 材料之间切换不中断
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
