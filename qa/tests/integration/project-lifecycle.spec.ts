import { request as pwRequest } from '@playwright/test';
import { test, expect } from '../../fixtures/base';
import { storageStateForRole } from '../../fixtures/auth.fixtures';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { env } from '../../config/env';
import { uniqueName } from '../../helpers/test-data';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { ProjectFormDialog } from '../../pages/ProjectFormDialog';
import { ProjectDetailPage } from '../../pages/ProjectDetailPage';
import { DeliverableFormDialog } from '../../pages/DeliverableFormDialog';
import { BudgetsPage } from '../../pages/BudgetsPage';
import { BudgetFormDialog } from '../../pages/BudgetFormDialog';
import { BudgetDetailDialog } from '../../pages/BudgetDetailDialog';
import { BudgetEntryFormDialog } from '../../pages/BudgetEntryFormDialog';
import { ResourcesPage } from '../../pages/ResourcesPage';
import { ResourceAssignmentsDialog } from '../../pages/ResourceAssignmentsDialog';
import { AssignmentFormDialog } from '../../pages/AssignmentFormDialog';
import { DashboardPage } from '../../pages/DashboardPage';
import { ConfirmDialog } from '../../pages/ConfirmDialog';

/**
 * A single continuous workflow that touches all 4 backend services through
 * the real UI: projects-service (create/delete), projects-service's own
 * deliverables, budgets-service (budget + spend entry), resources-service
 * (assignment), and finally projects-service's dashboard aggregate, which
 * reads directly from the budgets/budget_entries tables (see
 * dashboard_summary() in backend/projects-service/function.py).
 *
 * Phase 3's UI specs and Phase 4's API specs already prove each of these
 * operations correct in isolation - this file's job is only to prove they
 * compose correctly: that a budget set up on one page is visible on another,
 * that a spend entry recorded via Budgets updates the Project Detail page,
 * and that deleting a project cascades across Resources and Budgets and the
 * Dashboard, all through the same real Postgres-backed system.
 */
async function newPageAs(browser: import('@playwright/test').Browser, role: 'admin' | 'project_manager' | 'team_lead') {
  const context = await browser.newContext({ storageState: await storageStateForRole(role) });
  const page = await context.newPage();
  return { context, page };
}

test.describe.configure({ mode: 'serial' });

test.describe('Project lifecycle integration', () => {
  const projectName = uniqueName('QA Integration Lifecycle');
  let adminToken: string;
  let baselineDashboard: { total_projects: number; budget_planned: number; budget_spent: number };

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const api = await pwRequest.newContext({ baseURL: env.API_BASE_URL });
    const response = await api.get(apiPath(SERVICES.projects, '/dashboard/summary'), { headers: authHeader(adminToken) });
    const body = await response.json();
    baselineDashboard = {
      total_projects: body.data.total_projects,
      budget_planned: Number(body.data.budget_planned),
      budget_spent: Number(body.data.budget_spent),
    };
    await api.dispose();
  });

  test.afterAll(async () => {
    await deleteProjectsByName(adminToken, projectName);
  });

  test('project_manager creates a project with no budget yet', async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'project_manager');

    const projectsPage = new ProjectsPage(page);
    await projectsPage.open();
    await projectsPage.newProjectButton.click();
    const form = new ProjectFormDialog(page);
    await form.selectStatus('Active');
    await form.create(projectName);

    await projectsPage.openProject(projectName);
    const detail = new ProjectDetailPage(page);
    await expect(detail.heading(projectName)).toBeVisible();
    await expect(page.getByText('No budget set for this project yet.')).toBeVisible();

    await context.close();
  });

  test('team_lead adds a deliverable to the project', async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'team_lead');

    const projectsPage = new ProjectsPage(page);
    await projectsPage.open();
    await projectsPage.openProject(projectName);
    const detail = new ProjectDetailPage(page);
    await expect(detail.heading(projectName)).toBeVisible();

    await detail.newDeliverableButton.click();
    const deliverableForm = new DeliverableFormDialog(page);
    const deliverableName = uniqueName('Integration Deliverable');
    await deliverableForm.create(deliverableName);

    await expect(detail.deliverableRow(deliverableName)).toBeVisible();

    await context.close();
  });

  test('project_manager sets up a budget and it appears on the project detail page', async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'project_manager');

    const budgetsPage = new BudgetsPage(page);
    await budgetsPage.open();
    await budgetsPage.newBudgetButton.click();
    const budgetForm = new BudgetFormDialog(page);
    await budgetForm.selectProject(projectName);
    await budgetForm.create('5000');

    const projectsPage = new ProjectsPage(page);
    await projectsPage.open();
    await projectsPage.openProject(projectName);
    const detail = new ProjectDetailPage(page);
    // Proves projects-service's get_project() correctly joins the budget that
    // was just created through budgets-service's own create_budget() handler.
    await expect(page.getByText(/of 5,?000 spent \(0%\)/)).toBeVisible();

    await context.close();
  });

  test("recording a spend entry on Budgets updates the project detail page's budget summary", async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'project_manager');

    const budgetsPage = new BudgetsPage(page);
    await budgetsPage.open();
    await budgetsPage.openBudget(projectName);
    const budgetDetail = new BudgetDetailDialog(page);
    await budgetDetail.addEntryButton.click();
    const entryForm = new BudgetEntryFormDialog(page);
    await entryForm.addEntry('Integration testing spend', '750');
    await expect(budgetDetail.entryListItem('Integration testing spend')).toBeVisible();
    await budgetDetail.close();

    const projectsPage = new ProjectsPage(page);
    await projectsPage.open();
    await projectsPage.openProject(projectName);
    const detail = new ProjectDetailPage(page);
    await expect(page.getByText(/750 of 5,?000 spent \(15%\)/)).toBeVisible();

    await context.close();
  });

  test('team_lead assigns a developer to the project via the Resources page', async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'team_lead');

    const resourcesPage = new ResourcesPage(page);
    await resourcesPage.open();
    await resourcesPage.search(TEST_USERS.developer.fullName);
    await resourcesPage.openAssignments(TEST_USERS.developer.fullName);

    const assignmentsDialog = new ResourceAssignmentsDialog(page);
    await assignmentsDialog.newAssignmentButton.click();
    const assignmentForm = new AssignmentFormDialog(page);
    await assignmentForm.selectProject(projectName);
    await assignmentForm.selectPerson(TEST_USERS.developer.email);
    await assignmentForm.createButton.click();

    await expect(assignmentsDialog.assignmentListItem(projectName)).toBeVisible();

    await context.close();
  });

  test('the dashboard reflects the new project and budget together', async ({ browser }) => {
    const { context, page } = await newPageAs(browser, 'admin');

    const dashboard = new DashboardPage(page);
    await dashboard.open();

    await expect(dashboard.statValue('Total projects')).toHaveText(String(baselineDashboard.total_projects + 1));

    const expectedPlanned = baselineDashboard.budget_planned + 5000;
    const expectedSpent = baselineDashboard.budget_spent + 750;
    await expect(dashboard.budgetOverviewText).toContainText(
      new RegExp(`${expectedSpent.toLocaleString()} of ${expectedPlanned.toLocaleString()} spent`),
    );

    await context.close();
  });

  test('deleting the project cascades: the assignment and budget disappear, and the dashboard total drops back', async ({
    browser,
  }) => {
    const { context, page } = await newPageAs(browser, 'admin');

    const projectsPage = new ProjectsPage(page);
    await projectsPage.open();
    await projectsPage.openProject(projectName);
    const detail = new ProjectDetailPage(page);
    await detail.deleteButton.click();
    const confirmDialog = new ConfirmDialog(page);
    // This delete cascades across deliverables, dependencies, an assignment, and a
    // budget/entry - a heavier multi-table transaction than any single-service delete
    // test, so it gets a longer click timeout rather than the framework default.
    await confirmDialog.dialog.getByRole('button', { name: 'Delete', exact: true }).click({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/projects$/, { timeout: 15_000 });

    // Resources: the developer's assignment for the now-deleted project is gone
    // (assignments.project_id has ON DELETE CASCADE - see 0001_init_schema.sql).
    const resourcesPage = new ResourcesPage(page);
    await resourcesPage.open();
    await resourcesPage.search(TEST_USERS.developer.fullName);
    await resourcesPage.openAssignments(TEST_USERS.developer.fullName);
    const assignmentsDialog = new ResourceAssignmentsDialog(page);
    await expect(assignmentsDialog.emptyState).toBeVisible();
    await assignmentsDialog.close();

    // Budgets: the project's budget (and its spend entries) cascaded away too.
    const budgetsPage = new BudgetsPage(page);
    await budgetsPage.open();
    await expect(page.getByRole('cell', { name: projectName })).not.toBeVisible();

    // Dashboard: total_projects and budget totals are back to the pre-test baseline.
    const dashboard = new DashboardPage(page);
    await dashboard.open();
    await expect(dashboard.statValue('Total projects')).toHaveText(String(baselineDashboard.total_projects));
    await expect(dashboard.budgetOverviewText).toContainText(
      new RegExp(`${baselineDashboard.budget_spent.toLocaleString()} of ${baselineDashboard.budget_planned.toLocaleString()} spent`),
    );

    await context.close();
  });
});
