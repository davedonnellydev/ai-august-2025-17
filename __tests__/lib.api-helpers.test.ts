import {
  apiCache,
  retryRequest,
  generateCacheKey,
  validateApiResponse,
  formatApiError,
  debounce,
  throttle,
  InputValidator,
  ServerRateLimiter,
  withRateLimitHeaders,
} from '@/lib/utils/api-helpers';

describe('ApiCache', () => {
  jest.useFakeTimers();
  test('set/get works and respects TTL', async () => {
    apiCache.clear();
    apiCache.set('k', { v: 1 }, 10);
    expect(apiCache.get('k')).toEqual({ v: 1 });
    jest.advanceTimersByTime(15);
    expect(apiCache.get('k')).toBeNull();
  });
});

describe('retryRequest', () => {
  jest.useFakeTimers();
  test('retries and resolves', async () => {
    let attempts = 0;
    const fn = jest.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('fail');
      }
      return 'ok';
    });
    const promise = retryRequest(fn, 5, 1);
    // For fake timers + promises, advance timers and flush microtasks repeatedly
    for (const t of [0, 1, 2, 4]) {
      jest.advanceTimersByTime(t);
      await Promise.resolve();
    }
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('helpers', () => {
  test('generateCacheKey', () => {
    expect(generateCacheKey('/x', { a: 1 })).toBe('/x:{"a":1}');
  });

  test('validateApiResponse', () => {
    expect(validateApiResponse({ x: 1 })).toBe(true);
    expect(validateApiResponse({ error: 'oops' })).toBe(false);
  });

  test('formatApiError', () => {
    expect(formatApiError('msg')).toBe('msg');
    expect(formatApiError({ message: 'm' })).toBe('m');
    expect(formatApiError({ error: 'e' })).toBe('e');
    expect(formatApiError({})).toBe('An unexpected error occurred');
  });
});

describe('debounce/throttle', () => {
  jest.useFakeTimers();

  test('debounce calls once after wait', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle limits calls within window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t(1);
    t(2);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    t(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('InputValidator', () => {
  test('rejects empty and too long', () => {
    expect(InputValidator.validateText('', 10).isValid).toBe(false);
    expect(InputValidator.validateText('x'.repeat(11), 10).isValid).toBe(false);
  });

  test('rejects malicious and spam patterns', () => {
    expect(
      InputValidator.validateText('<script>alert(1)</script>', 100).isValid
    ).toBe(false);
    expect(
      InputValidator.validateText('visit http://spam.com', 100).isValid
    ).toBe(false);
  });

  test('accepts valid text', () => {
    expect(InputValidator.validateText('Hello world', 100).isValid).toBe(true);
  });
});

describe('ServerRateLimiter and headers', () => {
  jest.useFakeTimers();
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SERVER_MAX_REQUESTS = '1';
    process.env.SERVER_STORAGE_WINDOW_MS = '10';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('rate limit toggles after window', async () => {
    const ip = '1.1.1.1';
    expect(ServerRateLimiter.checkLimit(ip)).toBe(true);
    expect(ServerRateLimiter.checkLimit(ip)).toBe(false);
    expect(ServerRateLimiter.getRemaining(ip)).toBe(0);
    jest.advanceTimersByTime(15);
    expect(ServerRateLimiter.checkLimit(ip)).toBe(true);
  });

  test('withRateLimitHeaders attaches headers', () => {
    const init = withRateLimitHeaders(
      { headers: { 'X-Other': '1' } },
      { remaining: 3, limit: 10, resetMs: 1000 }
    );
    const headers = new Headers(init.headers);
    expect(headers.get('X-RateLimit-Remaining')).toBe('3');
    expect(headers.get('X-RateLimit-Limit')).toBe('10');
    expect(headers.get('X-RateLimit-Reset')).toBe('1');
    expect(headers.get('X-Other')).toBe('1');
  });
});
