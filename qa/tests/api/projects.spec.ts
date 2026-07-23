import { test, expect } from '../../fixtures/api-auth.fixtures';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { deleteProjectsByName, loginForToken } from '../../helpers/cleanup';
import { createDeliverable, createProject } from '../../helpers/api-setup';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { uniqueName } from '../../helpers/test-data';

/**
 * Covers every projects-service endpoint (TESTING_PLAN.md §6): dashboard
 * summary, project CRUD, deliverable CRUD, and dependency links. Write
 * access is gated by auth.require_min_role() at "project_manager" for
 * projects and "team_lead" for deliverables/dependencies - each RBAC
 * boundary below is exercised against the real API, not mocked.
 */
const NAME_PREFIX = 'QA-API-Projects';

test.afterAll(async () => {
  const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  await deleteProjectsByName(adminToken, NAME_PREFIX);
});

test.describe('projects-service: GET /dashboard/summary', () => {
  test.use({ role: 'viewer' });

  test('returns the aggregate dashboard shape for any authenticated role', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/dashboard/summary'), {
      headers: authHeader(accessToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        total_projects: expect.any(Number),
        projects_by_status: expect.any(Object),
        projects_by_risk: expect.any(Object),
        delayed_project_count: expect.any(Number),
        total_deliverables: expect.any(Number),
        completed_deliverables: expect.any(Number),
        deliverable_completion_percent: expect.any(Number),
        upcoming_deadlines: expect.any(Array),
      }),
    );
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/dashboard/summary'));
    expect(response.status()).toBe(401);
  });
});

test.describe('projects-service: GET /projects (list)', () => {
  test.use({ role: 'project_manager' });
  let projectName: string;
  let pmToken: string;

  test.beforeAll(async () => {
    pmToken = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    projectName = uniqueName(`${NAME_PREFIX}-List`);
    await createProject(pmToken, projectName, { status: 'active', risk_level: 'high' });
  });

  test('lists projects with a pagination envelope', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(accessToken),
      params: { page: '1', page_size: '5' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.meta).toMatchObject({ page: 1, page_size: 5 });
  });

  test('filters by status and risk_level', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(accessToken),
      params: { status: 'active', risk_level: 'high', search: NAME_PREFIX },
    });

    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every((p: { status: string; risk_level: string }) => p.status === 'active' && p.risk_level === 'high'),
    ).toBe(true);
  });

  test('search narrows results to matching names', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(accessToken),
      params: { search: projectName },
    });

    const body = await response.json();
    expect(body.data.map((p: { name: string }) => p.name)).toContain(projectName);
  });

  test('rejects an invalid status filter with 400', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(accessToken),
      params: { status: 'not_a_status' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.projects, '/projects'));
    expect(response.status()).toBe(401);
  });
});

test.describe('projects-service: POST /projects (create)', () => {
  test('project_manager creates a project with default status/risk_level', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.project_manager.email, TEST_USERS.project_manager.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: uniqueName(`${NAME_PREFIX}-Create`) },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ status: 'planning', risk_level: 'low' });
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('team_lead is forbidden from creating a project', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: uniqueName(`${NAME_PREFIX}-Forbidden`) },
    });
    expect(response.status()).toBe(403);
  });

  test('rejects a missing name with 400', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { description: 'no name provided' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a whitespace-only name with 400', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: '   ' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects an invalid status enum with 400', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: uniqueName(`${NAME_PREFIX}-BadStatus`), status: 'not_a_status' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects an owner_id that does not reference an existing user', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: uniqueName(`${NAME_PREFIX}-BadOwner`), owner_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/owner_id/);
  });

  test('rejects an end_date before the start_date', async ({ request }) => {
    const token = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    const response = await request.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name: uniqueName(`${NAME_PREFIX}-BadDates`), start_date: '2026-06-01', end_date: '2026-01-01' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toMatch(/end_date/);
  });
});

test.describe('projects-service: GET/PATCH/DELETE /projects/{id}', () => {
  let projectId: string;
  let adminToken: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Detail`));
  });

  test('returns project detail including completion_percent, is_delayed, and budget fields', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(adminToken),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        id: projectId,
        completion_percent: 0,
        is_delayed: false,
        spent_amount: expect.anything(),
      }),
    );
  });

  test('returns 404 for a well-formed but nonexistent id, 400 for a malformed one', async ({ request }) => {
    const missing = await request.get(apiPath(SERVICES.projects, '/projects/00000000-0000-0000-0000-000000000000'), {
      headers: authHeader(adminToken),
    });
    expect(missing.status()).toBe(404);

    const malformed = await request.get(apiPath(SERVICES.projects, '/projects/not-a-uuid'), {
      headers: authHeader(adminToken),
    });
    expect(malformed.status()).toBe(400);
  });

  test('project_manager+ can update a project; team_lead cannot', async ({ request }) => {
    const updateResponse = await request.patch(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(adminToken),
      data: { status: 'active', risk_level: 'medium' },
    });
    expect(updateResponse.status()).toBe(200);
    expect((await updateResponse.json()).data).toMatchObject({ status: 'active', risk_level: 'medium' });

    const teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    const forbidden = await request.patch(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(teamLeadToken),
      data: { status: 'on_hold' },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('rejects an update with no updatable fields', async ({ request }) => {
    const response = await request.patch(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(adminToken),
      data: { not_a_real_field: true },
    });
    expect(response.status()).toBe(400);
  });

  test('deletes a project; a repeated delete returns 404', async ({ request }) => {
    const first = await request.delete(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(adminToken),
    });
    expect(first.status()).toBe(204);

    const second = await request.delete(apiPath(SERVICES.projects, `/projects/${projectId}`), {
      headers: authHeader(adminToken),
    });
    expect(second.status()).toBe(404);
  });

  test('developer is forbidden from deleting a project', async ({ request }) => {
    const otherId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-DeleteGuard`));
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const response = await request.delete(apiPath(SERVICES.projects, `/projects/${otherId}`), {
      headers: authHeader(devToken),
    });
    expect(response.status()).toBe(403);
  });
});

test.describe('projects-service: deliverables', () => {
  let projectId: string;
  let adminToken: string;
  let teamLeadToken: string;

  test.beforeAll(async () => {
    adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);
    projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Deliverables`));
  });

  test('team_lead creates a deliverable; developer is forbidden', async ({ request }) => {
    const created = await request.post(apiPath(SERVICES.projects, `/projects/${projectId}/deliverables`), {
      headers: authHeader(teamLeadToken),
      data: { name: uniqueName('Deliverable') },
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).data.status).toBe('not_started');

    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const forbidden = await request.post(apiPath(SERVICES.projects, `/projects/${projectId}/deliverables`), {
      headers: authHeader(devToken),
      data: { name: uniqueName('Deliverable') },
    });
    expect(forbidden.status()).toBe(403);
  });

  test('returns 404 when creating a deliverable under a nonexistent project', async ({ request }) => {
    const response = await request.post(
      apiPath(SERVICES.projects, '/projects/00000000-0000-0000-0000-000000000000/deliverables'),
      { headers: authHeader(teamLeadToken), data: { name: 'Orphan' } },
    );
    expect(response.status()).toBe(404);
  });

  test('rejects a deliverable with a missing name', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.projects, `/projects/${projectId}/deliverables`), {
      headers: authHeader(teamLeadToken),
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test('lists and filters deliverables for a project', async ({ request }) => {
    const name = uniqueName('Filterable Deliverable');
    await createDeliverable(teamLeadToken, projectId, name, { status: 'in_progress' });

    const response = await request.get(apiPath(SERVICES.projects, `/projects/${projectId}/deliverables`), {
      headers: authHeader(teamLeadToken),
      params: { status: 'in_progress', search: name },
    });
    const body = await response.json();
    expect(body.data.map((d: { name: string }) => d.name)).toContain(name);
  });

  test.describe('single deliverable lifecycle', () => {
    let deliverableId: string;

    test.beforeAll(async () => {
      deliverableId = await createDeliverable(teamLeadToken, projectId, uniqueName('Lifecycle Deliverable'));
    });

    test('detail includes blocked_by and blocking dependency arrays', async ({ request }) => {
      const response = await request.get(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(adminToken),
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.blocked_by).toEqual([]);
      expect(body.data.blocking).toEqual([]);
    });

    test('developer can update status only, not name; viewer cannot update at all', async ({ request }) => {
      const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);

      const statusUpdate = await request.patch(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(devToken),
        data: { status: 'in_progress' },
      });
      expect(statusUpdate.status()).toBe(200);
      expect((await statusUpdate.json()).data.status).toBe('in_progress');

      const nameUpdate = await request.patch(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(devToken),
        data: { name: 'Should not be allowed' },
      });
      expect(nameUpdate.status()).toBe(400); // name isn't in the developer's allowed field set - no updatable fields remain

      const viewerToken = await loginForToken(TEST_USERS.viewer.email, TEST_USERS.viewer.password);
      const viewerUpdate = await request.patch(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(viewerToken),
        data: { status: 'completed' },
      });
      expect(viewerUpdate.status()).toBe(403);
    });

    test('setting status to completed stamps completed_at', async ({ request }) => {
      const response = await request.patch(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(teamLeadToken),
        data: { status: 'completed' },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).data.completed_at).not.toBeNull();
    });

    test('team_lead deletes the deliverable; a repeated delete 404s', async ({ request }) => {
      const first = await request.delete(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(teamLeadToken),
      });
      expect(first.status()).toBe(204);

      const second = await request.delete(apiPath(SERVICES.projects, `/deliverables/${deliverableId}`), {
        headers: authHeader(teamLeadToken),
      });
      expect(second.status()).toBe(404);
    });
  });
});

test.describe('projects-service: dependencies', () => {
  let deliverableA: string;
  let deliverableB: string;
  let teamLeadToken: string;

  test.beforeAll(async () => {
    const adminToken = await loginForToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
    teamLeadToken = await loginForToken(TEST_USERS.team_lead.email, TEST_USERS.team_lead.password);

    const projectId = await createProject(adminToken, uniqueName(`${NAME_PREFIX}-Dependencies`));
    deliverableA = await createDeliverable(teamLeadToken, projectId, 'Dependency A');
    deliverableB = await createDeliverable(teamLeadToken, projectId, 'Dependency B');
  });

  test('team_lead links two deliverables, visible on both sides of get_deliverable()', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB, dependency_type: 'blocks' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB });
    const dependencyId = body.data.id;

    // deliverable_id=A, depends_on_deliverable_id=B means "A depends on B" - B blocks A,
    // so A's blocked_by lists B and B's blocking lists A.
    const aDetail = await request.get(apiPath(SERVICES.projects, `/deliverables/${deliverableA}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(
      (await aDetail.json()).data.blocked_by.map((d: { deliverable_id: string }) => d.deliverable_id),
    ).toContain(deliverableB);

    const bDetail = await request.get(apiPath(SERVICES.projects, `/deliverables/${deliverableB}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(
      (await bDetail.json()).data.blocking.map((d: { deliverable_id: string }) => d.deliverable_id),
    ).toContain(deliverableA);

    // Clean up so later tests in this block start from a known (no-dependency) state.
    await request.delete(apiPath(SERVICES.projects, `/dependencies/${dependencyId}`), { headers: authHeader(teamLeadToken) });
  });

  test('rejects a deliverable depending on itself', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableA },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects a duplicate dependency edge with 409', async ({ request }) => {
    const first = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB },
    });
    expect(first.status()).toBe(201);
    const dependencyId = (await first.json()).data.id;

    const duplicate = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB },
    });
    expect(duplicate.status()).toBe(409);

    await request.delete(apiPath(SERVICES.projects, `/dependencies/${dependencyId}`), { headers: authHeader(teamLeadToken) });
  });

  test('rejects the reverse edge as a circular dependency with 409', async ({ request }) => {
    const forward = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB },
    });
    const dependencyId = (await forward.json()).data.id;

    const reverse = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableB, depends_on_deliverable_id: deliverableA },
    });
    expect(reverse.status()).toBe(409);
    expect((await reverse.json()).error.message).toMatch(/circular/i);

    await request.delete(apiPath(SERVICES.projects, `/dependencies/${dependencyId}`), { headers: authHeader(teamLeadToken) });
  });

  test('rejects a dependency referencing a nonexistent deliverable', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(response.status()).toBe(400);
  });

  test('developer is forbidden from creating dependencies', async ({ request }) => {
    const devToken = await loginForToken(TEST_USERS.developer.email, TEST_USERS.developer.password);
    const response = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(devToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB },
    });
    expect(response.status()).toBe(403);
  });

  test('deleting a dependency twice returns 404 the second time', async ({ request }) => {
    const created = await request.post(apiPath(SERVICES.projects, '/dependencies'), {
      headers: authHeader(teamLeadToken),
      data: { deliverable_id: deliverableA, depends_on_deliverable_id: deliverableB },
    });
    const dependencyId = (await created.json()).data.id;

    const first = await request.delete(apiPath(SERVICES.projects, `/dependencies/${dependencyId}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(first.status()).toBe(204);

    const second = await request.delete(apiPath(SERVICES.projects, `/dependencies/${dependencyId}`), {
      headers: authHeader(teamLeadToken),
    });
    expect(second.status()).toBe(404);
  });
});
