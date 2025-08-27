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

  static checkLimit(ip: string): boolean {
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(ip, {
        count: 1,
        resetTime: now + STORAGE_WINDOW_MS,
      });
      return true;
    }

    if (entry.count >= MAX_REQUESTS) {
      return false; // Rate limit exceeded
    }

    // Increment count
    entry.count++;
    return true;
  }

  static getRemaining(ip: string): number {
    const entry = this.store.get(ip);
    if (!entry || Date.now() > entry.resetTime) {
      return MAX_REQUESTS;
    }
    return Math.max(0, MAX_REQUESTS - entry.count);
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

// Clean up every 5 minutes
setInterval(() => ServerRateLimiter.cleanup(), 5 * 60 * 1000);

// Client-side Rate Limiter
export class ClientRateLimiter {
  static checkLimit(): boolean {
    const now = Date.now();
    const requests = JSON.parse(
      localStorage.getItem('translation_requests') || '[]'
    );

    // Remove old requests outside the window
    const validRequests = requests.filter(
      (timestamp: number) => now - timestamp < STORAGE_WINDOW_MS
    );

    if (validRequests.length >= MAX_REQUESTS) {
      return false; // Rate limit exceeded
    }

    // Add current request
    validRequests.push(now);
    localStorage.setItem('translation_requests', JSON.stringify(validRequests));

    return true;
  }

  static getRemainingRequests(): number {
    const now = Date.now();
    const requests = JSON.parse(
      localStorage.getItem('translation_requests') || '[]'
    );
    const validRequests = requests.filter(
      (timestamp: number) => now - timestamp < STORAGE_WINDOW_MS
    );

    return Math.max(0, MAX_REQUESTS - validRequests.length);
  }
}
