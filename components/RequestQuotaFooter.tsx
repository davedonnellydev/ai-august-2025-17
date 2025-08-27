'use client';

import React from 'react';
import { Group, Text, Paper } from '@mantine/core';
import { getRemainingRequests } from '@/lib/storage';
import { MAX_REQUESTS } from '@/app/config/constants';

export default function RequestQuotaFooter() {
  const [remaining, setRemaining] = React.useState<number>(MAX_REQUESTS);

  React.useEffect(() => {
    const val = getRemainingRequests();
    setRemaining(typeof val === 'number' ? val : MAX_REQUESTS);
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes('aicoach.remainingRequests')) {
        const next = getRemainingRequests();
        setRemaining(typeof next === 'number' ? next : MAX_REQUESTS);
      }
    };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(() => {
      const next = getRemainingRequests();
      setRemaining(typeof next === 'number' ? next : MAX_REQUESTS);
    }, 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <footer aria-live="polite" role="contentinfo" aria-label="Usage quota">
      <Paper withBorder p="xs" radius="md">
        <Group justify="flex-end" align="center" aria-live="polite">
          <Text c="dimmed" fz="sm" aria-hidden="true">
            Practice question generations remaining
          </Text>
          <Text
            fw={600}
            aria-label={`Remaining practice generations: ${remaining}`}
          >
            {remaining}
          </Text>
        </Group>
      </Paper>
    </footer>
  );
}
