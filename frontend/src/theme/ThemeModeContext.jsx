import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { createAppTheme } from './index'
import { ThemeModeContext } from './useThemeMode'

const STORAGE_KEY = 'pm_platform_theme_mode'

export function ThemeModeProvider({ children }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      setMode,
      toggleMode: () =>
        setMode((prev) => {
          const current = prev === 'system' ? (prefersDark ? 'dark' : 'light') : prev
          return current === 'dark' ? 'light' : 'dark'
        }),
    }),
    [mode, resolvedMode, prefersDark],
  )

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

ThemeModeProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
