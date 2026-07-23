import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from './api'

export function useProjectsQuery(params) {
  return useQuery({ queryKey: ['projects', 'list', params], queryFn: () => projectsApi.list(params) })
}

export function useProjectQuery(id) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
  })
}

export function useDashboardSummaryQuery() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => projectsApi.dashboardSummary() })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => projectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => projectsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })
}

export function useDeliverablesQuery(projectId, params) {
  return useQuery({
    queryKey: ['deliverables', 'list', projectId, params],
    queryFn: () => projectsApi.listDeliverables(projectId, params),
    enabled: Boolean(projectId),
  })
}

export function useDeliverableQuery(id) {
  return useQuery({
    queryKey: ['deliverables', 'detail', id],
    queryFn: () => projectsApi.getDeliverable(id),
    enabled: Boolean(id),
  })
}

export function useCreateDeliverable(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => projectsApi.createDeliverable(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'list', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
    },
  })
}

export function useUpdateDeliverable(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => projectsApi.updateDeliverable(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'list', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
    },
  })
}

export function useDeleteDeliverable(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => projectsApi.removeDeliverable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'list', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
    },
  })
}

export function useCreateDependency(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => projectsApi.createDependency(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'list', projectId] })
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'detail'] })
    },
  })
}

export function useDeleteDependency(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => projectsApi.removeDependency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'list', projectId] })
      queryClient.invalidateQueries({ queryKey: ['deliverables', 'detail'] })
    },
  })
}
