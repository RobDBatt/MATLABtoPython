<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Quick commands for this app

| Task | Command |
|---|---|
| Run all tests | `npx vitest run` |
| Run tests related to a single file | `npx vitest related <file> --run` |
| Inspect a single file end-to-end | `npm run drill -- <path/to/file.m>` |
| Full corpus run (slow) | `npm run corpus` |
| Corpus diff against last baseline | `npm run corpus:diff` |
| Detailed corpus inspection | `npm run inspect` |
| Type-check | `npx tsc --noEmit` |
| Local dev | `npm run dev` |

For *why* and *how* to use these in a debug loop, read `~/.claude/skills/converter-debug/SKILL.md`. The parent project's CLAUDE.md (`../CLAUDE.md`) and skills under `../skills/` cover product decisions, design system, pricing, and SEO pipeline.
