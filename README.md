# multi cooperation

这是 `E:\Own_program\multi cooperation` 的主工作区。它现在已经不只是“实验原型”，而是一个包含：

- 实验规则与规格
- 前后端代码
- 管理后台
- 题库/材料系统
- AI 协作工作台
- 进度与经验沉淀

的完整实验平台仓库。

编者注：个人认为最重要的文件是"E:\Own_program\multi cooperation\02_specs\00_overview\APP_FLOW.md"与"E:\Own_program\multi cooperation\03_tracking\progress.md"

---

## 1. 先看哪里

每次继续开发，建议先看：

1. [01_rules/PROJECT_RULES.md](/E:/Own_program/multi cooperation/01_rules/PROJECT_RULES.md)
2. [01_rules/CLAUDE.md](/E:/Own_program/multi cooperation/01_rules/CLAUDE.md)
3. [03_tracking/progress.md](/E:/Own_program/multi cooperation/03_tracking/progress.md)
4. [02_specs/00_overview/APP_FLOW.md](/E:/Own_program/multi cooperation/02_specs/00_overview/APP_FLOW.md)
5. 当前模块对应的 `02_specs/*`

一句话：

**先同步规则、进度、流程，再动代码。**

---

## 2. 根目录地图

### `00_start_materials/`

原始输入材料区。

这里有三类东西：

- 最早的会议文档、逻辑文档、前端参考材料
- 参与者可见的正式题目材料
- Word 真相源表单

当前最关键的是：

- [原始材料/A端尽调表_参与者可见版v2.docx](/E:/Own_program/multi cooperation/00_start_materials/原始材料/A端尽调表_参与者可见版v2.docx)
- [原始材料/B端投资判断表_参与者可见版.docx](/E:/Own_program/multi cooperation/00_start_materials/原始材料/B端投资判断表_参与者可见版.docx)
- `原始材料/正式/*`
- `原始材料/测试轮/P01/*`

### `01_rules/`

协作规则区。

### `02_specs/`

规格区。

推荐重点：

- [00_overview/APP_FLOW.md](/E:/Own_program/multi cooperation/02_specs/00_overview/APP_FLOW.md)
- [00_overview/PRD.md](/E:/Own_program/multi cooperation/02_specs/00_overview/PRD.md)
- [01_frontend/WORKBENCH_REFINEMENT_MASTER.md](/E:/Own_program/multi cooperation/02_specs/01_frontend/WORKBENCH_REFINEMENT_MASTER.md)
- [02_backend/admin材料库上传手册.md](/E:/Own_program/multi cooperation/02_specs/02_backend/admin材料库上传手册.md)
- [02_backend/SIDETASK_REBUILD_SPEC.md](/E:/Own_program/multi cooperation/02_specs/02_backend/SIDETASK_REBUILD_SPEC.md)
- [02_backend/VARIABLE_PERSISTENCE_SPEC.md](/E:/Own_program/multi cooperation/02_specs/02_backend/VARIABLE_PERSISTENCE_SPEC.md)
- [04_pre_deploy/STORAGE_AND_IMPORT_SPEC.md](/E:/Own_program/multi cooperation/02_specs/04_pre_deploy/STORAGE_AND_IMPORT_SPEC.md)

### `03_tracking/`

过程跟踪区。

核心文件：

- [progress.md](/E:/Own_program/multi cooperation/03_tracking/progress.md)
- [lessons.md](/E:/Own_program/multi cooperation/03_tracking/lessons.md)

### `04_archive/`

旧方案归档区。

### `apps/`

真正运行中的前后端代码。

### `infra/`

本地基础设施与数据库环境。

### `packages/`

预留共享包区，目前基本未承载核心逻辑。

### `scripts/`

项目脚本区。

### `storage/`

运行态本地存储区。

当前主要存：

- admin 上传后的材料文件
- AI 图片附件
- 服务器导出归档包

---

## 3. 当前系统有哪些大模块

现在可以把整个项目理解成 8 个大模块。

### 模块 A：参与者实验主流程

负责页面：

- `/login`
- `/waiting-room`
- `/instruction`
- `/ready`
- `/practice-quiz`
- `/practice`
- `/break`
- `/workspace/a`
- `/workspace/b`
- `/workspace/b-waiting`
- `/workspace/b-feedback`
- `/workspace/end`

前端主要文件：

- [apps/web/src/app/login/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/login/page.tsx)
- [apps/web/src/app/waiting-room/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/waiting-room/page.tsx)
- [apps/web/src/app/instruction/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/instruction/page.tsx)
- [apps/web/src/app/ready/ready-client-page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/ready/ready-client-page.tsx)
- [apps/web/src/app/practice-quiz/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/practice-quiz/page.tsx)
- [apps/web/src/app/practice/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/practice/page.tsx)
- [apps/web/src/app/break/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/break/page.tsx)
- [apps/web/src/app/workspace/a/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/workspace/a/page.tsx)
- [apps/web/src/app/workspace/b/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/workspace/b/page.tsx)
- [apps/web/src/app/workspace/b-waiting/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/workspace/b-waiting/page.tsx)
- [apps/web/src/app/workspace/b-feedback/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/workspace/b-feedback/page.tsx)

后端主要文件：

- [apps/server/src/experiment/experiment.controller.ts](/E:/Own_program/multi cooperation/apps/server/src/experiment/experiment.controller.ts)
- [apps/server/src/experiment/experiment.service.ts](/E:/Own_program/multi cooperation/apps/server/src/experiment/experiment.service.ts)

---

### 模块 B：统一运行态与阶段引擎

负责：

- 登录后 runtime 获取
- 段切换
- 倒计时
- 工作段/休息段推进
- A 信息解锁给投资经理
- break 问卷状态
- SSE 事件流

核心文件：

- [apps/web/src/lib/session-runtime.ts](/E:/Own_program/multi cooperation/apps/web/src/lib/session-runtime.ts)
- [apps/server/src/experiment/experiment.service.ts](/E:/Own_program/multi cooperation/apps/server/src/experiment/experiment.service.ts)

这是整个系统的“主时钟”。

---

### 模块 C：主工作台三区

负责工作台视觉与交互：

- 材料区
- 答题区
- AI 区

关键文件：

- [apps/web/src/components/company-material-panel.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/company-material-panel.tsx)
- [apps/web/src/components/a-task-editor.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/a-task-editor.tsx)
- [apps/web/src/components/b-task-editor.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/b-task-editor.tsx)
- [apps/web/src/components/b-feedback-form.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/b-feedback-form.tsx)
- [apps/web/src/components/ai-chat-panel.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/ai-chat-panel.tsx)
- [apps/web/src/components/session-topbar.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/session-topbar.tsx)

当前状态：

- 材料区已经支持 `txt / docx / pdf / xlsx`
- 默认自适应填充材料区
- 支持 `Ctrl + / Ctrl - / Ctrl 0`
- 登录后默认尝试全屏

---

### 模块 D：统一草稿 / 快照 / 恢复系统

负责：

- 主表自动保存
- 跨工作段冻结
- 休息后恢复
- 导出时保留快照链路

后端核心：

- [apps/server/prisma/schema.prisma](/E:/Own_program/multi cooperation/apps/server/prisma/schema.prisma)
- [apps/server/src/experiment/experiment.service.ts](/E:/Own_program/multi cooperation/apps/server/src/experiment/experiment.service.ts)

前端配合：

- [apps/web/src/lib/session-runtime.ts](/E:/Own_program/multi cooperation/apps/web/src/lib/session-runtime.ts)

其中最关键的数据对象有：

- `TaskAssignment.aDraft`
- `TaskAssignment.bDraft`
- `TaskAssignment.bFeedbackDraft`
- `TaskSnapshot`

---

### 模块 E：admin 管理后台

负责：

- 准入手机号名单
- Session 概览
- 导出实验数据
- 清空实验运行数据
- 实验配置
- 题库/材料管理
- 副线调度面板

前端入口：

- [apps/web/src/app/admin/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/admin/page.tsx)

后端入口：

- [apps/server/src/admin/admin.controller.ts](/E:/Own_program/multi cooperation/apps/server/src/admin/admin.controller.ts)
- [apps/server/src/admin/admin.service.ts](/E:/Own_program/multi cooperation/apps/server/src/admin/admin.service.ts)

---

### 模块 F：题库与材料系统

这是当前最重要的新模块之一。

它负责：

- 每家公司/案例的材料组织
- 参与者材料与研究者材料隔离
- 自动填充源识别
- admin 手工上传/替换/删除/排序
- 本地目录自动识别导入

核心文件：

- [apps/server/src/admin/materials.ts](/E:/Own_program/multi cooperation/apps/server/src/admin/materials.ts)
- [apps/server/src/admin/admin.service.ts](/E:/Own_program/multi cooperation/apps/server/src/admin/admin.service.ts)
- [apps/web/src/app/admin/page.tsx](/E:/Own_program/multi cooperation/apps/web/src/app/admin/page.tsx)
- [apps/web/src/components/company-material-panel.tsx](/E:/Own_program/multi cooperation/apps/web/src/components/company-material-panel.tsx)

当前实现要点：

1. 题库默认扫描 `00_start_materials/原始材料/`
2. 每个子文件夹视为一个案例目录
3. 若存在 `participant/` 与 `research/` 子目录，会优先按子目录分流
4. 若没有分层子目录，则按文件名自动判断研究者材料
5. `研究者用 / 信息点记录 / 答案` 这类材料不会出现在参与者材料区

材料目录当前已支持按角色分层：

- `participant/shared`
- `participant/diligence`
- `participant/manager`
- `research`

前台显示口径仍然是“尽调员 / 投资经理”，不会向参与者暴露 A/B 字母角色。

---

### 模块 G：AI 上下文系统

负责：

- 主线 AI
- 副线 AI
- 分公司隔离
- 分阶段隔离
- 消息日志记录

核心文件：

- [apps/server/src/ai/ai.service.ts](/E:/Own_program/multi cooperation/apps/server/src/ai/ai.service.ts)
- [apps/server/prisma/schema.prisma](/E:/Own_program/multi cooperation/apps/server/prisma/schema.prisma)

当前隔离维度：

- `sessionId`
- `participantId`
- `companyId`
- `contextType`
- `phase`
- `segmentIndex`

当前已实现能力补充：

- 主线与副线复用同一套 `AiChatPanel`
- AI 回复支持 Markdown 渲染
- 支持流式输出
- 支持“追问提示条 + 隐藏上下文注入”
- `advanced` 支持图片上传与粘贴

---

### 模块 H：变量记录与服务器导出

这是当前上线前最关键的数据模块之一。

它负责：

- 统一实验事件记录
- A/B 被试分目录导出
- 主线公司答题全文导出
- 副线计划、提醒、打开、作答导出
- 主线 / 副线 AI 聊天导出
- 图片附件归档
- 变量实现动态自检
- admin 创建导出任务并下载 zip

核心文件：

- [apps/server/src/recording/export.service.ts](/E:/Own_program/multi cooperation/apps/server/src/recording/export.service.ts)
- [apps/server/src/recording/storage.service.ts](/E:/Own_program/multi cooperation/apps/server/src/recording/storage.service.ts)
- [apps/server/src/recording/experiment-audit.service.ts](/E:/Own_program/multi cooperation/apps/server/src/recording/experiment-audit.service.ts)
- [apps/server/prisma/schema.prisma](/E:/Own_program/multi cooperation/apps/server/prisma/schema.prisma)
- [02_specs/04_pre_deploy/变量记录与服务器导出方案.md](/E:/Own_program/multi cooperation/02_specs/04_pre_deploy/变量记录与服务器导出方案.md)
- [02_specs/04_pre_deploy/数据库文件夹手册.md](/E:/Own_program/multi cooperation/02_specs/04_pre_deploy/数据库文件夹手册.md)

当前导出包按这个主干组织：

```text
sessions/SESSION_CODE/participants/PARTICIPANT_ID/
```

session 只保存共享事实；participant 保存个人问卷、答题、AI、副线、事件和图片附件。

---

## 4. 题库系统现在怎么用

如果你只是想快速导入案例材料，优先看：

- [02_specs/02_backend/admin材料库上传手册.md](/E:/Own_program/multi cooperation/02_specs/02_backend/admin材料库上传手册.md)
- [02_specs/04_pre_deploy/STORAGE_AND_IMPORT_SPEC.md](/E:/Own_program/multi cooperation/02_specs/04_pre_deploy/STORAGE_AND_IMPORT_SPEC.md)

一句话版本：

1. 把案例目录放到 `00_start_materials/原始材料/`
2. 用推荐结构组织 `participant/` 和 `research/`
3. 打开 `/admin`
4. 进入“材料管理”
5. 点击“自动导入题库目录”

---

## 5. 数据库里最关键的模型

在 [apps/server/prisma/schema.prisma](/E:/Own_program/multi cooperation/apps/server/prisma/schema.prisma) 中，最重要的是：

- `Participant`
- `Session`
- `Pairing`
- `RandomizationAudit`
- `ExperimentEvent`
- `TaskAssignment`
- `TaskSnapshot`
- `Company`
- `AiMessageLog`
- `QuestionnaireResponse`
- `SideTaskItem`
- `SideTaskPlan`
- `SideTaskExposureLog`
- `SideTaskSessionConfig`
- `ExportJob`

可以这样粗暴理解：

- `Participant`：谁能进实验
- `Session`：一轮实验
- `Pairing`：一组尽调员/投资经理配对
- `RandomizationAudit`：角色、公司顺序、实验模式、B 动态分配的随机化留痕
- `ExperimentEvent`：关键行为事件
- `Company`：题库中的一个案例
- `TaskAssignment`：某轮实验里这组人被分到哪个案例
- `TaskSnapshot`：冻结与恢复记录
- `AiMessageLog`：AI 对话日志
- `SideTaskItem`：副线题库题目
- `SideTaskPlan`：session 级副线抽题与释放计划
- `SideTaskExposureLog`：副线释放、提醒、打开、作答事件
- `SideTaskSessionConfig`：session 级副线模式、叙事组、主题顺序
- `ExportJob`：服务器导出任务

---

## 6. 当前已经完成到什么程度

截至目前，已经稳定落地的内容包括：

- 主流程页面
- runtime + SSE
- A/B 工作台主链路
- 快照冻结与恢复
- 材料区混合阅读器
- admin 材料管理
- 题库目录自动识别导入
- 参与者端隐藏研究者材料
- 两张主表向 Word 真相源精修
- 实验 1/2/3 模式互斥切换
- 变量记录与服务器导出第一期
- 导出包动态自检与数据库文件夹手册

仍然值得继续抠细节的地方：

- 表单与 Word 的最后一轮像素级/行距级精修
- 更多案例批量接入
- admin 更细的错误提示与批量校验
- 上线部署、持久化卷和对象存储对接

---

## 7. 常用命令

在根目录执行：

```powershell
corepack pnpm install
corepack pnpm run dev:local
corepack pnpm run dev:stop
corepack pnpm run dev:restart
corepack pnpm --filter web build
corepack pnpm --filter server build
```

也可以直接用：

- [启动本地开发环境.bat](/E:/Own_program/multi cooperation/启动本地开发环境.bat)
- [停止本地开发环境.bat](/E:/Own_program/multi cooperation/停止本地开发环境.bat)
- [重启本地开发环境.bat](/E:/Own_program/multi cooperation/重启本地开发环境.bat)

---

## 8. 一句话总结

这个仓库现在可以理解成：

**一个围绕“尽调员—投资经理”协作实验而构建的、带题库系统、材料系统、AI 工作台、快照恢复和 admin 后台的长期维护平台。**
