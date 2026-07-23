/**
 * The 4 backend Lambda services, matching the "/api/{service-name}/*"
 * convention used by both the local proxy and CloudFront. See
 * TESTING_PLAN.md §6 (API Inventory) for the full endpoint list per service.
 */
export const SERVICES = {
  auth: 'auth-service',
  projects: 'projects-service',
  resources: 'resources-service',
  budgets: 'budgets-service',
} as const;

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES];
