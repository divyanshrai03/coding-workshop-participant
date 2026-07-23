import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env';
import { seedTestUsers } from './fixtures/seed';

/**
 * Runs once before the whole suite:
 *  1. Guarantees output directories exist.
 *  2. Ensures the fixed per-role QA test accounts exist (data/test-users.ts),
 *     so every spec's `authenticatedPage` fixture (fixtures/auth.fixtures.ts)
 *     can log in as any role without each test file re-implementing setup.
 *
 * Fails loudly and early on a misconfigured environment rather than as a
 * wall of unrelated connection-refused/401 errors across every test.
 */
export default async function globalSetup(): Promise<void> {
  for (const dir of ['reports', 'screenshots', 'videos']) {
    fs.mkdirSync(path.resolve(__dirname, dir), { recursive: true });
  }

  console.log(`[global-setup] UI target:  ${env.UI_BASE_URL}`);
  console.log(`[global-setup] API target: ${env.API_BASE_URL}`);

  await seedTestUsers();
  console.log('[global-setup] QA test users ready (admin, project_manager, team_lead, developer, viewer)');
}
