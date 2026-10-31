# Build journal

What each phase delivered, the commands that proved it, and what's still open. Every number below was produced by a command run on the stated date.

## Phase 0: deployable skeleton (31 October 2026)

**Delivered:** Next.js 16.4.3 (`output: "standalone"`) with React 19.3 and Tailwind 4. Strict TypeScript, type-aware ESLint with import boundaries, knip, Prettier, Vitest with coverage thresholds, and Playwright with axe. Validated configuration and `/api/health`. The Merchant's Desk landing page. An Alpine multi-stage Dockerfile running as user `vendorlens` (uid 1001). The `quality-gates` workflow with pinned action SHAs. The Firebase Hosting rewrite to Cloud Run.

**Local evidence** (Windows, Node 24.14.1; CI pins Node 22)

| Command                                      | Outcome                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm ci`                                     | 423 packages, exit 0                                                                               |
| `npm run verify`                             | exit 0. 15 of 15 tests. Coverage: 96.55% lines, 97.14% statements, 95.23% branches, 100% functions |
| `npm run build`                              | exit 0. `/` prerendered, `/api/health` rendered per request                                        |
| `npm run secrets` / `npm run secrets:bundle` | no credential patterns (37 tracked files, 18 bundle files)                                         |
| `npm audit --omit=dev --audit-level=high`    | 0 vulnerabilities                                                                                  |
| `CI=true npm run e2e`                        | 13 passed, 1 skipped (the Tab-key check doesn't apply to the phone project)                        |
| Client JavaScript, all chunks gzipped        | 171.0 KB                                                                                           |

**Deployment**

- Google Cloud project `vendorlens-pw-10311639`, region `asia-south1`.
- Cloud Build ran as the `vendorlens-build` service account (`roles/run.builder` only) and built the Alpine image without errors.
- Revision `vendorlens-00001-wpm` runs as `vendorlens-run` (`roles/aiplatform.user` only): min 0 and max 1 instance, 512 MiB, 30 s timeout, AI off.
- The Firebase Hosting site `vendorlens-promptwars` was released with `firebase.json` (rewrite `**` → Cloud Run `vendorlens`).

| Live probe                                                       | Outcome                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `https://vendorlens-598370845591.asia-south1.run.app/api/health` | 200 `{"ok":true,"buildVersion":"vendorlens-00001-wpm","aiEnabled":false,"provider":"off"}`, `no-store`                                |
| `https://vendorlens-promptwars.web.app/api/health`               | same body through Firebase Hosting, served by the `cache-bom` (Mumbai) edge                                                           |
| `https://vendorlens-promptwars.web.app/`                         | 200; H1 "The cheapest quote isn't always the cheapest event."                                                                         |
| Response headers                                                 | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin` |
| A `/_next/static` chunk                                          | `public, max-age=31536000, immutable`                                                                                                 |

## Full build: planner, quote comparison, AI and hardening (31 Oct 2026)

**Delivered**

- **Domain** (`src/domain`, pure): money in paise, largest-remainder allocation, IST dates, category and coverage vocabulary, number reading (₹, Rs., lakh, crore), evidence verification, quote normalisation and comparison, payment milestones, vendor questions, plan building from a draft, AI adjustments with lock and scope rules, diffs, budget and timeline views, `.ics` and Google Calendar and Maps links, templates and fictional samples.
- **AI** (`src/server/ai`): keyless Gemini on Vertex AI with structured JSON; per task, Zod, rules, one repair, fallback model, contact redaction, output scrubbing, LRU cache with in-flight dedupe; same-origin, rate and size guards on `/api/ai/{draft,adjust,extract}`.
- **App:** landing with a live sample comparison, a 3-step wizard, and the Overview, Budget, Vendors (quote intake and evidence review), Compare, Timeline, Ideas and Privacy screens; Adjust with AI with preview and undo; IndexedDB autosave, backup and import, print.
- **Hardening:** per-request nonce CSP (`src/proxy.ts`) with dynamic rendering; 40 browser journeys with axe.

**Found and fixed by running things**

| Finding                                                                 | Fix                                                                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertex AI rejected every response schema (HTTP 400)                     | Bounds removed from the copy sent to Gemini; Zod still enforces them                                                                                             |
| The model wrote validity dates as phrases                               | Text fields in AI answers are clipped, and invalid dates become unknown                                                                                          |
| "Minimum 100 plates" was used as the quantity for a 150-guest event     | Per-guest prices always use the event's guest count; the quote's assumption is shown as a mismatch                                                               |
| "Balance on the event day" was dropped because the figure isn't written | Remainder wording no longer needs the figure; the schedule must still sum to 100%                                                                                |
| A reload within 250 ms lost the newest plan (found by E2E)              | Plans are saved on every change                                                                                                                                  |
| Live drafts sometimes failed validation                                 | Cloud Logging showed over-strict rules; required categories and list minimums relaxed (prompt 2026-10-31.2). All three kinds then succeeded on the first attempt |
| Choosing "amount stated" for a cost set ₹0 before any amount was typed  | The cost stays unknown until a valid amount is entered                                                                                                           |

**Evidence:** 123 unit tests (98.5% lines, 89.9% branches), 40 E2E journeys passing, 0 audit findings, clean secret scans. Live revision `vendorlens-00003-6c5` checked through Firebase Hosting; see [TESTING.md](TESTING.md#live-checks-against-the-deployed-service).
