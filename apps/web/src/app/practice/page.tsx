'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PracticePage() {
  const router = useRouter();
  const { bootstrap, runtime, loading } = useSessionRuntime();

  useEffect(() => {
    if (!loading && !bootstrap) {
      router.replace('/login');
      return;
    }
    if (!runtime) return;
    if (runtime.phase === 'formal_ready') {
      router.replace('/ready?target=formal');
      return;
    }
    if (runtime.phase === 'formal_work') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
      return;
    }
    if (runtime.phase === 'formal_break') {
      router.replace('/break');
      return;
    }
    if (runtime.phase === 'end') {
      router.replace('/workspace/end');
      return;
    }
    if (runtime.phase === 'practice') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
    }
  }, [bootstrap, loading, router, runtime]);

  return null;
}
