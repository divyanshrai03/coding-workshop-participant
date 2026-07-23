/** Mirrors frontend/src/app/routes.jsx - the routed pages available for UI automation. */
export const ROUTES = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  projects: '/projects',
  projectDetail: (id: string): string => `/projects/${id}`,
  resources: '/resources',
  budgets: '/budgets',
} as const;
