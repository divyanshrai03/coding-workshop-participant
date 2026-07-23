import { request, type APIRequestContext } from '@playwright/test';
import { env } from '../config/env';
import { apiPath } from '../helpers/api-path';
import { authHeader } from '../helpers/auth-header';
import { SERVICES } from '../constants/services';
import { TEST_USERS, type TestUser } from '../data/test-users';

/**
 * Idempotently ensures the fixed QA test accounts (data/test-users.ts) exist.
 * Handles both a brand-new environment (bootstraps the admin as the very
 * first user - see TESTING_PLAN.md §7) and an already-initialized one (logs
 * in as the existing admin). Safe to call at the start of every run; never
 * fails on "already exists".
 */
export async function seedTestUsers(): Promise<void> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const adminToken = await ensureAdmin(api, TEST_USERS.admin);

    for (const user of Object.values(TEST_USERS)) {
      if (user.role === 'admin') continue;
      await ensureUser(api, adminToken, user);
    }
  } finally {
    await api.dispose();
  }
}

async function ensureAdmin(api: APIRequestContext, admin: TestUser): Promise<string> {
  const loginResponse = await api.post(apiPath(SERVICES.auth, '/login'), {
    data: { email: admin.email, password: admin.password },
  });
  if (loginResponse.ok()) {
    const body = await loginResponse.json();
    return body.data.access_token as string;
  }

  // No account with these credentials - only valid if this is a brand-new,
  // never-bootstrapped environment (backend/auth-service function.py register()).
  const registerResponse = await api.post(apiPath(SERVICES.auth, '/register'), {
    data: { email: admin.email, password: admin.password, full_name: admin.fullName },
  });
  if (!registerResponse.ok()) {
    throw new Error(
      `Could not establish a QA admin session for '${admin.email}': login failed (workspace may already ` +
        `have a different admin) and bootstrap registration also failed with ${registerResponse.status()}. ` +
        'Set TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD in qa/.env to match this environment\'s actual admin.',
    );
  }

  const loginAfterRegister = await api.post(apiPath(SERVICES.auth, '/login'), {
    data: { email: admin.email, password: admin.password },
  });
  const body = await loginAfterRegister.json();
  return body.data.access_token as string;
}

async function ensureUser(api: APIRequestContext, adminToken: string, user: TestUser): Promise<void> {
  const response = await api.post(apiPath(SERVICES.auth, '/register'), {
    headers: authHeader(adminToken),
    data: { email: user.email, password: user.password, full_name: user.fullName, role: user.role },
  });
  // 201 created, 409 already exists - both are success for an idempotent seed.
  if (!response.ok() && response.status() !== 409) {
    throw new Error(`Failed to seed QA user ${user.email}: ${response.status()} ${await response.text()}`);
  }
}
