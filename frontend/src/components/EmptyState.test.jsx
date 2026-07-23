import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="Nothing here yet" description="Create your first project to get started." />)

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first project to get started.')).toBeInTheDocument()
  })

  it('omits the action button when no onAction is provided', () => {
    render(<EmptyState title="Nothing here yet" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('invokes onAction when the action button is clicked', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <EmptyState icon={FolderOutlinedIcon} title="No projects" actionLabel="New Project" onAction={onAction} />,
    )

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
