import { useState } from 'react'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
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
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { useBudgetQuery, useDeleteBudget, useDeleteEntry, useEntriesQuery } from './hooks'
import BudgetFormDialog from './BudgetFormDialog'
import BudgetEntryFormDialog from './BudgetEntryFormDialog'

export default function BudgetDetailDialog({ budgetId, onClose }) {
  const { hasMinRole } = useAuth()
  const canManageBudget = hasMinRole('project_manager')
  const canDeleteBudget = hasMinRole('admin')

  const { data, isLoading, isError, error, refetch } = useBudgetQuery(budgetId)
  const { data: entriesData, isLoading: isLoadingEntries } = useEntriesQuery(budgetId, { page_size: 50 })
  const deleteBudget = useDeleteBudget()
  const deleteEntry = useDeleteEntry(budgetId)
  const toast = useToast()

  const [editingBudget, setEditingBudget] = useState(false)
  const [addingEntry, setAddingEntry] = useState(false)
  const [deletingBudget, setDeletingBudget] = useState(false)
  const [pendingEntryDelete, setPendingEntryDelete] = useState(null)

  const budget = data?.data
  const entries = entriesData?.data ?? []

  const handleDeleteBudget = async () => {
    try {
      await deleteBudget.mutateAsync(budgetId)
      toast.success('Budget deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to delete the budget.')
      setDeletingBudget(false)
    }
  }

  const handleDeleteEntry = async () => {
    try {
      await deleteEntry.mutateAsync(pendingEntryDelete.id)
      toast.success('Entry removed')
      setPendingEntryDelete(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to remove that entry.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{budget ? budget.project_name : 'Budget'}</DialogTitle>
      <DialogContent>
        {isLoading && <ListSkeleton rows={3} height={48} />}
        {isError && (
          <ErrorState message={error instanceof ApiError ? error.message : 'Could not load this budget.'} onRetry={refetch} />
        )}
        {budget && (
          <Stack spacing={3}>
            <Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(budget.percent_used ?? 0, 100)}
                color={budget.percent_used > 100 ? 'error' : budget.percent_used > 85 ? 'warning' : 'primary'}
                sx={{ height: 8, borderRadius: 1, mb: 1 }}
              />
              <Typography variant="body2">
                {budget.currency} {Number(budget.spent_amount).toLocaleString()} spent of{' '}
                {Number(budget.planned_amount).toLocaleString()} planned
                {budget.percent_used !== null && ` (${budget.percent_used}%)`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {budget.currency} {Number(budget.remaining_amount).toLocaleString()} remaining
              </Typography>
              {canManageBudget && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditingBudget(true)}>
                    Edit budget
                  </Button>
                  {canDeleteBudget && (
                    <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeletingBudget(true)}>
                      Delete budget
                    </Button>
                  )}
                </Stack>
              )}
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Spend entries</Typography>
                {canManageBudget && (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddingEntry(true)}>
                    Add entry
                  </Button>
                )}
              </Stack>

              {isLoadingEntries && <ListSkeleton rows={2} height={44} />}

              {!isLoadingEntries && entries.length === 0 && (
                <EmptyState title="No spend recorded yet" description="Add the first entry to start tracking burn." />
              )}

              {!isLoadingEntries && entries.length > 0 && (
                <List dense disablePadding>
                  {entries.map((entry) => (
                    <ListItem
                      key={entry.id}
                      disableGutters
                      divider
                      secondaryAction={
                        canManageBudget && (
                          <Tooltip title="Remove entry">
                            <IconButton size="small" onClick={() => setPendingEntryDelete(entry)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )
                      }
                    >
                      <ListItemText
                        primary={`${entry.category} — ${budget.currency} ${Number(entry.amount).toLocaleString()}`}
                        secondary={[entry.entry_date, entry.description].filter(Boolean).join(' · ')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {editingBudget && <BudgetFormDialog budget={budget} onClose={() => setEditingBudget(false)} />}
      {addingEntry && <BudgetEntryFormDialog budgetId={budgetId} onClose={() => setAddingEntry(false)} />}

      {deletingBudget && (
        <ConfirmDialog
          open
          title="Delete budget?"
          description="This permanently removes the budget and every spend entry recorded against it."
          confirmLabel="Delete"
          isLoading={deleteBudget.isPending}
          onConfirm={handleDeleteBudget}
          onCancel={() => setDeletingBudget(false)}
        />
      )}

      {pendingEntryDelete && (
        <ConfirmDialog
          open
          title="Remove entry?"
          description={`This removes the "${pendingEntryDelete.category}" entry.`}
          confirmLabel="Remove"
          isLoading={deleteEntry.isPending}
          onConfirm={handleDeleteEntry}
          onCancel={() => setPendingEntryDelete(null)}
        />
      )}
    </Dialog>
  )
}

BudgetDetailDialog.propTypes = {
  budgetId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
}
