jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (data: any, init?: any) => {
        const headers = new Headers(init?.headers || {});
        return {
          status: init?.status ?? 200,
          headers,
          json: async () => data,
        } as any;
      },
    },
  };
});

import { POST } from '@/app/api/assess-answer/route';
import * as helpers from '@/lib/utils/api-helpers';

jest.mock('@/lib/openai', () => ({
  assessAnswer: jest.fn().mockResolvedValue({
    summary: 'S',
    strengths: [],
    improvements: [],
    tips: [],
    exampleAnswer: 'E',
    score: 50,
  }),
}));

function makeRequest(body: any = {}) {
  const headers = new Map<string, string>();
  return {
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) || null,
    },
    json: async () => body,
  } as any;
}

const baseJob = { role: 'R', interviewType: 'screening' };
const baseQuestion = { id: 'qid', text: 'T' };

describe('/api/assess-answer POST', () => {
  beforeEach(() => {
    jest.spyOn(helpers.ServerRateLimiter, 'checkLimit').mockReturnValue(true);
    jest.spyOn(helpers.ServerRateLimiter, 'getRemaining').mockReturnValue(10);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns 400 when neither answerText nor transcript provided', async () => {
    const res = await POST(
      makeRequest({ job: baseJob, question: baseQuestion })
    );
    expect(res.status).toBe(400);
    const data = await (res as any).json();
    expect(data.error).toBe('Invalid request body');
  });

  test('returns 429 when rate limited', async () => {
    jest.spyOn(helpers.ServerRateLimiter, 'checkLimit').mockReturnValue(false);
    const res = await POST(
      makeRequest({ job: baseJob, question: baseQuestion, answerText: 'A' })
    );
    expect(res.status).toBe(429);
  });

  test('returns 200 and feedback on success', async () => {
    const res = await POST(
      makeRequest({ job: baseJob, question: baseQuestion, answerText: 'A' })
    );
    expect(res.status).toBe(200);
    const data = await (res as any).json();
    expect(data.feedback.summary).toBe('S');
  });
});
