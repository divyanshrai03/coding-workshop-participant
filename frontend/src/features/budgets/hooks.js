import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { budgetsApi } from './api'

export function useBudgetsQuery(params) {
  return useQuery({ queryKey: ['budgets', 'list', params], queryFn: () => budgetsApi.list(params) })
}

export function useBudgetQuery(id) {
  return useQuery({ queryKey: ['budgets', 'detail', id], queryFn: () => budgetsApi.get(id), enabled: Boolean(id) })
}

export function useBudgetsSummaryQuery() {
  return useQuery({ queryKey: ['budgets', 'summary'], queryFn: () => budgetsApi.summary() })
}

export function useEntriesQuery(budgetId, params) {
  return useQuery({
    queryKey: ['budgets', 'entries', budgetId, params],
    queryFn: () => budgetsApi.listEntries(budgetId, params),
    enabled: Boolean(budgetId),
  })
}

function invalidateBudgetQueries(queryClient, budgetId) {
  queryClient.invalidateQueries({ queryKey: ['budgets', 'list'] })
  queryClient.invalidateQueries({ queryKey: ['budgets', 'summary'] })
  if (budgetId) {
    queryClient.invalidateQueries({ queryKey: ['budgets', 'detail', budgetId] })
    queryClient.invalidateQueries({ queryKey: ['budgets', 'entries', budgetId] })
  }
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => budgetsApi.create(payload),
    onSuccess: () => invalidateBudgetQueries(queryClient),
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => budgetsApi.update(id, payload),
    onSuccess: (_data, variables) => invalidateBudgetQueries(queryClient, variables.id),
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => budgetsApi.remove(id),
    onSuccess: () => invalidateBudgetQueries(queryClient),
  })
}

export function useCreateEntry(budgetId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => budgetsApi.createEntry(budgetId, payload),
    onSuccess: () => invalidateBudgetQueries(queryClient, budgetId),
  })
}

export function useDeleteEntry(budgetId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => budgetsApi.removeEntry(id),
    onSuccess: () => invalidateBudgetQueries(queryClient, budgetId),
  })
}
