import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resourcesApi } from './api'

export function useResourcesQuery(params) {
  return useQuery({ queryKey: ['resources', 'list', params], queryFn: () => resourcesApi.list(params) })
}

export function useResourceQuery(id) {
  return useQuery({
    queryKey: ['resources', 'detail', id],
    queryFn: () => resourcesApi.get(id),
    enabled: Boolean(id),
  })
}

export function useWorkloadQuery() {
  return useQuery({ queryKey: ['resources', 'workload'], queryFn: () => resourcesApi.workload() })
}

export function useAssignmentsQuery(params) {
  return useQuery({ queryKey: ['assignments', 'list', params], queryFn: () => resourcesApi.listAssignments(params) })
}

function invalidateWorkloadQueries(queryClient, { projectId } = {}) {
  queryClient.invalidateQueries({ queryKey: ['assignments'] })
  queryClient.invalidateQueries({ queryKey: ['resources', 'workload'] })
  queryClient.invalidateQueries({ queryKey: ['resources', 'list'] })
  // Always invalidated (not just for a specific userId): update/delete only
  // have the assignment id to work with, not the affected user, since the
  // backend's PATCH/DELETE responses don't echo it back. Invalidating the
  // whole 'detail' prefix refetches whichever resource dialog is actually
  // open - cheap, and avoids ResourceAssignmentsDialog silently showing
  // stale data after a mutation (a real bug caught by qa/tests/ui/resources.spec.ts).
  queryClient.invalidateQueries({ queryKey: ['resources', 'detail'] })
  if (projectId) queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
}

export function useCreateAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => resourcesApi.createAssignment(payload),
    onSuccess: (_data, variables) => invalidateWorkloadQueries(queryClient, { projectId: variables.project_id }),
  })
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => resourcesApi.updateAssignment(id, payload),
    onSuccess: () => invalidateWorkloadQueries(queryClient),
  })
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => resourcesApi.removeAssignment(id),
    onSuccess: () => invalidateWorkloadQueries(queryClient),
  })
}
