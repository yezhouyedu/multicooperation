# progress.md

### 2026-06-17 HTTPS 域名入口部署完成

**结果**：`https://aiseek.tech` 已作为线上正式入口跑通，`www.aiseek.tech` 统一跳转到裸域名，`/api` 由 Nginx 反代到后端。

**线上已完成**：
- 证书文件已部署到服务器 `/etc/multi-cooperation/certs`，私钥权限为 `600 root:root`，未进入 git。
- 服务器 `/opt/multi-cooperation/.env.production` 已切换为 `NEXT_PUBLIC_SERVER_BASE_URL=https://aiseek.tech/api`。
- `compose.production.yml` 中的 `nginx` 容器已上线，80 / 443 均已绑定，容器状态 healthy。
- `web` 已用 HTTPS API 地址重新构建，线上静态 chunk 检查未发现旧 `49.233.203.108:3001` API 地址。

**验证结果**：
- `https://aiseek.tech/api/health` 返回 200。
- `https://aiseek.tech/admin` 返回 200。
- `https://aiseek.tech/login` 返回 200。
- `http://aiseek.tech` 返回 301 到 `https://aiseek.tech/`。
- `https://www.aiseek.tech` 返回 301 到 `https://aiseek.tech/`。
- 服务器内 `curl --resolve aiseek.tech:443:127.0.0.1 https://aiseek.tech/api/health` 返回 200。

**后续收口建议**：HTTPS 稳定观察后，可以在腾讯云安全组关闭公网 3000 / 3001，只保留 80 / 443 / 22。关闭前建议再做一轮完整实验 smoke，尤其检查 SSE、AI 图片上传、变量导出是否都能经 `/api` 代理正常工作。

## 当前阶段

- 2026-06-05：已回正副线变量 A 口径：continuous / batch 操纵的是提醒频率，不再操纵题目实际到达节奏；后端题目到达统一为 30 秒一条，前端提醒频率按模式区分。

阶段 2.6：母版级前端复刻 + 副线任务真实逻辑 + AI 兼容层稳定化

## 已完成

- 确认本项目资料统一存放在：`E:\Own_program\multi cooperation`
- 已创建 monorepo 根文件：`package.json`、`pnpm-workspace.yaml`
- 已创建工程基础目录：`apps/`、`packages/`、`infra/docker/`
- 已创建 PostgreSQL 的 `docker-compose.yml` 和 `.env.example`
- 已初始化 `apps/web` 与 `apps/server` 脚手架文件，当前正在统一补齐 workspace 依赖
- 确认这是长期全栈开发工程，不放入平时 result 目录
- 已阅读启动认知材料：`00_start_materials\start\Vibe Coding项目所需认知.md`
- 已建立首批项目协作文档：
  - `01_rules\PROJECT_RULES.md`
  - `01_rules\CLAUDE.md`
  - `01_rules\INTERROGATION_QUESTIONS.md`
  - `03_tracking\progress.md`
  - `03_tracking\lessons.md`
  - `02_specs\PRD.md`
  - `02_specs\APP_FLOW.md`
  - `02_specs\TECH_STACK.md`
  - `02_specs\FRONTEND_GUIDELINES.md`
  - `02_specs\BACKEND_STRUCTURE.md`
  - `02_specs\IMPLEMENTATION_PLAN.md`
- 已完成目录结构重构，按“启动材料 / 规则 / 规格 / 跟踪 / 归档”分层
- 已新增 `README.md` 作为项目导航入口
- 已把“少说黑话、若非必要勿增实体”写入项目总规则
- 已新增 `02_specs\VARIABLES.md`
- 已将原 `process.md` 合并回 `progress.md`，旧文件移入 `04_archive`
- 已开始依据原始材料把实验逻辑、系统逻辑、前端逻辑转写进正式规格文档
- 已确定按方案 B 推进：Next.js + NestJS + PostgreSQL + 前后端分离 + monorepo
- 已确定第一阶段范围：本地先跑起“进入 → 配对 → 指导语 → A/B 页面骨架”的最小闭环

## 正在进行

- 重组 `02_specs` 目录结构，按“总览 / 前端 / 后端 / 执行验收”分层。
- 准备把当前阶段从“最小链路闭环”切换到“A/B 工作台产品化重构”。
- 规划前端规格拆分：总纲继续保留，细化工作台 / AI 面板 / 副线区规格单独成文。
- 已完成 step 1 / 2 / 3 的首轮落地：文档拆分、前端结构重构、最小 AI 接口占位。
- 用户已完成第一轮页面验收，并明确提出三个新的分任务：副线任务区功能改善、LeetCode 风格 UI 精修、AI 区真实接入与输入能力梳理。
- 已重新确认：当前顶部功能条仍残留调试信息，不符合用户界面定位；副线区当前仍是静态卡片，尚未进入真实任务流形态。

## 下一步

- 先完成 `02_specs` 文档重组后的引用修正与 README 导航，避免后续路径混乱。
- 在 `02_specs\01_frontend\` 下补前端细化规格，优先新增：`A_B_WORKBENCH_UI.md`、`AI_PANEL_SPEC.md`，必要时再补 `SIDETASK_PANEL_SPEC.md`。
- 继续收口第一轮前端重构细节，重点看：材料区 tab 手感、任务区信息密度、AI 区视觉比例、顶部状态条克制度。
- 补 `SIDETASK_PANEL_SPEC.md`，把副线展开态和交互细节单独定下来。
- 在保持现有保存链路可用的前提下，继续把正式页面与 `/dev/session-inspector` 的边界拉开。
- 先阅读 `B第二次对接_人机协作平台-产品文档.docx` 中与副线任务相关的原始描述，并补写进 `SIDETASK_PANEL_SPEC.md`。
- 再根据用户手绘分区图与 LeetCode 借鉴材料，继续精修 A/B 页面为“单页固定布局、三区内部滚动、非浏览器整页滚动”的形态。
- 已开始接入分区交互增强：材料区支持放大 / 还原；右侧任务区与 AI 区支持 split / task 全屏 / ai 全屏 三态切换，并已补上基础版真实拖拽：左右分区可横向拖拽、右侧任务区与 AI 区可纵向拖拽。
- 已将顶部副线传送带改为单轨单条滚动，优先解决右侧堆叠与重复 key 问题；当前动画已进一步回退到更贴近 `index.html` 的 left 驱动方式，后续继续微调速度与视觉质感。
- 已直接实测 DeepSeek 配置：当前 `.env` 中 `OPENAI_BASE_URL=https://api.deepseek.com`、`OPENAI_MODEL=deepseek-chat` 时，`/v1/chat/completions` 可正常返回 `hello`，说明 AI 基本文本链路是通的。
- `session-inspector` 已开始升级为管理员界面，并接入第一版副线调度参数面板：可本地调 `dispatch_mode / segment_total_items / batch_interval_minutes / batch_count / scroll_speed / content_set_id`，并即时作用到前端副线区。
- 已继续修副线传送带视觉细节：动画回退为更接近 `index.html` 的 left 驱动，卡片纵向位置下移以减少顶部遮挡；当前前端优先采用单轨单条滚动稳定运行。
- 【历史尝试】曾加过“均衡 / 材料优先 / 任务优先 / AI 优先”快捷布局按钮，但该方向后来已撤回，不作为当前正式基线。
- 已在项目根目录新增本地开发环境 bat：`启动本地开发环境.bat`、`停止本地开发环境.bat`、`重启本地开发环境.bat`；同时补充 `scripts/stop-local.ps1` 与 `scripts/restart-local.ps1`，用于更彻底地停止和重启 web/server 相关 node 进程。
- 【历史尝试】曾尝试将分区面积调节切到 `react-resizable-panels`，但该方向未成为最终稳定方案。
- 【现已收口】4.23 已放弃 `react-resizable-panels` 路线，改回更贴近母版的稳定三区布局，并通过直接控制分区尺寸完成左右 / 上下拖拽。
- 副线传送带的重复 key / 堆叠 / 居中错位问题已完成一轮修复，后续仅在现有稳定基线上继续微调。
- 把副线任务后端材料逻辑继续做实：对齐 Word 中的未处理保留、打标复用、调度参数留位、日志留痕，并逐步从前端 mock 过渡到更正式的数据结构。
- 继续增强 `/ai/chat` 的 provider 兼容解析，优先稳定文本；图片输入按 Gemini / OpenAI-compatible 实际能力渐进兼容。
- 在本轮 UI / 副线 / AI 三块都基本收口后，再进入项目的下一分任务。

## 当前卡点

- Windows 下全局 pnpm shim 受权限影响，当前先用 `corepack pnpm` 直接调用
- PostgreSQL 基础环境已建过并曾跑通，但后续若再次遇到本地环境异常，应按当前实际运行状态单独复核，不再沿用旧卡点描述
- 实时通信方案还未锁定
- `react-resizable-panels` 路线已确认不是本轮最终方案；相关 API 误判与类型不匹配问题已作为教训沉淀，当前前端基线以 4.23 修好的稳定三区布局为准。
- 项目此前未启用 Git；现已在根目录初始化本地 Git 仓库并补充 `.gitignore`

## 已知原则

- 文档第一，代码第二
- 审问 → 文档 → 代码
- 大任务拆小推进
- 重要决策要回写文档
- 说人话，少黑话
- 若非必要勿增实体
- 过程记录要简洁，一句话式

## 时间线记录

### 2026-04-03

- 建立项目目录分层、规则文件和首批规格文档骨架。

### 2026-04-21

- 明确后续先和合作者对齐待定项，再按原有框架补文档。
- 在项目总规则中补入“少说黑话、若非必要勿增实体”。
- 为 specs 新增 `VARIABLES.md`，并开始把实验逻辑、系统逻辑、前端逻辑转写进正式 md。
- README 改成更细的目录说明，并把跟踪体系收口到 `progress.md`。

### 2026-04-22

- 确定按方案 B 推进：Next.js + NestJS + PostgreSQL + 前后端分离 + monorepo。
- 确定第一阶段先做本地可运行的最小闭环，并包含指导语 / 叙事页面骨架。
- 已创建 monorepo 根文件、工程目录、PostgreSQL compose、web/server 脚手架与第一版页面骨架。
- 已修复 pnpm workspace 依赖安装问题；web 生产构建通过，PostgreSQL 容器已启动。
- 已确认本项目后续过程留痕统一写入 `03_tracking\\progress.md`，不再单独维护 `process.md`。
- 已给 server 接入 `@nestjs/config`，并为 web/server 补充环境变量示例文件。
- 已让 web 首页真实读取 server `/health` 状态。
- 已移除误建的 `03_tracking\\process.md`，避免后续再次分叉记录。
- 已接入 Prisma 基础依赖、schema、PrismaModule 与 PrismaService，为数据层落地做准备。
- 遇到 Prisma 7 的 datasource / client 配置兼容变动，决定直接切回 Prisma 6，优先保证当前工程稳定推进。
- Prisma 已成功 generate，并已对本地 PostgreSQL 执行首个 migration：`init`。
- 已补上 experiment 第一版接口：创建 session、加入 session、查询 session 状态；waiting-room 已开始读取真实后端数据。
- 已补 `apps/server/.env`，解决 Prisma 启动时缺少 `DATABASE_URL` 的问题。
- 已验证 experiment 接口真实可用：可创建 session，并能查到 WAITING 状态与 participantA 信息。
- waiting-room 已支持通过 query 参数切换 A/B 预览角色，并给出 MATCHED 后继续进入 instruction / A / B 页面 的跳转入口。
- 已验证后端 A 创建 + B 加入可使 session 状态真实变为 `MATCHED`。
- 已把 session / role 参数继续贯通到 instruction、A 页面骨架、B 页面骨架，补上“等候室 → 指导语 → 正式页面”的最小跳转链路。
- 已补 experiment `recordProgress` 第一版接口，开始把页面阶段行为写入 `task_progress`。
- instruction / A / B 页面已接入第一版阶段记录写入：`instruction_viewed`、`a_page_viewed`、`b_page_viewed`。
- 已补 `GET /experiment/session/:code/progress`，支持直接查询某个 session 的 `task_progress` 列表。
- 已新增 `scripts/start-local.ps1` 与根脚本 `dev:local`，用于一键拉起数据库、后端和前端；脚本已改成纯英文提示，避免 PowerShell 中文字符解析异常。
- waiting-room 已优化为：A 端在带 `code` 时优先复用已有 session；B 端在加入前先检查目标 session 是否存在、是否已被占用。
- instruction / A / B 页面已开始直接查询并展示当前 session 的 progress 概览，减少仅靠命令行验收的负担。
- 已新增 `/dev/session-inspector` 调试总览页，用于集中查看 session 状态、A/B 配对情况与 progress 列表。
- 已开始推进方向 B：新增共享 mock 实验数据，并把 A/B 页面从纯占位推进为带任务结构、材料内容和任务分区的页面。
- 已为 A/B 页面补第一版可编辑任务区组件，并提供最小“保存到 progress”按钮：`a_form_saved`、`b_workspace_saved`。
- 已补“最近一次保存结果”页面内回显；`session-inspector` 也已开始更明确展示 A/B 保存类 progress。
- A/B 编辑器已支持自动读取最近一次保存结果，并在页面内直接回显已保存内容，降低验证成本。
- 今晚收口点：功能先暂停在“可启动 / 可查看 / 可编辑 / 可保存 / 可回显 / 可在 inspector 验收”这一层，明早先人工验收再继续开发。
- 已重组 `02_specs` 目录：新增 `00_overview`、`01_frontend`、`02_backend`、`03_execution` 四个子目录，并新增 `02_specs\README.md` 作为规格导航。
- 已决定将项目推进阶段切换为“规格重组 + A/B 工作台产品化重构准备”，后续不再先把接口铺满，而是先定前端交互骨架，再按需补接口。
- 已在 `02_specs\01_frontend\` 下新增 `A_B_WORKBENCH_UI.md` 与 `AI_PANEL_SPEC.md`，把工作台布局与 AI 区形态单独拆出。
- 已开始第一轮 A/B 工作台产品化重构：把 A/B 页面从“调试预览页”改为“顶部状态条 + 顶部副线条 + 双栏工作区 + 聊天式 AI 区”的结构。
- 已新增前端组件：`ai-chat-panel.tsx`、`material-tabs.tsx`、`sidetask-strip.tsx`，用于承接聊天区、tab 材料区与顶部副线区。
- 已为 server 新增 `/ai/chat` 最小占位接口，并在 `apps/server/.env.example` 预留 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`，用于后续切换到真实模型调用。
- 根据本轮人工验收反馈，已确认下一分任务为三件事并行收口：① 副线任务区从静态展示升级为可交互、可展开、带真实逻辑的功能区；② A/B 页面继续按单页三分区、区内滚动、弱化调试信息的方向做 UI 重构；③ AI 区从占位壳子推进到真实 API 调用，并进一步校验图片输入能力边界。
- 已将 `apps/web/指导文件/index.html` 升级为高优先级前端母版，当前开始按“高保真复现 UI，再接入真实业务逻辑”的方式推进，而不再自行发散设计。
- 已将 AI 接口方向调整为“兼容层 / 适配层”思路：优先兼容 OpenAI 风格，同时补 Gemini / 兼容 provider 的返回解析兜底。
- 已确认进入整包收口模式：本轮连续推进“母版级前端复刻 + 副线任务真实逻辑 + A/B 材料/任务内容到位 + AI 兼容层稳定化”，不再按零散小修推进。
- 已开始修复副线传送带的 key 冲突问题，并把 runId 生成从时间戳拼接改为稳定自增序号，避免 React children key 重复。
- 已继续将 A 端任务区、B 端任务区、AI 区和副线全屏页往 `apps/web/指导文件/index.html` 的表单结构与视觉语言靠拢。
- 已进一步收口副线传送带的状态流：区分 queue 与 track，限制未处理 item 的重复入队，并让未处理项目继续回流、已处理项目退出流转。
- 已定位并修正 AI provider 的关键接入问题：`OPENAI_BASE_URL=https://api.huandutech.com` 需要走 `/v1/chat/completions`；当前 server 已自动补全该路径，不再误打到 provider 网页首页。
- 已直接实测当前 `apps/server/.env` 配置：在用户更新模型 id 后，`huandu` 路径可返回正常 JSON，说明请求已真实到达上游 provider；后续如仍有失败，应优先检查 token / provider 侧限制，而不再是本地 base url 拼接错误。
- 因近期连续出现 lockfile 混用、第三方库 API 误判、环境/实现问题交织等 bug，已将新的反思规则回写到 `01_rules/PROJECT_RULES.md`、`01_rules/CLAUDE.md` 与 `03_tracking/lessons.md`，后续把“包管理器一致性检查 / 第三方库真实导出检查 / 高影响改动先做最小验证”作为强制纪律。
- 已撤回这轮自作主张新增的布局快捷按钮（均衡 / 材料优先 / 任务优先 / AI 优先），并把 `workbench-layout` 重新朝 `apps/web/指导文件/index.html` 的三区布局、分隔条样式和放大/还原交互收回，优先恢复稳定 UI，而不是继续发散交互设计。
- 已按用户要求启动一轮”项目整理模式”：扫描根目录结构、重写根目录 `README.md`，并新增 `03_tracking/4.22进度.md`，把当前项目整体流程、已完成工作、核心成果和后续待办重新整理成可阅读的阶段总结。

### 2026-04-23

- **WorkbenchLayout 重构**：放弃 `react-resizable-panels`（面板宽高计算与 Tailwind 冲突），改用纯 Flexbox 复刻 `index.html` 三面板布局（A `w-1/2` | B `h-1/2` | C `flex-1`），彻底解决左面板塌陷为窄条的问题。
- **拖拽分区**：分割线改为直接操作 DOM `style.width/height`（绕过 React setState），实现零延迟拖拽调整面积，左右/上下范围限制 28%–72%。
- **材料区滚动条**：`MaterialTabs` 内容区加 `no-scrollbar`，去掉丑陋原生滚动条，保留滚动能力。
- **副线气泡居中**：将 `transform` 从 `@keyframes conveyorScroll` 中完全移出，改在 `.scroll-item` CSS 类里固定 `top: 50%; transform: translateY(-50%)`，动画只管 `left` 和 `opacity`，根除动画覆盖居中样式导致的偏移问题。
- **AI 接口修复**：排查出 Windows 系统级环境变量 `OPENAI_API_KEY` 优先级高于 `.env` 文件，导致改了 key 不生效；在 `main.ts` 顶部用 Node 内置 `fs` 手动解析 `.env` 并强制写入 `process.env`，解决 key 读取错误。

### 2026-04-23（续）· UI 精修 + 任务区重构 + 反馈页新增

#### 一、WorkbenchLayout 面板功能区按钮

**背景**：规格文档 P4/P6 要求三个面板各自在标题栏有功能按钮，原实现只有任务区和 AI 区有「放大/还原」，材料区（左侧）无标题栏也无按钮。

**改动文件**：`apps/web/src/components/workbench-layout.tsx`

- 新增 `LayoutMode` 类型，扩展为 `'split' | 'task' | 'ai' | 'sidebar'` 四态，支持材料区独立全屏。
- 为左侧面板（材料区）增加独立 header，显示 `sidebarTitle` prop（默认"材料区"），右侧放「全屏 / 退出全屏」按钮。
- 任务区 header 增加「保存草稿」按钮：点击时通过 `window.dispatchEvent(new CustomEvent('workbench-save-draft'))` 发布事件，解耦 WorkbenchLayout 与具体编辑器组件，不需要跨层传 ref。
- 「放大」统一改为「全屏」，「还原」改为「退出全屏」，措辞与规格对齐。
- 新增 `sidebarTitle?: string` prop，删除旧的 `taskSubtitle` / `aiSubtitle` props（实际未使用，降低接口噪音）。

**改动文件**：`apps/web/src/components/b-task-editor.tsx`

- 移除原来内嵌在内容区域顶部的"保存草稿"状态栏 + 按钮，改为监听 `workbench-save-draft` CustomEvent 触发保存。
- 保存状态（"已保存草稿" / "保存失败"等）改为小字提示，不再占用一整行蓝色 banner。

**改动文件**：`apps/web/src/app/dev/preview/a/page.tsx`、`apps/web/src/app/dev/preview/b/page.tsx`

- 同步更新 `WorkbenchLayout` 调用：传入 `sidebarTitle="参考材料"`，删除 `taskSubtitle` / `aiSubtitle`，更新 `taskTitle`（去掉 "(A)" / "(B)" 字母后缀）。
- 导航栏角色标签：A 页面改为"角色: 上游尽调员"，B 页面改为"角色: 投资经理"，去掉 "(A端)" / "(B端)" 字样。
- 导航栏右侧：去掉 `Session: {code}` 展示（对被试无意义），提交按钮文字统一改为"提交"。

#### 二、AI 区自动滚动到底部

**背景**：发送消息或收到 AI 回复后，对话区不会自动滚到最新消息。

**改动文件**：`apps/web/src/components/ai-chat-panel.tsx`

- 在对话列表末尾加空 `<div ref={bottomRef} />`。
- `useEffect` 监听 `messages` 和 `sending` 变化，每次变化调用 `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })`，实现平滑自动滚动。

#### 三、B 任务区重构为三模块（b-task-editor 完整重写）

**背景**：原 B 任务区是单一文本框表单，与规格要求的"结构化条目列表 + 来源标注"差距较大。

**新方案**：固定三模块结构，不可跳过。

**改动文件**：`apps/web/src/components/b-task-editor.tsx`（完整重写）

- **模块一：机会点与风险点**
  - 机会点列表 + 风险点列表，各自独立。
  - 每条为「文本输入框 + 来源下拉」一行，来源固定选项：尽调表 / 尽调备注 / 原始材料 / AI / 不确定。
  - 支持「+ 添加条目」按钮增行，「删除」按钮移除某行。
  - 实现为内部 `ItemList` 子组件，接受 `items` 数组与 `onChange` 回调。
- **模块二：投资备忘录**
  - 多行自由文本 textarea，用于整合模块一的结构化条目，形成完整分析备忘录。
- **模块三：最终建议**
  - 两个互斥单选卡片：「✅ 投资」/ 「❌ 不投资」，选中态有颜色高亮。
- **保存逻辑**：监听 `workbench-save-draft` CustomEvent（由 WorkbenchLayout 标题栏按钮触发），将三模块数据序列化为 payload 存入 `b_workspace_saved` stage，后端无需修改（已支持 JSON payload）。
- **注意**：A 任务区（`a-task-editor.tsx`）本轮不动，其结构与 A 端规格一致，维持原状。

#### 四、B 反馈页新增

**背景**：规格要求 B 提交判断后进入反馈页（Q1-Q5 单选），原来没有这个页面。

**新增文件**：`apps/web/src/components/b-feedback-form.tsx`

- Q1（必答）：是否向上游尽调员发送本次反馈？（是 / 否）
- Q2：是否愿意表达感谢或认可？（是 / 否）
- Q3：尽调表帮助程度？（非常有帮助 / 比较有帮助 / 帮助有限 / 几乎没有帮助）
- Q4：尽调表主要缺少哪类内容？（无明显缺失 / 机会信息不足 / 风险信息不足 / 机会和风险信息都不足 / 不确定）
- Q5：最主要改进建议？（信息更完整 / 重点更突出 / 备注更明确 / 证据来源更清楚 / 暂无明显改进建议）
- 所有选项用可点击卡片式单选，无文本框。
- Q1-Q5 全部作答后「提交」按钮才激活（`canSubmit` 逻辑）。
- 提交时：① 写入 `b_feedback_submitted` stage（完整五题答案）；② 若 Q1="是"，额外写入 `b_feedback_to_a` stage（含压缩后的弹窗所需字段：companyName / companyNo / helpfulness / missingContent / improvement / appreciative）。
- 提交成功后调用 `onSubmitted()` 回调，由页面层处理跳转。

**新增文件**：`apps/web/src/app/dev/preview/b-feedback/page.tsx`

- Client Component，从 URL query 读取 `code` / `company` / `no` 参数。
- 渲染 nav（角色:投资经理 + 公司名）+ `BFeedbackForm`。
- `onSubmitted` 时跳回 `/dev/preview/b?code=...`。

**改动文件**：`apps/web/src/app/dev/preview/b/page.tsx`

- 导航栏「提交」按钮改为 `<Link>` 跳转到 `/dev/preview/b-feedback?code=...&company=...&no=1`，完成 B 工作台 → 反馈页的路由接通。

#### 五、上游尽调员端反馈弹窗

**背景**：当 B 选择发送反馈（Q1="是"）时，A 端右下角应在 5 秒内收到弹窗通知，显示自然语言摘要。

**新增文件**：`apps/web/src/components/a-feedback-notification.tsx`

- Client Component，挂载后每 5s 轮询 `/experiment/session/:code/progress`，筛选 `stage === 'b_feedback_to_a'` 的条目。
- 用 `seenIds` ref 去重，避免重复弹出同一条反馈。
- `summarize()` 函数将 payload 压缩为自然语言：`"投资经理对「{公司名}」的尽调表给出了反馈：整体{帮助程度}，主要仍缺少{缺失内容}。感谢你的支持。"`
- 弹窗位置：`fixed bottom-6 right-6`，宽度 `w-72`，约为 AI 区面积的 1/3。
- 默认显示 5 秒后自动关闭（`setTimeout`），可手动点 ✕ 提前关闭；新弹窗覆盖旧弹窗（共用同一个 state，不叠加）。

**改动文件**：`apps/web/src/app/dev/preview/a/page.tsx`

- 在 `<main>` 底部挂载 `<AFeedbackNotification sessionCode={code} />`，弹窗独立于三区布局之外，`z-[100]` 确保覆盖所有面板包括副线全屏页。

### 2026-04-23（续二）· 弹窗文案简化 + 任务区初始状态修正

#### 一、A 端反馈弹窗文案简化

**背景**：原方案用 `summarize()` 函数将 Q3/Q4 答案拼接成自然语言句子，但选项本身是名词短语（如"风险信息不足"），直接拼入句子语法生硬，且拼接逻辑随选项变更容易出错。

**改动文件**：`apps/web/src/components/a-feedback-notification.tsx`

- 删除 `summarize()` 函数，不再拼句子。
- 将 state 从 `text: string` 改为 `payload: FeedbackPayload | null`，直接存整个 payload 对象。
- 弹窗渲染改为结构化标签卡片：公司名+编号、帮助程度（蓝色底）、主要缺失（灰色底）；若 Q2="是" 额外显示 `🙏 对方表达了感谢`。
- 弹窗宽度从 `w-72` 收窄到 `w-64`。

#### 二、A/B 任务区默认内容清空

**背景**：实验中被试打开工作台时任务区应是空白，原 mock 数据为演示填了大量示例文字，直接作为 `initialData` 导致被试看到"别人填好的内容"。

**改动文件**：`apps/web/src/lib/mock-experiment-data.ts`

- `mockAForm`：可编辑字段（opportunityInfo / riskInfo / otherNotes / memo）全部改为空值。
- `mockBWorkspace`：可编辑字段（opportunityItems / riskItems / investmentMemo / finalDecision）全部改为空值。

#### 三、A 任务区去掉内嵌保存按钮，提示文字移入 placeholder

**背景**：WorkbenchLayout 标题栏已统一提供「保存草稿」按钮，A 任务区内部仍有蓝色 banner + "保存 A 端草稿"按钮造成重复。指引文字放在输入框外部占位，输入后不可见，不如放入 placeholder。

**改动文件**：`apps/web/src/components/a-task-editor.tsx`

- 删除顶部蓝色 banner 和"保存 A 端草稿"按钮。
- 删除底部"最近一次 A 端保存结果"回显 block，及对应的 `lastSaved` state 和加载 useEffect。
- 机会信息 placeholder：`"建议每行一条，尽量写成可核验判断。\n例：核心客户复购率超过 80%（可核验）"`
- 风险信息 placeholder：`"优先写最伤估值和最伤执行的问题。\n例：前三大客户占收入 70%，单客户流失影响巨大"`
- 保存逻辑改为监听 `workbench-save-draft` CustomEvent，与 B 侧对齐；保存状态以小字提示形式显示。
- 备注标签文字"写给 B 的核心提示"改为"写给投资经理的核心提示"，去掉界面上的字母 B。

### 2026-04-23（续三）· 实验全流程串联改造

#### 一、数据库改造

- `Participant` 新增 `phone: String? @unique` 字段；被试名单不再单独建表，直接用 Participant.phone 承载
- 新增 `Company` 模型：存储实验任务材料（name / roundLabel / sector / tags / summary / materials / sortOrder）
- 新增 `TaskAssignment` 模型：sessionId + companyId + sortOrder + aSubmittedAt? + bCompletedAt?，记录任务派单与进度
- `Session` 新增 `tasks TaskAssignment[]` 关系
- 执行 `prisma db push --accept-data-loss` 同步到本地数据库
- 新增 `prisma/seed.ts`：预置 AAA→A、BBB→B 两个测试账号 + 两家测试公司（星衡智能制造、云垒医疗科技）

#### 二、后端新增模块

- **AuthModule**（`apps/server/src/auth/`）：`POST /auth/login` 接收 phone，查 Participant；未找到返 403；找到后自动配对 session（A 创建 WAITING session，B 加入并置 MATCHED，MATCHED 时自动按 Company.sortOrder 建 TaskAssignment）
- **AdminModule**（`apps/server/src/admin/`）：`GET/POST /admin/participants`（被试名单查询/批量 upsert）、`GET/POST /admin/companies`（材料 CRUD）、`POST /admin/session/:code/init-tasks`（手动重置派单）
- **ExperimentModule 扩展**：新增 `GET /experiment/session/:code/tasks`、`POST /tasks/:taskId/a-submit`（设 aSubmittedAt，写 task_progress）、`POST /tasks/:taskId/b-complete`（设 bCompletedAt，返回 allDone）
- `app.module.ts` 注册 AuthModule、AdminModule

#### 三、前端正式流程路由（全新）

全部对齐 `index.html` UI 风格（`#f0f2f5` 背景、白色 rounded-xl 卡片、52px nav、`#1e80ff` 主蓝）

- **`/login`**：手机号输入，POST /auth/login，成功后存 sessionStorage（participantId / role / sessionCode），跳 `/waiting-room`
- **`/waiting-room`**（重写）：从 sessionStorage 读 code，每 3s 轮询 session 状态，MATCHED 后跳 `/instruction`；去除所有手动输入 code / 选角色调试 UI
- **`/instruction`**（重写）：Client Component，从 sessionStorage 读 role，展示角色专属指导语卡片；"开始实验"→ A 跳 `/workspace/a`，B 跳 `/workspace/b-waiting`
- **`/workspace/a`**：从 API 拉真实任务列表，展示当前未提交任务的 Company 材料；提交调 a-submit，自动切下一任务
- **`/workspace/b-waiting`**：每 3s 轮询 tasks，检测到有 aSubmittedAt 且 bCompletedAt 为 null 的任务 → 跳 `/workspace/b?taskId=...`；全部完成 → 跳 `/workspace/end`
- **`/workspace/b`**：从 taskId 取公司数据 + 查最后一条 `a_form_saved` 作为 A 的尽调表；提交 → 跳 `/workspace/b-feedback?taskId=...`
- **`/workspace/b-feedback`**：与现有 BFeedbackForm 逻辑一致，提交后调 b-complete，跳回 b-waiting
- **`/workspace/end`**：写 experiment_completed，展示实验结束感谢页
- **`/`**：直接 redirect 到 `/login`（旧首页改为跳转）

#### 四、Admin 界面重构（`/dev/session-inspector`）

- 改为 Client Component，左侧 `w-48` 固定导航（Session 概览 / 被试名单 / 实验材料 / 副线调度），右侧内容区
- **Session 概览**：输入 code 查询 session 状态 + 任务派单表（A/B 进度标签）+ progress 列表；支持手动触发重置派单
- **被试名单**：手动添加（phone + 角色选择）+ CSV 文件上传批量导入 + 当前名单列表
- **实验材料**：简易新建公司表单 + 公司列表（按 sortOrder 排序）
- **副线调度**：复用现有 AdminSidefeedPanel

#### 五、规格文档更新

- `FRONTEND_GUIDELINES.md` 新增"UI 风格规范"章节（第 10 节）：颜色系统、字体、Nav 栏、白色卡片、输入框、按钮、等待动画、管理后台布局规范

#### 六、废弃/修正说明

- 确认不再单独建 SubjectEntry 表，被试名单直接存 Participant.phone（登录凭据）
- 旧的 waiting-room 手动配对流程作废，仅 `/dev/preview/*` 保留调试用

### 2026-04-23（续四）· 配对竞态修复 + auth.service.ts 去重

#### 一、问题复现

验收时发现：A 登录后停在等候室，B 登录后成功匹配，但 A 仍停留在"正在等待配对中"。

根因：数据库中残留了旧测试跑产生的 WAITING session（由旧代码以 `inspector-a`、`preview-a` 等昵称创建）。B 的匹配查询使用 `orderBy: { createdAt: 'asc' }`，会优先命中最旧的 session —— 即那些残留 session，而不是 A 刚刚创建的 PKKYLJ session。结果 B 与一个孤立 session 配对，A 的 session 永远等不到 B。

#### 二、修复方案

**放弃时间过滤（2小时窗口）**，改用数据库事务级隔离保证原子性：

- `auth.service.ts` 的匹配事务升级为 `Prisma.TransactionIsolationLevel.Serializable`
- 并发多个 B 登录时，PostgreSQL 序列化隔离确保同一个 WAITING session 只能被一个 B 抢到；另一个 B 的事务会自动重试
- 额外加双重检查：在 `pairing.update` 前再次确认 `participantBId === null`，若已被占用则抛 `P2034` 触发重试

**新增管理员清场能力**（解决跨次运行数据污染）：

- `AdminService.clearSessions()`：删除所有 taskProgress / taskAssignment / pairing / session 数据
- `POST /admin/clear-sessions` 接口
- Session Inspector "Sessions 概览" tab 新增红色**"清空全部数据"**按钮（带 confirm 弹窗），每次实验开始前点击一次

#### 三、文件修正

- `apps/server/src/auth/auth.service.ts`：移除因上下文截断产生的重复类定义（文件末尾多出一个旧版 `AuthService`），保留仅含 Serializable 事务的正确版本

### 2026-04-23（续五）· 工作台 Bug 修复 + 管理后台增强

#### 一、全屏切换导致任务区内容清空（致命 Bug）

**根因**：`WorkbenchLayout` 用 `{showTask ? <section>...</section> : null}` 条件渲染三个面板；切换到"AI全屏"或"材料全屏"时，任务区组件被卸载，重新挂载后从 `initialData`（空数组）重新初始化，填写内容全部丢失。

**修复**：将三个面板的条件渲染改为 CSS `display: none / undefined`（始终挂载，不卸载）。切换全屏仅控制视觉显隐，React 组件状态完整保留。

**改动文件**：`apps/web/src/components/workbench-layout.tsx`

#### 二、保存草稿按钮视觉反馈

**新行为**：

- 初始状态：灰色"保存草稿"
- 内容有修改时：广播 `workbench-draft-dirty` 事件 → 按钮变灰色边框"保存草稿"
- 点击保存且后端返回 ok：广播 `workbench-draft-saved` 事件 → 按钮变绿色"已保存 ✓"
- 再次修改内容：再次广播 dirty → 按钮回灰，提示需重新保存

**改动文件**：

- `workbench-layout.tsx`：监听 `workbench-draft-saved / dirty` 事件，更新按钮样式
- `a-task-editor.tsx`：每个 textarea onChange 时广播 dirty；保存成功广播 saved
- `b-task-editor.tsx`：ItemList 的 update/add/remove、investmentMemo、finalDecision 改动时均广播 dirty；保存成功广播 saved

#### 三、A 工作台全部提交后跳转实验结束页

**旧行为**：显示"所有尽调任务已提交，请等待实验结束通知，您可继续使用 AI 助手"静态卡片，永远停在此页。

**新行为**：检测到 `allDone` 时直接 `router.replace('/workspace/end')`，A 与 B 同步进入实验结束页。"您可继续使用 AI 助手"措辞已去除（实验已结束，不合适）。

**改动文件**：`apps/web/src/app/workspace/a/page.tsx`

#### 四、管理后台 Session 概览增强

**旧行为**：需要手动输入 Session Code 才能查到数据，页面打开时一片空白。

**新行为**：

- 页面加载时自动拉取 `GET /admin/sessions`，展示所有 Session 列表（Code / 状态 / A电话 / B电话 / 任务完成进度）
- 点击列表行可展开该 Session 的任务派单 + Progress 记录
- 保留按 Code 手动搜索功能
- 新增**"导出全部数据"**按钮：调用 `GET /admin/export`，下载包含所有 session / task / progress 的 JSON 文件（文件名含日期）

**后端新增接口**：

- `GET /admin/sessions`：返回所有 session（含 pairings / tasks / 配对参与者信息）
- `GET /admin/export`：返回完整实验数据 JSON（含 session / task / progress / company / participant 信息）

**改动文件**：

- `apps/server/src/admin/admin.service.ts`：新增 `getSessions()` 和 `exportData()`
- `apps/server/src/admin/admin.controller.ts`：新增 `GET /admin/sessions` 和 `GET /admin/export`
- `apps/web/src/app/dev/session-inspector/page.tsx`：SessionsTab 完整重写，自动列表 + 导出按钮

### 2026-05-12

- 回读 `README.md`、`03_tracking/progress.md`、项目规则与手工验收手册，重新同步当前续做上下文。
- 先做构建级基线验证：`server build` 通过，`web build` 初次失败并定位到 `/dev/preview/b-feedback` 的 `useSearchParams()` 未包裹 `Suspense`。
- 已修复 `apps/web/src/app/dev/preview/b-feedback/page.tsx`，将 query 读取逻辑下沉到内部组件并补 `Suspense` 包裹。
- 复跑 `corepack pnpm --filter web build` 已通过，说明当前前后端至少在构建层面重新恢复到可交付状态。
- 额外确认：当前目录本身还不是 git repo，后续若要正式留版本历史，需要明确该项目的仓库初始化/挂载方式。
- 已按“安全换名”方案把管理员入口正式收口到 `/admin`，并保留 `/dev/session-inspector` → `/admin` 的兼容跳转，避免旧链接直接失效。
- 已同步更新 `README.md` 与 `02_specs/00_overview/APP_FLOW.md` 的页面路由认知，当前主流程页面集合重新明确为 `/login`、`/waiting-room`、`/instruction`、`/workspace/a`、`/workspace/b-waiting`、`/workspace/b`、`/workspace/b-feedback`、`/workspace/end`、`/admin`。
- 已完成管理员路由换名后的构建验证：`web build`、`server build` 均通过；前端页面直连验收中 `/login`、`/waiting-room`、`/instruction`、`/workspace/a`、`/workspace/b-waiting`、`/workspace/b`、`/workspace/b-feedback`、`/workspace/end`、`/admin` 均返回 200，旧地址 `/dev/session-inspector` 返回 307 并跳转到 `/admin`。
- 本轮全流程运行级验收暂时卡在本机环境：`dev:local` 拉起时 Docker daemon 未启动，PostgreSQL 容器未能起来，导致后端 `localhost:3001` 未成功监听，后续需先恢复 Docker 后再继续验配对 / 登录 / 派单 / 提交闭环。
- 2026-05-12 晚在 Docker 恢复后完成一轮干净验收：先 `POST /admin/clear-sessions` 清空旧 session，再用种子账号 `AAA`（A）与 `BBB`（B）重新登录，确认两端自动配对到同一 session，且自动生成 2 条任务派单。
- 已实际打通主链路：`/auth/login` → 配对 → `GET /experiment/session/:code/tasks` → A 提交第 1/2 家 → B 完成第 1/2 家，第二次 `b-complete` 返回 `allDone: true`。
- 已确认任务与日志写入正常：两条任务的 `aSubmittedAt` / `bCompletedAt` 都成功落库，`progress` 中可看到 `a_task_submitted` 与 `b_task_completed` 四条记录。
- 本轮验收发现一个后续收口点：虽然任务已全部完成、`allDone` 已返回 true，但 session 总状态仍停留在 `MATCHED`，后台概览不会自动反映“已完成”；后续应决定是把其更新为 `COMPLETED`，还是明确说明 session.status 不承担完成态语义。
- 已按“最小收口”方案补齐完成态：最后一个 B 任务完成时，后端会把 session.status 同步更新为 `COMPLETED`，让 `/experiment/session/:code`、`/experiment/session/:code/progress` 与 `/admin/sessions` 的状态语义重新一致。
- 已同步更新 `02_specs/03_execution/CHECKLIST_MANUAL.md`，把手工验收认知从“验证到 MATCHED”为止补成“任务全完成后应看到 `status: COMPLETED`”。
- 已根据新共识重写 `02_specs/00_overview/APP_FLOW.md`，把被试角色改为按进入顺序自动分 A/B、正式流程改为 3 个工作段 + 2 个休息问卷段，并同步收口 B 空窗态工作台与副线逐题式交互。
- 已同步更新 `PRD.md`、`VARIABLES.md`、`BACKEND_STRUCTURE.md`、`A_B_WORKBENCH_UI.md`、`FRONTEND_GUIDELINES.md`、`SIDETASK_PANEL_SPEC.md`、`IMPLEMENTATION_PLAN.md`，先把规格层对齐到新版本，再进入后续代码实现。
### 2026-05-12（续）· 第二轮规格重构收口

- 已按最新会议结论重写 `APP_FLOW.md`，正式确认主流程为：登录 → 自动配对 → 指导语 → 测试轮 → 3 个正式工作段与 2 个休息问卷段 → 结束。
- 已明确被试不再预设 `A/B`，admin 只上传合格手机号；系统按进入顺序自动分配奇数位 `A`、偶数位 `B` 并相邻配对。
- 已明确一组 `A/B` 共享同一条 session 内随机、无放回的固定公司顺序；`B` 不必等 5 分钟后才开始做，但必须等 A 信息解锁且明确打开过 A 信息区后才能提交。
- 已把顶栏倒计时口径改成前台可见，并统一到主工作台、测试轮页、休息问卷页、副线展开页；A 端额外显示当前公司的 5 分钟倒计时。
- 已把副线顶部入口改成“待处理事宜”+“您有新事项入库，请尽快处理”，并确认滚动方向为从右往左、滚完等待 30 秒后再次滚动；“待处理事宜”和滚动消息都可点击进入副线展开页。
- 已把副线展开页收口为复用主工作台布局：左材料、右上答题、右下 AI；题目切换 UX 改为选择后给反馈，但不自动跳题，通过“上一题 / 下一题”切换。
- 已在 `PRD.md`、`VARIABLES.md`、`BACKEND_STRUCTURE.md`、`A_B_WORKBENCH_UI.md`、`FRONTEND_GUIDELINES.md`、`SIDETASK_PANEL_SPEC.md`、`IMPLEMENTATION_PLAN.md` 中同步写入测试轮、3 工作段 / 2 问卷休息段、A 单公司 5 分钟、B 无独立等待页、AI 按工作段分级、`P01 + 两份正式表单` 等最新口径。
- 已再次确认本轮暂缓 `截图` 功能，不把它写入当前代码范围与接口范围。
- 下一步代码实施顺序继续保持为 6 个包：后台与配置地基 → 自动配对与统一运行态 → 主线工作流重写 → 测试轮与段引擎 → 副线工作台与 AI 双上下文 → 真实材料与正式表单。

### 2026-05-13

- 完成第二轮代码重构的主实现，后端已落地：Prisma schema 扩展到 ExperimentConfig、SessionSegmentState、TaskSnapshot、QuestionnaireTemplate/Response、AiMessageLog、SideTaskResponseLog，并补齐 TaskAssignment 的 phase / sequence / A 5分钟 / B 查看门槛相关字段。
- 后端行为已切换到新实验模型：手机号白名单登录、按进入顺序自动分配 A/B、同组共享随机无放回公司顺序、统一 GET /experiment/session/:code/runtime 轮询接口、practice / formal_work / formal_break / end 阶段推进、A 提交解锁、B 的 view-a-info 查看门槛、b-complete 完成闭环、AI 持久上下文接口。
- 前端已完成主链路重写并通过构建：/admin、/instruction、/practice、/break、/waiting-room、/workspace/a、/workspace/b、/workspace/b-feedback、/workspace/b-waiting，同时补了新的 session-topbar、新版 ai-chat-panel、新版 sidetask-strip、新版 A/B 编辑器与材料面板接线。
- admin 已切到 phone-only 名单与 experiment-config 结构；工作段时长、休息段时长、3 个工作段 AI 等级、单选问卷模板都能通过后台接口读取与保存。
- 材料接入已按“静态预处理入库”跑通：seed 会写入 P01 两家公司样本与 txt/docx/pdf 混合材料元数据，前端材料区可按 overview + 各材料 tab 展示。
- 构建验证已通过：corepack pnpm --filter server build、corepack pnpm --filter web build 均成功。
- 数据库与本地环境验证已完成：docker compose 成功拉起 PostgreSQL，prisma db push --force-reset 完成 schema 同步，prisma:seed 成功写入 participants / config / questionnaire / companies；dev:local 已启动前后端，本地端口确认 http://localhost:3000/login 返回 200，http://localhost:3001 后端接口可正常响应。
- 运行级接口验收已走通一轮主链路：
  - AAA / BBB 登录后自动配对到同一 session 809F7U，A/B 共享相同 currentTask 与 sequenceIndex。
  - start-practice / complete-practice 后，runtime 进入 formal_work，A 侧出现单公司倒计时，B 侧 aInfoUnlocked=false、bCanSubmit=false。
  - A 调用 a-submit 后，TaskAssignment.aSubmittedAt / aUnlockedForBAt 正常落库。
  - B 在查看前调用 b-complete 返回 400；调用 view-a-info 后，bViewedAInfoAt / bCanSubmitAt 落库，再次 b-complete 成功，说明“先查看 A 信息再允许完成”的门槛生效。
  - GET /admin/export 可导出 session / segmentStates / tasks / progresses 等数据，已确认主线任务元数据写入。
- 阶段引擎也做了加速验收：临时把 work/break 改成 1 分钟后，用 CCC / DDD 跑到 session 871JNU，确认 runtime 自动切到 formal_break 且返回问卷模板；提交问卷后 break 记录入库。随后已将默认配置恢复回 20 / 5，并重新 seed 保证默认中文问卷文案正常。
- AI 接口验证：POST /ai/chat 在 provider 模式可返回回复，GET /ai/history 能按 main context 取回同一上下文下的 user / assistant 记录，说明主线 AI 持久化链路已接通。
- 已对照 `C:\Users\ASUS\Desktop\PLAN.md` 与 `PLAN2.md` 做第二轮计划核账：主链路重构目标已基本落地，包括 auto A/B、统一 runtime、practice + formal_work + formal_break、B 无独立等待流程、顶栏倒计时、admin phone-only、experiment-config、P01 静态材料、AI 持久上下文与本地跑通验证；明确仍未完全收口的是 A/B 正式表单尚未按两份终版 docx 做逐字段 1:1 复刻，副线正式题库/材料与分析元数据则按约定暂缓。
- 已再次确认 `/workspace/b-waiting` 现仅作为兼容跳转页存在，不再承担正式实验流程职责。
- 本轮已读取 `A端尽调表_参与者可见版v2.docx` 与 `B端投资判断表_参与者可见版.docx`，并把 A/B 主工作台编辑器改成贴近终版结构：A 侧包含公司信息、6 个基础数值字段、8 份材料线索记录与交接备注；B 侧包含来源说明、机会/风险枚举、综合判断、最终投资建议与 1-5 信心。
- 已同步更新 B 查看 A 信息区的摘要展示，使其能按新的 A 草稿结构读取基础指标、材料线索与交接备注。
- 已重写 `02_specs/03_execution/CHECKLIST_MANUAL.md`，使其改为当前真实验收口径，不再把旧的 `/dev/preview` 页面与旧式 B waiting 流程当作主验收路径。
- 已把 admin 的 Session 面板能力补回当前版本：重新加入“导出全部数据”“清空全部实验数据”两个按钮，并在选中 session 后恢复“重置当前 Session 派单”操作；前端构建已再次通过。
- 已修复 practice / break / workspace/a / workspace/b / workspace/b-feedback 中“render 阶段直接 router.replace”导致的 Router console error，统一改为 `useEffect` 触发跳转；同时把 WorkbenchLayout 与 MaterialTabs 的默认压缩策略收回到 `min-w-0 + tab 不换行横向滚动 + 左侧默认 42%`，用于缓解材料区与右侧工作台被挤乱的问题。web/server build 已再次通过。
- 已进一步修 B 页任务区布局：把“B 的 A 信息摘要 + B 正式表单”改成同一滚动容器，避免上下分段争高导致的大块空白；同时为材料区 tab 条补上显式左右滚动按钮，确保材料数量较多时可以直接向右切换。构建再次通过。
- 当前残留说明：这轮重点先把“新实验模型 + 统一 runtime + 主链路可跑”打通；副线题库内容目前仍是按工作段生成的占位样本，A/B 正式表单虽然已完成结构级重构，但仍建议下一轮继续做字段细节、文案和版式上的 1:1 精修。

### 2026-05-22

- 已修复 B 角色工作台被浏览器级横向/纵向滚动打穿的问题：`/workspace/b` 外层改为固定视口容器，并将 AI 面板自动滚动限制在消息列表内部；`web build` 已通过。
- 已按最新流程认知修正工作段 / 休息段衔接与 B 端 UI：修复 break 与 B 页 hooks 顺序错误，休息问卷提交后进入等待态，B 的 A 端反馈改为材料区 `尽调员信息` tab 并恢复提交门槛，副线滚动恢复“左移-停留-淡出-间隔”节奏，副线展开页补轻量转场；`APP_FLOW.md` 与 `FRONTEND_GUIDELINES.md` 已同步更新，`web build` 与 `server build` 已通过。
- 已修 admin 被试名单旧角色显示与接口失败崩页问题：名单页改为只展示“准入令牌”，清空实验数据时同步重置 participant 临时 role 字段，Session / 名单加载失败改为页面内提示；`web build` 与 `server build` 已通过。
- 已重新修正副线顶部滚动文案动画：放弃右侧负偏移与复杂 transform 估算，改为 `left: 100% -> left: 0 -> 停留 -> 淡出` 的确定性实现；`web build` 已通过。
- 已定位并修复 A/B 答题区“填写其他内容时前面被清零”的根因：问题不是冻结逻辑，而是 runtime 轮询刷新时 `initialData` 被反复灌回编辑器；现改为仅在切换任务时或本地未脏时接受外部草稿，同时保存成功后再解除 dirty 态，A/B 编辑器均已同步修复；`web build` 已通过。
### 2026-05-23

- 已把主线 `runtime` 与任务草稿正式拆开：`GET /experiment/session/:code/runtime` 不再返回 `aDraft / bDraft / bFeedbackDraft`，新增 `GET /experiment/session/:code/tasks/:taskId/draft?role=&section=` 独立草稿读取接口；前端 A/B 工作台与 B 端材料区里的“尽调员信息”都改为按当前 `taskId` 单独加载草稿，避免运行态刷新把本地编辑态覆盖回去。
- 已把前端原来的 5 秒 `runtime/progress` 轮询收口为 SSE：新增 `GET /experiment/session/:code/events?participantId=`，`useSessionRuntime()` 改为“首次拉取 runtime + EventSource 持续接收 runtime snapshot / b_feedback_to_a / a_task_submitted / b_task_completed 等事件”；A 端反馈弹窗也已改成吃同一条事件流。
- 当前时间边界推进仍保留 server-side sync：SSE 连接内每 2 秒触发一次运行态同步，用来保证 `formal_work / formal_break` 切段、A 的 5 分钟自动提交解锁等时间驱动逻辑继续自动生效，但浏览器端已经不再自己做 5 秒 fetch 轮询。
- 已完成构建验证：`corepack pnpm --filter server build` 与 `corepack pnpm --filter web build` 均通过，说明这轮 runtime/draft/SSE 结构调整在构建层面已稳定。
- 已修复副线顶部传送带"您有新事项入库，请尽快处理"滚动动画不显示的问题，最终方案为 `useRef` 直接操作 DOM + `requestAnimationFrame` 逐帧驱动，彻底绕开 CSS 动画；`web build` 已通过。
- 已把“工作段中断恢复”从零散草稿保存升级为统一快照链路：`TaskSnapshot` 新增 `scope / role / section / segmentIndex / restoreSourceSnapshotId / takenReason / schemaVersion` 等通用字段，工作段结束前服务端会为尽调员主表、投资经理主表、投资经理反馈表分别写入 `work_segment_freeze` 快照，并在下一工作段开始时按最近一次有效冻结快照自动恢复到当前草稿，避免未手动点击保存时跨段内容丢失；`GET /experiment/session/:code/tasks/:taskId/snapshots` 与 `POST /experiment/session/:code/tasks/:taskId/restore-latest` 也已补齐。
- 已把管理端材料能力升级为可持续运营的通用后台：`Company` 新增 `researchProfile` 与 `autoFillSourceMaterialId`，后端新增 `admin/materials.ts` 材料服务层，支持公司新建/编辑、材料上传/替换/删除、顺序调整、自动填充源指定、解析状态回传与 `P01` 基线材料一键导入；同时把旧 seed 里的占位公司从默认流程里移除，后续新 session 只会分配真实可用材料公司。
- 已完成材料区混合阅读器落地并做浏览器级实测：前端 `company-material-panel` 现按文件类型切换 `txt` 原生阅读、`docx-preview`、`react-pdf + pdfjs-dist`、`xlsx` 只读表格视图；同时修复了跨端口静态材料 CORS、Word 预览宿主节点未挂载导致的假加载、相对路径材料地址无法读取等问题。基于 `P01` 已实测通过 `txt / docx / pdf` 阅读，临时上传过一份 `xlsx` 样例验证表格 reader 后已删除，不污染正式材料集。
- 已重写 `/admin` 的“材料管理”页为直接可用版本：可查看公司、编辑基础信息、上传/替换文件、上移/下移排序、设置自动填充源、删除材料，并在右侧即时预览材料显示效果；当前后台只暴露真实可用公司，避免历史占位公司继续误入实验派单。
- 已把 `00_start_materials/原始材料/P01/0.信息点记录（研究者用）.txt` 接入为自动填充源解析层，当前可稳定抽取 `公司编号 / 行业 / 公司简称/匿名代号 / 业务简介`，并在尽调员与投资经理答题区头部直接显示系统填充结果。
- 已继续清理参与者端可见文案：去掉答题区标题里的 `A.1 / A.2 / A.3` 内部编号，等待页不再展示 `Session Code`，休息问卷页将 `Break Questionnaire` 改为中文口径；参与者端保留“尽调员 / 投资经理”表述，但不再向被试暴露内部 A/B 字母角色。
- 已新增总方案文档 `02_specs/01_frontend/WORKBENCH_REFINEMENT_MASTER.md`，按“材料区 / 答题区 / AI 区 / 后端上传与数据记录”四章收口当前实现与后续扩展口，作为这一轮主界面精修与数据冻结的统一说明。
- 已继续精修材料区阅读器交互：`txt / docx / xlsx` 统一补上自适应适配宽度、居中显示、工具条缩放按钮与 `Ctrl +/-/0` 缩放快捷键；PDF 阅读器改为按容器宽度自适应分页渲染，同样支持 `Ctrl +/-/0` 缩放，并关闭 text layer / annotation layer，避免未样式化文本层在页面下方形成“伪 OCR 文本”堆叠。
- 已补登录后全屏偏好：登录成功前先记录 `exp_prefer_fullscreen` 并尝试进入浏览器全屏，主工作台顶部通过 `useExperimentFullscreen()` 持续维护全屏状态，同时增加 `Shift + Esc` 退出全屏快捷键，便于正式实验时获得更完整的沉浸式视口。
- 已继续优化材料区默认缩放体验：阅读器默认手动缩放基线提高到更接近“填满材料区”的口径，`txt / docx / xlsx / pdf` 初始进入时都会更偏向大字号、居中、尽量占满当前阅读区，而不是偏保守地缩在中间。
- 已在参与者端彻底隐藏研究者材料：像 `0.信息点记录（研究者用）.txt` 这类包含标准答案和评分信息的文件，仍保留给 admin 与自动填充层使用，但不再出现在实验参与者材料区中。
- 已根据两份 Word 真相源继续把主线答题区往 1:1 收口：A 表改回“基础数值摘录区 3 列结构 + 材料线索记录区 30 字证据片段 + 可选交接备注”口径；B 表把来源选项统一为 `自有材料 / 上游尽调信息 / 上游备注 / 上游材料`，并把“重要机会 / 重要风险 / 综合判断 ≤120字 / 最终建议与信心”的结构重新对齐到 Word 终版。
### 2026-05-23（续）

- 已完成题库目录自动识别链路：后端新增 `scanCaseLibrary()`，默认扫描 `00_start_materials/原始材料/` 下的每个案例子目录；若存在 `participant/` 与 `research/` 子目录，则优先按目录分流参与者材料与研究者材料；若没有分层目录，则按文件名中的 `研究者用 / 信息点记录 / 答案 / research` 自动判断研究者材料。admin 新增“自动导入题库目录”按钮与扫描概览，可直接导入本地题库并生成公司与材料记录。
- 已把题库自动导入做成“目录约定 + admin 微调”的混合方案：支持可选 `case.json`，可指定 `caseCode / companyName / roundLabel / sector / summary / tags / participantDir / researchDir / autoFillSource / sortOrder`；导入时会把文件元数据写入材料 `metadata`，包括 `audience / importRelativePath / importedFromLibrary`，为后续扩展评分、版本和多案例批量维护留口。
- 已新增 [02_specs/02_backend/admin材料库上传手册.md]，把推荐文件夹结构、`case.json` 示例、自动识别规则、研究者材料隔离规则、兼容旧结构与最佳实践全部写清楚，后续新增案例可直接按手册组织目录再到 admin 一键导入。
- 已重写 README 根目录说明，补成“模块地图”版本：现在可以从 README 直接看懂参与者实验主流程、统一运行态与阶段引擎、主工作台三区、统一草稿/快照/恢复系统、admin 管理后台、题库与材料系统、AI 上下文系统分别由哪些目录和关键文件负责。
- 已把 A 端与 B 端答题区进一步改成更接近 Word 文档的表现形式：去掉大块卡片式表单壳子，改为文档式标题、说明文字与边框表格；A 表现在包含“公司信息 / A.1 基础数值摘录区 / A.2 材料线索记录区 / A.3 给投资经理的总体交接备注”完整结构，B 表现在包含“填写说明 / 来源选项说明 / 公司信息 / 重要机会 / 重要风险 / 综合判断 / 最终投资建议”完整结构，并保持自动保存、草稿同步与快照恢复链路不变。
- 已完成构建验证：`corepack pnpm --filter web build` 与 `corepack pnpm --filter server build` 均通过，说明本轮题库自动导入、README/手册与答题区文档化重构在代码层面已稳定落地。
- 已把材料区 PDF 阅读器从单页翻页模式改为连续滚动模式：去掉底部翻页按钮，改为所有页面纵向堆叠、自然滚动阅读；新增 `LazyPdfPage` 子组件，用 `IntersectionObserver`（`rootMargin: 400px`）实现懒加载，避免大 PDF 同时渲染全部页面；标题栏右侧实时显示当前可见页码；缩放能力（`Ctrl +/-/0` 和按钮）保持不变；`web build` 已通过。
- 已新增材料区截图能力：主工作台材料区标题栏新增“截图”按钮，点击后进入框选模式，支持拖拽选择区域、松开后自动复制到剪贴板，并用弱提示反馈复制结果；实现上采用浏览器端按需加载 `html2canvas` 脚本，对材料区面板做局部截图并裁切选区，同时通过 `ignoreElements` 避免把截图遮罩和提示层一并截进去。
- 已把缩放逻辑改成局部接管：新增 `useScopedZoom()` 与 `ScopedZoomSurface`，当鼠标悬停或焦点位于材料区时，`Ctrl +/-/0` 与 `Ctrl + 滚轮` 只缩放材料阅读器；当鼠标悬停或焦点位于答题区时，只缩放答题区文档表单，不再误触发浏览器整页缩放；鼠标不在这两个区域时，浏览器默认缩放行为保持不变。
- 已对答题区局部缩放采取保守实现：使用外层文档容器 `zoom + width 反算` 的方式缩放 A/B 表单，尽量不侵入输入框内部逻辑，不改动草稿保存、快照恢复与输入事件链路，优先保证输入手感稳定。
- 已修正局部缩放与浏览器整页缩放的边界：缩放接管现在只依赖鼠标是否真正悬停在材料区 / 答题区 / AI 区，不再因为输入框焦点残留而持续拦截浏览器默认缩放；同时主线 AI 面板也接入了同一套局部缩放壳子。
- 已给截图链路补上超时保护与预加载：首次进入页面会空闲预热截图脚本，真正截图时分别对脚本加载、DOM 渲染、图片导出、剪贴板写入加超时兜底，避免界面永久卡在“正在复制截图...”状态。
- 已继续增强截图复制失败时的兜底行为：材料区截图现在优先尝试现代图片剪贴板写入，其次尝试兼容复制；若浏览器仍拒绝写入，则自动降级为下载 PNG，并给出“浏览器限制了直接复制，已改为下载 PNG”的弱提示，同时把真实错误写入控制台便于后续排查。
- 本轮构建验证已通过：`corepack pnpm --filter web build`、`corepack pnpm --filter server build` 均成功。
- 已修复截图功能报错"Attempting to parse an unsupported color function lab"的问题：根因是 `html2canvas@1.4.1` 的内部颜色解析器不支持 CSS Color Level 4 的 `lab()` / `oklch()` 函数（由 Tailwind v4 生成），解析时直接抛异常导致截图失败；解决方案为把截图库从 `html2canvas`（CDN 动态加载）替换为 `modern-screenshot`（npm 包，原生支持现代 CSS 颜色），移除了旧的 CDN 脚本加载、预热逻辑和 `Window` 全局类型声明，改用 `domToBlob` API 直接生成截图 Blob；`web build` 已通过。
- 已为 AI 区输入框补上粘贴图片能力：textarea 新增 `onPaste` 处理器，拦截剪贴板中的图片数据（`clipboardData.items` 中 `type.startsWith('image/')` 的项），读取为 data URL 后直接加入附件列表；`handleFiles` 签名从 `FileList | null` 扩展为 `FileList | File[] | null` 以兼容粘贴场景；placeholder 文案同步更新为"输入问题，或上传/粘贴图片让 AI 辅助分析..."；输入框上方新增附件预览区，支持 hover 删除；`web build` 已通过。

### 2026-05-24

- 已完成 AI 图片压缩与上下文管理全套改造：前端 `ai-chat-panel.tsx` 接入 `browser-image-compression`，上传/粘贴图片时自动压缩到 ≤200KB、≤1024px 再发送，解决 413 Request Entity Too Large 问题；后端 `main.ts` 添加 `json({ limit: '10mb' })` body 限制；数据库新增 `AiSettings` 模型，Basic 和 Advanced 各自独立配置 Base URL / Model / API Key / 上下文条数；`ai.service.ts` 改为从数据库读取配置（DB 为空时回退 `.env`），历史消息构建时只取 `content` 字段（纯文本），base64 图片存在 `attachments` 字段不发送给 API，自然实现上下文裁剪；后端新增 `GET/POST /admin/ai-settings` 端点（API Key 脱敏显示，保存时跳过掩码值）；Admin 前端新增"AI 参数"tab，两个独立卡片分别配置 Basic/Advanced，含 Base URL、Model、API Key（带显示/隐藏切换）、上下文条数；`web build` 与 `server build` 已通过。
- 已统一副线滚动口径为“滚到左端后停留 5 秒，再淡出，再等待 30 秒重播”，并同步修正 `SIDETASK_PANEL_SPEC.md`。
- 已将 `apps/web/README.md` 与 `apps/server/README.md` 从脚手架默认内容改为项目真实说明，便于后续接手时快速定位前后端职责与关键入口。
- 已在项目根目录初始化本地 Git 仓库、创建 `.gitignore`，后续可以直接使用 `git status / git diff / git commit` 做本地版本管理。


### 2026-05-27

- 已将 AI 模型从 DeepSeek 切换到阿里云千问：基础版 `qwen-turbo`（纯文本，上下文 10 条），高级版 `qwen3.6-plus`（多模态，上下文 30 条）；`.env` fallback 已更新，数据库 AiSettings 已通过 admin 面板与 API 同步。
- 已修复 A 端提交逻辑：A 不能在 5 分钟窗口内提前提交，必须等到时间到由系统自动提交；`aSubmitTask` 新增 `aDeadlineAt` 校验，前端提交按钮在倒计时期间禁用。
- 已修复 B 端提交逻辑：A 信息解锁后 B 无需点开"尽调员信息"即可提交，移除 `bViewedAInfoAt` 门槛检查；`bCanSubmit` 改为基于 `aUnlockedForBAt` 判断；前端移除中间引导态和 `viewingDiligenceInfo` 状态。
- 已同步更新 `APP_FLOW.md` 的 A/B 端规则描述。
- 已继续清理规格冲突：同步修正 `PRD.md`、`VARIABLES.md`、`A_B_WORKBENCH_UI.md`、`BACKEND_STRUCTURE.md`、`IMPLEMENTATION_PLAN.md`、`CHECKLIST_MANUAL.md`，统一为"B 点开 A 信息区只做记录，不再作为提交门槛"。
- `web build` 与 `server build` 已通过。


### 2026-05-27（补记）<!-- 以下段落从 Codex 乱码恢复，如有出入以实际代码为准 -->

- 已将 5 月 27 日的流程改动统一回写到 `02_specs/00_overview/APP_FLOW.md`，当前流程为：先按进入顺序成组配对，再在等待室随机分配角色，再用 seed 随机化公司顺序，再指导语和练习段，然后一道同步准备屏障，正式段 A/B 同时起跑。
- 已选"练习段和正式段同步准备"页面，接入"正式段同步起跑"核心机制：`practice_ready / formal_ready` 双方都已点击准备才会进入 `/ready`，双方都完成后统一进入下一阶段。
- 已将 A 端人工提交改为"5 分钟内不能提前提交，5 分钟到由系统自动提交"；前端 A 页面显示为"5分钟后系统自动提交"，手动提交按钮在倒计时期间禁用。
- 已将 B 端"尽调员信息"改成三态标签：未解锁时显示灰色，已解锁未查看时显示"查看尽调员信息"，已查看后记录 `bViewedAInfoAt` 并展示正式内容。
- 修正等待室逻辑：第一位参与者进入等待室数据不确认角色，第二位参与者加入后系统自动分配角色，再跳转到指导语页面。
- 已开始把随机化正式落到数据库：Prisma 新增 `RandomizationAudit` 模型，字段包含 `roleAssignmentMethod / roleAssignmentSeed / roleAssignedAt / companySequenceMethod / companySequenceSeed / companySequenceGeneratedAt / companySequence`。
- 已将角色随机化实现改为用成功配对时的 seed，配对后第一次随机决定参与者 A/B，用 seed 确保可重现。
- 已将公司顺序随机化从 `sort(() => Math.random() - 0.5)` 改为用 seed 的 Fisher-Yates 洗牌，保证同一组共享相同且可重现的顺序。
- 已把变量持久化和随机化源数据补充到：`01_rules/experiment_necessary.md` 和 `02_specs/02_backend/VARIABLE_PERSISTENCE_SPEC.md`，说明实验需要哪些变量以及如何保存。

- 已修复 workspace/b 在工作段切换时的 hooks 顺序错误：因为 redirectPath 条件返回写在 useMemo 之前，现已把所有 hooks 全部上移并通过 web build。
- 已修补 A/B 段间信息刷新链路：B 查看 A 信息区、A 自动提交事件、休息段、以及查看尽调员信息后都会强制刷新 A 的数据副本，避免显示过期或空白数据。
- 已为 A 端自动提交前增加最后一次草稿保存：切换公司时提前 1 分钟触发一次 workbench-save-draft，防止最后几秒内来不及保存导致结果缺失。
- 已修正 A 端同步准备跳转逻辑：practice_ready / formal_ready 只有本人已准备才会进入 /ready，未准备时逻辑停留在原页面，而不是强制跳回同步等待页。
- 已开始把副线任务系统正式重构，范围确认当前 SideTaskStrip + SideTaskResponseLog 都是占位原型；参考 B实验方案_副线任务说明_V0.8.xlsx 的实验 1/2/3 相关部分，提取 C副线任务题库_V0.8.xlsx 的结构，当前题库模式为正式题库 900 题（普通中性池 360 + 合作叙事池 540，按 3 个工作段均分分布）。
- 已把副线系统正式重构规划写入 `02_specs/02_backend/SIDETASK_REBUILD_SPEC.md`，已包含实验目标、题库字段、缺失的分发/曝光层、数据库拆分、admin 参数和 UI 重构的完整文档。
- 已增强主线/副线 AI 统一：`apps/web/src/components/ai-chat-panel.tsx` 已接入 Markdown 渲染（react-markdown + remark-gfm），支持标题、加粗、列表、代码块、表格和链接，同步支持流式消息、等待状态和图片/图格式；web build 已通过。
- 已再次确认副线和主线 AI 可以复用同一个 AiChatPanel 组件，UI 和交互与主线 AI 完全一致，当前副线只需要传 `contextType=side`，扩展范围在当前维度内，不需要额外阶段实现。
- 已评估正式流式传输方案：当前 `POST /ai/chat` 只能一次性返回完整文本，不支持 SSE/流式协议；如果需要流式传输，需要前后端协议同步，当前阶段只做前端轮询。副线 AI 第二阶段需要真实流式：后续接入 `POST /ai/chat-stream` 流式接口，前端 `AiChatPanel` 改为边界接收显示，支持中途停止生成，与主线共用同一套流式 UI。
- 已增强 AI 响应模板：所有 system prompt 统一要求包含标题、分段小标题、3-5 个 bullet、图片说明、确认说明，避免过于散漫的表达。
- 已增强 AI 图片处理：支持上传和粘贴图片，聊天前自动压缩、信息栏图标展示、附件图片预览和移除，以及 Advanced AI 兼容/降级一致。
- 已增强 AI 信息补偿：支持给定回答、换一个用户信息、重新生成、把一个回答钉在侧边栏持续追踪，以及失败后的降级策略。
- 构建已通过：corepack pnpm --filter server build 和 corepack pnpm --filter web build 均通过，说明当前副线 AI 改造在构建层面已稳定。


- 已增强 AI 信息补偿：支持给定回答、换一个用户信息、重新生成、把一个回答钉在侧边栏持续追踪，以及失败后的降级策略。
- 构建已通过：corepack pnpm --filter server build 和 corepack pnpm --filter web build 均通过，说明当前副线 AI 改造在构建层面已稳定。

### 2026-05-27 副线系统 spec 完善

- 已在 `SIDETASK_REBUILD_SPEC.md` 中新增 **2.2 变量总览**：用 ASCII 图总结了 4 个变量（到达节奏/叙事组别/主题顺序/direct_ai_flag）的水平数、随机化层级和 UI 影响
- 已在 `SIDETASK_REBUILD_SPEC.md` 的 **8.4 分发计划示意图** 中新增：
  - Session 整体结构图（3 个工作段 + 实验条件快照）
  - 中性对照组分发流程（每段从 120 题中抽 40）
  - 合作叙事组分发流程（每段 20 合作 + 20 中性，按当前主题从对应池抽取）
  - continuous vs batch 到达方式对比图（逐条 vs 分批）
  - 题库与分段的对应关系（900 题 = 360 中性 + 540 合作，按段均分）
- 已向用户解释副线系统核心逻辑：变量 1 影响滚动动画节奏，变量 2/3 纯数据库分发逻辑

### 2026-05-27 副线 spec 补充：Excel 定性 + admin 到达节奏参数

- 在 `SIDETASK_REBUILD_SPEC.md` section 3 中补充了 Excel 路径确认（`00_start_materials/第五次开会/C副线任务题库_V0.8.xlsx`），明确字段结构已定稿、后续只改文本、按 item_id upsert 可覆盖
- 已把材料库案例目录改成"同一公司 ID 下可按角色分目录"：案例目录支持 `participant/shared`、`participant/diligence`、`participant/manager`、`research` 的分层；导入时按研究者层写入 `participantRole=shared/A/B` 元数据，前台按尽调员/投资经理角色分流显示，默认参与者可看同一层材料。
- 已写入 `02_specs/02_backend/admin材料库上传手册.md`，文档同步为案例目录规范，明确说明旧的扁平结构只会被成功归档，无法按角色分流材料。
- 已把材料库案例目录改成"同一公司 ID 下可按角色分目录"：案例目录支持 `participant/shared`、`participant/diligence`、`participant/manager`、`research` 的分层；导入时按研究者层写入 `participantRole=shared/A/B` 元数据，前台按尽调员/投资经理角色分流显示，默认参与者可看同一层材料。
- 已写入 `02_specs/02_backend/admin材料库上传手册.md`，文档同步为案例目录规范，明确说明旧的扁平结构只会被成功归档，无法按角色分流材料。
- 已收口 admin 的材料管理 tab，当前实现展示为"自动导入题库目录 + 公司列表 + 右侧预览 + 使用说明"；后续再按需补充 P01 案例导入 / 研究者编辑公司信息 / 研究者的文件上传替换删除等功能作为后续迭代。
- 已把题库扫描结果在 admin 内部展示每个案例的公司编号、参与者材料数、投资经理材料数、以及研究者材料数，方便核对目录是否分对。
- 构建已通过：corepack pnpm --filter server build 成功；corepack pnpm --filter web build 首次遇到 Windows .next 文件锁 EBUSY，重试后成功通过。
- 已新增当前目录 `02_specs/04_pre_deploy/`，新建 `STORAGE_AND_IMPORT_SPEC.md`，先把材料存储、上传流程、存储 key 规则、元数据表、以及文件上传与本地扫描的衔接说明写清楚，后续可直接对接 COS 云端存储。
- 已增强 AI 等待动态：`AiChatPanel` 现把空白等待改成动画占位，默认气泡随机显示"正在思考 / 正在组织语言 / 正在生成结构化回答"等提示，持续循环显示，不只是死板的"正在生成..."。
- 已增强 AI"钉住追踪"：已把某个回答钉在侧边栏后，侧边栏上方出现一条钉住摘要；用户只需点一下新的追踪文本，下次发问时模型会把上一个回答作为上下文的一部分注入，数据库侧只记录用户实际发起的追踪。
- 已增强 AI"钉住追踪"：已把某个回答钉在侧边栏后，侧边栏上方出现一条钉住摘要；用户只需点一下新的追踪文本，下次发问时模型会把上一个回答作为上下文的一部分注入，数据库侧只记录用户实际发起的追踪。
- 构建已通过：corepack pnpm --filter server build 和 corepack pnpm --filter web build 均通过

### 2026-05-27 副线任务系统完整重建（Phase 1-5）

**核心参考文档**：
- Spec 文件：`02_specs/02_backend/SIDETASK_REBUILD_SPEC.md`（包含变量说明、分发示意图、数据库设计、admin 参数表）
- 实施计划：`C:\Users\ASUS\.claude\plans\tender-toasting-clock.md`（5 阶段完整实施计划，含 4 个架构决策）

**背景**：旧副线系统是纯 UI 原型（2 道写死假题、固定动画时序、无服务端逻辑、无题库、无分发计划）。本次重建为支撑实验 2（到达节奏 continuous/batch）和实验 3（合作叙事/中性对照）的正式系统。

**4 个架构决策**：
1. 实时分发机制：服务端预计算 scheduledAt 时间戳 + 前端检测首次出现上报 releasedAt + 服务端幂等认定
2. 分发计划生成时机：Session 创建时一次性生成 120 条计划（40×3 段）
3. 旧模型处理：保留 SideTaskResponseLog 但停止写入，全部迁移到 SideTaskExposureLog
4. 练习段无副线：SideTaskPlan 只为 segmentIndex 1/3/5 创建

---

#### Phase 1：数据层基础

**修改文件**：
- `apps/server/prisma/schema.prisma` — 新增 4 个模型（SideTaskItem、SideTaskPlan、SideTaskExposureLog、SideTaskSessionConfig）+ ExperimentConfig 扩展 9 个到达节奏参数 + Session/Participant 关联
- `apps/server/src/admin/sidetask-admin.service.ts` — **新建**，Excel 导入（xlsx 解析"正式题库"sheet，21 列映射，按 itemCode upsert）、题库列表/统计/启停
- `apps/server/src/admin/sidetask-admin.controller.ts` — **新建**，POST /admin/sidetask/import、GET /admin/sidetask/items、GET /admin/sidetask/items/stats、PATCH /admin/sidetask/items/:id/toggle-active
- `apps/server/src/admin/admin.module.ts` — 注册新 controller/service
- `apps/server/src/admin/admin.service.ts` — experimentConfig 读写扩展，新增 sideTask 子对象 + batchSizes 校验
- `apps/server/src/admin/admin.controller.ts` — POST /admin/experiment-config body 类型扩展
- Prisma migration: `20260527140927_sidetask_models`

#### Phase 2：Session 级分发计划 + Runtime 集成

**修改文件**：
- `apps/server/src/auth/auth.service.ts` — `initializeSessionData()` 中新增 `generateSideTaskPlans()`：随机分配 dispatchMode（continuous/batch）和 narrativeGroup（coop_narrative/neutral_info），coop_narrative 组洗牌 3 个主题分配到段，每段从对应池采样 40 题（coop 20 + neutral 20 或纯 neutral 40），跨段不复用
- `apps/server/src/experiment/experiment.service.ts` — 新增 `scheduleSideTaskPlans()`（段开始时计算 scheduledAt，continuous 按 interval±jitter，batch 按 batchSizes 分组）、`getSideTaskRuntime()`（返回 sideTaskQueue + sideTaskConfig，含 totalPlanned/Released/Answered/Archived/nextScheduledAt）、`answerSideTask()`（幂等回答 + runtime_invalidated 事件）、`recordSideTaskExposure()`（通用事件记录，side_task_released 幂等更新 releasedAt）；`advanceAfterWork()` 新增归档逻辑
- `apps/server/src/experiment/experiment.controller.ts` — 新增 POST sidetask/:planId/answer 和 POST sidetask/:planId/exposure
- `apps/web/src/lib/session-runtime.ts` — RuntimeState 类型扩展：sideTaskState 替换为 sideTaskQueue 数组 + sideTaskConfig 对象

**修复**：auth.service.ts 中 sampledCoop/sampledNeutral 类型推断为 unknown 问题，显式标注 `{ id: string; itemCode: string }[]`

#### Phase 3：前端 UI 重建

**修改文件**：
- `apps/web/src/components/sidetask-strip.tsx` — **完整重写**：数据驱动动画参数（从 sideTaskConfig 读取 scrollDurationSec/holdSec/fadeSec/pauseSec）、实时队列渲染、乐观更新（前端立即标记 answered）、自动检测新 planId 上报 side_task_released、展开页改为收件箱式工作台（左侧待处理/已处理队列 + 右侧题目详情作答 + AI 面板）
- `apps/web/src/app/workspace/a/page.tsx` — SideTaskStrip props 更新为 sideTaskQueue + sideTaskConfig
- `apps/web/src/app/workspace/b/page.tsx` — 同上
- `apps/web/src/app/dev/preview/a/page.tsx` — 更新为 mock sideTaskQueue/sideTaskConfig
- `apps/web/src/app/dev/preview/b/page.tsx` — 同上

#### Phase 4：Admin 面板

**修改文件**：
- `apps/web/src/components/admin-sidefeed-panel.tsx` — **完整重写**，从 localStorage 改为连接后端，4 个区块：
  1. 题库状态：统计卡片（总题数/普通中性池/合作叙事池/含直接AI）+ Excel 上传 + 筛选浏览 + 启停
  2. 到达节奏参数：连续/批量分列布局，共享动画参数在顶部，读写 ExperimentConfig
  3. Session 副线查看：选择 session → 显示配置（分发模式/叙事组/主题）+ 每段计划/到达/回答/归档统计
- `apps/server/src/admin/admin.service.ts` — `getSessions()` 扩展：include sideTaskConfig + 按段聚合 planStats（total/released/answered/archived）

#### Phase 5：集成验证

- `pnpm --filter server build` 通过
- `pnpm --filter web build` 通过
- 全部 5 个阶段（数据层 → Runtime 集成 → 前端 UI → Admin 面板 → 构建验证）均已完成

---

**关于数据库**：需要重新导入。本次新增了 4 个 Prisma 模型，需要执行 `prisma migrate dev` 同步 schema，然后通过 admin 面板上传 Excel 导入题库（900 题）。旧的 session 数据不受影响（新模型是独立表），但如果要测试新副线功能，需要创建新 session（旧 session 没有 SideTaskPlan 记录）。

### 2026-05-27 Admin 副线面板修复 + 0kb 垃圾文件清理

- 已修复 admin 副线调度页面点击即报错 `Cannot read properties of undefined (reading 'true')` 的问题：后端 `sidetask-admin.service.ts` 返回 `directAiCount`（数字），但前端 `admin-sidefeed-panel.tsx` 的类型定义和渲染代码用的是 `byDirectAi`（对象）；已修正前端类型和渲染为 `directAiCount`，`web build` 已通过。
- 已清理项目根目录下 50 个 0kb 垃圾文件，均为 Codex 会话中 shell 命令误创建的碎片（mermaid 图节点名、路径片段、中文文本片段）。

### 2026-05-28 副线统计口径修正

**背景**：Codex 指出两个统计口径歧义：
1. `totalReleased` 用 `scheduledAt <= now`（计划时间）还是 `releasedAt !== null`（前端真实首次看到）？
2. `totalAnswered` 是 per-session 还是 per-participant？

**修改文件**：
- `apps/server/src/experiment/experiment.service.ts` — `getSideTaskRuntime()` 方法：
  - `exposureLogs` 查询新增 `participantId` 过滤条件，有 participantId 时只看该参与者的回答记录
  - `totalReleased` 改为 `releasedAt !== null`（服务端认定的前端真实首次看到时间）
  - 新增 `visiblePlans` 变量，用 `scheduledAt <= now` 仅用于前端队列显示
  - `answeredCount`、`archivedUnansweredCount`、queue 的 `answered`/`answer` 字段全部基于 participantId 过滤后的 exposureLogs 计算
- `02_specs/02_backend/SIDETASK_REBUILD_SPEC.md` — 新增第 11 节「统计口径定义」，明确 totalReleased/totalAnswered/totalPlanned/totalArchived 的定义和队列显示 vs 统计的分离逻辑

**口径定义摘要**：
| 指标 | 定义 | 说明 |
|------|------|------|
| totalPlanned | 当前段 SideTaskPlan 总数（固定 40） | 不变 |
| totalReleased | `releasedAt !== null` 的 plan 数 | 前端真实首次看到，非计划时间 |
| totalAnswered | 当前 participant 有 `side_task_answered` log 的 plan 数 | per-participant |
| totalArchived | `isArchivedAtSegmentEnd && 无 answered log` 的 plan 数 | 段结束时漏答 |
| 队列显示 | `scheduledAt <= now && !isArchivedAtSegmentEnd` | 此刻应该看到的题 |

**验证**：`pnpm --filter server build` 通过。

### 2026-05-28 AI 模型配置：基础版/高级版分离

- `.env` 新增 `OPENAI_ADVANCED_BASE_URL` 和 `OPENAI_ADVANCED_MODEL` 环境变量
- 基础版: qwen-turbo / 高级版: qwen3.6-plus，两者共用同一个 apiKey，endpoint 统一用 dashscope
- `ai.service.ts` 高级版 fallback 从 `OPENAI_BASE_URL`/`OPENAI_MODEL` 改为优先读 `OPENAI_ADVANCED_BASE_URL`/`OPENAI_ADVANCED_MODEL`，数据库 AiSettings 优先级最高

### 2026-05-28 AI 输入框截图按钮

- `ai-chat-panel.tsx` 新增 `onScreenshot` prop，高级版 AI 输入框左侧图文字按钮改为 SVG 图片图标（山景+太阳），点击触发材料区截图功能，hover 提示点击使用截图功能
- `workspace/a/page.tsx` + `workspace/b/page.tsx` 传入 `onScreenshot={() => materialPanelRef.current?.startCapture()}`，复用 CompanyMaterialPanel 的框选截图
- 基础版 AI 显示灰色不可用图标，无 onScreenshot 时保留原文件上传
- web build + server build 通过

### 2026-05-28 前端 UI 审美升级

**背景**：在 git 备份后对全站前端做一轮审美升级，目标是"精致、舒适、专业"的工具感，不做绚丽特效。

**改动范围**：

- `apps/web/src/app/layout.tsx` — 引入 `next/font/google` 的 Inter 字体（400/500/600/700），注入 `inter.variable` 到 `<html>` className
- `apps/web/src/app/globals.css` — `--font-sans` 改为 Inter + 系统字体栈；新增三级阴影 CSS 变量（`--shadow-card`、`--shadow-elevated`、`--shadow-topbar`）；全局 `button, a` 加 `transition-colors duration-150`；改善 `:focus-visible` 样式
- `apps/web/src/components/session-topbar.tsx` — nav 阴影改为 `var(--shadow-topbar)`；角色/项目标签精修为 `bg-[#f5f7fa] border border-[#eaecf0] text-[#4e5969] rounded-md`
- `apps/web/src/components/workbench-layout.tsx` — 三个面板头统一改为 `bg-[#fafbfc]`，加左侧色条区分区域（材料区 emerald-400/60、任务区 #1e80ff/50、AI 区 violet-400/60）；分割线 hover 颜色从主蓝改为柔和蓝 `#93c5fd`
- `apps/web/src/app/login/page.tsx` — 卡片 `rounded-2xl` + `var(--shadow-elevated)`；输入框 focus ring；按钮 `hover:bg-[#1168e3] active:scale-[0.98]`
- `apps/web/src/app/waiting-room/page.tsx` — 同上；加载动画改为双色 spinner `border-[#93c5fd] border-t-[#1e80ff]`
- `apps/web/src/app/instruction/page.tsx` — 同上；角色卡片 `rounded-xl bg-blue-50/70`
- `apps/web/src/app/ready/ready-client-page.tsx` — 同上；状态框 `rounded-xl border border-blue-100 bg-blue-50/70`
- `apps/web/src/app/break/page.tsx` — 卡片 `rounded-2xl border-[#eaecf0]` + `var(--shadow-elevated)`；问题选项 `rounded-xl transition-colors duration-150`
- `apps/web/src/app/workspace/end/page.tsx` — 卡片 `rounded-2xl border-[#eaecf0]` + `var(--shadow-elevated)`；信息框 `rounded-xl border border-blue-100 bg-blue-50/70`
- `apps/web/src/components/a-task-editor.tsx` — 表格边框 `#bfc6d1` → `#dde1e7`；表头背景 `#f7f8fa` → `#f5f7fa`；外层卡片边框 `#d4d8de` → `#e2e5ea`；所有输入框加 `focus:bg-[#fafbff]`
- `apps/web/src/components/b-task-editor.tsx` — 同上；删除/新增按钮加 `transition-colors duration-150`
- `02_specs/01_frontend/FRONTEND_GUIDELINES.md` — 新增第 10 节"设计系统规范"，记录字体、阴影层级、交互过渡、面板头规范、颜色规范、加载动画标准

**验证**：`corepack pnpm --filter web build` 通过（21 个页面全部生成）。

### 2026-05-28 测试题 + 测试轮工作台 + 教学引导首轮接线

- 已将主流程接成“指导语 -> 测试题 -> 测试轮同步准备 -> 测试轮工作台 -> 正式阶段同步准备”，新增 `/practice-quiz` 页面与对应后端接口。
- 已把实验配置扩展为“测试轮时长 + 测试题模板 + 通过题数 + 休息问卷模板”，admin 现可编辑两套单选题模板。
- 已把材料库扫描口径扩展为“正式案例 / 测试轮案例”双层目录，并保留旧根目录兼容；测试轮目录缺失时本地回退到 `P01`。
- 已让测试轮复用现有工作台并接入第一版教学引导遮罩，按真实交互监听材料切换、缩放、全屏、拖拽、AI 发送、截图和副线操作。
- 已完成 `corepack pnpm --filter server build` 与 `corepack pnpm --filter web build`，说明当前首轮接线已通过构建验证。

### 2026-05-28 公司池动态分配策略

**背景**：AB 共享同一套按 sortOrder 排序的公司序列导致 B 的公司顺序与 A 完全一致（只是滞后）。在 AI 升级实验中，这会导致 B 大部分时间处理未升级公司，无法产生 D11 样本。改为 B 从"锁定池"中随机推送公司。

**改动范围**（5 个文件）：

- `apps/server/prisma/schema.prisma` — TaskAssignment 新增 `bSequenceIndex Int?` 字段及索引；RandomizationAudit 新增 `bAssignmentMethod` / `bAssignmentLog` 审计字段
- `apps/server/prisma/migrations/20260528035433_pool_based_b_assignment/migration.sql` — 数据库迁移
- `apps/server/src/experiment/experiment.service.ts` — 核心改动：
  - 新增 `assignNextTaskForB()` 方法：从锁定池随机选公司，池空 fallback 到 A 正在处理的公司（PreA），都没有则 idle
  - `getRuntime()` B 分支改用 `bSequenceIndex` 查找当前公司
  - `syncRuntime()` 加懒分配触发
  - `bCompleteTask()` 完成后自动触发下一家分配
  - `startFormalWorkSegmentTx()` 首次进入正式段时分配 B
  - `advanceAfterWork()` 分别快照 A 和 B 在不同公司时的数据
  - `advanceAfterBreak()` 分别恢复 A 和 B 各自公司的草稿
  - 返回值新增 `isPreA` 标志
- `apps/server/src/auth/auth.service.ts` — 审计 upsert 新增 `bAssignmentMethod: 'pool_based_random_v1'` 和 `bAssignmentLog: []`
- `apps/web/src/lib/session-runtime.ts` — RuntimeState 新增 `isPreA: boolean`

**核心逻辑**：B 完成当前公司 → 从锁定池（A 已提交 && B 未完成 && B 未分配）随机选一家 → 池空则 fallback 到 A 正在处理的公司（PreA 模式，B 只看自有材料）→ 都没有才空窗。

**验证**：`corepack pnpm --filter web build` 通过（22 个页面全部生成）。

### 2026-05-28 测试题 / 测试轮 / 教学引导重做落地 + 首轮 bug 修复

**本轮落地范围**：

- 已把主流程改为：`instruction -> practice-quiz -> practice_ready -> practice -> formal_ready -> formal`
- 已新增测试题页与对应后端接口，测试题采用单选题模板，按“达到最低正确题数才可进入测试轮”判定；默认口径仍支持“通过阈值为全对”
- 已把测试轮从“单页壳子”改为复用正式工作台，包含材料区、答题区、AI 区、倒计时、草稿保存、截图、缩放与拖拽
- 已将教学引导直接挂进测试轮工作台，采用聚光灯遮罩 + 真实交互解锁的方式推进，覆盖材料切换、全屏、缩放、AI 发送、拖拽、副线入口与截图等步骤
- 已把 admin 的实验配置扩展为三块：时间参数、测试题模板、休息问卷模板；两套模板现共用单选题编辑器
- 已把材料库扫描扩展为“正式案例 / 测试轮案例”双层结构，支持：
  - `00_start_materials/原始材料/正式/<案例目录>`
  - `00_start_materials/原始材料/测试轮/<案例目录>`
  - 旧根目录正式案例兼容
  - 测试轮目录缺失时回退到旧 `P01`
- 已在仓库内补出本地测试轮目录：`00_start_materials/原始材料/测试轮/P01`，当前先复用现有 `P01` 内容，便于 admin 直接扫描验证

**本轮补修的两个实际问题**：

- 已修复 admin 材料管理页因正式案例 `P01` 与测试轮案例 `P01` 同名导致的重复 key 报错；原因是页面里有两处本地扫描结果列表，其中一处仍使用 `key={item.folderName}`。现已统一改为带 `usage + folderName + caseCode` 的唯一 key，并补上“正式案例 / 测试轮案例”用途标签
- 已修复测试题阶段“双人不同步”时的卡死问题；当一人先通过、session 进入 `practice_ready` 后，另一人若尚未通过测试题，runtime 仍需继续返回 `practiceQuizTemplate`。现已补上后端返回条件与前端守卫逻辑，未通过者会继续停留在测试题页完成作答，不会因共享 phase 前进而丢题目
- 已补齐前端 `RuntimeState.practiceQuizPassed` 类型字段，避免 dev 可跑但 `web build` 在类型检查阶段失败

**验证**：

- `corepack pnpm --filter server build` 通过
- `corepack pnpm --filter web build` 通过

**当前口径提醒**：

- 参与者可见文案继续统一使用“尽调员 / 投资经理”，不向前台暴露 `A/B`
- 正式轮的 B 动态分配策略继续保持现有正确实现：优先锁定池随机分配，池空再 fallback 到 A 当前在做公司（PreA）

### 2026-05-28 副线提醒频率澄清 + 文档同步 + admin 默认值

**背景**：师兄确认 continuous/batch 的区别只在前端滚动提醒频率，后台题目到达速度相同（每 30s 一道）。

**改动范围**：

- `02_specs/02_backend/SIDETASK_REBUILD_SPEC.md` — 变量 A 从"到达节奏"改为"提醒频率"，更新所有 continuous/batch 相关描述、admin 参数表、UI 体现说明、对比图
- `02_specs/00_overview/APP_FLOW.md` — 更新 8.1 实验设计概览、8.4 运行时调度（添加 continuous vs batch 提醒频率对比可视化）
- `apps/web/src/components/admin-sidefeed-panel.tsx` — ConfigNumber/ConfigString 组件新增 defaultValue 提示；所有参数传入默认值（滚动12s/停留5s/淡出2s/continuous间隔30s/抖动0s/暂停15s/batch提醒间隔300s/暂停60s）；移除 batchSizes 字段（batch 模式不再分批到达）；添加说明文字

**核心澄清**：后台都是每 30s 一道题进入队列，区别只是前端滚动提醒频率——continuous 每道都提醒，batch 攒约 5 分钟提醒一次。

### 2026-05-29 教学引导重构 + 三轮调整

**背景**：当前教学引导存在步骤太多（10-11 步）、遮罩位置不精确、解锁条件太死、不分角色等问题，需要重构为更精简、更友好的教学体验。

**本轮完成内容**：

#### 第一轮：教学引导重构

1. **设计方案记录**：新建 `02_specs/01_frontend/TUTORIAL_SPEC.md`，定义教学引导的设计目标、整体结构、分角色设计、详细步骤、与现有实现的差异
2. **添加新锚点**（3 个文件）：
   - `material-tabs.tsx`：添加 `data-tutorial-anchor="material-tabs"` 到 tab 栏
   - `ai-chat-panel.tsx`：添加 `data-tutorial-anchor="ai-input"` 到 textarea
   - `sidetask-strip.tsx`：添加 `data-tutorial-anchor="sidetask-options"` 到选项区
3. **重写核心组件** `practice-tutorial-overlay.tsx`：
   - 新增第 1 层概览卡片（分角色显示不同内容）
   - 精简为 5 步核心操作（查看材料、填写表单、使用 AI、处理副线、副线作答）
   - 步骤 2 改为"点击按钮"解锁
   - 角色专属说明文案（A：尽调员 5 分钟限制 + 反馈弹窗；B：查看尽调信息）
4. **更新后端常量**：`experiment.service.ts` 的 `PRACTICE_TUTORIAL_STEPS` 更新为 5 个新步骤 key
5. **构建验证**：`server build` 和 `web build` 均通过

#### 第二轮：三轮调整

1. **步骤三 AI 区调整**：
   - 解锁条件改为"点击按钮"（`requireAction: false`）
   - 文案改为"这里您可以借助 AI 的辅助完成任务"
   - 按钮点击事件改为根据当前步骤的 `eventType` 动态派发

2. **遮罩高亮效果**：
   - 边框颜色从 `#60a5fa` 改为 `#3b82f6`（更亮的蓝色）
   - 背景色从 `bg-white/10` 改为 `bg-blue-500/10`（轻微的蓝色背景）
   - 添加发光效果：`shadow-[0_0_0_9999px_rgba(2,6,23,0.55),0_0_40px_rgba(59,130,246,0.4)]`

3. **测试轮副线任务样例**：
   - 生成 5 个测试轮副线任务样例 Excel
   - 文件路径：`00_start_materials/原始材料/测试轮/副线任务样例.xlsx`
   - 包含 5 道题目，涵盖团队协作、信息处理、决策判断、沟通协作、时间管理等场景
   - 与正式实验 Excel 结构一致，使用相同字段

**验证**：`corepack pnpm --filter web build` 通过（22 个页面全部生成）。

**文件变更清单**：
- `apps/web/src/components/practice-tutorial-overlay.tsx` — 核心重写
- `apps/web/src/components/material-tabs.tsx` — 添加锚点
- `apps/web/src/components/ai-chat-panel.tsx` — 添加锚点
- `apps/web/src/components/sidetask-strip.tsx` — 添加锚点
- `apps/server/src/experiment/experiment.service.ts` — 更新步骤常量
- `02_specs/01_frontend/TUTORIAL_SPEC.md` — 新增设计规格
- `00_start_materials/原始材料/测试轮/副线任务样例.xlsx` — 新增测试轮样例

### 2026-05-29 教学引导三轮修复

**背景**：用户验收后反馈三个问题：高亮效果不可见、测试轮 Excel 导入识别不到、指导语一人点击两人都开始。

**修复内容**：

#### 问题 1：高亮透明色

**现象**：目标区域高亮不可见，用户希望目标区域有明显的透明色背景。

**修复**：
- `practice-tutorial-overlay.tsx`：高亮框背景色从 `bg-transparent` 改为 `bg-blue-100/30`（浅蓝色透明背景）
- 现在目标区域会有明显的浅蓝色背景，与遮罩的深色形成对比

#### 问题 2：测试轮 Excel 导入显示

**现象**：上传 Excel 后显示"导入完成: 0 条"，实际导入成功但前端显示错误。

**修复**：
- `admin-sidefeed-panel.tsx`：导入结果从 `data.imported` 改为 `data.total`、`data.created`、`data.updated`
- 现在上传后会显示正确的导入结果："导入完成: X 条，新增 Y，更新 Z"

#### 问题 3：指导语同步 bug

**现象**：一个人点击"开始"后，两人都直接进入测试题阶段，没有各自的准备环节。

**根因**：指导语页面的 `handleStart` 函数直接调用 `GET /practice-quiz`，让 session 进入 `practice_quiz` 阶段，两人都会自动跳转。

**修复**：
- `instruction/page.tsx`：`handleStart` 函数从 `GET /practice-quiz` 改为 `POST /ready-practice`
- 现在每个人点击"开始"后会标记自己已准备，跳转到 `/ready?target=practice`
- 两人都准备后才进入测试题阶段

**验证**：`corepack pnpm --filter web build` 通过（22 个页面全部生成）。

**文件变更清单**：
- `apps/web/src/components/practice-tutorial-overlay.tsx` — 高亮框样式
- `apps/web/src/components/admin-sidefeed-panel.tsx` — 导入显示逻辑
- `apps/web/src/app/instruction/page.tsx` — 指导语同步逻辑

**当前流程**：
```
登录 → 等待室 → 配对
    ↓
指导语（每人独立阅读）
    ↓ 点击"开始"
准备页（等待另一方）
    ↓ 两人都准备
测试题
    ↓ 通过
测试轮（教学引导）
    ↓ 完成
正式阶段
```

### 2026-05-29 指导语链路回正 + 教学高亮口径修正 + 测试轮副线接通

**背景**：在 5.29 的多轮调整后，出现了三个实际回归：
- 指导语页有人点击后会把整个 session 直接推进到测试题，未保留“各自 ready 等待对方”的口径
- 教学引导视觉仍偏向“整屏暗遮罩开洞”，与当前想要的“目标区域本体高亮、不压黑全页”的目标不一致
- 测试轮阶段虽然 admin 已能扫描副线 Excel，但测试轮前台仍看不到副线任务

**本轮修复**：

1. **指导语同步链路回正**
   - `instruction/page.tsx` 改回点击后先 `POST /ready-practice`，再进入 `/ready?target=practice`
   - `experiment.service.ts` 中 practice barrier 的允许阶段改回 `INSTRUCTION / PRACTICE_READY`
   - 两人都 ready 后，不是直接开测轮，而是统一进入 `practice_quiz`
   - `practice-quiz/page.tsx` 不再在通过后再次调用 `ready-practice`
   - `submitPracticeQuiz()` 改为：双方都通过测试题后，后端自动启动测试轮
   - 同时移除 `GET /practice-quiz` 对 session 的隐式推进，避免有人直接请求接口把全局 phase 从指导语强推到测试题

2. **教学高亮口径修正**
   - `practice-tutorial-overlay.tsx` 的步骤层从“整屏深色遮罩 + 开洞”调整为“默认不加整屏暗罩，只高亮当前目标区域”
   - 当前高亮样式改为：浅色高亮底、明显描边、白色内圈与蓝色外发光，优先保证目标区域本体醒目
   - `02_specs/01_frontend/TUTORIAL_SPEC.md` 已同步更新为最新口径：默认不使用整屏暗色遮罩，只高亮目标区域

3. **测试轮副线任务接通**
   - `auth.service.ts` 在 session 初始化时新增测试轮 `segmentIndex=0` 的副线计划创建
   - 题目优先取 `workSegment=0`，若当前库里暂无专门测试轮题，则回退取 `workSegment=1`
   - `experiment.service.ts` 让测试轮 `segmentIndex=0` 也进入副线 runtime，不再被当成“非 work segment”直接返回空队列
   - 对旧 session 增加兼容：若已进入测试轮但尚无 `segmentIndex=0` 副线计划，会在 runtime 读取时即时补建并立即可见

**当前确认后的流程**：
```
登录 → 等待室 → 配对
    ↓
指导语（每人独立阅读）
    ↓ 点击“开始”
准备页（等待另一方）
    ↓ 两人都准备
测试题
    ↓ 两人都通过
测试轮（含教学引导 + 测试轮副线）
    ↓ 完成
正式阶段
```

**验证**：
- `corepack pnpm --filter server build` 通过
- `corepack pnpm --filter web build` 通过

### 2026-06-05 实验 1/2/3 模式切换首轮实现

**背景**：师兄希望同一套实验页支持三种实验局：AI 能力升级、副线提醒频率、合作叙事；三种模式互斥，admin 切换只影响新 session，非目标变量默认基础 AI、continuous 高频提醒、中性信息。

**本轮实现方向**：
- 新增 `02_specs/03_execution/实验123计划.md`，记录模式互斥、固定变量下拉、指导语积木、前台提示与变量留痕口径。
- Prisma schema 增加实验模式、session 快照、任务级 AI 状态、AI 请求模型/图片开关、随机化审计字段。
- 后端 session 初始化开始基于 admin 当前实验模式生成 session 级快照；副线计划使用快照中的 dispatch / narrative 配置。
- admin 实验配置页新增实验模式卡片，展示随机项和固定项；固定项可下拉调整。
- 指导语页改为通用说明 + 角色说明 + 当前模式条件块；AI 区标题栏显示基础版/升级版 badge；实验 1 增加升级提示和 B 查看 A 信息时的 AI 状态提示。

**验证**：
- `corepack pnpm --filter server prisma:generate` 通过。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
- 本地 PostgreSQL 因历史迁移名 drift 未执行 `migrate dev`，已用 `corepack pnpm --filter server exec prisma db push` 同步当前 schema；`/admin/experiment-config` 已返回新实验模式配置字段。

### 2026-06-05 本地启动脚本端口占用修复

**背景**：上一轮验证留下隐藏 Next dev server，占用 3000，导致用户再次运行 `启动本地开发环境.bat` 时 Next 自动尝试 3002 后报 “Another next dev server is already running”。

**修复**：
- `scripts/start-local.ps1` 启动前先调用 `scripts/stop-local.ps1`，自动清理旧 web/server dev 进程。
- `scripts/stop-local.ps1` 除 node 进程外，也会关闭本项目残留的 dev PowerShell 窗口。

**验证**：
- 已清理旧 PID 31672 等残留进程。
- 重新运行启动脚本后，web 可访问 `http://localhost:3000`，server health 可访问 `http://localhost:3001/health`。

### 2026-06-05 Markdown 全仓审查回正 + 公司分配逻辑复核

**背景**：本轮未改代码，专门审查 `README / 01_rules / 02_specs / apps/*/README` 与当前代码是否存在明显冲突，并补记当前真实的公司分配逻辑，避免后续继续被旧 spec 误导。

**本轮文档回正重点**：
- 主流程统一为：`instruction -> ready(practice) -> practice-quiz -> practice -> ready(formal) -> formal`
- 角色分配统一为：先按进入顺序成组，再在组内随机分配 `A/B`
- B 端“是否点击尽调员信息”统一回正为：只做行为记录，不再作为提交门槛
- 副线变量 A 统一为“提醒频率”，后台题目实际到达统一按连续节奏生成
- 测试轮教学文档统一到当前真实实现：5 步最小引导、遮罩开洞式高亮、完成后回主界面再弹“下一步正式进入测试轮”

**公司分配逻辑复核结果**：
- 正式轮存在一条共享正式公司顺序：session 初始化时先对 formal 案例池做 seeded shuffle，并为每家公司写入固定 `sortOrder / sequenceIndex`
- 但投资经理 B 的实际取公司逻辑不是简单按这条固定顺序逐家同步推进
- 当前代码对 B 使用“公司池动态分配”：
  1. 先从“尽调员已提交、B 未完成、且尚未分配给 B”的锁定池中按 seed 随机分配
  2. 若锁定池为空，则 fallback 到“尽调员正在处理、B 尚未分配”的 PreA 公司
  3. 都没有时，B 才进入空窗
- 因此当前真实实现应理解为：
  - **A**：按共享固定正式顺序推进
  - **B**：在共享正式案例池之上，按锁定池 / PreA fallback 做动态分配

**后续收口**：
- 随后已把 `02_specs/00_overview/APP_FLOW.md` 回正到当前真实实现：
  - `A` 按共享固定正式顺序推进
  - `B` 在共享 formal 公司池之上，按“锁定池优先 + PreA fallback”动态分配
- 这条冲突记录保留为审查痕迹，不再视为当前未解决问题
### 2026-06-05 APP_FLOW 公司分配口径回正 + 上线手册补充 + Git 收口

**背景**：在完成本轮 Markdown 全仓审查后，继续收口两个遗留点：一是把 `APP_FLOW.md` 中关于正式轮公司分配的旧口径改成与当前代码一致；二是把当前“服务器上线需要知道什么、还差哪些工作、如何学习”的内容整理成固定手册，避免后续再次口头重复。

**本轮补充**：

1. **APP_FLOW 正式轮公司分配逻辑回正**
   - 明确正式轮存在一条 session 内共享、seed 可复现的 formal 公司顺序
   - 明确 `A` 端按这条固定正式顺序推进
   - 明确 `B` 端不是机械跟随固定序列逐家同步，而是基于共享 formal 公司池做动态分配：
     1. 优先从“`A 已提交 && B 未完成 && B 未分配`”的锁定池中按 seed 随机取一家
     2. 若锁定池为空，则 fallback 到“`A 正在处理 && B 尚未分配`”的 PreA 公司
     3. 两者都无时才 idle
   - 因此当前真实实现应理解为：`A 固定顺序 + B 动态池分配`

2. **上线手册新增**
   - 在 `01_rules/上线手册.md` 中补出当前项目的上线认知与缺口清单
   - 明确当前不是“业务完全没写完”，而是“可部署化层”仍未补齐
   - 手册中拆清了：
     - 已具备的基础
     - 还缺的部署大块
     - 适合当前阶段的上线顺序
     - 最小知识树（进程 / 端口 / 环境变量 / 反向代理 / 持久化 / 迁移）
     - 代码层 P0 / P1 / P2 工作优先级

3. **Git 收口**
   - 将本轮已确认的文档回正、测试轮相关实现、服务器准备文档与历史未提交变更统一收口进版本控制
   - 会议记录 `.docx` 这类无关文件不纳入本轮提交


### 2026-06-05 变量记录与服务器导出方案整理

**背景**：为正式实验上线前的数据留痕做方案收口，明确不只记录变量事件，也要记录被试答题内容、副线内容、问卷内容和 AI 聊天记录；由于数据量较大，正式导出不走 admin 直接大 JSON 响应，而改为服务器生成归档包。

**本轮文档新增**：
- `02_specs/04_pre_deploy/变量记录与服务器导出方案.md`

**方案口径**：
- 数据分为三层：事件数据、内容数据、AI 聊天与轻量任务上下文数据。
- 每个被试按公司组织数据，并在被试目录下分 `events/`、`content/`、`ai/` 三个子目录。
- 大数组优先使用 `jsonl`，小摘要使用 `json`。
- 建议新增 `BehaviorEvent`、`SessionConfigSnapshot`、`ExportJob`，并补强 `AiMessageLog` 的任务索引和请求状态字段。
- admin 负责触发导出任务、查看状态、下载 zip；导出包生成在服务器侧，后续上线可接对象存储或受控临时 URL。

### 2026-06-06 变量保存模块第一期实现

**背景**：根据 `02_specs/04_pre_deploy/变量记录与服务器导出方案.md`，开始把变量保存从方案推进到代码实现。目标不是临时导出大 JSON，而是建立实验审计事件、服务器导出任务、A/B 分目录归档和变量实现自检。

**本轮实现**：
- 新增 Prisma 模型：
  - `ExperimentEvent`：统一记录关键实验事件。
  - `ExportJob`：记录服务器导出任务状态、范围、输出路径和错误。
  - `AiMessageLog` 补 `taskAssignmentId / sideTaskPlanId / completedAt / latencyMs / providerStatus / errorMessage`。
- 新增后端 `recording` 模块：
  - `ExperimentAuditService`：旁路写实验事件，不阻断被试流程。
  - `StorageService`：默认本地 `storage/exports`、`storage/attachments`，为后续 Docker volume / 对象存储预留替换点。
  - `ExportService`：生成 `session -> participants -> participant data` 树状导出包，并压缩为 zip。
- admin 导出改为服务器任务：
  - `POST /admin/export-jobs`
  - `GET /admin/export-jobs/:id`
  - `GET /admin/export-jobs/:id/download`
  - 旧 `/admin/export` 保留为兼容入口，但不再直接返回超大 JSON。
- 修复副线作答去重：
  - A/B 可对同一道 `sideTaskPlanId` 独立作答。
  - migration 中增加 partial unique index，避免同一 participant 对同一道副线题重复提交。
- B 公司分配记录补强：
  - locked pool / PreA fallback 写入 `RandomizationAudit.bAssignmentLog`。
  - 导出时进入 `company_metadata.json` 和 `randomization.json`。
- AI 记录补强：
  - 保存主线/副线 AI 请求耗时、模型名、AI 档位、provider 状态和错误。
  - 图片附件保存到服务器文件，聊天 JSON 只保存 `imageRef + relativePath`。
- admin 前端“导出全部数据”改为创建导出任务、轮询状态、下载 zip。
- 新增 `02_specs/04_pre_deploy/变量实现自检表.md`，逐项标明变量保存来源、触发点、导出位置和实现状态。

**验证**：
- `corepack pnpm --filter server prisma:generate` 通过。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

**仍不属于第一期**：
- 后测问卷流程。
- 内容质量评分、gold fact / gold issue。
- 滚动、focus/blur、细粒度停留时长。
- AI 采纳率自动编码。

### 2026-06-06 测试轮默认变量与时间线 debug

**背景**：测试时发现两个问题：一是测试轮会受到实验 1/2/3 的正式处理变量影响；二是测试轮倒计时结束后没有稳定推进到正式阶段准备页。

**本轮修复**：
- 测试轮变量固定为默认口径，不再继承正式实验处理变量：
  - AI 固定 `BASIC`。
  - 副线固定 `continuous` 高频推送。
  - 叙事固定 `neutral_info` 中性信息。
- 新 session 创建测试轮副线计划时写入固定默认变量。
- 旧 session 若已生成测试轮副线计划，runtime 读取时会纠正为 `continuous + neutral_info`，并清除 `batchNo`。
- `getCurrentAiLevel()` 对 `segmentIndex === 0` 强制返回 `BASIC`。
- 测试轮到时后，后端 `syncRuntime()` 会自动执行 `advanceAfterPractice()`：
  - 结束测试轮。
  - 归档测试轮未完成副线。
  - 写入 `practice_completed` 事件。
  - 将 session 推进到 `FORMAL_READY`。
- 前端跳转条件回正：`instruction / practice-quiz / practice / workspace/a / workspace/b` 只要看到 `formal_ready`，都跳转到 `/ready?target=formal`，避免尚未点正式 ready 的参与者卡在旧页面。

**时间线复核结论**：
- 当前代码主流程为：`login -> waiting-room -> instruction -> ready(practice) -> practice-quiz -> practice -> ready(formal) -> formal work 1 -> break 1 -> formal work 2 -> break 2 -> formal work 3 -> end`。
- 测试题双方通过后自动进入测试轮。
- 测试轮到时后进入正式阶段同步准备页，不直接进入正式工作段。
- 正式 ready 双方都点击后启动正式工作段 1。
- 正式工作段、休息段的自动推进逻辑代码层面已连通。

**验证**：
- `corepack pnpm --filter server build` 通过。
- 未运行 `web build`，因为本轮前端只改跳转条件，且用户反馈构建命令过慢；需在浏览器端继续做完整 A/B 流程实测。

### 2026-06-06 测试轮单公司收口、全屏 Esc、反馈弹窗与副线提醒 debug

**背景**：测试时发现测试轮只应保留一家公司，但 B 在提交后仍会刷新回同一家公司；同时希望尽量维持被试全屏、允许研究者用 `Shift+Esc` 退出；A 收到 B 反馈的弹窗时长需要 admin 可调；副线提醒需要确认不会在没有题目时提示。

**本轮修复**：
- 测试轮收口为单公司逻辑：A 5 分钟窗口到点后自动提交并可进入正式阶段 ready；B 在 A 信息解锁后可提交，提交后进入正式阶段 ready，不再刷新回 P01。
- 测试轮总时长到点时，若 B 仍未提交，后端自动补记 `practice_b_task_auto_completed`，并进入正式阶段 ready。
- 单个参与者进入 `formal_ready` 等待时，不再提前把整个 session 切到 `FORMAL_READY`，避免把另一名还在测试轮工作的参与者踢出工作台。
- 全屏 Esc 行为调整：`Shift+Esc` 保留为研究者退出全屏；普通 `Esc` 在应用层阻止默认行为，若浏览器仍因原生 Fullscreen API 退出，则尝试自动重新请求全屏；副线任务面板内普通 `Esc` 绑定为“返回主界面”。
- A 端 B 反馈弹窗新增 admin 可调配置：`feedbackNotificationDurationSec`，默认 10 秒。
- 副线滚动提醒仅在 `pendingCount > 0` 时运行；后端队列只返回 `scheduledAt <= now` 且未归档的副线计划，因此不会在服务端尚未释放题目前出现在前端队列。

**验证**：
- `corepack pnpm --filter server prisma:generate` 通过。
- `corepack pnpm --filter server exec prisma migrate deploy` 已应用 `202606060002_feedback_notification_duration`。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

**注意**：浏览器原生全屏的普通 `Esc` 是浏览器保留行为，网页无法 100% 禁用；当前实现是应用层拦截 + 非 `Shift+Esc` 退出后尝试拉回全屏。

### 2026-06-06 副线 Continuous / Batch 提醒触发逻辑修正

**背景**：复核实验 2 时明确：两种条件下后台题目都应按固定间隔连续进入队列；差异只在提醒频率。Continuous 应“每来一道提醒一次”；Batch 应“后台持续到题，但约每个批量窗口提醒一次，打开后看到过去窗口里攒下的多道题”。因此仅用 `pendingCount > 0` 循环滚动只能防止空提醒，不能作为提醒触发条件。

**本轮修复**：
- 后端 `runtime.sideTaskConfig` 新增 `notificationPulse`：
  - `continuous_arrival`：当前 participant 有未作答、未提醒的新到题时触发。
  - `batch_window`：batch 条件下，到达批量提醒窗口后，把窗口内未作答、未提醒的题合并成一次提醒。
- 前端 ticker 不再因为 `pendingCount > 0` 自动循环滚动；只在收到新的 `notificationPulse.id` 时播放一次。
- 前端播放或因副线面板已展开而抑制播放后，都会写入 `side_task_notified` 曝光日志，避免同一批题反复提醒。
- `pendingCount > 0` 保留为防空提醒保护条件；ticker 文案中的数量优先使用本次 pulse 的 `newCount`。
- 开发预览页补齐 `notificationPulse: null` mock 配置。

**当前语义**：
- 题目到达：由 `scheduledAt <= now` 决定，两种模式都连续到达。
- Continuous 提醒：跟随新题到达。
- Batch 提醒：跟随批量窗口到点，且窗口内确实有未提醒题才提醒。
- 如果没有 pending 题，不会出现空提醒。

**验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

### 2026-06-06 变量实现自检表动态化

**背景**：原 `variable_implementation_checklist.*` 是静态说明表，容易在实际导出包存在问题时仍显示“已实现”。复核后决定保留自检表，但把它改成轻量动态验收，而不是删除。

**本轮修复**：
- `writeSelfCheck()` 改为调用动态自检逻辑，基于本次导出的 session、participant 与生成目录检查关键项。
- 自检项现在会实际检查：
  - `session_metadata.json`、`randomization.json` 是否存在。
  - participant 核心文件是否齐全。
  - 公司级 `company_metadata.json`、`answer_content.json`、`ai_chat.jsonl`、`snapshots.jsonl` 是否存在。
  - 图片附件 JSON 路径是否为 participant 相对路径，且文件是否真的在 `attachments/images/` 下。
  - 副线作答正确率是否可计算。
  - 副线 `reactionTimeMs` 是否出现负数。
  - 主线 AI 是否带 `companyId`、`taskAssignmentId`、`segmentIndex`。
  - 副线 AI 是否带 `phase`、`segmentIndex`，并提示缺少 `sideTaskPlanId` 的风险。
  - 新 session 是否有 `participant_login` 登录事件。
  - `variables.json` 是否存在。
- `variable_implementation_summary.json` 现在会输出：
  - `rawSaved`
  - `risks`
  - `missingSource`
  - `postProcessable`
  - `outOfPhaseOne`
- `variable_implementation_checklist_meta.json` 标记 `mode: dynamic_export_self_check`。

**验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

### 2026-06-06 变量记录导出结构 debug 修复

**背景**：对照测试导出包与 `变量记录与服务器导出方案.md` 时发现若干导出层问题。图片文件实际已经复制，但路径嵌套成 `participant/sessions/SESSION/participants/PARTICIPANT/attachments/images`，说明附件保存路径和 participant 导出根路径拼接不一致。

**本轮修复**：
- 图片附件导出路径修正为 participant 目录下的 `attachments/images/...`。
- `ai_chat.jsonl` 中的附件对象清洗：
  - 去掉本机 `absolutePath`。
  - `relativePath` 改为导出包内可用的 `attachments/images/...`。
- 副线作答正确率修正：
  - `goldAnswer=A/B` 会映射到 `optionA/optionB`。
  - 新增 `selectedOptionKey` 与 `correctAnswerText`。
  - `isCorrect` 不再用完整选项文本直接和 `A/B` 比较。
- 副线反应时修正：
  - `openedAt` 取作答前最近一次 `side_task_opened`。
  - 避免作答后打开面板导致 `reactionTimeMs` 为负数。
  - `side_responses.jsonl` 新增 `notifiedAt`，保留提醒曝光时间。
- `variables.json` 角色指标修正：
  - `meanTimeToViewASeconds`、`meanBSubmitDelaySeconds` 仅对投资经理计算，尽调员为 `null`。
- 公司导出目录防覆盖：
  - 公司目录名改为 `companyCode__companyId`；如果 code 本身就是 id，则直接用 id。
  - `company_metadata.json` 内的 `companyCode` 保持原业务代号不变。
- AI 日志阶段归属修正：
  - 主线 AI 也保存 `segmentIndex`。
  - 副线 AI 从工作台 runtime 传入真实 `phase`、`segmentIndex`。
  - 副线 AI 在选中具体副线题时写入 `sideTaskPlanId`。
- 登录事件补充：
  - 登录/重连写入 `participant_login` 事件。
  - `participant_metadata.loginAt` 优先使用真实登录事件时间，旧数据无事件时回退到 participant 创建时间。

**验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

### 2026-06-06 admin 首次加载、教学框选与变量导出自检修正

**背景**：用户用新 `CCC/DDD` session 重新导出后复核变量模块，同时发现 admin Session 页第一次打开偶发 `Failed to fetch`、副线教学步骤框选位置因滚动布局调整后不准。

**本轮修复**：
- admin Session 概览首次加载增加短重试，缓解一键启动时 web 已 ready 但 server 尚未完全监听导致的首包竞态；刷新后正常的现象本质上就是这个启动时序问题。
- 测试轮教学的副线作答步骤从框选选项容器改为框选第一枚可点击选项按钮，避免上一题 / 下一题固定区与可滚动答题区改版后定位偏移。
- 动态变量自检表继续保留，但修正判断口径：旧 session 缺登录事件、历史 AI 日志缺字段、未选具体副线题的 side AI 只标为“有风险”，不再误归类为“缺失原始数据”。

**新导出包复核**：
- `C:\Users\ASUS\Desktop\1` 中新 session 为 `0P937N`，参与者 `CCC/DDD`；旧 `AAA/BBB` session 仍在包内，审计时需区分。
- 新 session 已看到 participant 目录、练习轮公司、正式段 1/2、测试题、两段休息问卷、主线 AI、图片附件、副线计划/释放/提醒/作答与 `variables.json`。
- 新包图片路径已回正到 participant 下 `attachments/images/...`，AI JSON 中附件引用可解析。

**验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。

### 2026-06-06 数据库文件夹手册新增

**背景**：变量记录模块第一期基本收口后，需要一份研究者能快速读懂导出包的手册，把 `变量记录与服务器导出方案.md` 的设计口径和当前实际数据库 / 导出结构对齐。

**本轮新增**：
- 新增 `02_specs/04_pre_deploy/数据库文件夹手册.md`。
- 手册按实际导出路径解释：
  - 根目录 `manifest` 与变量自检文件。
  - session 层 `session_metadata.json`、`randomization.json`。
  - participant 层 `participant_metadata.json`、`variables.json`。
  - 问卷、练习轮、正式三段、公司目录、AI 聊天、副线目录、事件目录、图片附件。
  - Prisma 数据表到导出文件的对应关系。
  - 常用变量查找路径和快速审查清单。

### 2026-06-06 neat-freak 文档收尾

**背景**：本阶段完成实验 1/2/3、变量记录、服务器导出和数据库文件夹手册后，项目入口文档需要同步，避免下次接手者仍按旧的 7 模块或启动阶段理解项目。

**本轮同步**：
- 根 `README.md` 新增“变量记录与服务器导出”模块，补齐 `storage/`、关键 Prisma 模型、当前完成状态与上线前待办。
- `02_specs/README.md` 补齐 `04_pre_deploy/`、实验 123 计划、变量记录方案、自检表和数据库文件夹手册。
- `apps/server/README.md` 补齐 `recording` 模块、export job 接口、附件/导出存储口径。
- `01_rules/PROJECT_RULES.md` 将“启动阶段”旧口径更新为 2026-06-06 的“长期实现 + 本地实测 + 上线前收口”阶段。

### 2026-06-06 启动 prompt 更新与阶段 Git 收口

**背景**：当前项目已完成实验 1/2/3、变量记录、服务器导出、自检表和数据库文件夹手册，需要把下一轮新对话的启动提示更新到最新口径，并将本阶段进度提交到本地 Git。

**本轮同步**：
- 重写根目录 `启动prompt.txt`，更新为 2026-06-06 后的项目接手 prompt。
- 新 prompt 明确开局必读文档、当前 8 个大模块、实验 1/2/3 口径、变量导出结构、启动端口、Git 和文档修改纪律。
- 准备把本阶段代码、schema、migration、规格文档、测试导出样本和启动 prompt 一并收口提交。

### 2026-06-06 上线前 P0 部署结构第一期

**背景**：用户已购买服务器与域名，域名 ICP 审核中；当前目标从本地实测推进到服务器裸 IP 可部署验证。

**本轮新增**：
- 新增 `02_specs/05_server_deploy/上线前工作指导.md`，明确 SSH 私钥不进仓库、P0/P1/P2 上线阶段、数据持久化和正式实验前运维边界。
- 新增 `02_specs/05_server_deploy/部署运行手册.md`，记录 Docker 单机部署、生产环境变量、compose 启停、日志查看和 P1/P2 收口提醒。
- 新增 `02_specs/05_server_deploy/README.md`，把服务器上线文档从 `04_pre_deploy` 的变量/数据库文档中拆出。
- 新增 `apps/web/Dockerfile`、`apps/server/Dockerfile`、`apps/server/docker-entrypoint.sh`、`compose.production.yml`、`.env.production.example`、`.dockerignore`。
- `.gitignore` 补充 `.secrets/`、私钥后缀与 `.env.production.example` 放行规则。
- 记录部署协作经验：长耗时环境配置任务后续优先写成带阶段进度输出的脚本或分步骤命令，便于用户自行运行并观察进度。

**本轮修复**：
- `apps/server/package.json` 的 `start:prod` 从 `node dist/main` 修正为 `node dist/src/main`，匹配当前 NestJS 构建产物。
- `apps/server` 补充直接生产依赖 `express` 与 `multer`，避免容器生产启动时依赖靠间接安装侥幸存在。
- `apps/server/src/main.ts` 的强制读取 `.env` 逻辑改为仅在非 production 生效，避免生产容器中的 `DATABASE_URL` 被本地 `.env` 覆盖成 `localhost:5432`。
- Docker build 上下文排除真实 `.env` 与私钥文件。

**SSH 私钥位置**：
- 已从桌面移动到仓库外：`E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem`。

**验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
- `docker compose --env-file .env.production.example -f compose.production.yml config` 通过。
- `docker compose --env-file .env.production.example -f compose.production.yml build` 通过。
- 使用临时端口 `3100/3101` 本地启动生产式 compose 验证：
  - PostgreSQL healthy。
  - server healthy。
  - `http://localhost:3101/health` 返回 `{"status":"ok","service":"server"}`。
  - `http://localhost:3100/login` 返回 HTTP 200。

**下一步**：
- 进入服务器裸 IP 部署：安装/检查 Docker，上传或拉取项目，创建服务器 `.env.production`，执行生产 compose 启动。
- 裸 IP 跑通后再接 P1：域名、HTTPS、反向代理和公网端口收口。

### 2026-06-06 上线部署可观察脚本补充

**背景**：用户反馈 Docker / 环境配置类任务耗时长，后续希望优先写出脚本并带阶段进度输出，由用户运行并观察终端反馈。

**本轮新增**：
- 新增 `02_specs/05_server_deploy/命令运行清单.md`，集中列出后续本地 PowerShell、SSH 登录、服务器初始化、生产启动、日志查看、重启停止和重新部署命令。
- 新增 `scripts/deploy/check-server.ps1`：本地通过 SSH 检查服务器登录、系统、CPU、内存、磁盘、Docker、端口和防火墙提示。
- 新增 `scripts/deploy/fix-ssh-key-permissions.ps1`：修复 Windows OpenSSH 报 `UNPROTECTED PRIVATE KEY FILE` 时的私钥 ACL。
- 新增 `scripts/deploy/probe-ssh-users.ps1`：私钥权限修复后若仍 `Permission denied (publickey)`，自动试探常见 Linux 用户名。
- 新增 `scripts/deploy/upload-project.ps1`：本地打包项目并上传到 `/opt/multi-cooperation`，排除 `.git`、`node_modules`、构建产物、`.env*`、`storage` 和私钥。
- 新增 `scripts/deploy/create-prod-env.ps1`：从本地 `apps/server/.env` 读取 AI provider 配置，生成 PostgreSQL 密码并上传服务器 `.env.production`，避免在聊天或文档中暴露 API key。
- 新增 `scripts/deploy/prepare-server.sh`：服务器侧安装基础工具、Docker / compose plugin，并创建应用目录。
- 新增 `scripts/deploy/deploy-prod.sh`：服务器侧执行 compose config、build、up、server health、web 检查，并输出每阶段进度。
- 新增 `scripts/deploy/show-prod-logs.sh`：服务器侧快速查看 compose 服务日志。
- 更新 `02_specs/05_server_deploy/部署运行手册.md`，把服务器 P0 部署拆成“检查服务器 -> 上传项目 -> 初始化服务器 -> 创建 env -> 启动生产服务”的可观察步骤。
- `check-server.ps1` 改为远程命令失败后立即停止，避免 SSH 失败后继续跑后续检查造成误导。
- SSH / SCP 命令补 `IdentitiesOnly=yes`，避免 Windows OpenSSH 混用其他身份文件导致判断不清。
- `upload-project.ps1` 修正为原生命令失败后立即停止；创建 `/opt/multi-cooperation` 时若普通用户无权限，会尝试 `sudo mkdir` 并 `sudo chown ubuntu`。
- `check-server.ps1` 的防火墙提示改为可尝试 `sudo ufw status`，避免非 root 用户只看到误导性报错。
- `upload-project.ps1` 修正远端 staging 目录位置：不再使用 `/opt/multi-cooperation/.deploy-new`，改用 `/tmp/multi-cooperation-deploy-new`，避免 `rsync --delete` 同步父目录时导致源文件 vanished。
- `upload-project.ps1` 修正环境变量排除规则：不再把 `.env.production.example` 当作 `.env.*` 排除，后续上传会保留生产环境变量模板。
- 补充口径：`.env.production` 里的 `POSTGRES_PASSWORD` 是 PostgreSQL 内部数据库密码；`OPENAI_*` 是 AI provider 接入配置，基础版/高级版 AI 仍由实验运行时配置和前端能力控制，不靠两套 key 表示。

**验证**：
- `check-server.ps1` PowerShell 语法检查通过。
- `upload-project.ps1` PowerShell 语法检查通过。
- 本机 `bash.exe` 是 Windows/WSL stub 且缺少可用 `/bin/bash`，shell 脚本语法需在服务器真实 bash 环境下再执行 `bash -n`。
- SSH 用户名已探测确认为 `ubuntu`，不是 `root`；`命令运行清单.md` 已改为显式使用 `-User ubuntu`。
- 后续服务器部署步骤改为逐步执行，每一步由用户明确允许或自行运行，不默认连续推进。

### 2026-06-07 服务器 P0 裸 IP 部署前置检查与上传

**背景**：进入服务器裸 IP 部署验证前，先按可观察脚本逐步检查 SSH、服务器基础环境并上传项目。

**本轮结果**：
- SSH 私钥 Windows ACL 已修复，OpenSSH 不再因 `UNPROTECTED PRIVATE KEY FILE` 拒绝使用。
- 服务器 SSH 用户名确认为 `ubuntu`，主机名为 `VM-4-3-ubuntu`。
- 服务器基础检查通过：
  - CPU：4 核。
  - 内存：约 7.6GiB，总可用约 6.9GiB。
  - 系统盘：约 178G，剩余约 164G。
  - Docker：`29.5.2`。
  - Docker Compose：`v5.1.4`。
  - 当前监听端口主要为 `22`。
- `upload-project.ps1 -User ubuntu` 已成功把项目上传并解压到服务器：`/opt/multi-cooperation`。

**下一步**：
- SSH 登录服务器，执行 `bash scripts/deploy/prepare-server.sh` 做服务器初始化复核。
- 创建服务器 `.env.production`。
- 执行 `bash scripts/deploy/deploy-prod.sh` 启动生产 compose 并验证 `3000 / 3001` 裸 IP 访问。
- 2026-06-07 补充：服务器 SSH 用户为 `ubuntu`，服务器端初始化和部署命令清单已改为 `sudo bash ...`；云厂商文件管理器默认 `/root` 看不到项目时，应切到 `/opt/multi-cooperation`。
- 2026-06-07 补充：`命令运行清单.md` 增加”当前进度”与第 5 步提示，明确 1-4 已完成，第 5 步推荐退出 SSH 后回本地 PowerShell 执行 `create-prod-env.ps1`。

### 2026-06-07 服务器 P0 裸 IP 部署完成

**背景**：在完成前置检查、上传和初始化后，执行完整的 P0 部署流程。

**本轮结果**：
- 修复 `create-prod-env.ps1` 的 PowerShell 5.x 兼容问题：`RandomNumberGenerator::Fill()` 改为 `RNGCryptoServiceProvider.GetBytes()`。
- `create-prod-env.ps1` 成功执行：从本地 `apps/server/.env` 读取 AI 配置，生成 PostgreSQL 密码，上传 `.env.production` 到服务器。
- 修复容器名冲突：执行 `docker compose down` 清理旧容器后重新部署。
- `deploy-prod.sh` 全部 8 个阶段通过：
  - `[1/8]` 检查部署文件 ✅
  - `[2/8]` 显示 Compose 配置 ✅
  - `[3/8]` 构建镜像 ✅（server + web）
  - `[4/8]` 启动服务 ✅（postgres healthy → server healthy → web started）
  - `[5/8]` 等待容器 ✅
  - `[6/8]` 检查 server 健康 ✅（`{“status”:”ok”,”service”:”server”}`）
  - `[7/8]` 检查 web ✅
  - `[8/8]` 部署摘要 ✅
- 三个容器全部正常运行：
  - PostgreSQL：`multi_cooperation_postgres_prod` — healthy
  - Server：`multi_cooperation_server_prod` — healthy，端口 3001
  - Web：`multi_cooperation_web_prod` — started，端口 3000
- 云服务器防火墙已放行 TCP 3000 和 TCP 3001。

**P0 验收状态**：
- ✅ `docker compose up -d --build` 能启动完整服务
- ✅ server 健康检查通过
- ✅ 浏览器能打开前端
- ⏳ 完整实验流程验证（登录 → 配对 → 指导语 → 测试题 → 测试轮 → 正式 ready）待本地浏览器验证

**文档同步**：
- `02_specs/05_server_deploy/命令运行清单.md` 重写为运维命令快速参考。
- `02_specs/05_server_deploy/部署运行手册.md` 精简已完成的 P0 步骤。
- `02_specs/05_server_deploy/上线前工作指导.md` 顶部标记 P0 已完成。
- `02_specs/05_server_deploy/README.md` 更新文件说明。

### 2026-06-07 线上 P0 debug：数据库 schema 漂移修复 + GitHub 推送

**背景**：首次在线上测试登录和 admin 时发现 500 错误。

**问题定位**：
- 服务器日志报 `The column TaskAssignment.bSequenceIndex does not exist in the current database`
- Prisma schema 有 `bSequenceIndex` 字段但从未生成对应 migration
- 服务器数据库有 8 个迁移，但缺少此字段

**修复**：
- 直接在服务器 PostgreSQL 执行 `ALTER TABLE "TaskAssignment" ADD COLUMN IF NOT EXISTS "bSequenceIndex" INTEGER` + 创建索引
- 重启 server 容器后健康检查通过

**GitHub 推送**：
- 完善中文 README.md（项目简介、技术栈、快速开始、文档导航）
- 新增英文 README.en.md
- 更新 .gitignore 排除 `00_start_materials/`（原始材料太大不适合入库）
- 从 git 跟踪中移除 00_start_materials（本地文件保留）
- 成功推送到 https://github.com/yezhouyedu/multicooperation

**待办**：
- 本地数据库也有 drift，需要在本地重新同步
- 全面 debug 线上功能（APP_FLOW 每一步 check）

### 2026-06-07 线上全面 debug：schema 漂移修复 + 代码兼容性修复

**背景**：首次在线上测试时发现多个 500 错误和功能异常。

**问题定位与修复**：
1. **数据库 schema 漂移**：`TaskAssignment.bSequenceIndex` 和 `RandomizationAudit.bAssignmentMethod/bAssignmentLog` 列缺失
   - Prisma schema 有这些字段但从未生成对应 migration
   - 直接在服务器 PostgreSQL 执行 ALTER TABLE 添加缺失列
2. **案例库导入路径**：`CASE_LIBRARY_ROOT` 用 `resolve(process.cwd(), '..', '..', '00_start_materials', '原始材料')`，在 Docker 中路径错误
   - 修复为 `process.env.CASE_LIBRARY_ROOT || resolve(process.cwd(), '00_start_materials', '原始材料')`
3. **高级版 AI 环境变量**：`compose.production.yml` 缺少 `OPENAI_ADVANCED_*` 变量
   - 补充 `OPENAI_ADVANCED_BASE_URL/API_KEY/MODEL`
4. **Admin 错误提示**：硬编码 `http://localhost:3001`
   - 改为使用 `serverBaseUrl` 环境变量

**APP_FLOW 兼容性审查结论**：
- ✅ 前端 API 调用使用环境变量（Docker 构建时注入）
- ✅ 后端无 Windows 硬编码路径
- ✅ CORS 已开启
- ✅ SSE 使用环境变量构建 URL
- ✅ 数据库连接使用 Docker 内部 hostname
- ✅ 文件上传/存储走 Docker volume
- ✅ .env 文件未被 git 跟踪
- ⚠️ 案例库导入需要通过环境变量配置路径（已修复）

### 2026-06-07 线上 APP_FLOW smoke 验证 + 运维部署路线收口

**背景**：P0 裸 IP 已跑通后，按 `APP_FLOW.md` 审查“本地可跑全流程上传到线上后是否有环境/路径/schema/导出问题”，并要求保留线上可回滚版本。

**上线前备份**：
- 在服务器创建 `/opt/multi-cooperation-backups/20260607_1238xx/` 备份目录。
- 已备份：
  - 当前项目目录压缩包 `project.tar.gz`
  - 当前 PostgreSQL dump `database.sql`
  - 当前 compose 状态 `compose-ps.txt`
  - 后端 storage volume 快照 `server-storage.tar.gz`
  - `SHA256SUMS.txt`

**本轮修复**：
- 新增正式 migration：`20260607093000_formalize_online_schema_drift`
  - 幂等补齐 `TaskAssignment.bSequenceIndex`
  - 幂等补齐 `RandomizationAudit.bAssignmentMethod/bAssignmentLog`
  - 服务器 `prisma migrate deploy` 已记录该 migration。
- 修复高级版 AI key 读取：
  - advanced AI 先读 admin advanced 配置
  - 再读 `OPENAI_ADVANCED_*`
  - 最后 fallback 到基础版 `OPENAI_*`
- `.env.production.example` 补齐 `OPENAI_ADVANCED_BASE_URL/API_KEY/MODEL`。
- `create-prod-env.ps1` 改为：
  - 后续重跑默认复用服务器已有 `POSTGRES_PASSWORD`
  - 同步基础/高级 AI 配置
  - scp 使用 `-O`，避免默认 SFTP 模式不稳定。
- `upload-project.ps1` 尝试改为可观察分片上传，但本地到服务器的大包 SSH 上传仍不稳定。
- 新增 `scripts/deploy/sync-from-github.sh`，后续推荐“本地 commit/push → 服务器 GitHub pull → deploy-prod.sh”的部署路线。

**线上部署验证**：
- 使用小补丁包上传本轮变更并执行 `sudo bash scripts/deploy/deploy-prod.sh`。
- server/web 生产构建通过。
- server health：`http://49.233.203.108:3001/health` 返回 200。
- web login：`http://49.233.203.108:3000/login` 返回 200。
- 三容器状态正常：
  - postgres healthy
  - server healthy
  - web up

**APP_FLOW smoke 测试结果**：
- 创建线上测试被试并登录配对成功。
- 角色随机分配成功，对外流程使用“尽调员 / 投资经理”。
- instruction → ready practice → practice quiz 通过。
- practice quiz 正确答案提交后进入 practice。
- 测试轮草稿保存、AI 请求、5 分钟门槛、A 到点提交、B 查看 A 信息、B 完成通过。
- 测试轮教学完成门槛生效：未记录 `practice_tutorial_completed` 时，formal ready 被拒绝；补齐后通过。
- formal ready 双方通过后进入 formal work segment 1。
- 正式段材料、草稿、副线 exposure/answer、A 提交解锁、B 查看/完成通过。
- B 在正式段开始时处于 PreA fallback，符合“锁定池为空时 fallback 到 A 正在处理公司”的口径。

**变量导出验证**：
- admin export job 创建、完成、下载 zip、解压成功。
- 导出包包含：
  - `variables.json`
  - `events/events.jsonl`
  - `ai_chat.jsonl`
  - `side_responses.jsonl`
  - `variable_implementation_summary.json`
- 正确归因的 AI 请求已进入对应公司 `ai_chat.jsonl`。
- 副线导出 `side_responses.jsonl` 有记录。
- 自检 `missingSource` 为空。
- 本轮 smoke 中曾有一次手工 API 调用漏传 `companyId`，自检正确标记为 `main AI task attribution` risk；前端实际使用 `company.id` 传参，不属于线上产品 bug。

**运维结论**：
- 当前裸 IP 线上版本可运行，且已具备回滚备份。
- 本地到服务器的大包 SSH 上传链路不稳定，后续不优先依赖全量 scp 上传。
- 后续代码上线推荐：
  1. 本地完成验证。
  2. commit 并 push GitHub。
  3. 服务器执行 `sudo bash scripts/deploy/sync-from-github.sh`。
  4. 服务器执行 `sudo bash scripts/deploy/deploy-prod.sh`。

### 2026-06-08 最终版副线题库与公司材料库上线

**背景**：师兄发来最终版公司材料库与副线题库，需要确认是否兼容当前 admin 导入与线上部署流程，并完成本地 / 服务器双侧验收。

**副线题库审查**：
- 对比 `副线组织信息识别正式题库_V1.0修订版.xlsx` 与旧 `C副线任务题库_V0.8.xlsx`。
- 两版都保留 `正式题库` sheet，均为 900 题，普通中性池 360、合作叙事池 540，每段 300。
- 新版不是单纯内容替换：旧版字段 `skeleton_type / narrative_subtype / distractor_note` 被弱化，新版新增 `event_archetype / event_chain / language_variant / narrative_components`。
- 已适配新版字段：`SideTaskItem` 增加新版字段，导入服务读取并保存，导出 `side_responses.jsonl` 也带上新版字段。
- 副线导入语义同步改为“替换式导入”：导入新 Excel 后，不在本次 Excel 中的旧题会自动停用，避免旧样例题混入后续抽题。

**公司材料库审查**：
- 师兄的 `admin上传版/正式/P01-P36` 基本符合 `admin材料库上传手册.md`：每家公司有 `case.json`、`participant/shared`、`participant/diligence`、`participant/manager`、`research`。
- 新包没有 `测试轮/` 目录，因此测试轮继续沿用旧 `00_start_materials/原始材料/测试轮/P01`。
- 当前后端默认扫描 `00_start_materials/原始材料/正式` 与 `00_start_materials/原始材料/测试轮`，不是自动扫描 `admin上传版`。已把师兄正式材料同步到本地实际扫描目录，并上传到服务器实际扫描目录。
- 生产环境补充 `CASE_LIBRARY_ROOT=/app/00_start_materials/原始材料`，避免容器内默认路径错到 `/app/apps/server/00_start_materials/原始材料`。

**本地验证**：
- Docker Desktop 启动后，本地 PostgreSQL 正常。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
- `corepack pnpm --dir apps/server exec prisma migrate deploy` 通过。
- 本地导入新版副线题库后 active 题库为 900 条 V1.0，旧 5 条样例题已停用。
- 本地导入材料库共 37 个公司：正式 36 个 + 测试轮 1 个。
- 去掉 `next/font/google`，前端构建不再依赖 Google Fonts 外网请求，改用系统字体栈。

**线上部署与验证**：
- 部署前创建服务器备份：`/opt/multi-cooperation-backups/20260608_131257_before_final_materials`。
- 通过云控制台上传约 93MB 材料包；SSH 直传大文件仍不稳定，已清理本地 C 盘临时包、服务器 `/tmp` 残留包和分片。
- 线上生产部署通过，server/web build 均通过，health OK。
- 线上副线题库验证：
  - active 总数：900。
  - V1.0 修订版：900。
  - 新版字段完整数：900。
  - 普通中性池：360；合作叙事池：540。
  - workSegment 1/2/3 各 300。
- 线上公司材料库验证：
  - 总导入：37。
  - 正式：36。
  - 测试轮：1。
  - 抽样 P01/P36 均为正式公司：每家公司被试侧材料全集 11 份，但单个被试实际只看到 6 份；尽调员看到 1 份共享 + 5 份尽调员专属，投资经理看到 1 份共享 + 5 份投资经理专属；研究者材料另有 1 份。
  - 测试轮 P01 保留旧材料，材料数 10。

**运维补充**：
- Clash 规则分流后 SSH 延迟恢复正常：Codex 走代理，SSH 22 端口直连，中国 IP 直连。
- `sync-from-github.sh` 在当前服务器上遇到 GitHub 凭据问题：`could not read Username for 'https://github.com'`；后续若继续用 GitHub pull 部署，需要公开仓库或配置 deploy key / token。
- 当前服务器保留两版备份：`20260607_123801` 与 `20260608_131257_before_final_materials`。建议确认本轮最终材料稳定后再删旧的 20260607 备份。

### 2026-06-08 线上服务器存储持久化路径收口

**背景**：整理服务器文件夹时发现一个上线风险：`compose.production.yml` 已把 Docker volume 挂载到 `/app/storage`，但后端部分运行时文件仍按 `process.cwd()/storage` 解析。在生产容器中 `process.cwd()` 为 `/app/apps/server`，因此材料、导出包、图片附件可能落到容器可写层 `/app/apps/server/storage`，重建容器时存在丢失风险。

**修复**：
- 新增统一存储路径入口 `apps/server/src/storage-paths.ts`。
- 后端材料库、临时上传、静态材料服务、AI 图片附件、变量导出统一读取 `STORAGE_ROOT`。
- 生产 compose 增加 `STORAGE_ROOT=/app/storage`，`.env.production.example` 同步补齐说明。
- 已把线上旧容器内 `/app/apps/server/storage` 的约 100MB 数据迁移到 Docker volume `multi-cooperation_server_storage`。

**线上部署与验证**：
- 以小补丁包方式上传并重新执行 `sudo bash scripts/deploy/deploy-prod.sh`，server/web 构建与启动通过。
- 线上 `STORAGE_ROOT=/app/storage` 生效，`/app/storage` 约 100MB，`exports` 与 `attachments` 目录可写。
- `http://127.0.0.1:3001/health` 返回 200，`http://127.0.0.1:3000/login` 返回 200。
- 抽查 P01 材料静态 URL 返回 200。
- 重新执行线上材料库导入后，材料仍写入持久化 volume。
- 数据库中早期残留 `company-p01-baseline` 被 1 条旧任务引用，因此未删除，改为 `usage=legacy`，避免进入正式公司池。
- 当前线上公司池：正式 36 家、测试轮 1 家、legacy 1 家；P01/P36 单家公司均为参与者侧 11 份、研究员 1 份，尽调员可见 6 份，投资经理可见 6 份。
- 当前线上副线 active 题库：900 条，均为 V1.0 修订版，新字段完整 900 条。

**运维说明**：
- 项目源材料位于 `/opt/multi-cooperation/00_start_materials/原始材料`，用于 admin 导入扫描。
- 运行时材料、AI 图片附件、变量导出包位于 Docker volume `multi-cooperation_server_storage`，容器内路径为 `/app/storage`。
- PostgreSQL 数据位于 Docker volume `multi-cooperation_postgres_data`。
- 本轮临时上传包和迁移临时目录已清理；保留服务器备份 `20260607_123801`、`20260608_131257_before_final_materials`、`20260608_165507_storage_root_patch_files`。

### 2026-06-08 服务器关键知识文档同步

**背景**：用户需要把 Docker、volume、服务器目录树、线上状态和备份信息整理成会前/运维可读文档，并按 neat-freak 收尾要求同步正式部署 specs，避免关键事实只留在口头记录或被 git 忽略的资料区。

**文档变更**：
- 新增 `00_start_materials/线上部署/服务器关键知识须知.md`：记录 `/opt/multi-cooperation` 目录树、Docker 三容器、两个 volume、源材料库与运行时 storage 的区别、当前线上公司池/题库状态、备份目录和危险命令。
- 更新 `02_specs/05_server_deploy/README.md`：补充服务器关键知识文档入口，并写明代码目录、PostgreSQL volume、server storage volume 的边界。
- 更新 `02_specs/05_server_deploy/部署运行手册.md`：把数据持久化章节改为最新口径，明确 `multi-cooperation_postgres_data` 与 `multi-cooperation_server_storage` 的用途。
- 更新 `02_specs/05_server_deploy/命令运行清单.md`：新增查看 volume、storage 路径和可写性的命令，并再次标注不要执行 `docker compose down -v` 或删除生产 volume。

**注意**：
- `00_start_materials/` 当前被 `.gitignore` 忽略，因此 `服务器关键知识须知.md` 是本地会议/资料文档；进入 GitHub 的正式口径已同步到 `02_specs/05_server_deploy/`。

### 2026-06-08 Admin 被试名单删除 + AI 参数自动加载 + 系统提示词可调节

**背景**：与师兄开完会后，需要对 admin 后台进行三项改进：
1. 被试名单 tab 只允许添加太蠢，需要加入删除功能（单个、批量、全部删除）
2. AI 参数 tab 每次新打开网页都要点击加载，需要自动加载；同时将系统提示词做成可调节参数
3. 截图功能在线上无法复制到剪切板（已确认是裸 IP HTTP 部署导致的浏览器安全限制，待 HTTPS 部署后自动解决，本次不改）

**本轮实现**：

#### 任务1：Admin 被试名单删除功能

**后端改动**：
- `apps/server/src/admin/admin.service.ts`：新增 `deleteParticipant(id)` 和 `deleteParticipants(ids)` 方法
- `apps/server/src/admin/admin.controller.ts`：新增 `DELETE /admin/participants/:id` 和 `POST /admin/participants/delete-batch` 端点

**前端改动**：
- `apps/web/src/app/admin/page.tsx`（ParticipantsTab 组件）：
  - 新增 `selectedIds` state 管理选中的被试 ID 列表
  - 每行被试右侧新增红色"删除"按钮，点击弹出确认框后调用 `DELETE /admin/participants/:id`
  - 表头新增"全选"checkbox
  - 每行左侧新增单选 checkbox
  - 新增"批量删除"按钮（有选中项时显示），点击弹出确认框后调用 `POST /admin/participants/delete-batch`
  - 新增"全部删除"按钮（独立红色按钮），点击弹出二次确认框后调用 `POST /admin/participants/delete-batch` 传入全部 ID

#### 任务2：AI 参数自动加载 + 系统提示词可调节

**数据库改动**：
- `apps/server/prisma/schema.prisma`：AiSettings 模型新增 `systemPromptMain` 和 `systemPromptSide` 字段（默认空字符串，代码层面 fallback 到内置默认值）
- 执行 `prisma generate` 生成新的 Prisma Client

**后端改动**：
- `apps/server/src/admin/admin.service.ts`：
  - `getAiSettings()` 返回值新增 `systemPromptMain` 和 `systemPromptSide`
  - `saveAiSettings()` 支持保存这两个字段
- `apps/server/src/ai/ai.service.ts`：
  - `buildSystemPrompt()` 改为 `async`，从数据库读取系统提示词
  - 如果数据库中的值为空，使用内置默认值作为 fallback

**前端改动**：
- `apps/web/src/components/admin-ai-settings-panel.tsx`：
  - `useEffect` 自动调用 `loadSettings()`，移除手动"加载 AI 参数"按钮
  - 新增"系统提示词"区块，分两个 textarea：主线系统提示词和副线系统提示词
  - 每个 textarea 下方用灰色小字显示当前默认值（当值为空时）
  - 新增"恢复默认值"按钮，清空数据库中的值以使用内置默认值
  - 保存时一起提交到后端

**构建验证**：
- `corepack pnpm --filter server build` 通过
- `corepack pnpm --filter web build` 通过（22 个页面全部生成）

**待办**：
- 记录 progress.md（本轮）
- Git 提交
- 线上服务器部署验证

### 2026-06-16 本地修复：测试轮计时、AI 显示配置、B 解锁 A 原始材料、Admin Session 管理

**背景**：与师兄测试后发现测试轮计时、AI 显示、B 材料解锁、异常 session 处理、A 端尽调表 v3 和变量导出字段需要在上线前收口。本轮按用户要求只做本地修复、本地运行验证、Git 记录和 GitHub 推送；线上服务器部署另开一轮处理，避免 SSH / 代理 / 远程转义继续拖慢主线。

**后端改动**：
- 新增 Prisma migration `20260616090000_ai_display_names_and_b_material_unlock`：
  - 为 `AiSettings` 补齐 `systemPromptMain` / `systemPromptSide` 正式 migration。
  - 新增 `basicDisplayName` / `advancedDisplayName`，默认 `aiseek` / `aiseek pro`。
  - 新增 `TaskAssignment.bViewedAMaterialsAt`。
  - 将默认测试轮时长从 10 分钟调整为 5 分钟。
- 测试轮改为“测试题通过 -> 进入教学态 workspace 但不启动倒计时 -> 双方教学完成后启动正式 5 分钟测试轮”。
- 测试轮到时自动提交 A、自动完成 B，结束后进入 `FORMAL_READY`，不再直接进入正式工作段。
- 修复 `aRemainingSeconds || 300` 导致 0 秒恢复成 300 秒的问题；跨工作段结束时先处理已到点的 A 自动提交 / 解锁，再冻结和推进。
- B 新增 `POST /experiment/session/:code/tasks/:taskId/view-a-materials`，独立记录 `b_viewed_a_materials`。
- B runtime 返回 A 侧材料，但由前端按锁定态展示；B 查看 A 尽调表和解锁 A 原始材料互相独立。
- Admin 新增 `POST /admin/sessions/delete-batch`，可删除指定 session 并释放相关 participant 临时 role，不删除被试名单。
- 全量清空实验数据补齐 AI、副线、审计、随机化等运行表清理。
- 登录重连口径调整：已存在的 WAITING / MATCHED / IN_PROGRESS / COMPLETED session 都会重连旧 session，防止同一被试重复生成多个 session。

**前端改动**：
- 测试轮 A/B 顶栏统一显示“测试轮剩余时间”；测试轮 AI 主线 / 副线输入、图片、发送、重试、追问禁用，并提示 `AI 功能将在正式任务开始后启用。`
- AI 面板标题统一为 `AI助手`；badge 使用 admin 配置的显示名，不再显示“基础版 / 升级版”。
- B 端“上游使用的 AI”话术使用配置显示名。
- 材料区删除旧 `公司概览` tab。
- B 材料区顺序调整为 shared + B 自有材料、A 尽调表、A 自有材料；A 自有材料未解锁时显示锁定态，点击任意一个解锁入口后解锁全部 A 自有材料并记录变量。
- A 端尽调表切到 v3：公司信息只保留公司简称；A.1 改为 6 行复合指标自由摘录；去掉来源材料编号列；旧 v2 草稿读取保留兼容。
- Admin Session 概览增加勾选、全选、选中导出、选中删除、单个删除；`清空实验数据` 必须输入 `我确认删除数据`。
- `ready-formal` / ready 操作失败时前端显示后端错误原因。
- B 反馈页新增跨休息恢复标记；如果 B 段末在反馈页且该公司未完成，休息结束后回到反馈页，不跳过反馈。

**变量记录与导出**：
- `company_metadata.json.timing` 新增 `bViewedAMaterialsAt`。
- `variables.json.mainline` 新增 `viewedAMaterialsCount`。
- `events/events.jsonl` 导出 `b_viewed_a_materials`。
- `answer_content.json` 支持 A 表 v3 字段，同时继续保留 `rawDraft`。
- 更新 `02_specs/04_pre_deploy/数据库文件夹手册.md`，并新增 `02_specs/04_pre_deploy/数据库文件夹手册_20260616_本地修复说明.md`。

**本地验证**：
- `corepack pnpm --filter server prisma:generate` 通过。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
- 本地 API smoke 通过：formal ready 后进入 `pre_segment_instruction`；15 秒前完成被后端拒绝；单方完成进入等待；双方完成后进入 `formal_work`；导出包包含 `instructionPlan`、`variables.instructions`、`segment_metadata.preSegmentInstruction`。

**线上部署与 HTTPS 验证**：
- 已通过 `scripts/deploy/upload-git-archive.ps1 -Service all -AllowDirty` 上传 commit `ef37f26` 到服务器 `/opt/multi-cooperation`。
- 首次 all 部署在 server recreate 时 SSH 连接中断；随后单独执行 `deploy-prod.sh server` 和 `deploy-prod.sh web` 补齐，最终 `postgres/server/web/nginx` 均正常运行。
- `https://aiseek.tech/api/health`、`https://aiseek.tech/login`、`https://aiseek.tech/admin`、`https://aiseek.tech/pre-segment-instruction` 返回 200。
- `http://aiseek.tech` 与 `https://www.aiseek.tech` 均 301 到 `https://aiseek.tech/`。
- 线上 API smoke 通过：测试轮 5 分钟自然到点后进入 formal ready，双方 ready 后进入段 1 前指导语；15 秒后双方完成并进入正式工作段 1。
- 线上选中 session 导出通过，服务器 volume 中导出 JSON 已确认包含 `instructionPlan`、`variables.instructions`、`segment_metadata.preSegmentInstruction`。
- 本地启动脚本在 sandbox 内会因 `Get-CimInstance` / Corepack 缓存权限失败；提升执行 `powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1` 后启动成功。
- `http://localhost:3001/health` 返回 200。
- `http://localhost:3000/admin` 返回 200。

**未做 / 后续**：
- 本轮未做线上服务器部署与线上 smoke；按用户要求另开一轮处理。
- 本轮没有跑完整双被试浏览器流程 smoke；已完成构建和基础本地运行连通性验证。

### 2026-06-16 线上同步：本地修复部署到裸 IP 服务器

**背景**：用户要求复查 2026-06-16 本地修复覆盖范围，并将前面全部任务同步到服务器实现。上一条记录中线上部署明确列为未做，本轮补齐服务器部署和线上基础 smoke。

**复查结论**：
- 原任务列表中的测试轮计时、测试轮 AI 禁用、AI 显示名配置、AI 标题统一、删除公司概览、清空实验数据强确认、A 表 v3、ready-formal 错误展示、重复 session 稳健性、Session 勾选删除/导出、B 反馈跨段恢复、跨工作段 A 解锁 bug、B 解锁 A 原始材料、变量记录与导出字段均已在上一轮代码中实现。
- 本轮复查发现一个小 UX 问题：B 端 A 原始材料尚未到解锁条件时也显示“解锁并查看”按钮。已修复为：未到条件只显示锁定说明，A 信息解锁后才显示解锁按钮。

**本地补充验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
- 本地 Git 新增提交 `b2c2b56 修正B端A材料未解锁提示`，并已 push 到 GitHub `main`。

**线上部署**：
- 服务器：`ubuntu@49.233.203.108`
- 目录：`/opt/multi-cooperation`
- 部署方式：GitHub 同步 + 生产 Docker 重新构建。
- 已执行：
  - `sudo bash scripts/deploy/sync-from-github.sh`
  - `sudo bash scripts/deploy/deploy-prod.sh`
- `sync-from-github.sh` 成功从 GitHub 拉取最新代码。
- `deploy-prod.sh` 成功构建 `multi-cooperation-server` / `multi-cooperation-web` 镜像，重建 `server` / `web` 容器，并保持 `postgres` 持久化 volume 运行。

**线上验证**：
- `http://49.233.203.108:3001/health` 返回 200。
- `http://49.233.203.108:3000/admin` 返回 200。
- `docker compose --env-file .env.production -f compose.production.yml ps` 显示：
  - `multi_cooperation_postgres_prod`：Up / healthy。
  - `multi_cooperation_server_prod`：Up / healthy。
  - `multi_cooperation_web_prod`：Up。
- `_prisma_migrations` 最新记录包含 `20260616090000_ai_display_names_and_b_material_unlock`，说明新增 AI 显示名和 B 解锁 A 原始材料字段 migration 已在线上应用。
- 后端日志确认新增路由已映射，包括：
  - `/experiment/session/:code/tasks/:taskId/view-a-materials`
  - `/admin/sessions/delete-batch`
  - `/admin/ai-settings`

**注意**：
- 本轮没有执行 `docker compose down -v`、没有删除任何 Docker volume、没有清空线上实验数据。
- 未做完整线上双被试人工流程 smoke；目前完成的是部署脚本内置 health/web 检查、外部 IP 访问检查、容器状态检查和 migration 应用检查。

### 2026-06-17 修复测试轮教学自动跳步

**背景**：用户反馈测试轮教学页面存在未操作也自动进入下一步的问题；按原设计，教学步骤应当要么由浮层按钮确认，要么由被试点击指定区域后解锁，不能被程序状态同步误触发。

**原因定位**：
- `MaterialTabs` 在当前 tab 不存在时会自动切回第一个 tab，之前复用了同一个 `activateTab()`，导致程序性切换也会发出 `material_tab` 教学完成事件。
- `PracticeTutorialOverlay` 之前只按事件类型推进步骤，没有区分“用户主动操作”和“程序自动事件”；确认类步骤也通过全局事件完成，容易被同名事件误触发。

**本轮修复**：
- 教学浮层新增严格校验：需要真实操作的步骤只接受 `userInitiated: true` 的事件；确认类步骤不再响应外部全局事件，只由浮层内“我了解了”按钮完成。
- `MaterialTabs` 只有用户点击材料 tab 时才发送 `material_tab` 教学事件；程序性 fallback 切换 tab 不再推进教学。
- `SideTaskStrip` 的打开副线面板、点击副线答案事件补充 `userInitiated: true`，保留真实操作解锁逻辑。

**验证**：
- `corepack pnpm --filter web build` 通过。
- Git 提交 `eef5c9b 修复测试轮教学自动跳步`，并已 push 到 GitHub `main`。
- 线上服务器 GitHub 直连同步失败，报 `Failed to connect to github.com port 443 ... Connection timed out`；随后改用本地 `git archive` 源码包上传到服务器。
- 上传源码后服务器源码已确认包含 `userInitiated` 修复；本轮为纯前端修复，因此只执行 `docker compose --env-file .env.production -f compose.production.yml build web` 和 `up -d web`。
- 线上验证：`http://49.233.203.108:3001/health` 返回 200，`http://49.233.203.108:3000/admin` 返回 200，`web` 容器已重新创建并运行，`server` / `postgres` 保持健康。

### 2026-06-17 长期部署链路收口：Git archive 上传 + 定向部署

**背景**：服务器部署连续多次被 GitHub 直连超时、SSH 会话中断、Docker 完整重建耗时、Windows/Linux 行尾差异拖慢。用户要求把该问题作为长期问题处理，形成可复用方案，并记录到 progress 与 lessons。

**本轮实现**：
- 新增 `.gitattributes`，固定 `.sh` 为 LF、`.ps1` 为 CRLF，降低 shell 脚本进入 Linux 后的行尾风险。
- `scripts/deploy/deploy-prod.sh` 支持 `all` / `web` / `server` 参数，纯前端修复可以只构建并重启 `web`。
- 新增 `scripts/deploy/upload-git-archive.ps1`，默认使用 `ubuntu@49.233.203.108`，从当前 `git archive HEAD` 生成源码包并上传服务器，远端同步时保留 `.env.production`、`00_start_materials/`、`storage/`、`apps/server/storage/`。
- `upload-git-archive.ps1` 会在远端同步后修正 `.sh` 与 `apps/server/docker-entrypoint.sh` 行尾和可执行权限，再按 `-Service web/server/all` 执行定向部署。
- 调整旧 `scripts/deploy/upload-project.ps1`：默认用户改为 `ubuntu`，打包和同步时排除 `00_start_materials`，避免日常部署误传大材料目录或覆盖服务器材料库。
- 更新 `02_specs/05_server_deploy/命令运行清单.md` 与 `02_specs/05_server_deploy/部署运行手册.md`：当前推荐路线改为本地 Git archive 上传；服务器 GitHub 直连降级为可选路线。
- 更新 `03_tracking/lessons.md`，记录本次部署链路长期化教训。

**验证**：
- `upload-git-archive.ps1` PowerShell AST 语法检查通过。
- `upload-project.ps1` PowerShell AST 语法检查通过。
- 新脚本已实测：`powershell -ExecutionPolicy Bypass -File scripts/deploy/upload-git-archive.ps1 -Service web` 成功上传当前 commit、同步服务器源码、只重建并重启 `web`。
- 服务器侧 `deploy-prod.sh web` 已在 Linux 环境执行通过；构建完成后 server health 与 web health 均通过。
- 外部访问验证：`http://49.233.203.108:3001/health` 返回 200，`http://49.233.203.108:3000/admin` 返回 200。

**仍需人工配置 / 后续建议**：
- 如需继续使用服务器直连 GitHub，需要配置稳定 GitHub 网络、deploy key 或 token；当前不再依赖此路线。
- 更完整的长期方案是 GitHub Actions 或 self-hosted runner：Codex 只负责 push，CI 负责构建和部署。
- 正式实验前仍需补自动备份与恢复演练，部署链路稳定不等于数据安全闭环完成。
### 2026-06-17 正式问卷接入：三章实验问卷 V1.1、Admin 配置与导出更新

**背景**：用户确认招募问卷后续单独外发，不放入系统；师兄 HTML 只作为题目来源，不复用其中计时、预览、样式、论文来源和内部备注。平台需要提取纯问卷题目，接入现有前端风格，并在后端、数据库导出、admin 配置和文档中形成完整口径。

**后端改动**：
- 新增 `apps/server/src/questionnaire/three-chapter-v1-1.ts`，从 `三章实验问卷可用版_V1.1_可点击计时版(1).html` 提取正式问卷模板。
- 模板 ID 固定为 `three-chapter-questionnaire-v1-1`；招募问卷明确排除在系统外。
- `ExperimentConfig.activeQuestionnaireTemplate` 改为正式三章问卷模板；旧“休息问卷模板”不再作为主配置入口。
- 正式问卷运行逻辑：
  - 工作段 1 后问卷保存为 `segmentIndex = 2`。
  - 工作段 2 后问卷保存为 `segmentIndex = 4`。
  - 工作段 3 后问卷在结束页先呈现，保存为 `segmentIndex = 6`。
  - 最后问卷随后呈现，保存为 `segmentIndex = 99`。
- 问卷提交写入 `QuestionnaireResponse`、`TaskProgress` 和 `ExperimentEvent`，事件类型为 `segment_survey_submitted` / `post_survey_submitted`。

**前端改动**：
- 新增通用 `QuestionnaireForm`，支持量表、单选、多选、数字输入、开放题和条件追问。
- `/break` 改为渲染后端返回的工作段后问卷，提交后留在休息页等待下一阶段。
- `/workspace/end` 改为先补第三次工作段后问卷，再呈现最后问卷；最后问卷提交后才显示实验完成页。
- admin 新增“问卷配置”tab，展示问卷组装说明，并支持编辑题干、选项、量表端点和开放题最大字数。
- “实验配置”tab 中移除旧“休息问卷模板”编辑区，避免两套问卷配置并存。

**变量记录与导出**：
- `questionnaires/` 导出结构更新为：
  - `practice_quiz.json`
  - `segment_1.json`
  - `segment_2.json`
  - `segment_3.json`
  - `post_survey.json`
- `variables.json.questionnaire` 更新为：
  - `practiceQuizPassed`
  - `segmentSurveySubmittedCount`
  - `segment1Submitted`
  - `segment2Submitted`
  - `segment3Submitted`
  - `postSurveySubmitted`
- 动态自检中 participant 必备问卷文件同步更新为三次段后问卷和最后问卷。
- 不保存招募问卷、论文来源、论文链接、HTML 计时脚本、预览说明或内部备注。

**文档**：
- 新增 `02_specs/03_execution/问卷流程方案.md`。
- 更新 `02_specs/04_pre_deploy/数据库文件夹手册.md`，新增正式问卷导出口径章节。

**本地验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
### 2026-06-17 主界面调试：测试轮个人计时、材料 tab 稳定性、副线条残留滚动修复

**背景**：用户复查测试轮和主工作台时发现：副线任务条在待处理为 0 时右侧露出残留滚动按钮；测试轮教学结束后希望每个被试各自启动 5 分钟测试轮，而不是等双方教学都结束；B 端材料区 5 分钟前没有稳定显示 A 原始材料锁定 tab；材料 tab 点击后会自动跳回第一个材料；材料 tab 只能点左右按钮横移，不支持滚轮快速滚动。

**原因定位**：
- 副线条右侧“冒头”来自滚动提醒 ticker 的上一次动画状态残留在 `left: 100%` 附近。
- B 端材料 tab 自动跳回第一个材料，是 B 工作台在每次 runtime/company materials 刷新时强制重置 `activeSidebarKey`。
- B 端 A 原始材料识别对 `metadata.participantRole` 判断过窄，已改为大小写稳健匹配。
- 旧测试轮计时是 session 级别统一启动；用户确认改为“个人教学完成后个人测试轮倒计时开始，最终仍通过 formal ready 汇合”。

**本轮修复**：
- `SideTaskStrip`：
  - 外层副线条增加 `overflow-hidden`。
  - 当 `pendingCount = 0` 时强制停止 ticker animation 并隐藏 ticker，避免右侧残留小尾巴。
- `MaterialTabs`：
  - tab 横向区域增加滚轮横向滚动；只在 tab 区域拦截 wheel，不影响页面其他区域。
- `workspace/b`：
  - 只在任务切换或当前 active tab 不存在时回到首个材料，不再每次 runtime 刷新都跳回第一个材料。
  - A 原始材料按 `participantRole` 大小写稳健识别，并继续作为 append materials 与 shared/B 材料、A 尽调表并列显示。
- `ExperimentService`：
  - `practice_tutorial_completed` 后为该 participant 写入 `practice_timer_started`，payload 记录个人 `startedAt`、`endsAt`、`durationMinutes`。
  - runtime 在测试轮阶段优先返回当前 participant 的个人测试轮剩余时间。
  - `syncRuntime` 会检查每个 participant 的个人测试轮截止时间：A 到点自动提交，B 到点自动完成；只有 A 已提交且 B 已完成后才推进到 `FORMAL_READY`。

**本地验证**：
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
### 2026-06-17 HTTPS 与域名正式入口接入

**背景**：域名 `aiseek.tech` / `www.aiseek.tech` 已完成 A 记录解析到 `49.233.203.108`，腾讯云安全组已放行 80 / 443 / 22，用户已申请免费 SSL 证书并提供 Nginx 证书文件。裸 IP 3000 / 3001 访问已跑通，本轮把线上入口收口到 `https://aiseek.tech`。

**本轮实现**：
- `compose.production.yml` 新增 `nginx` 服务，监听 80 / 443，挂载 `/etc/multi-cooperation/certs` 中的证书文件。
- 新增 `infra/nginx/production.conf`：`http://aiseek.tech` 和 `www.aiseek.tech` 统一 301 到 `https://aiseek.tech`；`/` 反代到 web；`/api/*` 去掉 `/api` 前缀后反代到 server；SSE 相关路径关闭 proxy buffering。
- `.env.production.example` 更新为 HTTPS 口径：`NEXT_PUBLIC_SERVER_BASE_URL=https://aiseek.tech/api`，并新增 `HTTP_PUBLIC_PORT`、`HTTPS_PUBLIC_PORT`、`NGINX_CERT_DIR`。
- `scripts/deploy/deploy-prod.sh` 支持 `nginx` 定向部署，便于后续只更新证书或 Nginx 配置。

**证书口径**：
- 本地证书检查确认 SAN 同时包含 `aiseek.tech` 和 `www.aiseek.tech`。
- 证书私钥不进入 git；实际部署时上传到服务器 `/etc/multi-cooperation/certs`。

**后续验证口径**：
- 服务器 `.env.production` 需要设置 `NEXT_PUBLIC_SERVER_BASE_URL=https://aiseek.tech/api` 后重新构建 web。
- 验证入口为 `https://aiseek.tech`、`https://aiseek.tech/api/health`、`http://aiseek.tech` 跳转、`https://www.aiseek.tech` 跳转。
- HTTPS 稳定后，建议再把安全组中的公网 3000 / 3001 关闭，只保留 80 / 443 / 22。
### 2026-06-17 段前指导语流程 + 导出字段 + HTTPS smoke 计划接入

**背景**：师兄提供 `段前指导语文本与第三章叙事随机机制说明_V0.2.md`，要求在正式三段工作段前加入强制阅读材料页，并与实验 3 的合作叙事副线主题保持一致；同时保留既有问卷流程，段 3 后继续进入常规问卷和最终长问卷。

**本轮实现**：
- 新增 runtime 阶段 `PRE_SEGMENT_INSTRUCTION`，前端映射为 `pre_segment_instruction`。
- 新增 `/pre-segment-instruction` 页面，标题为“阅读材料”，前台不显示处理组、控制组或后台类型名。
- 页面强制阅读 15 秒：15 秒前按钮禁用并倒计时，15 秒后可点击；单方完成后等待另一位，双方完成后启动对应正式工作段。
- 后端新增打开/完成接口，并校验当前阶段、participant 归属、已打开记录和至少 15 秒观看时间。
- formal ready 后不再直接进入工作段 1，而是进入段 1 前指导语；休息结束后进入段 2/3 前指导语；段 3 后仍走段后问卷与最终长问卷。
- session 创建时写入 `experimentSnapshot.instructionPlan`：
  - manual、实验 1、实验 2 固定 `neutral_1 → neutral_2 → neutral_3`。
  - 实验 3 控制组随机排列三条中性文本。
  - 实验 3 合作组随机排列三条合作文本，并与当段副线主题一致。
- 路由守卫覆盖 `/ready`、`/break`、`/instruction`、`/practice`、`/practice-quiz`、A/B 工作台和 B 反馈页，刷新恢复时统一回到阅读材料页。

**变量记录与导出**：
- `TaskProgress` 新增使用阶段：
  - `pre_segment_instruction_opened`
  - `pre_segment_instruction_completed`
- `ExperimentEvent` 新增事件：
  - `pre_segment_instruction_started`
  - `pre_segment_instruction_opened`
  - `pre_segment_instruction_completed`
- `randomization.json` 增加 `instructionPlan`。
- `variables.json` 增加 `instructions` 摘要。
- `formal_segments/segment_X/segment_metadata.json` 增加 `preSegmentInstruction`。
- `events/events.jsonl` 自动导出上述指导语事件。

**文档更新**：
- 新增 `02_specs/03_execution/段前指导语方案.md`。
- 更新 `APP_FLOW.md`、`实验123计划.md`、`问卷流程方案.md`、`数据库文件夹手册.md`。

**本地验证**：
- `corepack pnpm --filter server prisma:generate` 通过。
- `corepack pnpm --filter server build` 通过。
- `corepack pnpm --filter web build` 通过。
