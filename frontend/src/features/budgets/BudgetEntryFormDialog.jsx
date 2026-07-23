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
import { useCreateEntry } from './hooks'
import { ApiError } from '../../lib/apiClient'
import { useToast } from '../../components/useToast'

const EMPTY_FORM = { category: '', description: '', amount: '', entry_date: '' }

export default function BudgetEntryFormDialog({ budgetId, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const createEntry = useCreateEntry(budgetId)
  const toast = useToast()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const amount = Number(form.amount)
    if (!form.category.trim()) {
      setError('Category is required.')
      return
    }
    if (!form.amount || Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid amount (0 or more).')
      return
    }

    try {
      await createEntry.mutateAsync({
        category: form.category.trim(),
        description: form.description.trim() || null,
        amount: form.amount,
        entry_date: form.entry_date || null,
      })
      toast.success('Spend entry added')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to add the entry. Please try again.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add spend entry</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="e.g. Cloud, Tools, Contractors"
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid size={7}>
                <TextField
                  label="Amount"
                  type="number"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                />
              </Grid>
              <Grid size={5}>
                <TextField
                  label="Date"
                  type="date"
                  value={form.entry_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, entry_date: event.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  helperText="Defaults to today"
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={createEntry.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={createEntry.isPending}>
            {createEntry.isPending ? 'Saving…' : 'Add entry'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

BudgetEntryFormDialog.propTypes = {
  budgetId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
}
