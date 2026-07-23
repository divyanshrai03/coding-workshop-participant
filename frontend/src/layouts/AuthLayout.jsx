import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <Stack spacing={0.5} sx={{ mb: 4 }} alignItems="center">
          <Typography variant="h5" fontWeight={700}>
            ACME Projects
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Project Management Platform
          </Typography>
        </Stack>
        <Outlet />
      </Paper>
    </Box>
  )
}
