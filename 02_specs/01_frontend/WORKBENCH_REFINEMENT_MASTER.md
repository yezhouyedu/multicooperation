# 主界面精修与数据冻结总说明

## 1. 材料区

### 1.1 目标

- 管理端可以持续维护公司材料，而不是只服务一次性导入。
- 参与者端材料区直接承担阅读任务，要求稳定、可读、美观。
- 同一套结构支持后续继续新增公司、替换文件、调整展示顺序。

### 1.2 后端材料模型

每家公司维护一组可运营材料项，单项材料至少包含：

- `id`
- `displayName`
- `sourceFilename`
- `kind`
- `storageKey`
- `mimeType`
- `sortOrder`
- `renderMode`
- `parseStatus`
- `parseError`
- `metadata`

公司级还额外维护：

- `researchProfile`：供自动填充与后续分析使用的研究者结构化信息
- `autoFillSourceMaterialId`：当前自动填充源文件

### 1.3 管理端能力

管理端材料后台必须直接可用，当前版本能力包括：

- 新建公司
- 编辑公司基础信息
- 上传 `txt / docx / pdf / xlsx`
- 替换已有材料
- 删除单个材料
- 上移 / 下移调整展示顺序
- 指定自动填充源文件
- 单文件预览
- 显示解析失败状态
- 一键导入 `P01` 基线材料

### 1.4 阅读器选型

本项目采用混合阅读器方案：

- `txt`：原生文本阅读
- `pdf`：`react-pdf` + `pdfjs-dist`
- `docx`：`docx-preview`
- `xlsx`：`xlsx` 解析为只读表格视图

选择原则：

- 优先保证参与者阅读体验
- 优先保证部署可控性
- 不为了 Office 原生编辑能力引入重型在线套件

### 1.5 前端阅读体验要求

- 文件名直接作为 tab 名称
- 顶部工具区视觉统一
- 空态、加载态、失败态完整
- 长文档滚动稳定
- PDF 支持分页与缩放
- XLSX 支持横向滚动和清晰表头
- 投资经理侧固定追加 `尽调员信息` tab，不与原始文件混淆

## 2. 答题区

### 2.1 真相源

以下两份文档是主线答题区唯一真相源：

- `00_start_materials/原始材料/A端尽调表_参与者可见版v2.docx`
- `00_start_materials/原始材料/B端投资判断表_参与者可见版.docx`

React 组件负责承载交互与保存，但字段、顺序、标题、说明应向 Word 终版对齐。

### 2.2 自动填充

自动填充信息来自研究者材料源，当前优先使用：

- `00_start_materials/原始材料/P01/0.信息点记录（研究者用）.txt`

抽取后写入 `researchProfile`，至少覆盖：

- 公司编号
- 行业
- 公司简称/匿名代号
- 业务简介

### 2.3 保存与恢复

答题区当前统一走“草稿 + 快照 + 恢复”结构：

- `draft`：当前可编辑态
- `snapshot`：工作段冻结态与关键节点态
- `restore`：从最近有效冻结快照恢复

覆盖范围：

- 尽调员主表
- 投资经理主表
- 投资经理反馈表

### 2.4 当前交互原则

- 输入中自动保存
- 工作段结束前服务端强制冻结
- 下一工作段自动恢复最近一次有效冻结快照
- 恢复后继续编辑不会被旧快照回滚覆盖

## 3. AI 区

### 3.1 运行原则

- 主线与副线 AI 上下文隔离
- 不同公司主线上下文隔离
- 副线按工作段独立累计
- `practice / formal` 上下文分离

### 3.2 存储结构

AI 对话逐条写入 `AiMessageLog`，关键字段包括：

- `sessionId`
- `participantId`
- `companyId`
- `contextType`
- `phase`
- `segmentIndex`
- `aiLevel`
- `messageRole`
- `content`
- `attachments`

### 3.3 前端行为

- 首次进入按当前上下文加载历史
- 主线上下文跟随当前公司
- 副线上下文跟随当前工作段
- 允许按 AI 等级决定是否开放图片输入

## 4. 后端上传与数据记录

### 4.1 统一快照模型

`TaskSnapshot` 作为通用快照容器，核心字段包括：

- `snapshotType`
- `scope`
- `role`
- `section`
- `segmentIndex`
- `payload`
- `restoreSourceSnapshotId`
- `takenReason`
- `schemaVersion`

该结构保留后续继续调整分析口径的空间，不把业务写死到单一表单版本。

### 4.2 当前快照类型

当前已经纳入统一体系的关键快照包括：

- `work_segment_freeze`
- `b_five_minute_snapshot`
- `restore`

### 4.3 导出要求

管理端导出应同时覆盖：

- 当前草稿
- 快照序列
- 恢复来源链
- 最终提交结果
- 进度记录
- 会话与公司元数据

### 4.4 持续扩展原则

- 文件存储与数据库元数据分层
- `payload` 继续保留 JSON 扩展性
- 自动填充源可从 txt 演进到更结构化的数据源
- 不把当前 `P01` 方案写死成唯一结构
