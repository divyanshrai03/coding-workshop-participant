import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectFormDialog from './ProjectFormDialog'
import { useCreateProject, useUpdateProject } from './hooks'

vi.mock('./hooks', () => ({
  useCreateProject: vi.fn(),
  useUpdateProject: vi.fn(),
}))

vi.mock('../resources/ResourcePicker', () => ({
  default: () => <div data-testid="resource-picker-stub" />,
}))

vi.mock('../../components/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

describe('ProjectFormDialog', () => {
  let createMutateAsync
  let updateMutateAsync

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({})
    updateMutateAsync = vi.fn().mockResolvedValue({})
    useCreateProject.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false })
    useUpdateProject.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false })
  })

  it('blocks submission when end date is before start date, without calling the mutation', async () => {
    const user = userEvent.setup()
    render(<ProjectFormDialog onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Test Project')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-01' } })

    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByText(/can't be before the start date/i)).toBeInTheDocument()
    expect(createMutateAsync).not.toHaveBeenCalled()
  })

  it('submits a trimmed payload on valid input and closes the dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ProjectFormDialog onClose={onClose} />)

    await user.type(screen.getByRole('textbox', { name: 'Name' }), '  Website Revamp  ')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Website Revamp', status: 'planning', risk_level: 'low' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pre-fills the form and calls the update mutation when editing an existing project', async () => {
    const user = userEvent.setup()
    const project = {
      id: 'p1',
      name: 'Existing Project',
      description: '',
      status: 'active',
      risk_level: 'high',
      owner_id: null,
      start_date: '',
      end_date: '',
    }
    render(<ProjectFormDialog project={project} onClose={vi.fn()} />)

    expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', payload: expect.objectContaining({ name: 'Existing Project' }) }),
    )
  })
})
