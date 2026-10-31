# Evidence checklist

✅ proven by a command, test or live check that was run · ⚠️ partly checked (see note)

| Category      | What is checked                                                                 | State | Proof                                                                |
| ------------- | ------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| Code quality  | Type-aware lint with zero warnings; import boundaries; no dead code; formatting | ✅    | `npm run verify`                                                     |
| Security      | No credentials in the repo or the client bundle                                 | ✅    | `npm run secrets`, `npm run secrets:bundle`, gitleaks in CI          |
| Security      | Keyless AI (service account, no key)                                            | ✅    | live `/api/health` reports provider `vertex`; no key variable is set |
| Security      | Origin, rate and size guards on AI routes                                       | ✅    | `tests/server/*`; live 403 and 400; 429 seen live                    |
| Security      | Prompt injection cannot change prices, verification or secrets                  | ✅    | Q09–Q11 tests; live injected quote                                   |
| Security      | Nonce CSP and security headers                                                  | ✅    | `e2e/landing.spec.ts`                                                |
| Security      | Production dependencies                                                         | ✅    | `npm audit --omit=dev`: 0                                            |
| Efficiency    | No AI calls while editing or comparing                                          | ✅    | `e2e/journeys.spec.ts` (Q23)                                         |
| Efficiency    | Cache and in-flight dedupe                                                      | ✅    | Q19; live repeat in 0.46 s                                           |
| Testing       | Coverage gates (90% lines, 85% branches)                                        | ✅    | 98.5% / 89.9%                                                        |
| Testing       | Browser journeys for all three event kinds and the hero flow                    | ✅    | 40 Playwright tests                                                  |
| Accessibility | axe has 0 serious or critical findings on all routes, desktop and phone         | ✅    | `e2e/journeys.spec.ts`                                               |
| Accessibility | Keyboard: skip link, focus on errors, Escape closes dialogs                     | ✅    | `e2e/*`                                                              |
| Accessibility | Screen reader and 200% zoom pass                                                | ⚠️    | Not yet done by hand                                                 |
| Deployment    | Cloud Run build and live health                                                 | ✅    | revision `vendorlens-00005-lfl`                                      |
| Deployment    | Firebase Hosting front door                                                     | ✅    | https://vendorlens-promptwars.web.app                                |
| Alignment     | Live AI drafts for a wedding, a birthday and a community event                  | ✅    | `docs/TESTING.md`                                                    |
