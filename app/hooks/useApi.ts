import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiCache,
  generateCacheKey,
  retryRequest,
} from '../lib/utils/api-helpers';

interface UseApiOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  dependencies?: any[];
  enabled?: boolean;
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
  retryDelay?: number;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  mutate: (newData: T) => void;
}

export function useApi<T>({
  endpoint,
  method = 'GET',
  body,
  headers,
  dependencies = [],
  enabled = true,
  cache = true,
  cacheTTL = 300000, // 5 minutes
  retries = 3,
  retryDelay = 1000,
}: UseApiOptions): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (cache && method === 'GET') {
        const cacheKey = generateCacheKey(endpoint, body);
        const cachedData = apiCache.get(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      const requestFn = async () => {
        const response = await fetch(`/api/proxy/${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      };

      const result = await retryRequest(requestFn, retries, retryDelay);

      // Cache the result if enabled
      if (cache && method === 'GET') {
        const cacheKey = generateCacheKey(endpoint, body);
        apiCache.set(cacheKey, result, cacheTTL);
      }

      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't set error
        return;
      }

      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    endpoint,
    method,
    body,
    headers,
    enabled,
    cache,
    cacheTTL,
    retries,
    retryDelay,
  ]);

  const mutate = useCallback(
    (newData: T) => {
      setData(newData);

      // Update cache if enabled
      if (cache && method === 'GET') {
        const cacheKey = generateCacheKey(endpoint, body);
        apiCache.set(cacheKey, newData, cacheTTL);
      }
    },
    [endpoint, method, body, cache, cacheTTL]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    mutate,
  };
}
