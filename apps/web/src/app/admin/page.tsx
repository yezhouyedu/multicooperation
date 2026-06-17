'use client';

import { AdminSidefeedPanel } from '@/components/admin-sidefeed-panel';
import { AdminAiSettingsPanel } from '@/components/admin-ai-settings-panel';
import { CompanyMaterialPanel } from '@/components/company-material-panel';
import type { CompanyData } from '@/lib/session-runtime';
import { ArrowDown, ArrowUp, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type TabId = 'sessions' | 'participants' | 'config' | 'questionnaires' | 'materials' | 'sidefeed' | 'ai-settings';

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
type FormalQuestionnaireSection = { title: string; items: FormalQuestionnaireItem[] };
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
type ExperimentMode = 'manual' | 'ai_upgrade' | 'side_reminder' | 'coop_narrative';
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
  manual: string;
  ai_upgrade: string;
  side_reminder: string;
  coop_narrative: string;
  aiUpgradeBreakNotice: string;
  aiUpgradeWorkspaceNotice: string;
};

type ExperimentConfig = {
  activeExperimentMode: ExperimentMode;
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

const MODE_META: Record<ExperimentMode, { title: string; random: string; fixed: string }> = {
  manual: {
    title: '手动 / 通用',
    random: '不启用实验 1/2/3 的预设随机化',
    fixed: '使用下方手动段 AI 与现有副线/叙事配置',
  },
  ai_upgrade: {
    title: '实验 1：AI 能力升级',
    random: '随机 early_upgrade / late_upgrade',
    fixed: '固定副线提醒与叙事信息',
  },
  side_reminder: {
    title: '实验 2：副线提醒频率',
    random: '随机 continuous / batch',
    fixed: '固定 AI 能力与叙事信息',
  },
  coop_narrative: {
    title: '实验 3：合作叙事',
    random: '随机 coop_narrative / neutral_info；合作组随机主题顺序',
    fixed: '固定 AI 能力与副线提醒',
  },
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
  { id: 'sidefeed', label: '\u526f\u7ebf\u8c03\u5ea6' },
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
  const allChecked = sessions.length > 0 && checkedCodes.length === sessions.length;

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
        <label className="mb-2 flex items-center gap-2 text-xs text-[#4e5969]">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(event) => setCheckedCodes(event.target.checked ? sessions.map((session) => session.code) : [])}
          />
          全选当前 Session
        </label>
        <div className="space-y-2">
          {sessions.map((session) => {
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
                  <span className="text-xs text-[#86909c]">
                    尽调员: {pairing?.participantA?.phone ?? '-'} / 投资经理: {pairing?.participantB?.phone ?? '-'}
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
        questionnaireTitle: currentConfig.questionnaireTemplate?.title ?? 'three-chapter-questionnaire-v1.1',
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
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
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
        <div className="mt-4 grid grid-cols-3 gap-4">
          {config.activeExperimentMode !== 'manual' ? (
            <div className="col-span-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              当前选择了实验模式，下面的工作段 AI 手动配置只在“手动 / 通用”模式下用于新 Session。
            </div>
          ) : null}
          {[0, 1, 2].map((index) => (
            <label key={index} className="text-sm text-[#4e5969]">
              工作段 {index + 1} AI
              <select value={config.segmentAiLevels[index] ?? 'BASIC'} onChange={(event) => setConfig((prev) => { if (!prev) return prev; const next = [...prev.segmentAiLevels]; next[index] = event.target.value; return { ...prev, segmentAiLevels: next }; })} className="mt-1 w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]">
                <option value="BASIC">BASIC</option>
                <option value="ADVANCED">ADVANCED</option>
              </select>
            </label>
          ))}
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

      <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
        <div className="mb-4 font-bold text-[#1d2129]">指导语积木</div>
        <div className="grid gap-4 lg:grid-cols-2">
          {([
            ['commonTitle', '通用标题'],
            ['commonBody', '通用说明'],
            ['roleA', '尽调员角色说明'],
            ['roleB', '投资经理角色说明'],
            ['manual', '手动/通用条件块'],
            ['ai_upgrade', '实验 1 条件块'],
            ['side_reminder', '实验 2 条件块'],
            ['coop_narrative', '实验 3 条件块'],
            ['aiUpgradeBreakNotice', 'AI 升级休息页提示'],
            ['aiUpgradeWorkspaceNotice', 'AI 升级工作台提示'],
          ] as Array<[keyof InstructionBlocks, string]>).map(([key, label]) => (
            <label key={key} className="text-sm text-[#4e5969]">
              {label}
              <textarea
                value={config.instructionBlocks[key] ?? ''}
                onChange={(event) => setConfig((prev) => prev ? { ...prev, instructionBlocks: { ...prev.instructionBlocks, [key]: event.target.value } } : prev)}
                rows={key === 'commonBody' ? 4 : 3}
                className="mt-1 w-full resize-y rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2 outline-none focus:border-[#1e80ff]"
              />
            </label>
          ))}
        </div>
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
        <div className="mb-2 text-lg font-bold text-[#1d2129]">三章实验正式问卷</div>
        <div className="grid gap-3 text-sm leading-7 text-[#4e5969] lg:grid-cols-3">
          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="font-semibold text-[#1d2129]">段后问卷</div>
            <div>工作段 1、2、3 结束后分别呈现同一套段后题目。</div>
          </div>
          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="font-semibold text-[#1d2129]">最后问卷</div>
            <div>共同模块 + 当前实验模式操纵检验 + 当前角色专属题共同组装。</div>
          </div>
          <div className="rounded-lg border border-[#e5e6eb] bg-[#fafafa] p-4">
            <div className="font-semibold text-[#1d2129]">不进入系统</div>
            <div>招募问卷不在本平台呈现；论文来源、链接和师兄 HTML 计时信息不写入数据库。</div>
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
  const [status, setStatus] = useState('');
  const [libraryRoot, setLibraryRoot] = useState('');
  const [libraryCases, setLibraryCases] = useState<LibraryCaseOverview[]>([]);

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
      setStatus('');
    } catch {
      setCompanies([]);
      setStatus('材料库加载失败');
    }
  }

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

  useEffect(() => {
    void loadCompanies();
    void loadLibraryOverview();
  }, []);

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

  return (
    <div className="grid min-h-[720px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-bold text-[#1d2129]">公司与材料库</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadCompanies()}
                className="rounded-lg border border-[#e5e6eb] p-2 text-[#4e5969] hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void importLibrary()}
                className="rounded-lg bg-[#1e80ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                自动导入题库目录
              </button>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-[#d9e7ff] bg-blue-50 px-3 py-3 text-xs leading-6 text-[#1e80ff]">
            <div className="font-semibold">当前导入口径</div>
            <div className="mt-1 break-all">{libraryRoot || '未检测到题库目录'}</div>
            <div className="mt-2 text-[#4e5969]">
              推荐目录为 `participant/shared`、`participant/diligence`、`participant/manager`、`research`。
              `shared` 两个角色都能看到；`diligence` 只发给尽调员；`manager` 只发给投资经理；`research` 只给研究者使用。
            </div>
          </div>
          {libraryCases.length > 0 ? (
            <div className="mb-4 space-y-2 rounded-lg border border-[#e5e6eb] bg-[#fafbfc] p-3">
              <div className="text-xs font-semibold text-[#4e5969]">本地题库扫描结果</div>
              {libraryCases.map((item) => (
                <div key={`${item.usage}-${item.folderName}-${item.caseCode}`} className="rounded-lg border border-[#eef0f3] bg-white px-3 py-2 text-xs text-[#4e5969]">
                  <div className="font-medium text-[#1d2129]">
                    {item.companyName} <span className="text-[#86909c]">({item.caseCode})</span>
                    <span className="ml-2 rounded bg-[#eef6ff] px-2 py-0.5 text-[11px] font-normal text-[#1e80ff]">
                      {item.usage === 'practice' ? '测试轮案例' : '正式案例'}
                    </span>
                  </div>
                  <div className="mt-1">
                    {item.folderName} / 共享 {item.sharedMaterialCount} / 尽调员 {item.diligenceMaterialCount} / 投资经理 {item.managerMaterialCount} / 研究者 {item.researchMaterialCount}
                  </div>
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
                  {company.roundLabel} / {company.sector} / {company.materials.length} 份已入库材料
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e6eb] bg-white p-5 shadow-sm">
          <div className="mb-3 font-bold text-[#1d2129]">使用说明</div>
          <div className="space-y-2 text-xs leading-6 text-[#4e5969]">
            <div>1. 材料目录在线下维护，不在后台逐个上传或编辑文件。</div>
            <div>2. 准备好案例文件夹后，在这里点击“自动导入题库目录”。</div>
            <div>3. 左侧选择公司，右侧只检查导入结果和预览效果。</div>
            <div>4. 研究者材料继续放在 `research/`，不会发给参与者。</div>
          </div>
          {status ? <div className="mt-3 text-xs text-[#86909c]">{status}</div> : null}
        </div>
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
        {activeTab === 'questionnaires' ? <QuestionnaireConfigTab /> : null}
        {activeTab === 'materials' ? <MaterialsLibraryTab /> : null}
        {activeTab === 'sidefeed' ? <AdminSidefeedPanel /> : null}
        {activeTab === 'ai-settings' ? <AdminAiSettingsPanel /> : null}
      </div>
    </main>
  );
}
