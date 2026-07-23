import { test, expect } from '../../fixtures/api-auth.fixtures';
import { apiPath } from '../../helpers/api-path';
import { authHeader } from '../../helpers/auth-header';
import { SERVICES } from '../../constants/services';
import { TEST_USERS } from '../../data/test-users';
import { uniqueEmail } from '../../helpers/test-data';

/**
 * Covers every auth-service endpoint (TESTING_PLAN.md §6): register, login,
 * refresh, /me, and user list/get/update/deactivate. RBAC boundaries are
 * exercised directly against the API - not indirectly through the UI - so a
 * frontend bug can never mask a broken backend permission check.
 */
test.describe('auth-service: POST /register', () => {
  test.use({ role: 'admin' });

  test('admin creates a new user with a specific role', async ({ request, accessToken }) => {
    const email = uniqueEmail('register-happy');
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(accessToken),
      data: { email, password: 'supersecret1', full_name: 'API Test User', role: 'developer' },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(body.data).toMatchObject({ email, full_name: 'API Test User', role: 'developer', is_active: true });
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data).not.toHaveProperty('password_hash');
  });

  test('rejects a duplicate email with 409', async ({ request, accessToken }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(accessToken),
      data: { email: TEST_USERS.viewer.email, password: 'supersecret1', full_name: 'Duplicate' },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.message).toMatch(/already exists/i);
  });

  test('rejects registration without authentication once the workspace is bootstrapped', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      data: { email: uniqueEmail('no-auth'), password: 'supersecret1', full_name: 'No Auth' },
    });

    expect(response.status()).toBe(401);
  });

  test('rejects registration from a non-admin caller with 403', async ({ request }) => {
    const viewerLogin = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });
    const viewerToken = (await viewerLogin.json()).data.access_token;

    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(viewerToken),
      data: { email: uniqueEmail('by-viewer'), password: 'supersecret1', full_name: 'By Viewer' },
    });

    expect(response.status()).toBe(403);
  });

  test('rejects a missing required field with 400 and a details payload', async ({ request, accessToken }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(accessToken),
      data: { password: 'supersecret1', full_name: 'No Email' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.details.fields).toContain('email');
  });

  test('rejects a password shorter than 8 characters', async ({ request, accessToken }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(accessToken),
      data: { email: uniqueEmail('short-pw'), password: 'short', full_name: 'Short Password' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects an invalid role enum with 400', async ({ request, accessToken }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(accessToken),
      data: { email: uniqueEmail('bad-role'), password: 'supersecret1', full_name: 'Bad Role', role: 'superuser' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details.allowed).toEqual(
      expect.arrayContaining(['admin', 'project_manager', 'team_lead', 'developer', 'viewer']),
    );
  });
});

test.describe('auth-service: POST /login', () => {
  test('valid credentials return an access token, refresh token, and user profile', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(body.data.refresh_token).toEqual(expect.any(String));
    expect(body.data.user.email).toBe(TEST_USERS.viewer.email);
    expect(body.data.user.role).toBe('viewer');
  });

  test('wrong password returns 401 without revealing whether the email exists', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: 'definitely-wrong' },
    });

    expect(response.status()).toBe(401);
    expect((await response.json()).error.message).toBe('Invalid email or password');
  });

  test('nonexistent email returns the same 401 message as a wrong password', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: 'nobody-at-all@acme-test.com', password: 'whatever123' },
    });

    expect(response.status()).toBe(401);
    expect((await response.json()).error.message).toBe('Invalid email or password');
  });

  test('missing password returns 400', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email },
    });

    expect(response.status()).toBe(400);
  });

  test('a deactivated user cannot log in', async ({ request }) => {
    const adminLogin = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
    });
    const adminToken = (await adminLogin.json()).data.access_token;

    const email = uniqueEmail('deactivate-login-check');
    const registerResponse = await request.post(apiPath(SERVICES.auth, '/register'), {
      headers: authHeader(adminToken),
      data: { email, password: 'supersecret1', full_name: 'To Deactivate' },
    });
    const userId = (await registerResponse.json()).data.id;

    const deactivateResponse = await request.delete(apiPath(SERVICES.auth, `/users/${userId}`), {
      headers: authHeader(adminToken),
    });
    expect(deactivateResponse.status()).toBe(204);
    expect(await deactivateResponse.text()).toBe('');

    const loginResponse = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email, password: 'supersecret1' },
    });
    expect(loginResponse.status()).toBe(401);
  });
});

test.describe('auth-service: POST /refresh', () => {
  test('a valid refresh token returns a new token pair', async ({ request }) => {
    const login = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });
    const { refresh_token: refreshToken } = (await login.json()).data;

    const response = await request.post(apiPath(SERVICES.auth, '/refresh'), { data: { refresh_token: refreshToken } });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(body.data.refresh_token).toEqual(expect.any(String));
  });

  test('a malformed refresh token is rejected with 401', async ({ request }) => {
    const response = await request.post(apiPath(SERVICES.auth, '/refresh'), {
      data: { refresh_token: 'not-a-real-jwt' },
    });

    expect(response.status()).toBe(401);
  });

  test('an access token cannot be used as a refresh token (type mismatch)', async ({ request }) => {
    const login = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });
    const { access_token: accessToken } = (await login.json()).data;

    const response = await request.post(apiPath(SERVICES.auth, '/refresh'), { data: { refresh_token: accessToken } });

    expect(response.status()).toBe(401);
  });
});

test.describe('auth-service: GET /me', () => {
  test.use({ role: 'developer' });

  test('returns the authenticated caller\'s own profile', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/me'), { headers: authHeader(accessToken) });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.email).toBe(TEST_USERS.developer.email);
    expect(body.data.role).toBe('developer');
  });

  test('rejects a request with no Authorization header', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/me'));
    expect(response.status()).toBe(401);
    expect((await response.json()).error.message).toBe('Missing bearer token');
  });

  test('rejects a malformed bearer token', async ({ request }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/me'), {
      headers: { Authorization: 'Bearer garbage.not.a.jwt' },
    });
    expect(response.status()).toBe(401);
  });

  test('rejects a header that does not start with "Bearer "', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/me'), {
      headers: { Authorization: accessToken },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('auth-service: GET /users', () => {
  test.use({ role: 'admin' });

  test('admin lists users with pagination metadata', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/users'), {
      headers: authHeader(accessToken),
      params: { page: '1', page_size: '2' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta).toMatchObject({ page: 1, page_size: 2 });
    expect(body.meta.total).toBeGreaterThanOrEqual(5);
  });

  test('filters by role', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/users'), {
      headers: authHeader(accessToken),
      params: { role: 'viewer' },
    });

    const body = await response.json();
    expect(body.data.every((u: { role: string }) => u.role === 'viewer')).toBe(true);
  });

  test('rejects an invalid role filter with 400', async ({ request, accessToken }) => {
    const response = await request.get(apiPath(SERVICES.auth, '/users'), {
      headers: authHeader(accessToken),
      params: { role: 'not_a_role' },
    });
    expect(response.status()).toBe(400);
  });

  test('non-admin roles are forbidden from listing all users', async ({ request }) => {
    for (const role of ['project_manager', 'team_lead', 'developer', 'viewer'] as const) {
      const login = await request.post(apiPath(SERVICES.auth, '/login'), {
        data: { email: TEST_USERS[role].email, password: TEST_USERS[role].password },
      });
      const token = (await login.json()).data.access_token;

      const response = await request.get(apiPath(SERVICES.auth, '/users'), { headers: authHeader(token) });
      expect(response.status(), `role=${role} should be forbidden`).toBe(403);
    }
  });
});

test.describe('auth-service: GET/PATCH/DELETE /users/{id}', () => {
  test('a user can view their own profile by id', async ({ request }) => {
    const login = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.developer.email, password: TEST_USERS.developer.password },
    });
    const { access_token: token, user } = (await login.json()).data;

    const response = await request.get(apiPath(SERVICES.auth, `/users/${user.id}`), { headers: authHeader(token) });
    expect(response.status()).toBe(200);
  });

  test('a user cannot view a different user\'s profile', async ({ request }) => {
    const viewerLogin = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });
    const viewerToken = (await viewerLogin.json()).data.access_token;

    const devLogin = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.developer.email, password: TEST_USERS.developer.password },
    });
    const devUserId = (await devLogin.json()).data.user.id;

    const response = await request.get(apiPath(SERVICES.auth, `/users/${devUserId}`), {
      headers: authHeader(viewerToken),
    });
    expect(response.status()).toBe(403);
  });

  test('an invalid UUID returns 400, a well-formed but nonexistent UUID returns 404', async ({ request }) => {
    const adminLogin = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
    });
    const adminToken = (await adminLogin.json()).data.access_token;

    const badUuid = await request.get(apiPath(SERVICES.auth, '/users/not-a-uuid'), { headers: authHeader(adminToken) });
    expect(badUuid.status()).toBe(400);

    const missing = await request.get(apiPath(SERVICES.auth, '/users/00000000-0000-0000-0000-000000000000'), {
      headers: authHeader(adminToken),
    });
    expect(missing.status()).toBe(404);
  });

  test('a user can update their own full_name but a role change is silently ignored', async ({ request }) => {
    const login = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.viewer.email, password: TEST_USERS.viewer.password },
    });
    const { access_token: token, user } = (await login.json()).data;

    const response = await request.patch(apiPath(SERVICES.auth, `/users/${user.id}`), {
      headers: authHeader(token),
      data: { full_name: 'Renamed Viewer', role: 'admin' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.full_name).toBe('Renamed Viewer');
    expect(body.data.role).toBe('viewer'); // privilege escalation attempt is ignored, not erred on

    // Restore the name so other tests/UI runs aren't affected by this test's side effect.
    await request.patch(apiPath(SERVICES.auth, `/users/${user.id}`), {
      headers: authHeader(token),
      data: { full_name: TEST_USERS.viewer.fullName },
    });
  });

  test('admin cannot deactivate their own account', async ({ request }) => {
    const login = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
    });
    const { access_token: token, user } = (await login.json()).data;

    const response = await request.delete(apiPath(SERVICES.auth, `/users/${user.id}`), { headers: authHeader(token) });
    expect(response.status()).toBe(400);
  });
});
