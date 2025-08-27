// Shared domain types for the AI Interview Coach app.
// Keep this file minimal and dependency-free; only TypeScript types/interfaces.

export type InterviewType =
  | 'screening'
  | 'behavioral'
  | 'technical'
  | 'system_design'
  | 'case'
  | 'other';

export interface JobConfig {
  role: string; // e.g., "Frontend Engineer"
  interviewType: InterviewType;
  seniority?: 'intern' | 'junior' | 'mid' | 'senior' | 'lead';
  extras?: string; // optional context supplied by the user
}

export type Difficulty = 1 | 2 | 3; // 1 easy

export interface Question {
  id: string; // uuid
  text: string;
  category?: string; // e.g., "STAR", "algorithms", "product sense"
  difficulty?: Difficulty;
}

export interface Feedback {
  summary: string; // 1–2 sentence overview
  strengths: string[];
  improvements: string[]; // actionable
  tips: string[]; // short, tactical
  exampleAnswer: string; // compact model answer
  score?: number; // 0–100 for quick progress feel
}

export interface Attempt {
  id: string; // uuid
  questionId: string;
  startedAt: string; // ISO
  endedAt?: string;
  answerText?: string;
  audioUrl?: string; // blob URL if recorded
  transcript?: string; // if audio transcribed
  feedback?: Feedback;
}

export interface Session {
  id: string; // uuid
  job: JobConfig;
  createdAt: string;
  questions: Question[];
  attempts: Attempt[]; // many attempts per question
}
