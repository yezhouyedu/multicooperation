'use client';

import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type ItemStats = {
  byPool: Record<string, number>;
  bySegment: Record<string, number>;
  byCategory: Record<string, number>;
  directAiCount: number;
  total: number;
};

type SideTaskItem = {
  id: string;
  itemCode: string;
  poolType: string;
  workSegment: number;
  surfaceScenario: string;
  skeletonType: string;
  narrativeCategory: string | null;
  directAiFlag: boolean;
  text: string;
  question: string;
  isActive: boolean;
};

type SideTaskConfig = {
  sideTaskContinuousIntervalSec: number;
  sideTaskContinuousJitterSec: number;
  sideTaskScrollDurationSec: number;
  sideTaskHoldSec: number;
  sideTaskFadeSec: number;
  sideTaskContinuousPauseSec: number;
  sideTaskBatchSizes: string;
  sideTaskBatchTriggerSec: number;
  sideTaskBatchPauseSec: number;
};

type SessionSummary = {
  id: string;
  code: string;
  status: string;
  sideTaskConfig: {
    dispatchMode: string;
    narrativeGroup: string;
    segment1Theme: string | null;
    segment2Theme: string | null;
    segment3Theme: string | null;
    segment1PlannedCount: number;
    segment2PlannedCount: number;
    segment3PlannedCount: number;
  } | null;
  planStats: {
    segmentIndex: number;
    total: number;
    released: number;
    answered: number;
    archived: number;
  }[];
};

export function AdminSidefeedPanel() {
  return (
    <div className="space-y-6">
      <ItemStatsSection />
      <RhythmConfigSection />
      <SessionSideTaskSection />
    </div>
  );
}

function ItemStatsSection() {
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [items, setItems] = useState<SideTaskItem[]>([]);
  const [filter, setFilter] = useState({ poolType: '', workSegment: '', narrativeCategory: '' });
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');

  async function loadStats() {
    const res = await fetch(`${serverBaseUrl}/admin/sidetask/items/stats`, { cache: 'no-store' });
    const data = await res.json();
    setStats(data);
  }

  async function loadItems() {
    const params = new URLSearchParams();
    if (filter.poolType) params.set('poolType', filter.poolType);
    if (filter.workSegment) params.set('workSegment', filter.workSegment);
    if (filter.narrativeCategory) params.set('narrativeCategory', filter.narrativeCategory);
    params.set('limit', '50');
    const res = await fetch(`${serverBaseUrl}/admin/sidetask/items?${params}`, { cache: 'no-store' });
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => { void loadStats(); }, []);
  useEffect(() => { void loadItems(); }, [filter]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setStatus('导入中...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${serverBaseUrl}/admin/sidetask/import`, { method: 'POST', body: form });
      const data = await res.json();
      setStatus(`导入完成: ${data.imported ?? 0} 条`);
      await loadStats();
      await loadItems();
    } catch {
      setStatus('导入失败');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function toggleActive(id: string) {
    await fetch(`${serverBaseUrl}/admin/sidetask/items/${id}/toggle-active`, { method: 'PATCH' });
    await loadItems();
    await loadStats();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">题库状态</h2>

      {stats && (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCard label="总题数" value={stats.total} />
          <StatCard label="普通中性池" value={stats.byPool['普通中性池'] ?? 0} />
          <StatCard label="合作叙事池" value={stats.byPool['合作叙事池'] ?? 0} />
          <StatCard label="含直接AI" value={stats.directAiCount ?? 0} />
        </div>
      )}

      {stats && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold">按段:</span>
            {Object.entries(stats.bySegment).map(([k, v]) => ` 段${k}=${v}`)}
          </div>
          <div>
            <span className="font-semibold">按类别:</span>
            {Object.entries(stats.byCategory).map(([k, v]) => ` ${k}=${v}`)}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer">
          {importing ? '导入中...' : '上传 Excel 导入题库'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" disabled={importing} />
        </label>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <select value={filter.poolType} onChange={(e) => setFilter((f) => ({ ...f, poolType: e.target.value }))} className="rounded border border-slate-200 px-2 py-1">
          <option value="">全部池类型</option>
          <option value="普通中性池">普通中性池</option>
          <option value="合作叙事池">合作叙事池</option>
        </select>
        <select value={filter.workSegment} onChange={(e) => setFilter((f) => ({ ...f, workSegment: e.target.value }))} className="rounded border border-slate-200 px-2 py-1">
          <option value="">全部段</option>
          <option value="1">段 1</option>
          <option value="2">段 2</option>
          <option value="3">段 3</option>
        </select>
        <input
          type="text"
          placeholder="叙事类别筛选..."
          value={filter.narrativeCategory}
          onChange={(e) => setFilter((f) => ({ ...f, narrativeCategory: e.target.value }))}
          className="rounded border border-slate-200 px-2 py-1"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded border border-slate-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="px-2 py-1.5 text-left">itemCode</th>
              <th className="px-2 py-1.5 text-left">池</th>
              <th className="px-2 py-1.5 text-left">段</th>
              <th className="px-2 py-1.5 text-left">类别</th>
              <th className="px-2 py-1.5 text-left">文本</th>
              <th className="px-2 py-1.5 text-left">AI</th>
              <th className="px-2 py-1.5 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-1.5 font-mono">{item.itemCode}</td>
                <td className="px-2 py-1.5">{item.poolType}</td>
                <td className="px-2 py-1.5">{item.workSegment}</td>
                <td className="px-2 py-1.5">{item.narrativeCategory ?? '-'}</td>
                <td className="max-w-xs truncate px-2 py-1.5">{item.text}</td>
                <td className="px-2 py-1.5">{item.directAiFlag ? '✓' : ''}</td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleActive(item.id)}
                    className={`rounded px-2 py-0.5 text-xs ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {item.isActive ? '启用' : '停用'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-slate-400">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RhythmConfigSection() {
  const [config, setConfig] = useState<SideTaskConfig | null>(null);
  const [status, setStatus] = useState('');

  async function load() {
    const res = await fetch(`${serverBaseUrl}/admin/experiment-config`, { cache: 'no-store' });
    const data = await res.json();
    const sideTask = data.config?.sideTask;
    if (sideTask) setConfig(sideTask);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!config) return;
    setStatus('保存中...');
    const res = await fetch(`${serverBaseUrl}/admin/experiment-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sideTask: config }),
    });
    if (res.ok) {
      setStatus('已保存');
    } else {
      const data = await res.json().catch(() => null);
      setStatus(`保存失败: ${data?.message ?? '未知错误'}`);
    }
    await load();
  }

  if (!config) return <div className="text-sm text-slate-400">加载中...</div>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">提醒频率参数</h2>
      <p className="mb-4 text-sm text-slate-500">后台题目到达速度相同（每 30s 一道），区别只在前端滚动提醒的频率。Continuous 每道都提醒，Batch 攒约 5 分钟提醒一次。</p>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">共享动画参数</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <ConfigNumber label="滚动时长 (秒)" value={config.sideTaskScrollDurationSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskScrollDurationSec: v } : c)} defaultValue={12} />
          <ConfigNumber label="停留时长 (秒)" value={config.sideTaskHoldSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskHoldSec: v } : c)} defaultValue={5} />
          <ConfigNumber label="淡出时长 (秒)" value={config.sideTaskFadeSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskFadeSec: v } : c)} defaultValue={2} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-blue-600">Continuous 模式</h3>
          <div className="space-y-2">
            <ConfigNumber label="到达间隔 (秒)" value={config.sideTaskContinuousIntervalSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskContinuousIntervalSec: v } : c)} defaultValue={30} />
            <ConfigNumber label="间隔抖动 (秒)" value={config.sideTaskContinuousJitterSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskContinuousJitterSec: v } : c)} defaultValue={0} />
            <ConfigNumber label="暂停时长 (秒)" value={config.sideTaskContinuousPauseSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskContinuousPauseSec: v } : c)} defaultValue={15} />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-purple-600">Batch 模式</h3>
          <div className="space-y-2">
            <ConfigNumber label="提醒间隔 (秒, 攒多久提醒一次)" value={config.sideTaskBatchTriggerSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskBatchTriggerSec: v } : c)} defaultValue={300} />
            <ConfigNumber label="暂停时长 (秒)" value={config.sideTaskBatchPauseSec} onChange={(v) => setConfig((c) => c ? { ...c, sideTaskBatchPauseSec: v } : c)} defaultValue={60} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600">保存配置</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </section>
  );
}

function SessionSideTaskSection() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState('');

  async function load() {
    const res = await fetch(`${serverBaseUrl}/admin/sessions`, { cache: 'no-store' });
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }

  useEffect(() => { void load(); }, []);

  const selected = sessions.find((s) => s.code === selectedCode);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Session 副线查看</h2>

      <select value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-200 p-2 text-sm">
        <option value="">选择 session...</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.code}>{s.code} ({s.status})</option>
        ))}
      </select>

      {selected?.sideTaskConfig && (
        <div className="space-y-3">
          <div className="grid gap-2 text-xs md:grid-cols-3">
            <div className="rounded bg-slate-50 p-2"><span className="text-slate-500">分发模式:</span> <span className="font-semibold">{selected.sideTaskConfig.dispatchMode}</span></div>
            <div className="rounded bg-slate-50 p-2"><span className="text-slate-500">叙事组:</span> <span className="font-semibold">{selected.sideTaskConfig.narrativeGroup}</span></div>
            <div className="rounded bg-slate-50 p-2"><span className="text-slate-500">主题:</span> <span className="font-semibold">{[selected.sideTaskConfig.segment1Theme, selected.sideTaskConfig.segment2Theme, selected.sideTaskConfig.segment3Theme].filter(Boolean).join(', ') || '无'}</span></div>
          </div>

          {selected.planStats.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left">段</th>
                  <th className="px-2 py-1.5 text-right">计划</th>
                  <th className="px-2 py-1.5 text-right">已到达</th>
                  <th className="px-2 py-1.5 text-right">已回答</th>
                  <th className="px-2 py-1.5 text-right">已归档</th>
                </tr>
              </thead>
              <tbody>
                {selected.planStats.map((ps) => (
                  <tr key={ps.segmentIndex} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">段 {Math.ceil(ps.segmentIndex / 2)}</td>
                    <td className="px-2 py-1.5 text-right">{ps.total}</td>
                    <td className="px-2 py-1.5 text-right">{ps.released}</td>
                    <td className="px-2 py-1.5 text-right">{ps.answered}</td>
                    <td className="px-2 py-1.5 text-right">{ps.archived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected && !selected.sideTaskConfig && (
        <div className="text-sm text-slate-400">该 session 无副线配置</div>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

function ConfigNumber({ label, value, onChange, defaultValue }: { label: string; value: number; onChange: (v: number) => void; defaultValue?: number }) {
  return (
    <label className="block text-xs">
      <span className="text-slate-500">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5" />
      {defaultValue !== undefined && <span className="mt-0.5 block text-[11px] text-slate-400">默认: {defaultValue}</span>}
    </label>
  );
}

function ConfigString({ label, value, onChange, defaultValue }: { label: string; value: string; onChange: (v: string) => void; defaultValue?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-slate-500">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5" />
      {defaultValue !== undefined && <span className="mt-0.5 block text-[11px] text-slate-400">默认: {defaultValue}</span>}
    </label>
  );
}
