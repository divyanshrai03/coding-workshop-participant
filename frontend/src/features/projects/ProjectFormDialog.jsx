import { useCallback, useState } from 'react'
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
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useCreateProject, useUpdateProject } from './hooks'
import { PROJECT_STATUS_OPTIONS, RISK_LEVEL_OPTIONS } from './constants'
import ResourcePicker from '../resources/ResourcePicker'
import { ApiError } from '../../lib/apiClient'
import { useToast } from '../../components/useToast'

const EMPTY_FORM = {
  name: '',
  description: '',
  status: 'planning',
  risk_level: 'low',
  owner_id: null,
  start_date: '',
  end_date: '',
}

function toFormState(project) {
  if (!project) return EMPTY_FORM
  return {
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? 'planning',
    risk_level: project.risk_level ?? 'low',
    owner_id: project.owner_id ?? null,
    start_date: project.start_date ?? '',
    end_date: project.end_date ?? '',
  }
}

// The parent only mounts this component while the dialog should be visible (see
// ProjectsPage's `{formState.open && <ProjectFormDialog ... />}`), so a fresh mount
// naturally gives fresh state - no reset-on-prop-change effect needed.
export default function ProjectFormDialog({ project = null, onClose }) {
  const [form, setForm] = useState(() => toFormState(project))
  const [error, setError] = useState(null)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const toast = useToast()
  const isEditing = Boolean(project)
  const isSubmitting = createProject.isPending || updateProject.isPending
  const handleOwnerChange = useCallback((id) => {
    setForm((prev) => (prev.owner_id === id ? prev : { ...prev, owner_id: id }))
  }, [])
  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("End date can't be before the start date.")
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      risk_level: form.risk_level,
      owner_id: form.owner_id,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }

    try {
      if (isEditing) {
        await updateProject.mutateAsync({ id: project.id, payload })
        toast.success('Project updated')
      } else {
        await createProject.mutateAsync(payload)
        toast.success('Project created')
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the project. Please try again.')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Edit project' : 'New project'}</DialogTitle>
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
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField select label="Status" value={form.status} onChange={setField('status')} fullWidth>
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={6}>
                <TextField
                  select
                  label="Risk level"
                  value={form.risk_level}
                  onChange={setField('risk_level')}
                  fullWidth
                >
                  {RISK_LEVEL_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <ResourcePicker
              label="Owner"
              value={form.owner_id}
              onChange={handleOwnerChange}
            />
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Start date"
                  type="date"
                  value={form.start_date}
                  onChange={setField('start_date')}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="End date"
                  type="date"
                  value={form.end_date}
                  onChange={setField('end_date')}
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
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create project'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

ProjectFormDialog.propTypes = {
  project: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}
