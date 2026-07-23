import { useCallback, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { ToastContext } from './useToast'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const showToast = useCallback((message, { severity = 'info' } = {}) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, severity }])
  }, [])

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      showToast,
      success: (message) => showToast(message, { severity: 'success' }),
      error: (message) => showToast(message, { severity: 'error' }),
      info: (message) => showToast(message, { severity: 'info' }),
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={4000}
          onClose={(_event, reason) => {
            // Ignoring 'clickaway' keeps toasts independently dismissible: without this,
            // any click anywhere on the page - including a different toast's own close
            // button - closes every open Snackbar, since each one's ClickAwayListener
            // treats that click as outside itself.
            if (reason === 'clickaway') return
            closeToast(toast.id)
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ mb: index * 7 }}
        >
          <Alert
            onClose={() => closeToast(toast.id)}
            severity={toast.severity}
            variant="filled"
            sx={{ minWidth: 280 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  )
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
