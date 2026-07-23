# Testing Summary

Final review of the testing initiative (Phases 1-12; Phase 8 skipped, Phases 7/9/10/11 scope-reduced under time constraints - see each phase's report/doc for specifics). See `TESTING_PLAN.md` for the original analysis this was built from.

## What exists

| Layer | Count | Where | Status |
|---|---|---|---|
| Frontend unit (Vitest) | 45 | `frontend/src/**/*.test.jsx` | ✅ passing |
| Backend unit + DB (pytest) | 124 | `backend/{_shared,*-service}/tests/` | ✅ passing, 97% coverage on `_shared` |
| UI (Playwright, Chromium) | 41 | `qa/tests/ui/` | ✅ passing |
| API (Playwright) | 109 | `qa/tests/api/` | ✅ passing, all 39 endpoints |
| Integration (Playwright) | 9 | `qa/tests/integration/` | ✅ passing |
| Performance (JMeter) | 1 plan (login + dashboard) | `qa/perf/` | ✅ 0 errors at 20 concurrent users |
| **Total automated tests** | **328** | | |

Documentation: `docs/testing/` (10 concise docs) + this file + `TESTING_PLAN.md`.

## Covered

Every implemented feature has at least one layer of coverage: full auth flow (register/login/refresh/RBAC), project/deliverable/dependency CRUD, resource assignments + workload, budgets + spend entries, the dashboard aggregate, and the two cross-cutting flows most likely to break silently (session token refresh, project-delete cascade across 3 services).

## Not covered / known gaps

- **WebKit** - can't launch in this sandbox (missing system libs, no sudo). Configured and expected to work in CI or any machine with the libs present.
- **Regression tagging** (Phase 8) - skipped. The full suite re-run serves this function today; `@smoke`/`@regression` tags were never applied.
- **JMeter** - only login + dashboard load; stress/spike/soak/concurrent-ramp not built.
- **CI wiring** - none of these suites run automatically on push/PR yet (`.github/workflows/` only runs security scans).
- Two schema-only tables (`refresh_tokens`, `audit_logs`) remain genuinely unused by app code - confirmed, not a gap, just worth knowing.

## Real bugs found and fixed along the way

1. **`hooks.js` cache invalidation** (Phase 3) - deleting/updating a resource assignment didn't refresh the dialog showing it.
2. **`ToastProvider.jsx` clickaway bug** (Phase 5) - any click while a toast was open dismissed *every* open toast, not just the clicked one.
3. **`get_project()` missing `percent_used`** (Phase 6) - Project Detail page always showed "0% spent" regardless of actual spend.
4. **`ProjectDetailPage.ts` ambiguous locator** (Phase 6, test infra) - page-level delete button collided with a deliverable row's icon-only delete button once both existed together.
5. **`start-dev.sh` pip/Python ABI mismatch** (Phase 6) - vendored dependencies silently failed to install for the correct Python version, breaking every Lambda on next cold start.
Plus 4 earlier environment/deployment bugs fixed before testing began (psycopg version pin, migrate-db.sh interpreter mismatch, deploy-backend.sh config sourcing, missing Authorization header forwarding in the local proxy).

## Risk assessment

| Risk | Severity | Mitigated by |
|---|---|---|
| Silent RBAC bypass | High if present | 100+ explicit 403 tests across every write endpoint and UI action |
| Cross-service data inconsistency | High if present | Integration suite (caught #3 and #4 above) |
| DB constraint drift | Medium | Phase 9's raw-SQL constraint tests |
| No CI gate | Medium | Suites exist and pass locally; wiring is the only gap |
| Regression on future changes | Low-Medium | Full suite is fast enough (~3 min Playwright, ~2s pytest, ~20s Vitest) to re-run before every merge even without CI |

## Recommendations (future work, priority order)

1. Wire the existing suites into CI (`.github/workflows/`) - the single highest-leverage gap, everything else already exists.
2. Tag and split `@smoke`/`@regression` (Phase 8's original scope).
3. Fix WebKit in whatever environment actually runs CI, or drop it as a project if it never will.
4. Round out JMeter with stress/spike tests once there's a real staging environment to point it at (load-testing a shared local sandbox has limited signal).
5. Consider light audit logging now that `audit_logs` exists in the schema unused - either use it or drop it.
