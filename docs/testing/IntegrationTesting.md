# Integration Testing

## What it is

9 Playwright tests (`qa/tests/integration/`, `integration` project) proving pieces that are individually correct (per Phase 3/4) actually **compose** correctly across all 4 backend services plus the database.

## How it works

Two spec files:
- **`project-lifecycle.spec.ts`** (7 tests, serial) - one continuous workflow: create project → add deliverable → set up budget → record a spend entry → assign a developer → verify the Dashboard aggregate reflects all of it → delete the project and verify the cascade (assignment gone from Resources, budget gone from Budgets, Dashboard totals back to baseline).
- **`session-refresh.spec.ts`** (2 tests) - proves the frontend's reactive 401-refresh-and-retry flow (`apiClient.js`, unit-tested with a mocked fetch in Phase 5) actually works against the real `auth-service`.

This is where the effort pays off: it caught two real bugs that no single-service test ever would.
1. **`get_project()` never computed `percent_used`** - only budgets-service's own detail endpoint did. The Project Detail page's `project.percent_used ?? 0` silently showed 0% forever. Only visible once a budget *and* a spend entry *and* that page were exercised together.
2. **`ProjectDetailPage.ts`'s `deleteButton` locator was ambiguous** once any deliverable existed (a row's icon-only delete button shares the same accessible name). Only visible once a workflow had both a deliverable *and* a project delete in the same test.

## Commands

```bash
cd qa
npm run test:integration
```

## Example

```ts
// qa/tests/integration/project-lifecycle.spec.ts (excerpt)
test('the dashboard reflects the new project and budget together', async ({ browser }) => {
  const { context, page } = await newPageAs(browser, 'admin');
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await expect(dashboard.statValue('Total projects')).toHaveText(String(baselineDashboard.total_projects + 1));
  await expect(dashboard.budgetOverviewText).toContainText(/750 of 5,000 spent/);
});
```
