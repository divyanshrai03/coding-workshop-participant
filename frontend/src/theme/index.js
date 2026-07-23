import { createTheme } from '@mui/material/styles'

const softShadow = (isDark) =>
  isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04)'

const hairline = (isDark) => (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)')

export function createAppTheme(mode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? '#5B8DEF' : '#2563EB' },
      background: {
        default: isDark ? '#0B0D12' : '#F7F8FA',
        paper: isDark ? '#14161C' : '#FFFFFF',
      },
      divider: hairline(isDark),
      text: {
        primary: isDark ? '#E6E8EC' : '#0F172A',
        secondary: isDark ? '#9AA1AC' : '#5B6472',
      },
      success: { main: '#16A34A' },
      warning: { main: '#D97706' },
      error: { main: '#DC2626' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: softShadow(isDark),
            border: `1px solid ${hairline(isDark)}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
            borderBottom: `1px solid ${hairline(isDark)}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12 },
        },
      },
    },
  })
}
