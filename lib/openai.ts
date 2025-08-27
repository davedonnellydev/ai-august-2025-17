import OpenAI from 'openai';
import { z } from 'zod';
import type { Feedback, JobConfig, Question, Difficulty } from './types';

// Schema definitions ensure strict JSON from the model
const RawQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().min(1),
  category: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
});

const RawQuestionsSchema = z.array(RawQuestionSchema).min(1);

const FeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(3),
  improvements: z.array(z.string()).max(3),
  tips: z.array(z.string()).max(3),
  exampleAnswer: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
});

type JsonSchema<T> = z.ZodType<T>;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

async function jsonOnly<T>(
  call: () => Promise<string>,
  schema: JsonSchema<T>,
  retryCount: number = 1
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const jsonText = await call();
      const parsed = JSON.parse(jsonText);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data as T;
      }
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Failed to parse model JSON: ${String(lastError)}`);
}

function buildQuestionPrompt(job: JobConfig): string {
  const extras = job.extras ? ` Extra context: ${job.extras}` : '';
  return [
    'You are an expert interview coach. Be concise, specific, and actionable.',
    'Return JSON only that matches the provided schema.',
    `Role: ${job.role}. Interview type: ${job.interviewType}. Seniority: ${job.seniority ?? 'unspecified'}.${extras}`,
    'Generate 5–10 concise, varied questions (≤200 chars each).',
  ].join('\n');
}

function buildAssessmentPrompt(args: {
  job: JobConfig;
  question: Question;
  answerText?: string;
  transcript?: string;
}): string {
  const { job, question, answerText, transcript } = args;
  const answer = transcript || answerText || '';
  return [
    'You are an expert interview coach. Be concise, specific, and actionable.',
    'Return JSON only that matches the provided schema.',
    `Role: ${job.role}. Interview type: ${job.interviewType}. Seniority: ${job.seniority ?? 'unspecified'}.`,
    `Question: ${question.text}`,
    `Answer: ${answer}`,
    'Provide summary, up to 3 strengths, up to 3 improvements (start with a verb), up to 3 tips, a concise example answer (≤160 words, STAR for behavioral), and an integer score 0–100.',
  ].join('\n');
}

export async function generateQuestions(job: JobConfig): Promise<Question[]> {
  const client = getClient();
  const prompt = buildQuestionPrompt(job);
  const raw = await jsonOnly(
    async () => {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: prompt,
        max_output_tokens: Number(
          process.env.QUESTIONS_MAX_OUTPUT_TOKENS || 800
        ),
      });
      const text = response.output_text || '';
      return text;
    },
    RawQuestionsSchema,
    1
  );

  // Post-process: ensure ids, clamp length, dedupe
  const seen = new Set<string>();
  const processed: Question[] = [];
  for (const q of raw) {
    const text = q.text.trim().slice(0, 200);
    if (text.length === 0) {
      continue;
    }
    if (seen.has(text.toLowerCase())) {
      continue;
    }
    seen.add(text.toLowerCase());
    const difficulty: Difficulty | undefined =
      q.difficulty === 1 || q.difficulty === 2 || q.difficulty === 3
        ? (q.difficulty as Difficulty)
        : undefined;

    processed.push({
      id:
        q.id && q.id.length > 0
          ? q.id
          : typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
      text,
      category: q.category,
      difficulty,
    });
  }
  return processed;
}

export async function assessAnswer(args: {
  job: JobConfig;
  question: Question;
  answerText?: string;
  transcript?: string;
}): Promise<Feedback> {
  const client = getClient();
  const prompt = buildAssessmentPrompt(args);
  return jsonOnly(
    async () => {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: prompt,
        max_output_tokens: Number(
          process.env.FEEDBACK_MAX_OUTPUT_TOKENS || 800
        ),
      });
      const text = response.output_text || '';
      return text;
    },
    FeedbackSchema,
    1
  );
}

export const Schemas = {
  RawQuestion: RawQuestionSchema,
  RawQuestions: RawQuestionsSchema,
  Feedback: FeedbackSchema,
};
