import { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import AuthLayout from '../layouts/AuthLayout'
import ProtectedRoute from './ProtectedRoute'
import PageFallback from './PageFallback'
import {
  BudgetsPage,
  DashboardPage,
  LoginPage,
  ProjectDetailPage,
  ProjectsPage,
  RegisterPage,
  ResourcesPage,
} from './lazyPages'

function withSuspense(element) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: withSuspense(<LoginPage />) },
      { path: '/register', element: withSuspense(<RegisterPage />) },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: withSuspense(<DashboardPage />) },
      { path: '/projects', element: withSuspense(<ProjectsPage />) },
      { path: '/projects/:id', element: withSuspense(<ProjectDetailPage />) },
      { path: '/resources', element: withSuspense(<ResourcesPage />) },
      { path: '/budgets', element: withSuspense(<BudgetsPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
