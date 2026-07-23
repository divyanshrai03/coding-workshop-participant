# Playwright Framework

## What it is

The framework backing UI, API, and integration testing (Phases 2-4, 6). One `qa/` package, five projects, one config.

## How it works

`qa/playwright.config.ts` defines 5 projects:

| Project | testDir | Purpose |
|---|---|---|
| `chromium` / `firefox` / `webkit` | `tests/ui` | Full browser UI tests |
| `api` | `tests/api` | Pure `request`-context tests, no browser |
| `integration` | `tests/integration` | Cross-service workflows through a real browser |

Key config: `fullyParallel: true`, retries on CI only, `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, reporters `list` + `html` + `json` (+ `github` on CI).

**Auth without the login form**: `fixtures/auth.fixtures.ts`'s `storageStateForRole(role)` logs in via the real `/login` API and seeds `localStorage` directly (`pm_platform_auth` key, matching `frontend/src/lib/tokenStore.js`), so UI tests skip driving the login form for every non-auth scenario.

**Page Object Model**: every page/dialog is a class under `qa/pages/`. Locator strategy notes:
- MUI `Select` triggers and their popup share `aria-labelledby` → use `getByRole('combobox', {name})`, never `getByLabel()`.
- Dialogs use `getByRole('dialog').last()`, except dialogs that are *always* nested inside another (e.g. `BudgetEntryFormDialog`), which scope by their own heading instead.
- Buttons whose accessible name collides with an icon-only row action (e.g. page-level "Delete" vs. a table row's icon-only "Delete") use `.filter({ hasText })`, not `getByRole(..., {name})` alone - `hasText` matches visible text, `name` also matches `aria-label`.

## Commands

```bash
cd qa
npm test                        # all projects
npm run test:chromium           # UI, one browser
npm run test:api                # API only
npm run test:integration
npx playwright show-report reports/html-report
```

## Example

```ts
// qa/tests/ui/projects.spec.ts
import { test, expect } from '../../fixtures/auth.fixtures';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { ProjectFormDialog } from '../../pages/ProjectFormDialog';

test.use({ role: 'project_manager' });

test('creates a project and sees it in the list', async ({ authenticatedPage: page }) => {
  const projectsPage = new ProjectsPage(page);
  await projectsPage.open();
  await projectsPage.newProjectButton.click();
  await new ProjectFormDialog(page).create('Website Redesign');
  await expect(projectsPage.row('Website Redesign')).toBeVisible();
});
```
