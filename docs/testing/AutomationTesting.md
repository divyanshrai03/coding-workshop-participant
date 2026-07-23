# Automation Testing

## What it is

The umbrella term for this project's Playwright-driven test automation: UI (Phase 3), API (Phase 4), and integration (Phase 6) tests, all built on one shared framework. See `Playwright.md` for framework details, `APITesting.md` and `IntegrationTesting.md` for those layers specifically.

## How it works

- **41 UI tests** (`qa/tests/ui/`) - one file per feature (auth, navigation, dashboard, projects, project-detail, resources, budgets, rbac, responsive). Each drives real browser interactions against the real backend and real Postgres.
- **109 API tests** (`qa/tests/api/`) - one file per backend service, no browser, direct HTTP calls.
- **9 integration tests** (`qa/tests/integration/`) - cross-service workflows and the session-refresh flow, through a real browser.
- Every test runs against a live local stack (LocalStack + Postgres + Vite dev server + CORS proxy) - nothing is mocked at this layer, by design: these tests exist to catch exactly the class of bug that a mock would hide (two of which they did - see `IntegrationTesting.md`).

## Commands

```bash
cd qa
npm test                # everything (chromium + firefox + webkit + api + integration)
npm run test:chromium   # fastest useful subset for local iteration
```

## Example

A single role-gated action, verified through the real UI:

```ts
// qa/tests/ui/rbac.spec.ts (excerpt)
test(`account menu shows the correct role label for ${role}`, async ({ browser }) => {
  const storageState = await storageStateForRole(role);
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await dashboard.nav.openAccountMenu();
  await expect(page.getByText(roleLabel(role), { exact: true })).toBeVisible();
});
```
