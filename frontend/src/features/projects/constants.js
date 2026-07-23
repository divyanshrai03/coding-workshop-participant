/** Mirrors the Postgres enums in backend/_shared/migrations/0001_init_schema.sql. */

export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning', color: 'default' },
  { value: 'active', label: 'Active', color: 'info' },
  { value: 'on_hold', label: 'On Hold', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'cancelled', label: 'Cancelled', color: 'default' },
]

export const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low', color: 'success' },
  { value: 'medium', label: 'Medium', color: 'info' },
  { value: 'high', label: 'High', color: 'warning' },
  { value: 'critical', label: 'Critical', color: 'error' },
]

export const DELIVERABLE_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: 'default' },
  { value: 'in_progress', label: 'In Progress', color: 'info' },
  { value: 'in_review', label: 'In Review', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'blocked', label: 'Blocked', color: 'error' },
]

export const DEPENDENCY_TYPE_OPTIONS = [
  { value: 'blocks', label: 'Blocks' },
  { value: 'related', label: 'Related' },
]

export const PROJECT_SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'end_date', label: 'Due date' },
  { value: 'risk_level', label: 'Risk level' },
]
