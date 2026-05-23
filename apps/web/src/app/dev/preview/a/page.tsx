import { AFeedbackNotification } from '@/components/a-feedback-notification';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { ATaskEditor } from '@/components/a-task-editor';
import { MaterialTabs } from '@/components/material-tabs';
import { SideTaskStrip } from '@/components/sidetask-strip';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { mockAForm, mockCompany, mockSideFeedItems } from '@/lib/mock-experiment-data';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function pickString(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
async function recordStage(code: string, role: 'A' | 'B', stage: string) {
  try {
    await fetch(`${serverBaseUrl}/experiment/session/${code}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, stage, payload: { source: 'web', page: 'preview-a' } }), cache: 'no-store' });
  } catch {}
}

export default async function PreviewAPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const role = pickString(searchParams.role)?.toUpperCase() === 'B' ? 'B' : 'A';
  const code = pickString(searchParams.code)?.toUpperCase() ?? '未提供';
  if (code !== '未提供') await recordStage(code, role, 'a_page_viewed');

  const sidebar = (
    <MaterialTabs items={[
      { key: 'raw', label: '原始材料', content: <div className="space-y-4">{mockCompany.rawMaterials.map((material) => <div key={material.title} className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-5"><div className="mb-3 text-base font-bold text-gray-800">{material.title}</div><ul className="list-disc space-y-2 pl-5 leading-relaxed text-gray-600">{material.points.map((point) => <li key={point}>{point}</li>)}</ul></div>)}</div> },
      { key: 'company', label: '公司信息', content: <div className="space-y-4 text-gray-700"><div className="rounded-lg border border-[#e5e6eb] bg-white p-5"><div className="text-xl font-black">{mockCompany.name}</div><div className="mt-3 space-y-2"><div>赛道：{mockCompany.sector}</div><div>轮次：{mockCompany.round}</div></div><div className="mt-4 flex flex-wrap gap-2">{mockCompany.tags.map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{tag}</span>)}</div></div><div className="rounded-lg border border-[#e5e6eb] bg-white p-5 leading-loose">{mockCompany.summary}</div></div> },
    ]} />
  );

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-[#1d2129] text-sm">
      <div className="flex h-full flex-col">
        <nav className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">角色: 上游尽调员</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">当前项目: {mockCompany.name}</div>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-md bg-[#28a745] px-5 py-1.5 font-bold text-white shadow-sm hover:bg-green-600">提交</button>
          </div>
        </nav>
        <SideTaskStrip sessionCode={code} role={role} items={mockSideFeedItems} />
        <div className="min-h-0 flex-1 p-2">
          <WorkbenchLayout
            sidebar={sidebar}
            sidebarTitle="参考材料"
            taskPane={<div className="no-scrollbar h-full overflow-y-auto p-5"><ATaskEditor sessionCode={code} initialData={mockAForm} /></div>}
            aiPane={<AiChatPanel sessionCode={code} role={role} accent="blue" />}
            taskTitle="我的尽调任务"
            aiTitle="AI 分析助手"
          />
        </div>
      </div>
      <AFeedbackNotification sessionCode={code} />
    </main>
  );
}
