import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixtures';
import { BudgetsPage } from '../../pages/BudgetsPage';
import { BudgetFormDialog } from '../../pages/BudgetFormDialog';
import { BudgetDetailDialog } from '../../pages/BudgetDetailDialog';
import { BudgetEntryFormDialog } from '../../pages/BudgetEntryFormDialog';
import { ConfirmDialog } from '../../pages/ConfirmDialog';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createProject } from '../../helpers/api-setup';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/**
 * Covers frontend/src/features/budgets/BudgetsPage.jsx (TESTING_PLAN.md §3, §6).
 *
 * Runs serially (not this file's tests in parallel with each other): unlike
 * Projects/Resources, BudgetsPage has no search/filter control, so the
 * empty-state test at the bottom can only assert reliably on *global* list
 * emptiness. Serial mode guarantees every earlier test's cleanup has
 * completed by the time that test runs.
 */
test.describe.configure({ mode: 'serial' });

/** Shared "New Budget" flow - every test needs a project selected before create() succeeds. */
async function createBudgetViaUi(page: Page, projectName: string, plannedAmount: string): Promise<void> {
  const budgetsPage = new BudgetsPage(page);
  await budgetsPage.open();
  await budgetsPage.newBudgetButton.click();
  const form = new BudgetFormDialog(page);
  await form.selectProject(projectName);
  await form.create(plannedAmount);
}

test.describe('Budgets', () => {
  test.describe('as project_manager (can create/update, cannot delete)', () => {
    test.use({ role: 'project_manager' });

    test('creates a budget for a project and sees it in the list', { tag: '@smoke' }, async ({
      authenticatedPage: page,
    }) => {
      const projectName = uniqueName('QA Budget Project');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const budgetsPage = new BudgetsPage(page);
      await createBudgetViaUi(page, projectName, '5000');

      await expect(budgetsPage.row(projectName)).toBeVisible();
      await expect(budgetsPage.row(projectName)).toContainText('5,000');

      await deleteProjectsByName(adminToken, projectName);
    });

    test('adds a spend entry and sees the running total update', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Spend Project');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const budgetsPage = new BudgetsPage(page);
      await createBudgetViaUi(page, projectName, '1000');
      await budgetsPage.openBudget(projectName);

      const detailDialog = new BudgetDetailDialog(page);
      await expect(detailDialog.emptyEntriesState).toBeVisible();

      await detailDialog.addEntryButton.click();
      const entryForm = new BudgetEntryFormDialog(page);
      await entryForm.addEntry('Cloud hosting', '250');

      await expect(detailDialog.entryListItem('Cloud hosting')).toBeVisible();
      await expect(detailDialog.dialog.getByText(/250 spent of.*1,000/)).toBeVisible();

      await deleteProjectsByName(adminToken, projectName);
    });

    test('project_manager does not see a "Delete budget" action', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA No Delete Project');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const budgetsPage = new BudgetsPage(page);
      await createBudgetViaUi(page, projectName, '1000');
      await budgetsPage.openBudget(projectName);

      const detailDialog = new BudgetDetailDialog(page);
      await expect(detailDialog.editBudgetButton).toBeVisible();
      await expect(detailDialog.deleteBudgetButton).toHaveCount(0);

      await deleteProjectsByName(adminToken, projectName);
    });
  });

  test.describe('as admin (can delete budgets)', () => {
    test.use({ role: 'admin' });

    test('deletes a budget after confirming', async ({ authenticatedPage: page }) => {
      const projectName = uniqueName('QA Admin Delete Budget');
      const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      await createProject(adminToken, projectName);

      const budgetsPage = new BudgetsPage(page);
      await createBudgetViaUi(page, projectName, '1000');
      await budgetsPage.openBudget(projectName);

      const detailDialog = new BudgetDetailDialog(page);
      await detailDialog.deleteBudgetButton.click();
      const confirmDialog = new ConfirmDialog(page);
      await expect(confirmDialog.titleText('Delete budget?')).toBeVisible();
      await confirmDialog.confirm('Delete');

      await expect(budgetsPage.row(projectName)).toHaveCount(0);

      await deleteProjectsByName(adminToken, projectName);
    });
  });

  test.describe('RBAC - viewer cannot create budgets', () => {
    test.use({ role: 'viewer' });

    test('viewer does not see a "New Budget" action', async ({ authenticatedPage: page }) => {
      const budgetsPage = new BudgetsPage(page);
      await budgetsPage.open();

      await expect(page.getByRole('button', { name: 'New Budget' })).toHaveCount(0);
    });
  });

  test.describe('empty states', () => {
    test.use({ role: 'viewer' });

    test('shows an empty state when no budget exists yet', async ({ authenticatedPage: page }) => {
      // Relies on no other test leaving budgets behind (every budget-creating
      // test above deletes its project, which cascades its budget) rather
      // than asserting on a specific project - a global list-empty check
      // would be flaky under parallel execution otherwise. Serial mode
      // (configured above) plus this test running last makes it reliable.
      const budgetsPage = new BudgetsPage(page);
      await budgetsPage.open();
      await expect(budgetsPage.emptyState).toBeVisible();
    });
  });
});
