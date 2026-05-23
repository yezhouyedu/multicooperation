# CLAUDE.md

## Project Root
- Root: `E:\Own_program\multi cooperation`

## Session Startup
每次开始处理本项目，优先读取：
1. `PROJECT_RULES.md`
2. `progress.md`
3. `lessons.md`
4. 与当前模块相关的规范文档

## Core Rules
- 文档第一，代码第二
- 先 interrogation，再文档，再 implementation
- 需求没问透，不进入编码
- 任何重要变更都要回写文档
- 不要擅自扩大范围
- 优先小步推进、阶段验证
- 默认考虑移动端 / 响应式
- 不允许随意引入未记录的新依赖
- 每完成一个阶段，更新 `progress.md`
- 每出现一个典型错误或经验，更新 `lessons.md`

## Canonical Docs
- `PRD.md`
- `APP_FLOW.md`
- `TECH_STACK.md`
- `FRONTEND_GUIDELINES.md`
- `BACKEND_STRUCTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `PROJECT_RULES.md`
- `progress.md`
- `lessons.md`
- `INTERROGATION_QUESTIONS.md`

## Working Style
- 默认先把用户想法结构化
- 默认主动指出模糊点、风险点、缺失信息
- 默认把大任务拆小，不一口吃成胖子
- 默认在对话中提醒当前处于：审问 / 文档 / 计划 / 编码 / 验证 哪个阶段

## Change Discipline
如果用户明确给出新规则、新偏好、新边界：
- 先执行当前任务
- 再把规则同步写回相关 md 文件

## Bug Prevention Discipline
- 本项目默认只使用 `corepack pnpm` 维护 workspace 依赖；除非用户明确要求，否则不要在子包里执行 `npm install`
- 引入或替换第三方库前，先检查真实导出/API（本地包、类型声明或官方文档三选一），不要凭记忆接线
- 涉及布局系统、AI provider、依赖安装、启动脚本这类高影响改动时，默认先做最小验证，再继续扩散到更多页面
- 出现连续 bug 时，优先停下来做根因分类：是环境问题、依赖问题、API 误判、还是实现问题；不要把不同层的问题混在一起连续修
- 当前前端工作台以 `apps/web/指导文件/index.html` 与已完成修复的真实运行效果为准；没有充分理由，不要再次替换布局底座或重写拖拽方案
- 对已经修好的 UI 适配、滚动条处理、副线小卡片运行态、拖拽面积功能，默认先保护再优化，禁止“为顺手重构”把稳定结果改坏

## Memory for This Project
- `progress.md`：当前状态 + 简短过程记录
- `lessons.md`：经验和反思
- 本项目已在根目录启用本地 Git；后续默认可使用 `git status`、`git diff`、`git commit` 做本地版本管理

## Important Principle
你不是在“帮用户碰运气写代码”，而是在“和用户一起做一个长期全栈工程”。
