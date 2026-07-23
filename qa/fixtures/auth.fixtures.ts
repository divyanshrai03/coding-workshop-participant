import { request as pwRequest, type BrowserContextOptions, type Page } from '@playwright/test';
import { test as base } from './base';
import { env } from '../config/env';
import { apiPath } from '../helpers/api-path';
import { SERVICES } from '../constants/services';
import { TEST_USERS } from '../data/test-users';
import type { Role } from '../constants/roles';

async function loginViaApi(role: Role): Promise<{ access_token: string; refresh_token: string; user: unknown }> {
  const user = TEST_USERS[role];
  const api = await pwRequest.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: user.email, password: user.password },
    });
    if (!response.ok()) {
      throw new Error(
        `Login as '${role}' (${user.email}) failed with ${response.status()}. ` +
          'Has the seed step run yet? See global-setup.ts / fixtures/seed.ts.',
      );
    }
    const body = await response.json();
    return body.data;
  } finally {
    await api.dispose();
  }
}

/** Exported for specs that need a role's session outside the `authenticatedPage` fixture (e.g. iterating every role in one test - see rbac.spec.ts). */
export async function storageStateForRole(role: Role): Promise<BrowserContextOptions['storageState']> {
  const session = await loginViaApi(role);
  return {
    cookies: [],
    origins: [
      {
        origin: env.UI_BASE_URL,
        // Matches the shape frontend/src/lib/tokenStore.js reads/writes under
        // this exact key - seeding it directly skips driving the login form
        // for every non-auth test (auth itself is tested for real in
        // tests/ui/auth.spec.ts, which does not use this fixture).
        localStorage: [{ name: 'pm_platform_auth', value: JSON.stringify(session) }],
      },
    ],
  };
}

type Fixtures = {
  role: Role;
  authenticatedPage: Page;
};

/**
 * Usage: `test.use({ role: 'project_manager' })` at the top of a spec file,
 * then destructure `authenticatedPage` instead of `page` in each test. The
 * page starts already logged in as that role - no UI login step needed.
 */
export const test = base.extend<Fixtures>({
  role: ['viewer', { option: true }],
  authenticatedPage: async ({ browser, role }, use) => {
    const storageState = await storageStateForRole(role);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
