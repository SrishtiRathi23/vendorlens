# VendorLens architecture

## Request path

```text
visitor ──► Firebase Hosting (vendorlens-promptwars.web.app: CDN + TLS)
               │  rewrite "**"
               ▼
            Cloud Run service "vendorlens" (asia-south1, Next.js standalone, non-root)
               ├── pages (server-rendered shell; the plan itself lives in the visitor's IndexedDB)
               ├── GET  /api/health
               └── POST /api/ai/draft · /api/ai/adjust · /api/ai/extract     ← later phases
                        └── Gemini on Vertex AI, authenticated as the service's own identity
```

The browser holds all user data: events, requirements, pasted quotes, confirmed fields and decisions. The server is stateless. It renders pages and forwards explicit AI requests (Generate, Adjust, Extract) after validating them.

## Source layout

| Folder                              | Contents                                                                                                                       | Allowed dependencies                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `src/domain`                        | Money in paise, allocation, quote normalisation, evidence matching, comparison status, payment schedules. Pure functions only. | other `src/domain` modules and `zod`        |
| `src/server`                        | Configuration, health, and later the Gemini client, prompts, rules, rate limits and caching                                    | `src/domain`, `server-only`, the Gemini SDK |
| `src/features`, `src/ui`, `src/lib` | Screens, shared components, IndexedDB access                                                                                   | `src/domain`; **never** `src/server`        |
| `src/app`                           | Routes. Thin files that delegate.                                                                                              | anything                                    |

`eslint.config.mjs` enforces the dependency column, so a violation fails CI.

## Configuration and identity

- `readConfig()` (`src/server/http/env.ts`) is called per request. It's cheap, and there's no cached snapshot to reset in tests. Errors name variables, never values.
- **Runtime identity:** a dedicated Cloud Run service account with only `roles/aiplatform.user`. **Build identity:** a separate service account with only `roles/run.builder`.
- No API key is needed for Gemini. A Developer-API key path exists for accounts without Vertex billing and would be injected from Secret Manager.

## Limits that are stated honestly

Cloud Run runs with min 0 and max 1 instance, so the in-memory rate limits and caches added later apply to that single instance. Abuse protection across instances or regions would need a shared store, which is out of scope.
