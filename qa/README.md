# QA Suite — ACME Projects

Playwright-based UI automation, API testing, and integration testing for the
Project Management Platform. See [`../TESTING_PLAN.md`](../TESTING_PLAN.md)
for the full application analysis this suite is built against.

## Structure

```
qa/
├── tests/
│   ├── ui/            Cross-browser UI automation (Page Object Model)
│   ├── api/            Direct backend API tests (request-only, no browser)
│   ├── integration/    Mixed UI + API workflow tests
│   ├── regression/      Curated subsets of the above (tag-based, see below)
│   └── smoke/           Curated subsets of the above (tag-based, see below)
├── fixtures/          Reusable Playwright fixtures (auth sessions, test data)
├── helpers/           Framework-agnostic utility functions
├── pages/             Page Object Model classes
├── constants/         Values mirrored from the app (roles, routes, service names)
├── config/            Environment configuration loader
├── data/              Static test data / fixtures data files
├── reports/           Generated HTML/JSON reports (gitignored contents)
├── screenshots/        Failure screenshots (gitignored contents)
├── videos/             Failure recordings (gitignored contents)
├── playwright.config.ts
├── global-setup.ts / global-teardown.ts
└── .env.example
```

`tests/smoke` and `tests/regression` are **not** separate test implementations
— per the project's testing plan, they run curated, tagged subsets of the
specs in `ui/api/integration` (e.g. `test('...', { tag: '@smoke' }, ...)`,
executed via `npm run test:smoke`). This avoids duplicating test logic across
suites.

## Setup

```sh
cd qa
npm install
npx playwright install          # downloads browser binaries
cp .env.example .env            # adjust ports if your stack differs
```

The suite targets whatever's running at `UI_BASE_URL` / `API_BASE_URL`
(defaults: `http://localhost:3000` / `http://localhost:3001`, matching
`bin/start-dev.sh`'s local dev stack). Start the app first:

```sh
../bin/start-dev.sh
```

## Running tests

```sh
npm test                # everything, all projects
npm run test:ui         # UI tests, all 3 browsers
npm run test:chromium   # UI tests, Chromium only
npm run test:api        # API tests only (no browser)
npm run test:integration
npm run test:smoke      # tag-filtered subset (once tagged specs exist)
npm run test:regression # tag-filtered subset (once tagged specs exist)
npm run test:headed     # any of the above, with a visible browser
npm run test:debug      # Playwright inspector
npm run report          # open the last HTML report
```

## Known environment notes

- **WebKit** requires system libraries (`libflite`, `libavif`, `libx264`, and
  others) that aren't installable without `sudo` in some sandboxed dev
  environments. It's fully configured as a project here and works on a
  standard GitHub Actions runner (`playwright install --with-deps`) or any
  machine with those libraries present — just not guaranteed in every local
  sandbox. Chromium and Firefox were verified to launch and render correctly
  in this environment.
- The CI workflow (`.github/workflows/playwright.yml`) installs and runs this
  suite but does **not** currently start the application stack itself
  (LocalStack, Postgres, the frontend/backend). It assumes a stack is already
  reachable at `UI_BASE_URL`/`API_BASE_URL`. Wiring that up is a Phase 8+
  concern once there's a real suite worth gating merges on.
- No feature test files exist yet (this is Phase 2 — framework scaffolding
  only). `npx playwright test` will currently report "no tests found."
