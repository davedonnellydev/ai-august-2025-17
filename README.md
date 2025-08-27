# Project 17 #AIAugustAppADay: AI Interview Coach

![Last Commit](https://img.shields.io/github/last-commit/davedonnellydev/ai-august-2025-17)

**📆 Date**: 27/Aug/2025  
**🎯 Project Objective**: User answers typical interview Qs, AI provides feedback.  
**🚀 Features**: “Start Practice” button: App asks a random or chosen interview question; User types (or optionally records) their answer; AI analyzes the answer and gives tailored feedback, including strengths, improvement tips, and example responses; Option to “try again” or get a new question; Track progress or history (bonus)  
**🛠️ Tech used**: Next.js, TypeScript, OpenAI Speech to Text & Responses APIs  
**▶️ Live Demo**: [https://dave-donnelly-ai-august-17.netlify.app/](https://dave-donnelly-ai-august-17.netlify.app/)

## 🗒️ Summary

This app was an **AI-powered interview coach**. The idea: you input the job title you’re preparing for, the type of interview, the seniority of the role, and any extra notes — and the AI generates a set of interview questions tailored to you. You can then answer them, and the AI provides feedback on your responses.

The feature I most wanted to experiment with was **live transcription**, but that was the one thing I didn’t get to. Interestingly, this wasn’t a failure of time management so much as good planning: I started the day by asking AI to review the project objectives, sketch out an architecture, and then generate a realistic one-day build plan. That plan flagged transcription as a time sink that would push the project well beyond a single day. So instead of forcing it, I built the API route and put it behind a feature toggle, saving the UI and testing for later.

The result was a day where I hit nearly all of my goals, wrapped up on time, and still have a solid foundation to return to when I’m ready to implement transcription. It was a reminder that **properly scoping a project is just as valuable as building it**.

**Lessons learned**

- Get AI to help scope and plan before you build — it can highlight features that are too ambitious for the time frame.
- Feature toggles are a great way to prep for future work without blocking delivery.
- Scoping realistically allows you to finish on time without overworking, while still leaving the door open for iteration.

**Final thoughts**  
I’m happy with where this landed. As I anticipate the need for interview practice myself, I know this is an app I’ll come back to — and it’s in good shape for me to pick up again when I do.

This project has been built as part of my AI August App-A-Day Challenge. You can read more information on the full project here: [https://github.com/davedonnellydev/ai-august-2025-challenge](https://github.com/davedonnellydev/ai-august-2025-challenge).

## 🧪 Testing

![CI](https://github.com/davedonnellydev/ai-august-2025-17/actions/workflows/npm_test.yml/badge.svg)  
_Note: Test suite runs automatically with each push/merge._

## Quick Start

1. **Clone and install:**

   ```bash
   git clone https://github.com/davedonnellydev/ai-august-2025-17.git
   cd ai-august-2025-17
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Start development:**

   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# OpenAI API (for AI features)
OPENAI_API_KEY=your_openai_api_key_here

```

### Key Configuration Files

- `next.config.mjs` – Next.js config with bundle analyzer
- `tsconfig.json` – TypeScript config with path aliases (`@/*`)
- `theme.ts` – Mantine theme customization
- `eslint.config.mjs` – ESLint rules (Mantine + TS)
- `jest.config.cjs` – Jest testing config
- `.nvmrc` – Node.js version

### Path Aliases

```ts
import { Component } from '@/components/Component'; // instead of '../../../components/Component'
```

## 📦 Available Scripts

### Build and dev scripts

- `npm run dev` – start dev server
- `npm run build` – bundle application for production
- `npm run analyze` – analyze production bundle

### Testing scripts

- `npm run typecheck` – checks TypeScript types
- `npm run lint` – runs ESLint
- `npm run jest` – runs jest tests
- `npm run jest:watch` – starts jest watch
- `npm test` – runs `prettier:check`, `lint`, `typecheck` and `jest`

### Other scripts

- `npm run prettier:check` – checks files with Prettier
- `npm run prettier:write` – formats files with Prettier

## 📜 License

![GitHub License](https://img.shields.io/github/license/davedonnellydev/ai-august-2025-17)  
This project is licensed under the MIT License.
