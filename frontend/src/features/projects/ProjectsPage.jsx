import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import SearchIcon from '@mui/icons-material/Search'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import PageHeader from '../../components/PageHeader'
import StatusChip from '../../components/StatusChip'
import { useToast } from '../../components/useToast'
import { useDebounce } from '../../hooks/useDebounce'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { PROJECT_SORT_OPTIONS, PROJECT_STATUS_OPTIONS, RISK_LEVEL_OPTIONS } from './constants'
import { useDeleteProject, useProjectsQuery } from './hooks'
import ProjectFormDialog from './ProjectFormDialog'

const DEFAULT_FILTERS = { search: '', status: '', risk_level: '', sort: '-created_at' }

export default function ProjectsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { hasMinRole } = useAuth()
  const canManageProjects = hasMinRole('project_manager')

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [formState, setFormState] = useState({ open: false, project: null })
  const [pendingDelete, setPendingDelete] = useState(null)

  const debouncedSearch = useDebounce(filters.search, 300)
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch,
      status: filters.status,
      risk_level: filters.risk_level,
      sort: filters.sort,
      page: page + 1,
      page_size: pageSize,
    }),
    [debouncedSearch, filters.status, filters.risk_level, filters.sort, page, pageSize],
  )

  const { data, isLoading, isError, error, refetch } = useProjectsQuery(queryParams)
  const deleteProject = useDeleteProject()

  const projects = data?.data ?? []
  const total = data?.meta?.total ?? 0

  const updateFilter = (field) => (event) => {
    setPage(0)
    setFilters((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteProject.mutateAsync(pendingDelete.id)
      toast.success(`"${pendingDelete.name}" was deleted`)
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the project.')
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Track status, risk, deliverables, and completion across every project."
        actions={
          canManageProjects && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormState({ open: true, project: null })}
            >
              New Project
            </Button>
          )
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          placeholder="Search projects…"
          value={filters.search}
          onChange={updateFilter('search')}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField select label="Status" value={filters.status} onChange={updateFilter('status')} size="small" sx={{ minWidth: 150 }}>
          <MenuItem value="">All statuses</MenuItem>
          {PROJECT_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Risk"
          value={filters.risk_level}
          onChange={updateFilter('risk_level')}
          size="small"
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="">Any risk</MenuItem>
          {RISK_LEVEL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Sort" value={filters.sort} onChange={updateFilter('sort')} size="small" sx={{ minWidth: 150 }}>
          {PROJECT_SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoading && <ListSkeleton rows={pageSize > 8 ? 8 : pageSize} />}

      {isError && (
        <ErrorState message={error instanceof ApiError ? error.message : 'Could not load projects.'} onRetry={refetch} />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          icon={FolderOutlinedIcon}
          title={filters.search || filters.status || filters.risk_level ? 'No projects match your filters' : 'No projects yet'}
          description={
            canManageProjects
              ? 'Create your first project to start tracking deliverables and budget.'
              : 'Once a project manager creates a project, it will show up here.'
          }
          actionLabel={canManageProjects ? 'New Project' : null}
          onAction={canManageProjects ? () => setFormState({ open: true, project: null }) : null}
        />
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <Card variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell sx={{ width: 160 }}>Completion</TableCell>
                  <TableCell>Due date</TableCell>
                  {canManageProjects && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>
                          {project.name}
                        </Typography>
                        {project.is_delayed && (
                          <Tooltip title="Past due date">
                            <WarningAmberIcon fontSize="small" color="warning" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip value={project.status} options={PROJECT_STATUS_OPTIONS} />
                    </TableCell>
                    <TableCell>
                      <StatusChip value={project.risk_level} options={RISK_LEVEL_OPTIONS} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={project.completion_percent} sx={{ borderRadius: 1, height: 6 }} />
                        <Typography variant="caption" color="text.secondary">
                          {project.completion_percent}% · {project.completed_count}/{project.deliverable_count} deliverables
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {project.end_date || '—'}
                      </Typography>
                    </TableCell>
                    {canManageProjects && (
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        <Tooltip title="Delete project">
                          <IconButton size="small" onClick={() => setPendingDelete(project)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_event, newPage) => setPage(newPage)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(event) => {
                setPageSize(parseInt(event.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </Box>
        </Card>
      )}

      {formState.open && (
        <ProjectFormDialog
          project={formState.project}
          onClose={() => setFormState({ open: false, project: null })}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          title="Delete project?"
          description={`This permanently removes "${pendingDelete.name}" along with its deliverables, dependencies, and assignments. This can't be undone.`}
          confirmLabel="Delete"
          isLoading={deleteProject.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
