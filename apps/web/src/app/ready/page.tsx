import { Suspense } from 'react';
import ReadyClientPage from './ready-client-page';

export default function ReadyPage() {
  return (
    <Suspense fallback={null}>
      <ReadyClientPage />
    </Suspense>
  );
}
