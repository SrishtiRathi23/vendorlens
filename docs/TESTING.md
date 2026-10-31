# Testing

Tests never call the live model: unit tests inject a scripted generator or use `AI_PROVIDER=fixture`, and Playwright answers `/api/ai/*` itself. The live service was checked separately (below).

## Results (31 Oct 2026)

| Suite                          | Command                                     | Result                                                                                                                                                      |
| ------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit, property and contract    | `npm run verify`                            | **123 passed**. Coverage on `src/domain` and `src/server`: 98.5% lines, 98.1% statements, 89.9% branches, 98.4% functions. CI thresholds: 90 / 90 / 85 / 90 |
| Browser journeys with axe      | `npm run build && npm run e2e`              | **40 passed**, 2 skipped (keyboard-only checks don't run on the phone project), on a 1440 px desktop and a Pixel 5                                          |
| Lint, types, dead code, format | part of `verify`                            | 0 warnings, 0 errors, knip clean                                                                                                                            |
| Dependency audit               | `npm audit --omit=dev --audit-level=high`   | 0 vulnerabilities                                                                                                                                           |
| Secret scans                   | `npm run secrets`, `npm run secrets:bundle` | clean                                                                                                                                                       |

## What the tests prove (PRD ids)

| Id       | Claim                                                                                           | Test                                                         |
| -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Q01      | 100 × ₹850 is exact in paise                                                                    | `tests/domain/money.test.ts`, `quote-normalize.test.ts`      |
| Q02      | Included, known and unknown tax are distinct                                                    | `quote-normalize.test.ts`                                    |
| Q03      | An unknown required cost makes a quote incomplete, not ₹0                                       | `quote-normalize.test.ts`                                    |
| Q04      | Payment milestones sum exactly to the total (property)                                          | `decision.test.ts`                                           |
| Q05      | Per-guest, per-hour, flat and per-unit lines normalise                                          | `quote-normalize.test.ts`                                    |
| Q06      | Only rupee quotes are accepted                                                                  | `extraction.test.ts`, `ai-pipeline.test.ts`                  |
| Q07      | Expired quotes are flagged                                                                      | `quote-normalize.test.ts`                                    |
| Q08      | An uncovered required item blocks "comparable"                                                  | `quote-normalize.test.ts`                                    |
| Q09, Q10 | Invented excerpts and mismatched figures are never "matched"                                    | `evidence.test.ts`, `extraction.test.ts`                     |
| Q11      | Injected instructions change nothing                                                            | `extraction.test.ts`, `ai-pipeline.test.ts`                  |
| Q12      | Invalid JSON, broken rules, quota and timeouts give one repair, then a typed error              | `ai-pipeline.test.ts`                                        |
| Q14      | Choosing a quote commits once and creates payment tasks                                         | `decision.test.ts`                                           |
| Q16      | Allocations plus contingency equal the budget for any input (property); every route passes axe  | `money.test.ts`, `plan.test.ts`, `e2e/journeys.spec.ts`      |
| Q17      | Decided vendors and locked amounts are never changed by AI                                      | `adjust.test.ts`, `edge-cases.test.ts`                       |
| Q18      | Contacts never reach a prompt                                                                   | `http.test.ts`, `adjust.test.ts`                             |
| Q19      | The cache and in-flight dedupe make one model call                                              | `http.test.ts`; route 400/403/413/429 in `ai-routes.test.ts` |
| Q20      | The `.ics` export is valid RFC 5545                                                             | `calendar.test.ts`                                           |
| Q21–Q23  | Wizard to plan (and reload), the hero compare-and-choose journey, zero AI calls while comparing | `e2e/journeys.spec.ts`                                       |

## Live checks against the deployed service

Through https://vendorlens-promptwars.web.app on 31 Oct 2026, revision `vendorlens-00005-lfl`:

- **Drafts:** a wedding, a birthday and a community event each returned 200 on the first attempt, with no repair, in 7.8–10.3 s.
- **Adjust:** 1.9 s. It declined to change a decided venue on its own, and code enforces the same rule.
- **Extract:** 2.6 s. Every kept field matched its excerpt.
- **Cache:** a repeated draft was served from cache in 0.46 s.
- **Guards:** foreign or missing origins got 403, invalid input got 400, and the sixth call in a minute got 429 (before the limit was raised to 10).
- **Live logs:** these found two over-strict rules (a home birthday with no venue cost, and too few ideas). Both were fixed in prompt version `2026-10-31.2`; see `prompts-changelog.md`.
