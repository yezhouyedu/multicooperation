'use client';

import { AdminSidefeedPanel } from '@/components/admin-sidefeed-panel';
import { AdminAiSettingsPanel } from '@/components/admin-ai-settings-panel';
import { CompanyMaterialPanel } from '@/components/company-material-panel';
import type { CompanyData } from '@/lib/session-runtime';
import { ArrowDown, ArrowUp, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type TabId = 'sessions' | 'participants' | 'config' | 'materials' | 'sidefeed' | 'ai-settings';

type SessionSummary = {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  currentSegmentIndex?: number;
  pairings: {
    participantA: { phone: string | null; role: string | null } | null;
    participantB: { phone: string | null; role: string | null } | null;
  }[];
  tasks: {
    id: string;
    sortOrder: number;
    phase: string;
    aSubmittedAt: string | null;
    bCompletedAt: string | null;
    company: { name: string } | null;
  }[];
};

type Participant = { id: string; phone: string | null; createdAt: string };
type QuestionnaireItem = { id: string; prompt: string; options: string[] };

type ExperimentConfig = {
  workDurationMinutes: number;
  breakDurationMinutes: number;
  segmentAiLevels: string[];
  questionnaireTemplate: {
    id: string;
    title: string;
    items: QuestionnaireItem[];
  } | null;
};

type LibraryCaseOverview = {
  folderName: string;
  caseCode: string;
  companyName: string;
  sector: string;
  participantMaterialCount: number;
  researchMaterialCount: number;
  autoFillSourceRelativePath: string | null;
};

const NAV_ITEMS: { id: TabId; label: string }[] = [
  { id: 'sessions', label: 'Session 概览' },
  { id: 'participants', label: '被试名单' },
  { id: 'config', label: '实验配置' },
  { id: 'materials', label: '材料管理' },
  { id: 'sidefeed', label: '副线调度' },
  { id: 'ai-settings', label: 'AI 参数' },
];

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [progresses, setProgresses] = useState<{ id: string; stage: string; participant: { role: string | null } }[]>([]);
  const [status, setStatus] = useState('');

  async function loadSessions() {
    setStatus('正在加载 Session...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/sessions`, { cache: 'no-store' });
      if (!response.ok) throw new Error('sessions failed');
      const data = (await response.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions ?? []);
      setStatus('');
    } catch {
      setSessions([]);
      setStatus('Session 加载失败：请确认后端 http://localhost:3001 已启动');
    }
  }

  async function loadProgress(code: string) {
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${code}/progress`, { cache: 'no-store' });
      if (!response.ok) throw new Error('progress failed');
      const data = (await response.json()) as {
        progresses: { id: string; stage: string; participant: { role: string | null } }[];
      };
      setProgresses(data.progresses ?? []);
    } catch {
      setProgresses([]);
      setStatus(`Session ${code} 记录加载失败`);
    }
  }

  async function exportData() {
    setStatus('导出中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/export`, { cache: 'no-store' });
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `multi-cooperation-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('已导出');
    } catch {
      setStatus('导出失败');
    }
  }

  async function clearSessions() {
    if (!window.confirm('确认清空全部实验数据吗？此操作不会删除准入手机号。')) return;
    setStatus('清空中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/clear-sessions`, { method: 'POST' });
      if (!response.ok) throw new Error('clear failed');
      setSelectedCode('');
      setProgresses([]);
      await loadSessions();
      setStatus('已清空');
    } catch {
      setStatus('清空失败');
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  const selected = sessions.find((item) => item.code === selectedCode);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold text-[#1d2129]">全部 Session</div>
          <div className="flex items-center gap-3">
            {status ? <span className="text-xs text-[#86909c]">{status}</span> : null}
            <button type="button" onClick={() => void loadSessions()} className="text-xs text-[#1e80ff] hover:underline">刷新</button>
            <button type="button" onClick={() => void exportData()} className="rounded-lg border border-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">导出全部数据</button>
            <button type="button" onClick={() => void clearSessions()} className="rounded-lg border border-[#ffccc7] px-3 py-1.5 text-xs font-semibold text-[#cf1322] hover:bg-red-50">清空实验数据</button>
          </div>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => {
            const pairing = session.pairings[0];
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setSelectedCode(session.code);
                  void loadProgress(session.code);
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                  selectedCode === session.code ? 'border-[#1e80ff] bg-blue-50' : 'border-[#e5e6eb] hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[#1e80ff]">{session.code}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#4e5969]">{session.status}</span>
                  <span className="text-xs text-[#86909c]">
                    尽调员: {pairing?.participantA?.phone ?? '-'} / 投资经理: {pairing?.participantB?.phone ?? '-'}
                  </span>
                  <span className="ml-auto text-xs text-[#86909c]">段索引: {session.currentSegmentIndex ?? 0}</span>
                </div>
              </button>
            );
          })}
          {sessions.length === 0 ? <div className="text-sm text-[#86909c]">暂无 Session</div> : null}
        </div>
      </div>

      {selected ? (
        <>
          <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
            <div className="mb-3 font-bold text-[#1d2129]">任务进度</div>
            <div className="space-y-2">
              {selected.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-[#e5e6eb] px-4 py-2 text-sm">
                  <span className="w-10 text-[#86909c]">#{task.sortOrder}</span>
                  <span className="flex-1 font-medium text-[#1d2129]">{task.company?.name ?? '未加载公司'}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${task.aSubmittedAt ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-[#86909c]'}`}>
                    尽调员: {task.aSubmittedAt ? '已提交' : '未提交'}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${task.bCompletedAt ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-[#86909c]'}`}>
                    投资经理: {task.bCompletedAt ? '已完成' : '未完成'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
            <div className="mb-3 font-bold text-[#1d2129]">行为记录</div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {progresses.map((progress) => (
                <div key={progress.id} className="rounded-lg bg-gray-50 px-4 py-2 text-xs text-[#4e5969]">
                  <span className="font-medium text-[#1e80ff]">{progress.stage}</span>
                  <span className="ml-2 text-[#86909c]">{progress.participant.role}</span>
                </div>
              ))}
              {progresses.length === 0 ? <div className="text-sm text-[#86909c]">暂无记录</div> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ParticipantsTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [status, setStatus] = useState('');

  async function load() {
    setStatus('名单加载中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/participants`, { cache: 'no-store' });
      if (!response.ok) throw new Error('participants failed');
      const data = (await response.json()) as { participants: Participant[] };
      setParticipants(data.participants ?? []);
      setStatus('');
    } catch {
      setParticipants([]);
      setStatus('名单加载失败：请确认后端 http://localhost:3001 已启动');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveEntries(entries: { phone: string }[]) {
    if (!entries.length) return;
    setStatus('保存中...');
    await fetch(`${serverBaseUrl}/admin/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    setStatus(`已保存 ${entries.length} 条`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-3 font-bold text-[#1d2129]">添加手机号</div>
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-6 text-[#1e80ff]">
          这里的手机号只是准入令牌，不预设角色；正式实验按进入时间自动分配。
        </div>
        <div className="flex gap-3">
          <input
            value={newPhone}
            onChange={(event) => setNewPhone(event.target.value)}
            placeholder="例如 13800000001"
            className="flex-1 rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff] focus:ring-1 focus:ring-[#1e80ff]"
          />
          <button
            type="button"
            onClick={() => {
              const phone = newPhone.trim();
              if (!phone) return;
              void saveEntries([{ phone }]);
              setNewPhone('');
            }}
            className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-600"
          >
            保存
          </button>
        </div>
        <div className="mt-3 text-xs text-[#86909c]">
          也可上传 CSV：
          <input
            type="file"
            accept=".csv,.txt"
            className="ml-2 text-xs"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const entries = text
                .split(/\r?\n/)
                .map((line) => line.trim().replace(/"/g, ''))
                .filter(Boolean)
                .map((phone) => ({ phone }));
              await saveEntries(entries);
            }}
          />
        </div>
        {status ? <div className="mt-2 text-xs text-[#86909c]">{status}</div> : null}
      </div>

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-3 font-bold text-[#1d2129]">当前名单</div>
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3 rounded-lg border border-[#e5e6eb] px-4 py-2 text-sm">
              <span className="flex-1 font-medium text-[#1d2129]">{participant.phone}</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-[#1e80ff]">准入令牌</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfigTab() {
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [status, setStatus] = useState('');

  async function load() {
    const response = await fetch(`${serverBaseUrl}/admin/experiment-config`, { cache: 'no-store' });
    const data = (await response.json()) as { config: ExperimentConfig };
    setConfig(data.config);
  }

  useEffect(() => {
    void load();
  }, []);

  if (!config) {
    return <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm text-sm text-[#86909c]">配置加载中...</div>;
  }

  async function save() {
    if (!config) return;
    setStatus('保存中...');
    await fetch(`${serverBaseUrl}/admin/experiment-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workDurationMinutes: config.workDurationMinutes,
        breakDurationMinutes: config.breakDurationMinutes,
        segmentAiLevels: config.segmentAiLevels,
        questionnaireTitle: config.questionnaireTemplate?.title ?? '休息问卷',
        questionnaireItems: config.questionnaireTemplate?.items ?? [],
      }),
    });
    setStatus('已保存');
    await load();
  }

  const questionnaire = config.questionnaireTemplate ?? {
    id: 'default',
    title: '休息问卷',
    items: [{ id: 'q1', prompt: '', options: [''] }],
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 font-bold text-[#1d2129]">工作段与休息段配置</div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm text-[#4e5969]">
            工作段时长（分钟）
            <input
              type="number"
              min={1}
              value={config.workDurationMinutes}
              onChange={(event) => setConfig((prev) => prev ? { ...prev, workDurationMinutes: Number(event.target.value) || 20 } : prev)}
              className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
            />
          </label>
          <label className="text-sm text-[#4e5969]">
            休息段时长（分钟）
            <input
              type="number"
              min={1}
              value={config.breakDurationMinutes}
              onChange={(event) => setConfig((prev) => prev ? { ...prev, breakDurationMinutes: Number(event.target.value) || 5 } : prev)}
              className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((index) => (
            <label key={index} className="text-sm text-[#4e5969]">
              工作段 {index + 1} AI
              <select
                value={config.segmentAiLevels[index] ?? 'BASIC'}
                onChange={(event) => setConfig((prev) => {
                  if (!prev) return prev;
                  const next = [...prev.segmentAiLevels];
                  next[index] = event.target.value;
                  return { ...prev, segmentAiLevels: next };
                })}
                className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
              >
                <option value="BASIC">BASIC</option>
                <option value="ADVANCED">ADVANCED</option>
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 font-bold text-[#1d2129]">休息问卷</div>
        <label className="mb-4 block text-sm text-[#4e5969]">
          问卷标题
          <input
            value={questionnaire.title}
            onChange={(event) => setConfig((prev) => prev ? { ...prev, questionnaireTemplate: { ...questionnaire, title: event.target.value } } : prev)}
            className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
          />
        </label>
        <div className="space-y-4">
          {questionnaire.items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-[#e5e6eb] p-4">
              <label className="block text-sm text-[#4e5969]">
                题目 {index + 1}
                <input
                  value={item.prompt}
                  onChange={(event) => setConfig((prev) => {
                    if (!prev) return prev;
                    const items = questionnaire.items.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, prompt: event.target.value } : entry,
                    );
                    return { ...prev, questionnaireTemplate: { ...questionnaire, items } };
                  })}
                  className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
                />
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => void save()} className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">保存配置</button>
          {status ? <span className="text-xs text-[#86909c]">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}

type CompanyForm = {
  id?: string;
  name: string;
  roundLabel: string;
  sector: string;
  summary: string;
  tagsText: string;
  sortOrder: number;
};

function MaterialsTab() {
  const emptyForm: CompanyForm = { name: '', roundLabel: '', sector: '', summary: '', tagsText: '', sortOrder: 0 };
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [libraryRoot, setLibraryRoot] = useState('');
  const [libraryCases, setLibraryCases] = useState<LibraryCaseOverview[]>([]);

  async function loadCompanies(preferId?: string) {
    setStatus('正在加载材料库...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/companies`, { cache: 'no-store' });
      if (!response.ok) throw new Error('companies failed');
      const data = (await response.json()) as { companies: CompanyData[] };
      const nextCompanies = data.companies ?? [];
      setCompanies(nextCompanies);
      const nextSelectedId = preferId ?? selectedId ?? nextCompanies[0]?.id ?? '';
      setSelectedId(nextSelectedId);
      setStatus('');
    } catch {
      setCompanies([]);
      setStatus('材料库加载失败');
    }
  }

  useEffect(() => {
    void loadCompanies();
    void loadLibraryOverview();
  }, []);

  async function loadLibraryOverview() {
    try {
      const response = await fetch(`${serverBaseUrl}/admin/companies/library/overview`, { cache: 'no-store' });
      if (!response.ok) throw new Error('library overview failed');
      const data = (await response.json()) as { rootDir: string; cases: LibraryCaseOverview[] };
      setLibraryRoot(data.rootDir ?? '');
      setLibraryCases(data.cases ?? []);
    } catch {
      setLibraryRoot('');
      setLibraryCases([]);
    }
  }

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedId) ?? companies[0] ?? null,
    [companies, selectedId],
  );

  useEffect(() => {
    if (!selectedCompany) {
      setForm(emptyForm);
      return;
    }
    setForm({
      id: selectedCompany.id,
      name: selectedCompany.name,
      roundLabel: selectedCompany.roundLabel,
      sector: selectedCompany.sector,
      summary: selectedCompany.summary,
      tagsText: selectedCompany.tags.join(', '),
      sortOrder: selectedCompany.sortOrder ?? 0,
    });
  }, [selectedCompany]);

  async function importBaseline() {
    setStatus('正在导入 P01 基线材料...');
    const response = await fetch(`${serverBaseUrl}/admin/companies/import-baseline/p01`, { method: 'POST' });
    if (!response.ok) {
      setStatus('导入失败');
      return;
    }
    const data = (await response.json()) as { company: CompanyData };
    await loadCompanies(data.company.id);
    setStatus('P01 已导入');
  }

  async function importLibrary() {
    setStatus('正在自动识别并导入题库目录...');
    const response = await fetch(`${serverBaseUrl}/admin/companies/import-library`, { method: 'POST' });
    if (!response.ok) {
      setStatus('题库目录导入失败');
      return;
    }
    await loadCompanies();
    await loadLibraryOverview();
    setStatus('题库目录已导入');
  }

  async function saveCompany() {
    setStatus('正在保存公司信息...');
    const response = await fetch(`${serverBaseUrl}/admin/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        roundLabel: form.roundLabel,
        sector: form.sector,
        summary: form.summary,
        sortOrder: form.sortOrder,
        tags: form.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    });
    if (!response.ok) {
      setStatus('保存失败');
      return;
    }
    const data = (await response.json()) as { company: CompanyData };
    await loadCompanies(data.company.id);
    setStatus('公司信息已保存');
  }

  async function uploadMaterial(file: File) {
    if (!selectedCompany) return;
    const body = new FormData();
    body.append('file', file);
    setStatus(`正在上传 ${file.name}...`);
    const response = await fetch(`${serverBaseUrl}/admin/companies/${selectedCompany.id}/materials`, {
      method: 'POST',
      body,
    });
    if (!response.ok) {
      setStatus('上传失败');
      return;
    }
    await loadCompanies(selectedCompany.id);
    setStatus('上传完成');
  }

  async function replaceMaterial(materialId: string, file: File) {
    if (!selectedCompany) return;
    const body = new FormData();
    body.append('file', file);
    setStatus(`正在替换 ${file.name}...`);
    const response = await fetch(`${serverBaseUrl}/admin/companies/${selectedCompany.id}/materials/${materialId}/replace`, {
      method: 'POST',
      body,
    });
    if (!response.ok) {
      setStatus('替换失败');
      return;
    }
    await loadCompanies(selectedCompany.id);
    setStatus('替换完成');
  }

  async function deleteMaterial(materialId: string) {
    if (!selectedCompany) return;
    if (!window.confirm('确认删除这份材料吗？')) return;
    setStatus('正在删除材料...');
    const response = await fetch(`${serverBaseUrl}/admin/companies/${selectedCompany.id}/materials/${materialId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setStatus('删除失败');
      return;
    }
    await loadCompanies(selectedCompany.id);
    setStatus('材料已删除');
  }

  async function reorderMaterial(materialId: string, direction: 'up' | 'down') {
    if (!selectedCompany) return;
    const current = [...selectedCompany.materials];
    const index = current.findIndex((item) => item.id === materialId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return;
    const [moved] = current.splice(index, 1);
    current.splice(targetIndex, 0, moved);

    const response = await fetch(`${serverBaseUrl}/admin/companies/${selectedCompany.id}/materials/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialIds: current.map((item) => item.id) }),
    });
    if (!response.ok) {
      setStatus('排序失败');
      return;
    }
    await loadCompanies(selectedCompany.id);
    setStatus('排序已更新');
  }

  async function setAutoFillSource(materialId: string) {
    if (!selectedCompany) return;
    const response = await fetch(`${serverBaseUrl}/admin/companies/${selectedCompany.id}/materials/${materialId}/auto-fill-source`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      setStatus('设置失败：当前版本仅支持将 txt 设为自动填充源');
      return;
    }
    await loadCompanies(selectedCompany.id);
    setStatus('自动填充源已更新');
  }

  return (
    <div className="grid min-h-[720px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-bold text-[#1d2129]">公司与材料库</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void loadCompanies()} className="rounded-lg border border-[#e5e6eb] p-2 text-[#4e5969] hover:bg-gray-50">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void importBaseline()} className="rounded-lg border border-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">
                导入 P01 基线
              </button>
              <button type="button" onClick={() => void importLibrary()} className="rounded-lg bg-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600">
                自动导入题库目录
              </button>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-[#d9e7ff] bg-blue-50 px-3 py-3 text-xs leading-6 text-[#1e80ff]">
            <div className="font-semibold">自动识别目录</div>
            <div className="mt-1 break-all">{libraryRoot || '未检测到题库目录'}</div>
            <div className="mt-2 text-[#4e5969]">支持直接识别每个案例文件夹；若存在 `participant/` 与 `research/` 子目录，会优先按子目录分流。</div>
          </div>
          {libraryCases.length > 0 ? (
            <div className="mb-4 space-y-2 rounded-lg border border-[#e5e6eb] bg-[#fafbfc] p-3">
              <div className="text-xs font-semibold text-[#4e5969]">本地题库扫描结果</div>
              {libraryCases.map((item) => (
                <div key={item.folderName} className="rounded-lg border border-[#eef0f3] bg-white px-3 py-2 text-xs text-[#4e5969]">
                  <div className="font-medium text-[#1d2129]">{item.companyName} <span className="text-[#86909c]">({item.caseCode})</span></div>
                  <div className="mt-1">{item.folderName} / 参与者材料 {item.participantMaterialCount} 份 / 研究者材料 {item.researchMaterialCount} 份</div>
                  <div className="mt-1 text-[#86909c]">自动填充源：{item.autoFillSourceRelativePath ?? '未识别'}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-2">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => setSelectedId(company.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                  selectedCompany?.id === company.id ? 'border-[#1e80ff] bg-blue-50' : 'border-[#e5e6eb] hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-[#1d2129]">{company.name}</div>
                <div className="mt-1 text-xs text-[#86909c]">
                  {company.roundLabel} / {company.sector} / {company.materials.length} 份材料
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
          <div className="mb-4 font-bold text-[#1d2129]">{form.id ? '编辑公司信息' : '新建公司'}</div>
          <div className="space-y-3">
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="公司名称" className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]" />
            <input value={form.roundLabel} onChange={(event) => setForm((prev) => ({ ...prev, roundLabel: event.target.value }))} placeholder="公司编号/轮次标签" className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]" />
            <input value={form.sector} onChange={(event) => setForm((prev) => ({ ...prev, sector: event.target.value }))} placeholder="行业" className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]" />
            <input value={form.tagsText} onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))} placeholder="标签，用逗号分隔" className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]" />
            <textarea value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} rows={4} placeholder="公司概览" className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]" />
            <button type="button" onClick={() => void saveCompany()} className="w-full rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">保存公司信息</button>
          </div>
          {status ? <div className="mt-3 text-xs text-[#86909c]">{status}</div> : null}
        </div>

        {selectedCompany ? (
          <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold text-[#1d2129]">材料操作</div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">
                <Upload className="h-3.5 w-3.5" />
                上传文件
                <input
                  type="file"
                  accept=".txt,.docx,.pdf,.xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadMaterial(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            <div className="space-y-3">
              {selectedCompany.materials.map((material, index) => (
                <div key={material.id} className="rounded-lg border border-[#e5e6eb] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#1d2129]">{material.displayName}</div>
                      <div className="mt-1 text-xs text-[#86909c]">
                        {material.kind.toUpperCase()} / {material.parseStatus} / {material.id === selectedCompany.autoFillSourceMaterialId ? '自动填充源' : '普通材料'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => void reorderMaterial(material.id, 'up')} disabled={index === 0} className="rounded border border-[#e5e6eb] p-1 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => void reorderMaterial(material.id, 'down')} disabled={index === selectedCompany.materials.length - 1} className="rounded border border-[#e5e6eb] p-1 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded border border-[#e5e6eb] px-3 py-1.5 text-xs text-[#4e5969] hover:bg-gray-50">
                      替换
                      <input
                        type="file"
                        accept=".txt,.docx,.pdf,.xlsx,.xls"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void replaceMaterial(material.id, file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button type="button" onClick={() => void setAutoFillSource(material.id)} className="rounded border border-[#1e80ff] px-3 py-1.5 text-xs text-[#1e80ff] hover:bg-blue-50">设为自动填充源</button>
                    <button type="button" onClick={() => void deleteMaterial(material.id)} className="rounded border border-[#ffccc7] px-3 py-1.5 text-xs text-[#cf1322] hover:bg-red-50">删除</button>
                  </div>
                  {material.parseError ? <div className="mt-2 text-xs text-[#cf1322]">解析错误：{material.parseError}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 font-bold text-[#1d2129]">材料预览</div>
        {selectedCompany ? (
          <div className="h-[760px] min-h-0">
            <CompanyMaterialPanel company={selectedCompany} />
          </div>
        ) : (
          <div className="flex h-[760px] items-center justify-center rounded-lg border border-dashed border-[#d0d7e2] text-sm text-[#86909c]">
            请选择一家公司以预览材料。
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');

  return (
    <main className="flex min-h-screen bg-[#f0f2f5] text-[#1d2129] text-sm">
      <aside className="w-52 shrink-0 border-r border-[#e5e6eb] bg-white py-6">
        <div className="mb-6 px-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#86909c]">管理后台</div>
          <div className="mt-1 text-base font-bold text-[#1e80ff]">AI 投资决策平台</div>
        </div>
        <nav className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                activeTab === item.id ? 'bg-blue-50 font-bold text-[#1e80ff]' : 'text-[#4e5969] hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 p-7">
        <div className="mb-5 text-lg font-bold text-[#1d2129]">{NAV_ITEMS.find((item) => item.id === activeTab)?.label}</div>
        {activeTab === 'sessions' ? <SessionsTab /> : null}
        {activeTab === 'participants' ? <ParticipantsTab /> : null}
        {activeTab === 'config' ? <ConfigTab /> : null}
        {activeTab === 'materials' ? <MaterialsTab /> : null}
        {activeTab === 'sidefeed' ? <AdminSidefeedPanel /> : null}
        {activeTab === 'ai-settings' ? <AdminAiSettingsPanel /> : null}
      </div>
    </main>
  );
}
