'use client';

import { MaterialTabs } from '@/components/material-tabs';
import { useScopedZoom } from '@/lib/use-scoped-zoom';
import type { CompanyData, MaterialItem } from '@/lib/session-runtime';
import { FileSpreadsheet, FileText, Loader2, SearchX, ZoomIn, ZoomOut } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { domToBlob } from 'modern-screenshot';
import dynamic from 'next/dynamic';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as XLSX from 'xlsx';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false });
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false });

type PrependItem = {
  key: string;
  label: string;
  content: React.ReactNode;
  onSelect?: () => void;
};

export type CompanyMaterialPanelHandle = {
  startCapture: () => void;
};

type ViewerShellProps = {
  title: string;
  children: React.ReactNode;
  baseWidth?: number;
};

type CaptureRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SpreadsheetState = {
  headers: string[];
  rows: string[][];
  sheetName: string;
};

function resolveMaterialUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${serverBaseUrl}${normalizedPath}`;
}

async function copyBlobToClipboard(blob: Blob) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'clipboard';
  }

  const url = URL.createObjectURL(blob);
  const host = document.createElement('div');
  host.contentEditable = 'true';
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.opacity = '0';

  const image = document.createElement('img');
  image.src = url;
  host.appendChild(image);
  document.body.appendChild(host);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => {
        const range = document.createRange();
        range.selectNode(image);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        const copied = document.execCommand('copy');
        selection?.removeAllRanges();
        if (copied) resolve();
        else reject(new Error('legacy copy failed'));
      };
      image.onerror = () => reject(new Error('image load failed'));
    });
    return 'legacy-copy';
  } finally {
    document.body.removeChild(host);
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function clampZoom(value: number) {
  return Math.min(2.4, Math.max(0.5, Number(value.toFixed(2))));
}

function normalizeRect(startX: number, startY: number, currentX: number, currentY: number): CaptureRect {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  return {
    left,
    top,
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

function useViewerZoom(baseWidth: number) {
  const defaultManualZoom = 1.18;
  const { scopeRef: viewportRef, zoom: manualZoom, zoomIn, zoomOut, resetZoom } = useScopedZoom({
    defaultZoom: defaultManualZoom,
    minZoom: 0.5,
    maxZoom: 2.4,
    step: 0.1,
  });
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateFit = () => {
      const padding = 48;
      const availableWidth = Math.max(320, viewport.clientWidth - padding);
      setFitScale(Math.max(0.45, Number((availableWidth / baseWidth).toFixed(3))));
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(viewport);
    window.addEventListener('resize', updateFit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFit);
    };
  }, [baseWidth, viewportRef]);

  const effectiveZoom = clampZoom(fitScale * manualZoom);
  return {
    viewportRef,
    manualZoom,
    effectiveZoom,
    zoomPercent: Math.round(effectiveZoom * 100),
    zoomIn,
    zoomOut,
    resetZoom,
  };
}

function ViewerShell({ title, children, baseWidth = 760 }: ViewerShellProps) {
  const { viewportRef, effectiveZoom, zoomPercent, zoomIn, zoomOut, resetZoom } = useViewerZoom(baseWidth);

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border border-[#e5e6eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e6eb] px-4 py-3 text-sm text-[#4e5969]">
        <div className="truncate">{title}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d0d7e2] text-[#4e5969] hover:bg-gray-50"
            title="缩小（Ctrl -）"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-[#d0d7e2] px-2.5 py-1 text-xs text-[#4e5969] hover:bg-gray-50"
            title="恢复适配（Ctrl 0）"
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d0d7e2] text-[#4e5969] hover:bg-gray-50"
            title="放大（Ctrl +）"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-6">
        <div
          className="mx-auto origin-top"
          style={{
            width: `${baseWidth}px`,
            zoom: effectiveZoom,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d0d7e2] bg-[#fafbfd] px-6 text-center">
      <SearchX className="mb-3 h-8 w-8 text-[#86909c]" />
      <div className="text-sm text-[#86909c]">{message}</div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#e5e6eb] bg-white text-sm text-[#86909c]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function TextMaterialViewer({ material }: { material: MaterialItem }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const materialUrl = useMemo(() => resolveMaterialUrl(material.url), [material.url]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(materialUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('材料读取失败');
        const text = await response.text();
        if (!cancelled) setContent(text);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '材料读取失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [materialUrl]);

  if (loading) return <LoadingState label="正在加载文本材料..." />;
  if (error) return <EmptyState message={error} />;

  return (
    <ViewerShell title={material.sourceFilename} baseWidth={700}>
      <div className="rounded-xl border border-[#e5e6eb] bg-white px-6 py-5 shadow-sm">
        <div className="whitespace-pre-wrap text-base leading-8 text-[#334155]">{content}</div>
      </div>
    </ViewerShell>
  );
}

function DocxMaterialViewer({ material }: { material: MaterialItem }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const materialUrl = useMemo(() => resolveMaterialUrl(material.url), [material.url]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(materialUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Word 材料读取失败');
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const host = hostRef.current;
        if (!host) throw new Error('Word 渲染容器尚未就绪');
        host.innerHTML = '';
        await renderAsync(buffer, host, undefined, {
          className: 'docx-viewer',
          inWrapper: false,
          breakPages: true,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Word 材料渲染失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [materialUrl]);

  if (error) return <EmptyState message={error} />;

  return (
    <ViewerShell title={material.sourceFilename} baseWidth={760}>
      <style jsx global>{`
        .docx-viewer {
          color: #334155;
          font-size: 16px;
          line-height: 1.9;
          background: #ffffff;
          border: 1px solid #e5e6eb;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
          padding: 24px;
        }
        .docx-viewer table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }
        .docx-viewer td,
        .docx-viewer th {
          border: 1px solid #dce3ec;
          padding: 8px 10px;
          vertical-align: top;
        }
        .docx-viewer img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      <div className="relative min-h-[320px]">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/92 text-sm text-[#86909c]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在渲染 Word 材料...
          </div>
        ) : null}
        <div ref={hostRef} className={loading ? 'opacity-0' : 'opacity-100'} />
      </div>
    </ViewerShell>
  );
}

function LazyPdfPage({ pageNumber, width }: { pageNumber: number; width: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex justify-center">
      {isVisible ? (
        <PdfPage pageNumber={pageNumber} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
      ) : (
        <div style={{ width, height: width * 1.414 }} className="animate-pulse rounded bg-gray-100" />
      )}
    </div>
  );
}

function PdfMaterialViewer({ material }: { material: MaterialItem }) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [currentInView, setCurrentInView] = useState(1);
  const materialUrl = useMemo(() => resolveMaterialUrl(material.url), [material.url]);
  const { viewportRef, manualZoom, zoomIn, zoomOut, resetZoom } = useViewerZoom(860);

  useEffect(() => {
    void import('react-pdf').then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => {
      setPageWidth(Math.max(420, Math.floor((viewport.clientWidth - 16) * manualZoom)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [manualZoom, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || numPages === 0) return;

    function onScroll() {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;
      const pages = currentViewport.querySelectorAll('[data-pdf-page]');
      const viewCenter = currentViewport.scrollTop + currentViewport.clientHeight / 2;
      let closest = 1;
      let minDistance = Infinity;

      pages.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const viewportRect = currentViewport.getBoundingClientRect();
        const elCenter = rect.top - viewportRect.top + rect.height / 2 + currentViewport.scrollTop;
        const distance = Math.abs(elCenter - viewCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closest = Number((el as HTMLElement).dataset.pdfPage);
        }
      });

      setCurrentInView(closest);
    }

    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [numPages, viewportRef]);

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border border-[#e5e6eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e6eb] px-4 py-3 text-sm text-[#4e5969]">
        <div className="truncate">{material.sourceFilename}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#86909c]">{numPages > 0 ? `第 ${currentInView} / ${numPages} 页` : ''}</span>
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d0d7e2] text-[#4e5969] hover:bg-gray-50"
            title="缩小（Ctrl -）"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-[#d0d7e2] px-2.5 py-1 text-xs text-[#4e5969] hover:bg-gray-50"
            title="恢复适配（Ctrl 0）"
          >
            {Math.round(manualZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d0d7e2] text-[#4e5969] hover:bg-gray-50"
            title="放大（Ctrl +）"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={viewportRef} className="no-scrollbar min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-6">
        <PdfDocument
          file={materialUrl}
          loading={<LoadingState label="正在加载 PDF 材料..." />}
          onLoadSuccess={({ numPages: nextPages }) => setNumPages(nextPages)}
          error={<EmptyState message="PDF 加载失败" />}
        >
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: numPages }, (_, index) => (
              <div key={`page-${index + 1}`} data-pdf-page={index + 1} className="rounded-xl bg-white p-2 shadow-sm">
                <LazyPdfPage pageNumber={index + 1} width={pageWidth || 920} />
              </div>
            ))}
          </div>
        </PdfDocument>
      </div>
    </div>
  );
}

function SpreadsheetMaterialViewer({ material }: { material: MaterialItem }) {
  const [state, setState] = useState<SpreadsheetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const materialUrl = useMemo(() => resolveMaterialUrl(material.url), [material.url]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(materialUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('表格材料读取失败');
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          raw: false,
        });
        const rows = data.map((row) => row.map((cell) => String(cell ?? '')));
        if (!cancelled) {
          setState({
            headers: rows[0] ?? [],
            rows: rows.slice(1),
            sheetName,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '表格材料读取失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [materialUrl]);

  if (loading) return <LoadingState label="正在加载表格材料..." />;
  if (error) return <EmptyState message={error} />;
  if (!state) return <EmptyState message="未解析到表格内容" />;

  return (
    <ViewerShell title={`工作表：${state.sheetName}`} baseWidth={980}>
      <div className="rounded-xl border border-[#e5e6eb] bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[#f8fafc]">
              <tr>
                {state.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="border-b border-r border-[#e5e6eb] px-3 py-2 text-left font-medium text-[#334155]"
                  >
                    {header || `列 ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-[#fbfdff]">
                  {state.headers.map((_, columnIndex) => (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className="border-b border-r border-[#eef2f7] px-3 py-2 align-top text-[#4e5969]"
                    >
                      {row[columnIndex] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ViewerShell>
  );
}

function MaterialContent({ material }: { material: MaterialItem }) {
  if (material.parseStatus === 'error') {
    return <EmptyState message={material.parseError || '材料解析失败'} />;
  }

  if (material.kind === 'txt') return <TextMaterialViewer material={material} />;
  if (material.kind === 'docx') return <DocxMaterialViewer material={material} />;
  if (material.kind === 'pdf') return <PdfMaterialViewer material={material} />;
  return <SpreadsheetMaterialViewer material={material} />;
}

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5e6eb] bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-[#86909c]">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-[#1d2129]">{value}</div>
    </div>
  );
}

function CompanyOverview({ company }: { company: CompanyData }) {
  const facts = company.researchProfile?.aFacts ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#d9e7ff] bg-blue-50 p-4">
        <div className="mb-1 text-base font-bold text-[#1e80ff]">{company.name}</div>
        <div className="text-xs text-[#86909c]">
          {company.roundLabel} / {company.sector}
        </div>
        <div className="mt-3 text-sm leading-7 text-[#4e5969]">
          {company.researchProfile?.businessSummary || company.summary}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <OverviewCard icon={<FileText className="h-4 w-4" />} label="公司编号" value={company.researchProfile?.companyCode || company.roundLabel} />
        <OverviewCard icon={<FileText className="h-4 w-4" />} label="公司简称/匿名代号" value={company.researchProfile?.alias || company.name} />
        <OverviewCard icon={<FileText className="h-4 w-4" />} label="行业" value={company.researchProfile?.industry || company.sector} />
        <OverviewCard icon={<FileSpreadsheet className="h-4 w-4" />} label="材料数量" value={`${company.materials.length} 份`} />
      </div>

      {facts.length > 0 ? (
        <div className="rounded-xl border border-[#e5e6eb] bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-[#1d2129]">自动填充参考信息</div>
          <div className="space-y-2 text-sm text-[#4e5969]">
            {facts.slice(0, 8).map((fact) => (
              <div key={`${fact.index}-${fact.label}`} className="rounded-lg bg-[#f8fafc] px-3 py-2">
                <span className="font-medium text-[#1d2129]">{fact.label}：</span>
                <span>{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {company.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[#d9e7ff] bg-white px-3 py-1 text-xs text-[#1e80ff]">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export const CompanyMaterialPanel = forwardRef<
  CompanyMaterialPanelHandle,
  {
    company: CompanyData;
    prependItems?: PrependItem[];
    activeItemKey?: string;
    onActiveItemChange?: (key: string) => void;
  }
>(
  function CompanyMaterialPanel({ company, prependItems = [], activeItemKey, onActiveItemChange }, ref) {
    const captureRootRef = useRef<HTMLDivElement>(null);
    const captureSessionRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
    const [captureMode, setCaptureMode] = useState(false);
    const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null);
    const [toast, setToast] = useState('');
    const [capturing, setCapturing] = useState(false);

    useEffect(() => {
      if (!toast) return;
      const timer = window.setTimeout(() => setToast(''), 2200);
      return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
      if (!captureMode) return;

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setCaptureMode(false);
          setCaptureRect(null);
        }
      }

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [captureMode]);

    function startCapture() {
      setCaptureMode(true);
      setCaptureRect(null);
    }

    useImperativeHandle(ref, () => ({
      startCapture,
    }));

    function toLocalPoint(clientX: number, clientY: number) {
      const root = captureRootRef.current;
      const bounds = root?.getBoundingClientRect();
      if (!bounds) return null;
      return {
        x: Math.min(Math.max(clientX - bounds.left, 0), bounds.width),
        y: Math.min(Math.max(clientY - bounds.top, 0), bounds.height),
      };
    }

    async function copySelection(rect: CaptureRect) {
      const root = captureRootRef.current;
      if (!root) return;

      setCapturing(true);
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fullBlob = await withTimeout(
          domToBlob(root, {
            backgroundColor: '#ffffff',
            scale: dpr,
            filter: (node) => {
              if (node instanceof HTMLElement && node.dataset.captureIgnore === 'true') return false;
              return true;
            },
          }),
          20000,
          '截图渲染超时',
        );

        if (!fullBlob) throw new Error('截图导出失败');

        const rootRect = root.getBoundingClientRect();
        const img = await createImageBitmap(fullBlob);
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.max(1, Math.round(rect.width * dpr));
        cropCanvas.height = Math.max(1, Math.round(rect.height * dpr));
        const context = cropCanvas.getContext('2d');
        if (!context) throw new Error('无法创建截图画布');

        context.drawImage(
          img,
          Math.round(rect.left * dpr),
          Math.round(rect.top * dpr),
          cropCanvas.width,
          cropCanvas.height,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );

        const blob = await withTimeout(
          new Promise<Blob>((resolve, reject) => {
            cropCanvas.toBlob((nextBlob) => {
              if (nextBlob) resolve(nextBlob);
              else reject(new Error('截图裁切导出失败'));
            }, 'image/png');
          }),
          8000,
          '截图导出超时',
        );

        try {
          const result = await withTimeout(copyBlobToClipboard(blob), 8000, '复制到剪贴板超时');
          setToast(result === 'clipboard' ? '已复制到剪贴板' : '已复制截图（兼容模式）');
        } catch (copyError) {
          console.error('Material capture copy failed:', copyError);
          downloadBlob(blob, `material-capture-${Date.now()}.png`);
          setToast('浏览器限制了直接复制，已改为下载 PNG');
        }
      } catch (error) {
        console.error('Material capture failed:', error);
        setToast('截图失败，请重试');
      } finally {
        setCapturing(false);
        setCaptureMode(false);
        setCaptureRect(null);
      }
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      const point = toLocalPoint(event.clientX, event.clientY);
      if (!point) return;
      captureSessionRef.current = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
      };
      setCaptureRect({ left: point.x, top: point.y, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const session = captureSessionRef.current;
      if (!session) return;
      const point = toLocalPoint(event.clientX, event.clientY);
      if (!point) return;
      setCaptureRect(normalizeRect(session.startX, session.startY, point.x, point.y));
    }

    async function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const session = captureSessionRef.current;
      if (!session) return;
      const point = toLocalPoint(event.clientX, event.clientY);
      captureSessionRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!point) {
        setCaptureRect(null);
        setCaptureMode(false);
        return;
      }
      const rect = normalizeRect(session.startX, session.startY, point.x, point.y);
      if (rect.width < 12 || rect.height < 12) {
        setCaptureRect(null);
        setCaptureMode(false);
        setToast('请选择更大的截图区域');
        return;
      }
      setCaptureRect(rect);
      await copySelection(rect);
    }

    const items = useMemo(
      () => [
        {
          key: 'overview',
          label: '公司概览',
          content: <CompanyOverview company={company} />,
        },
        ...prependItems,
        ...(company.materials ?? []).map((material) => ({
          key: material.id,
          label: material.displayName,
          content: <MaterialContent material={material} />,
        })),
      ],
      [company, prependItems],
    );

    return (
      <div ref={captureRootRef} className="relative h-full">
        <MaterialTabs items={items} activeKey={activeItemKey} onActiveChange={onActiveItemChange} />
        {captureMode ? (
          <div
            data-capture-ignore="true"
            className="absolute inset-0 z-20 cursor-crosshair bg-slate-950/10"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => void handlePointerUp(event)}
          >
            <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/92 px-3 py-2 text-xs text-[#4e5969] shadow-sm">
              拖拽框选截图，松开后自动复制，Esc 退出
            </div>
            {captureRect ? (
              <div
                className="pointer-events-none absolute border-2 border-[#1e80ff] bg-[#1e80ff]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.18)]"
                style={{
                  left: captureRect.left,
                  top: captureRect.top,
                  width: captureRect.width,
                  height: captureRect.height,
                }}
              />
            ) : null}
          </div>
        ) : null}
        {capturing ? (
          <div data-capture-ignore="true" className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/55">
            <div className="rounded-md bg-white px-4 py-2 text-sm text-[#4e5969] shadow-sm">正在处理截图...</div>
          </div>
        ) : null}
        {toast ? (
          <div data-capture-ignore="true" className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-md bg-slate-900/78 px-3 py-2 text-xs text-white shadow-sm">
            {toast}
          </div>
        ) : null}
      </div>
    );
  },
);
