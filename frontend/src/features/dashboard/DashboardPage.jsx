import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { PieChart } from '@mui/x-charts/PieChart'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import { ApiError } from '../../lib/apiClient'
import { RISK_LEVEL_OPTIONS } from '../projects/constants'
import { useDashboardSummaryQuery } from '../projects/hooks'
import { useBudgetsSummaryQuery } from '../budgets/hooks'
import { useWorkloadQuery } from '../resources/hooks'

const RISK_CHART_COLORS = { low: '#16A34A', medium: '#2563EB', high: '#D97706', critical: '#DC2626' }

function StatCard({ label, value, caption = null }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700}>
          {value}
        </Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  caption: PropTypes.string,
}

function daysUntil(dateString) {
  const diffMs = new Date(dateString).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function urgencyColor(days) {
  if (days < 0) return 'error'
  if (days <= 3) return 'warning'
  return 'default'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useDashboardSummaryQuery()
  const { data: budgetsSummaryData } = useBudgetsSummaryQuery()
  const { data: workloadData } = useWorkloadQuery()

  const summary = data?.data
  const budgetsSummary = budgetsSummaryData?.data
  const overallocated = (workloadData?.data?.resources ?? []).filter((resource) => resource.is_overallocated)

  const riskChartData = useMemo(() => {
    if (!summary) return []
    return RISK_LEVEL_OPTIONS.map((option) => ({
      id: option.value,
      label: option.label,
      value: summary.projects_by_risk[option.value] ?? 0,
      color: RISK_CHART_COLORS[option.value],
    })).filter((slice) => slice.value > 0)
  }, [summary])

  if (isLoading) {
    return <ListSkeleton rows={4} height={100} />
  }

  if (isError || !summary) {
    return (
      <ErrorState
        message={error instanceof ApiError ? error.message : 'Could not load the dashboard.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Portfolio health, budget burn, and upcoming deadlines at a glance."
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Total projects" value={summary.total_projects} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Active" value={summary.projects_by_status.active ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Delayed"
            value={summary.delayed_project_count}
            caption={summary.delayed_project_count > 0 ? 'past due date' : 'on track'}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Deliverable completion"
            value={`${summary.deliverable_completion_percent}%`}
            caption={`${summary.completed_deliverables}/${summary.total_deliverables} done`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Risk breakdown
              </Typography>
              {riskChartData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No projects yet.
                </Typography>
              ) : (
                <PieChart
                  series={[{ data: riskChartData, innerRadius: 40, paddingAngle: 2, cornerRadius: 4 }]}
                  height={220}
                  slotProps={{ legend: { direction: 'vertical', position: { vertical: 'middle', horizontal: 'end' } } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Budget overview</Typography>
                <Button size="small" onClick={() => navigate('/budgets')}>
                  View budgets
                </Button>
              </Stack>
              {budgetsSummary ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(budgetsSummary.overall_percent_used ?? 0, 100)}
                    color={budgetsSummary.overall_percent_used > 100 ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 1, mb: 1 }}
                  />
                  <Typography variant="body2">
                    {Number(budgetsSummary.total_spent).toLocaleString()} of{' '}
                    {Number(budgetsSummary.total_planned).toLocaleString()} spent
                    {budgetsSummary.overall_percent_used !== null && ` (${budgetsSummary.overall_percent_used}%)`}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No budgets set up yet.
                </Typography>
              )}

              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                Team workload
              </Typography>
              {overallocated.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No one is overallocated right now.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {overallocated.slice(0, 6).map((resource) => (
                    <Chip
                      key={resource.id}
                      label={`${resource.full_name} · ${resource.total_allocation_percent}%`}
                      color="error"
                      size="small"
                      variant="outlined"
                      onClick={() => navigate('/resources')}
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Upcoming deadlines
          </Typography>
          {summary.upcoming_deadlines.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing due in the next 14 days.
            </Typography>
          ) : (
            <List disablePadding>
              {summary.upcoming_deadlines.map((deliverable) => {
                const days = daysUntil(deliverable.due_date)
                return (
                  <ListItem
                    key={deliverable.id}
                    disableGutters
                    divider
                    secondaryAction={
                      <Chip
                        label={days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
                        color={urgencyColor(days)}
                        size="small"
                      />
                    }
                  >
                    <ListItemText
                      primary={deliverable.name}
                      secondary={deliverable.project_name}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${deliverable.project_id}`)}
                    />
                  </ListItem>
                )
              })}
            </List>
          )}
        </CardContent>
      </Card>
      <Box sx={{ height: 8 }} />
    </>
  )
}
