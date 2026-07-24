"""PostgreSQL connection pooling shared across warm Lambda invocations.

Reuses a single module-level connection between invocations within the same
Lambda execution environment, matching the pattern already established in
backend/_examples/python-service/postgres_service.py.
"""
import os
from contextlib import contextmanager

from psycopg import connect
from psycopg.rows import dict_row

_CONNECTION = None


def _build_conninfo() -> str:
    """Builds a psycopg conninfo string from POSTGRES_* env vars.

    Requires TLS (sslmode=require) whenever IS_LOCAL is not "true", i.e. for
    every non-local (Aurora) target.

    Returns:
        A space-separated libpq connection string.
    """
    is_local = os.getenv("IS_LOCAL", "true") == "true"
    parts = [
        f"host={os.getenv('POSTGRES_HOST', 'localhost')}",
        f"port={os.getenv('POSTGRES_PORT', '5432')}",
        f"user={os.getenv('POSTGRES_USER', 'postgres')}",
        f"password={os.getenv('POSTGRES_PASS', 'postgres123')}",
        f"dbname={os.getenv('POSTGRES_NAME', 'postgres')}",
        "connect_timeout=15",
    ]
    if not is_local:
        parts.append("sslmode=require")
    return " ".join(parts)


def get_connection():
    """Returns a pooled PostgreSQL connection, reconnecting if it was closed or never created."""
    global _CONNECTION
    if _CONNECTION is None or _CONNECTION.closed:
        _CONNECTION = connect(_build_conninfo(), row_factory=dict_row, autocommit=False)
    return _CONNECTION


def reset_connection() -> None:
    """Drops the cached connection so the next get_connection() call reconnects from scratch."""
    global _CONNECTION
    _CONNECTION = None


@contextmanager
def transaction():
    """Yields a dict-row cursor; commits on success, rolls back and resets the pool on error."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        reset_connection()
        raise
