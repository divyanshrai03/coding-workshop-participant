import { useState } from 'react'
import PropTypes from 'prop-types'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import { useToast } from '../../components/useToast'
import { ApiError } from '../../lib/apiClient'
import { useDeleteAssignment, useResourceQuery } from './hooks'
import AssignmentFormDialog from './AssignmentFormDialog'

export default function ResourceAssignmentsDialog({ resourceId, canManage, onClose }) {
  const { data, isLoading, isError, error, refetch } = useResourceQuery(resourceId)
  const deleteAssignment = useDeleteAssignment()
  const toast = useToast()
  const [assignmentForm, setAssignmentForm] = useState({ open: false, assignment: null })
  const [pendingDelete, setPendingDelete] = useState(null)

  const resource = data?.data
  const assignments = resource?.assignments ?? []

  const handleDelete = async () => {
    try {
      await deleteAssignment.mutateAsync(pendingDelete.id)
      toast.success('Assignment removed')
      setPendingDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to remove that assignment.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{resource ? `Assignments · ${resource.full_name}` : 'Assignments'}</DialogTitle>
      <DialogContent>
        {isLoading && <ListSkeleton rows={3} height={56} />}
        {isError && (
          <ErrorState message={error instanceof ApiError ? error.message : 'Could not load assignments.'} onRetry={refetch} />
        )}
        {resource && (
          <Stack spacing={2}>
            {canManage && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => setAssignmentForm({ open: true, assignment: null })}
              >
                New assignment
              </Button>
            )}

            {assignments.length === 0 ? (
              <EmptyState title="No assignments" description="This person isn't staffed on any project yet." />
            ) : (
              <List disablePadding>
                {assignments.map((assignment) => (
                  <ListItem
                    key={assignment.id}
                    disableGutters
                    divider
                    secondaryAction={
                      canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setAssignmentForm({ open: true, assignment })}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove">
                            <IconButton size="small" onClick={() => setPendingDelete(assignment)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={600}>
                            {assignment.project_name}
                          </Typography>
                          <Chip label={`${assignment.allocation_percent}%`} size="small" />
                        </Stack>
                      }
                      secondary={
                        [assignment.deliverable_name, assignment.role_on_project].filter(Boolean).join(' · ') || '—'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {assignmentForm.open && (
        <AssignmentFormDialog
          assignment={assignmentForm.assignment}
          fixedUserId={resourceId}
          onClose={() => setAssignmentForm({ open: false, assignment: null })}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          title="Remove assignment?"
          description={`This removes ${resource?.full_name} from "${pendingDelete.project_name}".`}
          confirmLabel="Remove"
          isLoading={deleteAssignment.isPending}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </Dialog>
  )
}

ResourceAssignmentsDialog.propTypes = {
  resourceId: PropTypes.string.isRequired,
  canManage: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}
