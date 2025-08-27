'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import type { Attempt, Feedback, Session } from '@/lib/types';
import { getLastSessionId, loadSessions, saveSession } from '@/lib/storage';

type Status = 'idle' | 'assessing' | 'feedback' | 'asking';

export default function PracticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = React.useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answerText, setAnswerText] = React.useState('');
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState<Attempt | null>(null);

  // Load latest session on mount
  React.useEffect(() => {
    const lastId = getLastSessionId();
    const all = loadSessions();
    const found = lastId ? all.find((s) => s.id === lastId) : all[0];
    if (!found || !found.questions || found.questions.length === 0) {
      router.replace('/');
      return;
    }
    const qParam = searchParams?.get('questionId');
    const startIndex = qParam
      ? Math.max(
          0,
          found.questions.findIndex((q) => q.id === qParam)
        )
      : 0;
    const index = startIndex === -1 ? 0 : startIndex;
    setSession(found);
    setCurrentIndex(index);
    setAttempt({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      questionId: found.questions[index].id,
      startedAt: new Date().toISOString(),
      answerText: '',
    });
  }, [router, searchParams]);

  const currentQuestion = React.useMemo(() => {
    if (!session) {
      return null;
    }
    return session.questions[currentIndex] ?? null;
  }, [session, currentIndex]);

  function resetForCurrentQuestion(nextIndex: number) {
    setCurrentIndex(nextIndex);
    setAnswerText('');
    setFeedback(null);
    setStatus('idle');
    if (session) {
      const q = session.questions[nextIndex];
      setAttempt({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        questionId: q.id,
        startedAt: new Date().toISOString(),
        answerText: '',
      });
    }
  }

  async function handleSubmit() {
    if (!session || !currentQuestion) {
      return;
    }
    setError(null);
    const trimmed = answerText.trim();
    if (!trimmed) {
      setError('Please enter an answer first.');
      return;
    }
    setStatus('assessing');
    try {
      const res = await fetch('/api/assess-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: session.job,
          question: currentQuestion,
          answerText: trimmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to assess answer');
      }
      const data: { feedback: Feedback } = await res.json();
      setFeedback(data.feedback);
      setStatus('feedback');
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              answerText: trimmed,
              endedAt: new Date().toISOString(),
              feedback: data.feedback,
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('idle');
    }
  }

  function handleTryAgain() {
    setAnswerText('');
    setFeedback(null);
    setStatus('idle');
    setAttempt((prev) => ({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      questionId: prev?.questionId || (currentQuestion?.id ?? ''),
      startedAt: new Date().toISOString(),
      answerText: '',
    }));
  }

  function handleNextQuestion() {
    if (!session) {
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex >= session.questions.length) {
      // End of set — keep index, prompt to get a new set
      return;
    }
    resetForCurrentQuestion(nextIndex);
  }

  async function handleNewSet() {
    if (!session) {
      return;
    }
    setStatus('asking');
    setError(null);
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: session.job }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate questions');
      }
      const data: { questions: Session['questions'] } = await res.json();
      const updated: Session = { ...session, questions: data.questions };
      setSession(updated);
      saveSession(updated);
      resetForCurrentQuestion(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('idle');
    }
  }

  function handleSaveAttempt() {
    if (!session || !attempt) {
      return;
    }
    const updated: Session = {
      ...session,
      attempts: [
        {
          ...attempt,
          endedAt: attempt.endedAt || new Date().toISOString(),
        },
        ...session.attempts,
      ],
    };
    setSession(updated);
    saveSession(updated);
  }

  if (!session || !currentQuestion) {
    return null;
  }

  const atEndOfSet = currentIndex >= session.questions.length - 1;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>Practice</Title>
          <Text c="dimmed">
            {session.job.role} · {session.job.interviewType}
            {session.job.seniority ? ` · ${session.job.seniority}` : ''}
          </Text>
        </div>

        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={600}>Question</Text>
              <Badge variant="light">
                {currentIndex + 1} / {session.questions.length}
              </Badge>
            </Group>
            <Text>{currentQuestion.text}</Text>
          </Stack>
        </Card>

        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Your answer</Text>
            <Textarea
              placeholder="Type your answer here"
              minRows={6}
              autosize
              value={answerText}
              onChange={(e) => setAnswerText(e.currentTarget.value)}
              disabled={status === 'assessing' || status === 'asking'}
            />
            {error ? (
              <Text c="red" role="alert">
                {error}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button
                onClick={handleSubmit}
                loading={status === 'assessing'}
                disabled={status === 'assessing' || status === 'asking'}
              >
                Submit answer
              </Button>
              <Button
                variant="default"
                onClick={handleTryAgain}
                disabled={status === 'assessing' || status === 'asking'}
              >
                Try again
              </Button>
            </Group>
          </Stack>
        </Paper>

        {feedback ? (
          <Paper withBorder p="md" radius="md" aria-live="polite">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>Feedback</Text>
                {typeof feedback.score === 'number' ? (
                  <Badge color="blue" variant="light">
                    Score: {feedback.score}
                  </Badge>
                ) : null}
              </Group>
              <Text>{feedback.summary}</Text>
              <Divider />
              {feedback.strengths?.length ? (
                <div>
                  <Text fw={600}>Strengths</Text>
                  <List>
                    {feedback.strengths.map((s, i) => (
                      <List.Item key={`s-${i}`}>{s}</List.Item>
                    ))}
                  </List>
                </div>
              ) : null}
              {feedback.improvements?.length ? (
                <div>
                  <Text fw={600}>Improvements</Text>
                  <List>
                    {feedback.improvements.map((s, i) => (
                      <List.Item key={`i-${i}`}>{s}</List.Item>
                    ))}
                  </List>
                </div>
              ) : null}
              {feedback.tips?.length ? (
                <div>
                  <Text fw={600}>Tips</Text>
                  <List>
                    {feedback.tips.map((s, i) => (
                      <List.Item key={`t-${i}`}>{s}</List.Item>
                    ))}
                  </List>
                </div>
              ) : null}
              {feedback.exampleAnswer ? (
                <div>
                  <Text fw={600}>Example answer</Text>
                  <Paper p="sm" withBorder>
                    <Text
                      style={{
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {feedback.exampleAnswer}
                    </Text>
                  </Paper>
                </div>
              ) : null}
              <Group justify="space-between">
                <Button
                  variant="default"
                  onClick={handleNextQuestion}
                  disabled={status === 'assessing' || status === 'asking'}
                >
                  Next question
                </Button>
                <Group>
                  <Button onClick={handleSaveAttempt} variant="outline">
                    Save attempt
                  </Button>
                  <Button onClick={handleNewSet} loading={status === 'asking'}>
                    New set
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Group justify="space-between">
            <Button
              variant="default"
              onClick={handleNextQuestion}
              disabled={status === 'assessing' || status === 'asking'}
            >
              {atEndOfSet ? 'End of set' : 'Next question'}
            </Button>
            <Button onClick={handleNewSet} loading={status === 'asking'}>
              New set
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
