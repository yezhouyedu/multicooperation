'use client';

import { useEffect, useState } from 'react';

type Settings = {
  dispatchMode: 'continuous' | 'batch';
  segmentTotalItems: number;
  batchIntervalMinutes: number;
  batchCount: number;
  scrollSpeedSeconds: number;
  contentSetId: string;
  retentionPolicy: 'segment';
};

const defaultSettings: Settings = {
  dispatchMode: 'continuous',
  segmentTotalItems: 48,
  batchIntervalMinutes: 5,
  batchCount: 3,
  scrollSpeedSeconds: 12,
  contentSetId: 'default-manufacturing',
  retentionPolicy: 'segment',
};

const storageKey = 'multi-cooperation-sidefeed-settings';

export function AdminSidefeedPanel() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      document.documentElement.style.setProperty('--sidefeed-scroll-seconds', `${settings.scrollSpeedSeconds}s`);
      window.dispatchEvent(new CustomEvent('sidefeed-settings-changed', { detail: settings }));
    } catch {}
  }, [settings]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">副线调度参数（管理员）</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">dispatch_mode</div>
          <select value={settings.dispatchMode} onChange={(e) => setSettings((prev) => ({ ...prev, dispatchMode: e.target.value as Settings['dispatchMode'] }))} className="w-full rounded-xl border border-slate-200 p-3">
            <option value="continuous">continuous</option>
            <option value="batch">batch</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">segment_total_items</div>
          <input type="number" value={settings.segmentTotalItems} onChange={(e) => setSettings((prev) => ({ ...prev, segmentTotalItems: Number(e.target.value) || 0 }))} className="w-full rounded-xl border border-slate-200 p-3" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">batch_interval_minutes</div>
          <input type="number" value={settings.batchIntervalMinutes} onChange={(e) => setSettings((prev) => ({ ...prev, batchIntervalMinutes: Number(e.target.value) || 0 }))} className="w-full rounded-xl border border-slate-200 p-3" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">batch_count</div>
          <input type="number" value={settings.batchCount} onChange={(e) => setSettings((prev) => ({ ...prev, batchCount: Number(e.target.value) || 0 }))} className="w-full rounded-xl border border-slate-200 p-3" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">scroll_speed（秒）</div>
          <input type="number" value={settings.scrollSpeedSeconds} onChange={(e) => setSettings((prev) => ({ ...prev, scrollSpeedSeconds: Number(e.target.value) || 1 }))} className="w-full rounded-xl border border-slate-200 p-3" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-slate-500">content_set_id</div>
          <input type="text" value={settings.contentSetId} onChange={(e) => setSettings((prev) => ({ ...prev, contentSetId: e.target.value }))} className="w-full rounded-xl border border-slate-200 p-3" />
        </label>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        当前这些设置先保存在浏览器本地并即时作用于前端副线区，下一步再接到正式后端配置。
      </div>
    </section>
  );
}
