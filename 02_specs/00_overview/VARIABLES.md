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
- `phase`：`instruction | practice | formal_work | formal_break | end`
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
- `bCanSubmitAt`
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
- 自动分配角色
- 配对成功
- 进入指导语
- 进入测试轮
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

### 3.4 副线行为
- 顶部入口滚动开始
- 顶部入口滚动结束
- 点击“待处理事宜”
- 点击滚动消息
- 进入副线展开页
- 退出副线展开页
- 选择副线题答案
- 切换上一题/下一题
- 新工作段重置副线累计

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
- 角色来源是进入顺序，不是 admin 上传字段
- 公司顺序按 session 固定随机、无放回
- B 是否“看过 A 信息”仅作为行为记录口径，不再作为提交门槛
- 副线已完成累计只在当前工作段内有效
- 本轮不为截图功能设计变量口径
