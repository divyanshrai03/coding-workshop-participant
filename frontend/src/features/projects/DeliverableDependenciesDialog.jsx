import { useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useCreateDependency, useDeleteDependency, useDeliverableQuery } from './hooks'
import { DEPENDENCY_TYPE_OPTIONS } from './constants'
import ErrorState from '../../components/ErrorState'
import ListSkeleton from '../../components/ListSkeleton'
import { useToast } from '../../components/useToast'
import { ApiError } from '../../lib/apiClient'

export default function DeliverableDependenciesDialog({ deliverable, siblings, projectId, canManage, onClose }) {
  const { data, isLoading, isError, error, refetch } = useDeliverableQuery(deliverable.id)
  const createDependency = useCreateDependency(projectId)
  const deleteDependency = useDeleteDependency(projectId)
  const toast = useToast()
  const [dependsOnId, setDependsOnId] = useState('')
  const [dependencyType, setDependencyType] = useState('blocks')

  const otherDeliverables = siblings.filter((item) => item.id !== deliverable.id)

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!dependsOnId) return
    try {
      await createDependency.mutateAsync({
        deliverable_id: deliverable.id,
        depends_on_deliverable_id: dependsOnId,
        dependency_type: dependencyType,
      })
      setDependsOnId('')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to add that dependency.')
    }
  }

  const handleRemove = async (id) => {
    try {
      await deleteDependency.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to remove that dependency.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dependencies · {deliverable.name}</DialogTitle>
      <DialogContent>
        {isLoading && <ListSkeleton rows={2} height={40} />}
        {isError && (
          <ErrorState message={error instanceof ApiError ? error.message : 'Could not load dependencies.'} onRetry={refetch} />
        )}
        {data && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Blocked by ({data.data.blocked_by.length})
              </Typography>
              {data.data.blocked_by.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing is blocking this deliverable.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {data.data.blocked_by.map((edge) => (
                    <ListItem
                      key={edge.id}
                      disableGutters
                      secondaryAction={
                        canManage && (
                          <IconButton edge="end" size="small" onClick={() => handleRemove(edge.id)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )
                      }
                    >
                      <ListItemText primary={edge.name} secondary={edge.status} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Blocking ({data.data.blocking.length})
              </Typography>
              {data.data.blocking.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  This deliverable doesn&apos;t block anything else.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {data.data.blocking.map((edge) => (
                    <ListItem
                      key={edge.id}
                      disableGutters
                      secondaryAction={
                        canManage && (
                          <IconButton edge="end" size="small" onClick={() => handleRemove(edge.id)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )
                      }
                    >
                      <ListItemText primary={edge.name} secondary={edge.status} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            {canManage && otherDeliverables.length > 0 && (
              <>
                <Divider />
                <Box component="form" onSubmit={handleAdd}>
                  <Typography variant="subtitle2" gutterBottom>
                    Add dependency
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      select
                      label="Depends on"
                      value={dependsOnId}
                      onChange={(event) => setDependsOnId(event.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    >
                      {otherDeliverables.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Type"
                      value={dependencyType}
                      onChange={(event) => setDependencyType(event.target.value)}
                      size="small"
                      sx={{ width: 130 }}
                    >
                      {DEPENDENCY_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button type="submit" variant="outlined" disabled={!dependsOnId || createDependency.isPending}>
                      Add
                    </Button>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

DeliverableDependenciesDialog.propTypes = {
  deliverable: PropTypes.object.isRequired,
  siblings: PropTypes.array.isRequired,
  projectId: PropTypes.string.isRequired,
  canManage: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}
