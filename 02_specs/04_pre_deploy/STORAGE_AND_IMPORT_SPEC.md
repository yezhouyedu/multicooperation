# Storage And Import Spec

## 1. 文档目标

这份 spec 只解决一件事：
项目从“本地扫描材料目录”走向“线上可部署版本”时，材料批量导入和对象存储怎么接。

当前版本先不实现线上对象存储。
这份文档的作用是先把未来一定要定的结构定下来，避免后面上线前临时返工。

---

## 2. 当前状态

当前材料系统的真相源仍然是本地目录：

`00_start_materials/原始材料/`

当前导入方式：
- 后端扫描固定目录
- 复制文件到本地 `storage/materials`
- 数据库存公司与材料元数据

当前已经支持的材料口径：
- `participant/shared`
- `participant/diligence`
- `participant/manager`
- `research`

当前问题不是“不能用”，而是“不适合正式线上部署”：
- 浏览器不能直接让线上服务器随便读本地磁盘路径
- 本地 `storage/materials` 不适合多机部署
- 文件版本、批次、回滚、审计还没有正式结构

---

## 3. 上线目标

上线版目标：

1. 数据库存元数据
2. 对象存储存文件本体
3. 支持整批导入材料
4. 支持按案例回滚或重新导入
5. 支持后续扩展为网页上传整个文件夹

建议对象存储默认按 COS / S3 兼容思路设计，不绑死某一家。

---

## 4. 总体架构

建议分成三层：

### 4.1 目录或上传批次输入层

输入来源未来可能有两种：
- 本地导入目录扫描
- 网页上传整个文件夹

无论来源是什么，进入系统后都先转换成统一的“导入批次”。

### 4.2 元数据层

数据库只保存：
- 公司
- 材料记录
- 导入批次
- 文件版本
- 角色可见范围
- 对象存储 key / url

### 4.3 文件存储层

文件本体放到 COS / S3：
- txt
- docx
- pdf
- xlsx
- xls

---

## 5. 推荐数据模型

### 5.1 MaterialImportBatch

表示一次批量导入任务。

建议字段：
- `id`
- `sourceType`
  - `local_scan`
  - `folder_upload`
- `sourceLabel`
  - 例如本地路径、上传批次名
- `status`
  - `pending`
  - `processing`
  - `completed`
  - `failed`
- `startedAt`
- `finishedAt`
- `createdBy`
- `summary`
  - 导入了多少公司、多少文件、失败多少
- `errorLog`

### 5.2 CompanyMaterial

表示一个公司的一个材料文件。

建议字段：
- `id`
- `companyId`
- `displayName`
- `sourceFilename`
- `kind`
- `renderMode`
- `audience`
  - `participant`
  - `research`
- `participantRole`
  - `shared`
  - `A`
  - `B`
- `sortOrder`
- `storageProvider`
  - `local`
  - `cos`
  - `s3`
- `storageBucket`
- `storageKey`
- `publicUrl`
- `mimeType`
- `sizeBytes`
- `checksum`
- `parseStatus`
- `parseError`
- `importBatchId`
- `version`
- `isActive`
- `metadata`

### 5.3 CompanyMaterialVersion

如果后续要支持替换、回滚，建议单独建版本表。

建议字段：
- `id`
- `materialId`
- `version`
- `storageKey`
- `sizeBytes`
- `checksum`
- `createdAt`
- `createdBy`
- `changeReason`

---

## 6. 对象存储 key 规则

建议统一 key 命名，不要随意拼。

推荐：

```text
materials/{companyId}/{materialId}/v{version}/{filename}
```

例子：

```text
materials/company-library-p01/material-001/v1/1.公司简介.txt
```

优点：
- 同公司材料集中
- 同一材料可保留版本
- 不怕重名
- 回滚时清楚

---

## 7. 导入流程

### 7.1 本地扫描模式

适用于当前开发环境。

流程：
1. 扫描固定目录
2. 解析案例结构
3. 建立导入批次
4. 上传文件到对象存储或本地存储
5. 写入材料元数据
6. 写入导入结果摘要

### 7.2 网页上传文件夹模式

适用于未来线上后台。

流程：
1. 前端选择文件夹
2. 前端按相对路径批量上传
3. 后端组装为一个导入批次
4. 校验目录结构是否合法
5. 上传对象存储
6. 入库元数据

---

## 8. 目录结构校验规则

未来无论本地扫描还是网页上传，都建议统一校验：

每个案例允许的主要目录：
- `participant/shared`
- `participant/diligence`
- `participant/manager`
- `research`

校验项：
- 是否存在非法扩展名
- `research` 文件是否混进参与者目录
- `case.json` 是否缺关键字段
- 自动填充源是否存在
- 角色专属目录是否写错名字

校验失败时：
- 批次可失败
- 或公司级跳过并记录错误

建议保留详细错误日志。

---

## 9. URL 策略

正式线上不建议把对象存储永久公网 URL 直接裸露给所有文件。

建议两种模式：

### 9.1 公开材料

如果未来确认材料文件可长期公开：
- 可以用公开 CDN URL

### 9.2 受控材料

如果材料需要受控访问：
- 后端签发临时 URL
- 前端预览时动态换取

当前项目更建议按“受控材料”思路设计。

---

## 10. 删除与回滚策略

不建议一上来做“物理彻底删除”。

建议：
- 默认软删除元数据
- 文件对象延迟清理
- 保留导入批次和版本记录

这样遇到问题时可以：
- 回滚单个文件
- 回滚单个公司
- 回滚某次批量导入

---

## 11. 与当前代码的衔接建议

当前已有这些基础：
- 公司表里有 `materials`
- 已有题库扫描逻辑
- 已有角色元数据 `participantRole`

上线前建议逐步改成：

### 第一步

保留当前本地扫描，但把“材料元数据结构”先正规化。

### 第二步

抽出统一的 `import batch` 服务层。

### 第三步

把 `storage/materials` 的本地文件写入替换成对象存储适配器。

### 第四步

再补网页批量上传文件夹入口。

这个顺序最稳，不建议反过来。

---

## 12. 当前不做的事

这份 spec 当前只定结构，不立即实现：
- 前端文件夹上传 UI
- COS SDK 接入
- 签名 URL
- 版本回滚页面
- 批次失败重试后台

这些都属于上线前阶段实现项，不是现在必须落代码的内容。

---

## 13. 建议结论

当前建议是：

1. 继续保留本地目录扫描，服务当前开发
2. 提前把“元数据 / 批次 / 对象存储 key”口径写死
3. 真正准备线上部署时，再做 COS 接入和网页批量上传

这样成本最低，也最不容易返工。
