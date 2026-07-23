/**
 * Generic random-data generators for building unique test fixtures at run
 * time (e.g. `users.email` is UNIQUE in the schema - see TESTING_PLAN.md §5).
 * Deliberately dependency-free (no faker) to keep the framework's install
 * footprint small; swap for a library here if test data needs grow richer.
 */

/** Short, sortable-ish unique suffix for names/emails created during a test run. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function uniqueEmail(prefix = 'qa-user'): string {
  return `${prefix}-${uniqueSuffix()}@acme-test.com`;
}

export function uniqueName(prefix = 'QA Test'): string {
  return `${prefix} ${uniqueSuffix()}`;
}
