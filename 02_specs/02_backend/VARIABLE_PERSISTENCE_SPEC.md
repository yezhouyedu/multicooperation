# VARIABLE_PERSISTENCE_SPEC.md

> 本文档定义“实验必要变量保存层”的职责边界。  
> 目标不是一次性重构完所有表，而是先把什么必须留下、留在哪里、后面怎么扩写说清楚。

---

## 1. 为什么要单独做保存层

当前项目里已经混着三类数据：

- 业务运行数据
- 行为事件数据
- 实验随机化与方法留痕

如果继续全塞在业务表里，后面会有两个问题：

- 写论文时，很难确认哪些字段才是真正的实验真相源
- 改产品逻辑时，很容易把实验必要变量顺手改坏

所以需要把“实验保存层”单独设计出来。

---

## 2. 建议的四层结构

### 2.1 业务运行层

用途：

- 支撑系统跑起来
- 直接服务当前页面和接口

当前典型表：

- `Session`
- `Pairing`
- `TaskAssignment`
- `TaskSnapshot`

特点：

- 面向运行时
- 可以频繁调整
- 不适合作为论文唯一真相源

### 2.2 行为事件层

用途：

- 统一记录参与者做了什么关键动作

建议表：

- `BehaviorEvent`

建议字段：

- `id`
- `sessionId`
- `participantId`
- `taskAssignmentId`
- `role`
- `eventType`
- `eventAt`
- `payload`
- `version`

### 2.3 随机化审计层

用途：

- 统一记录实验条件是怎么分出来的

当前已落地表：

- `RandomizationAudit`

当前字段：

- `roleAssignmentMethod`
- `roleAssignmentSeed`
- `roleAssignedAt`
- `companySequenceMethod`
- `companySequenceSeed`
- `companySequenceGeneratedAt`
- `companySequence`

### 2.4 配置快照层

用途：

- 保存“这场实验实际采用了什么配置”

建议表：

- `SessionConfigSnapshot`

建议字段：

- `sessionId`
- `configVersion`
- `workDurationMinutes`
- `breakDurationMinutes`
- `aWindowMinutes`
- `sideDispatchMode`
- `aiCapabilityVersion`
- `questionnaireVersion`

---

## 3. 当前已经落地的最小闭环

### 3.1 角色随机化留痕

- 两人先按进入顺序成组
- 第二人进入后，系统生成 `roleAssignmentSeed`
- 系统基于 seed 随机决定尽调员/投资经理
- 结果写入 `RandomizationAudit`

### 3.2 公司顺序随机化留痕

- 每组生成独立的 `companySequenceSeed`
- 用 `seeded_fisher_yates_v1` 生成最终顺序
- 最终顺序快照写入 `RandomizationAudit`

---

## 4. 当前优先级最高的下一步

### 4.1 补 `BehaviorEvent`

优先纳入的事件：

- `instruction_viewed`
- `practice_ready`
- `formal_ready`
- `a_task_auto_submitted`
- `b_viewed_a_info`
- `b_task_completed`
- `break_questionnaire_submitted`

### 4.2 补 `SessionConfigSnapshot`

至少要把这些固定下来：

- 工作段时长
- 休息段时长
- A 单家公司 5 分钟规则
- AI 档位配置
- 问卷模板版本

---

## 5. 代码落点建议

后端建议单独建模块：

- `apps/server/src/experiment-audit/`

建议拆分：

- `experiment-audit.service.ts`
- `dto/`

当前这一步还不急着开接口，先把数据库和写入时机定死。
