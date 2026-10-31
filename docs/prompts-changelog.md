# Prompt changelog

The version is `PROMPT_VERSION` in `src/server/ai/prompts.ts`. It is logged with every AI call and is part of the cache key.

## 2026-10-31.2

- **Draft:** asks for 5–10 vendor needs, 8–15 tasks, 8–12 ideas and 4–8 run-sheet slots. Live answers had been returning as few as 4 tasks.
- **Rules** (in code, not the prompt): required categories reduced to the true minimum (wedding: venue and catering; birthday: catering; community: misc). Cloud Logging showed a home birthday correctly given no venue budget being rejected.
- **Contracts:** list minimums lowered (ideas 4, tasks 3, needs 2, run sheet 2), and lists or text longer than their maximum are trimmed instead of failing the whole answer.

## 2026-10-31.1

- First versions of the draft, adjust and extract prompts.
- **Extract:** asks for `validUntil` as YYYY-MM-DD only when the quote gives a full date. The model had been returning phrases such as "30 November".
- **Schema:** numeric and length bounds are removed from the copy sent to Vertex AI, which rejects them with HTTP 400. Zod still enforces every bound on the answer.
