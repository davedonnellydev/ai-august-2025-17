'use client';

import React from 'react';
import { Alert, Group, Button, Text } from '@mantine/core';
import { isMemoryFallback, getStorageMode } from '@/lib/storage';

export default function StorageStatusBanner() {
  const [visible, setVisible] = React.useState(false);
  const [mode, setMode] = React.useState<'localStorage' | 'memory'>(
    typeof window === 'undefined' ? 'memory' : getStorageMode()
  );

  React.useEffect(() => {
    // Check on mount and when visibility toggles
    const current = getStorageMode();
    setMode(current);
    setVisible(isMemoryFallback());
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Alert
      color="yellow"
      variant="light"
      withCloseButton
      onClose={() => setVisible(false)}
    >
      <Group justify="space-between" align="center">
        <Text>
          Offline mode: using in-memory storage. Your data will be lost on
          refresh.
        </Text>
        <Group>
          <Text c="dimmed" fz="sm">
            Mode: {mode}
          </Text>
          <Button size="xs" variant="outline" onClick={() => setVisible(false)}>
            Dismiss
          </Button>
        </Group>
      </Group>
    </Alert>
  );
}
