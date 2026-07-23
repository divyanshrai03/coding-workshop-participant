import { alpha, createTheme } from '@mui/material/styles'

/**
 * Centralized design tokens. Every MUI component inherits from this file, so
 * visual changes belong here first - per-page `sx` overrides should only
 * handle genuine one-offs (see DESIGN.md-equivalent brief: minimal/premium
 * SaaS aesthetic inspired by Linear/Notion/Vercel/Stripe/GitHub/Clerk).
 */

const LIGHT = {
  background: '#F8FAFC',
  paper: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
}

// Neutral slate grays, never pure black - a dark UI that still feels premium
// rather than a naive color inversion.
const DARK = {
  background: '#0F172A',
  paper: '#1E293B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#3B82F6',
  accentHover: '#60A5FA',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
}

const softShadow = (isDark) =>
  isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04)'

const liftShadow = (isDark) =>
  isDark ? '0 4px 16px rgba(0, 0, 0, 0.32)' : '0 8px 24px rgba(15, 23, 42, 0.08)'

export function createAppTheme(mode) {
  const isDark = mode === 'dark'
  const tokens = isDark ? DARK : LIGHT

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: tokens.accent, dark: tokens.accentHover, contrastText: '#FFFFFF' },
      background: { default: tokens.background, paper: tokens.paper },
      divider: tokens.border,
      text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
      success: { main: tokens.success },
      warning: { main: tokens.warning },
      error: { main: tokens.danger },
      info: { main: tokens.info },
    },
    shape: { borderRadius: 10 },
    spacing: 8,
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      // Page title
      h4: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.01em' },
      // Section title
      h5: { fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.005em' },
      // Card / dialog title
      h6: { fontSize: '1.125rem', fontWeight: 600 },
      subtitle1: { fontSize: '1rem', fontWeight: 600 },
      subtitle2: { fontSize: '1.125rem', fontWeight: 600 },
      body1: { fontSize: '1rem' },
      body2: { fontSize: '0.9375rem' },
      caption: { fontSize: '0.8125rem' },
      overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' },
      button: { fontWeight: 600, textTransform: 'none', fontSize: '0.9375rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: tokens.background },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: softShadow(isDark),
            border: `1px solid ${tokens.border}`,
            borderRadius: 12,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            minHeight: 40,
            transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 80ms ease',
            '&:active': { transform: 'scale(0.97)' },
          },
          sizeSmall: { padding: '6px 12px', minHeight: 34 },
          sizeLarge: { padding: '10px 20px', minHeight: 48 },
          contained: {
            '&:hover': { boxShadow: 'none' },
          },
          // Default MUI icons (24px) read as oversized/misaligned next to the
          // 15px button label - applies to every startIcon/endIcon button
          // app-wide (e.g. the "New Project"/"New Budget" pattern), not a
          // per-page fix, matching the theme-first approach used elsewhere.
          startIcon: {
            marginRight: 6,
            '& > *:nth-of-type(1)': { fontSize: 18 },
          },
          endIcon: {
            marginLeft: 6,
            '& > *:nth-of-type(1)': { fontSize: 18 },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
          notchedOutline: { borderColor: tokens.border },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 600 },
          outlined: { borderColor: tokens.border },
          // Soft pill badges: a light tint of the color instead of a saturated
          // fill - status/risk chips (StatusChip) all flow through this.
          filled: ({ theme: t, ownerState }) => {
            if (!ownerState.color || ownerState.color === 'default') {
              return { backgroundColor: alpha(tokens.textSecondary, isDark ? 0.24 : 0.12) }
            }
            const paletteColor = t.palette[ownerState.color]
            if (!paletteColor) return {}
            return {
              backgroundColor: alpha(paletteColor.main, isDark ? 0.24 : 0.14),
              color: isDark ? paletteColor.main : paletteColor.main,
            }
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 8, height: 6, backgroundColor: alpha(tokens.textSecondary, isDark ? 0.2 : 0.12) },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${tokens.border}`,
            padding: '12px 16px',
            fontSize: '0.9375rem',
          },
          head: {
            // Not position:sticky - that has known reflow/spacing quirks on
            // <table> layouts specifically (confirmed visually: it reserved a
            // large blank gap above the header even unscrolled). Visually
            // distinct instead: muted uppercase label style + a firmer
            // dividing border, which reads as a clear header at a glance.
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: tokens.textSecondary,
            backgroundColor: isDark ? alpha('#FFFFFF', 0.03) : alpha(tokens.textSecondary, 0.04),
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: `1px solid ${tokens.border}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16 },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { padding: '20px 24px 12px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '12px 24px' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '16px 24px 20px' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, boxShadow: liftShadow(isDark) },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
            borderBottom: `1px solid ${tokens.border}`,
            backdropFilter: 'blur(8px)',
            backgroundColor: isDark ? alpha(tokens.paper, 0.85) : alpha(tokens.paper, 0.9),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: 'none', borderColor: tokens.border },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12, borderRadius: 6 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
    },
  })

  return theme
}
