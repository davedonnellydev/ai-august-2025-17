import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Difficulty } from '@/lib/types';
import { assessAnswer } from '@/lib/openai';
import { MAX_REQUESTS, STORAGE_WINDOW_MS } from '@/app/config/constants';
import {
  ServerRateLimiter,
  withRateLimitHeaders,
} from '@/lib/utils/api-helpers';

const JobConfigSchema = z.object({
  role: z.string().min(1),
  interviewType: z.enum([
    'screening',
    'behavioral',
    'technical',
    'system_design',
    'case',
    'other',
  ]),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'lead']).optional(),
  extras: z.string().optional(),
});

const DifficultySchema: z.ZodType<Difficulty> = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const QuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  category: z.string().optional(),
  difficulty: DifficultySchema.optional(),
});

const AssessBodySchema = z
  .object({
    job: JobConfigSchema,
    question: QuestionSchema,
    answerText: z.string().optional(),
    transcript: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.answerText && data.answerText.trim()) ||
          (data.transcript && data.transcript.trim())
      ),
    {
      message: 'Either answerText or transcript is required',
      path: ['answerText'],
    }
  );

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!ServerRateLimiter.checkLimit(ip)) {
      const remaining = ServerRateLimiter.getRemaining(ip);
      const init = withRateLimitHeaders(
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(STORAGE_WINDOW_MS / 1000)),
          },
        },
        {
          remaining,
          limit: MAX_REQUESTS,
          resetMs: STORAGE_WINDOW_MS,
        }
      );
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        init
      );
    }

    const body = await request.json();
    const parsed = AssessBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const feedback = await assessAnswer(parsed.data);

    const remaining = ServerRateLimiter.getRemaining(ip);
    const init = withRateLimitHeaders(undefined, {
      remaining,
      limit: MAX_REQUESTS,
      resetMs: STORAGE_WINDOW_MS,
    });

    return NextResponse.json({ feedback, remainingRequests: remaining }, init);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to assess answer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
