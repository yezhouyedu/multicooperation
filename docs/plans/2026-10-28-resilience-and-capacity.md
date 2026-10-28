# 稳定性补丁与60人容量验收 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落实已批准的三个稳定性补丁；容量验收方法已获认可，生产压测窗口与真实AI费用上限仍待确认。

**Architecture:** 草稿使用服务端版本检查、每任务事务锁和本地串行补传，冲突不覆盖；AI设置总时限并贯穿响应体读取，客户端断开取消上游；平台恢复保存持久探针和Session审计事件、重新获取运行态，不改实验计时/退出规则。生产故障注入禁止，生产负载逐级增加并可立即停测。

**Tech Stack:** NestJS / Prisma / PostgreSQL / Next.js / IndexedDB / Jest / Node fetch。

---

## 执行边界

- 本次先本地补丁、回归和文档；不在讨论中启动线上60人请求或付费AI负载。
- 不清空已有数据、不调整Session快照、不改A/B退出和计时。
- 不将界面夹具、模拟AI或少量API测试写成真实60人验收。

### Task 1: 草稿乱序保护

**Files:** `apps/server/prisma/schema.prisma`、新migration、`apps/server/src/experiment/draft-version.ts`及测试、`experiment.service.ts/controller.ts`、`apps/web/src/lib/draft-sync.ts`、`session-runtime.ts`、三份任务表单。

1. 写版本冲突/重复mutation测试，确认旧实现失败。
2. 每任务持久保存分区版本，事务锁内检查expectedRevision；旧请求返回409、不覆盖。
3. IndexedDB原子合并、串行发送、仅删除已确认同mutation的队列项，刷新优先恢复待传本地内容；冲突保留且可见。
4. 针对乱序、补传中继续编辑、刷新和冲突测试；所有表单采用同一保存入口。

### Task 2: AI超时与取消

**Files:** `apps/server/src/ai/provider-request.ts`及测试、`ai.service.ts`、`ai.controller.ts`。

1. 写fetch挂起、响应体挂起、取消和正常完成测试。
2. 默认180秒总时限，可用环境变量调整；覆盖fetch及body读取，finally清理定时器/监听。
3. 用户断开流取消上游；失败/超时/取消均结束等待审计，保留部分输出为异常而不是成功。
4. 不自动换模型、不引入缓存回答、不进行无限重试。

### Task 3: 平台恢复可审计

**Files:** schema/migration、`apps/server/src/operations/`及测试、`app.module.ts`、SSE和导出相关代码。

1. 持久保存服务实例及最后存活探针；重启或探针异常间隔恢复时，为受影响Session写平台中断事件。
2. 定时探针不得重叠；失败保留旧探针，成功后再写恢复事实，未知开始时间明确为估计范围。
3. SSE使用实例前缀ID，重连强制读取数据库runtime，处理runtime_error；不宣称内存事件跨重启回放。
4. 导出新增平台中断质量标记与事件供人工判断；不抹掉个人原始flags、不自动补时。

### Task 4: 验证与交接

1. 运行新测试、全部server测试、Prisma生成、server/web build与diff检查。
2. 更新韧性规格、数据库手册、progress和启动prompt；注明本地/生产/模拟验证边界。
3. 后续独立确认生产维护窗口、监测阈值、AI费用上限后，10→30→60人，真实HTTPS+真实数据库；协议负载与真实浏览器、真实AI分别报告。

## 容量验收待执行

2026-10-28本地执行记录：三个补丁代码及对应测试已实现；22套件115项通过，Prisma generate/validate与server/web构建通过，真实浏览器IndexedDB12项通过（fetch模拟），原指导语12组渲染+顶部入口4项通过。Docker Desktop启动因本机socket访问错误失败，未进行真实数据库迁移、锁并发、故障演练或生产部署。后续先处理该环境阻塞，不把本地单元测试写成数据库/线上验收。

- 目标60人/30组完整三段，包含同步起跑、保存、提交、材料、SSE、心跳、任务2、问卷和导出。
- API负载脚本代表按定义节奏操作的账号，不代表60台真实电脑或真人。
- 故障注入仅隔离环境；生产只做受控业务负载，有备份、硬上限、资源守护和立即停测。
- 当前没有60人容量结论，不能承诺零风险或任何人数绝不故障。
