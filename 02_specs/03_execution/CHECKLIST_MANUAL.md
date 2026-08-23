# CHECKLIST_MANUAL.md

# multi cooperation 项目检查手册（当前真实版本）
这份手册只做一件事：**让你按现在真实代码，而不是按历史方案，检查项目是否可跑、流程是否连通、关键约束是否生效。**

---

# 一、先记住当前真实主流程

当前参与者流程已经不是旧版的“手动指定 A/B + B 独立等待页”。

现在的真实主流程是：

1. `/login`
   - 只用手机号登录
   - 只有在 admin 合格名单里的手机号才能进入
2. `/waiting-room`
   - 自动配对
   - 先按进入顺序两人成组，再在组内随机分配 `A/B`
3. `/instruction`
   - 通用指导语与当前 A/B 角色说明
4. `/instruction/task-preview`
   - 当前角色任务表只读预览，至少阅读 30 秒
5. `/ready?target=practice`
   - 同步准备页 1
6. `/practice-quiz`
   - 测试题
7. `/practice`
   - 测试轮入口页；实际会把参与者导向真实工作台
8. `/ready?target=formal`
   - 同步准备页 2
9. 正式实验
   - 每个工作段前进入 `/pre-segment-instruction`
   - `3` 个工作段
   - 每段后提交一次工作段回顾；前两次提交后进入休息等待
   - 工作段页面：
     - `A -> /workspace/a`
     - `B -> /workspace/b`
10. `/workspace/b-feedback`
   - B 完成主任务后的反馈页
11. `/workspace/end`
   - 第 3 段工作回顾 → 最终长问卷 → 独立支付确认 → 实验完成页

补充说明：

- `/workspace/b-waiting` 现在只保留兼容跳转，不再承担正式流程。
- `/dev/session-inspector` 现在只是跳转到 `/admin` 的兼容入口。

---

# 二、你要在哪个目录操作

默认都在这个目录执行：

```powershell
cd "E:\Own_program\multi cooperation"
```

---

# 三、最基础的启动检查

## 1）检查数据库容器

```powershell
cd "E:\Own_program\multi cooperation"
corepack pnpm run db:up
docker ps
```

你应该看到：

- 容器：`multi_cooperation_postgres`
- 镜像：`postgres:16`
- 状态：`Up`
- 端口映射里有 `5432`

如果这些都在，说明 PostgreSQL 已经起来了。

## 2）检查前后端 build

后端：

```powershell
corepack pnpm --filter server build
```

前端：

```powershell
corepack pnpm --filter web build
```

两条都通过，说明当前代码至少在构建层面是通的。

## 3）推荐的一键本地启动

你可以直接用项目根目录的 bat：

```text
E:\Own_program\multi cooperation\启动本地开发环境.bat
```

或命令行方式：

```powershell
corepack pnpm run dev:local
```

启动后，至少检查：

- `http://localhost:3000/login`
- `http://localhost:3001/health`

如果这两个地址都正常，说明前后端都已起来。

---

# 四、当前推荐的人工验收顺序

## 1）admin 后台

打开：

```text
http://localhost:3000/admin
```

重点检查：

- 可以查看当前被试名单
- 被试名单是 `phone-only`，不再要求预设角色
- 可以查看和保存 experiment config：
  - 测试轮时长
  - 工作段时长
  - 休息段时长
  - 当前正式实验局、A0-A8 槽位进度与条件分配计数（每区组 9 个）
  - 测试题模板
  - 工作段回顾与最终长问卷模板
- 正式模式下 AI/任务2处理由 A0-A8 条件决定；A0/A7/A8 均无 AI；旧三段 AI 字段不得覆盖正式 Session 条件快照

## 2）参与者登录与自动配对

用两个合格手机号依次登录。

你应该观察到：

- 两人进入同一个 session
- session 状态从 `WAITING` 变成 `MATCHED`
- 角色不是“先来固定 A、后来固定 B”，而是配对完成后随机决定
- 正式模式下 Session 同时原子领取一个 A0-A8 条件槽位；A/B 共享条件，角色随机与条件分配相互独立

### 线上质量与退出专项

- 正式工作段进入时必须由按钮触发全屏；退出全屏出现阻断层但数据库不生成 fullscreen 事件。
- 逐次测试 1 秒、2 秒、3 秒切屏：三次都落 `OFFSCREEN`，只有 3 秒的 `isViolation/hasOffscreenViolation=true`。
- 高级 AI 图片选择器失焦标记 `authorizedDialog=true`，即使超过 2 秒也不判切屏违规。
- 将 Admin 临时设为 10 秒 + 5 秒，验证软提醒确认不判无效、确认超时开启 `INACTIVITY`、下一次有效操作闭合。
- 断开某一端网络：超过掉线宽限生成 `DISCONNECT`，阈值前恢复不正式退出，超过退出阈值才 `DROPPED`。
- A 退出：B 页面显示队友退出且 B 草稿/查看/提交 API 被拒绝。B 退出：A 显示提示并可继续下一家公司与后续工作段。
- 导出后核对 `session_metadata.json.qualityFlags` 和双方 `online_integrity.json` 能由原始区间重算。

## 3）指导语、同步准备与测试轮

两位参与者配对成功后，应能继续进入：

- `/instruction`
- `/instruction/task-preview`
- `/ready?target=practice`
- `/practice-quiz`
- `/practice`

你应该观察到：

- 指导语页能进入
- 第 1 页指导语进入任务表预览；预览至少阅读 30 秒后才进入同步准备页 1
- 双方都 ready 后才进入测试题页
- 只有双方都通过测试题，系统才自动进入测试轮
- 测试轮页会把参与者导向真实工作台
- 完成测试轮后先进入同步准备页 2，而不是直接跳旧页面

## 4）正式实验主线

### A 端检查

打开 `/workspace/a` 后，检查：

- 顶栏显示当前阶段倒计时
- A 正在处理公司时，额外显示当前公司 `5` 分钟倒计时
- 表单结构已经是终版 A 表

### B 端检查

打开 `/workspace/b` 后，检查：

- B 没有独立等待页
- 若当前有公司，B 可以先处理自己的判断
- A 信息未解锁前：
  - A 信息区显示锁定态
  - 提交按钮不可用
- A 已提交且 B 自己的 `5` 分钟窗口到点后：
  - A 信息区、A 原始材料与提交按钮同时解锁
  - B 可以进入反馈页并完成提交
  - 是否点开 A 信息区只影响行为记录，不再影响是否可提交

### A/B 共用顺序检查

你应该观察到：

- 同一组 A/B 共享同一条固定公司顺序
- 不是两套不同顺序
- 该顺序为 session 内随机、无放回

## 5）工作段回顾、休息等待与段前指导语

每个工作段结束后检查：

- 页面进入 `/break`
- 顶栏仍显示倒计时
- 页面标题与内容为“工作段回顾”，问卷能正常显示和提交
- 第 1、2 段提交后进入休息等待，休息结束后先进入 `/pre-segment-instruction`
- 第 3 段回顾提交后进入 `/workspace/end`，依次完成最终长问卷与支付确认

## 6）测试轮副线与教学引导

进入测试轮后，检查：

- 顶部副线入口可见
- 测试轮里会有教学引导
- 教学完成前不能直接算作已完成测试轮
- 最后一步副线作答完成后，会先回到主界面，再显示“下一步正式进入测试轮”过渡卡

---

# 五、关键约束怎么验

## 1）A 的 5 分钟解锁

目标：

- A 每家公司有自己的 `5` 分钟窗口
- 到点后 A 信息自动解锁给 B

检查方式：

- A 提交前，B 端 runtime 里 `aInfoUnlocked` 应为 `false`
- A 提交后，或 A 到 `5` 分钟自动解锁后，B 端 runtime 里 `aInfoUnlocked` 应为 `true`

## 2）B 同时满足 A 提交与自己的 5 分钟窗口后才能提交

目标：

- B 不能在 A 尚未提交时完成任务
- 即使 A 已提交，`bCanSubmitAt > now` 时 B 仍不能查看 A 信息或提交
- 两个条件都满足后，B 无需先点开 A 信息区即可完成任务

检查方式：

1. 在 A 尚未提交，或 A 已提交但 B 自己的 5 分钟尚未结束时，直接调：

```text
POST /experiment/session/:code/tasks/:taskId/b-complete
```

应该返回 `400`。

2. 等 A 已提交且 `bCanSubmitAt <= now` 后，不先调用：

```text
POST /experiment/session/:code/tasks/:taskId/view-a-info
```

直接再调 `b-complete`，这时应成功。

3. 若再调用：

```text
POST /experiment/session/:code/tasks/:taskId/view-a-info
```

应只补充行为记录，不改变“已可提交”这一事实。

## 3）完成态是否落到 `session.status`

目标：

- 最后一个正式 B 任务完成后，`session.status` 变成 `COMPLETED`

检查方式：

1. 完成该 session 的最后一个正式 B 任务
2. `b-complete` 应返回：

```json
{ "ok": true, "allDone": true }
```

3. 再查：

```text
GET /experiment/session/:code
```

应看到：

- `status: COMPLETED`

---

# 六、当前后端接口重点验收项

当前建议重点验这些接口：

- `POST /auth/login`
- `GET /experiment/session/:code`
- `GET /experiment/session/:code/runtime`
- `GET /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/practice-quiz`
- `POST /experiment/session/:code/ready-practice`
- `POST /experiment/session/:code/ready-formal`
- `POST /experiment/session/:code/complete-practice`
- `POST /experiment/session/:code/progress`
- `GET /experiment/session/:code/tasks`
- `POST /experiment/session/:code/tasks/:taskId/draft`
- `POST /experiment/session/:code/tasks/:taskId/view-a-info`
- `POST /experiment/session/:code/tasks/:taskId/a-submit`
- `POST /experiment/session/:code/tasks/:taskId/b-complete`
- `GET /experiment/session/:code/questionnaire`
- `POST /experiment/session/:code/questionnaire`
- `GET /admin/sessions`
- `GET /admin/export`

---

# 七、当前前端页面重点验收项

当前建议重点验这些页面：

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
- `/workspace/b-feedback`
- `/workspace/end`
- `/admin`

兼容页只做“还能跳”检查，不做主流程验收：

- `/workspace/b-waiting`
- `/dev/session-inspector`

---

# 八、这轮代码后要特别看的两项

## 1）A/B 正式表单

当前应重点确认：

- A 表单已经按终版 docx 结构来
- B 表单已经按终版 docx 结构来
- 保存草稿不会报错
- 再次进入页面时草稿能回显

## 2）材料区与 AI 区不要被改坏

当前应重点确认：

- 左侧材料区仍能正常切 tab
- 主线 AI 仍可正常发送消息
- 顶栏倒计时仍可见
- 三区布局、滚动、分栏拖拽没有被改坏

---

# 九、如果你只做最省事的一轮验收

按下面顺序就够：

1. 启动数据库
2. 启动本地环境
3. 打开 `/admin`
4. 用两个种子手机号登录
5. 观察自动配对
6. 走完 `/instruction -> /instruction/task-preview -> /ready?target=practice -> /practice-quiz -> /practice -> /ready?target=formal -> /pre-segment-instruction -> /workspace/a or /workspace/b`
7. 检查 A/B 表单结构
8. 检查 A 提交、B 自己的 5 分钟窗口、B 双重提交门槛与 B 提交
9. 至少走过一次“工作段回顾 → 休息等待 → 下一段段前指导语”
10. 检查第 3 段回顾、最终长问卷、支付确认，并确认 session 最终变成 `COMPLETED`

如果这一轮能走通，就说明当前真实主链路是通的。
