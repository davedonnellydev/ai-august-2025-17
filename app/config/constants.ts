export const MODEL: string =
  process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4.1-mini';
export const MAX_REQUESTS: number = 15;
export const STORAGE_WINDOW_MS: number = 60 * 60 * 1000; // 60 minutes

// Feature flags
export const AUDIO_ENABLED: boolean =
  process.env.NEXT_PUBLIC_AUDIO_ENABLED === 'true';

// Token caps for Responses API
export const QUESTIONS_MAX_OUTPUT_TOKENS: number = Number(
  process.env.NEXT_PUBLIC_QUESTIONS_MAX_OUTPUT_TOKENS || 800
);
export const FEEDBACK_MAX_OUTPUT_TOKENS: number = Number(
  process.env.NEXT_PUBLIC_FEEDBACK_MAX_OUTPUT_TOKENS || 800
);

// Audio transcription defaults
export const TRANSCRIBE_MODEL: string =
  process.env.NEXT_PUBLIC_TRANSCRIBE_MODEL || 'whisper-1';
export const MAX_AUDIO_BYTES: number = Number(
  process.env.NEXT_PUBLIC_MAX_AUDIO_BYTES || 10 * 1024 * 1024
);
export const MAX_AUDIO_DURATION_MS: number = Number(
  process.env.NEXT_PUBLIC_MAX_AUDIO_DURATION_MS || 5 * 60 * 1000
);
