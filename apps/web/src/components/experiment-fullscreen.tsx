'use client';

import { useEffect } from 'react';

export function requestExperimentFullscreen() {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

export function useExperimentFullscreen() {
  useEffect(() => {
    const preferred = sessionStorage.getItem('exp_prefer_fullscreen') === '1';
    if (preferred && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.shiftKey && event.key === 'Escape' && document.fullscreenElement) {
        event.preventDefault();
        void document.exitFullscreen?.().catch(() => {});
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
