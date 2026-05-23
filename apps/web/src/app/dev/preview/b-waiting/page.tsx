export default function PreviewBWaitingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium text-purple-700">开发预览 / B 等待页</p>
        <h1 className="mb-4 text-3xl font-semibold">当前暂无可处理公司</h1>
        <p className="text-sm leading-7 text-slate-600">
          这里后续会承接 B 在公共池为空时的等待状态。当前阶段先确认等待页存在且风格独立。
        </p>
      </div>
    </main>
  );
}
