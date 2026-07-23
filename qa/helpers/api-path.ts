import type { ServiceName } from '../constants/services';

/**
 * Builds the "/api/{service-name}/{path}" URL every backend endpoint uses
 * (see TESTING_PLAN.md §6). Centralized here so API tests never hand-roll
 * the prefix and risk drifting from the real convention.
 */
export function apiPath(service: ServiceName, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/${service}${normalizedPath}`;
}
