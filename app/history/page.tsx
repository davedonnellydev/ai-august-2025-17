'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { Session } from '@/lib/types';
import {
  loadSessions,
  setLastSessionId,
  removeSession,
  saveSession,
} from '@/lib/storage';

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [toastInfo, setToastInfo] = React.useState<{ count: number } | null>(
    null
  );
  const undoBatchRef = React.useRef<Session[] | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const all = loadSessions();
    setSessions(all);
  }, []);

  function toggleExpanded(sessionId: string) {
    setExpanded((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  }

  function handleOpenSession(sessionId: string) {
    setLastSessionId(sessionId);
    router.push('/practice');
  }

  function handleOpenQuestion(sessionId: string, questionId: string) {
    setLastSessionId(sessionId);
    router.push(`/practice?questionId=${encodeURIComponent(questionId)}`);
  }

  function handleDeleteSession(sessionId: string) {
    const toDelete = sessions.filter((s) => s.id === sessionId);
    if (toDelete.length === 0) {
      return;
    }
    handleDeleteSessionsInternal(toDelete);
  }

  function handleToggleSelect(sessionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) {
      return;
    }
    const toDelete = sessions.filter((s) => selectedIds.has(s.id));
    handleDeleteSessionsInternal(toDelete);
    setSelectedIds(new Set());
  }

  function handleDeleteSessionsInternal(toDelete: Session[]) {
    // Perform deletion
    toDelete.forEach((s) => removeSession(s.id));
    setSessions((prev) =>
      prev.filter((s) => !toDelete.some((d) => d.id === s.id))
    );
    setExpanded((prev) => {
      const next = { ...prev };
      toDelete.forEach((s) => delete next[s.id]);
      return next;
    });

    // Setup undo toast
    undoBatchRef.current = toDelete;
    setToastInfo({ count: toDelete.length });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastInfo(null);
      undoBatchRef.current = null;
      toastTimerRef.current = null;
    }, 6000);
  }

  function handleUndo() {
    const batch = undoBatchRef.current;
    if (!batch || batch.length === 0) {
      return;
    }
    // Restore sessions (reverse to keep original order more stable)
    for (let i = batch.length - 1; i >= 0; i--) {
      saveSession(batch[i]);
    }
    setSessions(loadSessions());
    setToastInfo(null);
    undoBatchRef.current = null;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>History</Title>
          <Text c="dimmed">Your past practice sessions</Text>
        </div>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => router.push('/')}>
            Home
          </Button>
        </Group>

        {sessions.length === 0 ? (
          <Text>No sessions yet. Start from the home page to create one.</Text>
        ) : null}

        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="light"
              color="red"
              disabled={!hasSelection}
              onClick={handleDeleteSelected}
            >
              Delete selected
            </Button>
            {hasSelection ? (
              <Button variant="subtle" onClick={handleClearSelection}>
                Clear selection
              </Button>
            ) : null}
          </Group>
          {toastInfo ? (
            <Paper withBorder p="xs" radius="md" aria-live="polite">
              <Group gap="sm">
                <Text>{toastInfo.count} deleted</Text>
                <Button size="xs" variant="outline" onClick={handleUndo}>
                  Undo
                </Button>
              </Group>
            </Paper>
          ) : null}
        </Group>

        {sessions.map((s) => {
          const date = new Date(s.createdAt);
          const subtitle = [s.job.role, s.job.interviewType, s.job.seniority]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card key={s.id} withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group>
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onChange={() => handleToggleSelect(s.id)}
                      aria-label="Select session"
                    />
                    <div>
                      <Text fw={600}>{date.toLocaleString()}</Text>
                      <Text c="dimmed" fz="sm">
                        {subtitle}
                      </Text>
                    </div>
                  </Group>
                  <Group>
                    <Badge variant="light">
                      {s.questions.length} questions
                    </Badge>
                    <Badge variant="light">{s.attempts.length} attempts</Badge>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => handleOpenSession(s.id)}
                    >
                      Open session
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="outline"
                      onClick={() => handleDeleteSession(s.id)}
                    >
                      Delete
                    </Button>
                    <Button size="xs" onClick={() => toggleExpanded(s.id)}>
                      {expanded[s.id] ? 'Hide details' : 'Show details'}
                    </Button>
                  </Group>
                </Group>

                {expanded[s.id] ? (
                  <Paper withBorder p="sm" radius="md">
                    <Stack gap="md">
                      <div>
                        <Text fw={600}>Questions</Text>
                        <List spacing="xs">
                          {s.questions.map((q, idx) => (
                            <List.Item key={q.id}>
                              <Group justify="space-between" align="center">
                                <Text>
                                  {idx + 1}. {q.text}
                                </Text>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handleOpenQuestion(s.id, q.id)}
                                >
                                  Open question
                                </Button>
                              </Group>
                            </List.Item>
                          ))}
                        </List>
                      </div>
                      <div>
                        <Text fw={600}>Attempts</Text>
                        {s.attempts.length === 0 ? (
                          <Text c="dimmed" fz="sm">
                            No attempts saved yet.
                          </Text>
                        ) : (
                          <List spacing="xs">
                            {s.attempts.map((a, idx) => {
                              const q = s.questions.find(
                                (qq) => qq.id === a.questionId
                              );
                              return (
                                <List.Item key={`${a.id}-${idx}`}>
                                  <Stack gap="xs">
                                    <Text fz="sm" c="dimmed">
                                      {new Date(a.startedAt).toLocaleString()} ·
                                      Question: {q ? q.text : a.questionId}
                                    </Text>
                                    {a.feedback ? (
                                      <Group
                                        justify="space-between"
                                        align="center"
                                      >
                                        <Text>{a.feedback.summary}</Text>
                                        {typeof a.feedback.score ===
                                        'number' ? (
                                          <Badge variant="light">
                                            Score: {a.feedback.score}
                                          </Badge>
                                        ) : null}
                                      </Group>
                                    ) : (
                                      <Text c="dimmed">No feedback saved</Text>
                                    )}
                                    <Group>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          handleOpenQuestion(s.id, a.questionId)
                                        }
                                      >
                                        Open question
                                      </Button>
                                    </Group>
                                  </Stack>
                                </List.Item>
                              );
                            })}
                          </List>
                        )}
                      </div>
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
}
