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

**Next:** Phase 1, the money and quote domain with property tests.
