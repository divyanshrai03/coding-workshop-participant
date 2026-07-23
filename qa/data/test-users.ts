import { env } from '../config/env';
import type { Role } from '../constants/roles';

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

/**
 * One fixed, known account per role, created idempotently by
 * fixtures/seed.ts before the suite runs. Fixed (not randomly generated per
 * run) so login-based fixtures stay simple and runs stay repeatable.
 *
 * The admin account is special: because of the app's bootstrap-first-admin
 * pattern (see TESTING_PLAN.md §7), it may already exist from a previous
 * run/session, or it may need to be created as the very first user ever.
 * seedTestUsers() in fixtures/seed.ts handles both cases. Override via
 * TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD in qa/.env if this environment
 * already has a different admin bootstrapped.
 */
export const TEST_USERS: Record<Role, TestUser> = {
  admin: {
    email: env.TEST_ADMIN_EMAIL || 'qa.admin@acme-test.com',
    password: env.TEST_ADMIN_PASSWORD || 'QaTest1234!',
    fullName: 'QA Admin',
    role: 'admin',
  },
  project_manager: {
    email: 'qa.pm@acme-test.com',
    password: 'QaTest1234!',
    fullName: 'QA Project Manager',
    role: 'project_manager',
  },
  team_lead: {
    email: 'qa.leader@acme-test.com',
    password: 'QaTest1234!',
    fullName: 'QA Team Lead',
    role: 'team_lead',
  },
  developer: {
    email: 'qa.dev@acme-test.com',
    password: 'QaTest1234!',
    fullName: 'QA Developer',
    role: 'developer',
  },
  viewer: {
    email: 'qa.viewer@acme-test.com',
    password: 'QaTest1234!',
    fullName: 'QA Viewer',
    role: 'viewer',
  },
};
