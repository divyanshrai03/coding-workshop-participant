import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import PropTypes from 'prop-types'

/** Standard inline error state for a failed query, with an optional retry action. */
export default function ErrorState({ title = 'Something went wrong', message, onRetry = null }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : null
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  )
}

ErrorState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  onRetry: PropTypes.func,
}
