import { lazy } from 'react'

// Each feature page is its own chunk, fetched only when that route is visited.
// Placeholder pages are small today, but Milestone 7 fills these with tables,
// forms and charts - splitting now avoids a much bigger vendor bundle later.
export const LoginPage = lazy(() => import('../features/auth/LoginPage'))
export const RegisterPage = lazy(() => import('../features/auth/RegisterPage'))
export const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
export const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage'))
export const ProjectDetailPage = lazy(() => import('../features/projects/ProjectDetailPage'))
export const ResourcesPage = lazy(() => import('../features/resources/ResourcesPage'))
export const BudgetsPage = lazy(() => import('../features/budgets/BudgetsPage'))
