import { test, expect } from '../../fixtures/api-auth.fixtures';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createBudget, createProject } from '../../helpers/api-setup';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/**
 * Covers every budgets-service endpoint (TESTING_PLAN.md §6): the summary
 * aggregate, budget CRUD, and spend-entry CRUD. Budget/entry writes are
 * gated at "project_manager"+, but deleting a whole budget (which wipes its
 * spend history) is deliberately restricted to "admin" only via
 * require_role() rather than require_min_role() - project_manager can create
 * a budget but not delete one, an asymmetry worth testing explicitly.
 */
const NAME_PREFIX = 'QA-API-Budgets';

test.afterAll(async () => {
  const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  await deleteProjectsByName(adminToken, NAME_PREFIX);
});

test.describe('budgets-service: GET /budgets/summary', () => {
  test.use({ role: 'viewer' });

  test('returns the aggregate summary shape', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.budgets, '/budgets/summary'), {
      headers: authHeader(accessToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        total_planned: expect.anything(),
        total_spent: expect.anything(),
        by_project: expect.any(Array),
        by_category: expect.any(Array),
      }),
    );
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.budgets, '/budgets/summary'));
    expect(response.status()).toBe(401);
  });
});

test.describe('budgets-service: GET /budgets (list)', () => {
  let projectId: string;
  let pmToken: string;

  test.beforeAll(async () => {
    pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    projectId = await createProject(pmToken, uniqueName(`${NAME_PREFIX}-List`));
    await createBudget(pmToken, projectId, '5000.00');
  });

  test('filters by project_id and returns a pagination envelope', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      params: { project_id: projectId },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0]).toMatchObject({ project_id: projectId, planned_amount: 5000 });
    expect(body.meta).toEqual(expect.objectContaining({ page: 1, total: 1 }));
  });

  test('rejects an invalid project_id filter with 400', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      params: { project_id: 'not-a-uuid' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.budgets, '/budgets'));
    expect(response.status()).toBe(401);
  });
});

test.describe('budgets-service: POST /budgets (create)', () => {
  test('project_manager creates a budget with a default USD currency', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(pmToken, uniqueName(`${NAME_PREFIX}-Create`));

    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { project_id: projectId, planned_amount: '10000' },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ project_id: projectId, planned_amount: 10000, currency: 'USD', spent_amount: 0 });
  });

  test('team_lead is forbidden from creating a budget', async ({ request }) => {
    const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Forbidden`));
    const teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);

    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, planned_amount: '1000' },
    });
    expect(response.status()).toBe(403);
  });

  test('rejects a missing required field with 400', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { planned_amount: '1000' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a second budget for the same project with 409', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(pmToken, uniqueName(`${NAME_PREFIX}-Duplicate`));
    await createBudget(pmToken, projectId, '2000');

    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { project_id: projectId, planned_amount: '3000' },
    });
    expect(response.status()).toBe(409);
  });

  test('rejects an invalid currency code', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(pmToken, uniqueName(`${NAME_PREFIX}-BadCurrency`));

    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { project_id: projectId, planned_amount: '1000', currency: 'DOLLARS' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a negative planned_amount', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(pmToken, uniqueName(`${NAME_PREFIX}-Negative`));

    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { project_id: projectId, planned_amount: '-500' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a project_id that does not reference an existing project', async ({ request }) => {
    const pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const response = await request.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(pmToken),
      data: { project_id: '00000000-0000-0000-0000-000000000000', planned_amount: '1000' },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('budgets-service: GET/PATCH/DELETE /budgets/{id}', () => {
  let budgetId: string;
  let pmToken: string;
  let adminToken: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Detail`));
    budgetId = await createBudget(pmToken, projectId, '4000');
  });

  test('returns budget detail with remaining_amount and percent_used', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(adminToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ planned_amount: 4000, spent_amount: 0, remaining_amount: 4000, percent_used: 0 });
  });

  test('returns 404 for a nonexistent budget, 400 for a malformed id', async ({ request }) => {
    const missing = await request.get(apiPath(SERVICES.budgets, '/budgets/00000000-0000-0000-0000-000000000000'), {
      headers: authHeader(adminToken),
    });
    expect(missing.status()).toBe(404);

    const malformed = await request.get(apiPath(SERVICES.budgets, '/budgets/not-a-uuid'), {
      headers: authHeader(adminToken),
    });
    expect(malformed.status()).toBe(400);
  });

  test('project_manager updates planned_amount and currency; team_lead cannot', async ({ request }) => {
    const response = await request.patch(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(pmToken),
      data: { planned_amount: '5500', currency: 'EUR' },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ planned_amount: 5500, currency: 'EUR' });

    const teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const forbidden = await request.patch(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(teamLeadToken),
      data: { planned_amount: '1' },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('rejects an update with no updatable fields', async ({ request }) => {
    const response = await request.patch(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(pmToken),
      data: { project_id: '00000000-0000-0000-0000-000000000000' }, // project_id is intentionally not updatable
    });
    expect(response.status()).toBe(400);
  });

  test('project_manager is forbidden from deleting a budget; only admin can', async ({ request }) => {
    const pmDelete = await request.delete(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(pmToken),
    });
    expect(pmDelete.status()).toBe(403);

    const adminDelete = await request.delete(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(adminToken),
    });
    expect(adminDelete.status()).toBe(204);

    const repeated = await request.delete(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(adminToken),
    });
    expect(repeated.status()).toBe(404);
  });
});

test.describe('budgets-service: spend entries', () => {
  let budgetId: string;
  let pmToken: string;

  test.beforeAll(async () => {
    const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Entries`));
    budgetId = await createBudget(pmToken, projectId, '1000');
  });

  test('project_manager records a spend entry; developer is forbidden', async ({ request }) => {
    const created = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: 'travel', amount: '150.50', description: 'Client visit' },
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).data).toMatchObject({ budget_id: budgetId, category: 'travel', amount: 150.5 });

    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const forbidden = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(devToken),
      data: { category: 'travel', amount: '10' },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('rejects an entry with a missing amount, empty category, or negative amount', async ({ request }) => {
    const missingAmount = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: 'software' },
    });
    expect(missingAmount.status()).toBe(400);

    const emptyCategory = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: '   ', amount: '10' },
    });
    expect(emptyCategory.status()).toBe(400);

    const negativeAmount = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: 'software', amount: '-5' },
    });
    expect(negativeAmount.status()).toBe(400);
  });

  test('returns 404 when listing entries for a nonexistent budget', async ({ request }) => {
    const response = await request.get(
      apiPath(SERVICES.budgets, '/budgets/00000000-0000-0000-0000-000000000000/entries'),
      { headers: authHeader(pmToken) },
    );
    expect(response.status()).toBe(404);
  });

  test('filters entries by category, and spend rolls up into the budget percent_used', async ({ request }) => {
    const uniqueCategory = `training-${Date.now()}`;
    await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: uniqueCategory, amount: '250' },
    });

    const listResponse = await request.get(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      params: { category: uniqueCategory },
    });
    const listBody = await listResponse.json();
    expect(listBody.data.every((e: { category: string }) => e.category === uniqueCategory)).toBe(true);
    expect(listBody.data.length).toBeGreaterThan(0);

    const budgetResponse = await request.get(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
      headers: authHeader(pmToken),
    });
    const budgetBody = await budgetResponse.json();
    expect(budgetBody.data.spent_amount).toBeGreaterThan(0);
    expect(budgetBody.data.percent_used).toBeGreaterThan(0);
  });

  test('project_manager deletes an entry; a repeated delete 404s; developer is forbidden', async ({ request }) => {
    const created = await request.post(apiPath(SERVICES.budgets, `/budgets/${budgetId}/entries`), {
      headers: authHeader(pmToken),
      data: { category: 'to-delete', amount: '42' },
    });
    const entryId = (await created.json()).data.id;

    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const forbidden = await request.delete(apiPath(SERVICES.budgets, `/entries/${entryId}`), {
      headers: authHeader(devToken),
    });
    expect(forbidden.status()).toBe(403);

    const first = await request.delete(apiPath(SERVICES.budgets, `/entries/${entryId}`), { headers: authHeader(pmToken) });
    expect(first.status()).toBe(204);

    const second = await request.delete(apiPath(SERVICES.budgets, `/entries/${entryId}`), { headers: authHeader(pmToken) });
    expect(second.status()).toBe(404);
  });
});
