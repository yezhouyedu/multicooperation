'use client';

import { useScopedZoom } from '@/lib/use-scoped-zoom';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
};

export function ScopedZoomSurface({
  children,
  className = '',
  contentClassName = '',
  defaultZoom = 1,
  minZoom = 0.82,
  maxZoom = 1.4,
  step = 0.06,
}: Props) {
  const { scopeRef, zoom } = useScopedZoom({
    defaultZoom,
    minZoom,
    maxZoom,
    step,
  });

  return (
    <div ref={scopeRef} className={className}>
      <div
        className={contentClassName}
        style={{
          zoom,
          width: `${100 / zoom}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
