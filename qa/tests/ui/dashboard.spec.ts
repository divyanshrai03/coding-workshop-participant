import { test, expect } from '../../fixtures/auth.fixtures';
import { DashboardPage } from '../../pages/DashboardPage';

/** Covers frontend/src/features/dashboard/DashboardPage.jsx (TESTING_PLAN.md §3). */
test.describe('Dashboard', () => {
  test.use({ role: 'viewer' });

  test('renders every summary section for an authenticated user', { tag: '@smoke' }, async ({
    authenticatedPage: page,
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.open();

    // Stat cards (total/active/delayed projects, completion %) always render,
    // even with zero data - see DashboardPage.jsx's non-conditional Grid of StatCards.
    await expect(page.getByText('Total projects')).toBeVisible();
    await expect(page.getByText('Delayed')).toBeVisible();
    await expect(page.getByText('Deliverable completion')).toBeVisible();

    await expect(dashboard.riskBreakdownCard).toBeVisible();
    await expect(dashboard.budgetOverviewCard).toBeVisible();
    await expect(dashboard.teamWorkloadCard).toBeVisible();
    await expect(dashboard.upcomingDeadlinesCard).toBeVisible();
  });

  test('"View budgets" navigates to the Budgets page', async ({ authenticatedPage: page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.open();

    await dashboard.viewBudgetsButton.click();

    await expect(page).toHaveURL(/\/budgets/);
  });
});
