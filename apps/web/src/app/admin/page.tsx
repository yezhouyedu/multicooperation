'use client';

import { AdminSidefeedPanel } from '@/components/admin-sidefeed-panel';
import { AdminAiSettingsPanel } from '@/components/admin-ai-settings-panel';
import { CompanyMaterialPanel } from '@/components/company-material-panel';
import { adminFetch, clearAdminToken, hasAdminToken, loginAdmin } from '@/lib/admin-auth';
import type { CompanyData } from '@/lib/session-runtime';
import { ArrowDown, ArrowUp, Pause, Play, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
const rawFetch = globalThis.fetch.bind(globalThis);
const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return url.includes('/admin/') ? adminFetch(input, init) : rawFetch(input, init);
};

type TabId = 'sessions' | 'participants' | 'config' | 'questionnaires' | 'materials' | 'sidefeed' | 'ai-settings';

type SessionSummary = {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  currentSegmentIndex?: number;
  experimentCondition?: string | null;
  experimentRun?: { id: string; code: string; name: string; status: string } | null;
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

type Participant = { id: string; phone: string | null; isActive: boolean; createdAt: string };
type QuestionnaireItem = { id: string; prompt: string; options: string[]; correctOption?: string };
type FormalQuestionnaireItem = {
  code: string;
  prompt: string;
  type: 'scale' | 'single' | 'multi' | 'number' | 'text';
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  maxLength?: number;
  followup?: { prompt: string; triggerText: string };
};
type FormalQuestionnaireSection = { title: string; description?: string; items: FormalQuestionnaireItem[] };
type FormalQuestionnaireTemplate = {
  schemaVersion: number;
  version: string;
  title: string;
  recruitmentExcluded: boolean;
  segmentSurvey: FormalQuestionnaireSection;
  postSurvey: {
    title: string;
    commonSections: FormalQuestionnaireSection[];
    manipulationChecks: Record<string, FormalQuestionnaireSection>;
    roleSpecific: Record<'A' | 'B', FormalQuestionnaireSection>;
  };
};
type ExperimentMode = 'manual' | 'formal' | 'ai_upgrade' | 'side_reminder' | 'coop_narrative';
type ExperimentModeSettings = {
  ai_upgrade: { fixedSideDispatchMode: 'continuous' | 'batch'; fixedNarrativeGroup: 'neutral_info' | 'coop_narrative' };
  side_reminder: { fixedAiLevel: 'BASIC' | 'ADVANCED'; fixedNarrativeGroup: 'neutral_info' | 'coop_narrative' };
  coop_narrative: { fixedAiLevel: 'BASIC' | 'ADVANCED'; fixedSideDispatchMode: 'continuous' | 'batch' };
};
type InstructionBlocks = {
  commonTitle: string;
  commonBody: string;
  roleA: string;
  roleB: string;
  experimentFlow: string;
  manual: string;
  ai_upgrade: string;
  side_reminder: string;
  coop_narrative: string;
  aiUpgradeBreakNotice: string;
  aiUpgradeWorkspaceNotice: string;
};

type ExperimentConfig = {
  activeExperimentMode: ExperimentMode;
  activeExperimentRunId?: string | null;
  experimentModeSettings: ExperimentModeSettings;
  instructionBlocks: InstructionBlocks;
  practiceDurationMinutes: number;
  workDurationMinutes: number;
  breakDurationMinutes: number;
  segmentAiLevels: string[];
  questionnaireTemplate: {
    id: string;
    title: string;
    items: FormalQuestionnaireTemplate;
  } | null;
  practiceQuizTemplate: {
    id: string;
    title: string;
    items: QuestionnaireItem[];
  } | null;
  practiceQuizPassCount: number;
  feedbackNotificationDurationSec: number;
};

type ExperimentRunSummary = {
  id: string;
  code: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  designVersion: string;
  initialBlockCount: number;
  generatedBlockCount: number;
  activatedAt: string | null;
  progress: {
    assigned: number;
    completed: number;
    sessionCount: number;
    available: number;
    currentBlockIndex: number;
    claimedInCurrentBlock: number;
    byCondition: Record<string, number>;
  };
};

// Legacy modes remain readable for historical snapshots but are not exposed in the current admin UI.
const MODE_META: Record<ExperimentMode, { title: string; random: string; fixed: string }> = {
  manual: { title: '手动 / 通用', random: '使用手动配置', fixed: '不领取正式实验条件槽位' },
  formal: { title: '正式实验', random: '按匹配顺序领取 A0-A6 平衡区组槽位', fixed: '条件映射写入 Session 快照' },
  ai_upgrade: { title: '历史模式：AI 能力', random: '读取历史快照', fixed: '不用于新 Session' },
  side_reminder: { title: '历史模式：提醒频率', random: '读取历史快照', fixed: '不用于新 Session' },
  coop_narrative: { title: '历史模式：合作信息', random: '读取历史快照', fixed: '不用于新 Session' },
};

type LibraryCaseOverview = {
  folderName: string;
  caseCode: string;
  companyName: string;
  sector: string;
  usage: 'formal' | 'practice';
  participantMaterialCount: number;
  diligenceMaterialCount: number;
  managerMaterialCount: number;
  sharedMaterialCount: number;
  researchMaterialCount: number;
  autoFillSourceRelativePath: string | null;
};

const NAV_ITEMS: { id: TabId; label: string }[] = [
  { id: 'sessions', label: 'Session \u6982\u89c8' },
  { id: 'participants', label: '\u88ab\u8bd5\u540d\u5355' },
  { id: 'config', label: '\u5b9e\u9a8c\u914d\u7f6e' },
  { id: 'questionnaires', label: '\u95ee\u5377\u914d\u7f6e' },
  { id: 'materials', label: '\u6750\u6599\u7ba1\u7406' },
  { id: 'sidefeed', label: '任务2调度' },
  { id: 'ai-settings', label: 'AI \u53c2\u6570' },
];

async function fetchJsonWithRetry<T>(url: string, init?: RequestInit, attempts = 4): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 350));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
}

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [checkedCodes, setCheckedCodes] = useState<string[]>([]);
  const [progresses, setProgresses] = useState<{ id: string; stage: string; participant: { role: string | null } }[]>([]);
  const [status, setStatus] = useState('');
  const [runFilter, setRunFilter] = useState('all');

  async function loadSessions() {
    setStatus('正在加载 Session...');
    try {
      const data = await fetchJsonWithRetry<{ sessions: SessionSummary[] }>(
        `${serverBaseUrl}/admin/sessions`,
        { cache: 'no-store' },
      );
      setSessions(data.sessions ?? []);
      setStatus('');
    } catch (error) {
      setSessions([]);
      const message = error instanceof Error ? error.message : 'unknown error';
      setStatus(`Session 加载失败：${message}；请确认后端 ${serverBaseUrl} 已启动`);
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

  async function exportData(sessionCodes: string[] = []) {
    if (arguments.length > 0 && sessionCodes.length === 0) {
      setStatus('请先勾选要导出的 Session');
      return;
    }
    setStatus(sessionCodes.length > 0 ? '正在生成选中 Session 导出包...' : '正在生成服务器导出包...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/export-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeIncompleteSessions: true, sessionCodes }),
      });
      if (!response.ok) throw new Error('export job failed');
      const data = await response.json() as { job?: { id: string; status: string } };
      const jobId = data.job?.id;
      if (!jobId) throw new Error('missing job id');
      let statusValue = data.job?.status ?? 'running';
      for (let i = 0; i < 30 && statusValue !== 'completed' && statusValue !== 'failed'; i += 1) {
        setStatus(`导出任务 ${jobId}：${statusValue}`);
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const poll = await fetch(`${serverBaseUrl}/admin/export-jobs/${jobId}`, { cache: 'no-store' });
        const pollData = await poll.json() as { job?: { status: string } };
        statusValue = pollData.job?.status ?? statusValue;
      }
      if (statusValue !== 'completed') throw new Error(`export ${statusValue}`);
      const blobResponse = await fetch(`${serverBaseUrl}/admin/export-jobs/${jobId}/download`, { cache: 'no-store' });
      if (!blobResponse.ok) throw new Error('download failed');
      const blob = await blobResponse.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `multi-cooperation-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('已生成并下载导出包');
    } catch {
      setStatus('导出失败');
    }
  }

  async function clearSessions() {
    const confirmation = window.prompt('删除实验数据是高危行为，请在下方输入：“我确认删除数据”才可以进行删除。');
    if (confirmation !== '我确认删除数据') {
      setStatus('已取消：确认文本不匹配');
      return;
    }
    setStatus('清空中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/clear-sessions`, { method: 'POST' });
      if (!response.ok) throw new Error('clear failed');
      setSelectedCode('');
      setCheckedCodes([]);
      setProgresses([]);
      await loadSessions();
      setStatus('已清空');
    } catch {
      setStatus('清空失败');
    }
  }

  async function deleteSessionCodes(codes: string[]) {
    const normalized = Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean)));
    if (normalized.length === 0) {
      setStatus('请先勾选要删除的 Session');
      return;
    }
    if (!window.confirm(`确认删除 ${normalized.length} 个选中 Session 吗？被试名单不会删除。`)) return;
    setStatus('正在删除选中 Session...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/sessions/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: normalized }),
      });
      if (!response.ok) throw new Error('delete failed');
      setCheckedCodes((prev) => prev.filter((code) => !normalized.includes(code)));
      if (selectedCode && normalized.includes(selectedCode)) {
        setSelectedCode('');
        setProgresses([]);
      }
      await loadSessions();
      setStatus('已删除选中 Session');
    } catch {
      setStatus('删除失败');
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  const selected = sessions.find((item) => item.code === selectedCode);
  const runOptions = useMemo(() => {
    const runs = new Map<string, { id: string; label: string }>();
    for (const session of sessions) {
      if (session.experimentRun) {
        runs.set(session.experimentRun.id, {
          id: session.experimentRun.id,
          label: `${session.experimentRun.name} (${session.experimentRun.code})`,
        });
      }
    }
    return Array.from(runs.values());
  }, [sessions]);
  const visibleSessions = useMemo(
    () => runFilter === 'all'
      ? sessions
      : runFilter === 'manual'
        ? sessions.filter((session) => !session.experimentRun)
        : sessions.filter((session) => session.experimentRun?.id === runFilter),
    [runFilter, sessions],
  );
  const visibleCodes = visibleSessions.map((session) => session.code);
  const allChecked = visibleCodes.length > 0 && visibleCodes.every((code) => checkedCodes.includes(code));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold text-[#1d2129]">全部 Session</div>
          <div className="flex items-center gap-3">
            {status ? <span className="text-xs text-[#86909c]">{status}</span> : null}
            <button type="button" onClick={() => void loadSessions()} className="text-xs text-[#1e80ff] hover:underline">刷新</button>
            <button type="button" onClick={() => void exportData()} className="rounded-lg border border-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">导出全部数据</button>
            <button type="button" onClick={() => void exportData(checkedCodes)} className="rounded-lg border border-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">导出选中</button>
            <button type="button" onClick={() => void deleteSessionCodes(checkedCodes)} className="rounded-lg border border-[#ffccc7] px-3 py-1.5 text-xs font-semibold text-[#cf1322] hover:bg-red-50">删除选中</button>
            <button type="button" onClick={() => void clearSessions()} className="rounded-lg border border-[#ffccc7] px-3 py-1.5 text-xs font-semibold text-[#cf1322] hover:bg-red-50">清空实验数据</button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#4e5969]">
            实验局
            <select value={runFilter} onChange={(event) => setRunFilter(event.target.value)} className="rounded border border-[#d9dce1] bg-white px-2 py-1.5 text-xs">
              <option value="all">全部实验局与手动 Session</option>
              {runOptions.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
              <option value="manual">手动 / 未归属实验局</option>
            </select>
          </label>
          {runFilter !== 'all' ? <button type="button" onClick={() => setCheckedCodes((prev) => Array.from(new Set([...prev, ...visibleCodes])))} className="rounded border border-[#d9dce1] px-2.5 py-1.5 text-xs text-[#4e5969] hover:bg-gray-50">选中当前实验局全部 Session</button> : null}
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-[#4e5969]">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(event) => setCheckedCodes((prev) => event.target.checked ? Array.from(new Set([...prev, ...visibleCodes])) : prev.filter((code) => !visibleCodes.includes(code)))}
          />
          全选当前筛选结果（{visibleSessions.length} 个 Session）
        </label>
        <div className="space-y-2">
          {visibleSessions.map((session) => {
            const pairing = session.pairings[0];
            const checked = checkedCodes.includes(session.code);
            return (
              <div
                key={session.id}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                  selectedCode === session.code ? 'border-[#1e80ff] bg-blue-50' : 'border-[#e5e6eb] hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setCheckedCodes((prev) =>
                        event.target.checked
                          ? Array.from(new Set([...prev, session.code]))
                          : prev.filter((code) => code !== session.code),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCode(session.code);
                      void loadProgress(session.code);
                    }}
                    className="font-mono font-bold text-[#1e80ff] hover:underline"
                  >
                    {session.code}
                  </button>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#4e5969]">{session.status}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1e80ff]">
                    {session.experimentRun ? `${session.experimentRun.name} · ${session.experimentRun.code}` : '手动 / 未归属实验局'}
                  </span>
                  {session.experimentCondition ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{session.experimentCondition}</span> : null}
                  <span className="text-xs text-[#86909c]">
                    A: {pairing?.participantA?.phone ?? '-'} / B: {pairing?.participantB?.phone ?? '-'}
                  </span>
                  <span className="ml-auto text-xs text-[#86909c]">段索引: {session.currentSegmentIndex ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => void deleteSessionCodes([session.code])}
                    className="rounded border border-[#ffccc7] px-2 py-1 text-xs font-semibold text-[#cf1322] hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
          {visibleSessions.length === 0 ? <div className="text-sm text-[#86909c]">当前筛选下暂无 Session</div> : null}
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
                    角色 A: {task.aSubmittedAt ? '已提交' : '未提交'}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${task.bCompletedAt ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-[#86909c]'}`}>
                    角色 B: {task.bCompletedAt ? '已完成' : '未完成'}
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      setStatus(`名单加载失败：请确认后端服务 ${serverBaseUrl} 已启动`);
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

  async function deleteSingle(id: string, phone: string) {
    if (!confirm(`确定要删除被试 ${phone} 吗？`)) return;
    setStatus('删除中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/participants/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete failed');
      setStatus('已删除');
      await load();
    } catch {
      setStatus('删除失败');
    }
  }

  async function deleteBatch(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 位被试吗？`)) return;
    setStatus('批量删除中...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/participants/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error('batch delete failed');
      setStatus(`已删除 ${ids.length} 位被试`);
      setSelectedIds(new Set());
      await load();
    } catch {
      setStatus('批量删除失败');
    }
  }

  async function deleteAll() {
    if (participants.length === 0) return;
    if (!confirm(`确定要删除全部 ${participants.length} 位被试吗？此操作不可恢复！`)) return;
    if (!confirm('再次确认：真的要删除全部被试吗？')) return;
    setStatus('全部删除中...');
    try {
      const allIds = participants.map((p) => p.id);
      const response = await fetch(`${serverBaseUrl}/admin/participants/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allIds }),
      });
      if (!response.ok) throw new Error('delete all failed');
      setStatus('已删除全部被试');
      setSelectedIds(new Set());
      await load();
    } catch {
      setStatus('全部删除失败');
    }
  }

  async function setExperimentOpen(isActive: boolean) {
    if (participants.length === 0) return;
    const action = isActive ? '开始实验' : '关闭实验';
    if (!isActive && !window.confirm('确认关闭实验吗？关闭后名单保留，但所有被试将无法登录进入。')) return;
    setStatus(`${action}处理中...`);
    try {
      const response = await fetch(`${serverBaseUrl}/admin/participants/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('set active failed');
      const data = (await response.json()) as { updated?: number };
      setStatus(`${action}完成：已更新 ${data.updated ?? participants.length} 位被试`);
      await load();
    } catch {
      setStatus(`${action}失败`);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === participants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(participants.map((p) => p.id)));
    }
  }

  const allSelected = participants.length > 0 && selectedIds.size === participants.length;
  const activeCount = participants.filter((participant) => participant.isActive).length;
  const inactiveCount = participants.length - activeCount;

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
        <div className="mb-4 rounded-lg border border-[#e5e6eb] bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[#1d2129]">实验入口状态</div>
              <div className="mt-1 text-xs text-[#86909c]">
                已启用 {activeCount} 位，已关闭 {inactiveCount} 位；关闭后名单保留，被试无法登录。
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void setExperimentOpen(true)}
                disabled={participants.length === 0 || inactiveCount === 0}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                实验开始
              </button>
              <button
                type="button"
                onClick={() => void setExperimentOpen(false)}
                disabled={participants.length === 0 || activeCount === 0}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                实验关闭
              </button>
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold text-[#1d2129]">当前名单</div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => void deleteBatch(Array.from(selectedIds))}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                删除选中 ({selectedIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={() => void deleteAll()}
              disabled={participants.length === 0}
              className="rounded-lg border border-red-400 bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              全部删除
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {participants.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-[#e5e6eb] bg-gray-50 px-4 py-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => toggleSelectAll()}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="flex-1 text-xs font-medium text-[#86909c]">全选</span>
            </div>
          )}
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3 rounded-lg border border-[#e5e6eb] px-4 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.has(participant.id)}
                onChange={() => toggleSelect(participant.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="flex-1 font-medium text-[#1d2129]">{participant.phone}</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-[#1e80ff]">准入令牌</span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  participant.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-[#86909c]'
                }`}
              >
                {participant.isActive ? '已启用' : '已关闭'}
              </span>
              <button
                type="button"
                onClick={() => void deleteSingle(participant.id, participant.phone ?? '')}
                className="ml-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                删除
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="py-4 text-center text-sm text-[#86909c]">暂无被试</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SingleChoiceEditor({
  title,
  template,
  onChange,
  allowCorrectOption = false,
}: {
  title: string;
  template: { id: string; title: string; items: QuestionnaireItem[] };
  onChange: (next: { id: string; title: string; items: QuestionnaireItem[] }) => void;
  allowCorrectOption?: boolean;
}) {
  function updateItem(index: number, updater: (item: QuestionnaireItem) => QuestionnaireItem) {
    onChange({
      ...template,
      items: template.items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)),
    });
  }

  return (
    <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
      <div className="mb-4 font-bold text-[#1d2129]">{title}</div>
      <label className="mb-4 block text-sm text-[#4e5969]">
        标题
        <input
          value={template.title}
          onChange={(event) => onChange({ ...template, title: event.target.value })}
          className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
        />
      </label>
      <div className="space-y-4">
        {template.items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-[#e5e6eb] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#1d2129]">题目 {index + 1}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (index === 0) return;
                    const items = [...template.items];
                    [items[index - 1], items[index]] = [items[index], items[index - 1]];
                    onChange({ ...template, items });
                  }}
                  className="rounded border border-[#e5e6eb] px-2 py-1 text-xs"
                >
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index === template.items.length - 1) return;
                    const items = [...template.items];
                    [items[index + 1], items[index]] = [items[index], items[index + 1]];
                    onChange({ ...template, items });
                  }}
                  className="rounded border border-[#e5e6eb] px-2 py-1 text-xs"
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...template, items: template.items.filter((entry) => entry.id !== item.id) })}
                  className="rounded border border-[#fecaca] px-2 py-1 text-xs text-[#b91c1c]"
                >
                  删除
                </button>
              </div>
            </div>
            <label className="block text-sm text-[#4e5969]">
              题干
              <input
                value={item.prompt}
                onChange={(event) => updateItem(index, (entry) => ({ ...entry, prompt: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
              />
            </label>
            <div className="mt-3 space-y-2">
              {item.options.map((option, optionIndex) => (
                <div key={`${item.id}-${optionIndex}`} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(event) =>
                      updateItem(index, (entry) => ({
                        ...entry,
                        options: entry.options.map((current, currentIndex) => (currentIndex === optionIndex ? event.target.value : current)),
                        correctOption:
                          allowCorrectOption && entry.correctOption === option ? event.target.value : entry.correctOption,
                      }))
                    }
                    className="flex-1 rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(index, (entry) => {
                        const nextOptions = entry.options.filter((_, currentIndex) => currentIndex !== optionIndex);
                        const nextCorrect = entry.correctOption === option ? nextOptions[0] ?? '' : entry.correctOption;
                        return { ...entry, options: nextOptions, correctOption: nextCorrect };
                      })
                    }
                    className="rounded border border-[#fecaca] px-2 py-1 text-xs text-[#b91c1c]"
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateItem(index, (entry) => ({ ...entry, options: [...entry.options, '新选项'] }))}
                className="rounded-lg border border-[#dbeafe] px-3 py-1.5 text-xs text-[#1e80ff]"
              >
                添加选项
              </button>
            </div>
            {allowCorrectOption ? (
              <label className="mt-3 block text-sm text-[#4e5969]">
                正确答案
                <select
                  value={item.correctOption ?? item.options[0] ?? ''}
                  onChange={(event) => updateItem(index, (entry) => ({ ...entry, correctOption: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
                >
                  {item.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...template,
            items: [...template.items, { id: `q${Date.now()}`, prompt: '', options: ['选项 1', '选项 2'], correctOption: allowCorrectOption ? '选项 1' : undefined }],
          })
        }
        className="mt-4 rounded-lg border border-[#dbeafe] px-4 py-2 text-sm text-[#1e80ff]"
      >
        添加题目
      </button>
    </div>
  );
}

const FORMAL_CONDITIONS = [
  ['A0', '无 AI', 'continuous 高频提醒', 'neutral_info 中性信息'],
  ['A1', 'BASIC 基础 AI', 'continuous 高频提醒', 'neutral_info 中性信息'],
  ['A2', 'ADVANCED 高级 AI', 'continuous 高频提醒', 'neutral_info 中性信息'],
  ['A3', 'BASIC 基础 AI', 'batch 低频提醒', 'neutral_info 中性信息'],
  ['A4', 'BASIC 基础 AI', 'continuous 高频提醒', 'coop_narrative 合作叙事'],
  ['A5', 'ADVANCED 高级 AI', 'continuous 高频提醒', 'coop_narrative 合作叙事'],
  ['A6', 'ADVANCED 高级 AI', 'batch 低频提醒', 'neutral_info 中性信息'],
] as const;

function ExperimentRunPanel({ activeMode, onChanged }: { activeMode: ExperimentMode; onChanged: () => Promise<void> }) {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  async function loadRuns() {
    const data = await fetchJsonWithRetry<{ runs: ExperimentRunSummary[] }>(`${serverBaseUrl}/admin/experiment-runs`);
    setRuns(data.runs);
  }

  useEffect(() => { void loadRuns(); }, []);

  async function action(path: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') {
    setStatus('处理中...');
    const response = await fetch(`${serverBaseUrl}/admin/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `操作失败（${response.status}）`;
      try {
        const payload = (await response.json()) as { message?: string | string[] };
        if (payload.message) message = Array.isArray(payload.message) ? payload.message.join('；') : payload.message;
      } catch {
        // Keep the HTTP status fallback when the response has no JSON body.
      }
      setStatus(message);
      return;
    }
    setStatus('已更新');
    await Promise.all([loadRuns(), onChanged()]);
  }

  function activateRun(run: ExperimentRunSummary) {
    const current = runs.find((item) => item.status === 'ACTIVE' && item.id !== run.id);
    if (current && !window.confirm(`切换后“${current.name}”会暂停，“${run.name}”将从原有数据库进度继续分配。确认切换吗？`)) return;
    void action(`experiment-runs/${run.id}/activate`);
  }

  function deleteRun(run: ExperimentRunSummary) {
    if (run.progress.sessionCount > 0) {
      setStatus(`“${run.name}”仍关联 ${run.progress.sessionCount} 个 Session，请先在 Session 概览中清理对应被试数据`);
      return;
    }
    if (!window.confirm(`确认永久删除实验局“${run.name}”及其未使用的条件序列吗？`)) return;
    void action(`experiment-runs/${run.id}`, undefined, 'DELETE');
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#e5e6eb] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-[#1d2129]">实验模式</div>
          <div className="mt-1 text-xs text-[#86909c]">当前：{activeMode === 'formal' ? '正式实验模式' : '手动 / 通用模式'}</div>
          <div className="mt-1 text-xs text-[#86909c]">切换实验局只影响之后新匹配的 Session；旧实验局再次启用时会从数据库中的下一可用槽位继续。</div>
        </div>
        <button type="button" onClick={() => void action('experiment-runs/use-manual')} className="rounded border border-[#d9dce1] px-3 py-2 text-sm hover:bg-gray-50">
          使用手动 / 通用模式
        </button>
      </div>

      <div className="overflow-x-auto border-y border-[#eaecf0] py-3">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-[#86909c]"><tr><th className="py-2">条件</th><th>AI</th><th>任务2提醒</th><th>叙事</th></tr></thead>
          <tbody>{FORMAL_CONDITIONS.map((row) => <tr key={row[0]} className="border-t border-[#f0f1f2]"><td className="py-2 font-semibold">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="实验局名称" className="min-w-64 rounded border border-[#d9dce1] px-3 py-2 text-sm" />
        <button type="button" onClick={() => void action('experiment-runs', { name })} className="rounded bg-[#1e80ff] px-3 py-2 text-sm font-semibold text-white">创建实验局并生成60个区组</button>
        <button type="button" onClick={() => void loadRuns()} className="rounded border border-[#d9dce1] p-2" title="刷新"><RefreshCw size={16} /></button>
        {status ? <span className="self-center text-xs text-[#4e5969]">{status}</span> : null}
      </div>

      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="grid gap-3 border-b border-[#eaecf0] py-3 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm"><strong>{run.name}</strong><span className="text-[#86909c]">{run.code}</span><span>{run.status === 'ACTIVE' ? '正在分配' : run.status === 'CLOSED' ? '已暂停' : '未启动'}</span></div>
              <div className="mt-1 text-xs text-[#4e5969]">区组 {run.progress.currentBlockIndex}，已领取 {run.progress.claimedInCurrentBlock}/7；累计分配 {run.progress.assigned}，关联 Session {run.progress.sessionCount}，完成 {run.progress.completed}，队列剩余 {run.progress.available}</div>
              <div className="mt-1 text-xs text-[#86909c]">{FORMAL_CONDITIONS.map(([condition]) => `${condition}: ${run.progress.byCondition[condition] ?? 0}`).join('  ·  ')}</div>
            </div>
            <div className="flex items-center gap-2">
              {run.status !== 'ACTIVE' ? <button type="button" onClick={() => activateRun(run)} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Play size={14} />{run.status === 'CLOSED' ? '继续此实验局' : '激活正式实验'}</button> : null}
              {run.status === 'ACTIVE' ? <button type="button" onClick={() => void action(`experiment-runs/${run.id}/close`)} className="inline-flex items-center gap-1 rounded border border-amber-300 px-3 py-2 text-xs text-amber-700"><Pause size={14} />暂停实验局</button> : null}
              {run.status !== 'ACTIVE' ? <button type="button" onClick={() => deleteRun(run)} className="grid size-8 place-items-center rounded border border-red-200 text-red-600 hover:bg-red-50" title="删除实验局" aria-label={`删除实验局 ${run.name}`}><Trash2 size={15} /></button> : null}
            </div>
          </div>
        ))}
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
    const currentConfig = config;
    setStatus('保存中...');
    await fetch(`${serverBaseUrl}/admin/experiment-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeExperimentMode: currentConfig.activeExperimentMode,
          experimentModeSettings: currentConfig.experimentModeSettings,
          instructionBlocks: currentConfig.instructionBlocks,
          practiceDurationMinutes: currentConfig.practiceDurationMinutes,
        workDurationMinutes: currentConfig.workDurationMinutes,
        breakDurationMinutes: currentConfig.breakDurationMinutes,
        segmentAiLevels: currentConfig.segmentAiLevels,
        questionnaireTitle: currentConfig.questionnaireTemplate?.title ?? '三章实验正式问卷 V2.2',
        questionnaireItems: currentConfig.questionnaireTemplate?.items ?? null,
        practiceQuizTitle: currentConfig.practiceQuizTemplate?.title ?? '测试题',
        practiceQuizItems: currentConfig.practiceQuizTemplate?.items ?? [],
        practiceQuizPassCount: currentConfig.practiceQuizPassCount,
        feedbackNotificationDurationSec: currentConfig.feedbackNotificationDurationSec,
      }),
    });
    setStatus('已保存');
    await load();
  }
  const practiceQuiz = config.practiceQuizTemplate ?? {
    id: 'default-practice-quiz',
    title: '测试题',
    items: [{ id: 'pq1', prompt: '', options: ['选项 1', '选项 2'], correctOption: '选项 1' }],
  };

  return (
    <div className="space-y-5">
      <ExperimentRunPanel activeMode={config.activeExperimentMode} onChanged={load} />
      <div className="hidden">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[#1d2129]">实验模式</div>
            <div className="mt-1 text-xs text-[#86909c]">只影响新 Session；旧 Session 使用创建时保存的快照。</div>
          </div>
          <select
            value={config.activeExperimentMode}
            onChange={(event) => setConfig((prev) => prev ? { ...prev, activeExperimentMode: event.target.value as ExperimentMode } : prev)}
            className="rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]"
          >
            {(Object.keys(MODE_META) as ExperimentMode[]).map((mode) => (
              <option key={mode} value={mode}>{MODE_META[mode].title}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {(Object.keys(MODE_META) as ExperimentMode[]).map((mode) => {
            const active = config.activeExperimentMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setConfig((prev) => prev ? { ...prev, activeExperimentMode: mode } : prev)}
                className={`rounded-xl border p-4 text-left transition-colors ${active ? 'border-[#1e80ff] bg-blue-50/70' : 'border-[#e5e6eb] bg-[#fafafa] hover:border-blue-200'}`}
              >
                <div className="text-sm font-bold text-[#1d2129]">{MODE_META[mode].title}</div>
                <div className="mt-2 text-xs leading-relaxed text-[#4e5969]">随机：{MODE_META[mode].random}</div>
                <div className="mt-1 text-xs leading-relaxed text-[#4e5969]">固定：{MODE_META[mode].fixed}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="mb-3 text-sm font-semibold text-[#1d2129]">实验 1 固定变量</div>
            <label className="block text-xs text-[#4e5969]">
              副线提醒
              <select value={config.experimentModeSettings.ai_upgrade.fixedSideDispatchMode} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, ai_upgrade: { ...prev.experimentModeSettings.ai_upgrade, fixedSideDispatchMode: event.target.value as 'continuous' | 'batch' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="continuous">continuous 高频提醒</option>
                <option value="batch">batch 批量提醒</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-[#4e5969]">
              叙事信息
              <select value={config.experimentModeSettings.ai_upgrade.fixedNarrativeGroup} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, ai_upgrade: { ...prev.experimentModeSettings.ai_upgrade, fixedNarrativeGroup: event.target.value as 'neutral_info' | 'coop_narrative' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="neutral_info">neutral_info 中性信息</option>
                <option value="coop_narrative">coop_narrative 合作叙事</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="mb-3 text-sm font-semibold text-[#1d2129]">实验 2 固定变量</div>
            <label className="block text-xs text-[#4e5969]">
              AI 能力
              <select value={config.experimentModeSettings.side_reminder.fixedAiLevel} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, side_reminder: { ...prev.experimentModeSettings.side_reminder, fixedAiLevel: event.target.value as 'BASIC' | 'ADVANCED' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="BASIC">BASIC 基础版</option>
                <option value="ADVANCED">ADVANCED 升级版</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-[#4e5969]">
              叙事信息
              <select value={config.experimentModeSettings.side_reminder.fixedNarrativeGroup} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, side_reminder: { ...prev.experimentModeSettings.side_reminder, fixedNarrativeGroup: event.target.value as 'neutral_info' | 'coop_narrative' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="neutral_info">neutral_info 中性信息</option>
                <option value="coop_narrative">coop_narrative 合作叙事</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="mb-3 text-sm font-semibold text-[#1d2129]">实验 3 固定变量</div>
            <label className="block text-xs text-[#4e5969]">
              AI 能力
              <select value={config.experimentModeSettings.coop_narrative.fixedAiLevel} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, coop_narrative: { ...prev.experimentModeSettings.coop_narrative, fixedAiLevel: event.target.value as 'BASIC' | 'ADVANCED' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="BASIC">BASIC 基础版</option>
                <option value="ADVANCED">ADVANCED 升级版</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-[#4e5969]">
              副线提醒
              <select value={config.experimentModeSettings.coop_narrative.fixedSideDispatchMode} onChange={(event) => setConfig((prev) => prev ? { ...prev, experimentModeSettings: { ...prev.experimentModeSettings, coop_narrative: { ...prev.experimentModeSettings.coop_narrative, fixedSideDispatchMode: event.target.value as 'continuous' | 'batch' } } } : prev)} className="mt-1 w-full rounded border border-[#e5e6eb] bg-white px-2 py-1.5">
                <option value="continuous">continuous 高频提醒</option>
                <option value="batch">batch 批量提醒</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 font-bold text-[#1d2129]">时间参数</div>
        <div className="grid grid-cols-4 gap-4">
          <label className="text-sm text-[#4e5969]">
            测试轮时长（分钟）
            <input type="number" min={1} value={config.practiceDurationMinutes} onChange={(event) => setConfig((prev) => (prev ? { ...prev, practiceDurationMinutes: Number(event.target.value) || 10 } : prev))} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]" />
          </label>
          <label className="text-sm text-[#4e5969]">
            工作段时长（分钟）
            <input type="number" min={1} value={config.workDurationMinutes} onChange={(event) => setConfig((prev) => (prev ? { ...prev, workDurationMinutes: Number(event.target.value) || 20 } : prev))} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]" />
          </label>
          <label className="text-sm text-[#4e5969]">
            休息段时长（分钟）
            <input type="number" min={1} value={config.breakDurationMinutes} onChange={(event) => setConfig((prev) => (prev ? { ...prev, breakDurationMinutes: Number(event.target.value) || 5 } : prev))} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]" />
          </label>
          <label className="text-sm text-[#4e5969]">
            A反馈弹窗停留（秒）
            <input type="number" min={1} value={config.feedbackNotificationDurationSec ?? 10} onChange={(event) => setConfig((prev) => (prev ? { ...prev, feedbackNotificationDurationSec: Number(event.target.value) || 10 } : prev))} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]" />
          </label>
        </div>
      </div>

      <SingleChoiceEditor title="测试题模板" template={practiceQuiz} allowCorrectOption onChange={(next) => setConfig((prev) => (prev ? { ...prev, practiceQuizTemplate: next } : prev))} />

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="font-bold text-[#1d2129]">测试题通过标准</div>
        <label className="mt-4 block text-sm text-[#4e5969]">
          至少答对多少题
          <input type="number" min={0} max={practiceQuiz.items.length || 1} value={config.practiceQuizPassCount} onChange={(event) => setConfig((prev) => (prev ? { ...prev, practiceQuizPassCount: Number(event.target.value) || 0 } : prev))} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]" />
        </label>
        <div className="mt-2 text-xs text-[#86909c]">填 0 表示默认按“全对通过”。</div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">保存配置</button>
        {status ? <span className="text-xs text-[#86909c]">{status}</span> : null}
      </div>
    </div>
  );
}

function cloneFormalTemplate(template: FormalQuestionnaireTemplate): FormalQuestionnaireTemplate {
  return JSON.parse(JSON.stringify(template)) as FormalQuestionnaireTemplate;
}

function updateFormalItems(
  template: FormalQuestionnaireTemplate,
  matcher: (section: FormalQuestionnaireSection) => boolean,
  updater: (items: FormalQuestionnaireItem[]) => FormalQuestionnaireItem[],
) {
  const next = cloneFormalTemplate(template);
  if (matcher(next.segmentSurvey)) next.segmentSurvey.items = updater(next.segmentSurvey.items);
  next.postSurvey.commonSections = next.postSurvey.commonSections.map((section) =>
    matcher(section) ? { ...section, items: updater(section.items) } : section,
  );
  next.postSurvey.manipulationChecks = Object.fromEntries(
    Object.entries(next.postSurvey.manipulationChecks).map(([key, section]) => [
      key,
      matcher(section) ? { ...section, items: updater(section.items) } : section,
    ]),
  );
  next.postSurvey.roleSpecific = {
    A: matcher(next.postSurvey.roleSpecific.A)
      ? { ...next.postSurvey.roleSpecific.A, items: updater(next.postSurvey.roleSpecific.A.items) }
      : next.postSurvey.roleSpecific.A,
    B: matcher(next.postSurvey.roleSpecific.B)
      ? { ...next.postSurvey.roleSpecific.B, items: updater(next.postSurvey.roleSpecific.B.items) }
      : next.postSurvey.roleSpecific.B,
  };
  return next;
}

function FormalQuestionnaireSectionEditor({
  section,
  onChange,
}: {
  section: FormalQuestionnaireSection;
  onChange: (nextItems: FormalQuestionnaireItem[]) => void;
}) {
  function updateItem(index: number, updater: (item: FormalQuestionnaireItem) => FormalQuestionnaireItem) {
    onChange(section.items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
  }

  return (
    <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-bold text-[#1d2129]">{section.title}</div>
        <div className="text-xs text-[#86909c]">{section.items.length} 题</div>
      </div>
      <div className="space-y-4">
        {section.items.map((item, index) => (
          <div key={item.code} className="rounded-lg border border-[#e5e6eb] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#86909c]">
              <span className="rounded bg-gray-100 px-2 py-1">{item.code}</span>
              <span className="rounded bg-blue-50 px-2 py-1 text-[#1e80ff]">{item.type}</span>
              {item.required ? <span className="rounded bg-red-50 px-2 py-1 text-red-600">required</span> : null}
            </div>
            <label className="block text-sm text-[#4e5969]">
              题干
              <textarea
                value={item.prompt}
                onChange={(event) => updateItem(index, (entry) => ({ ...entry, prompt: event.target.value }))}
                rows={2}
                className="mt-1 w-full resize-y rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
              />
            </label>
            {item.options ? (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-semibold text-[#4e5969]">选项</div>
                {item.options.map((option, optionIndex) => (
                  <input
                    key={`${item.code}-${optionIndex}`}
                    value={option}
                    onChange={(event) =>
                      updateItem(index, (entry) => ({
                        ...entry,
                        options: (entry.options ?? []).map((current, currentIndex) =>
                          currentIndex === optionIndex ? event.target.value : current,
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#1e80ff]"
                  />
                ))}
              </div>
            ) : null}
            {item.type === 'scale' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-[#4e5969]">
                  左端点
                  <input
                    value={item.minLabel ?? ''}
                    onChange={(event) => updateItem(index, (entry) => ({ ...entry, minLabel: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
                  />
                </label>
                <label className="text-xs text-[#4e5969]">
                  右端点
                  <input
                    value={item.maxLabel ?? ''}
                    onChange={(event) => updateItem(index, (entry) => ({ ...entry, maxLabel: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
                  />
                </label>
              </div>
            ) : null}
            {item.type === 'text' ? (
              <label className="mt-3 block text-xs text-[#4e5969]">
                最大字数
                <input
                  type="number"
                  min={1}
                  value={item.maxLength ?? 500}
                  onChange={(event) => updateItem(index, (entry) => ({ ...entry, maxLength: Number(event.target.value) || 500 }))}
                  className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
                />
              </label>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionnaireConfigTab() {
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

  async function save() {
    if (!config?.questionnaireTemplate) return;
    setStatus('保存中...');
    await fetch(`${serverBaseUrl}/admin/experiment-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeExperimentMode: config.activeExperimentMode,
        experimentModeSettings: config.experimentModeSettings,
        instructionBlocks: config.instructionBlocks,
        practiceDurationMinutes: config.practiceDurationMinutes,
        workDurationMinutes: config.workDurationMinutes,
        breakDurationMinutes: config.breakDurationMinutes,
        segmentAiLevels: config.segmentAiLevels,
        questionnaireTitle: config.questionnaireTemplate.title,
        questionnaireItems: config.questionnaireTemplate.items,
        practiceQuizTitle: config.practiceQuizTemplate?.title ?? '测试题',
        practiceQuizItems: config.practiceQuizTemplate?.items ?? [],
        practiceQuizPassCount: config.practiceQuizPassCount,
        feedbackNotificationDurationSec: config.feedbackNotificationDurationSec,
      }),
    });
    setStatus('已保存');
    await load();
  }

  if (!config?.questionnaireTemplate) {
    return <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 text-sm text-[#86909c]">问卷配置加载中...</div>;
  }

  const template = config.questionnaireTemplate.items;
  const updateTemplate = (updater: (current: FormalQuestionnaireTemplate) => FormalQuestionnaireTemplate) => {
    setConfig((prev) =>
      prev?.questionnaireTemplate
        ? {
            ...prev,
            questionnaireTemplate: {
              ...prev.questionnaireTemplate,
              items: updater(prev.questionnaireTemplate.items),
            },
          }
        : prev,
    );
  };

  const sectionBlocks: Array<{ key: string; section: FormalQuestionnaireSection }> = [
    { key: 'segmentSurvey', section: template.segmentSurvey },
    ...template.postSurvey.commonSections.map((section, index) => ({ key: `common-${index}`, section })),
    ...Object.entries(template.postSurvey.manipulationChecks).map(([key, section]) => ({ key: `mc-${key}`, section })),
    { key: 'role-A', section: template.postSurvey.roleSpecific.A },
    { key: 'role-B', section: template.postSurvey.roleSpecific.B },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-[#1d2129]">问卷页面流转与组装规则</div>
            <div className="mt-1 text-sm leading-6 text-[#4e5969]">
              下方编辑器保存所有可能题目；参与者实际看到的题目由 server 在进入对应阶段时按实验条件、角色和已记录行为过滤。
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-blue-50 px-2 py-1 font-semibold text-[#1e80ff]">V2.2</span>
            <span className="rounded bg-gray-100 px-2 py-1 text-[#4e5969]">{template.version}</span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto border-y border-[#e5e6eb]">
          <table className="w-full min-w-[900px] table-fixed text-left text-xs leading-5 text-[#4e5969]">
            <thead className="bg-[#f7f8fa] text-[#1d2129]">
              <tr>
                <th className="w-[18%] px-3 py-2.5 font-semibold">页面 / 时点</th>
                <th className="w-[20%] px-3 py-2.5 font-semibold">问卷内容</th>
                <th className="w-[39%] px-3 py-2.5 font-semibold">组装规则</th>
                <th className="w-[23%] px-3 py-2.5 font-semibold">提交后去向</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0f2]">
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">平台外报名阶段</td><td className="px-3 py-3">招募问卷</td><td className="px-3 py-3">A0-A6 共用，在处理分配、角色信息和材料展示前完成；不进入本系统。</td><td className="px-3 py-3">实验人员导入参与者手机号</td></tr>
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">/practice-quiz</td><td className="px-3 py-3">测试轮开始前测试题</td><td className="px-3 py-3">使用“实验配置”中的测试题模板和通过标准，不使用本页 V2.2 正式问卷。</td><td className="px-3 py-3">通过后进入测试轮 ready</td></tr>
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">/break · 工作段 1/2 后</td><td className="px-3 py-3">第 1/2 段工作回顾</td><td className="px-3 py-3">每段 6 道共同题；A1-A6 且本人在刚结束工作段实际调用过任务1 AI 时，再增加 3 道该段 AI 体验题。</td><td className="px-3 py-3">提交后进入对应休息段</td></tr>
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">/workspace/end · 工作段 3 后</td><td className="px-3 py-3">第 3 段工作回顾</td><td className="px-3 py-3">与前两段使用同一套 6/9 题规则，单独显示为“第 3 段工作回顾”。</td><td className="px-3 py-3">提交后继续显示最终长问卷</td></tr>
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">/workspace/end · 最终阶段</td><td className="px-3 py-3">人口特征统计和其他信息采集问卷</td><td className="px-3 py-3">按 A/B 角色、A0-A6、任务1 AI 调用、图片上传、交接备注、查看 A 材料和反馈行为动态组装。</td><td className="px-3 py-3">提交后进入独立支付确认</td></tr>
              <tr><td className="px-3 py-3 font-medium text-[#1d2129]">/workspace/end · 问卷后</td><td className="px-3 py-3">支付手机号确认（非问卷）</td><td className="px-3 py-3">只显示报名手机号掩码并记录确认状态；完整手机号不写入问卷答案和分析导出。</td><td className="px-3 py-3">确认后记录实验完成</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-5 text-xs leading-6 text-[#4e5969] lg:grid-cols-3 lg:divide-x lg:divide-[#e5e6eb]">
          <div className="lg:pr-5">
            <div className="mb-1 text-sm font-semibold text-[#1d2129]">工作段回顾：6 + 3</div>
            <div>共同 6 题：脑力负荷、努力投入、时间压力、任务2干扰、输出信心、疲劳。</div>
            <div className="mt-1">条件 3 题：任务1 AI 帮助感、校验成本、可靠性。A0 永不显示；A1-A6 仅在本人当段至少发送过一次任务1 AI 请求时显示。</div>
          </div>
          <div className="lg:px-5">
            <div className="mb-1 text-sm font-semibold text-[#1d2129]">最终问卷：条件与角色</div>
            <div>A0 隐藏实际 AI 体验和 AI 图片功能感知，但仍回答“更强 AI”假设题；A1-A6 的实际 AI 体验依据调用行为显示，图片帮助题还要求高级 AI 条件且实际上传过图片。</div>
            <div className="mt-1">A/B 各取自己的角色复盘；交接备注、A 原始材料和反馈相关题只在后台记录到对应行为时显示。</div>
          </div>
          <div className="lg:pl-5">
            <div className="mb-1 text-sm font-semibold text-[#1d2129]">固定顺序与审查边界</div>
            <div>最终顺序为：合作信念 → 角色复盘 → AI 实际体验 → AI 能力变化预期 → 任务策略 → 任务2感知 → 文本主题 → AI 图片功能 → 界面体验 → 人口统计 → 报酬清晰度。</div>
            <div className="mt-1 font-medium text-[#cf1322]">本页可修改题干、选项和量表端点；跳题条件由 server 依据题号执行。修改题号或希望改变显示范围时必须同步修改并测试后端规则。</div>
          </div>
        </div>
      </div>

      {sectionBlocks.map(({ key, section }) => (
        <FormalQuestionnaireSectionEditor
          key={key}
          section={section}
          onChange={(items) =>
            updateTemplate((current) => updateFormalItems(current, (candidate) => candidate.title === section.title, () => items))
          }
        />
      ))}

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">
          保存问卷配置
        </button>
        {status ? <span className="text-xs text-[#86909c]">{status}</span> : null}
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
                <div key={`${item.usage}-${item.folderName}-${item.caseCode}`} className="rounded-lg border border-[#eef0f3] bg-white px-3 py-2 text-xs text-[#4e5969]">
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
                <div className="font-medium text-[#1d2129]">{company.name} <span className="ml-2 rounded bg-[#eef6ff] px-2 py-0.5 text-[11px] font-normal text-[#1e80ff]">{company.usage === 'practice' ? '测试轮' : '正式轮'}</span></div>
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

function MaterialsLibraryTab() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedId) ?? companies[0] ?? null,
    [companies, selectedId],
  );

  async function loadCompanies(preferId?: string) {
    setStatus('正在加载材料库...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/companies`, { cache: 'no-store' });
      if (!response.ok) throw new Error('companies failed');
      const data = (await response.json()) as { companies: CompanyData[] };
      const nextCompanies = data.companies ?? [];
      setCompanies(nextCompanies);
      setSelectedId(preferId ?? selectedId ?? nextCompanies[0]?.id ?? '');
      setSelectedIds((current) => current.filter((id) => nextCompanies.some((company) => company.id === id)));
      setStatus('');
    } catch {
      setCompanies([]);
      setStatus('材料库加载失败');
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  function toggleCompany(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function uploadRelativePaths(files: FileList) {
    return Array.from(files).map((file) => {
      const withPath = file as File & { webkitRelativePath?: string };
      return withPath.webkitRelativePath || file.name;
    });
  }

  async function replaceFromFolders(files: FileList | null, mode: 'selected' | 'all') {
    if (!files || files.length === 0) return;
    if (mode === 'selected' && selectedIds.length === 0) {
      window.alert('请先勾选要替换的公司。');
      return;
    }

    const body = new FormData();
    const fileArray = Array.from(files);
    const relativePaths = uploadRelativePaths(files);
    fileArray.forEach((file, index) => {
      body.append('files', file, relativePaths[index]);
    });
    body.append('mode', mode);
    body.append('companyIds', JSON.stringify(mode === 'selected' ? selectedIds : []));
    body.append('relativePaths', JSON.stringify(relativePaths));

    setUploading(true);
    setStatus(mode === 'all' ? '正在上传并全部替换材料库...' : '正在上传并替换选中公司...');
    try {
      const response = await fetch(`${serverBaseUrl}/admin/companies/library/replace-upload`, {
        method: 'POST',
        body,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) as { totalImported?: number; message?: string } : {};
      if (!response.ok) {
        window.alert(data.message || text || '材料结构不符合要求，请检查后重新上传。');
        setStatus('替换失败');
        return;
      }
      await loadCompanies(mode === 'selected' ? selectedIds[0] : undefined);
      setStatus(`替换完成，共导入 ${data.totalImported ?? 0} 家公司`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      window.alert(message);
      setStatus('上传失败');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`grid min-h-[720px] gap-5 ${previewOpen ? 'xl:grid-cols-[420px_minmax(0,1fr)]' : 'xl:grid-cols-1'}`}>
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[#1d2129]">材料管理</div>
            <div className="mt-1 text-xs text-[#86909c]">当前共 {companies.length} 家公司，已勾选 {selectedIds.length} 家。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void loadCompanies()} className="rounded-lg border border-[#e5e6eb] p-2 text-[#4e5969] hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPreviewOpen((value) => !value)} className="rounded-lg border border-[#1e80ff] px-3 py-2 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50">
              {previewOpen ? '关闭预览' : '打开预览'}
            </button>
            <label className={`cursor-pointer rounded-lg border border-[#1e80ff] px-3 py-2 text-xs font-semibold text-[#1e80ff] hover:bg-blue-50 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
              替换选中公司
              <input
                type="file"
                multiple
                className="hidden"
                // @ts-expect-error webkitdirectory is supported by Chromium-based browsers.
                webkitdirectory=""
                directory=""
                onChange={(event) => {
                  void replaceFromFolders(event.currentTarget.files, 'selected');
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <label className={`cursor-pointer rounded-lg bg-[#1e80ff] px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
              全部替换
              <input
                type="file"
                multiple
                className="hidden"
                // @ts-expect-error webkitdirectory is supported by Chromium-based browsers.
                webkitdirectory=""
                directory=""
                onChange={(event) => {
                  if (window.confirm('确认全部替换材料库吗？系统会先备份旧材料文件，再导入新上传的大文件夹。')) {
                    void replaceFromFolders(event.currentTarget.files, 'all');
                  }
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-[#d9e7ff] bg-blue-50 px-3 py-3 text-xs leading-6 text-[#1e80ff]">
          <div className="font-semibold">上传规则</div>
          <div className="mt-1 text-[#4e5969]">
            替换选中公司：勾选一个或多个公司后，上传同数量的公司文件夹。全部替换：上传包含 `正式/` 和 `测试轮/` 的大文件夹。系统会检查 `participant/shared`、`participant/diligence`、`participant/manager`、`research` 结构，不符合会弹窗提示。
          </div>
        </div>

        {status ? <div className="mb-4 rounded-lg bg-[#fafbfc] px-3 py-2 text-xs text-[#4e5969]">{status}</div> : null}

        <div className={`grid gap-3 ${previewOpen ? 'grid-cols-1' : 'lg:grid-cols-2 xl:grid-cols-3'}`}>
            {companies.map((company) => (
              <div
                key={company.id}
                className={`rounded-lg border px-4 py-3 transition ${
                  selectedCompany?.id === company.id ? 'border-[#1e80ff] bg-blue-50' : 'border-[#e5e6eb] hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(company.id)}
                    onChange={() => toggleCompany(company.id)}
                    className="mt-1"
                  />
                  <button type="button" onClick={() => setSelectedId(company.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium text-[#1d2129]">
                      {company.name}
                      <span className="ml-2 rounded bg-[#eef6ff] px-2 py-0.5 text-[11px] font-normal text-[#1e80ff]">
                        {company.usage === 'practice' ? '测试轮' : '正式'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[#86909c]">
                      {company.roundLabel} / {company.materials.length} 份材料
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
      </div>

      {previewOpen ? <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
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
      </div> : null}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(hasAdminToken());
    const handleExpired = () => {
      setAuthenticated(false);
      setAuthError('Login expired. Please enter the admin password again.');
    };
    window.addEventListener('admin-auth-expired', handleExpired);
    return () => window.removeEventListener('admin-auth-expired', handleExpired);
  }, []);

  async function handleAdminLogin() {
    try {
      await loginAdmin(password.trim());
      setAuthenticated(true);
      setAuthError('');
    } catch {
      clearAdminToken();
      setAuthenticated(false);
      setAuthError('Password is incorrect or the server is unavailable.');
    }
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <div className="w-full max-w-sm rounded-2xl border border-[#eaecf0] bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-2 text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI Investment Platform</div>
            <div className="text-sm text-[#86909c]">Enter admin password</div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#1d2129]">Admin password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setAuthError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleAdminLogin();
                }}
                className="w-full rounded-lg border border-[#eaecf0] bg-[#f5f7fa] px-3 py-2.5 text-sm text-[#1d2129] outline-none transition focus:border-[#1e80ff] focus:bg-white focus:ring-2 focus:ring-[#1e80ff]/20"
              />
            </label>
            {authError ? <div className="text-xs text-red-500">{authError}</div> : null}
            <button
              type="button"
              onClick={() => void handleAdminLogin()}
              className="w-full rounded-lg bg-[#1e80ff] py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98]"
            >
              Enter admin
            </button>
          </div>
        </div>
      </main>
    );
  }

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
        {activeTab === 'questionnaires' ? <QuestionnaireConfigTab /> : null}
        {activeTab === 'materials' ? <MaterialsLibraryTab /> : null}
        {activeTab === 'sidefeed' ? <AdminSidefeedPanel /> : null}
        {activeTab === 'ai-settings' ? <AdminAiSettingsPanel /> : null}
      </div>
    </main>
  );
}
