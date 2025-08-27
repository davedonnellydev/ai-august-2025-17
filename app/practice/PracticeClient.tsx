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
  Stepper,
  Text,
  Textarea,
  Title,
  Kbd,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { Attempt, Feedback, Session } from '@/lib/types';
import {
  getLastSessionId,
  loadSessions,
  saveSession,
  setRemainingRequests,
} from '@/lib/storage';

type Status = 'idle' | 'assessing' | 'feedback' | 'asking';

export default function PracticeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = React.useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answerText, setAnswerText] = React.useState('');
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState<Attempt | null>(null);
  const [liveMessage, setLiveMessage] = React.useState('');

  const liveRegionRef = React.useRef<HTMLDivElement | null>(null);
  const questionRegionRef = React.useRef<HTMLDivElement | null>(null);
  const feedbackRegionRef = React.useRef<HTMLDivElement | null>(null);
  const errorRef = React.useRef<HTMLDivElement | null>(null);
  const answerTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

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

  function resetForCurrentQuestion(
    nextIndex: number,
    sourceSession?: Session | null
  ) {
    setCurrentIndex(nextIndex);
    setAnswerText('');
    setFeedback(null);
    setStatus('idle');
    setLiveMessage('');
    const activeSession = sourceSession ?? session;
    if (activeSession) {
      const q = activeSession.questions[nextIndex];
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

  React.useEffect(() => {
    if (error) {
      errorRef.current?.focus();
      setLiveMessage(`Error: ${error}`);
    }
  }, [error]);

  React.useEffect(() => {
    if (session && currentQuestion) {
      setLiveMessage(
        `Question ${currentIndex + 1} of ${session.questions.length}`
      );
      // Move focus to the question text for screen readers
      questionRegionRef.current?.focus();
    }
  }, [session, currentQuestion, currentIndex]);

  // Keyboard shortcuts for navigation and actions
  React.useEffect(() => {
    function isInteractiveContext(node: HTMLElement | null): boolean {
      if (!node) {
        return false;
      }
      const tag = node.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (node as HTMLElement).isContentEditable
      ) {
        return true;
      }
      const el = node.closest(
        '[role="textbox"], [role="tablist"], [role="listbox"], [role="menu"], [role="menubar"], [role="combobox"], [role="slider"]'
      );
      return Boolean(el);
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inInteractive = isInteractiveContext(target);

      // Submit answer: Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (status !== 'assessing' && status !== 'asking') {
          handleSubmit(answerTextareaRef.current?.value ?? answerText);
        }
        return;
      }

      if (!inInteractive) {
        // Next/Prev question with arrows
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          if (status !== 'assessing' && status !== 'asking') {
            handleNextQuestion();
          }
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          if (status !== 'assessing' && status !== 'asking') {
            handlePrevQuestion();
          }
          return;
        }
        // T: Try again
        if (e.key.length === 1 && e.key.toLowerCase() === 't') {
          e.preventDefault();
          e.stopPropagation();
          if (status !== 'assessing' && status !== 'asking') {
            handleTryAgain();
          }
          return;
        }
        // N: New set
        if (e.key.length === 1 && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          e.stopPropagation();
          if (status !== 'assessing') {
            handleNewSet();
          }
          return;
        }
        // A: Focus answer textarea
        if (e.key.length === 1 && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopPropagation();
          answerTextareaRef.current?.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [status, session, currentIndex, answerText]);

  async function handleSubmit(overrideText?: string) {
    if (!session || !currentQuestion) {
      return;
    }
    setError(null);
    const sourceText =
      typeof overrideText === 'string' ? overrideText : answerText;
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setError('Please enter an answer first.');
      return;
    }
    setStatus('assessing');
    setLiveMessage('Assessing your answer…');
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
      const data: { feedback: Feedback; remainingRequests?: number } =
        await res.json();
      setFeedback(data.feedback);
      if (typeof data.remainingRequests === 'number') {
        setRemainingRequests(data.remainingRequests);
      }
      setStatus('feedback');
      setLiveMessage('Feedback loaded.');
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
      // Move focus to feedback region for immediate announcement
      feedbackRegionRef.current?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setStatus('idle');
      setLiveMessage(`Error: ${msg}`);
      notifications.show({
        color: 'red',
        title: 'Failed to assess answer',
        message: (
          <Group gap="xs">
            <Text>{msg}</Text>
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleSubmit(trimmed)}
            >
              Retry
            </Button>
          </Group>
        ),
        withCloseButton: true,
        autoClose: 5000,
      });
    }
  }

  function handleTryAgain() {
    setAnswerText('');
    setFeedback(null);
    setStatus('idle');
    setLiveMessage('Answer cleared. You can type a new answer.');
    setAttempt((prev) => ({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      questionId: prev?.questionId || (currentQuestion?.id ?? ''),
      startedAt: new Date().toISOString(),
      answerText: '',
    }));
    // Return focus to the answer textarea for convenience
    answerTextareaRef.current?.focus();
  }

  function titleCase(value?: string | null) {
    if (!value) {
      return '';
    }
    return value
      .toString()
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  function handleNextQuestion() {
    if (!session) {
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex >= session.questions.length) {
      return;
    }
    resetForCurrentQuestion(nextIndex);
  }

  function handlePrevQuestion() {
    if (!session) {
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      return;
    }
    resetForCurrentQuestion(prevIndex);
  }

  async function handleNewSet() {
    if (!session) {
      return;
    }
    setStatus('asking');
    setError(null);
    setLiveMessage('Generating a new set of questions…');
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
      const data: {
        questionSet?: { questions?: Session['questions'] } | null;
        remainingRequests?: number;
      } = await res.json();
      const newQuestions = data?.questionSet?.questions ?? [];
      if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
        throw new Error('No questions received. Please try again.');
      }
      const updated: Session = { ...session, questions: newQuestions };
      setSession(updated);
      saveSession(updated);
      if (typeof data.remainingRequests === 'number') {
        setRemainingRequests(data.remainingRequests);
      }
      resetForCurrentQuestion(0, updated);
      setLiveMessage(
        `New set loaded. Question 1 of ${updated.questions.length}`
      );
      questionRegionRef.current?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setStatus('idle');
      setLiveMessage(`Error: ${msg}`);
      notifications.show({
        color: 'red',
        title: 'Failed to generate questions',
        message: (
          <Group gap="xs">
            <Text>{msg}</Text>
            <Button size="xs" variant="outline" onClick={handleNewSet}>
              Retry
            </Button>
          </Group>
        ),
        withCloseButton: true,
        autoClose: 5000,
      });
    }
  }

  function handleSaveAttempt() {
    if (!session || !attempt) {
      return;
    }
    const finalizedAttempt: Attempt = {
      ...attempt,
      endedAt: attempt.endedAt || new Date().toISOString(),
    };
    const existingIndex = session.attempts.findIndex(
      (a) => a.id === attempt.id
    );
    const nextAttempts = [...session.attempts];
    if (existingIndex >= 0) {
      nextAttempts[existingIndex] = finalizedAttempt;
    } else {
      nextAttempts.unshift(finalizedAttempt);
    }
    const updated: Session = {
      ...session,
      attempts: nextAttempts,
    };
    setSession(updated);
    saveSession(updated);
    notifications.show({
      title: 'Saved',
      message: 'Your attempt has been saved to history.',
      color: 'teal',
    });
  }

  if (!session || !currentQuestion) {
    return null;
  }

  const atEndOfSet = currentIndex >= session.questions.length - 1;
  const atStartOfSet = currentIndex <= 0;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          ref={liveRegionRef}
        >
          {liveMessage}
        </div>
        <div>
          <Title order={2}>Practice</Title>
          <Text c="dimmed">
            {session.job.role} · {titleCase(String(session.job.interviewType))}
            {session.job.seniority
              ? ` · ${titleCase(String(session.job.seniority))}`
              : ''}
          </Text>
        </div>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => router.push('/')}>
            Home
          </Button>
          <Button variant="default" onClick={() => router.push('/history')}>
            History
          </Button>
        </Group>

        <Stepper
          active={currentIndex}
          onStepClick={(i) => resetForCurrentQuestion(i)}
          allowNextStepsSelect
          size="sm"
          aria-label="Question progress"
        >
          {session.questions.map((q, idx) => {
            const qid = q.id;
            const savedAnswered = session.attempts.some(
              (a) =>
                a.questionId === qid &&
                (a.feedback || (a.answerText && a.answerText.length > 0))
            );
            const currentAnswered =
              attempt &&
              attempt.questionId === qid &&
              (attempt.feedback ||
                (attempt.answerText && attempt.answerText.length > 0));
            const isAnswered = Boolean(savedAnswered || currentAnswered);
            return (
              <Stepper.Step
                key={qid}
                label={`Q${idx + 1}`}
                color={isAnswered ? 'teal' : 'gray'}
              />
            );
          })}
        </Stepper>

        <Card
          withBorder
          padding="md"
          radius="md"
          role="region"
          aria-labelledby="question-label"
        >
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={600} id="question-label">
                Question
              </Text>
              <Badge variant="light">
                {currentIndex + 1} / {session.questions.length}
              </Badge>
            </Group>
            <Text ref={questionRegionRef} tabIndex={-1}>
              {currentQuestion.text}
            </Text>
          </Stack>
        </Card>

        <Paper withBorder p="md" radius="md" aria-labelledby="answer-label">
          <Stack gap="sm">
            <Text fw={600} id="answer-label">
              Your answer
            </Text>
            <Textarea
              placeholder="Type your answer here"
              minRows={6}
              autosize
              value={answerText}
              onChange={(e) => setAnswerText(e.currentTarget.value)}
              disabled={status === 'assessing' || status === 'asking'}
              ref={answerTextareaRef}
              aria-describedby="answer-help"
            />
            <Text c="dimmed" fz="sm" id="answer-help">
              Shortcuts: <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Enter</Kbd> submit
              ·<Kbd>←</Kbd>/<Kbd>→</Kbd> navigate · <Kbd>T</Kbd> try again ·
              <Kbd>N</Kbd> new set · <Kbd>A</Kbd> focus answer
            </Text>
            {status === 'assessing' ? (
              <Text c="dimmed" aria-live="polite">
                Assessing answer…
              </Text>
            ) : null}
            {error ? (
              <Text c="red" role="alert" tabIndex={-1} ref={errorRef}>
                {error}
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button
                onClick={() =>
                  handleSubmit(answerTextareaRef.current?.value ?? answerText)
                }
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
          <Paper
            withBorder
            p="md"
            radius="md"
            aria-live="polite"
            tabIndex={-1}
            ref={feedbackRegionRef}
            role="region"
            aria-labelledby="feedback-label"
          >
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600} id="feedback-label">
                  Feedback
                </Text>
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
                  onClick={handlePrevQuestion}
                  disabled={
                    status === 'assessing' ||
                    status === 'asking' ||
                    atStartOfSet
                  }
                >
                  Previous question
                </Button>
                <Group>
                  <Button
                    variant="default"
                    onClick={handleNextQuestion}
                    disabled={
                      status === 'assessing' ||
                      status === 'asking' ||
                      atEndOfSet
                    }
                  >
                    Next question
                  </Button>
                  <Button onClick={handleSaveAttempt} variant="outline">
                    Save attempt
                  </Button>
                  <Button
                    onClick={handleNewSet}
                    loading={status === 'asking'}
                    disabled={status === 'assessing'}
                  >
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
              onClick={handlePrevQuestion}
              disabled={
                status === 'assessing' || status === 'asking' || atStartOfSet
              }
            >
              Previous question
            </Button>
            <Group>
              <Button
                variant="default"
                onClick={handleNextQuestion}
                disabled={
                  status === 'assessing' || status === 'asking' || atEndOfSet
                }
              >
                Next question
              </Button>
              <Button
                onClick={handleNewSet}
                loading={status === 'asking'}
                disabled={status === 'assessing'}
              >
                {status === 'asking' ? 'Generating…' : 'New set'}
              </Button>
            </Group>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
