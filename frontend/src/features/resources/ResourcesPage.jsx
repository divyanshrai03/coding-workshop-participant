import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
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
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SearchIcon from '@mui/icons-material/Search'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import PageHeader from '../../components/PageHeader'
import { useDebounce } from '../../hooks/useDebounce'
import { ApiError } from '../../lib/apiClient'
import { ROLES, roleLabel } from '../../lib/roles'
import { useAuth } from '../auth/useAuth'
import { useResourcesQuery, useWorkloadQuery } from './hooks'
import ResourceAssignmentsDialog from './ResourceAssignmentsDialog'

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'action.hover', display: 'flex' }}>
            <Icon fontSize="small" color="action" />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

SummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType.isRequired,
}

export default function ResourcesPage() {
  const { hasMinRole } = useAuth()
  const canManageAssignments = hasMinRole('team_lead')

  const [filters, setFilters] = useState({ search: '', role: '' })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [selectedResourceId, setSelectedResourceId] = useState(null)

  const debouncedSearch = useDebounce(filters.search, 300)
  const queryParams = useMemo(
    () => ({ search: debouncedSearch, role: filters.role, page: page + 1, page_size: pageSize }),
    [debouncedSearch, filters.role, page, pageSize],
  )

  const { data, isLoading, isError, error, refetch } = useResourcesQuery(queryParams)
  const { data: workloadData } = useWorkloadQuery()

  const resources = data?.data ?? []
  const total = data?.meta?.total ?? 0
  const summary = workloadData?.data?.summary

  const updateFilter = (field) => (event) => {
    setPage(0)
    setFilters((prev) => ({ ...prev, [field]: event.target.value }))
  }

  return (
    <>
      <PageHeader
        title="Resources"
        description="Team allocation, workload, and assignments across active projects."
      />

      {summary && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryCard label="Total resources" value={summary.total_resources} icon={GroupsOutlinedIcon} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryCard label="Overallocated" value={summary.overallocated_count} icon={WorkOutlineOutlinedIcon} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryCard label="Under 50% allocated" value={summary.underallocated_count} icon={WorkOutlineOutlinedIcon} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryCard
              label="Average allocation"
              value={`${summary.average_allocation_percent}%`}
              icon={WorkOutlineOutlinedIcon}
            />
          </Grid>
        </Grid>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          placeholder="Search by name or email…"
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
        <TextField select label="Role" value={filters.role} onChange={updateFilter('role')} size="small" sx={{ minWidth: 170 }}>
          <MenuItem value="">All roles</MenuItem>
          {ROLES.map((role) => (
            <MenuItem key={role} value={role}>
              {roleLabel(role)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoading && <ListSkeleton rows={pageSize > 8 ? 8 : pageSize} />}

      {isError && (
        <ErrorState message={error instanceof ApiError ? error.message : 'Could not load the team roster.'} onRetry={refetch} />
      )}

      {!isLoading && !isError && resources.length === 0 && (
        <EmptyState
          icon={GroupsOutlinedIcon}
          title="No team members match your filters"
          description="Try a different search or role filter."
        />
      )}

      {!isLoading && !isError && resources.length > 0 && (
        <Card variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell sx={{ width: 220 }}>Current allocation</TableCell>
                  <TableCell>Capacity / week</TableCell>
                  <TableCell align="right">Assignments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {resource.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resource.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={roleLabel(resource.role)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(resource.total_allocation_percent, 100)}
                          color={resource.is_overallocated ? 'error' : 'primary'}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                        <Typography variant="caption" color={resource.is_overallocated ? 'error.main' : 'text.secondary'}>
                          {resource.total_allocation_percent}% {resource.is_overallocated && '(overallocated)'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {resource.capacity_hours_per_week}h
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View assignments">
                        <IconButton size="small" onClick={() => setSelectedResourceId(resource.id)}>
                          <WorkOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
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

      {selectedResourceId && (
        <ResourceAssignmentsDialog
          resourceId={selectedResourceId}
          canManage={canManageAssignments}
          onClose={() => setSelectedResourceId(null)}
        />
      )}
    </>
  )
}
