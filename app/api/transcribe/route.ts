import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  AUDIO_ENABLED,
  TRANSCRIBE_MODEL,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MAX_REQUESTS,
  STORAGE_WINDOW_MS,
} from '@/app/config/constants';
import {
  ServerRateLimiter,
  withRateLimitHeaders,
} from '@/lib/utils/api-helpers';

export async function POST(request: NextRequest) {
  try {
    if (!AUDIO_ENABLED) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!ServerRateLimiter.checkLimit(ip)) {
      const remaining = ServerRateLimiter.getRemaining(ip);
      const init = withRateLimitHeaders(
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(STORAGE_WINDOW_MS / 1000)),
          },
        },
        {
          remaining,
          limit: MAX_REQUESTS,
          resetMs: STORAGE_WINDOW_MS,
        }
      );
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        init
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const durationMsRaw = formData.get('durationMs');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing audio file in form field "file"' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Empty audio file' }, { status: 400 });
    }
    if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: `Audio too large. Max ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}MB`,
        },
        { status: 400 }
      );
    }

    const durationMs = durationMsRaw ? Number(durationMsRaw) : undefined;
    if (durationMs && durationMs > MAX_AUDIO_DURATION_MS) {
      return NextResponse.json(
        {
          error: `Audio too long. Max ${Math.floor(MAX_AUDIO_DURATION_MS / 1000)}s`,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Transcription temporarily unavailable' },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Build a File object for the SDK if needed (Node/Edge supports Web File)
    const inputFile = new File([arrayBuffer], file.name || 'audio.webm', {
      type: file.type || 'audio/webm',
    });

    const transcript = await client.audio.transcriptions.create({
      model: TRANSCRIBE_MODEL,
      file: inputFile,
      // temperature defaults; keep concise
    });

    const remaining = ServerRateLimiter.getRemaining(ip);
    const init = withRateLimitHeaders(undefined, {
      remaining,
      limit: MAX_REQUESTS,
      resetMs: STORAGE_WINDOW_MS,
    });

    return NextResponse.json(
      { transcript: transcript.text, remainingRequests: remaining },
      init
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to transcribe audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
