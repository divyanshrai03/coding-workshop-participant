# Testing Folder Structure

## What it is

Where every kind of test in this project lives, and why.

## Layout

```
qa/                          Playwright framework (UI, API, integration)
├── playwright.config.ts     Projects: chromium, firefox, webkit, api, integration
├── config/env.ts            UI_BASE_URL, API_BASE_URL, test user creds (from .env)
├── fixtures/                base.ts, auth.fixtures.ts, api-auth.fixtures.ts, seed.ts
├── helpers/                 api-path, auth-header, api-setup, cleanup, test-data
├── constants/                roles.ts, services.ts, routes.ts
├── data/test-users.ts        One fixed account per role
├── pages/                    Page Object Model - one class per page/dialog
├── tests/
│   ├── ui/                  Feature-level UI tests (Phase 3)
│   ├── api/                 One file per backend service (Phase 4)
│   └── integration/         Cross-service workflows (Phase 6)
├── perf/                     JMeter test plan + reports (Phase 7)
└── reports/                  Playwright HTML/JSON output (gitignored)

backend/
├── conftest.py                load_service_function fixture (all services)
├── pytest.ini                 pythonpath=_shared, testpaths across all services
├── _shared/tests/             Pure-logic unit tests + DB integrity tests (Phase 5, 9)
├── {service}/tests/           Per-service pure-function unit tests (Phase 5)
└── htmlcov/                    Coverage HTML (gitignored)

frontend/
└── src/**/*.test.{js,jsx}      Vitest unit/component tests, colocated with source

docs/testing/                  This documentation (Phase 11)
```

## Why colocated vs. centralized

- Frontend Vitest tests sit next to the component they test (`Foo.jsx` + `Foo.test.jsx`) - standard Vitest/React convention, easiest to find.
- Backend pytest tests are centralized per-service under `tests/` (not colocated with `function.py`) so Lambda deployment packaging never picks up test files.
- All Playwright tests live under one `qa/` package, independent of `frontend/`/`backend/`, since they exercise the system as a whole (real browser + real API), not one codebase's internals.

## Commands

```bash
cd qa && npm test                                    # everything Playwright can run
cd backend && .venv/bin/pytest                       # everything pytest can run
cd frontend && npm test                              # everything Vitest can run
```
