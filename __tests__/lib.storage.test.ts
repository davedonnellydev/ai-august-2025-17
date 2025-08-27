import {
  loadSessions,
  saveSession,
  getLastSessionId,
  setLastSessionId,
  removeSession,
  getStorageMode,
  isMemoryFallback,
} from '@/lib/storage';
import type { Session } from '@/lib/types';

function makeSession(id: string): Session {
  return {
    id,
    job: { role: 'Test', interviewType: 'screening' },
    createdAt: new Date().toISOString(),
    questions: [],
    attempts: [],
  };
}

describe('lib/storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loadSessions returns [] when empty', () => {
    expect(loadSessions()).toEqual([]);
  });

  test('saveSession adds and updates sessions', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    saveSession(a);
    saveSession(b);
    let list = loadSessions();
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);

    const a2 = { ...a, questions: [{ id: 'q', text: 'Q' }] } as Session;
    saveSession(a2);
    list = loadSessions();
    expect(list[1].questions.length).toBe(1);
  });

  test('last session id set/get and removeSession behavior', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    saveSession(a);
    saveSession(b);
    setLastSessionId('a');
    expect(getLastSessionId()).toBe('a');
    removeSession('a');
    // After removing last, it should point to newest remaining (b)
    expect(getLastSessionId()).toBe('b');
    removeSession('b');
    expect(getLastSessionId()).toBe('');
  });

  test('storage mode reports localStorage in jsdom', () => {
    expect(getStorageMode()).toBe('localStorage');
    expect(isMemoryFallback()).toBe(false);
  });
});
