# 稳健性设计调研与方案

> 本文档记录"全流程防御性设计"的调研结果与实施方案。
> 重点关注：网络断开/重连、A/B 两端不同步、数据丢失（特别是草稿/快照）。

---

## 0. 2026-06-17 合并口径

本方案吸收 xiaomimimo 的调研清单，并在此基础上补上本项目最需要的后端稳健性层：幂等、状态机防重、服务端事实源、备份恢复演练。

两份方案的分工口径：

- xiaomimimo 清单更适合落在前端通信与用户体验层：SSE 重连、网络状态提示、轮询兜底、IndexedDB、本地保存队列。
- 本文档继续作为总设计真相源，负责把前端恢复、后端幂等、实验状态机、AI 降级、运维备份放到同一张图里。
- 后续可以分工实现，但不要分成两套设计。推荐由本文档统一拆 P0/P1 任务，前端恢复层与后端幂等层可以并行做。

当前重要修正：

- 现代码已经有 A/B/反馈表单的服务端防抖自动保存，间隔约 900ms；真正缺的是“服务端不可达时的本地持久化、保存队列、旧请求防覆盖和可见同步状态”。
- SSE 当前断连后会关闭连接并调用一次 `refresh()`；它能兜住一部分 runtime 状态，但没有指数退避重连、轮询兜底、事件 id 或 Last-Event-ID 回放。
- “AI 挂了用缓存”只适合作为提示型降级；不能把缓存回答伪装成新回答，必须在 UI 与导出日志中标记为缓存/失败/重试。

---

## 1. 当前系统脆弱点分析

### 1.1 SSE 连接（session-runtime.ts:313）

**现状**：
```typescript
source.onerror = () => {
  source.close();
  void refresh();  // 只刷新一次，没有重试
};
```

**问题**：
- 断连后只刷新一次，没有指数退避重试
- 没有 `Last-Event-ID` 机制，丢失的事件无法回放
- 没有心跳检测，不知道连接是否真的断了
- 用户可能看到"连接中断"但没有自动恢复

### 1.2 草稿保存（workbench-layout.tsx）

**现状**：
- 点击"保存草稿"按钮触发 `workbench-save-draft` 事件
- 事件处理器调用 `POST /experiment/session/:code/tasks/:taskId/draft`
- 保存成功后显示"已保存 ✓"
- A/B 主表和 B feedback 表单已存在约 900ms 的服务端防抖自动保存

**问题**：
- 自动保存只写服务端，网络断开或服务端短暂不可用时会失败
- 没有 IndexedDB/localStorage 本地持久化，浏览器崩溃后最近输入仍可能丢失
- 没有保存队列，网络恢复后不会自动补传失败保存
- 没有草稿 revision/version，旧请求晚返回时可能覆盖较新的编辑内容

### 1.3 A/B 状态同步

**现状**：
- A 提交后通过 SSE 通知 B
- B 查看 A 信息后通过 API 记录

**问题**：
- 如果 SSE 断了，B 可能不知道 A 已提交
- A 提交成功但 SSE 没送达，B 会一直等待
- 没有轮询兜底，SSE 断了就彻底断了

### 1.4 AI 服务调用

**现状**：
- 调用千问 API，超时/限流/挂了直接报错
- 没有重试机制
- 没有降级方案（如本地缓存上次回答）

**问题**：
- AI 服务不稳定时用户体验差
- 图片上传可能失败（413、网络问题）
- 流式输出可能中断

### 1.5 浏览器异常

**现状**：
- 意外刷新：草稿未保存会丢失
- 关闭标签页：当前编辑内容丢失
- 清缓存：sessionStorage 清空，需要重新登录

**问题**：
- 没有 beforeunload 提示
- 没有本地持久化（IndexedDB）
- 没有离线模式

---

## 2. 业界最佳实践调研

### 2.1 SSE 断连重连

**标准做法**：
1. **指数退避重连**：1s → 2s → 4s → 8s → ...（最多 30s）
2. **Last-Event-ID**：重连时发送上次收到的事件 ID，服务端回放丢失的事件
3. **心跳检测**：每 30s 发送 ping，超时未收到 pong 则断开重连
4. **网络状态监听**：`navigator.onLine` + `online/offline` 事件

**参考实现**：
```typescript
// 前端
let retryCount = 0;
const maxRetry = 10;
const baseDelay = 1000;

function connectSSE() {
  const source = new EventSource(url);
  
  source.onopen = () => { retryCount = 0; };
  
  source.onerror = () => {
    source.close();
    if (retryCount < maxRetry) {
      const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
      setTimeout(connectSSE, delay);
      retryCount++;
    }
  };
}

// 后端
app.get('/events', (req, res) => {
  const lastEventId = req.headers['last-event-id'];
  if (lastEventId) {
    // 回放丢失的事件
    replayEvents(lastEventId, res);
  }
});
```

### 2.2 草稿自动保存

**标准做法**：
1. **防抖自动保存**：用户停止输入 2-3 秒后自动保存
2. **本地缓存**：IndexedDB 存储草稿，网络恢复后同步
3. **保存队列**：失败的操作排队重试
4. **乐观更新**：先展示结果，服务端确认后才真正保存

**参考实现**：
```typescript
// 防抖自动保存
const debouncedSave = useMemo(
  () => debounce((draft) => {
    saveToServer(draft).catch(() => {
      // 保存失败，存入本地队列
      saveToLocalQueue(draft);
    });
  }, 2000),
  []
);

// 本地队列重试
async function retryQueue() {
  const queue = await getLocalQueue();
  for (const item of queue) {
    try {
      await saveToServer(item);
      await removeFromQueue(item.id);
    } catch {
      break; // 网络还没恢复，停止重试
    }
  }
}

// 网络恢复时重试
window.addEventListener('online', retryQueue);
```

### 2.3 A/B 状态同步

**标准做法**：
1. **事件确认机制**：A 提交后等待 B 的确认，超时重试
2. **轮询兜底**：SSE 断了，前端定期轮询最新状态
3. **状态版本号**：每次状态变更递增版本号，客户端对比版本判断是否需要更新
4. **幂等操作**：同一操作重复执行结果一致

**参考实现**：
```typescript
// 轮询兜底
useEffect(() => {
  if (sseConnected) return; // SSE 连着就不轮询
  
  const poll = setInterval(async () => {
    const runtime = await fetchRuntime();
    if (runtime.version > localVersion) {
      applyRuntime(runtime);
    }
  }, 5000); // 每 5 秒轮询
  
  return () => clearInterval(poll);
}, [sseConnected]);

// 事件确认
async function submitA() {
  const result = await fetch('/a-submit', { method: 'POST' });
  if (!result.ok) throw new Error('Submit failed');
  
  // 等待 B 确认（最多 10 秒）
  const confirmed = await waitForEvent('b_acknowledged', 10000);
  if (!confirmed) {
    // 重试或提示用户
  }
}
```

### 2.4 离线模式

**标准做法**：
1. **Service Worker**：缓存静态资源和 API 响应
2. **IndexedDB**：存储用户数据，支持离线编辑
3. **Sync API**：后台同步离线期间的操作
4. **网络状态 UI**：显示"离线模式"提示

**参考实现**：
```typescript
// IndexedDB 存储草稿
const db = await openDB('experiment-drafts', 1, {
  upgrade(db) {
    db.createObjectStore('drafts', { keyPath: 'taskId' });
  },
});

// 保存草稿
await db.put('drafts', { taskId, draft, timestamp: Date.now() });

// 加载草稿
const local = await db.get('drafts', taskId);
if (local && !serverDraft) {
  // 服务器没有，用本地的
  setDraft(local.draft);
}

// 网络恢复后同步
window.addEventListener('online', async () => {
  const pending = await db.getAll('drafts');
  for (const item of pending) {
    await saveToServer(item);
    await db.delete('drafts', item.taskId);
  }
});
```

### 2.5 错误处理与降级

**标准做法**：
1. **错误边界**：React Error Boundary 捕获组件错误
2. **优雅降级**：AI 挂了用缓存，SSE 断了用轮询
3. **用户提示**：友好提示 + 重试按钮
4. **日志上报**：错误信息发送到监控平台

**参考实现**：
```typescript
// 错误边界
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    // 上报错误
    reportError(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// AI 降级
async function askAI(question: string) {
  try {
    const response = await fetch('/ai/chat', { ... });
    return response;
  } catch (error) {
    // AI 挂了，返回缓存
    const cached = await getCachedResponse(question);
    if (cached) return cached;
    
    // 没有缓存，返回提示
    return { content: 'AI 服务暂时不可用，请稍后重试。' };
  }
}
```

---

## 3. 针对本项目的稳健性设计方案

### 3.1 分层防御策略

```
┌─────────────────────────────────────────────────────────┐
│                    用户感知层                             │
│  网络状态提示、保存状态提示、错误友好提示、重试按钮        │
├─────────────────────────────────────────────────────────┤
│                    前端持久层                             │
│  IndexedDB 草稿缓存、保存队列、离线模式、防抖自动保存      │
├─────────────────────────────────────────────────────────┤
│                    通信层                                 │
│  SSE 断连重连、Last-Event-ID、心跳检测、轮询兜底          │
├─────────────────────────────────────────────────────────┤
│                    后端持久层                             │
│  数据库事务、幂等操作、快照链路、事件溯源                  │
├─────────────────────────────────────────────────────────┤
│                    监控层                                 │
│  错误上报、性能监控、连接状态监控、导出自检                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 优先级排序

| 优先级 | 模块 | 工作量 | 价值 |
|--------|------|--------|------|
| **P0** | SSE 断连重连 + Last-Event-ID | 中 | 极高（解决核心实时性） |
| **P0** | 草稿本地兜底 + 同步状态 | 中 | 极高（防止数据丢失） |
| **P0** | 网络状态检测 + 提示 | 小 | 高（用户体验） |
| **P0** | 关键 POST 幂等与防重复推进 | 中 | 极高（避免重复提交、重复分配、重复推进） |
| **P1** | IndexedDB 本地草稿缓存 | 中 | 高（离线恢复） |
| **P1** | 保存队列 + 重试 | 中 | 高（网络恢复后同步） |
| **P1** | A/B 轮询兜底 | 小 | 高（防止卡住） |
| **P1** | 草稿 revision / 旧请求防覆盖 | 中 | 高（防止弱网下新内容被旧保存覆盖） |
| **P2** | AI 降级 + 缓存 | 中 | 中（容错） |
| **P2** | beforeunload 提示 | 小 | 中（防误关） |
| **P2** | 错误边界 + 日志上报 | 中 | 中（监控） |
| **P2** | 备份脚本 + 恢复演练 | 中 | 高（正式实验数据安全） |
| **P3** | Service Worker 离线缓存 | 大 | 低（实验场景少用） |

### 3.3 具体实施方案

#### 3.3.1 SSE 断连重连（P0）

**前端改动**：
- `session-runtime.ts` 重写 EventSource 逻辑
- 添加指数退避重连（1s → 2s → 4s → ... → 30s）
- 监听 `online/offline` 事件，网络恢复时立即重连
- 显示连接状态提示（"连接中断，正在重连..."）

**后端改动**：
- SSE 端点支持 `Last-Event-ID` 回放
- 为每个事件生成递增 ID（可用时间戳+序号）
- 服务端维护最近 N 分钟的事件缓存

#### 3.3.2 草稿本地兜底 + 同步状态（P0）

**前端改动**：
- 保留现有 `a-task-editor.tsx` / `b-task-editor.tsx` / `b-feedback-form.tsx` 服务端防抖自动保存
- 每次编辑先写本地缓存，再尝试写服务端
- 保存时显示"保存中..."，成功后显示"已同步"，失败后显示"本地已保存，等待同步"
- 保存按钮保留，支持手动触发

**后端改动**：
- 草稿接口后续增加 `clientRevision` / `serverRevision`，防止旧请求覆盖新内容

#### 3.3.2.1 关键 POST 幂等与防重复推进（P0）

**前端改动**：
- 对 ready、段前指导语完成、问卷提交、A/B 提交、查看 A 信息、草稿保存等请求生成 `Idempotency-Key`
- 请求超时后允许重试，但必须携带同一个 key

**后端改动**：
- 新增幂等记录表或轻量幂等中间层，保存 `key + route + participant/session + result`
- 同一个 key 的重复请求返回第一次结果
- 对 `bCompleteTask`、`submitQuestionnaire`、`completePreSegmentInstruction` 做业务防重：
  - 已完成任务再次完成，只返回已完成，不再次分配公司
  - 同一 participant + segmentIndex 的问卷只保留一次有效提交
  - 同一 participant + workSegment 的段前指导语只完成一次

#### 3.3.3 网络状态检测 + 提示（P0）

**前端改动**：
- 新增 `useNetworkStatus()` hook
- 监听 `navigator.onLine` 和 `online/offline` 事件
- 在顶栏显示网络状态：在线（绿色）、离线（红色）、重连中（黄色）
- 离线时禁用需要网络的操作（AI、提交）

#### 3.3.4 IndexedDB 本地草稿缓存（P1）

**前端改动**：
- 新增 `draft-cache.ts` 工具库，封装 IndexedDB 操作
- 保存草稿时同时写入 IndexedDB
- 加载草稿时优先从服务器读取，失败则从 IndexedDB 读取
- 网络恢复后自动同步 IndexedDB 中的待保存项

#### 3.3.5 保存队列 + 重试（P1）

**前端改动**：
- 新增 `save-queue.ts`，维护待保存操作队列
- 保存失败时自动加入队列
- 定期检查队列，尝试重试
- 网络恢复时立即重试队列中的操作

#### 3.3.6 A/B 轮询兜底（P1）

**前端改动**：
- `session-runtime.ts` 新增轮询逻辑
- SSE 连接时停止轮询
- SSE 断开时启动轮询（每 5 秒）
- 轮询时对比状态版本号，只在版本更新时刷新

#### 3.3.7 AI 降级 + 缓存（P2）

**前端改动**：
- AI 聊天时缓存最近 N 次问答
- AI 调用失败时显示缓存的回答（如果有）
- 显示"AI 服务暂时不可用，显示缓存回答"

**后端改动**：
- 无（或可选：后端缓存最近 AI 回答）

#### 3.3.8 beforeunload 提示（P2）

**前端改动**：
- 监听 `beforeunload` 事件
- 如果有未保存的修改，提示"您有未保存的修改，确定离开吗？"
- 离开前尝试保存草稿

#### 3.3.9 错误边界 + 日志上报（P2）

**前端改动**：
- 新增 `ErrorBoundary` 组件，包裹关键页面
- 错误发生时显示友好提示 + 重试按钮
- 错误信息上报到 console 或后端（可选）

---

## 4. 实施计划

### Phase 1：核心防御（P0，预计 2-3 天）

1. SSE 断连重连 + 网络状态提示
2. 草稿防抖自动保存
3. 网络状态检测 + 离线提示

### Phase 2：本地持久化（P1，预计 2-3 天）

1. IndexedDB 本地草稿缓存
2. 保存队列 + 重试
3. A/B 轮询兜底

### Phase 3：用户体验优化（P2，预计 1-2 天）

1. AI 降级 + 缓存
2. beforeunload 提示
3. 错误边界 + 日志上报

---

## 5. 待确认问题

1. **Last-Event-ID 实现方式**：用递增数字还是 UUID？服务端需要缓存多少事件？
2. **IndexedDB 兼容性**：是否需要支持 IE？（实验场景应该不需要）
3. **自动保存间隔**：2 秒还是 3 秒？太频繁会增加服务器压力，太慢可能丢失更多内容。
4. **轮询间隔**：SSE 断开后 5 秒轮询是否合适？
5. **错误上报**：是否需要接入 Sentry 或类似监控平台？

---

## 6. 参考资料

- MDN SSE 文档：https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- W3C SSE 规范：https://html.spec.whatwg.org/multipage/server-sent-events.html
- IndexedDB MDN：https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- "Local-first software" by Martin Kleppmann (Ink & Switch)
- Yjs 文档：https://docs.yjs.dev/

## 稳健性改进记录

1. Admin 后台原来可能被任何知道地址的人打开
   改进：改为后端强认证，不再依赖前端硬编码密码。
   关键逻辑：新增 `/admin/auth/login`，密码来自 `ADMIN_PASSWORD`；登录后签发 HMAC token；所有 `/admin/*` API 必须带 `Authorization: Bearer <token>`。

2. Admin 密码原来不好安全修改
   改进：密码改为环境变量控制。
   关键逻辑：本地改 server env 的 `ADMIN_PASSWORD`，线上改 `/opt/multi-cooperation/.env.production`，重启 server 后生效；默认 token secret 跟随密码，改密码后旧 token 失效。

3. SSE 原来断开后只刷新一次，可能导致 A/B 状态不同步
   改进：加入持续重连与轮询兜底。
   关键逻辑：前端 SSE 断开后指数退避重连；断连期间每 5 秒轮询 runtime；恢复连接后停止轮询。

4. SSE 原来没有事件回放，断线期间事件可能丢失
   改进：服务端事件增加 `id/retry` 和短期缓存。
   关键逻辑：客户端记录最后事件 ID；重连时携带 `Last-Event-ID` 或 `lastEventId`；服务端回放缓存中未收到的事件。runtime 快照仍是最终事实源。

5. 草稿原来主要依赖服务端自动保存，断网或服务端短暂不可用时可能丢内容
   改进：先写本地，再尝试写服务端。
   关键逻辑：A 主表、B 主表、B feedback 编辑时先保存到 IndexedDB；服务端保存失败时进入本地 pending queue。

6. 保存失败原来不会自动补传
   改进：增加本地保存队列和网络恢复同步。
   关键逻辑：队列按 `sessionCode/taskId/role/section` 合并，只保留最新草稿；网络恢复后自动 flush 到服务端。

7. 重复点击或网络重试原来可能重复推进流程
   改进：关键 POST 增加幂等保护。
   关键逻辑：新增 `IdempotencyRecord`，用 `Idempotency-Key` 绑定 route/scope/response；重复请求返回第一次结果，不重复写状态。

8. B 完成、A 提交、问卷提交等原来可能被重复调用造成副作用
   改进：业务层也加防重判断。
   关键逻辑：A 已提交则重复返回 duplicate；B 已完成则不再分配下一家公司；同 participant + segmentIndex 的问卷不重复提交。

9. 用户原来不知道当前是在线、离线还是等待同步
   改进：工作台顶栏显示连接与同步状态。
   关键逻辑：显示 `online/offline/reconnecting/polling`，并显示本地待同步草稿数量。

10. 浏览器误关或刷新原来可能造成未保存内容丢失
    改进：未保存状态触发关闭提示。
    关键逻辑：工作台收到 dirty 事件后注册 `beforeunload`；保存成功后恢复 clean 状态。

11. 离线时用户原来可能继续点 AI 或最终提交并误以为成功
    改进：离线时对不可离线完成的动作做显式提示。
    关键逻辑：AI 面板离线时显示不可用原因；B feedback 最终提交在离线时阻止并提示恢复网络后提交。

12. 线上 migration 原来遇到失败会阻断 server 启动
    改进：记录并修复迁移恢复流程。
    关键逻辑：migration 文件必须无 BOM；若生产 migration 失败，先用 `prisma migrate resolve --rolled-back <migration>` 恢复迁移状态，再重新 `migrate deploy`。
