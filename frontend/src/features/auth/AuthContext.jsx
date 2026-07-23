import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { authApi } from './api'
import { AuthContext } from './useAuth'
import { hasMinRole } from '../../lib/roles'
import { clearTokens, getStoredUser, setTokens } from '../../lib/tokenStore'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  // On first load, re-validate any persisted session against the backend rather
  // than trusting the cached user forever - apiClient's own 401 handling will
  // transparently refresh the access token if only that has expired.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getStoredUser()) {
        setIsLoading(false)
        return
      }
      try {
        const { data } = await authApi.me()
        if (!cancelled) {
          setUser(data)
          setTokens({ user: data })
        }
      } catch {
        if (!cancelled) {
          clearTokens()
          setUser(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password)
    setTokens(data)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload)
    return data
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      hasMinRole: (role) => hasMinRole(user?.role, role),
    }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
