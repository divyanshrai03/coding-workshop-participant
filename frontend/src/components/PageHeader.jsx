import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'

export default function PageHeader({ title, description = null, actions = null }) {
  return (
    <Box sx={{ mb: 3 }}>
      {/* @mui/material v9's Stack no longer forwards arbitrary style-system
          props like justifyContent/alignItems (only direction/spacing/divider
          are in its propTypes) - they're silently dropped unless passed via
          sx, which is why this row previously only "looked" aligned by
          accident (title/button happened to share the same computed height). */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{
          justifyContent: 'flex-start',
          alignItems: { xs: 'flex-start', sm: 'center' },
        }}
      >
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {actions && (
          <Box
            sx={{
              '& .MuiButton-root': {
                px: 2.5,
                py: 1.25,
                minHeight: 48,
              },
            }}
          >
            {actions}
          </Box>
        )}
      </Stack>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
  )
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actions: PropTypes.node,
}
