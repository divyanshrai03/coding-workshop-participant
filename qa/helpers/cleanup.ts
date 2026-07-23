import { request, type APIRequestContext } from '@playwright/test';
import { env } from '../config/env';
import { apiPath } from './api-path';
import { authHeader } from './auth-header';
import { SERVICES } from '../constants/services';

/**
 * Deletes every project whose name contains `searchTerm`, via the API
 * (fast, and cascades deliverables/dependencies/assignments/budget per the
 * schema - see TESTING_PLAN.md §5). Used by UI tests that create uniquely
 * named data (helpers/test-data.ts) so repeated runs don't accumulate
 * clutter, even though unique names already prevent collisions.
 */
export async function deleteProjectsByName(accessToken: string, searchTerm: string): Promise<void> {
  const api: APIRequestContext = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.get(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(accessToken),
      params: { search: searchTerm, page_size: '100' },
    });
    const body = await response.json();
    for (const project of body.data ?? []) {
      await api.delete(apiPath(SERVICES.projects, `/projects/${project.id}`), {
        headers: authHeader(accessToken),
      });
    }
  } finally {
    await api.dispose();
  }
}

export async function loginForToken(email: string, password: string): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.auth, '/login'), { data: { email, password } });
    const body = await response.json();
    return body.data.access_token as string;
  } finally {
    await api.dispose();
  }
}
