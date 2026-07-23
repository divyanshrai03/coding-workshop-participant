import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function ToastTrigger() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Saved successfully')}>Trigger success</button>
      <button onClick={() => toast.error('Something broke')}>Trigger error</button>
      <button onClick={() => toast.showToast('Plain message')}>Trigger default</button>
    </div>
  )
}

describe('ToastProvider', () => {
  it('shows a success toast with the filled success severity', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger success' }))
    const alert = await screen.findByText('Saved successfully')
    expect(alert.closest('.MuiAlert-colorSuccess')).not.toBeNull()
  })

  it('shows an error toast with the filled error severity', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger error' }))
    const alert = await screen.findByText('Something broke')
    expect(alert.closest('.MuiAlert-colorError')).not.toBeNull()
  })

  it('defaults showToast() with no options to the info severity', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger default' }))
    const alert = await screen.findByText('Plain message')
    expect(alert.closest('.MuiAlert-colorInfo')).not.toBeNull()
  })

  it('stacks multiple simultaneous toasts, and clicking one to trigger another does not dismiss it', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger success' }))
    expect(await screen.findByText('Saved successfully')).toBeInTheDocument()

    // Clicking a second trigger button is a click "elsewhere" on the page as far as the
    // first toast's Snackbar is concerned - it must not be treated as a dismissal of it.
    await user.click(screen.getByRole('button', { name: 'Trigger error' }))
    expect(await screen.findByText('Something broke')).toBeInTheDocument()
    expect(screen.getByText('Saved successfully')).toBeInTheDocument()
  })

  it('closing one toast via its close button does not dismiss the other', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger success' }))
    await user.click(screen.getByRole('button', { name: 'Trigger error' }))
    expect(await screen.findByText('Saved successfully')).toBeInTheDocument()
    expect(screen.getByText('Something broke')).toBeInTheDocument()

    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    await user.click(closeButtons[0])

    await waitFor(() => expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument())
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })
})
