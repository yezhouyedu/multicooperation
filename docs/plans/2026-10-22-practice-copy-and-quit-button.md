# 测试轮指导语逐字对齐与退出按钮避让 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task after user approval.

**Goal:** 原样呈现研究者提供的测试轮指导语，解决退出实验入口遮挡任务2全屏按钮的问题。

**Architecture:** 指导语使用单一、静态、可提交的已批准文案，不再根据角色和Admin时长自行拼句。退出入口只在正式任务1主工作台顶部栏“网络正常”左侧显示，任务2展开时隐藏；复用原确认弹窗和退出接口，不更改质量监测或实验终止逻辑。

**Tech Stack:** Next.js / React / TypeScript，现有NestJS后端保持不变。

**Status:** 2026-10-22本地实现与验证完成，生产备份校验完成；待web发布及公网复核。

## 文案真相源及边界

- 原件：`E:/Own_program/multi cooperation/00_start_materials/第十一次开会/测试轮指导语.txt`。
- 保留标题、引言、段落、列表、标点和顺序；A/B使用同一份全文，不删掉另一角色说明，不自行补充无AI、反馈或动态时长句。
- 末行`**按钮：我了解了**`是控件标注：显示“我了解了”按钮，不把标注字符串当正文。
- 原件所在目录被Git忽略；发布文案必须落在可提交的前端内容模块，不能依赖服务器读取会议原件。
- 只替换首次测试轮总览，不擅自修改后续分步操作教学和正式段前指导语。

## 审查结论与用户最终确认

1. 只换文案，不改正式B门槛。A正常5分钟自动提交，正式B分配的是A已提交或正在处理的公司；此前将保护条件描述成常态等待的疑虑撤回。测试轮A/B各自计时、自动结束，不等待对方提交。
2. 用户确认原文A固定写5分钟，Admin仍允许分别调整A/B测试轮时间、默认均5分钟；不做动态改写，也不更改Admin配置能力。
3. 原文“不影响其提交资格”按“是否点击查看/使用”理解，与现有无需先点击查看即可提交的规则一致，不自行解释成无需等待A提交。

## Task 1: 固定指导语文案

**Files:**
- Create: `E:/Own_program/multi cooperation/apps/web/src/content/practice-instructions.ts`。
- Modify: `E:/Own_program/multi cooperation/apps/web/src/components/practice-tutorial-overlay.tsx`。
- Create: `E:/Own_program/multi cooperation/scripts/verify-practice-instructions.cjs`。

1. 先增加原文逐字/顺序核对，验证旧文案不通过。
2. 从TXT原样建立静态内容模块，去掉总览中角色分支和Admin分钟数插值，不改计时本身。
3. 接入现有总览弹窗，保留滚动、段落和“我了解了”按钮行为。
4. 逐字对照TXT，并检查A/B总览相同；不能仅靠“关键字存在”判定一致。

## Task 2: 紧凑退出入口与独立占位

**Files:**
- Modify: `E:/Own_program/multi cooperation/apps/web/src/components/online-integrity-guard.tsx`。
- Modify: `E:/Own_program/multi cooperation/apps/web/src/components/session-topbar.tsx`。
- Modify: `E:/Own_program/multi cooperation/apps/web/src/components/sidetask-strip.tsx`。
- As needed: A/B工作台接线及共享退出按钮组件。

1. 复现现状：退出入口为`fixed right-2 top-14 z-[90]`，覆盖任务2的`z-50`工作台；当前字号已10px。
2. 用紧凑文字按钮缩减边距，目标高度约24px，不把文字继续缩成难以辨认的小字。
3. 退出入口仅在正式任务1主工作台顶部栏的网络状态左侧占位，与状态/倒计时同排；任务2展开时隐藏，返回主界面后恢复。不在任务2顶部栏新增退出按钮。
4. 保留退出确认、取消、后端退出事件及A/B退出后的原有行为；不因任务2展开重复挂载监测器或改变心跳。

## Task 3: 验证、记录与发布（批准后执行）

1. 本地原文逐字检查；A/B教学滚动、按钮与后续教学流程检查。
2. 浏览器验证任务1/任务2、无AI/BASIC/ADVANCED、材料/任务表/AI全屏与还原；退出入口不遮挡任何全屏/返回/发送按钮。
3. 在常用桌面、较窄窗口和缩放情况下检查按钮矩形不相交，并实际点击全屏、还原、返回及退出取消。
4. `corepack pnpm --filter web build`；如改动触及共用实验逻辑，补跑后端回归，不创建数据库迁移。
5. 更新对应规格、`03_tracking/progress.md`与`启动prompt.txt`；说明文案替换不等于修改计时或正式B门槛。
6. 明确文件范围中文提交并push，按web影响面部署；生产只读核验文案和资源版本，不修改已有实验数据或Session快照。

## 通过标准

- TXT全部参与者可见文字逐字一致，A/B不再出现AI自行生成的变体。
- 主工作台退出入口为普通顶部栏元素；任务2无退出入口，不与全屏/返回/发送按钮重叠。
- 退出确认与实验规则不变；任何规则改变必须先获得用户明确批准。

## 本地验收与发布边界

- `node scripts/verify-practice-instructions.cjs`通过：批准正文SHA-256为`36e0cc4e48056ed9f3a6cfddff96055895bc63967d0c6d7aa2e6118191959221`，与原TXT逐字一致；12组A/B、AI等级、时长的服务端渲染全文一致，顶部入口4项检查通过。
- web生产构建24路由及后端15套件90项回归通过。浏览器155项通过，覆盖12种正式配置（A/B×无AI/基础/高级×监测开关）、4种测试轮布局、2种停止状态；截图已自行检查。
- 浏览器使用实际前端与拦截的虚构runtime/API、模拟EventSource，不读写真实参与者；125%检查使用CSS zoom，不冒称浏览器原生缩放、真实SSE或完整实验彩排。最初夹具记录请求时跨导航丢失执行上下文，改为夹具进程记录后重跑通过，不是产品代码错误。
- 生产备份：`/var/backups/multi-cooperation/ui_copy_quit_20261022T143925+0800`，数据库custom dump、server_storage、源码、环境文件均完成校验；旧web镜像保留标签`multi-cooperation-web:rollback-ui-20261022`。
- 发布前线上16局/41参与者，Admin现值A5/B6；默认配置定义仍5/5。本轮保留现值和历史Session快照，不修改数据库；不能按旧测试记录清理现有数据。
