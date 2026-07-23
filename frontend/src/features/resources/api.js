import { apiClient } from '../../lib/apiClient'

const SERVICE = 'resources-service'

export const resourcesApi = {
  list: (params) => apiClient.get(SERVICE, '/resources', params),
  get: (id) => apiClient.get(SERVICE, `/resources/${id}`),
  workload: () => apiClient.get(SERVICE, '/workload'),
  listAssignments: (params) => apiClient.get(SERVICE, '/assignments', params),
  createAssignment: (payload) => apiClient.post(SERVICE, '/assignments', payload),
  getAssignment: (id) => apiClient.get(SERVICE, `/assignments/${id}`),
  updateAssignment: (id, payload) => apiClient.patch(SERVICE, `/assignments/${id}`, payload),
  removeAssignment: (id) => apiClient.delete(SERVICE, `/assignments/${id}`),
}
