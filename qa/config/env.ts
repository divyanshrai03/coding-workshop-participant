import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

/**
 * Single source of truth for environment configuration, read once here so
 * every fixture/config file imports from the same place instead of reaching
 * into `process.env` directly.
 *
 * Defaults match the local dev stack documented in TESTING_PLAN.md §2/§10:
 * - UI_BASE_URL  -> Vite dev server (bin/start-dev.sh)
 * - API_BASE_URL -> local CORS proxy (bin/proxy-server.js), which exposes the
 *   same "/api/{service-name}/*" convention CloudFront uses in AWS.
 */
export const env = {
  UI_BASE_URL: process.env.UI_BASE_URL ?? 'http://localhost:3000',
  API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3001',

  // Left blank until a test-data/seed strategy is finalized (see
  // TESTING_PLAN.md §12, "Test data strategy"). Populated by whichever
  // fixture Phase 3/4 introduces for authenticated sessions.
  TEST_ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL ?? '',
  TEST_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD ?? '',

  IS_CI: Boolean(process.env.CI),
};
