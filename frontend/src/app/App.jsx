import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { ToastProvider } from '../components/ToastProvider'
import { queryClient } from '../lib/queryClient'
import { ThemeModeProvider } from '../theme/ThemeModeContext'
import ErrorBoundary from './ErrorBoundary'
import { router } from './routes'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeModeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeModeProvider>
    </ErrorBoundary>
  )
}
