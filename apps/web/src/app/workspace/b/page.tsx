'use client';

import { AiChatPanel } from '@/components/ai-chat-panel';
import { BTaskEditor } from '@/components/b-task-editor';
import { CompanyMaterialPanel, type CompanyMaterialPanelHandle } from '@/components/company-material-panel';
import { ScopedZoomSurface } from '@/components/scoped-zoom-surface';
import { SessionTopbar } from '@/components/session-topbar';
import { SideTaskStrip } from '@/components/sidetask-strip';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { useSessionRuntime, useTaskDraft } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type NormalizedADraft = {
  metrics: Record<string, string>;
  materialClues: {
    materialName: string;
    opportunityStatus: '' | 'HAS' | 'NONE';
    opportunityEvidence: string;
    riskStatus: '' | 'HAS' | 'NONE';
    riskEvidence: string;
  }[];
  noteTypes: string[];
  handoffMemo: string;
};

function normalizeADraft(payload: unknown): NormalizedADraft {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const metrics = (data.metrics && typeof data.metrics === 'object' ? data.metrics : {}) as Record<string, string>;
  const materialClues = Array.isArray(data.materialClues)
    ? data.materialClues.map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          materialName: String(row.materialName ?? '未命名材料'),
          opportunityStatus: (row.opportunityStatus === 'HAS' || row.opportunityStatus === 'NONE' ? row.opportunityStatus : '') as '' | 'HAS' | 'NONE',
          opportunityEvidence: String(row.opportunityEvidence ?? ''),
          riskStatus: (row.riskStatus === 'HAS' || row.riskStatus === 'NONE' ? row.riskStatus : '') as '' | 'HAS' | 'NONE',
          riskEvidence: String(row.riskEvidence ?? ''),
        };
      })
    : [];

  return {
    metrics: {
      latestRevenue: metrics.latestRevenue ?? '',
      latestGrossMargin: metrics.latestGrossMargin ?? '',
      latestNetProfit: metrics.latestNetProfit ?? '',
      latestTotalAssets: metrics.latestTotalAssets ?? '',
      latestTotalLiabilities: metrics.latestTotalLiabilities ?? '',
      latestOperatingCashflow: metrics.latestOperatingCashflow ?? '',
    },
    materialClues,
    noteTypes: Array.isArray(data.noteTypes) ? data.noteTypes.map(String) : [],
    handoffMemo: String(data.handoffMemo ?? ''),
  };
}

const metricLabels: { key: keyof NormalizedADraft['metrics']; label: string }[] = [
  { key: 'latestRevenue', label: '营业收入' },
  { key: 'latestGrossMargin', label: '毛利率' },
  { key: 'latestNetProfit', label: '净利润' },
  { key: 'latestTotalAssets', label: '总资产' },
  { key: 'latestTotalLiabilities', label: '总负债' },
  { key: 'latestOperatingCashflow', label: '经营现金流' },
];

export default function WorkspaceBPage() {
  const router = useRouter();
  const materialPanelRef = useRef<CompanyMaterialPanelHandle>(null);
  const { bootstrap, runtime, loading, countdownLabel, refresh } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft: diligenceDraftPayload } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'A', 'main');
  const { draft: taskDraft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'B', 'main');
  const [activeSidebarKey, setActiveSidebarKey] = useState('overview');

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'A'
        ? '/workspace/a'
        : !loading && runtime?.phase === 'practice_ready'
          ? runtime.syncState?.selfReady
            ? '/ready?target=practice'
            : null
          : !loading && runtime?.phase === 'practice'
            ? '/practice'
            : !loading && runtime?.phase === 'formal_ready'
              ? runtime.syncState?.selfReady
                ? '/ready?target=formal'
                : null
              : !loading && runtime?.phase === 'formal_break'
                ? '/break'
                : !loading && runtime?.phase === 'end'
                  ? '/workspace/end'
                  : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  useEffect(() => {
    setActiveSidebarKey('overview');
  }, [currentTaskId]);

  if (redirectPath) return null;

  async function openDiligenceInfo() {
    if (!bootstrap || !runtime?.currentTask || !runtime.aInfoUnlocked) return;
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/tasks/${runtime.currentTask.id}/view-a-info`, {
      method: 'POST',
    });
    setActiveSidebarKey('diligence-info');
    await refresh();
  }

  const company = runtime?.currentTask?.company;
  const diligenceDraft = useMemo(() => normalizeADraft(diligenceDraftPayload), [diligenceDraftPayload]);
  const highlightedClues = useMemo(
    () => diligenceDraft.materialClues.filter((row) => row.opportunityStatus === 'HAS' || row.riskStatus === 'HAS'),
    [diligenceDraft.materialClues],
  );

  const diligenceTabContent = !runtime?.aInfoUnlocked ? (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c9cdd4] bg-gray-50 p-6 text-center text-sm text-[#86909c]">
      <div className="mb-2 text-base font-bold text-[#1d2129]">尽调员信息尚未解锁</div>
      <div>你可以先阅读自有材料、填写投资判断并使用 AI。尽调员信息解锁后，这里会显示对应内容。</div>
    </div>
  ) : !runtime.bHasViewedAInfo ? (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[#bfd8ff] bg-[#f7fbff] p-6 text-center text-sm text-[#4e5969]">
      <div className="mb-2 text-base font-bold text-[#1d2129]">尽调员信息已送达</div>
      <div className="mb-5 max-w-md leading-7">
        你现在可以查看尽调员提交的交接信息。点击下方按钮后，系统会记录本次查看行为，并展示具体内容。
      </div>
      <button
        type="button"
        onClick={() => void openDiligenceInfo()}
        className="rounded-lg bg-[#1e80ff] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
      >
        查看尽调员信息
      </button>
    </div>
  ) : (
    <div className="space-y-4 text-xs leading-6 text-[#4e5969]">
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">基础数值摘录</div>
        <div className="grid gap-x-4 gap-y-1 md:grid-cols-2">
          {metricLabels.map((metric) => (
            <div key={metric.key}>
              <span className="text-[#86909c]">{metric.label}：</span>
              <span>{diligenceDraft.metrics[metric.key] || '未填写'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">材料线索</div>
        {highlightedClues.length > 0 ? (
          <div className="space-y-2">
            {highlightedClues.map((row) => (
              <div key={row.materialName} className="rounded-md bg-white px-3 py-2">
                <div className="font-medium text-[#1d2129]">{row.materialName}</div>
                <div>
                  机会：
                  {row.opportunityStatus === 'HAS'
                    ? row.opportunityEvidence || '已标记但未填写证据'
                    : row.opportunityStatus === 'NONE'
                      ? '未发现'
                      : '未作答'}
                </div>
                <div>
                  风险：
                  {row.riskStatus === 'HAS'
                    ? row.riskEvidence || '已标记但未填写证据'
                    : row.riskStatus === 'NONE'
                      ? '未发现'
                      : '未作答'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>暂无已标记的机会或风险线索。</div>
        )}
      </div>
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">交接备注</div>
        <div>备注类型：{diligenceDraft.noteTypes.length > 0 ? diligenceDraft.noteTypes.join('、') : '未选择'}</div>
        <div className="mt-1 whitespace-pre-wrap">{diligenceDraft.handoffMemo || '暂无交接备注'}</div>
      </div>
    </div>
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f0f2f5] text-sm text-[#1d2129]">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SessionTopbar
          roleLabel="投资经理"
          currentLabel={company?.name ?? '当前项目'}
          stageLabel="当前阶段剩余时间"
          countdownLabel={countdownLabel}
        />
        {bootstrap && runtime ? (
          <SideTaskStrip
            sessionCode={bootstrap.sessionCode}
            participantId={bootstrap.participantId}
            role="B"
            phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
            segmentIndex={runtime.segmentIndex}
            aiLevel={runtime.aiLevel}
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden p-2">
          {!company || !runtime?.currentTask ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-[#e5e6eb] bg-white text-sm text-[#86909c] shadow-sm">
              <div className="mb-2 text-base font-bold text-[#1d2129]">当前没有待处理项目</div>
              <div>你仍然可以处理副线事项。</div>
            </div>
          ) : (
            <WorkbenchLayout
              key={runtime.currentTask.id}
              sidebar={
                <CompanyMaterialPanel
                  ref={materialPanelRef}
                  company={company}
                  activeItemKey={activeSidebarKey}
                  onActiveItemChange={setActiveSidebarKey}
                  prependItems={[
                    {
                      key: 'diligence-info',
                      label: '尽调员信息',
                      content: diligenceTabContent,
                    },
                  ]}
                />
              }
              sidebarTitle="参考材料"
              onSidebarCapture={() => materialPanelRef.current?.startCapture()}
              taskPane={
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e5e6eb] px-5 py-3 text-xs text-[#86909c]">
                    <div className="flex flex-col gap-1">
                      <span>尽调员信息解锁后即可提交。你可以先阅读材料并填写投资判断。</span>
                      {runtime.aInfoUnlocked ? (
                        <span>
                          尽调员信息状态：{runtime.bHasViewedAInfo ? '已查看并记录' : '已解锁，尚未记录查看'}
                        </span>
                      ) : (
                        <span>尽调员信息状态：等待解锁</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/workspace/b-feedback')}
                      disabled={!runtime.bCanSubmit}
                      title={!runtime.aInfoUnlocked ? '等待尽调员信息解锁后才能提交' : undefined}
                      className="shrink-0 rounded-md bg-[#28a745] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      提交并填写反馈
                    </button>
                  </div>
                  <ScopedZoomSurface className="no-scrollbar min-h-0 flex-1 overflow-y-auto" contentClassName="min-h-full">
                    {bootstrap ? (
                      <BTaskEditor
                        sessionCode={bootstrap.sessionCode}
                        taskId={runtime.currentTask.id}
                        initialData={taskDraft}
                        company={company}
                        disabled={runtime.isFrozen}
                      />
                    ) : null}
                  </ScopedZoomSurface>
                </div>
              }
              aiPane={
                bootstrap ? (
                  <ScopedZoomSurface className="h-full overflow-hidden" contentClassName="h-full">
                    <AiChatPanel
                      sessionCode={bootstrap.sessionCode}
                      participantId={bootstrap.participantId}
                      role="B"
                      accent="purple"
                      contextType="main"
                      companyId={company.id}
                      phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
                      segmentIndex={runtime.segmentIndex}
                      aiLevel={runtime.aiLevel}
                    />
                  </ScopedZoomSurface>
                ) : (
                  <div />
                )
              }
              taskTitle="投资判断表"
              aiTitle="主线 AI"
            />
          )}
        </div>
      </div>
    </main>
  );
}
