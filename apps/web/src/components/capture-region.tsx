'use client';

import { domToBlob } from 'modern-screenshot';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

export type CaptureRegionHandle = { startCapture: () => void };

type CaptureRect = { left: number; top: number; width: number; height: number };

function normalizeRect(startX: number, startY: number, currentX: number, currentY: number): CaptureRect {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function copyBlobToClipboard(blob: Blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持站内截图复制');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export const CaptureRegion = forwardRef<CaptureRegionHandle, { children: ReactNode; className?: string }>(
  function CaptureRegion({ children, className = '' }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
    const [captureMode, setCaptureMode] = useState(false);
    const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [toast, setToast] = useState('');

    useImperativeHandle(ref, () => ({
      startCapture() {
        setCaptureMode(true);
        setCaptureRect(null);
      },
    }));

    useEffect(() => {
      if (!captureMode) return;
      const cancel = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        setCaptureMode(false);
        setCaptureRect(null);
      };
      window.addEventListener('keydown', cancel);
      return () => window.removeEventListener('keydown', cancel);
    }, [captureMode]);

    useEffect(() => {
      if (!toast) return;
      const timer = window.setTimeout(() => setToast(''), 2400);
      return () => window.clearTimeout(timer);
    }, [toast]);

    function localPoint(clientX: number, clientY: number) {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds) return null;
      return {
        x: Math.min(Math.max(clientX - bounds.left, 0), bounds.width),
        y: Math.min(Math.max(clientY - bounds.top, 0), bounds.height),
      };
    }

    async function capture(rect: CaptureRect) {
      const root = rootRef.current;
      if (!root) return;
      setCapturing(true);
      try {
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const fullBlob = await withTimeout(domToBlob(root, {
          backgroundColor: '#ffffff',
          scale,
          filter: (node) => !(node instanceof HTMLElement && node.dataset.captureIgnore === 'true'),
        }), 20000, '截图渲染超时');
        if (!fullBlob) throw new Error('截图导出失败');
        const image = await createImageBitmap(fullBlob);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法创建截图画布');
        context.drawImage(
          image,
          Math.round(rect.left * scale),
          Math.round(rect.top * scale),
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const blob = await withTimeout(new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((value) => value ? resolve(value) : reject(new Error('截图裁切失败')), 'image/png');
        }), 8000, '截图导出超时');
        await withTimeout(copyBlobToClipboard(blob), 8000, '复制到剪贴板超时');
        setToast('截图已复制，可直接粘贴到 AI 输入框');
      } catch (error) {
        console.error('Capture region failed:', error);
        setToast(error instanceof Error ? error.message : '截图失败，请重试');
      } finally {
        setCapturing(false);
        setCaptureMode(false);
        setCaptureRect(null);
      }
    }

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      const point = localPoint(event.clientX, event.clientY);
      if (!point) return;
      pointerRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y };
      setCaptureRect({ left: point.x, top: point.y, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const start = pointerRef.current;
      const point = localPoint(event.clientX, event.clientY);
      if (!start || !point) return;
      setCaptureRect(normalizeRect(start.startX, start.startY, point.x, point.y));
    }

    async function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const start = pointerRef.current;
      const point = localPoint(event.clientX, event.clientY);
      pointerRef.current = null;
      if (!start || !point) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const rect = normalizeRect(start.startX, start.startY, point.x, point.y);
      if (rect.width < 12 || rect.height < 12) {
        setToast('请选择更大的截图区域');
        setCaptureMode(false);
        setCaptureRect(null);
        return;
      }
      await capture(rect);
    }

    return (
      <div ref={rootRef} className={`relative ${className}`}>
        {children}
        {captureMode ? (
          <div
            data-capture-ignore="true"
            className="absolute inset-0 z-[90] cursor-crosshair bg-slate-950/10"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => void onPointerUp(event)}
          >
            <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/95 px-3 py-2 text-xs text-[#4e5969] shadow-sm">
              拖拽框选截图，松开后自动复制，Esc 退出
            </div>
            {captureRect ? <div className="pointer-events-none absolute border-2 border-[#1e80ff] bg-[#1e80ff]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.18)]" style={{ left: captureRect.left, top: captureRect.top, width: captureRect.width, height: captureRect.height }} /> : null}
          </div>
        ) : null}
        {capturing ? <div data-capture-ignore="true" className="pointer-events-none absolute inset-0 z-[91] grid place-items-center bg-white/55"><div className="rounded-md bg-white px-4 py-2 text-sm text-[#4e5969] shadow-sm">正在处理截图...</div></div> : null}
        {toast ? <div data-capture-ignore="true" className="pointer-events-none absolute bottom-4 right-4 z-[92] rounded-md bg-slate-900/85 px-3 py-2 text-xs text-white shadow-sm">{toast}</div> : null}
      </div>
    );
  },
);
