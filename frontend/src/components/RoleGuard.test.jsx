import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RoleGuard from './RoleGuard'
import { useAuth } from '../features/auth/useAuth'

vi.mock('../features/auth/useAuth')

describe('RoleGuard', () => {
  it('renders children when the current user meets the minimum role', () => {
    useAuth.mockReturnValue({ hasMinRole: () => true })
    render(
      <RoleGuard minRole="team_lead">
        <button>Delete</button>
      </RoleGuard>,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders nothing when no fallback is given and the role check fails', () => {
    useAuth.mockReturnValue({ hasMinRole: () => false })
    const { container } = render(
      <RoleGuard minRole="admin">
        <button>Delete</button>
      </RoleGuard>,
    )
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the fallback when the role check fails', () => {
    useAuth.mockReturnValue({ hasMinRole: () => false })
    render(
      <RoleGuard minRole="admin" fallback={<span>Read-only</span>}>
        <button>Delete</button>
      </RoleGuard>,
    )
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByText('Read-only')).toBeInTheDocument()
  })

  it('calls hasMinRole with the given minRole', () => {
    const hasMinRole = vi.fn().mockReturnValue(true)
    useAuth.mockReturnValue({ hasMinRole })
    render(
      <RoleGuard minRole="project_manager">
        <span>Content</span>
      </RoleGuard>,
    )
    expect(hasMinRole).toHaveBeenCalledWith('project_manager')
  })
})
