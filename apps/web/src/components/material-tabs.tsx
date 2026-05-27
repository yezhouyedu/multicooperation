'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type TabItem = {
  key: string;
  label: string;
  content: React.ReactNode;
  onSelect?: () => void;
};

export function MaterialTabs({
  items,
  activeKey,
  onActiveChange,
}: {
  items: TabItem[];
  activeKey?: string;
  onActiveChange?: (key: string) => void;
}) {
  const [internalActive, setInternalActive] = useState(items[0]?.key ?? '');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const active = activeKey ?? internalActive;
  const current = items.find((item) => item.key === active) ?? items[0];

  function activateTab(key: string) {
    if (activeKey === undefined) {
      setInternalActive(key);
    }
    onActiveChange?.(key);
  }

  function syncScrollState() {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  function scrollTabs(direction: 'left' | 'right') {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'right' ? 240 : -240, behavior: 'smooth' });
  }

  useEffect(() => {
    syncScrollState();
    const el = tabsRef.current;
    if (!el) return;
    const handle = () => syncScrollState();
    el.addEventListener('scroll', handle);
    window.addEventListener('resize', handle);
    return () => {
      el.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
    };
  }, [items.length]);

  useEffect(() => {
    if (!items.some((item) => item.key === active)) {
      activateTab(items[0]?.key ?? '');
    }
  }, [active, items]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e6eb] bg-gray-50 px-2 py-2">
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          disabled={!canScrollLeft}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5e6eb] bg-white text-sm text-[#4e5969] transition hover:border-blue-200 hover:text-[#1e80ff] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="向左滚动材料标签"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={tabsRef} className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {items.map((item) => {
            const selected = item.key === current?.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  activateTab(item.key);
                  item.onSelect?.();
                }}
                className={`h-11 flex-none whitespace-nowrap rounded-lg px-4 text-sm transition ${
                  selected
                    ? 'border border-blue-200 bg-blue-50 font-semibold text-blue-600'
                    : 'border border-transparent text-slate-500 hover:border-[#e5e6eb] hover:bg-white hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          disabled={!canScrollRight}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5e6eb] bg-white text-sm text-[#4e5969] transition hover:border-blue-200 hover:text-[#1e80ff] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="向右滚动材料标签"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white p-4">{current?.content}</div>
    </div>
  );
}
