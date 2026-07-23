# Testing Best Practices (as applied in this project)

## What it is

The practices actually followed while building this suite, kept here as a short reference rather than a general-purpose testing tutorial.

## Practices

- **Page Object Model** for every Playwright UI interaction (`qa/pages/`) - locators and actions live in one place per page/dialog, never duplicated across spec files.
- **Reusable fixtures over copy-paste setup** - `storageStateForRole()`, the `accessToken` fixture, `createProject`/`createBudget`/etc. helpers are used by every spec that needs them, not reimplemented per file.
- **Arrange via API, assert via UI** (and vice versa) - UI tests create prerequisite data through the real API (fast, reliable) rather than clicking through the UI for every setup step; integration tests verify UI state after real backend mutations.
- **Real systems over mocks where it matters** - API/integration/DB tests hit a real Postgres and real Lambda-equivalent handlers. This is deliberate: two real bugs (see `IntegrationTesting.md`) were only catchable this way. Unit tests mock only where isolation is the point (pure logic, no DB).
- **No duplicate coverage across layers** - unit tests skip anything requiring a DB connection (that's API tests' job); DB tests skip anything already proven through a real API call (Phase 9 vs. Phase 4/6); regression testing reuses the existing suite instead of a parallel one.
- **Verify against the running system, not assumptions** - every locator, every expected response shape, every "this should work" was checked against the live dev stack before being called done. Several bugs (own test bugs and real product bugs) were only found this way.
- **Honest documentation of limits** - WebKit's sandbox limitation, this environment's occasional 2-CPU flakiness, and Phase 8's skip are documented plainly rather than papered over.
- **One phase at a time, verified before moving on** - each phase's tests were run against the live stack and confirmed passing before starting the next, so failures are always attributable to the most recent change.

## Commands

```bash
cd qa && npm run typecheck && npm test
cd backend && .venv/bin/pytest
cd frontend && npm run lint && npm test
```
