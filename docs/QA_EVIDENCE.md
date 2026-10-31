# Evidence checklist

✅ proven by a command or test that was run · ⏳ arrives in a later phase

| Category      | What is checked                                                | State | Proof                                                       |
| ------------- | -------------------------------------------------------------- | ----- | ----------------------------------------------------------- |
| Code quality  | Type-aware lint with zero warnings                             | ✅    | `npm run lint`                                              |
| Code quality  | Import boundaries for `src/domain` and browser code            | ✅    | `eslint.config.mjs`; lint passes                            |
| Code quality  | No dead files, exports or packages                             | ✅    | `npm run deadcode` (knip)                                   |
| Security      | No credential patterns in committed files or the client bundle | ✅    | `npm run secrets`, `npm run secrets:bundle`; gitleaks in CI |
| Security      | Configuration errors never contain values                      | ✅    | `tests/server/env.test.ts`, `tests/server/health.test.ts`   |
| Security      | Recorded-response AI provider refused in production            | ✅    | `tests/server/env.test.ts`                                  |
| Security      | Baseline response headers, locally and live                    | ✅    | `e2e/landing.spec.ts`; live probe in the build journal      |
| Security      | Per-request nonce CSP                                          | ⏳    | hardening phase                                             |
| Security      | Production dependencies free of high or critical advisories    | ✅    | `npm audit --omit=dev`                                      |
| Testing       | Coverage gate (90% lines on `src/domain`, `src/server`)        | ✅    | `npm run coverage`                                          |
| Accessibility | axe has no serious or critical findings on desktop or phone    | ✅    | `e2e/landing.spec.ts`                                       |
| Accessibility | No page-wide horizontal scroll at 320, 390, 768 and 1440 px    | ✅    | `e2e/landing.spec.ts`                                       |
| Accessibility | Skip link moves focus to the content                           | ✅    | `e2e/landing.spec.ts`                                       |
| Deployment    | Container builds on Cloud Build                                | ✅    | revision `vendorlens-00001-wpm`                             |
| Deployment    | Live health on Cloud Run and through Firebase Hosting          | ✅    | build journal, Phase 0                                      |
| Alignment     | Weddings, birthdays and community events from brief to plan    | ⏳    | Phases 1–4                                                  |
| Alignment     | Quote extraction with evidence, review and honest comparison   | ⏳    | Phases 2–4                                                  |
