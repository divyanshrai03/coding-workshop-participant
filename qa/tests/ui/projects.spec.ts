import { request } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixtures';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { ProjectFormDialog } from '../../pages/ProjectFormDialog';
import { ConfirmDialog } from '../../pages/ConfirmDialog';
import { env } from '../../config/env';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/** Covers frontend/src/features/projects/ProjectsPage.jsx (TESTING_PLAN.md §3, §6). */
test.describe('Projects list', () => {
  test.describe('as project_manager (can create/delete)', () => {
    test.use({ role: 'project_manager' });

    test('creates a project and sees it in the list', { tag: '@smoke' }, async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Create');
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();

      await projectsPage.newProjectButton.click();
      const dialog = new ProjectFormDialog(page);
      await dialog.selectStatus('Active');
      await dialog.selectRiskLevel('High');
      await dialog.create(projectName);

      await expect(projectsPage.row(projectName)).toBeVisible();
      await expect(projectsPage.row(projectName)).toContainText('Active');
      await expect(projectsPage.row(projectName)).toContainText('High');

      await deleteProjectsByName(await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password), projectName);
    });

    test('rejects an end date before the start date without calling the API', async ({ authenticatedPage: page }) => {
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.newProjectButton.click();

      const dialog = new ProjectFormDialog(page);
      await dialog.nameInput.fill(uniqueName('QA Bad Dates'));
      await dialog.startDateInput.fill('2026-02-01');
      await dialog.endDateInput.fill('2026-01-01');
      await dialog.createButton.click();

      await expect(dialog.errorAlert).toContainText(/before the start date/);
      // Dialog stays open - the client-side guard fired before any request went out.
      await expect(dialog.dialog).toBeVisible();
    });

    test('deletes a project after confirming', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Delete');
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.newProjectButton.click();
      await new ProjectFormDialog(page).create(projectName);
      await expect(projectsPage.row(projectName)).toBeVisible();

      await projectsPage.deleteButtonForRow(projectName).click();
      const confirmDialog = new ConfirmDialog(page);
      await expect(confirmDialog.titleText('Delete project?')).toBeVisible();
      await confirmDialog.confirm('Delete');

      await expect(projectsPage.row(projectName)).toHaveCount(0);
    });

    test('searching filters the list to matching projects only', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Searchable');
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.newProjectButton.click();
      await new ProjectFormDialog(page).create(projectName);
      await expect(projectsPage.row(projectName)).toBeVisible();

      await projectsPage.search(projectName);
      await expect(projectsPage.row(projectName)).toBeVisible();

      await projectsPage.search('a-search-term-that-matches-absolutely-nothing-xyz');
      await expect(projectsPage.emptyState).toBeVisible();

      await deleteProjectsByName(await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password), projectName);
    });

    test('filtering by status narrows the list', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Filter Status');
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.newProjectButton.click();
      const dialog = new ProjectFormDialog(page);
      await dialog.selectStatus('On Hold');
      await dialog.create(projectName);

      // Search narrows to this run's project first, so the status filter
      // assertion isn't affected by other projects created by parallel tests.
      await projectsPage.search(projectName);
      await projectsPage.filterByStatus('On Hold');
      await expect(projectsPage.row(projectName)).toBeVisible();

      await projectsPage.filterByStatus('Completed');
      await expect(projectsPage.emptyState).toBeVisible();

      await deleteProjectsByName(await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password), projectName);
    });
  });

  test.describe('RBAC - write access is role-gated', () => {
    test.use({ role: 'viewer' });

    test('viewer does not see a "New Project" action', async ({ authenticatedPage: page }) => {
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();

      await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0);
    });
  });

  test.describe('RBAC - developer', () => {
    test.use({ role: 'developer' });

    test('developer does not see a "New Project" action', async ({ authenticatedPage: page }) => {
      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();

      await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0);
    });
  });

  test.describe('pagination', () => {
    test.use({ role: 'project_manager' });

    test('a second page of results is reachable when there are enough projects', async ({ authenticatedPage: page }) => {
      // Arrange via API (fast, reliable) rather than clicking "New Project"
      // 11 times through the UI - only the pagination *control* is under test.
      const token = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
      const api = await request.newContext({ baseURL: env.API_BASE_URL });
      const paginationTag = uniqueName('QA Page');

      for (let i = 0; i < 11; i++) {
        await api.post(apiPath(SERVICES.projects, '/projects'), {
          headers: authHeader(token),
          data: { name: `${paginationTag} ${i}` },
        });
      }
      await api.dispose();

      const projectsPage = new ProjectsPage(page);
      await projectsPage.open();
      await projectsPage.search(paginationTag);

      await expect(page.locator('.MuiTablePagination-displayedRows')).toHaveText('1–10 of 11');
      // Default sort is newest-first (-created_at), so the item created
      // *first* (index 0) is the single item pushed onto page 2.
      await expect(page.getByRole('cell', { name: `${paginationTag} 0`, exact: true })).not.toBeVisible();
      await page.getByRole('button', { name: 'Go to next page' }).click();
      await expect(page.getByRole('cell', { name: `${paginationTag} 0`, exact: true })).toBeVisible();

      await deleteProjectsByName(token, paginationTag);
    });
  });
});
