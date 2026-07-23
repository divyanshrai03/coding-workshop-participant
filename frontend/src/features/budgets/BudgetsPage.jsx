import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '@mui/x-charts/BarChart'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { useBudgetsQuery, useBudgetsSummaryQuery } from './hooks'
import BudgetFormDialog from './BudgetFormDialog'
import BudgetDetailDialog from './BudgetDetailDialog'

export default function BudgetsPage() {
  const { hasMinRole } = useAuth()
  const canManageBudgets = hasMinRole('project_manager')
  const [searchParams, setSearchParams] = useSearchParams()
  const projectParam = searchParams.get('project')

  const { data, isLoading, isError, error, refetch } = useBudgetsQuery({ page_size: 50 })
  const { data: summaryData } = useBudgetsSummaryQuery()

  const [formOpen, setFormOpen] = useState(false)
  const [formProjectId, setFormProjectId] = useState(null)
  const [selectedBudgetId, setSelectedBudgetId] = useState(null)
  const [autoOpenHandled, setAutoOpenHandled] = useState(false)

  const budgets = data?.data ?? []
  const summary = summaryData?.data

  // Synchronizes with an external system (the URL's ?project= param set by
  // ProjectDetailPage's "Set up budget"/"View budget" links), not derived
  // component state - a valid effect use case, hence the targeted disable below.
  useEffect(() => {
    if (!projectParam || autoOpenHandled || isLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoOpenHandled(true)
    const existing = data?.data?.find((budget) => budget.project_id === projectParam)
    if (existing) {
      setSelectedBudgetId(existing.id)
    } else if (canManageBudgets) {
      setFormProjectId(projectParam)
      setFormOpen(true)
    }
    setSearchParams({}, { replace: true })
  }, [projectParam, autoOpenHandled, isLoading, data, canManageBudgets, setSearchParams])

  const categoryChart = useMemo(() => {
    const rows = summary?.by_category ?? []
    return {
      categories: rows.map((row) => row.category),
      totals: rows.map((row) => Number(row.total)),
    }
  }, [summary])

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Planned vs. spent budget, burn rate, and spend by category."
        actions={
          canManageBudgets && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormProjectId(null)
                setFormOpen(true)
              }}
            >
              New Budget
            </Button>
          )
        }
      />

      {summary && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Total planned
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {Number(summary.total_planned).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Total spent
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {Number(summary.total_spent).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Overall burn
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(summary.overall_percent_used ?? 0, 100)}
                  sx={{ height: 6, borderRadius: 1, my: 1 }}
                />
                <Typography variant="body2">
                  {summary.overall_percent_used !== null ? `${summary.overall_percent_used}%` : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {categoryChart.categories.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Spend by category
            </Typography>
            <BarChart
              height={220}
              xAxis={[{ data: categoryChart.categories, scaleType: 'band' }]}
              series={[{ data: categoryChart.totals, label: 'Spend', color: '#2563EB' }]}
            />
          </CardContent>
        </Card>
      )}

      {isLoading && <ListSkeleton rows={5} />}

      {isError && (
        <ErrorState message={error instanceof ApiError ? error.message : 'Could not load budgets.'} onRetry={refetch} />
      )}

      {!isLoading && !isError && budgets.length === 0 && (
        <EmptyState
          icon={PaidOutlinedIcon}
          title="No budgets yet"
          description={
            canManageBudgets
              ? 'Set a planned budget for a project to start tracking spend.'
              : 'Budgets will appear here once a project manager sets one up.'
          }
          actionLabel={canManageBudgets ? 'New Budget' : null}
          onAction={
            canManageBudgets
              ? () => {
                  setFormProjectId(null)
                  setFormOpen(true)
                }
              : null
          }
        />
      )}

      {!isLoading && !isError && budgets.length > 0 && (
        <Card variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>Spent</TableCell>
                  <TableCell sx={{ width: 200 }}>Utilization</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedBudgetId(budget.id)}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {budget.project_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {budget.currency} {Number(budget.planned_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {budget.currency} {Number(budget.spent_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(budget.percent_used ?? 0, 100)}
                          color={budget.percent_used > 100 ? 'error' : budget.percent_used > 85 ? 'warning' : 'primary'}
                          sx={{ height: 6, borderRadius: 1, flex: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
                          {budget.percent_used ?? 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {formOpen && (
        <BudgetFormDialog
          fixedProjectId={formProjectId}
          onClose={() => {
            setFormOpen(false)
            setFormProjectId(null)
          }}
        />
      )}

      {selectedBudgetId && (
        <BudgetDetailDialog budgetId={selectedBudgetId} onClose={() => setSelectedBudgetId(null)} />
      )}
    </>
  )
}
