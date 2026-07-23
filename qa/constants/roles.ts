/**
 * Mirrors ROLES in backend/_shared/auth.py and frontend/src/lib/roles.js.
 * Kept in sync manually - three separate runtimes/packages, no shared module
 * between them. See TESTING_PLAN.md §7 for the RBAC hierarchy this encodes.
 */
export const ROLES = ['admin', 'project_manager', 'team_lead', 'developer', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = Object.fromEntries(
  ROLES.map((role, index) => [role, index]),
) as Record<Role, number>;

/** True when `role` is at least as privileged as `minimumRole` (lower rank = more privileged). */
export function hasMinRole(role: Role, minimumRole: Role): boolean {
  return ROLE_RANK[role] <= ROLE_RANK[minimumRole];
}

/** Matches frontend/src/lib/roles.js's roleLabel() exactly - e.g. 'project_manager' -> 'Project Manager'. */
export function roleLabel(role: Role): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
