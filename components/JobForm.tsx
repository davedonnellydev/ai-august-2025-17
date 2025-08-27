'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Paper,
  Stack,
  Text,
  TextInput,
  Select,
  Textarea,
  Group,
} from '@mantine/core';
import type { JobConfig, Session, Question } from '@/lib/types';
import { saveSession, setLastSessionId } from '@/lib/storage';

type FormState = {
  role: string;
  interviewType: JobConfig['interviewType'] | '';
  seniority: JobConfig['seniority'] | '';
  extras: string;
};

export function JobForm() {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>({
    role: '',
    interviewType: '',
    seniority: '',
    extras: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [liveMessage, setLiveMessage] = React.useState('');
  const errorRef = React.useRef<HTMLDivElement | null>(null);

  const handleChange = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.role.trim()) {
      setError('Please enter a role.');
      setLiveMessage('Please enter a role.');
      return;
    }
    if (!form.interviewType) {
      setError('Please select an interview type.');
      setLiveMessage('Please select an interview type.');
      return;
    }

    const job: JobConfig = {
      role: form.role.trim(),
      interviewType: form.interviewType as JobConfig['interviewType'],
      seniority: form.seniority || undefined,
      extras: form.extras.trim() || undefined,
    };

    setSubmitting(true);
    setLiveMessage('Generating questions…');
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate questions');
      }
      const data: { questionSet: { questions: Question[] } } = await res.json();
      console.log(data);
      const session: Session = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        job,
        createdAt: new Date().toISOString(),
        questions: data.questionSet.questions || [],
        attempts: [],
      };
      saveSession(session);
      setLastSessionId(session.id);
      router.push('/practice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLiveMessage(
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      component="form"
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <Stack gap="md">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </div>
        <Text fw={600} fz="lg">
          Start a new practice session
        </Text>
        <TextInput
          label="Role"
          placeholder="e.g., Frontend Engineer"
          value={form.role}
          onChange={(e) => handleChange('role', e.currentTarget.value)}
          required
          disabled={submitting}
        />
        <Select
          label="Interview type"
          placeholder="Select type"
          data={[
            { value: 'screening', label: 'Screening' },
            { value: 'behavioral', label: 'Behavioral' },
            { value: 'technical', label: 'Technical' },
            { value: 'system_design', label: 'System design' },
            { value: 'case', label: 'Case' },
            { value: 'other', label: 'Other' },
          ]}
          value={form.interviewType}
          onChange={(val) =>
            handleChange(
              'interviewType',
              (val as FormState['interviewType']) ?? ''
            )
          }
          required
          disabled={submitting}
        />
        <Select
          label="Seniority (optional)"
          placeholder="Select seniority"
          data={[
            { value: 'intern', label: 'Intern' },
            { value: 'junior', label: 'Junior' },
            { value: 'mid', label: 'Mid' },
            { value: 'senior', label: 'Senior' },
            { value: 'lead', label: 'Lead' },
          ]}
          value={form.seniority}
          onChange={(val) =>
            handleChange('seniority', (val as FormState['seniority']) ?? '')
          }
          disabled={submitting}
          clearable
        />
        <Textarea
          label="Extras (optional)"
          placeholder="Any specific focus or context to tailor the questions"
          minRows={3}
          value={form.extras}
          onChange={(e) => handleChange('extras', e.currentTarget.value)}
          disabled={submitting}
        />

        {error ? (
          <Text c="red" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </Text>
        ) : null}

        <Group justify="space-between" align="center">
          <div aria-live="polite" aria-atomic="true">
            {submitting ? <Text c="dimmed">Generating questions…</Text> : null}
          </div>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Start practice
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default JobForm;
