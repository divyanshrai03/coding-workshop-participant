import { test, expect } from '../../fixtures/base';
import { LoginPage } from '../../pages/LoginPage';
import { RegisterPage } from '../../pages/RegisterPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { TEST_USERS } from '../../data/test-users';

/**
 * Covers the real authentication flow (TESTING_PLAN.md §7): login, logout,
 * protected-route redirects, and the bootstrap-first-admin register
 * behavior. Uses the real login form throughout - other specs use the
 * `authenticatedPage` fixture (fixtures/auth.fixtures.ts) to skip this and
 * start pre-authenticated, but auth itself must exercise the real UI.
 */
test.describe('Authentication', () => {
  test('logs in with valid credentials and lands on the dashboard', { tag: '@smoke' }, async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();

    await loginPage.login(TEST_USERS.viewer.email, TEST_USERS.viewer.password);

    await expect(page).toHaveURL(/\/dashboard/);
    const dashboard = new DashboardPage(page);
    await expect(dashboard.heading).toBeVisible();
  });

  test('shows an error and stays on the login page for wrong credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();

    await loginPage.login(TEST_USERS.viewer.email, 'definitely-the-wrong-password');

    await expect(loginPage.errorAlert).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows a validation error when submitting without a password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();

    // The form uses noValidate (see LoginPage.jsx), so submission reaches the
    // real API with an empty password rather than being blocked by the
    // browser - the backend's require_fields() rejects it with a 400.
    await loginPage.emailInput.fill(TEST_USERS.viewer.email);
    await loginPage.signInButton.click();

    await expect(loginPage.errorAlert).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects an unauthenticated user from a protected route to login, then back after login', async ({
    page,
  }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.viewer.email, TEST_USERS.viewer.password);

    // ProtectedRoute preserves the originally-requested location (see
    // frontend/src/app/ProtectedRoute.jsx `state={{ from: location }}`).
    await expect(page).toHaveURL(/\/projects/);
  });

  test('logs out and blocks access to protected routes again', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.login(TEST_USERS.viewer.email, TEST_USERS.viewer.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.nav.signOut();

    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('registering when the workspace already has an admin shows a clear error, not a crash', async ({
    page,
  }) => {
    // The bootstrap-first-admin flow (backend/auth-service register()) only
    // allows an unauthenticated registration for the very first user ever.
    // This environment's seed step (fixtures/seed.ts) guarantees an admin
    // already exists, so this path is always exercised deterministically.
    const registerPage = new RegisterPage(page);
    await registerPage.open();

    await registerPage.register('Someone New', `someone-${Date.now()}@acme-test.com`, 'supersecret1');

    await expect(registerPage.errorAlert).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('unmatched routes redirect an authenticated user to the dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.login(TEST_USERS.viewer.email, TEST_USERS.viewer.password);

    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
