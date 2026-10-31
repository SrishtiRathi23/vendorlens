# VendorLens

_Know what you're paying for._

VendorLens helps you plan a wedding, a birthday or a community event, and then choose vendors without being surprised by the bill. Gemini drafts the event plan and reads pasted vendor quotes. You confirm what it found. Tested code does every calculation and refuses to call a quote "cheapest" while one of its required costs is still unknown.

Built for PromptWars Virtual, Challenge 5: Celebration & Event Planner.

**Live:** https://vendorlens-promptwars.web.app (Firebase Hosting in front of Cloud Run). Direct service URL: https://vendorlens-598370845591.asia-south1.run.app

> **Where the build is: Phase 0 (deployable skeleton).** The planner, quote intake and comparison come in the next phases. This file lists only what exists and will grow into the full feature and evidence guide before submission.

## In the repository now

- **`/api/health`.** Cloud Run's readiness probe. It returns `{ ok, buildVersion, aiEnabled, provider }` and never includes a model name, project, origin or key (`src/server/health.ts`).
- **Typed configuration.** `src/server/http/env.ts` validates every variable. AI is off unless switched on, keyless Gemini on Vertex AI is the default provider, and the recorded-response provider used by tests is refused in production.
- **Landing page.** Static, single-H1, keyboard skip link, reduced-motion rule, Merchant's Desk palette with measured contrast (`src/app/globals.css`).
- **Guard rails.** Type-aware ESLint with import boundaries (`src/domain` can't import frameworks, I/O or app code, and browser code can't import `src/server`), knip for dead code, Prettier, and a coverage gate.
- **Delivery.** An Alpine multi-stage Dockerfile running as an unprivileged user, a Firebase Hosting front door that rewrites to the Cloud Run service (`firebase.json`), and a GitHub Actions workflow with pinned action SHAs (`.github/workflows/quality-gates.yml`).

## Running it

Node.js 22.12+.

```bash
npm ci
npm run dev
```

| Command                                      | Purpose                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run verify`                             | ESLint (type-aware), TypeScript, knip, Prettier, Vitest with coverage thresholds        |
| `npm run build` → `npm start`                | Production standalone server, the same entry point as the container                     |
| `npm run e2e`                                | Playwright with axe on a 1440 px desktop and a phone, plus layout checks at 320–1440 px |
| `npm run secrets` / `npm run secrets:bundle` | Credential-pattern scan of committed files or of the built client bundle                |

All configuration is described in [.env.example](.env.example).

## Design notes

- [Architecture](docs/ARCHITECTURE.md)
- [ADR 001: everything stays in the browser](docs/adr/001-local-first.md)
- [ADR 002: the AI reads, the code computes](docs/adr/002-ai-reads-code-computes.md)
- [ADR 003: Gemini without an API key](docs/adr/003-keyless-vertex.md)
- [Build journal](docs/IMPLEMENTATION_LOG.md) · [Evidence checklist](docs/QA_EVIDENCE.md)

## License

[MIT](LICENSE)
