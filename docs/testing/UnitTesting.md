# Unit Testing

## What it is

Fast, isolated tests with no network/browser: **pytest** for the Python backend (124 tests, built from scratch in Phase 5/9), **Vitest** for the React frontend (45 tests - 32 pre-existing, 13 added in Phase 5).

## How it works

**Backend** (`backend/`): `pytest.ini` puts `backend/_shared` first on `pythonpath`. All 4 services' `_lib/{auth,db,errors,http_utils,router,validation}.py` are byte-identical copies of `_shared/` (Terraform's `sync_shared_lib` provisioner keeps them that way), so testing `_shared/` once covers all 4 services - no 4x duplication. `backend/conftest.py`'s `load_service_function` fixture imports each service's `function.py` under a unique module name to test service-specific pure helpers (`_with_completion`, `_with_budget_math`, etc.) without a `function`-module name collision.

DB-touching handler logic (anything calling `transaction()`) is deliberately **not** unit-tested here - Phase 4's API tests already cover that against a real database at higher fidelity than a mocked cursor would.

**Frontend** (`frontend/src/`): Vitest + Testing Library, colocated `*.test.jsx` files. New additions this round (`RoleGuard`, `ThemeModeProvider`, `ToastProvider`) were the smallest genuine coverage gaps - not the heavy dialog forms already proven end-to-end by Phase 3's UI tests.

## Commands

```bash
cd backend && .venv/bin/pytest -v
cd backend && .venv/bin/pytest --cov=_shared --cov-report=term-missing
cd frontend && npm test
```

## Example

```python
# backend/_shared/tests/test_validation.py (excerpt)
def test_raises_for_a_sort_key_not_in_the_allow_list(self):
    # Guards against SQL injection via the sort param - only allow-listed columns pass.
    with pytest.raises(ValidationError) as exc_info:
        parse_sort({"sort": "1; DROP TABLE users;"}, self.ALLOWED, default="name")
    assert exc_info.value.details["allowed"] == ["name", "created_at"]
```
