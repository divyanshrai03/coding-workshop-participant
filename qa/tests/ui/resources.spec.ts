import { test, expect } from '../../fixtures/auth.fixtures';
import { ResourcesPage } from '../../pages/ResourcesPage';
import { ResourceAssignmentsDialog } from '../../pages/ResourceAssignmentsDialog';
import { AssignmentFormDialog } from '../../pages/AssignmentFormDialog';
import { ConfirmDialog } from '../../pages/ConfirmDialog';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createProject } from '../../helpers/api-setup';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/** Covers frontend/src/features/resources/ResourcesPage.jsx (TESTING_PLAN.md §3, §6). */
test.describe('Resources', () => {
  test.describe('as viewer (read-only)', () => {
    test.use({ role: 'viewer' });

    test('renders the workload summary and roster', { tag: '@smoke' }, async ({ authenticatedPage: page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.open();

      await expect(page.getByText('Total resources')).toBeVisible();
      await expect(page.getByText('Overallocated')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Current allocation' })).toBeVisible();
    });

    test('search narrows the roster to matching people', async ({ authenticatedPage: page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.open();

      await resourcesPage.search(TEST_USERS.viewer.fullName);
      await expect(resourcesPage.row(TEST_USERS.viewer.fullName)).toBeVisible();
      await expect(resourcesPage.row(TEST_USERS.developer.fullName)).toHaveCount(0);
    });

    test('filtering by role narrows the roster', async ({ authenticatedPage: page }) => {
      // Filters by "Viewer" (not "Admin") because TEST_USERS.admin may point
      // at a pre-existing admin from this environment (see data/test-users.ts) -
      // the seed-created viewer/team_lead/developer/project_manager accounts
      // always have their expected fullName, making them safer to assert on.
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.open();

      await resourcesPage.filterByRole('Viewer');
      await expect(resourcesPage.row(TEST_USERS.viewer.fullName)).toBeVisible();
      await expect(resourcesPage.row(TEST_USERS.developer.fullName)).toHaveCount(0);
    });
  });

  test.describe('as team_lead (can manage assignments)', () => {
    test.use({ role: 'team_lead' });

    test('creates and removes an assignment for a team member', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Assignment Project');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.open();
      await resourcesPage.search(TEST_USERS.developer.fullName);
      await resourcesPage.openAssignments(TEST_USERS.developer.fullName);

      const assignmentsDialog = new ResourceAssignmentsDialog(page);
      await expect(assignmentsDialog.emptyState).toBeVisible();

      await assignmentsDialog.newAssignmentButton.click();
      const form = new AssignmentFormDialog(page);
      await form.selectProject(projectName);
      await form.selectPerson(TEST_USERS.developer.email);
      await form.createButton.click();

      // AssignmentFormDialog is always nested inside ResourceAssignmentsDialog,
      // so waiting on "the new assignment is now listed" is both the real
      // success signal and unambiguous - unlike waiting for "a dialog closed",
      // which is unclear when two dialogs are stacked.
      await expect(assignmentsDialog.assignmentListItem(projectName)).toBeVisible();

      await assignmentsDialog.removeButtonFor(projectName).click();
      const confirmDialog = new ConfirmDialog(page);
      await expect(confirmDialog.titleText('Remove assignment?')).toBeVisible();
      await confirmDialog.confirm('Remove');

      await expect(assignmentsDialog.emptyState).toBeVisible();

      await deleteProjectsByName(adminToken, projectName);
    });
  });

  test.describe('RBAC - viewer cannot manage assignments', () => {
    test.use({ role: 'viewer' });

    test('viewer sees no "New assignment" action', async ({ authenticatedPage: page }) => {
      const resourcesPage = new ResourcesPage(page);
      await resourcesPage.open();
      await resourcesPage.search(TEST_USERS.developer.fullName);
      await resourcesPage.openAssignments(TEST_USERS.developer.fullName);

      const assignmentsDialog = new ResourceAssignmentsDialog(page);
      await expect(assignmentsDialog.dialog).toBeVisible();
      await expect(assignmentsDialog.newAssignmentButton).toHaveCount(0);
    });
  });
});
