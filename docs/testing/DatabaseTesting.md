# Database Testing

## What it is

13 pytest tests (`backend/_shared/tests/test_db_integrity.py`) validating guarantees that live in the schema/migration layer itself - deliberately **not** re-testing what API tests (Phase 4) and integration tests (Phase 6) already cover through real database calls via the app.

## How it works

Runs against the real local Postgres, using a `db_cursor` fixture that always rolls back afterward - nothing persists.

- **Migration runner** (`migrate.py`, never tested before this): re-running is a no-op (idempotent), every migration file's tracked checksum matches its content, and the checksum-mismatch safety check (refuses to continue if an applied migration file was edited afterward) actually fires.
- **Raw-SQL constraint enforcement** - bypassing the app's Python validation entirely, proving 7 constraints are real database guarantees: email uniqueness, positive capacity hours, `end_date >= start_date`, no self-dependencies, unique dependency edges, allocation percent 1-100, non-negative planned budget.
- **Cascade delete at the raw-SQL level** - `delete_project()` in the app issues only `DELETE FROM projects`, no manual cleanup, so this proves the cascade is a genuine `ON DELETE CASCADE` guarantee, not something that only works because of app code.
- **Schema-only tables** (`refresh_tokens`, `audit_logs`) confirmed to exist and remain genuinely empty (no app code uses them - stateless JWTs, no audit logging yet).

ETL: not applicable - confirmed via a targeted search that no data pipeline/batch/import code exists in this codebase.

## Commands

```bash
cd backend
.venv/bin/pytest _shared/tests/test_db_integrity.py -v
```

## Example

```python
def test_deleting_a_project_cascades_at_the_raw_sql_level(self, db_cursor):
    project_id = _seed_project(db_cursor)
    deliverable_id = _seed_deliverable(db_cursor, project_id)
    db_cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
    db_cursor.execute("SELECT COUNT(*) AS n FROM deliverables WHERE id = %s", (deliverable_id,))
    assert db_cursor.fetchone()["n"] == 0
```
