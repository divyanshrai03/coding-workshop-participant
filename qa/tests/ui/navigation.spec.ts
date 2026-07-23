import { test, expect } from '../../fixtures/auth.fixtures';
import { DashboardPage } from '../../pages/DashboardPage';

/** Covers sidebar navigation between the 4 routed authenticated pages (TESTING_PLAN.md §3). */
test.describe('Navigation', () => {
  test.use({ role: 'viewer' });

  test('sidebar links navigate to every routed page', async ({ authenticatedPage: page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.open();

    await dashboard.nav.goToProjects();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();

    await dashboard.nav.goToResources();
    await expect(page).toHaveURL(/\/resources$/);
    await expect(page.getByRole('heading', { name: 'Resources', exact: true })).toBeVisible();

    await dashboard.nav.goToBudgets();
    await expect(page).toHaveURL(/\/budgets$/);
    await expect(page.getByRole('heading', { name: 'Budgets', exact: true })).toBeVisible();

    await dashboard.nav.goToDashboard();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboard.heading).toBeVisible();
  });

  test('root path redirects to the dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
