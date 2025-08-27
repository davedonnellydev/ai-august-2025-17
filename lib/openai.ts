import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { Feedback, JobConfig, Question, QuestionSet } from './types';

// Schema definitions ensure match for Types
export const DifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const QuestionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  category: z.string().optional().nullable(),
  difficulty: DifficultySchema.optional().nullable(),
});

const QuestionsSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
});

export const FeedbackSchema = z
  .object({
    summary: z.string(), // 1–2 sentence overview
    strengths: z.array(z.string()).max(3),
    improvements: z.array(z.string()).max(3), // actionable
    tips: z.array(z.string()).max(3), // short, tactical
    exampleAnswer: z.string().min(1), // compact model answer
    score: z.number().int().min(0).max(100).optional().nullable(), // 0–100
  })
  .strict();

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

const questionInstructions: string = `You are an expert interview coach. Be concise, specific, and actionable. Return JSON only that matches the provided schema. Generate 5-10 concise, varied questions (≤200 chars each).`;

const assessmentInstructions: string = `You are an expert interview coach. Be concise, specific, and actionable. Return JSON only that matches the provided schema. Provide summary, up to 3 strengths, up to 3 improvements (start with a verb), up to 3 tips, a concise example answer (≤160 words, STAR for behavioral), and an integer score 0-100.`;

function buildQuestionPrompt(job: JobConfig): string {
  const extras = job.extras ? ` Extra context: ${job.extras}` : '';
  return `Role: ${job.role}. Interview type: ${job.interviewType}. Seniority: ${job.seniority ?? 'unspecified'}.${extras}`;
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
    `Role: ${job.role}. Interview type: ${job.interviewType}. Seniority: ${job.seniority ?? 'unspecified'}.`,
    `Question: ${question.text}`,
    `Answer: ${answer}`,
  ].join('\n');
}

export async function generateQuestions(
  job: JobConfig
): Promise<QuestionSet | null> {
  const client = getClient();
  const prompt = buildQuestionPrompt(job);
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: questionInstructions,
    input: prompt,
    max_output_tokens: Number(process.env.QUESTIONS_MAX_OUTPUT_TOKENS || 800),
    text: {
      format: zodTextFormat(QuestionsSchema, 'questions'),
    },
  });
  const result = response.output_parsed;
  return result;
}

export async function assessAnswer(args: {
  job: JobConfig;
  question: Question;
  answerText?: string;
  transcript?: string;
}): Promise<Feedback | null> {
  const client = getClient();
  const prompt = buildAssessmentPrompt(args);
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: assessmentInstructions,
    input: prompt,
    max_output_tokens: Number(process.env.FEEDBACK_MAX_OUTPUT_TOKENS || 800),
    text: {
      format: zodTextFormat(FeedbackSchema, 'feedback'),
    },
  });
  return response.output_parsed;
}

export const Schemas = {
  RawQuestion: QuestionSchema,
  RawQuestions: QuestionsSchema,
  Feedback: FeedbackSchema,
};
