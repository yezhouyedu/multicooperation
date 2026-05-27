# lessons.md

## 2026-04-22 反思补充

- 这轮连续 bug 的核心不是“没写规则”，而是没有把规则转成编码前的强制检查。
- **依赖纪律教训**：workspace 项目已确定使用 `pnpm` 时，不要为图快临时切到 `npm install`；否则极易引入 `package-lock.json`、污染依赖树，并触发 Next/lockfile 的额外问题。
- **第三方库接入教训**：接入 `react-resizable-panels` 这类关键布局库前，必须先核对真实导出/API；不能凭印象写 `PanelGroup / PanelResizeHandle`，应先确认当前版本实际导出的是 `Group / Panel / Separator`。
- **验证纪律教训**：涉及依赖切换、布局底座替换、AI provider 兼容、启动脚本这类高影响改动，必须先做最小验证（导出检查 / 单页 dev 验证 / 最小请求验证），再继续推进，不要先大面积接线再回头灭火。
- **调试纪律教训**：出现连续 bug 时，先把问题分层：环境 / lockfile / 依赖导出 / 代码实现。不要把多层问题混在一起修，否则会显得像“越修越坏”。

## 2026-04-23 反思补充

- **不要反复推翻已修好的前端基线**：当 UI 适配、滚动条、小卡片居中与拖拽面积已经在真实页面里修好后，后续工作的第一原则应是“保护稳定结果”，不是重新寻找更优雅的新方案。
- **母版优先于自我发挥**：这轮再次证明，`apps/web/指导文件/index.html` 不只是参考图，而是前端高优先级母版；偏离母版越多，越容易把页面带回错误方向。
- **动画与定位要解耦**：副线小卡片的问题本质不是样式数值小错，而是把动画和定位揉在一起，导致动画覆盖居中逻辑；后续凡是运动 UI，都优先拆分“运动职责”和“静态定位职责”。
- **拖拽体验先求稳再求抽象**：分区拖拽如果抽象层太重、响应链太长，手感就会变差；在这个项目里，先保证操作直观、零延迟、边界清楚，再考虑是否抽象成更通用方案。

## 2026-05-23 反思补充

### 副线传送带动画三次失败的根因分析

**目标**：让"您有新事项入库，请尽快处理"从右往左滚动，到左端停留 5s，2s 淡出，间隔 30s 循环。

**第一次尝试：`<style jsx>` 里的 `@keyframes`**
- 做法：在 sidetask-strip.tsx 的 `<style jsx>` 块里定义 `.ticker-item` 和 `@keyframes sideTicker`
- 结果：动画完全不触发，文字停在 `left: 100%`（屏幕外），页面上什么都看不到
- 原因：`styled-jsx` 的 `@keyframes` 在 Next.js App Router 下不生效。`styled-jsx` 会给 CSS 类名加哈希后缀做作用域隔离，但 `@keyframes` 名称不会被重写，导致 `animation` 属性引用的 keyframes 名称找不到匹配的定义

**第二次尝试：全局 CSS (`globals.css`) 里的 `@keyframes`**
- 做法：把 `.ticker-item` 和 `@keyframes sideTicker` 移到 `globals.css`
- 结果：仍然不显示
- 原因：本项目使用 Tailwind v4（`@import "tailwindcss"`），Tailwind v4 的层叠层（cascade layers）机制会把非 layer 内的自定义 CSS 的优先级压到极低。即使 `.ticker-item` 写在 `globals.css` 的 `@import` 之后，其 `animation` 属性仍然可能被 Tailwind 的 reset/base 层覆盖或失效。具体来说，Tailwind v4 的 `@import "tailwindcss"` 会创建 `@layer theme, base, components, utilities`，而 import 之后的裸 CSS 处于无 layer 的最顶层，行为不可预测

**第三次尝试（成功）：`useRef` + `requestAnimationFrame` 直接操作 DOM**
- 做法：用 `useRef` 拿到 button 的 DOM 引用，在 `requestAnimationFrame` 回调里直接写 `el.style.left` / `el.style.opacity` / `el.style.display`，完全不经过 React state
- 结果：正常运行
- 原因：绕开了所有 CSS 层叠问题。`requestAnimationFrame` 直接改 inline style，优先级最高，不受 Tailwind 层叠层、styled-jsx 作用域、或任何 CSS-in-JS 方案的影响

**核心教训**：
1. **Tailwind v4 + styled-jsx 的 @keyframes 是雷区**：两者都会干预 CSS 的作用域和优先级，`@keyframes` 在这个组合下几乎不可用
2. **动画不要用 React state 驱动**：`requestAnimationFrame` 每秒 60 帧，如果每帧调 `setState`，会触发 60 次 re-render，轻则卡顿，重则动画被打断。应该用 `useRef` 直接操作 DOM
3. **母版的实现方式就是最佳实践**：`index.html` 里用 `document.createElement` + `addEventListener('animationend')` 的纯 JS 方式能稳定工作，说明这个项目环境下，动画就该走 JS 路线，不要信任 CSS 动画

## 2026-05-27 反思补充：progress.md 编码损坏事件

### 事件经过

2026-05-27 Codex 会话在向 `03_tracking/progress.md` 追加内容时，产生了严重的编码损坏：
- 前 527 行：中文字符末尾被截断，替换为 U+FFFD（`�`）
- 第 538-562 行：整段乱码，U+FFFD 替换字符遍布全文
- 第 580-587 行：spec 补充段落同样乱码

### 根因分析（已通过字节级验证）

**直接原因**：Codex 使用的 shell 命令是 `@' ... '@ | Add-Content -Path 'progress.md'`

**编码链**：
1. Codex 模型生成的中文完全正确（JSONL 中 Unicode 码点验证正确：`U+FF08=（, U+8865=补, U+8BB0=记`）
2. PowerShell here-string `@'...'@` 在内存中正确（PowerShell 内部用 UTF-16）
3. **`Add-Content` 在 PowerShell 5.1 中默认使用系统 ANSI 代码页写入文件**，中文 Windows 上是 GBK/CP936，不是 UTF-8
4. 文件中存储的是 GBK 字节（已验证：`a3 a8 b2 b9 bc c7 a3 a9` = GBK 的 `（补记）`）
5. 后续 git/编辑器/Python 按 UTF-8 读取 → GBK 字节是无效 UTF-8 序列 → 产生 U+FFFD 替换字符

**关键证据**：git commit `65b6c4c` 中 progress.md 的字节 `a3 a8 b2 b9 bc c7 a3 a9` 是标准 GBK 编码，不是 UTF-8。文件中 U+FFFD 计数为 0（因为文件整体是 GBK，不是"UTF-8 中的无效字节"）。

**为什么不是其他原因**：
- 不是 Codex 模型输出乱码 → JSONL 码点正确
- 不是 here-string 编码问题 → PowerShell 内部 UTF-16 正确保留中文
- 不是传输层编码问题 → 命令字符串中的中文在 JSONL 中可正确解码
- **就是 `Add-Content` 默认编码问题** → 字节级证据确凿

### 恢复过程

1. 前 527 行：从 git commit `3e6e4fd` 恢复干净版本（该 commit 在损坏发生前创建）
2. 第 538-562 行：从 Codex 会话的 rollout JSONL 文件中提取原始内容（JSONL 中 Unicode 正确），重建为 UTF-8
3. 第 580-587 行：根据上下文重建
4. 恢复后仍有零星乱码行（532-537, 567-568, 592-594），逐行手动替换

### 核心教训

1. **`Add-Content` 在 PowerShell 5.1 中默认用 GBK，不是 UTF-8**
   - 这是 Windows 上写中文文件的头号陷阱
   - 即使 here-string 内容正确、即使文件本身是 UTF-8，`Add-Content` 也会用 GBK 覆盖写入
   - 必须用 `Add-Content -Encoding utf8` 或 `Set-Content -Encoding utf8`

2. **写 .md 文件必须用 Write 工具或 Python 脚本，不能用 shell 命令**
   - Write 工具直接写 UTF-8，不经过 shell 编码层，是最安全的方式
   - 如果必须用脚本，用 Python `open(path, 'w', encoding='utf-8')`
   - 如果必须用 PowerShell，必须加 `-Encoding utf8`

3. **中文内容写入后必须验证**
   - 写入后立即用 Python 读取文件原始字节，检查编码是否为 UTF-8
   - 检查是否有 U+FFFD 字符
   - 特别注意追加操作（`Add-Content` / `>>`），容易引入不同编码

4. **版本控制是最后防线**
   - 损坏发生前的 git commit 是恢复的关键来源
   - 重要文件写入前先 commit，写入后验证无误再 commit

5. **Codex rollout JSONL 文件是意外的备份源**
   - Codex 会话的完整交互记录保存在 `~/.codex/sessions/` 下
   - JSONL 中的文本是正确的 Unicode（不受 shell 编码影响）
   - 不应依赖此方式作为常规备份，但损坏时值得尝试

### 写入 .md 文件的强制准则

**必须遵守**：
- 使用 Write 工具写入完整文件内容
- 使用 Python 脚本 + `open(path, 'w', encoding='utf-8')` 做追加或局部修改
- 写入后立即读取验证，检查原始字节是否为有效 UTF-8

**严禁**：
- 用 PowerShell `Add-Content` 或 `>>` 追加中文（默认 GBK 编码，会破坏 UTF-8 文件）
- 用 PowerShell `@' ... '@` here-string 管道写中文到文件（同样的问题）
- 用 bash `echo "中文"` 或 `cat <<EOF` 写中文到文件
- 用 Codex 的 `shell_command` 直接写中文到 .md 文件（经过 shell 编码层）

**如果必须用 PowerShell**：
- 必须加 `-Encoding utf8`：`Set-Content -Path $path -Value $text -Encoding utf8`
- 写入后用 `[System.IO.File]::ReadAllBytes($path)` 验证前几字节是否为正确 UTF-8
