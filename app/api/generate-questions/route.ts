import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQuestions } from '@/lib/openai';
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
    const candidate =
      body && typeof body === 'object' && 'job' in body ? body.job : body;
    const parsed = JobConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const questionSet = await generateQuestions(parsed.data);

    const remaining = ServerRateLimiter.getRemaining(ip);
    const init = withRateLimitHeaders(undefined, {
      remaining,
      limit: MAX_REQUESTS,
      resetMs: STORAGE_WINDOW_MS,
    });

    return NextResponse.json(
      { questionSet, remainingRequests: remaining },
      init
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate questions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
