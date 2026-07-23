import { test, expect } from '../../fixtures/auth.fixtures';
import { DashboardPage } from '../../pages/DashboardPage';

/**
 * Covers the responsive sidebar behavior in frontend/src/layouts/AppLayout.jsx,
 * which switches between a permanent drawer (desktop) and a hamburger-triggered
 * temporary drawer (mobile) at the 900px breakpoint (TESTING_PLAN.md §3).
 */
test.describe('Responsive layout', () => {
  test.use({ role: 'viewer' });

  test('desktop viewport shows a permanent sidebar with no menu button', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const dashboard = new DashboardPage(page);
    await dashboard.open();

    await expect(dashboard.nav.projectsLink).toBeVisible();
    await expect(dashboard.nav.mobileMenuButton).toHaveCount(0);
  });

  test('mobile viewport hides the sidebar behind a menu button until opened', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const dashboard = new DashboardPage(page);
    await dashboard.open();

    await expect(dashboard.nav.mobileMenuButton).toBeVisible();
    await expect(dashboard.nav.projectsLink).not.toBeVisible();

    await dashboard.nav.mobileMenuButton.click();
    await expect(dashboard.nav.projectsLink).toBeVisible();

    await dashboard.nav.goToProjects();
    await expect(page).toHaveURL(/\/projects/);
  });
});
