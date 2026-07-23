import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeModeProvider } from './ThemeModeContext'
import { useThemeMode } from './useThemeMode'

const STORAGE_KEY = 'pm_platform_theme_mode'

function mockMatchMedia(prefersDark) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(prefers-color-scheme: dark)' && prefersDark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function ModeReadout() {
  const { mode, resolvedMode, setMode, toggleMode } = useThemeMode()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolvedMode}</span>
      <button onClick={() => setMode('dark')}>Set dark</button>
      <button onClick={toggleMode}>Toggle</button>
    </div>
  )
}

describe('ThemeModeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to "system" mode, resolved against prefers-color-scheme', () => {
    mockMatchMedia(true)
    render(
      <ThemeModeProvider>
        <ModeReadout />
      </ThemeModeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('restores a previously persisted mode from localStorage', () => {
    mockMatchMedia(false)
    localStorage.setItem(STORAGE_KEY, 'light')
    render(
      <ThemeModeProvider>
        <ModeReadout />
      </ThemeModeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('persists an explicit setMode() call to localStorage', async () => {
    mockMatchMedia(false)
    const user = userEvent.setup()
    render(
      <ThemeModeProvider>
        <ModeReadout />
      </ThemeModeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set dark' }))
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('toggleMode flips the resolved system mode to its opposite explicit mode', async () => {
    mockMatchMedia(true) // system currently resolves to dark
    const user = userEvent.setup()
    render(
      <ThemeModeProvider>
        <ModeReadout />
      </ThemeModeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })
})
