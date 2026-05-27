import Link from 'next/link';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { BTaskEditor } from '@/components/b-task-editor';
import { MaterialTabs } from '@/components/material-tabs';
import { SideTaskStrip } from '@/components/sidetask-strip';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { mockBWorkspace, mockCompany } from '@/lib/mock-experiment-data';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function pickString(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
async function recordStage(code: string, role: 'A' | 'B', stage: string) {
  try {
    await fetch(`${serverBaseUrl}/experiment/session/${code}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, stage, payload: { source: 'web', page: 'preview-b' } }), cache: 'no-store' });
  } catch {}
}

export default async function PreviewBPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const role = pickString(searchParams.role)?.toUpperCase() === 'A' ? 'A' : 'B';
  const code = pickString(searchParams.code)?.toUpperCase() ?? '未提供';
  if (code !== '未提供') await recordStage(code, role, 'b_page_viewed');

  const sidebar = (
    <MaterialTabs items={[
      { key: 'summary', label: 'A 的尽调表', content: <div className="space-y-6"><div className="rounded-lg border border-[#e5e6eb] bg-white p-5"><div className="mb-4 flex items-center justify-between border-b pb-4"><h2 className="text-xl font-black text-gray-800">上游尽调员 (A) 预审尽调表</h2><span className="text-xs text-gray-400">最后更新: 10:02 AM</span></div><div className="mb-8 rounded-r-lg border-l-4 border-[#1e80ff] bg-blue-50 p-4"><p className="mb-2 font-bold text-[#1e80ff]">A 的核心交接备注：</p><p className="leading-relaxed text-gray-700">这家公司虽然营收增长极快，但海外收入的合规证明还不够扎实，建议重点审查第二季度法务与海外合规文件。</p></div><div className="space-y-6"><div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-5"><h3 className="mb-3 text-base font-bold text-gray-800">机会点初步梳理</h3><ul className="list-disc space-y-2 pl-5 text-gray-600"><li>制造业数字化需求真实存在，行业空间不低。</li><li>若标准化模块跑通，收入质量有改善空间。</li><li>重点客户场景刚需明确，项目落地价值较强。</li></ul></div><div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-5"><h3 className="mb-3 text-base font-bold text-gray-800">风险点初步梳理</h3><ul className="list-disc space-y-2 pl-5 text-gray-600"><li>客户集中与交付依赖仍是压顶问题。</li><li>毛利率波动较大，产品化能力仍需验证。</li></ul></div></div></div></div> },
      { key: 'materials', label: '原始材料', content: <div className="space-y-4">{mockCompany.rawMaterials.map((material) => <div key={material.title} className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-5"><div className="mb-3 text-base font-bold text-gray-800">{material.title}</div><ul className="list-disc space-y-2 pl-5 leading-relaxed text-gray-600">{material.points.map((point) => <li key={point}>{point}</li>)}</ul></div>)}</div> },
    ]} />
  );

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-[#1d2129] text-sm">
      <div className="flex h-full flex-col">
        <nav className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">角色: 投资经理</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">当前项目: {mockCompany.name}</div>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href={`/dev/preview/b-feedback?code=${code}&company=${encodeURIComponent(mockCompany.name)}&no=1`}
              className="rounded-md bg-[#28a745] px-5 py-1.5 font-bold text-white shadow-sm hover:bg-green-600"
            >
              提交
            </Link>
          </div>
        </nav>
        <SideTaskStrip
          sessionCode={code}
          role={role}
          sideTaskQueue={[]}
          sideTaskConfig={{
            dispatchMode: 'continuous',
            scrollDurationSec: 12,
            holdSec: 5,
            fadeSec: 2,
            pauseSec: 15,
            totalPlanned: 0,
            totalReleased: 0,
            totalAnswered: 0,
            totalArchived: 0,
            nextScheduledAt: null,
            pendingLabel: '待处理事宜',
            tickerMessage: '您有新事项入库，请尽快处理',
          }}
        />
        <div className="min-h-0 flex-1 p-2">
          <WorkbenchLayout
            sidebar={sidebar}
            sidebarTitle="参考材料"
            taskPane={<div className="no-scrollbar h-full overflow-y-auto p-5"><BTaskEditor sessionCode={code} initialData={mockBWorkspace} /></div>}
            aiPane={<AiChatPanel sessionCode={code} role={role} accent="purple" />}
            taskTitle="我的判定任务"
            aiTitle="AI 分析助手"
          />
        </div>
      </div>
    </main>
  );
}
