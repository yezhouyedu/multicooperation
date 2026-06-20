# BACKEND_STRUCTURE.md

> 状态：2026-06-17 已对齐当前实现
> 位置：`02_specs/02_backend/BACKEND_STRUCTURE.md`

## 1. 后端现在负责什么

当前后端不是一个普通 API 壳子，而是 6 个东西一起承担：

- 登录与手机号准入
- 两人配对、角色随机化、公司顺序随机化
- 实验主状态机与统一 runtime
- 主线草稿、快照、恢复、问卷、行为记录
- 副线题库、计划生成、提醒频率条件、曝光与作答记录
- AI 接口、admin 配置、材料系统、数据导出

---

## 2. 当前模块划分

### 2.1 `src/auth/`

负责：

- 手机号登录
- 白名单校验
- 按进入顺序成组
- 配对完成后随机分配 `A/B`
- 为 session 生成公司随机序列
- 为 session 生成副线任务计划

关键点：

- 先成组，再随机角色
- 角色随机化使用 seed，可复现
- 公司顺序随机化使用 seed，可复现
- 副线实验条件也在 session 创建时一起确定

### 2.2 `src/experiment/`

负责：

- 统一 runtime 读取
- 正式段 / 休息段 / 结束段推进
- 段前指导语打开、15 秒校验、双方继续屏障
- A 的 5 分钟自动提交
- B 查看尽调员信息与 A 原始材料的解锁与记录
- 草稿保存、快照冻结、恢复
- SSE 事件流
- 副线运行时、曝光记录、作答、归档

这是整个系统的主状态机。

### 2.3 `src/ai/`

负责：

- 主线 / 副线 AI 聊天
- `basic` / `advanced` 两档能力切换
- 图片附件处理
- 追问上下文注入
- 普通回复与流式回复
- AI 消息日志

### 2.4 `src/admin/`

负责：

- 手机号名单导入
- 实验配置保存
- session 概览
- 数据导出
- AI 设置
- 公司与材料库
- 副线题库导入与副线 admin 面板

### 2.5 `src/prisma/`

负责：

- Prisma 连接
- 数据库访问基础设施

---

## 3. 当前已确定的核心运行规则

### 3.1 成组与角色

- 两位参与者先按进入顺序组成一组
- 配对完成时才随机决定谁是尽调员、谁是投资经理
- 角色随机化写入 `RandomizationAudit`
- `Participant.role` 现在是运行结果，不再是预设输入

### 3.2 公司顺序

- 每个 session 生成一条独立公司序列
- 同组两人共享同一条序列
- 使用 seed 随机化并保存审计信息
- 目标是可复现、可回溯，不靠 `sort(() => Math.random() - 0.5)`

### 3.3 正式段状态机

- 指导语后先过一次同步准备页，再进入测试题
- 只有双方都通过测试题，系统才自动启动测试轮
- 测试轮后再过一次同步准备页
- formal ready 后进入段 1 前阅读材料页，双方完成 15 秒阅读后启动正式工作段 1
- 工作段 1/2 后：段后问卷 → 休息 → 下一段前阅读材料 → 下一工作段
- 工作段 3 后：段后问卷 → 最终长问卷 → 完成
- 正式流程固定为 3 个工作段、3 次段后问卷、2 个休息段、3 次段前指导语和 1 次最终长问卷
- 工作段与休息段切换由服务端统一判定

### 3.4 A / B 规则

- A 对单家公司有固定 5 分钟窗口
- 5 分钟内不能提前提交
- 到点后系统自动提交
- 自动提交时解锁给 B
- B 可在解锁前先看自己的材料、写草稿、用 AI
- B 解锁后可直接提交
- 是否点击过“查看 A 信息”不再作为提交门槛，但仍要记录行为
- A 提交后，B 可分别解锁 A 任务表和 A 原始材料；二者是独立变量。
- 点击任意 A 原始材料解锁入口会一次性解锁全部 A 原始材料，并记录 `bViewedAMaterialsAt`。

### 3.5 副线规则

- 测试轮不生成真实 practice 任务2计划；`segmentIndex = 0` 的真实任务2数量固定为 0
- 教学引导需要点击任务2题目时，由前端临时显示 `practice_demo_sidetask` 演示题，不写入 `SideTaskPlan`
- 正式 3 个工作段各生成 40 条副线计划，总计 120 条
- 提醒频率条件分为 `continuous` / `batch`
- 两种条件下题目实际到达节奏相同，默认都是每 30 秒一条
- `continuous / batch` 的差异体现在前端提醒频率，不体现在题目实际释放速率
- 叙事条件分为 `coop_narrative` / `neutral_info`
- 服务端认定 `releasedAt`
- 前端首次见到 planId 时补发 `side_task_released`
- 服务端幂等写入曝光日志

---

## 4. 当前后端真相源数据对象

### 4.1 主流程相关

- `Participant`
- `Session`
- `Pairing`
- `ExperimentConfig`
- `QuestionnaireTemplate`
- `QuestionnaireResponse`

### 4.2 主任务草稿与恢复

- `TaskAssignment`
  - 保存 A/B 当前草稿、反馈草稿、当前任务状态
- `TaskSnapshot`
  - 保存工作段冻结快照与恢复来源

### 4.2.1 段前指导语

不新增专用表：

- `Session.experimentSnapshot.instructionPlan`
  - 保存团队级三段指导语计划。
- `TaskProgress`
  - `pre_segment_instruction_opened`
  - `pre_segment_instruction_completed`
- `ExperimentEvent`
  - `pre_segment_instruction_started`
  - `pre_segment_instruction_opened`
  - `pre_segment_instruction_completed`

### 4.3 AI 相关

- `AiMessageLog`
  - 保存 AI 聊天、请求耗时、provider 状态和 requestId。
  - `AiService` 同步写入 `ai_wait_started` / `ai_wait_ended` 到 `ExperimentEvent`，用于 D/E 时间戳变量。
- `AiSettings`

### 4.3.1 时间戳变量

不新增专用表或 migration：

- `ExperimentEvent`
  - `side_area_entered`
  - `main_area_returned`
  - `mainline_activity`
  - `main_context_activity`
  - `side_activity`
  - `ai_wait_started`
  - `ai_wait_ended`
- `AiMessageLog`
  - 作为 AI 等待窗的 requestId、createdAt、completedAt、latencyMs 校验源。
- `SideTaskExposureLog`
  - 作为副线释放、提醒、打开、作答的校验源。
- `SessionSegmentState` / `TaskAssignment`
  - 作为正式工作段区间和公司上下文来源。

导出时生成 participant 根目录的 `timestamps.json`，并把摘要写入 `variables.json.timing`。

### 4.4 材料系统相关

- `Company`
- `CompanyMaterial`

当前材料口径已支持：

- `participant/shared`
- `participant/diligence`
- `participant/manager`
- `research`

数据库里对应 `participantRole=shared/A/B`；参与者前台统一显示 `A/B`，不再显示旧“尽调员 / 投资经理”。

### 4.5 随机化审计

- `RandomizationAudit`

当前已落地字段包括：

- `roleAssignmentMethod`
- `roleAssignmentSeed`
- `roleAssignedAt`
- `companySequenceMethod`
- `companySequenceSeed`
- `companySequenceGeneratedAt`
- `companySequence`

### 4.6 副线系统

- `SideTaskItem`
- `SideTaskPlan`
- `SideTaskExposureLog`
- `SideTaskSessionConfig`

说明：

- 旧的 `SideTaskResponseLog` 已不是当前正式写入口径
- 现在以 `SideTaskExposureLog` 记录 released / answered 等关键事件

---

## 5. 当前统一 runtime 口径

主入口：

- `GET /experiment/session/:code/runtime`

当前 runtime 至少要承担：

- 当前角色
- 当前阶段
- 当前工作段索引
- 当前阶段剩余时间
- 当前公司与公司顺序位置
- 尽调员单公司剩余时间
- 尽调信息是否已解锁
- 投资经理是否看过尽调员信息
- 当前草稿读取入口所需信息
- 当前副线队列
- 当前副线配置
- 当前 AI 档位

配套还有：

- `GET /experiment/session/:code/events`
  - 用于 SSE 增量更新

---

## 6. 当前关键接口分组

### 6.1 登录与进入

- `POST /auth/login`

### 6.2 运行时

- `GET /experiment/session/:code/runtime`
- `GET /experiment/session/:code/events`
- `GET /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/ready-practice`
- `POST /experiment/session/:code/ready-formal`
- `POST /experiment/session/:code/pre-segment-instruction/open`
- `POST /experiment/session/:code/pre-segment-instruction/complete`
- `POST /experiment/session/:code/complete-practice`
- `POST /experiment/session/:code/progress`
- `POST /experiment/session/:code/timestamps/event`
  - 仅写 `ExperimentEvent`，用于主副线切换、主线恢复和时间戳变量原始事件。
  - `payload.clientEventId` 用于前端重试去重。

### 6.3 主任务

- `GET /experiment/session/:code`
- `GET /experiment/session/:code/tasks`
- `GET /experiment/session/:code/tasks/:taskId/draft`
- `POST /experiment/session/:code/tasks/:taskId/draft`
- `GET /experiment/session/:code/tasks/:taskId/snapshots`
- `POST /experiment/session/:code/tasks/:taskId/restore-latest`
- `POST /experiment/session/:code/tasks/:taskId/a-submit`
- `POST /experiment/session/:code/tasks/:taskId/view-a-info`
- `POST /experiment/session/:code/tasks/:taskId/view-a-materials`
- `POST /experiment/session/:code/tasks/:taskId/b-complete`

### 6.4 副线

- `POST /experiment/session/:code/sidetask/:planId/exposure`
- `POST /experiment/session/:code/sidetask/:planId/answer`

### 6.5 AI

- `POST /ai/chat`
- `POST /ai/chat-stream`

### 6.6 Admin

- `GET /admin/sessions`
- `GET /admin/export`
- `POST /admin/export-jobs`
- `POST /admin/sessions/delete-batch`
- `POST /admin/participants`
- `DELETE /admin/participants/:id`
- `POST /admin/participants/delete-batch`
- `GET /admin/experiment-config`
- `POST /admin/experiment-config`
- `GET /admin/questionnaire-template`
- `POST /admin/questionnaire-template`
- `GET /admin/ai-settings`
- `POST /admin/ai-settings`
- `POST /admin/sidetask/import`
- `GET /admin/sidetask/items`
- `GET /admin/sidetask/items/stats`
- `PATCH /admin/sidetask/items/:id/toggle-active`

---

## 7. 当前统计与记录口径

### 7.1 副线统计

- `totalPlanned`：该段计划总数，当前固定 40
- `totalReleased`：`releasedAt !== null`
- `totalAnswered`：当前 participant 的 answered 题数
- `totalArchived`：段末归档且未作答的题数
- 前端可见队列：`scheduledAt <= now && !isArchivedAtSegmentEnd`

### 7.2 关键行为记录

当前已经明确需要保留的包括：

- 指导语已读
- 测试轮准备完成
- 正式轮准备完成
- 尽调员自动提交
- 投资经理查看尽调员信息
- 投资经理完成提交
- 休息问卷提交
- 副线 released / answered

---

## 8. 当前明确不再沿用的旧口径

- 不再使用“先来者固定 A、后来者固定 B”
- 不再把 B 独立等待页当成正式状态机节点
- 不再把“查看过尽调员信息”当作 B 提交门槛
- 不再把副线视为简单原型条
- 不再把材料系统口径限制在 “P01 + 两份正式表单”

---

## 9. 联动文档

- 总流程真相源：`02_specs/00_overview/APP_FLOW.md`
- 副线正式规格：`02_specs/02_backend/SIDETASK_REBUILD_SPEC.md`
- 变量保存层：`02_specs/02_backend/VARIABLE_PERSISTENCE_SPEC.md`
- 材料导入口径：`02_specs/02_backend/admin材料库上传手册.md`
- 上线前存储方案：`02_specs/04_pre_deploy/STORAGE_AND_IMPORT_SPEC.md`
