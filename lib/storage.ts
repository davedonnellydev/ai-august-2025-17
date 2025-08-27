// localStorage helpers with graceful fallback to in-memory storage.
// Keep sync API for simplicity; client-only usage is expected.

import type { Session } from './types';

const SESSIONS_KEY = 'aicoach.sessions';
const LAST_SESSION_ID_KEY = 'aicoach.lastSessionId';

// In-memory fallback store. Used when localStorage is unavailable (SSR or disabled).
const memoryStore: Record<string, string> = {};

function isLocalStorageAvailable(): boolean {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return false;
    }
    const testKey = '__aicoach_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // fall through to memory store
    }
  }
  return Object.hasOwn(memoryStore, key) ? memoryStore[key] : null;
}

function setItem(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // fall through to memory store
    }
  }
  memoryStore[key] = value;
}

export function loadSessions(): Session[] {
  try {
    const raw = getItem(SESSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Normalize to avoid runtime errors from older/corrupted entries
    return parsed.map((s: any) => {
      const safeQuestions = Array.isArray(s?.questions) ? s.questions : [];
      const safeAttempts = Array.isArray(s?.attempts) ? s.attempts : [];
      return {
        ...s,
        questions: safeQuestions,
        attempts: safeAttempts,
      } as Session;
    });
  } catch {
    return [];
  }
}

export function saveSession(session: Session): void {
  const all = loadSessions();
  const index = all.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    all[index] = session;
  } else {
    all.unshift(session);
  }
  setItem(SESSIONS_KEY, JSON.stringify(all));
}

export function setLastSessionId(sessionId: string): void {
  setItem(LAST_SESSION_ID_KEY, sessionId);
}

export function getLastSessionId(): string | null {
  try {
    return getItem(LAST_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function removeSession(sessionId: string): void {
  const all = loadSessions();
  const filtered = all.filter((s) => s.id !== sessionId);
  setItem(SESSIONS_KEY, JSON.stringify(filtered));
  const last = getLastSessionId();
  if (last === sessionId) {
    const nextId = filtered.length > 0 ? filtered[0].id : '';
    setItem(LAST_SESSION_ID_KEY, nextId);
  }
}
