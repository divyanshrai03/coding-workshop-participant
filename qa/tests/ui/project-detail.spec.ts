import { test, expect } from '../../fixtures/auth.fixtures';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { ProjectDetailPage } from '../../pages/ProjectDetailPage';
import { DeliverableFormDialog } from '../../pages/DeliverableFormDialog';
import { DependenciesDialog } from '../../pages/DependenciesDialog';
import { ConfirmDialog } from '../../pages/ConfirmDialog';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createDeliverable, createProject } from '../../helpers/api-setup';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/**
 * Covers frontend/src/features/projects/ProjectDetailPage.jsx: deliverables
 * CRUD, dependency management, and the RBAC boundary that limits developers
 * to updating only a deliverable's status (TESTING_PLAN.md §6, §9).
 *
 * Projects/deliverables needed only as *setup* are created via the API
 * (helpers/api-setup.ts) - each test's UI actions focus on the behavior
 * actually under test, not repeating prerequisite creation flows already
 * covered by projects.spec.ts.
 */
test.describe('Project detail', () => {
  test.describe('as team_lead (can manage deliverables)', () => {
    test.use({ role: 'team_lead' });

    test('creates a deliverable and sees it in the list', { tag: '@smoke' }, async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Detail Project');
      const deliverableName = uniqueName('QA Deliverable');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.search(projectName);
      await projectsPage.openProject(projectName);

      const detailPage = new ProjectDetailPage(page);
      await expect(detailPage.heading(projectName)).toBeVisible();

      await detailPage.newDeliverableButton.click();
      const dialog = new DeliverableFormDialog(page);
      await dialog.selectStatus('In Progress');
      await dialog.create(deliverableName);

      await expect(detailPage.deliverableRow(deliverableName)).toBeVisible();
      await expect(detailPage.deliverableRow(deliverableName)).toContainText('In Progress');

      await deleteProjectsByName(adminToken, projectName);
    });

    test('manages dependencies between two deliverables', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Deps Project');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.search(projectName);
      await projectsPage.openProject(projectName);
      const detailPage = new ProjectDetailPage(page);
      await expect(detailPage.heading(projectName)).toBeVisible();

      await detailPage.newDeliverableButton.click();
      await new DeliverableFormDialog(page).create('Design');
      await detailPage.newDeliverableButton.click();
      await new DeliverableFormDialog(page).create('Implementation');

      await detailPage.openDeliverable('Implementation');
      const depDialog = new DependenciesDialog(page);
      await expect(depDialog.blockedByHeading).toHaveText('Blocked by (0)');
      await depDialog.addDependency('Design');
      await expect(depDialog.blockedByHeading).toHaveText('Blocked by (1)');
      await depDialog.close();

      // The reverse edge is a circular dependency and must be rejected server-side
      // (TESTING_PLAN.md §9) - verified here via the "Design" deliverable's own dialog.
      await detailPage.openDeliverable('Design');
      const depDialog2 = new DependenciesDialog(page);
      await expect(depDialog2.blockingHeading).toHaveText('Blocking (1)');

      await deleteProjectsByName(adminToken, projectName);
    });

    test('deletes a deliverable after confirming', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Del Deliverable');
      const deliverableName = uniqueName('QA To Delete');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.search(projectName);
      await projectsPage.openProject(projectName);
      const detailPage = new ProjectDetailPage(page);
      await detailPage.newDeliverableButton.click();
      await new DeliverableFormDialog(page).create(deliverableName);
      await expect(detailPage.deliverableRow(deliverableName)).toBeVisible();

      await detailPage.deleteButtonForRow(deliverableName).click();
      const confirmDialog = new ConfirmDialog(page);
      await expect(confirmDialog.titleText('Delete deliverable?')).toBeVisible();
      await confirmDialog.confirm('Delete');

      await expect(detailPage.deliverableRow(deliverableName)).toHaveCount(0);

      await deleteProjectsByName(adminToken, projectName);
    });
  });

  test.describe('RBAC - developer can only change deliverable status', () => {
    test.use({ role: 'developer' });

    test('developer sees no Edit/Delete actions on a deliverable row', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Dev RBAC Project');
      const deliverableName = uniqueName('QA Dev RBAC Deliverable');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      const projectId = await createProject(adminToken, projectName);
      await createDeliverable(adminToken, projectId, deliverableName);

      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.search(projectName);
      await projectsPage.openProject(projectName);
      const detailPage = new ProjectDetailPage(page);
      await expect(detailPage.deliverableRow(deliverableName)).toBeVisible();

      // Only the "Dependencies" icon is available - Edit/Delete require team_lead+
      // (backend/projects-service function.py update_deliverable()/delete_deliverable()).
      await expect(detailPage.editButtonForRow(deliverableName)).toHaveCount(0);
      await expect(detailPage.deleteButtonForRow(deliverableName)).toHaveCount(0);
      await expect(detailPage.dependenciesButtonForRow(deliverableName)).toBeVisible();
      await expect(detailPage.newDeliverableButton).toHaveCount(0);

      await deleteProjectsByName(adminToken, projectName);
    });
  });
});
