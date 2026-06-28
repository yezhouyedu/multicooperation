# VARIABLES.md

> 状态：2026-05-12 第二轮变量口径版
> 位置：`02_specs/00_overview/VARIABLES.md`

## 1. 文档目标
本文件定义：
- 哪些字段必须直接落库
- 哪些行为必须以事件日志记录
- 哪些分析变量依赖导出后计算

## 2. 直接落库的基础业务字段
### 2.1 参与者与配对
- `participantId`
- `phone`
- `joinSequence`
- `assignedRole`
- `sessionId`
- `pairingId`
- `practiceOrFormal`

### 2.2 阶段与时间
- `phase`：`instruction | practice_ready | practice_quiz | practice | formal_ready | formal_work | formal_break | end`
- `segmentIndex`
- `segmentType`
- `segmentStartedAt`
- `segmentEndsAt`
- `segmentRemainingSeconds`
- `workDurationMinutes`
- `breakDurationMinutes`

### 2.3 公司与主线进度
- `companyId`
- `companyOrderIndex`
- `sessionCompanySequence`
- `aCompanyStartedAt`
- `aCompanyEndsAt`
- `aCompanyRemainingSeconds`
- `aInfoUnlockedAt`
- `bOpenedAInfoAt`
- `bCanSubmitAt`：B 被分配当前公司后满 5 分钟的开放时刻；B 查看 A 信息、解锁 A 原始材料和提交都以此作为门槛之一
- `aSubmittedAt`
- `bCompletedAt`
- `taskFrozenAt`
- `taskResumedAt`

### 2.4 快照与恢复
- `snapshotId`
- `snapshotType`
- `snapshotLabel`
- `snapshotTakenAt`
- `restoreSourceSnapshotId`
- `restoreAt`

### 2.5 AI 元数据
- `aiMessageId`
- `contextType`：`main | side`
- `aiLevel`：`basic | advanced`
- `imageEnabled`
- `provider`
- `model`
- `requestId`
- `companyScopedContextKey`
- `sideScopedContextKey`

## 3. 必须记录的事件日志
### 3.1 配对与页面进入
- 进入登录页
- 登录成功/失败
- 进入等候室
- 进入同步准备页 1 / 2
- 组内随机分配角色
- 配对成功
- 进入指导语
- 进入测试题
- 测试题提交 / 通过 / 未通过
- 进入测试轮
- 教学引导开始 / 步骤完成 / 教学完成
- 进入正式实验

### 3.2 主线行为
- A 打开公司
- A 保存草稿
- A 到达 `5` 分钟自动保存
- A 信息解锁给 B
- B 首次看到公司
- B 首次打开 A 信息区
- B 保存草稿
- B 提交主任务
- 工作段冻结
- 工作段恢复

### 3.3 问卷与休息段
- 进入休息问卷段
- 问卷开始作答
- 问卷提交
- 问卷超时结束
- 进入下一工作段

### 3.4 任务2行为
- 顶部入口滚动开始
- 顶部入口滚动结束
- 点击“任务2”
- 点击滚动消息
- 进入任务2展开页
- 退出任务2展开页
- 选择任务2题答案
- 切换上一题/下一题
- 新工作段重置任务2累计

### 3.5 AI 行为
- 主线 AI 请求发送
- 主线 AI 请求完成/失败
- 副线 AI 请求发送
- 副线 AI 请求完成/失败
- 上传图片尝试
- `basic` 模式图片被拒绝

## 4. 快照与分析关键口径
- B 的 `5` 分钟快照必须带 `snapshotType = b_five_minute_snapshot`
- 快照名称必须带“5分钟快照 + 时间戳”
- 测试轮与正式轮必须通过 `practiceOrFormal` 区分，不能混用
- 主线 AI 日志必须带 `companyId`
- 副线 AI 日志不得因公司切换丢失上下文，但要带 `segmentIndex`

## 5. 依赖导出后计算的分析变量
- 主线有效时长
- 副线停留时长
- 主副线切换次数
- A 信息解锁后到 B 首次打开 A 信息区的延迟（若仍记录）
- B 从打开 A 信息区到提交的延迟（若仍记录）
- 不同工作段下主线/副线/AI 使用差异
- `basic` 与 `advanced` AI 条件下的行为差异

## 6. 当前明确约束
- 角色来源不是 admin 上传字段，也不是“先来固定 A、后来固定 B”；而是先按进入顺序成组，再在组内随机分配
- 公司顺序按 session 固定随机、无放回
- B 是否“看过 A 信息”仅作为行为记录口径，不再作为提交门槛；真正提交门槛是 A 已提交且 B 当前公司的 `bCanSubmitAt <= now`
- 副线已完成累计只在当前工作段内有效
- 本轮不为截图功能设计变量口径
