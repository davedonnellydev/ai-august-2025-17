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

import { POST } from '@/app/api/generate-questions/route';
import * as helpers from '@/lib/utils/api-helpers';

jest.mock('@/lib/openai', () => ({
  generateQuestions: jest
    .fn()
    .mockResolvedValue({ questions: [{ id: '1', text: 'Q1' }] }),
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

describe('/api/generate-questions POST', () => {
  beforeEach(() => {
    jest.spyOn(helpers.ServerRateLimiter, 'checkLimit').mockReturnValue(true);
    jest.spyOn(helpers.ServerRateLimiter, 'getRemaining').mockReturnValue(10);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns 400 on invalid body', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await (res as any).json();
    expect(data.error).toBe('Invalid request body');
  });

  test('returns 429 when rate limited', async () => {
    jest.spyOn(helpers.ServerRateLimiter, 'checkLimit').mockReturnValue(false);
    const res = await POST(
      makeRequest({ job: { role: 'R', interviewType: 'screening' } })
    );
    expect(res.status).toBe(429);
    const headers = (res as any).headers;
    expect(headers.get('Retry-After')).toBeTruthy();
    const data = await (res as any).json();
    expect(data.error).toMatch(/Rate limit/);
  });

  test('returns 200 and questions on success', async () => {
    const res = await POST(
      makeRequest({ job: { role: 'R', interviewType: 'screening' } })
    );
    expect(res.status).toBe(200);
    const data = await (res as any).json();
    expect(Array.isArray(data.questionSet.questions)).toBe(true);
  });
});
