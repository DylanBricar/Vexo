# Project Instructions

## Stack

- Next.js 16 App Router, React 19 and TypeScript strict mode
- Tailwind CSS 4 and Base UI primitives
- Neon PostgreSQL with tagged-template parameterized queries
- Vitest for unit/integration tests and Playwright for browser tests
- Node.js 24 and an npm version supported by the deployment platform

## Structure

- `src/components/chat/`: user-facing chat UI
- `src/hooks/useChat.ts`: client orchestration and optimistic state
- `src/app/api/`: authenticated route handlers and SSE
- `src/lib/db.ts`: schema initialization and database access
- `src/lib/crypto.ts`: encryption and signed session tokens
- `src/lib/session.ts`: HttpOnly cookie authentication and origin checks

## Conventions

- Keep user input validation at API boundaries.
- Use parameterized Neon tagged templates for every SQL query.
- Never expose session tokens to client JavaScript or query strings.
- Preserve optimistic sends and non-overlapping SSE polling.
- Format message timestamps through `src/lib/message-format.ts`.
- Keep mobile controls at least 24 by 24 CSS pixels and retain browser zoom.
- Do not add inline styles without updating the strict CSP design.
- Do not silently change the ephemeral deletion behavior.

## Verification

Run before committing:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm audit
```

Use conventional commits. Pushes to `main` trigger the production Vercel deployment.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
