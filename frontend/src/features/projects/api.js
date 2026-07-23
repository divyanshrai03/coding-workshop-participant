import { apiClient } from '../../lib/apiClient'

const SERVICE = 'projects-service'

export const projectsApi = {
  list: (params) => apiClient.get(SERVICE, '/projects', params),
  create: (payload) => apiClient.post(SERVICE, '/projects', payload),
  get: (id) => apiClient.get(SERVICE, `/projects/${id}`),
  update: (id, payload) => apiClient.patch(SERVICE, `/projects/${id}`, payload),
  remove: (id) => apiClient.delete(SERVICE, `/projects/${id}`),
  listDeliverables: (projectId, params) => apiClient.get(SERVICE, `/projects/${projectId}/deliverables`, params),
  createDeliverable: (projectId, payload) => apiClient.post(SERVICE, `/projects/${projectId}/deliverables`, payload),
  getDeliverable: (id) => apiClient.get(SERVICE, `/deliverables/${id}`),
  updateDeliverable: (id, payload) => apiClient.patch(SERVICE, `/deliverables/${id}`, payload),
  removeDeliverable: (id) => apiClient.delete(SERVICE, `/deliverables/${id}`),
  createDependency: (payload) => apiClient.post(SERVICE, '/dependencies', payload),
  removeDependency: (id) => apiClient.delete(SERVICE, `/dependencies/${id}`),
  dashboardSummary: () => apiClient.get(SERVICE, '/dashboard/summary'),
}
