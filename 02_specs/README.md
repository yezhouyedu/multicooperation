# 02_specs

本目录存放项目规格文档，按“总览 / 前端 / 后端 / 执行验收 / 上线前数据 / 服务器上线”分层。

## 目录结构

- `00_overview/`
  - 放项目级总体规格：产品目标、流程、变量、技术栈
- `01_frontend/`
  - 放前端相关规格：总体前端规则、页面布局、交互细则、组件规格
- `02_backend/`
  - 放后端相关规格：服务结构、接口方向、数据与状态相关设计
- `03_execution/`
  - 放执行与验收相关文档：实施计划、人工检查手册等
- `04_pre_deploy/`
  - 放上线前数据、存储、变量记录、导出包阅读等跨模块准备文档
- `05_server_deploy/`
  - 放服务器上线、Docker、域名、HTTPS、备份、运维与部署协作方式相关文档

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
- `TUTORIAL_SPEC.md`
- `WORKBENCH_REFINEMENT_MASTER.md`

### 02_backend
- `BACKEND_STRUCTURE.md`
- `SIDETASK_REBUILD_SPEC.md`
- `VARIABLE_PERSISTENCE_SPEC.md`
- `admin材料库上传手册.md`

### 03_execution
- `IMPLEMENTATION_PLAN.md`
- `CHECKLIST_MANUAL.md`
- `实验123计划.md`

### 04_pre_deploy
- `STORAGE_AND_IMPORT_SPEC.md`
- `变量记录与服务器导出方案.md`
- `变量实现自检表.md`
- `数据库文件夹手册.md`

### 05_server_deploy
- `README.md`
- `命令运行清单.md`
- `上线前工作指导.md`
- `部署运行手册.md`

## 后续约定

1. `FRONTEND_GUIDELINES.md` 保持为前端总纲，不继续塞入过细页面实现。
2. 后续新增的 A/B 工作台、AI 面板、副线区等细化规格，统一放入 `01_frontend/`。
3. 贴近代码实现的说明，优先放到对应 app 内部文档；跨模块共识仍回写到 `02_specs/`。
4. 重要结构调整要同步更新本 README 与 `03_tracking/progress.md`。
5. 变量记录、服务器导出、上线前存储结构等数据相关内容统一放入 `04_pre_deploy/`。
6. 服务器部署、域名 HTTPS、Docker、备份恢复、运维排障等上线运行内容统一放入 `05_server_deploy/`。
