import { apiClient } from '../../lib/apiClient'

const SERVICE = 'auth-service'

export const authApi = {
  login: (email, password) => apiClient.post(SERVICE, '/login', { email, password }),
  register: (payload) => apiClient.post(SERVICE, '/register', payload),
  me: () => apiClient.get(SERVICE, '/me'),
  listUsers: (params) => apiClient.get(SERVICE, '/users', params),
  getUser: (id) => apiClient.get(SERVICE, `/users/${id}`),
  updateUser: (id, payload) => apiClient.patch(SERVICE, `/users/${id}`, payload),
  deactivateUser: (id) => apiClient.delete(SERVICE, `/users/${id}`),
}
