/**
 * Builds the Authorization header every protected endpoint expects (see
 * TESTING_PLAN.md §7, "Authentication Flow"). The token itself comes from a
 * login fixture added in Phase 3 (UI storageState) / Phase 4 (API bearer
 * token) - this helper only standardizes the header shape.
 */
export function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}
