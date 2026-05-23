'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BWaitingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workspace/b');
  }, [router]);

  return null;
}
