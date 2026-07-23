import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export default function PageFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
      <CircularProgress size={28} aria-label="Loading page" />
    </Box>
  )
}
