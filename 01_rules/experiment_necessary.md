# experiment_necessary.md

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
- 系统基于 seed 做一次二分随机，决定谁是尽调员、谁是投资经理
- 角色一旦分配完成，该组在整个 session 内不再改变

### 1.3 公司顺序

- 每组 session 生成一条独立的固定公司顺序
- 尽调员与投资经理共享同一条顺序
- 当前算法口径：`seeded_fisher_yates_v1`
- 该顺序在 session 内不再变化

### 1.4 时间同步

- 指导语后要先经过一次同步准备页，双方都 ready 后才进入测试题
- 测试题通过后，系统才启动测试轮；测试轮起点对两人一致
- 测试轮后要再经过一次同步准备页才能进入正式任务页
- 这样正式任务第一页的起点对两人一致

### 1.5 尽调员提交规则

- 尽调员在 5 分钟内不能提前提交
- 5 分钟到点后系统自动提交
- 自动提交时间就是尽调信息向投资经理解锁的时间

### 1.6 投资经理查看行为

- 投资经理在尽调信息解锁前，可以先看自己的材料、写草稿、使用 AI
- 尽调信息解锁后，投资经理可以直接提交
- “是否查看过尽调员信息”不再作为提交门槛
- 但“是否查看过”“何时查看”仍然是需要保存的实验行为变量

---

## 2. 当前必须保存到数据库的随机化信息

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

### 4.2 仍在设计中的下一层

- `behavior_event`
  - 统一收关键行为事件
- `session_config_snapshot`
  - 统一收本场实验实际采用的参数配置

---

## 5. 联动文档

- 流程真相源：`02_specs/00_overview/APP_FLOW.md`
- 保存层规格：`02_specs/02_backend/VARIABLE_PERSISTENCE_SPEC.md`
- 变量表整理版：`00_start_materials/第五次开会/D变量表_整理版.md`

后续只要这几条规则再变，必须同步改这里。
