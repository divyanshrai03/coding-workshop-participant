import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'
import { authApi } from './api'
import { clearTokens, getStoredUser } from '../../lib/tokenStore'

vi.mock('./api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
  },
}))

function Probe() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.full_name ?? 'none'}</span>
      <button
        type="button"
        onClick={() => login('ada@acme.com', 'supersecret1')}
      >
        Login
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  afterEach(() => {
    clearTokens()
    vi.clearAllMocks()
  })

  it('starts unauthenticated with no stored session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('logs in, persists the session, and logs out again', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue({
      data: {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        user: { id: 'u1', full_name: 'Ada Admin', role: 'admin' },
      },
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'))
    expect(screen.getByTestId('user')).toHaveTextContent('Ada Admin')
    expect(getStoredUser()).toEqual({ id: 'u1', full_name: 'Ada Admin', role: 'admin' })

    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    expect(getStoredUser()).toBeNull()
  })

  it('re-validates a stored session against /me on mount', async () => {
    localStorage.setItem(
      'pm_platform_auth',
      JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u1', full_name: 'Stale Name' } }),
    )
    authApi.me.mockResolvedValue({ data: { id: 'u1', full_name: 'Fresh Name', role: 'viewer' } })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Fresh Name'))
    expect(authApi.me).toHaveBeenCalledTimes(1)
  })

  it('clears a stale session when /me rejects', async () => {
    localStorage.setItem(
      'pm_platform_auth',
      JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u1', full_name: 'Stale Name' } }),
    )
    authApi.me.mockRejectedValue(new Error('expired'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'))
    expect(getStoredUser()).toBeNull()
  })
})
