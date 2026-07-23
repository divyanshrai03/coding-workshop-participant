# Regression Testing

## What it is

A dedicated regression suite (smoke/sanity/regression tag groupings, a critical-user-journey suite) was scoped for this project but **skipped this round** under time constraints - not built, not faked.

## What exists instead

The full existing suite already functions as a regression suite whenever it's re-run: 41 UI tests, 109 API tests, 9 integration tests, 124 backend unit/DB tests, 45 frontend unit tests - all repeatable, all passing cleanly, all runnable on demand or in CI. Re-running `npm test` / `pytest` after any change *is* regression testing today; it's just not organized into tagged subsets (`@smoke`, `@regression`) yet.

`qa/package.json` already has placeholder scripts for this:
```json
"test:smoke": "playwright test --grep @smoke",
"test:regression": "playwright test --grep @regression",
```
A few tests already carry `@smoke` tags (e.g. `auth.spec.ts`'s login test, `dashboard.spec.ts`'s render test) from earlier phases, but tagging was never completed across the suite.

## Commands

```bash
cd qa && npm test               # the de facto regression run today
```

## Follow-up (not done)

Tag every spec file's most critical path `@smoke`, build a `@regression` tier for everything else, and wire `test:smoke` into a pre-merge CI gate.
