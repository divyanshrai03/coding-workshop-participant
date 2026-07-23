import { useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useCreateDeliverable, useUpdateDeliverable } from './hooks'
import { DELIVERABLE_STATUS_OPTIONS } from './constants'
import ResourcePicker from '../resources/ResourcePicker'
import { ApiError } from '../../lib/apiClient'
import { useToast } from '../../components/useToast'

const EMPTY_FORM = { name: '', description: '', status: 'not_started', owner_id: null, due_date: '' }

function toFormState(deliverable) {
  if (!deliverable) return EMPTY_FORM
  return {
    name: deliverable.name ?? '',
    description: deliverable.description ?? '',
    status: deliverable.status ?? 'not_started',
    owner_id: deliverable.owner_id ?? null,
    due_date: deliverable.due_date ?? '',
  }
}

// Mounted only while visible by the parent (see ProjectDetailPage) - a fresh mount
// gives fresh state without needing a reset-on-prop-change effect.
export default function DeliverableFormDialog({ projectId, deliverable = null, onClose }) {
  const [form, setForm] = useState(() => toFormState(deliverable))
  const [error, setError] = useState(null)
  const createDeliverable = useCreateDeliverable(projectId)
  const updateDeliverable = useUpdateDeliverable(projectId)
  const toast = useToast()
  const isEditing = Boolean(deliverable)
  const isSubmitting = createDeliverable.isPending || updateDeliverable.isPending

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      owner_id: form.owner_id,
      due_date: form.due_date || null,
    }

    try {
      if (isEditing) {
        await updateDeliverable.mutateAsync({ id: deliverable.id, payload })
        toast.success('Deliverable updated')
      } else {
        await createDeliverable.mutateAsync(payload)
        toast.success('Deliverable created')
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the deliverable. Please try again.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Edit deliverable' : 'New deliverable'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" value={form.name} onChange={setField('name')} required fullWidth autoFocus />
            <TextField
              label="Description"
              value={form.description}
              onChange={setField('description')}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField select label="Status" value={form.status} onChange={setField('status')} fullWidth>
              {DELIVERABLE_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <ResourcePicker
              label="Owner"
              value={form.owner_id}
              onChange={(id) => setForm((prev) => ({ ...prev, owner_id: id }))}
            />
            <TextField
              label="Due date"
              type="date"
              value={form.due_date}
              onChange={setField('due_date')}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create deliverable'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

DeliverableFormDialog.propTypes = {
  projectId: PropTypes.string.isRequired,
  deliverable: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}
