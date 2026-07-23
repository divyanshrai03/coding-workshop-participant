import { useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useCreateBudget, useUpdateBudget } from './hooks'
import ProjectPicker from '../projects/ProjectPicker'
import { ApiError } from '../../lib/apiClient'
import { useToast } from '../../components/useToast'

function toFormState(budget, fixedProjectId) {
  if (!budget) {
    return { project_id: fixedProjectId ?? null, planned_amount: '', currency: 'USD' }
  }
  return { project_id: budget.project_id, planned_amount: String(budget.planned_amount), currency: budget.currency }
}

// Mounted only while visible by the parent - see ProjectFormDialog for why this
// avoids a reset-on-prop-change effect.
export default function BudgetFormDialog({ budget = null, fixedProjectId = null, onClose }) {
  const [form, setForm] = useState(() => toFormState(budget, fixedProjectId))
  const [error, setError] = useState(null)
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const toast = useToast()
  const isEditing = Boolean(budget)
  const isSubmitting = createBudget.isPending || updateBudget.isPending

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!form.project_id) {
      setError('Choose a project.')
      return
    }
    const amount = Number(form.planned_amount)
    if (!form.planned_amount || Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid planned amount (0 or more).')
      return
    }

    try {
      if (isEditing) {
        await updateBudget.mutateAsync({
          id: budget.id,
          payload: { planned_amount: form.planned_amount, currency: form.currency },
        })
        toast.success('Budget updated')
      } else {
        await createBudget.mutateAsync({
          project_id: form.project_id,
          planned_amount: form.planned_amount,
          currency: form.currency,
        })
        toast.success('Budget created')
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the budget. Please try again.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? 'Edit budget' : 'New budget'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <ProjectPicker
              label="Project"
              value={form.project_id}
              onChange={(id) => setForm((prev) => ({ ...prev, project_id: id }))}
              required
              disabled={isEditing || Boolean(fixedProjectId)}
            />
            <Grid container spacing={2}>
              <Grid size={8}>
                <TextField
                  label="Planned amount"
                  type="number"
                  value={form.planned_amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, planned_amount: event.target.value }))}
                  required
                  fullWidth
                  autoFocus
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                />
              </Grid>
              <Grid size={4}>
                <TextField
                  label="Currency"
                  value={form.currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 3 } }}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create budget'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

BudgetFormDialog.propTypes = {
  budget: PropTypes.object,
  fixedProjectId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
}
