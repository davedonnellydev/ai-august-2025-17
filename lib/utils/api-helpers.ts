import { MAX_REQUESTS, STORAGE_WINDOW_MS } from '@/app/config/constants';

// Cache implementation for API responses
class ApiCache {
  private cache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();

  set(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

export const apiCache = new ApiCache();

// Retry logic for failed requests
export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      const waitTime = delay * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error(lastError!.message);
}

// Generate cache key from request parameters
export function generateCacheKey(endpoint: string, params?: any): string {
  const paramString = params ? JSON.stringify(params) : '';
  return `${endpoint}:${paramString}`;
}

// Validate API response
export function validateApiResponse(response: any): boolean {
  return response && typeof response === 'object' && !response.error;
}

// Format error messages
export function formatApiError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error?.message) {
    return error.message;
  }
  if (error?.error) {
    return error.error;
  }
  return 'An unexpected error occurred';
}

// Debounce function for API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for API calls
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Input Validator

export class InputValidator {
  static validateText(
    text: string,
    max_text_length: number
  ): { isValid: boolean; error?: string } {
    if (!text || text.trim().length === 0) {
      return { isValid: false, error: 'Please enter some text to translate' };
    }

    if (text.length > max_text_length) {
      return {
        isValid: false,
        error: `Text too long. Maximum ${max_text_length} characters allowed.`,
      };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /on\w+\s*=/gi, // Event handlers
      /data:text\/html/gi, // Data URLs
      /vbscript:/gi, // VBScript
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          isValid: false,
          error: 'Potentially malicious content detected',
        };
      }
    }

    // Check for spam patterns
    const spamPatterns = [
      /\b(spam|viagra|casino|poker|bet)\b/gi,
      /(http|https):\/\/[^\s]+/g, // URLs
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(text)) {
        return {
          isValid: false,
          error: 'Content contains prohibited patterns',
        };
      }
    }

    return { isValid: true };
  }
}

// Server Rate Limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class ServerRateLimiter {
  private static store = new Map<string, RateLimitEntry>();
  private static lastCleanup = 0;

  static getConfig() {
    const max = Number(process.env.SERVER_MAX_REQUESTS || MAX_REQUESTS);
    const windowMs = Number(
      process.env.SERVER_STORAGE_WINDOW_MS || STORAGE_WINDOW_MS
    );
    return { max, windowMs };
  }

  static checkLimit(ip: string): boolean {
    const { max, windowMs } = this.getConfig();
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (entry.count >= max) {
      return false; // Rate limit exceeded
    }

    // Increment count
    entry.count++;

    // Opportunistic cleanup to avoid global intervals in edge runtimes
    if (now - this.lastCleanup > 5 * 60 * 1000) {
      this.cleanup();
      this.lastCleanup = now;
    }

    return true;
  }

  static getRemaining(ip: string): number {
    const { max } = this.getConfig();
    const entry = this.store.get(ip);
    if (!entry || Date.now() > entry.resetTime) {
      return max;
    }
    return Math.max(0, max - entry.count);
  }

  // Clean up old entries periodically
  static cleanup() {
    const now = Date.now();
    for (const [ip, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(ip);
      }
    }
  }
}

// Helper: attach standard rate limit headers to a NextResponse init
export function withRateLimitHeaders(
  init: ResponseInit | undefined,
  opts: {
    remaining: number;
    limit: number;
    resetMs: number;
  }
): ResponseInit {
  const headers = new Headers(init?.headers || {});
  headers.set('X-RateLimit-Remaining', String(opts.remaining));
  headers.set('X-RateLimit-Limit', String(opts.limit));
  headers.set('X-RateLimit-Reset', String(Math.ceil(opts.resetMs / 1000))); // seconds
  return { ...init, headers };
}

// Client-side Rate Limiter
export class ClientRateLimiter {
  static checkLimit(): boolean {
    try {
      const now = Date.now();
      const raw = localStorage.getItem('aicoach_requests') || '[]';
      const requests = JSON.parse(raw);

      // Remove old requests outside the window
      const validRequests = requests.filter(
        (timestamp: number) => now - timestamp < STORAGE_WINDOW_MS
      );

      if (validRequests.length >= MAX_REQUESTS) {
        return false; // Rate limit exceeded
      }

      // Add current request
      validRequests.push(now);
      localStorage.setItem('aicoach_requests', JSON.stringify(validRequests));

      return true;
    } catch {
      // If storage is unavailable or JSON parsing fails, fail open to avoid blocking UX
      return true;
    }
  }

  static getRemainingRequests(): number {
    try {
      const now = Date.now();
      const raw = localStorage.getItem('aicoach_requests') || '[]';
      const requests = JSON.parse(raw);
      const validRequests = requests.filter(
        (timestamp: number) => now - timestamp < STORAGE_WINDOW_MS
      );
      return Math.max(0, MAX_REQUESTS - validRequests.length);
    } catch {
      // If storage unavailable, return full allowance
      return MAX_REQUESTS;
    }
  }
}
