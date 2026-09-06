# experiment_necessary.md

## 2026-09-06 九条件、随机暴露与线上质量必要口径

- 实验条件以 AB 团队/Session 为单位，最终 A0-A8 定义以 `02_specs/03_execution/实验条件与区组随机方案.md` 为准。
- 每个区组必须恰好包含 A0-A8 各一次；区组排列由 seed 确定并可复现，条件、角色、公司顺序各用独立 seed。
- A0/A7/A8 是无 AI；任何运行时和问卷逻辑必须读 `aiEnabled/aiCondition` 快照，不得只把 A0 写死为无 AI。
- 正式工作段的实验质量链路必须包含浏览器监听、服务器状态机、数据库区间、关键 flags、导出 JSON 和数据库手册；不允许只加前端提醒。
- 每次切屏均保存，持续时间严格超过 Session 快照阈值才置违规；默认阈值 2 秒。
- 无效行为采用 120 秒无操作 + 20 秒确认；确认超时立即令 `hasInvalidInactivity=true`。
- A 正式退出后 B 停止；B 正式退出后 A 继续。两个分支都必须忠实保留历史数据。

## 2026-07-17 七条件区组随机化必要口径（历史）

- 这是 2026-08-23 前测试数据的旧口径，不得用于新实验局。
- 条件槽位必须在两人匹配成功的数据库事务中原子领取，不能依赖匹配时间戳防止重复。
- 必须保存 `experimentRunId`、条件号、区组号、区组内位置、全局位置、分配方法、seed 和时间。
- 已分配槽位不得因被试退出或 session 取消而回收。
- A0从测试轮起不得暴露任何任务1或任务2 AI，后端必须同时拒绝 AI 请求。
- 实验条件随机、角色随机、公司顺序随机必须使用独立 seed 并分别审计。

> 这里不是产品说明。  
> 这里专门记录“论文和实验方法必须能回溯”的关键信息。  
> 只要某条规则会影响随机化、处理条件、关键行为变量或结果解释，就要写进这里。

---

## 1. 当前已经敲定的实验必要信息

### 1.1 成组方式

- 两位参与者先按进入顺序组成一组
- 这一步只决定“谁和谁是一组”
- 这一步不预先固定角色

### 1.2 角色分配

- 角色分配发生在第二位参与者加入、配对完成的那一刻
- 系统生成 `roleAssignmentSeed`
- 系统基于 seed 做一次二分随机，决定谁是 A、谁是 B
- 角色一旦分配完成，该组在整个 session 内不再改变

### 1.3 公司顺序

- 每组 session 生成一条独立的固定公司顺序
- A/B 共享同一条正式公司顺序；A 按顺序推进，B 在同一公司池上动态分配
- 当前算法口径：`seeded_fisher_yates_v1`
- 该顺序在 session 内不再变化

### 1.4 时间同步

- 指导语后要先经过一次同步准备页，双方都 ready 后才进入测试题
- 测试题通过后，系统才启动测试轮；测试轮起点对两人一致
- 测试轮后要再经过一次同步准备页才能进入正式任务页
- 这样正式任务第一页的起点对两人一致

### 1.5 A 提交规则

- A 在 5 分钟内不能提前提交
- 5 分钟到点后系统自动提交
- 自动提交时间就是 A 信息进入待开放状态的时间；B 仍需同时满足自己的 `bCanSubmitAt <= now`

### 1.6 B 查看行为

- B 在 A 信息开放前，可以先看自己的材料、写草稿，并仅在 A1-A6 条件下使用 AI；A0/A7/A8 无 AI
- 只有 `A 已提交 && bCanSubmitAt <= now` 后，B 才能查看 A 信息、解锁 A 原始材料和提交
- “是否查看过 A 信息”不作为提交门槛
- 但“是否查看过”“何时查看”仍然是需要保存的实验行为变量

---

## 2. 当前必须保存到数据库的随机化信息

### 2.0 实验条件区组分配

- `experimentRunId`
- `experimentCondition`（当前 A0-A8；旧测试数据可为 A0-A6）
- `instructionOrderSeed`、`themeOrderSeed`、三个工作段实际指导语文本 ID 与展示顺序
- 合作叙事条件下，每段任务2当前主题的 5 个 `content_subtype` 各 4 题及实际曝光记录
- V3.0 问卷的 `displayedItemCodes`、条件跳题上下文和线上实施自报
- 无效行为、切屏、掉线、正式退出、排除时长和有效任务1/任务2时间
- `conditionAssignedAt`
- `blockIndex`
- `positionInBlock`
- `globalPosition`
- `blockSeed`
- 分配方法与实验局主 seed

条件槽位由 `ExperimentRun` / `ExperimentConditionSlot` 保存，并在配对事务中原子领取。已领取槽位不得回收。

### 2.1 角色随机化

- `roleAssignmentMethod`
- `roleAssignmentSeed`
- `roleAssignedAt`
- 最终角色分配结果

### 2.2 公司顺序随机化

- `companySequenceMethod`
- `companySequenceSeed`
- `companySequenceGeneratedAt`
- 最终公司顺序快照

---

## 3. 当前必须保存到数据库的关键行为变量

- `instruction_viewed`
- `practice_ready`
- `practice_quiz_submitted`
- `practice_quiz_passed`
- `practice_quiz_failed`
- `practice_tutorial_started`
- `practice_tutorial_step_completed`
- `practice_tutorial_completed`
- `formal_ready`
- `a_task_auto_submitted`
- `b_viewed_a_info`
- `b_task_completed`
- `break_questionnaire_submitted`

其中当前最不能丢的是：

- `bViewedAInfoAt`
- A 自动提交时间
- B 完成提交时间

---

## 4. 当前数据库落点

### 4.1 已落地

- `RandomizationAudit`
  - 保存角色随机化和公司顺序随机化的 seed、方法、时间和结果

### 4.2 已落地的行为与配置层

- `ExperimentEvent`
  - 保存关键行为、段前指导语、任务1/任务2切换、AI 等待与恢复等审计事件
- `Session.experimentSnapshot`
  - 保存本场实际采用的实验条件、AI 状态、任务2提醒、叙事、指导语计划和 seed
- `ExperimentRun` / `ExperimentConditionSlot`
  - 保存正式实验局、A0-A8 九条件平衡区组序列和不可重复领取的条件槽位
- `IdempotencyRecord`
  - 保护 ready、问卷、提交、查看、任务2作答等关键 POST 不被重复推进

---

## 5. 联动文档

- 流程真相源：`02_specs/00_overview/APP_FLOW.md`
- 条件分配真相源：`02_specs/03_execution/实验条件与区组随机方案.md`
- 保存层规格：`02_specs/02_backend/VARIABLE_PERSISTENCE_SPEC.md`
- 变量表整理版：`00_start_materials/第五次开会/D变量表_整理版.md`

后续只要这几条规则再变，必须同步改这里。
