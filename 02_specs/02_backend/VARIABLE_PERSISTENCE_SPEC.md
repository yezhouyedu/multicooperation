# VARIABLE_PERSISTENCE_SPEC.md

> 更新时间：2026-08-10
> 本文档定义当前已经落地的实验必要变量保存层。流程以 `APP_FLOW.md` 为准，A0-A8 条件分配以 `实验条件与区组随机方案.md` 为准，线上质量以 `线上实验质量与行为监测方案.md` 为准，导出结构以 `数据库文件夹手册.md` 为准。

---

## 1. 保存层目标

保存层必须同时满足：

- 支撑实验运行时恢复，不因刷新、断线或阶段切换丢失任务状态。
- 保存实验条件、角色和公司顺序三层独立随机化的 seed、方法、时间与结果。
- 保存被试关键行为、答题全文、AI、任务2、问卷、段前指导语和时间戳原始事实。
- 生成可独立阅读、可审计、可后处理的 session → participant 树状导出包。

业务运行表不是论文分析的唯一真相源；分析时应结合随机化审计、实验事件、内容表与导出文件。

## 2. 当前四层结构

### 2.1 业务运行层

核心模型：

- `Session`、`Pairing`
- `TaskAssignment`、`TaskSnapshot`
- `SessionSegmentState`
- `QuestionnaireTemplate`、`QuestionnaireResponse`
- `SideTaskItem`、`SideTaskPlan`、`SideTaskExposureLog`、`SideTaskSessionConfig`
- `AiMessageLog`

这一层支撑页面、阶段推进、草稿、公司流转、任务2队列、问卷和 AI 请求。

### 2.2 行为与幂等层

- `ExperimentEvent`：关键行为、段前指导语、任务1/任务2切换、AI 等待/结束、恢复活动等审计事件。
- `TaskProgress`：保留历史 progress 与部分兼容阶段记录；新分析优先使用 `ExperimentEvent`。
- `IdempotencyRecord`：保护 ready、段前指导语、问卷、A/B 提交、查看 A 信息/材料和任务2作答等关键 POST。

### 2.3 随机化审计层

- `ExperimentRun`：一次正式实验局，保存主 seed、设计版本、状态和已生成区组数。
- `ExperimentConditionSlot`：保存 A0-A8 九条件平衡区组槽位、区组位置、全局位置、block seed 与领取结果。
- `RandomizationAudit`：保存角色随机、正式公司顺序、B 动态公司分配和相关审计日志。
- `Session.experimentRunId / experimentCondition / conditionAssignedAt`：保存 session 实际领取结果。

实验条件、角色和公司顺序不得共用 seed。条件槽位在两人匹配成功的数据库事务中原子领取，已领取槽位不得回收。

### 2.4 Session 配置快照层

当前不另建 `SessionConfigSnapshot` 表，使用 `Session.experimentSnapshot` 固化：

- `experimentMode`、`experimentRunId`、`experimentCondition`
- `aiEnabled`、`aiCondition`、`practiceAiState`、三段 `segmentAiStates`
- `sideDispatchMode`、`narrativeGroup`、`themeOrder`
- `instructionPlan`
- 固定变量与各类 seed

Admin 后续切换模式、实验局或配置，不得改变已创建 session 的快照。

## 3. A0-A8 必要保存口径

| 条件 | AI | 任务2提醒 | 叙事 |
| --- | --- | --- | --- |
| A0 | NONE | continuous | neutral_info |
| A1 | BASIC | continuous | neutral_info |
| A2 | ADVANCED | continuous | neutral_info |
| A3 | BASIC | batch | neutral_info |
| A4 | BASIC | continuous | coop_narrative |
| A5 | ADVANCED | continuous | coop_narrative |
| A6 | ADVANCED | batch | neutral_info |

A0 必须满足：

- `aiEnabled=false`、`aiCondition=NONE`。
- 测试轮与正式段都不向参与者展示任务1或任务2 AI。
- 后端拒绝 AI 请求。
- 导出中 AI 请求数和图片附件数均应为 0。

A0-A8 的实际 AI、提醒、叙事与指导语暴露必须和 session 快照一致；A0/A7/A8 均要求前后端无 AI。旧 `upgradeCohort` 只用于历史兼容，新正式 session 写 `null`。

## 4. 当前必须保存的关键事实

### 4.1 流程与问卷

- 登录、角色分配、开篇指导语、任务表预览、两次 ready 屏障。
- 测试题所有 attempt、通过结果与测试轮教学事件。
- 三次段前指导语的打开、完成、文本 ID 和阅读时长。
- 三个工作段回顾、V3.0 最终长问卷的实际显示题号、跳题上下文和原始答案。
- 独立支付手机号确认状态；完整手机号不得写入问卷答案或分析导出。

### 4.2 任务1与公司流转

- A 的正式公司顺序、5 分钟窗口、自动提交与内容快照。
- B 的 locked pool / PreA fallback 分配路径、候选池、seed 和 `bCanSubmitAt`。
- B 查看 A 信息、解锁 A 原始材料与最终提交的独立时间戳。
- A/B 答题全文、B feedback、段末冻结与恢复快照。

### 4.3 任务2

- session 共享计划、题目、队列顺序、`scheduledAt`、`releasedAt` 和段末归档。
- A/B 各自的提醒、打开、作答、正确率、反应时与任务2 AI。
- continuous / batch 只改变提醒频率，不改变后台题目实际到达节奏。
- 测试轮真实任务2为 0；`practice_demo_sidetask` 只作为教学行为，不进入正式任务2变量。

### 4.4 AI 与附件

- user/assistant 消息、`requestId`、上下文类型、公司/任务2归属、工作段、实际模型、AI 档位、耗时和错误。
- 图片保存为文件；JSON 只保存 `imageRef + relativePath`，不得保存 base64。
- `ai_wait_started / ai_wait_ended` 与主线/任务2活动用于生成 `timestamps.json`。

## 5. 导出与真相源

导出由 `ExportJob`、`ExportService` 和 `StorageService` 生成，生产文件写入 `STORAGE_ROOT=/app/storage` 对应的 `multi-cooperation_server_storage` volume。

主要真相源：

- 流程：`02_specs/00_overview/APP_FLOW.md`
- 条件：`02_specs/03_execution/实验条件与区组随机方案.md`
- 问卷：`02_specs/03_execution/问卷流程方案.md`
- 树状导出：`02_specs/04_pre_deploy/数据库文件夹手册.md`
- 时间戳：`02_specs/04_pre_deploy/时间戳变量保存方案.md`

## 6. 当前边界

当前已保存足够原始事实，可后处理任务2正确率/反应时、B 查看/提交延迟、主副任务时间占比与恢复时滞。

仍属于后续分析或评分模块：

- 内容质量评分与人工评分员流程。
- gold fact / gold issue 金标准。
- AI 采纳率自动编码。
- 更细的滚动、focus/blur、复制粘贴和逐操作停留时间。
