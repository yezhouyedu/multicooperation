'use client';

import { useEffect, useRef, useState } from 'react';

type Options = {
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

export function useScopedZoom(options: Options = {}) {
  const {
    defaultZoom = 1,
    minZoom = 0.7,
    maxZoom = 1.8,
    step = 0.08,
  } = options;

  const scopeRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(defaultZoom);
  const [isActive, setIsActive] = useState(false);
  const pointerInsideRef = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    function activate() {
      pointerInsideRef.current = true;
      setIsActive(true);
    }

    function onPointerLeave() {
      pointerInsideRef.current = false;
      setIsActive(false);
    }

    scope.addEventListener('pointerenter', activate);
    scope.addEventListener('pointerleave', onPointerLeave);

    return () => {
      scope.removeEventListener('pointerenter', activate);
      scope.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  useEffect(() => {
    function applyDelta(delta: number) {
      setZoom((value) => clamp(value + delta, minZoom, maxZoom));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!activeRef.current || !pointerInsideRef.current || !(event.ctrlKey || event.metaKey)) return;

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        applyDelta(step);
      } else if (event.key === '-') {
        event.preventDefault();
        applyDelta(-step);
      } else if (event.key === '0') {
        event.preventDefault();
        setZoom(defaultZoom);
      }
    }

    function onWheel(event: WheelEvent) {
      if (!activeRef.current || !pointerInsideRef.current || !(event.ctrlKey || event.metaKey)) return;
      const scope = scopeRef.current;
      if (!scope || !scope.contains(event.target as Node)) return;
      event.preventDefault();
      applyDelta(event.deltaY < 0 ? step : -step);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, [defaultZoom, maxZoom, minZoom, step]);

  return {
    scopeRef,
    zoom,
    isActive,
    zoomPercent: Math.round(zoom * 100),
    zoomIn: () => setZoom((value) => clamp(value + step, minZoom, maxZoom)),
    zoomOut: () => setZoom((value) => clamp(value - step, minZoom, maxZoom)),
    resetZoom: () => setZoom(defaultZoom),
  };
}
