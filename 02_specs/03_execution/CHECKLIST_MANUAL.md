# CHECKLIST_MANUAL.md

# multi cooperation 项目检验手册（当前真实版本）

这份手册只做一件事：
**让你按现在真实代码，而不是按历史方案，检查项目是否可跑、流程是否通、关键约束是否生效。**

---

# 一、先记住当前真实主流程

当前参与者流程已经不是旧版的“手动指定 A/B + B 独立等待页”了。

现在的真实主流程是：

1. `/login`
   - 只用手机号登录
   - 只有在 admin 合格名单里的手机号才能进入

2. `/waiting-room`
   - 自动配对
   - 按进入顺序自动分配 `A/B`

3. `/instruction`
   - 指导语页

4. `/practice`
   - 测试轮

5. 正式实验
   - `3` 个工作段
   - `2` 个休息问卷段
   - 工作段页面：
     - `A -> /workspace/a`
     - `B -> /workspace/b`

6. `/workspace/b-feedback`
   - B 完成主任务后的反馈页

7. `/workspace/end`
   - 实验结束页

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
- 被试名单是 phone-only，不再要求预设角色
- 可以查看和保存 experiment config：
  - 工作段时长
  - 休息段时长
  - 工作段 1/2/3 的 AI 等级
  - 问卷模板

## 2）参与者登录与自动配对

用两个合格手机号依次登录。

推荐用种子账号：

- `AAA`
- `BBB`

你应该观察到：

- 第一个进入者拿到 `A`
- 第二个进入者拿到 `B`
- 两人进入同一个 session
- session 状态从 `WAITING` 变成 `MATCHED`

## 3）指导语与测试轮

两位参与者配对成功后，应能继续进入：

- `/instruction`
- `/practice`

你应该观察到：

- 指导语页能进入
- 测试轮页能进入
- 完成测试轮后进入正式实验，而不是直接跳旧页面

## 4）正式实验主线

### A 端检查

打开 `/workspace/a` 后，检查：

- 顶栏显示当前阶段倒计时
- A 正在处理公司时，额外显示当前公司 `5` 分钟倒计时
- 表单结构已经是终版 A 表：
  - 公司信息
  - `A.1` 基础数值摘录区
  - `A.2` 8 份材料线索记录区
  - `A.3` 给 B 的总体交接备注

### B 端检查

打开 `/workspace/b` 后，检查：

- B 没有独立等待页
- 若当前有公司，B 可以先处理自己的判断
- A 信息未解锁前：
  - A 信息区显示锁定态
  - 提交按钮不可用
- A 信息解锁后：
  - B 可以直接进入反馈页并完成提交
  - 若点开 A 信息区，应只影响记录，不影响是否可提交

### A/B 共用顺序检查

你应该观察到：

- 同一组 A/B 共享同一条固定公司顺序
- 不是两套不同顺序
- 该顺序为 session 内随机、无放回

## 5）休息问卷段

当工作段时间推进到休息段时，检查：

- 页面进入 `/break`
- 顶栏仍显示倒计时
- 问卷能正常显示和提交

---

# 五、关键约束怎么验

## 1）A 的 5 分钟解锁

目标：

- A 每家公司有自己的 `5` 分钟窗口
- 到点后 A 信息自动解锁给 B

检查方式：

- A 提交前，B 端 runtime 里 `aInfoUnlocked` 应为 `false`
- A 提交后，或 A 到 `5` 分钟自动解锁后，B 端 runtime 里 `aInfoUnlocked` 应为 `true`

## 2）B 在 A 解锁后才能提交

目标：

- B 不能在 A 信息未解锁时完成任务
- A 信息一旦解锁，B 无需先点开 A 信息区也可完成任务

检查方式：

1. 在 A 信息尚未解锁时，直接调：

```text
POST /experiment/session/:code/tasks/:taskId/b-complete
```

应该返回 `400`。

2. 等 A 信息解锁后，不先调用：

```text
POST /experiment/session/:code/tasks/:taskId/view-a-info
```

直接再调 `b-complete`，这时应成功。

3. 若再调用：

```text
POST /experiment/session/:code/tasks/:taskId/view-a-info
```

应只补充行为记录，不改变“已可提交”这一事实。

## 3）完成态是否落到 session.status

目标：

- 最后一个 B 任务完成后，session.status 应变成 `COMPLETED`

检查方式：

1. 完成该 session 的最后一个 B 任务
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
- `GET /experiment/session/:code/tasks`
- `POST /experiment/session/:code/start-practice`
- `POST /experiment/session/:code/complete-practice`
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
- `/practice`
- `/break`
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

- A 表单已经按终版 docx 的结构来
- B 表单已经按终版 docx 的结构来
- 保存草稿不会报错
- 再次进入页面时草稿能回显

## 2）材料区与 AI 区不要被改坏

当前应重点确认：

- 左侧材料区仍能正常切 tab
- 主线 AI 仍可正常发送消息
- 顶栏倒计时仍可见
- 三区布局、滚动、分栏拖拽没有被这轮表单重构破坏

---

# 九、如果你只做最省事的一轮验收

按下面顺序就够：

1. 启动数据库
2. 启动本地环境
3. 打开 `/admin`
4. 用两个种子手机号登录
5. 观察自动配对
6. 走完 `/instruction -> /practice -> /workspace/a or /workspace/b`
7. 检查 A/B 表单结构
8. 检查 A 解锁、B 提交门槛、B 提交
9. 至少走过一次 `/break`
10. 最后查 session 是否变成 `COMPLETED`

如果这一轮能走通，就说明当前真实主链路是通的。
