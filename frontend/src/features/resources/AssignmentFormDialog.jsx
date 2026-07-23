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
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCreateAssignment, useUpdateAssignment } from './hooks'
import ResourcePicker from './ResourcePicker'
import ProjectPicker from '../projects/ProjectPicker'
import { useDeliverablesQuery } from '../projects/hooks'
import { ApiError } from '../../lib/apiClient'
import { useToast } from '../../components/useToast'

const EMPTY_FORM = {
  project_id: null,
  deliverable_id: null,
  user_id: null,
  allocation_percent: 100,
  role_on_project: '',
  start_date: '',
  end_date: '',
}

function toFormState(assignment, fixedUserId) {
  if (!assignment) return { ...EMPTY_FORM, user_id: fixedUserId ?? null }
  return {
    project_id: assignment.project_id,
    deliverable_id: assignment.deliverable_id,
    user_id: assignment.user_id,
    allocation_percent: assignment.allocation_percent,
    role_on_project: assignment.role_on_project ?? '',
    start_date: assignment.start_date ?? '',
    end_date: assignment.end_date ?? '',
  }
}

// Mounted only while visible by the parent - a fresh mount gives fresh state
// without needing a reset-on-prop-change effect (see ProjectFormDialog for the
// same convention).
export default function AssignmentFormDialog({ assignment = null, fixedUserId = null, onClose }) {
  const [form, setForm] = useState(() => toFormState(assignment, fixedUserId))
  const [error, setError] = useState(null)
  const createAssignment = useCreateAssignment()
  const updateAssignment = useUpdateAssignment()
  const toast = useToast()
  const isEditing = Boolean(assignment)
  const isSubmitting = createAssignment.isPending || updateAssignment.isPending

  const { data: deliverablesData } = useDeliverablesQuery(form.project_id, { page_size: 100 })
  const deliverableOptions = deliverablesData?.data ?? []

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!form.project_id || !form.user_id) {
      setError('Project and person are both required.')
      return
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("End date can't be before the start date.")
      return
    }

    const payload = {
      project_id: form.project_id,
      deliverable_id: form.deliverable_id,
      user_id: form.user_id,
      allocation_percent: form.allocation_percent,
      role_on_project: form.role_on_project.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }

    try {
      if (isEditing) {
        // project_id/user_id are immutable after creation - only send the editable fields.
        const { deliverable_id, allocation_percent, role_on_project, start_date, end_date } = payload
        await updateAssignment.mutateAsync({
          id: assignment.id,
          payload: { deliverable_id, allocation_percent, role_on_project, start_date, end_date },
        })
        toast.success('Assignment updated')
      } else {
        await createAssignment.mutateAsync(payload)
        toast.success('Assignment created')
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the assignment. Please try again.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Edit assignment' : 'New assignment'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <ProjectPicker
              label="Project"
              value={form.project_id}
              onChange={(id) => setForm((prev) => ({ ...prev, project_id: id, deliverable_id: null }))}
              required
              disabled={isEditing}
            />
            <TextField
              select
              label="Deliverable (optional)"
              value={form.deliverable_id ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, deliverable_id: event.target.value || null }))}
              fullWidth
              disabled={!form.project_id}
              helperText={!form.project_id ? 'Pick a project first' : ' '}
            >
              <MenuItem value="">Whole project</MenuItem>
              {deliverableOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
            <ResourcePicker
              label="Person"
              value={form.user_id}
              onChange={(id) => setForm((prev) => ({ ...prev, user_id: id }))}
              required
              disabled={isEditing}
            />
            <TextField
              label="Role on project"
              value={form.role_on_project}
              onChange={(event) => setForm((prev) => ({ ...prev, role_on_project: event.target.value }))}
              placeholder="e.g. Backend engineer"
              fullWidth
            />
            <Box>
              <Typography variant="body2" gutterBottom>
                Allocation: {form.allocation_percent}%
              </Typography>
              <Slider
                value={form.allocation_percent}
                onChange={(_event, value) => setForm((prev) => ({ ...prev, allocation_percent: value }))}
                min={1}
                max={100}
                step={5}
                marks={[
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' },
                ]}
              />
            </Box>
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Start date"
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="End date"
                  type="date"
                  value={form.end_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
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
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create assignment'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

AssignmentFormDialog.propTypes = {
  assignment: PropTypes.object,
  fixedUserId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
}
