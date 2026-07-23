import { test, expect } from '../../fixtures/base';
import { storageStateForRole } from '../../fixtures/auth.fixtures';
import { DashboardPage } from '../../pages/DashboardPage';
import { ROLES, roleLabel } from '../../constants/roles';

/**
 * Cross-cutting RBAC checks (TESTING_PLAN.md §7, §9). Most role-gated
 * behavior is already verified in context within each feature spec
 * (projects.spec.ts, project-detail.spec.ts, resources.spec.ts,
 * budgets.spec.ts) rather than duplicated here - this file covers the one
 * thing genuinely cross-cutting: every role's account menu shows its own
 * correct, human-readable role label.
 */
test.describe('RBAC - role display', () => {
  for (const role of ROLES) {
    test(`account menu shows the correct role label for ${role}`, async ({ browser }) => {
      const storageState = await storageStateForRole(role);
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      const dashboard = new DashboardPage(page);
      await dashboard.open();
      await dashboard.nav.openAccountMenu();

      await expect(page.getByText(roleLabel(role), { exact: true })).toBeVisible();

      await context.close();
    });
  }
});
