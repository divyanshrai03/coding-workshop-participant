import { test as base } from './base';
import { apiPath } from '../helpers/api-path';
import { SERVICES } from '../constants/services';
import { TEST_USERS } from '../data/test-users';
import type { Role } from '../constants/roles';

type Fixtures = {
  role: Role;
  accessToken: string;
};

/**
 * Usage: `test.use({ role: 'project_manager' })`, then destructure
 * `accessToken` alongside Playwright's built-in `request` fixture. Logs in
 * fresh per test via the real /login endpoint (fast - no browser involved),
 * relying on fixtures/seed.ts having already provisioned the fixed test
 * accounts (data/test-users.ts) via global-setup.ts.
 */
export const test = base.extend<Fixtures>({
  role: ['viewer', { option: true }],
  accessToken: async ({ request, role }, use) => {
    const user = TEST_USERS[role];
    const response = await request.post(apiPath(SERVICES.auth, '/login'), {
      data: { email: user.email, password: user.password },
    });
    if (!response.ok()) {
      throw new Error(`Login as '${role}' (${user.email}) failed with ${response.status()}. Has the seed step run?`);
    }
    const body = await response.json();
    await use(body.data.access_token);
  },
});

export { expect } from '@playwright/test';
