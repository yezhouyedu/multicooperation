# 02_specs

本目录存放项目规格文档，按“总览 / 前端 / 后端 / 执行验收”分层。

## 目录结构

- `00_overview/`
  - 放项目级总体规格：产品目标、流程、变量、技术栈
- `01_frontend/`
  - 放前端相关规格：总体前端规则、页面布局、交互细则、组件规格
- `02_backend/`
  - 放后端相关规格：服务结构、接口方向、数据与状态相关设计
- `03_execution/`
  - 放执行与验收相关文档：实施计划、人工检查手册等

## 当前文件归类

### 00_overview
- `PRD.md`
- `APP_FLOW.md`
- `VARIABLES.md`
- `TECH_STACK.md`

### 01_frontend
- `FRONTEND_GUIDELINES.md`
- `A_B_WORKBENCH_UI.md`
- `AI_PANEL_SPEC.md`
- `SIDETASK_PANEL_SPEC.md`

### 02_backend
- `BACKEND_STRUCTURE.md`

### 03_execution
- `IMPLEMENTATION_PLAN.md`
- `CHECKLIST_MANUAL.md`

## 后续约定

1. `FRONTEND_GUIDELINES.md` 保持为前端总纲，不继续塞入过细页面实现。
2. 后续新增的 A/B 工作台、AI 面板、副线区等细化规格，统一放入 `01_frontend/`。
3. 贴近代码实现的说明，优先放到对应 app 内部文档；跨模块共识仍回写到 `02_specs/`。
4. 重要结构调整要同步更新本 README 与 `03_tracking/progress.md`。
