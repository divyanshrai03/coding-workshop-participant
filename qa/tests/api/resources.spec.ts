import { test, expect } from '../../fixtures/api-auth.fixtures';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createAssignment, createProject, currentUserId } from '../../helpers/api-setup';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/**
 * Covers every resources-service endpoint (TESTING_PLAN.md §6): the read-only
 * roster/workload views and the assignment CRUD that backs them. Write
 * access to assignments is gated by auth.require_min_role() at "team_lead";
 * the roster/workload views are readable by any authenticated role.
 */
const NAME_PREFIX = 'QA-API-Resources';

test.afterAll(async () => {
  const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  await deleteProjectsByName(adminToken, NAME_PREFIX);
});

test.describe('resources-service: GET /resources', () => {
  test.use({ role: 'viewer' });

  test('lists resources with computed workload fields', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/resources'), {
      headers: authHeader(accessToken),
      params: { page_size: '10' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        full_name: expect.any(String),
        is_overallocated: expect.any(Boolean),
      }),
    );
  });

  test('filters by role and search', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/resources'), {
      headers: authHeader(accessToken),
      params: { role: 'developer', search: TEST_USERS.developer.fullName },
    });

    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((r: { role: string }) => r.role === 'developer')).toBe(true);
  });

  test('rejects an invalid role filter with 400', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/resources'), {
      headers: authHeader(accessToken),
      params: { role: 'not_a_role' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/resources'));
    expect(response.status()).toBe(401);
  });
});

test.describe('resources-service: GET /resources/{id}', () => {
  test.use({ role: 'viewer' });

  test("returns a resource's profile plus their assignments array", async ({ request, accessToken }) => {
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const devId = await currentUserId(devToken);

    const response = await request.get(apiPath(SERVICES.resources, `/resources/${devId}`), {
      headers: authHeader(accessToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(devId);
    expect(Array.isArray(body.data.assignments)).toBe(true);
  });

  test('returns 404 for a nonexistent id, 400 for a malformed one', async ({ request, accessToken }) => {
    const missing = await request.get(apiPath(SERVICES.resources, '/resources/00000000-0000-0000-0000-000000000000'), {
      headers: authHeader(accessToken),
    });
    expect(missing.status()).toBe(404);

    const malformed = await request.get(apiPath(SERVICES.resources, '/resources/not-a-uuid'), {
      headers: authHeader(accessToken),
    });
    expect(malformed.status()).toBe(400);
  });
});

test.describe('resources-service: GET /workload', () => {
  test.use({ role: 'project_manager' });

  test('returns per-resource rows and a team-wide summary', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/workload'), { headers: authHeader(accessToken) });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data.resources)).toBe(true);
    expect(body.data.summary).toEqual(
      expect.objectContaining({
        total_resources: expect.any(Number),
        overallocated_count: expect.any(Number),
        underallocated_count: expect.any(Number),
        average_allocation_percent: expect.any(Number),
      }),
    );
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/workload'));
    expect(response.status()).toBe(401);
  });
});

test.describe('resources-service: POST /assignments (create)', () => {
  let projectId: string;
  let adminToken: string;
  let teamLeadToken: string;
  let devId: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Create`));
    devId = await currentUserId(devToken);
  });

  test.afterEach(async ({ request }) => {
    // Keep the developer free of lingering allocation between tests in this block,
    // so allocation-range assertions never depend on execution order.
    const list = await request.get(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(adminToken),
      params: { user_id: devId, project_id: projectId },
    });
    const body = await list.json();
    for (const assignment of body.data ?? []) {
      await request.delete(apiPath(SERVICES.resources, `/assignments/${assignment.id}`), { headers: authHeader(adminToken) });
    }
  });

  test('team_lead creates an assignment with a default 100% allocation', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ project_id: projectId, user_id: devId, allocation_percent: 100 });
  });

  test('developer is forbidden from creating an assignment', async ({ request }) => {
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const response = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(devToken),
      data: { project_id: projectId, user_id: devId },
    });
    expect(response.status()).toBe(403);
  });

  test('rejects a missing required field with 400', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects allocation_percent outside 1-100', async ({ request }) => {
    const tooLow = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId, allocation_percent: 0 },
    });
    expect(tooLow.status()).toBe(400);

    const tooHigh = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId, allocation_percent: 101 },
    });
    expect(tooHigh.status()).toBe(400);
  });

  test('rejects a project_id that does not reference an existing project', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: '00000000-0000-0000-0000-000000000000', user_id: devId },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects an end_date before the start_date', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId, start_date: '2026-06-01', end_date: '2026-01-01' },
    });
    expect(response.status()).toBe(400);
  });

  test('overallocating a resource above 100% is reflected in is_overallocated', async ({ request }) => {
    await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId, allocation_percent: 70 },
    });
    await request.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(teamLeadToken),
      data: { project_id: projectId, user_id: devId, allocation_percent: 60 },
    });

    const response = await request.get(apiPath(SERVICES.resources, `/resources/${devId}`), {
      headers: authHeader(adminToken),
    });
    const body = await response.json();
    expect(body.data.total_allocation_percent).toBeGreaterThan(100);
    expect(body.data.is_overallocated).toBe(true);
  });
});

test.describe('resources-service: GET /assignments (list) and /assignments/{id}', () => {
  let projectId: string;
  let assignmentId: string;
  let adminToken: string;
  let teamLeadToken: string;
  let devId: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-List`));
    devId = await currentUserId(devToken);
    assignmentId = await createAssignment(teamLeadToken, projectId, devId, { allocation_percent: 40 });
  });

  test('filters the assignment list by project_id and user_id', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(adminToken),
      params: { project_id: projectId, user_id: devId },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.map((a: { id: string }) => a.id)).toContain(assignmentId);
  });

  test('rejects an invalid project_id filter with 400', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(adminToken),
      params: { project_id: 'not-a-uuid' },
    });
    expect(response.status()).toBe(400);
  });

  test('returns assignment detail with joined project/deliverable/user names', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(adminToken),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({ id: assignmentId, project_name: expect.any(String), user_full_name: expect.any(String) }),
    );
  });

  test('returns 404 for a nonexistent assignment id', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/assignments/00000000-0000-0000-0000-000000000000'), {
      headers: authHeader(adminToken),
    });
    expect(response.status()).toBe(404);
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.resources, '/assignments'));
    expect(response.status()).toBe(401);
  });
});

test.describe('resources-service: PATCH/DELETE /assignments/{id}', () => {
  let projectId: string;
  let adminToken: string;
  let teamLeadToken: string;
  let devId: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Update`));
    devId = await currentUserId(devToken);
  });

  test('team_lead updates allocation_percent', async ({ request }) => {
    const assignmentId = await createAssignment(teamLeadToken, projectId, devId, { allocation_percent: 50 });
    const response = await request.patch(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(teamLeadToken),
      data: { allocation_percent: 80 },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.allocation_percent).toBe(80);
  });

  test('rejects an update with no updatable fields', async ({ request }) => {
    const assignmentId = await createAssignment(teamLeadToken, projectId, devId, { allocation_percent: 50 });
    const response = await request.patch(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(teamLeadToken),
      data: { user_id: devId }, // user_id is intentionally not updatable once an assignment exists
    });
    expect(response.status()).toBe(400);
  });

  test('developer is forbidden from updating or deleting an assignment', async ({ request }) => {
    const assignmentId = await createAssignment(teamLeadToken, projectId, devId, { allocation_percent: 50 });
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);

    const update = await request.patch(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(devToken),
      data: { allocation_percent: 10 },
    });
    expect(update.status()).toBe(403);

    const remove = await request.delete(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(devToken),
    });
    expect(remove.status()).toBe(403);
  });

  test('team_lead deletes an assignment; a repeated delete returns 404', async ({ request }) => {
    const assignmentId = await createAssignment(teamLeadToken, projectId, devId, { allocation_percent: 50 });
    const first = await request.delete(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(first.status()).toBe(204);

    const second = await request.delete(apiPath(SERVICES.resources, `/assignments/${assignmentId}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(second.status()).toBe(404);
  });
});
