# API Testing

## What it is

109 Playwright tests (`qa/tests/api/`, `api` project - no browser) covering all 39 endpoints across the 4 backend services: auth, projects, resources, budgets.

## How it works

Each file covers one service and its full contract:
- Every method/route (GET/POST/PATCH/DELETE)
- Auth (401 with no/invalid token) and RBAC (403 for under-privileged roles, matching each handler's `require_role`/`require_min_role` gate)
- Validation (400 for missing fields, bad enums, invalid UUIDs, bad dates, out-of-range numbers)
- Not-found (404) and conflict (409) paths
- Business rules specific to that service (e.g. circular-dependency detection, budget-per-project uniqueness, allocation-percent range)

`fixtures/api-auth.fixtures.ts` provides an `accessToken` fixture via `test.use({ role })` - logs in through the real `/login` endpoint per test, no mocking. `helpers/api-setup.ts` (`createProject`, `createDeliverable`, `createAssignment`, `createBudget`, `currentUserId`) builds prerequisite data through the same real API. Every file cleans up its own data in `afterAll`.

## Commands

```bash
cd qa
npm run test:api
npx playwright test --project=api tests/api/budgets.spec.ts   # one service
```

## Example

```ts
// qa/tests/api/budgets.spec.ts (excerpt)
test('project_manager is forbidden from deleting a budget; only admin can', async ({ request }) => {
  const pmDelete = await request.delete(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
    headers: authHeader(pmToken),
  });
  expect(pmDelete.status()).toBe(403);

  const adminDelete = await request.delete(apiPath(SERVICES.budgets, `/budgets/${budgetId}`), {
    headers: authHeader(adminToken),
  });
  expect(adminDelete.status()).toBe(204);
});
```
