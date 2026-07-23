"""Phase 9 (targeted): validates guarantees that live in the schema/migration
layer itself, not in application code - Phases 4 and 6 already prove the API
and UI enforce these rules through the app, so this file only covers what
those can't: raw-SQL constraint enforcement (defense in depth if the app
layer were ever bypassed), migration idempotency/safety, and the two
schema-only tables staying genuinely unused. Every test runs against the real
local Postgres instance and rolls back unconditionally - nothing persists.
"""
import hashlib
from pathlib import Path

import psycopg
import pytest

import migrate
from db import get_connection

MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


@pytest.fixture
def db_cursor():
    """A real cursor against the local dev Postgres. Always rolled back after
    the test, whether it passed or failed, so nothing is ever persisted."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        yield cur
    finally:
        # migrate.run() (called by some tests) closes the shared cached connection
        # in its own finally block, so by teardown time this one may already be dead.
        if not conn.closed:
            conn.rollback()
        cur.close()


def _seed_project(cur) -> str:
    cur.execute("INSERT INTO projects (name) VALUES ('db-integrity-scratch') RETURNING id")
    return cur.fetchone()["id"]


def _seed_deliverable(cur, project_id: str, name: str = "scratch deliverable") -> str:
    cur.execute(
        "INSERT INTO deliverables (project_id, name) VALUES (%s, %s) RETURNING id",
        (project_id, name),
    )
    return cur.fetchone()["id"]


def _seed_user(cur, email: str) -> str:
    cur.execute(
        "INSERT INTO users (email, password_hash, full_name) VALUES (%s, 'x', 'Scratch User') RETURNING id",
        (email,),
    )
    return cur.fetchone()["id"]


class TestMigrationRunner:
    def test_is_idempotent_against_the_real_database(self):
        # migrate.run() connects and commits internally; running it twice must be a no-op
        # the second time (already-applied versions are skipped, not re-executed).
        migrate.run()
        migrate.run()

    def test_tracks_every_migration_file_with_a_matching_checksum(self, db_cursor):
        db_cursor.execute("SELECT version, checksum FROM schema_migrations")
        tracked = {row["version"]: row["checksum"] for row in db_cursor.fetchall()}
        for path in MIGRATIONS_DIR.glob("*.sql"):
            expected = hashlib.sha256(path.read_text().encode("utf-8")).hexdigest()
            assert path.name in tracked, f"{path.name} was never applied/tracked"
            assert tracked[path.name] == expected, f"{path.name}'s tracked checksum is stale"

    def test_refuses_to_continue_if_an_applied_migration_s_checksum_no_longer_matches(self, db_cursor):
        # Simulates someone editing an already-applied migration file after the fact -
        # a real safety mechanism (migrate.py's own words: "Refusing to continue") that
        # would otherwise never get exercised by any other test in this suite.
        db_cursor.execute(
            "UPDATE schema_migrations SET checksum = 'deliberately-wrong' WHERE version = '0001_init_schema.sql'"
        )
        db_cursor.connection.commit()
        try:
            with pytest.raises(SystemExit) as exc_info:
                migrate.run()
            assert exc_info.value.code == 1
        finally:
            # Restore the real checksum so this test doesn't permanently corrupt the
            # tracking table for every test/run after it. Can't reuse db_cursor here:
            # migrate.run()'s own finally block closes the connection it got from
            # get_connection() - the same module-level cached connection db_cursor
            # was built from - so a fresh one is needed to do the restore.
            conn = get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE schema_migrations SET checksum = %s WHERE version = '0001_init_schema.sql'",
                    (hashlib.sha256((MIGRATIONS_DIR / "0001_init_schema.sql").read_text().encode("utf-8")).hexdigest(),),
                )
            conn.commit()


class TestSchemaConstraints:
    """Each of these bypasses application validation entirely (raw SQL), proving
    the constraint is a database guarantee, not just something app code happens
    to enforce - defense in depth if a bug, migration, or admin script ever
    inserted a row without going through the API."""

    def test_user_email_uniqueness_is_enforced_at_the_db_level(self, db_cursor):
        _seed_user(db_cursor, "db-integrity-dup@acme-test.com")
        with pytest.raises(psycopg.errors.UniqueViolation):
            _seed_user(db_cursor, "db-integrity-dup@acme-test.com")

    def test_user_capacity_hours_must_be_positive(self, db_cursor):
        with pytest.raises(psycopg.errors.CheckViolation):
            db_cursor.execute(
                "INSERT INTO users (email, password_hash, full_name, capacity_hours_per_week) "
                "VALUES ('db-integrity-capacity@acme-test.com', 'x', 'Scratch', 0)"
            )

    def test_project_end_date_before_start_date_is_rejected(self, db_cursor):
        with pytest.raises(psycopg.errors.CheckViolation):
            db_cursor.execute(
                "INSERT INTO projects (name, start_date, end_date) VALUES ('scratch', '2026-06-01', '2026-01-01')"
            )

    def test_deliverable_cannot_depend_on_itself(self, db_cursor):
        project_id = _seed_project(db_cursor)
        deliverable_id = _seed_deliverable(db_cursor, project_id)
        with pytest.raises(psycopg.errors.CheckViolation):
            db_cursor.execute(
                "INSERT INTO dependencies (deliverable_id, depends_on_deliverable_id) VALUES (%s, %s)",
                (deliverable_id, deliverable_id),
            )

    def test_duplicate_dependency_edge_is_rejected_by_the_unique_constraint(self, db_cursor):
        project_id = _seed_project(db_cursor)
        a = _seed_deliverable(db_cursor, project_id, "A")
        b = _seed_deliverable(db_cursor, project_id, "B")
        db_cursor.execute(
            "INSERT INTO dependencies (deliverable_id, depends_on_deliverable_id) VALUES (%s, %s)", (a, b)
        )
        with pytest.raises(psycopg.errors.UniqueViolation):
            db_cursor.execute(
                "INSERT INTO dependencies (deliverable_id, depends_on_deliverable_id) VALUES (%s, %s)", (a, b)
            )

    def test_assignment_allocation_percent_must_be_between_1_and_100(self, db_cursor):
        project_id = _seed_project(db_cursor)
        user_id = _seed_user(db_cursor, "db-integrity-assignee@acme-test.com")
        with pytest.raises(psycopg.errors.CheckViolation):
            db_cursor.execute(
                "INSERT INTO assignments (project_id, user_id, allocation_percent) VALUES (%s, %s, 150)",
                (project_id, user_id),
            )

    def test_budget_planned_amount_cannot_be_negative(self, db_cursor):
        project_id = _seed_project(db_cursor)
        with pytest.raises(psycopg.errors.CheckViolation):
            db_cursor.execute(
                "INSERT INTO budgets (project_id, planned_amount) VALUES (%s, -1)", (project_id,)
            )

    def test_deleting_a_project_cascades_at_the_raw_sql_level(self, db_cursor):
        # Bypasses the app layer entirely (delete_project() in
        # projects-service/function.py issues only `DELETE FROM projects` - no
        # manual cleanup of related tables) to prove the cascade is a real FK
        # guarantee, not something that only happens to work via app code.
        project_id = _seed_project(db_cursor)
        deliverable_id = _seed_deliverable(db_cursor, project_id)
        user_id = _seed_user(db_cursor, "db-integrity-cascade@acme-test.com")
        db_cursor.execute(
            "INSERT INTO assignments (project_id, user_id) VALUES (%s, %s)", (project_id, user_id)
        )
        db_cursor.execute("INSERT INTO budgets (project_id, planned_amount) VALUES (%s, 100)", (project_id,))

        db_cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))

        db_cursor.execute("SELECT COUNT(*) AS n FROM deliverables WHERE id = %s", (deliverable_id,))
        assert db_cursor.fetchone()["n"] == 0
        db_cursor.execute("SELECT COUNT(*) AS n FROM assignments WHERE project_id = %s", (project_id,))
        assert db_cursor.fetchone()["n"] == 0
        db_cursor.execute("SELECT COUNT(*) AS n FROM budgets WHERE project_id = %s", (project_id,))
        assert db_cursor.fetchone()["n"] == 0


class TestUnusedSchemaOnlyTables:
    """refresh_tokens and audit_logs exist in the schema but no application code
    reads or writes them (confirmed by grep across backend/ - auth uses stateless
    JWTs, not a refresh_tokens table; nothing logs to audit_logs). This test just
    keeps that claim honest over time instead of letting it silently go stale."""

    @pytest.mark.parametrize("table", ["refresh_tokens", "audit_logs"])
    def test_table_exists_and_is_genuinely_empty(self, db_cursor, table):
        db_cursor.execute(f"SELECT COUNT(*) AS n FROM {table}")  # nosec B608 - table name is a fixed test parameter, not user input
        assert db_cursor.fetchone()["n"] == 0
