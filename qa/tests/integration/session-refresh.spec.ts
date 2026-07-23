import { test, expect } from '../../fixtures/base';
import { storageStateWithExpiredAccessToken, storageStateWithNoValidSession } from '../../fixtures/auth.fixtures';
import { DashboardPage } from '../../pages/DashboardPage';
import { LoginPage } from '../../pages/LoginPage';
import { roleLabel } from '../../constants/roles';

/**
 * Exercises frontend/src/lib/apiClient.js's reactive 401-refresh-and-retry flow
 * (apiClient.test.js already proves this logic in isolation with a mocked fetch -
 * Phase 5) against the REAL auth-service: a genuinely expired/invalid access
 * token, a real POST /refresh call, and a real retried request, all through an
 * actual browser session. This is what makes it an integration test rather than
 * a duplicate of the unit test.
 */
test.describe('Session refresh integration', () => {
  test('a garbage access token with a valid refresh token transparently refreshes and stays logged in', async ({
    browser,
  }) => {
    const storageState = await storageStateWithExpiredAccessToken('developer');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    const dashboard = new DashboardPage(page);
    await dashboard.open();

    // If the refresh silently failed, AuthProvider's bootstrap catch-clause would
    // have cleared the session and the app would render /login instead.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboard.heading).toBeVisible();

    await dashboard.nav.openAccountMenu();
    await expect(page.getByText(roleLabel('developer'), { exact: true })).toBeVisible();

    // The refreshed access_token must have actually been persisted, not just used once in memory.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pm_platform_auth') || '{}'));
    expect(stored.access_token).not.toBe('not-a-real-access-token');

    await context.close();
  });

  test('a session with no valid tokens at all is cleared and redirected to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStateWithNoValidSession() });
    const page = await context.newPage();

    // Navigate directly rather than via DashboardPage.open() - that waits for the
    // dashboard heading, which never appears once the app redirects to /login.
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
    const loginPage = new LoginPage(page);
    await expect(loginPage.signInButton).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('pm_platform_auth'));
    expect(stored).toBeNull();

    await context.close();
  });
});
