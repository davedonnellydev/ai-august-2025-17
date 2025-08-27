jest.mock('@/app/config/constants', () => ({
  AUDIO_ENABLED: false,
  MAX_REQUESTS: 10,
  STORAGE_WINDOW_MS: 3600000,
}));

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

import { POST } from '@/app/api/transcribe/route';

function makeFormRequest(form: FormData) {
  const headers = new Map<string, string>();
  return {
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) || null,
    },
    formData: async () => form,
  } as any;
}

describe('/api/transcribe POST', () => {
  test('responds 404 when AUDIO is disabled', async () => {
    const res = await POST(makeFormRequest(new FormData()));
    expect(res.status).toBe(404);
    const data = await (res as any).json();
    expect(data.error).toBe('Not found');
  });
});
