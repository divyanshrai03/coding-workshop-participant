"""Idempotent SQL migration runner for the PostgreSQL schema.

Applies every *.sql file in migrations/, in filename order, tracking applied
versions (and a checksum of their contents) in a schema_migrations table so
reruns are safe. Invoked via bin/migrate-db.sh, never automatically at
Lambda cold start, so schema changes are an explicit, auditable step.
"""
import hashlib
import logging
import sys
from pathlib import Path

from db import get_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("migrate")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _ensure_tracking_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def _applied_versions(cur) -> dict:
    cur.execute("SELECT version, checksum FROM schema_migrations")
    return {row["version"]: row["checksum"] for row in cur.fetchall()}


def run() -> None:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        logger.warning("No migration files found in %s", MIGRATIONS_DIR)
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            _ensure_tracking_table(cur)
        conn.commit()

        with conn.cursor() as cur:
            applied = _applied_versions(cur)

        for path in files:
            version = path.name
            sql = path.read_text()
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()

            if version in applied:
                if applied[version] != checksum:
                    logger.error(
                        "Checksum mismatch for already-applied migration %s "
                        "— the file changed after it was applied. Refusing to continue.",
                        version,
                    )
                    sys.exit(1)
                logger.info("Skipping already-applied migration %s", version)
                continue

            logger.info("Applying migration %s", version)
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)",
                    (version, checksum),
                )
            conn.commit()
            logger.info("Applied %s", version)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run()
