import { apiClient } from '../../lib/apiClient'

const SERVICE = 'budgets-service'

export const budgetsApi = {
  list: (params) => apiClient.get(SERVICE, '/budgets', params),
  create: (payload) => apiClient.post(SERVICE, '/budgets', payload),
  get: (id) => apiClient.get(SERVICE, `/budgets/${id}`),
  update: (id, payload) => apiClient.patch(SERVICE, `/budgets/${id}`, payload),
  remove: (id) => apiClient.delete(SERVICE, `/budgets/${id}`),
  listEntries: (budgetId, params) => apiClient.get(SERVICE, `/budgets/${budgetId}/entries`, params),
  createEntry: (budgetId, payload) => apiClient.post(SERVICE, `/budgets/${budgetId}/entries`, payload),
  removeEntry: (id) => apiClient.delete(SERVICE, `/entries/${id}`),
  summary: () => apiClient.get(SERVICE, '/budgets/summary'),
}
