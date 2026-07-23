import { request } from '@playwright/test';
import { env } from '../config/env';
import { apiPath } from './api-path';
import { authHeader } from './auth-header';
import { SERVICES } from '../constants/services';

/**
 * API-based test-data setup, used by UI specs to arrange state quickly and
 * reliably instead of clicking through the UI for every prerequisite (e.g. a
 * deliverable-CRUD test needs a project to already exist - creating it via
 * API keeps the test focused on the behavior actually under test).
 */

export async function createProject(token: string, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.projects, '/projects'), {
      headers: authHeader(token),
      data: { name, ...extra },
    });
    const body = await response.json();
    return body.data.id as string;
  } finally {
    await api.dispose();
  }
}

export async function createDeliverable(
  token: string,
  projectId: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.projects, `/projects/${projectId}/deliverables`), {
      headers: authHeader(token),
      data: { name, ...extra },
    });
    const body = await response.json();
    return body.data.id as string;
  } finally {
    await api.dispose();
  }
}

export async function createAssignment(
  token: string,
  projectId: string,
  userId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.resources, '/assignments'), {
      headers: authHeader(token),
      data: { project_id: projectId, user_id: userId, ...extra },
    });
    const body = await response.json();
    return body.data.id as string;
  } finally {
    await api.dispose();
  }
}

export async function createBudget(
  token: string,
  projectId: string,
  plannedAmount: string | number,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.post(apiPath(SERVICES.budgets, '/budgets'), {
      headers: authHeader(token),
      data: { project_id: projectId, planned_amount: plannedAmount, ...extra },
    });
    const body = await response.json();
    return body.data.id as string;
  } finally {
    await api.dispose();
  }
}

export async function currentUserId(token: string): Promise<string> {
  const api = await request.newContext({ baseURL: env.API_BASE_URL });
  try {
    const response = await api.get(apiPath(SERVICES.auth, '/me'), { headers: authHeader(token) });
    const body = await response.json();
    return body.data.id as string;
  } finally {
    await api.dispose();
  }
}
