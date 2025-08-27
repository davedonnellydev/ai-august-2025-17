import React from 'react';
import { Suspense } from 'react';
import PracticeClient from './PracticeClient';

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeClient />
    </Suspense>
  );
}
