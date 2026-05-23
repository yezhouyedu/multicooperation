'use client';

import { useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type AiSettings = {
  basicBaseUrl: string;
  basicModel: string;
  basicApiKey: string;
  basicContextLimit: number;
  advancedBaseUrl: string;
  advancedModel: string;
  advancedApiKey: string;
  advancedContextLimit: number;
};

export function AdminAiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings>({
    basicBaseUrl: 'https://api.deepseek.com',
    basicModel: 'deepseek-chat',
    basicApiKey: '',
    basicContextLimit: 20,
    advancedBaseUrl: 'https://api.deepseek.com',
    advancedModel: 'deepseek-chat',
    advancedApiKey: '',
    advancedContextLimit: 20,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [showBasicKey, setShowBasicKey] = useState(false);
  const [showAdvancedKey, setShowAdvancedKey] = useState(false);

  async function loadSettings() {
    setStatus('加载中...');
    try {
      const res = await fetch(`${serverBaseUrl}/admin/ai-settings`, { cache: 'no-store' });
      const data = (await res.json()) as { settings: AiSettings };
      if (data.settings) setSettings(data.settings);
      setLoaded(true);
      setStatus('');
    } catch {
      setStatus('加载失败，请确认后端已启动');
    }
  }

  async function saveSettings() {
    setSaving(true);
    setStatus('保存中...');
    try {
      const res = await fetch(`${serverBaseUrl}/admin/ai-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('save failed');
      const data = (await res.json()) as { settings: AiSettings };
      if (data.settings) setSettings(data.settings);
      setStatus('保存成功');
    } catch {
      setStatus('保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm text-white hover:bg-[#1168e3]"
        >
          加载 AI 参数
        </button>
        {status ? <div className="text-sm text-[#86909c]">{status}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic AI */}
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5">
        <div className="mb-4 text-sm font-bold text-[#1d2129]">基础版 AI (Basic)</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">Base URL</span>
            <input
              type="text"
              value={settings.basicBaseUrl}
              onChange={(e) => setSettings((s) => ({ ...s, basicBaseUrl: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">Model</span>
            <input
              type="text"
              value={settings.basicModel}
              onChange={(e) => setSettings((s) => ({ ...s, basicModel: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">API Key</span>
            <div className="relative">
              <input
                type={showBasicKey ? 'text' : 'password'}
                value={settings.basicApiKey}
                onChange={(e) => setSettings((s) => ({ ...s, basicApiKey: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-16 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowBasicKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-[#86909c] hover:bg-gray-100"
              >
                {showBasicKey ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">上下文条数</span>
            <input
              type="number"
              min={1}
              max={100}
              value={settings.basicContextLimit}
              onChange={(e) => setSettings((s) => ({ ...s, basicContextLimit: Number(e.target.value) || 20 }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>

      {/* Advanced AI */}
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5">
        <div className="mb-4 text-sm font-bold text-[#1d2129]">高级版 AI (Advanced)</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">Base URL</span>
            <input
              type="text"
              value={settings.advancedBaseUrl}
              onChange={(e) => setSettings((s) => ({ ...s, advancedBaseUrl: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">Model</span>
            <input
              type="text"
              value={settings.advancedModel}
              onChange={(e) => setSettings((s) => ({ ...s, advancedModel: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">API Key</span>
            <div className="relative">
              <input
                type={showAdvancedKey ? 'text' : 'password'}
                value={settings.advancedApiKey}
                onChange={(e) => setSettings((s) => ({ ...s, advancedApiKey: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-16 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowAdvancedKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-[#86909c] hover:bg-gray-100"
              >
                {showAdvancedKey ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#86909c]">上下文条数</span>
            <input
              type="number"
              min={1}
              max={100}
              value={settings.advancedContextLimit}
              onChange={(e) => setSettings((s) => ({ ...s, advancedContextLimit: Number(e.target.value) || 20 }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="rounded-lg bg-[#1e80ff] px-5 py-2 text-sm text-white hover:bg-[#1168e3] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
        {status ? (
          <span className={`text-sm ${status.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
            {status}
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-[#4e5969]">
        保存后立即生效，无需重启服务。配置存储在数据库中，优先级高于 .env 文件。Basic 和 Advanced
        使用独立的 Base URL、Model、API Key 和上下文条数。
      </div>
    </div>
  );
}
