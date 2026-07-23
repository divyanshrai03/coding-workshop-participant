import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import StatusChip from '../../components/StatusChip'
import { useToast } from '../../components/useToast'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { DELIVERABLE_STATUS_OPTIONS, PROJECT_STATUS_OPTIONS, RISK_LEVEL_OPTIONS } from './constants'
import {
  useDeleteDeliverable,
  useDeleteProject,
  useDeliverablesQuery,
  useProjectQuery,
} from './hooks'
import ProjectFormDialog from './ProjectFormDialog'
import DeliverableFormDialog from './DeliverableFormDialog'
import DeliverableDependenciesDialog from './DeliverableDependenciesDialog'

function BudgetSummary({ project }) {
  const navigate = useNavigate()
  const { hasMinRole } = useAuth()

  if (!project.budget_id) {
    return (
      <Stack spacing={1} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary">
          No budget set for this project yet.
        </Typography>
        {hasMinRole('project_manager') && (
          <Button size="small" onClick={() => navigate(`/budgets?project=${project.id}`)}>
            Set up budget
          </Button>
        )}
      </Stack>
    )
  }

  const percentUsed = project.percent_used ?? 0
  return (
    <Stack spacing={1}>
      <LinearProgress
        variant="determinate"
        value={Math.min(percentUsed, 100)}
        color={percentUsed > 100 ? 'error' : percentUsed > 85 ? 'warning' : 'primary'}
        sx={{ height: 6, borderRadius: 1 }}
      />
      <Typography variant="body2">
        {project.currency} {Number(project.spent_amount).toLocaleString()} of{' '}
        {Number(project.planned_amount).toLocaleString()} spent ({percentUsed}%)
      </Typography>
      <Button size="small" onClick={() => navigate(`/budgets?project=${project.id}`)} sx={{ alignSelf: 'flex-start' }}>
        View budget
      </Button>
    </Stack>
  )
}

BudgetSummary.propTypes = {
  project: PropTypes.object.isRequired,
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { hasMinRole } = useAuth()
  const canManageProject = hasMinRole('project_manager')
  const canManageDeliverables = hasMinRole('team_lead')

  const [deliverableFilters, setDeliverableFilters] = useState({ search: '', status: '' })
  const [editingProject, setEditingProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [deliverableForm, setDeliverableForm] = useState({ open: false, deliverable: null })
  const [pendingDeliverableDelete, setPendingDeliverableDelete] = useState(null)
  const [dependenciesFor, setDependenciesFor] = useState(null)

  const { data: projectData, isLoading, isError, error, refetch } = useProjectQuery(id)
  const deliverablesParams = useMemo(
    () => ({ search: deliverableFilters.search, status: deliverableFilters.status, page_size: 50 }),
    [deliverableFilters],
  )
  const {
    data: deliverablesData,
    isLoading: isLoadingDeliverables,
    isError: isDeliverablesError,
    error: deliverablesError,
    refetch: refetchDeliverables,
  } = useDeliverablesQuery(id, deliverablesParams)
  const deleteProject = useDeleteProject()
  const deleteDeliverable = useDeleteDeliverable(id)

  const project = projectData?.data
  const deliverables = deliverablesData?.data ?? []

  const handleDeleteProject = async () => {
    try {
      await deleteProject.mutateAsync(id)
      toast.success('Project deleted')
      navigate('/projects', { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the project.')
      setDeletingProject(false)
    }
  }

  const handleDeleteDeliverable = async () => {
    try {
      await deleteDeliverable.mutateAsync(pendingDeliverableDelete.id)
      toast.success('Deliverable deleted')
      setPendingDeliverableDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the deliverable.')
    }
  }

  if (isLoading) {
    return <ListSkeleton rows={4} height={80} />
  }

  if (isError || !project) {
    return (
      <ErrorState
        message={error instanceof ApiError ? error.message : 'Could not load this project.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>
        Back to projects
      </Button>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="h5" fontWeight={700}>
              {project.name}
            </Typography>
            <StatusChip value={project.status} options={PROJECT_STATUS_OPTIONS} />
            <StatusChip value={project.risk_level} options={RISK_LEVEL_OPTIONS} />
          </Stack>
          {project.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {project.description}
            </Typography>
          )}
        </Box>
        {canManageProject && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditingProject(true)}>
              Edit
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeletingProject(true)}>
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Completion
              </Typography>
              <LinearProgress
                variant="determinate"
                value={project.completion_percent}
                sx={{ height: 6, borderRadius: 1, my: 1 }}
              />
              <Typography variant="body2">
                {project.completion_percent}% · {project.completed_count}/{project.deliverable_count} deliverables
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Owner &amp; timeline
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {project.owner_name || 'Unassigned'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {project.start_date || '—'} → {project.end_date || '—'}
                {project.is_delayed && ' (delayed)'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Budget
              </Typography>
              <Box sx={{ mt: 1 }}>
                <BudgetSummary project={project} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Deliverables
        </Typography>
        {canManageDeliverables && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setDeliverableForm({ open: true, deliverable: null })}
          >
            New Deliverable
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search deliverables…"
          value={deliverableFilters.search}
          onChange={(event) => setDeliverableFilters((prev) => ({ ...prev, search: event.target.value }))}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <TextField
          select
          label="Status"
          value={deliverableFilters.status}
          onChange={(event) => setDeliverableFilters((prev) => ({ ...prev, status: event.target.value }))}
          size="small"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {DELIVERABLE_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoadingDeliverables && <ListSkeleton rows={3} />}

      {isDeliverablesError && (
        <ErrorState
          message={deliverablesError instanceof ApiError ? deliverablesError.message : 'Could not load deliverables.'}
          onRetry={refetchDeliverables}
        />
      )}

      {!isLoadingDeliverables && !isDeliverablesError && deliverables.length === 0 && (
        <EmptyState
          icon={TaskAltOutlinedIcon}
          title="No deliverables yet"
          description={
            canManageDeliverables
              ? 'Break this project down into trackable deliverables.'
              : 'Deliverables will appear here once they are added.'
          }
        />
      )}

      {!isLoadingDeliverables && !isDeliverablesError && deliverables.length > 0 && (
        <Card variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliverables.map((deliverable) => (
                  <TableRow key={deliverable.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {deliverable.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip value={deliverable.status} options={DELIVERABLE_STATUS_OPTIONS} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {deliverable.owner_name || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {deliverable.due_date || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Dependencies">
                        <IconButton size="small" onClick={() => setDependenciesFor(deliverable)}>
                          <AccountTreeOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManageDeliverables && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => setDeliverableForm({ open: true, deliverable })}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => setPendingDeliverableDelete(deliverable)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {editingProject && (
        <ProjectFormDialog project={project} onClose={() => setEditingProject(false)} />
      )}

      {deletingProject && (
        <ConfirmDialog
          open
          title="Delete project?"
          description={`This permanently removes "${project.name}" along with its deliverables, dependencies, and assignments. This can't be undone.`}
          confirmLabel="Delete"
          isLoading={deleteProject.isPending}
          onConfirm={handleDeleteProject}
          onCancel={() => setDeletingProject(false)}
        />
      )}

      {deliverableForm.open && (
        <DeliverableFormDialog
          projectId={id}
          deliverable={deliverableForm.deliverable}
          onClose={() => setDeliverableForm({ open: false, deliverable: null })}
        />
      )}

      {pendingDeliverableDelete && (
        <ConfirmDialog
          open
          title="Delete deliverable?"
          description={`This permanently removes "${pendingDeliverableDelete.name}" and any dependencies linked to it.`}
          confirmLabel="Delete"
          isLoading={deleteDeliverable.isPending}
          onConfirm={handleDeleteDeliverable}
          onCancel={() => setPendingDeliverableDelete(null)}
        />
      )}

      {dependenciesFor && (
        <DeliverableDependenciesDialog
          deliverable={dependenciesFor}
          siblings={deliverables}
          projectId={id}
          canManage={canManageDeliverables}
          onClose={() => setDependenciesFor(null)}
        />
      )}
    </>
  )
}
