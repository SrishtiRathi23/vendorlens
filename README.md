# VendorLens

_Know what you're paying for._

**Live app:** https://vendorlens-promptwars.web.app (Firebase Hosting in front of Cloud Run) · direct service: https://vendorlens-598370845591.asia-south1.run.app

VendorLens is a GenAI planning assistant for **weddings, birthdays and community events**, built for PromptWars Virtual Challenge 5 (Celebration & Event Planner). Describe your celebration and Gemini drafts a budget, a dated timeline, a vendor checklist, ideas and a day-of run sheet. Then paste the quotes vendors send you: Gemini reads them, you confirm what it found, and tested code compares them on what they really cost. It refuses to call a quote "cheapest" while a required cost is still unknown.

## Try it in 30 seconds

1. Open the live app and press **Sample wedding**. It opens on **Compare**: two fictional catering quotes for 150 guests. Shubh Rasoi looks cheaper at ₹850 a plate, but its tax, service staff and transport are unknown, so VendorLens shows a _known subtotal_ and says **"No winner yet"**, with the exact questions to send.
2. Choose **Annapurna Feasts**. Its known total (₹1,54,350 = 150 × ₹980 + 5% GST) becomes the committed catering amount, and its 50/30/20 payment terms become dated tasks on **Timeline**.
3. In **Adjust with AI**, type "We now expect 180 guests and want a DJ for the reception". Review the before/after preview, apply it, then **Undo**.
4. Or press **Plan my event** to create your own plan with Gemini, and paste a real quote on **Vendors** (sample quote text is one click away).

## The brief, feature by feature

| Challenge 5 asks for                                                           | VendorLens                                                                                                                                                                                                                                    | Where                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A GenAI planning assistant that turns an idea into an actionable plan          | Gemini drafts the plan as schema-checked JSON (category weights, vendor needs with coverage tags and questions, tasks with lead times and dependencies, ideas, run sheet). Code turns weights into exact rupees and lead times into IST dates | `src/server/ai/tasks.ts`, `src/domain/plan-build.ts`                         |
| Refine results through follow-up prompts                                       | **Adjust with AI**: one instruction becomes typed operations, previewed as a before/after diff with budget impact, then applied or discarded. Undo up to 10 steps                                                                             | `src/features/adjust/`, `src/domain/adjust.ts`                               |
| Budget: total, categories, planned vs budget, estimates labelled               | The 8 brief categories plus contingency. Allocated → committed (chosen quote) → paid, with remaining or over-budget. Every amount shows its source (AI estimate, your figure, chosen quote, sample). Lock a line to keep AI away from it      | `src/domain/budget.ts`, `src/features/budget/`                               |
| Timeline: dates, deadlines, reminders, completion, priority, countdown, day-of | Overdue, due-this-week and later lists, priorities, "do now" when a date has passed, countdown, booking deadlines, payment milestones, day-of run sheet, Google Calendar links and an `.ics` download                                         | `src/domain/timeline.ts`, `src/domain/calendar.ts`, `src/features/timeline/` |
| Vendor checklist: add vendors, contacts, quotes, pending/confirmed             | Vendor needs per category with why, questions and book-by date; status from not contacted to booking confirmed; contacts and notes kept in this browser only; Google Maps search links; quote intake by paste or manual entry                 | `src/features/vendors/`                                                      |
| Personalised ideas (themes, decor, menu, diet, culture)                        | Ideas tied to type, guests, budget, culture and declared dietary needs (checked in code), always with an accessibility and a sustainability idea; pin, remove, "More ideas like these"                                                        | `src/features/ideas/`, `src/server/ai/tasks.ts`                              |
| Editable, saved, come back later                                               | Everything is editable; autosaved to IndexedDB; versioned JSON backup and import; print stylesheet                                                                                                                                            | `src/lib/local-db/`                                                          |
| Handle errors and unusable AI answers                                          | Zod plus rule checks, one targeted repair, a second model, then a labelled template plan or manual quote entry. Typed error codes with plain messages                                                                                         | `src/server/ai/pipeline.ts`                                                  |

## How the AI is used, and where it is not

| Call                   | Gemini does                                                                            | Code does                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/ai/draft`   | Decides what the event needs and suggests ideas                                        | Allocates the budget to the paisa (largest remainder), schedules dates in IST respecting dependencies, enforces required categories and the diet rule                                                             |
| `POST /api/ai/adjust`  | Interprets a change request into operations that refer to items by short refs (R1, T1) | Drops operations on chosen vendors or locked amounts, removals of required needs, out-of-scope or invented refs, and says why                                                                                     |
| `POST /api/ai/extract` | Reads a quote into candidate fields, **quoting the exact words** for each              | Checks every excerpt is really in the pasted text **and** that every number the model reported is written in that excerpt; anything else becomes _not found_ and unknown. You confirm the quote before it is used |

The model never sums, taxes or ranks. Its schemas contain no totals, no "confirmed" labels and no fields for business names, URLs or contacts. Model: `gemini-3.5-flash-lite` on Vertex AI, with `gemini-3.1-flash-lite` as fallback, both configurable. Prompts are versioned in `src/server/ai/prompts.ts`; see [docs/prompts-changelog.md](docs/prompts-changelog.md).

## Architecture

```text
browser ── IndexedDB (your plan, quotes, contacts: never sent to the server)
   │
   ▼
Firebase Hosting (vendorlens-promptwars.web.app, CDN + TLS) ── rewrite ** ──► Cloud Run "vendorlens" (asia-south1)
                                                                    ├── proxy.ts: per-request CSP nonce + security headers
                                                                    ├── pages (Next.js 16, React 19)
                                                                    └── /api/ai/{draft,adjust,extract}
                                                                          origin check → rate limit → size limit → Zod
                                                                          → cache / in-flight dedupe → Gemini (Vertex AI,
                                                                          service account, no key) → Zod → rules → repair
```

`src/domain` is pure TypeScript (no React, Next.js, network or storage; a lint rule enforces it), and browser code can't import `src/server`. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the ADRs.

## Google services

| Service                                                    | Used for                                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Gemini on Vertex AI** (`@google/genai`, enterprise mode) | Plan drafts, adjustments and quote extraction with JSON response schemas                                               |
| **Cloud Run**                                              | The Next.js server, running as a dedicated service account that holds only `roles/aiplatform.user` (no API key exists) |
| **Firebase Hosting**                                       | Public front door, CDN and TLS, rewriting every request to Cloud Run                                                   |
| **Cloud Build and Artifact Registry**                      | Building the container from source, as a separate account holding only `roles/run.builder`                             |
| **Cloud Logging**                                          | One JSON line per AI call: task, model, latency, tokens, failed rule ids. Never user or model text                     |
| **Google Calendar** and **Google Maps** links              | "Add to calendar" for every task and deadline; a Maps search for real vendors nearby (no keys, no account access)      |

## The six evaluation areas, with evidence

| Area                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code quality**      | Strict TypeScript; `strictTypeChecked` ESLint with zero warnings; import boundaries enforced by lint; knip finds no dead code; Prettier; small modules with doc comments; three ADRs                                                                                                                                                                                                                    |
| **Security**          | Keyless Vertex AI; same-origin check; 10 per minute and 60 per day per client, 600 per day overall; body-size limits; Zod on every request and answer; nonce-based CSP, `frame-ancestors 'none'` and other headers; contact details redacted before any prompt; output scrubbed of links and contacts; prompt-injection tests; gitleaks and bundle secret scans in CI. See [SECURITY](docs/SECURITY.md) |
| **Efficiency**        | Gemini only on explicit buttons (E2E asserts zero AI calls while comparing and choosing); response cache and in-flight de-duplication (a repeat draft took 0.46 s live); all arithmetic local; min 0 instances                                                                                                                                                                                          |
| **Testing**           | **123 unit, property and contract tests** (98.5% lines, 89.9% branches on `src/domain` and `src/server`, with CI gates) and **40 Playwright journeys** with axe on desktop and phone. See [TESTING](docs/TESTING.md)                                                                                                                                                                                    |
| **Accessibility**     | 0 serious or critical axe findings on all 8 routes at both sizes; keyboard skip link; native dialogs with focus return; labelled fields with error summaries; status as text, never colour alone; 44 px targets; reduced motion; measured palette contrast. See [ACCESSIBILITY](docs/ACCESSIBILITY.md)                                                                                                  |
| **Problem alignment** | All brief areas for all three kinds (table above); live-verified drafts for a wedding, a birthday and a community event                                                                                                                                                                                                                                                                                 |

## Run it locally

Node.js 22.12+.

```bash
npm ci
npm run dev            # AI is off by default; samples, templates and manual quotes work without it
```

To use Gemini locally: `gcloud auth application-default login`, then set `AI_ENABLED=true`, `GOOGLE_CLOUD_PROJECT` and `GEMINI_MODEL` (see [.env.example](.env.example)).

| Command                                      | What it runs                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run verify`                             | ESLint, TypeScript, knip, Prettier and Vitest with coverage thresholds |
| `npm run build` then `npm run e2e`           | Production build, then Playwright with axe (AI routes mocked)          |
| `npm run secrets` / `npm run secrets:bundle` | Credential-pattern scans of the repository and the client bundle       |

Deployment commands are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deploying).

## Limitations

- Plans live in one browser: no accounts, sync or shared editing (export a backup to move one).
- Quotes are pasted as text; PDFs and photos aren't read.
- Rate limits and the cache are per instance. The service runs with at most one instance, so they hold here; more instances would need a shared store.
- Budget figures are planning estimates until a quote is confirmed. VendorLens never verifies vendors, checks availability, books or takes payments.
- Gemini's answers are checked, but extraction can still miss a term. That is why every quote must be reviewed before it counts.

## Built with

- **Claude Code** (Anthropic): wrote the code, tests and documentation from the team's product spec, ran the checks, and deployed to Google Cloud.
- **Gemini on Vertex AI**: the product's own AI at runtime.

| Work                                            | Done by                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| Product idea, requirements and design direction | The team (product spec)                                 |
| Code, tests, prompts and docs                   | Claude Code, from the spec, with every quality gate run |
| Google Cloud and Firebase setup and permissions | The team                                                |
| Live checks and the demo                        | The team, with Claude Code running the live API checks  |

## License

[MIT](LICENSE)
