'use client';

import { useEffect, useRef } from 'react';

export function requestExperimentFullscreen() {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

export function useExperimentFullscreen() {
  const allowExitRef = useRef(false);

  useEffect(() => {
    const preferred = sessionStorage.getItem('exp_prefer_fullscreen') === '1';
    if (preferred && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.shiftKey && event.key === 'Escape' && document.fullscreenElement) {
        event.preventDefault();
        allowExitRef.current = true;
        void document.exitFullscreen?.().catch(() => {});
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    }

    function onFullscreenChange() {
      const shouldPreferFullscreen = sessionStorage.getItem('exp_prefer_fullscreen') === '1';
      if (document.fullscreenElement) {
        allowExitRef.current = false;
        return;
      }
      if (!shouldPreferFullscreen || allowExitRef.current) return;
      window.setTimeout(() => {
        if (!document.fullscreenElement && sessionStorage.getItem('exp_prefer_fullscreen') === '1') {
          void document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }, 150);
    }

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);
}
