"""Projects, deliverables, dependencies, and the health dashboard.

Routes (normalized, after the "/api/projects-service" prefix is stripped):
    GET    /dashboard/summary                       - health dashboard aggregate
    GET    /projects                                 - list (filter/search/sort/paginate)
    POST   /projects                                 - create (project_manager+)
    GET    /projects/{id}                            - detail incl. completion % and budget summary
    PATCH  /projects/{id}                             - update (project_manager+)
    DELETE /projects/{id}                             - delete (project_manager+)
    GET    /projects/{project_id}/deliverables        - list deliverables for a project
    POST   /projects/{project_id}/deliverables        - create deliverable (team_lead+)
    GET    /deliverables/{id}                         - detail incl. its dependency edges
    PATCH  /deliverables/{id}                          - update (team_lead+ full; developer: status only)
    DELETE /deliverables/{id}                          - delete (team_lead+)
    POST   /dependencies                              - link two deliverables (team_lead+)
    DELETE /dependencies/{id}                          - unlink (team_lead+)

All roles may read; write access is enforced via auth.require_min_role() against
the ROLES hierarchy (admin > project_manager > team_lead > developer > viewer),
except deliverable updates where 'developer' gets a narrower, explicitly-listed
field set (progress reporting) rather than a hierarchy cutoff.
"""
import logging
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))

import psycopg  # noqa: E402
import auth as auth_lib  # noqa: E402
from db import transaction  # noqa: E402
from errors import ConflictError, ForbiddenError, NotFoundError, ValidationError  # noqa: E402
from http_utils import error_response, no_content, parse_event, success  # noqa: E402
from router import Router  # noqa: E402
from validation import (  # noqa: E402
    parse_pagination,
    parse_sort,
    require_fields,
    validate_date,
    validate_enum,
    validate_uuid,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SERVICE_NAME = "projects-service"

PROJECT_STATUSES = ("planning", "active", "on_hold", "completed", "cancelled")
RISK_LEVELS = ("low", "medium", "high", "critical")
DELIVERABLE_STATUSES = ("not_started", "in_progress", "in_review", "completed", "blocked")
DEPENDENCY_TYPES = ("blocks", "related")

PROJECT_COLUMNS = (
    "id, name, description, status, risk_level, owner_id, "
    "start_date, end_date, created_by, created_at, updated_at"
)
_PROJECT_COLUMNS_PREFIXED = ", ".join(f"p.{c.strip()}" for c in PROJECT_COLUMNS.split(","))
PROJECT_SORT_COLUMNS = {
    "name": "p.name",
    "status": "p.status",
    "risk_level": "p.risk_level",
    "start_date": "p.start_date",
    "end_date": "p.end_date",
    "created_at": "p.created_at",
}
PROJECT_UPDATABLE_FIELDS = {"name", "description", "status", "risk_level", "owner_id", "start_date", "end_date"}
# COALESCE(..., FALSE): a NULL end_date makes the bare comparison evaluate to NULL rather
# than false (SQL three-valued logic), which would surface as a misleading `is_delayed: null`.
_IS_DELAYED_EXPR = "COALESCE(p.end_date < CURRENT_DATE AND p.status NOT IN ('completed', 'cancelled'), FALSE)"

DELIVERABLE_COLUMNS = "id, project_id, name, description, status, owner_id, due_date, completed_at, created_at, updated_at"
_DELIVERABLE_COLUMNS_PREFIXED = ", ".join(f"d.{c.strip()}" for c in DELIVERABLE_COLUMNS.split(","))
DELIVERABLE_SORT_COLUMNS = {"name": "name", "status": "status", "due_date": "due_date", "created_at": "created_at"}
FULL_UPDATABLE_DELIVERABLE_FIELDS = {"name", "description", "status", "owner_id", "due_date"}
DEVELOPER_UPDATABLE_DELIVERABLE_FIELDS = {"status"}


# --- Projects ----------------------------------------------------------------


def _with_completion(row: dict) -> dict:
    total = row.get("deliverable_count") or 0
    completed = row.get("completed_count") or 0
    row["completion_percent"] = round((completed / total) * 100) if total else 0
    return row


def _with_budget_summary(row: dict) -> dict:
    """Adds remaining_amount/percent_used alongside the raw planned/spent amounts
    get_project() already selects - mirrors budgets-service's own _with_budget_math().
    Only get_project() calls this: list_projects()'s rows never select budget_id in
    the first place, so row.get("budget_id") is safely None there.
    """
    if row.get("budget_id"):
        planned = row.get("planned_amount") or Decimal(0)
        spent = row.get("spent_amount") or Decimal(0)
        row["remaining_amount"] = planned - spent
        row["percent_used"] = round(float(spent / planned) * 100, 1) if planned else None
    return row


def list_projects(headers, query, **_):
    auth_lib.get_current_user(headers)

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, PROJECT_SORT_COLUMNS, default="-created_at")

    filters = ["1 = 1"]
    params = []

    status = query.get("status")
    if status:
        validate_enum(status, PROJECT_STATUSES, "status")
        filters.append("p.status = %s")
        params.append(status)

    risk_level = query.get("risk_level")
    if risk_level:
        validate_enum(risk_level, RISK_LEVELS, "risk_level")
        filters.append("p.risk_level = %s")
        params.append(risk_level)

    owner_id = query.get("owner_id")
    if owner_id:
        filters.append("p.owner_id = %s")
        params.append(validate_uuid(owner_id, "owner_id"))

    search = query.get("search")
    if search:
        filters.append("p.name ILIKE %s")
        params.append(f"%{search}%")

    if (query.get("delayed") or "").lower() == "true":
        filters.append(_IS_DELAYED_EXPR)

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        # where_clause is built only from literal filter fragments (never raw user text);
        # user-supplied values always travel through the %s params list.
        cur.execute(f"SELECT COUNT(*) AS count FROM projects p WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        # PROJECT_COLUMNS/sort_clause are fixed constants or come from parse_sort()'s
        # allow-listed column map; no caller-controlled text reaches the query structure.
        list_sql = (
            f"SELECT {_PROJECT_COLUMNS_PREFIXED}, "  # nosec B608
            "(SELECT full_name FROM users WHERE id = p.owner_id) AS owner_name, "
            "COUNT(d.id) AS deliverable_count, "
            "COUNT(d.id) FILTER (WHERE d.status = 'completed') AS completed_count, "
            f"{_IS_DELAYED_EXPR} AS is_delayed "
            "FROM projects p LEFT JOIN deliverables d ON d.project_id = p.id "
            f"WHERE {where_clause} GROUP BY p.id "
            f"ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(
        [_with_completion(row) for row in rows],
        meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total},
    )


def create_project(body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")

    require_fields(body, "name")
    name = body["name"].strip()
    if not name:
        raise ValidationError("'name' cannot be empty")

    status = validate_enum(body.get("status", "planning"), PROJECT_STATUSES, "status")
    risk_level = validate_enum(body.get("risk_level", "low"), RISK_LEVELS, "risk_level")
    owner_id = validate_uuid(body["owner_id"], "owner_id") if body.get("owner_id") else None
    start_date = validate_date(body["start_date"], "start_date") if body.get("start_date") else None
    end_date = validate_date(body["end_date"], "end_date") if body.get("end_date") else None

    with transaction() as cur:
        try:
            cur.execute(
                "INSERT INTO projects (name, description, status, risk_level, owner_id, start_date, end_date, created_by) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING {PROJECT_COLUMNS}",  # nosec B608 - PROJECT_COLUMNS is a fixed constant
                (name, body.get("description"), status, risk_level, owner_id, start_date, end_date, current["sub"]),
            )
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'owner_id' does not reference an existing user") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'end_date' must not be before 'start_date'") from exc
        project = cur.fetchone()

    return success(project, status_code=201)


def get_project(id, headers, **_):
    auth_lib.get_current_user(headers)
    project_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute(
            f"SELECT {_PROJECT_COLUMNS_PREFIXED}, "
            "(SELECT full_name FROM users WHERE id = p.owner_id) AS owner_name, "
            "(SELECT COUNT(*) FROM deliverables WHERE project_id = p.id) AS deliverable_count, "
            "(SELECT COUNT(*) FROM deliverables WHERE project_id = p.id AND status = 'completed') AS completed_count, "
            f"{_IS_DELAYED_EXPR} AS is_delayed, "
            "b.id AS budget_id, b.planned_amount, b.currency, "
            "(SELECT COALESCE(SUM(amount), 0) FROM budget_entries WHERE budget_id = b.id) AS spent_amount "
            "FROM projects p LEFT JOIN budgets b ON b.project_id = p.id "
            "WHERE p.id = %s",  # nosec B608 - correlated subqueries avoid join fan-out; only p.id is parameterized
            (project_id,),
        )
        project = cur.fetchone()

    if not project:
        raise NotFoundError("Project not found")
    return success(_with_budget_summary(_with_completion(project)))


def update_project(id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")
    project_id = validate_uuid(id, "id")

    updates = {k: v for k, v in body.items() if k in PROJECT_UPDATABLE_FIELDS}
    if not updates:
        raise ValidationError("No updatable fields provided", details={"allowed": sorted(PROJECT_UPDATABLE_FIELDS)})

    if "status" in updates:
        validate_enum(updates["status"], PROJECT_STATUSES, "status")
    if "risk_level" in updates:
        validate_enum(updates["risk_level"], RISK_LEVELS, "risk_level")
    if updates.get("owner_id") is not None:
        updates["owner_id"] = validate_uuid(updates["owner_id"], "owner_id")
    if updates.get("start_date") is not None:
        updates["start_date"] = validate_date(updates["start_date"], "start_date")
    if updates.get("end_date") is not None:
        updates["end_date"] = validate_date(updates["end_date"], "end_date")

    # Field names come only from PROJECT_UPDATABLE_FIELDS (a hardcoded set); values are
    # always bound as %s params, never interpolated.
    set_clause = ", ".join(f"{field} = %s" for field in updates)

    with transaction() as cur:
        try:
            update_sql = (
                f"UPDATE projects SET {set_clause} WHERE id = %s RETURNING {PROJECT_COLUMNS}"  # nosec B608
            )
            cur.execute(update_sql, [*updates.values(), project_id])
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'owner_id' does not reference an existing user") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'end_date' must not be before 'start_date'") from exc
        project = cur.fetchone()

    if not project:
        raise NotFoundError("Project not found")
    return success(project)


def delete_project(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")
    project_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM projects WHERE id = %s RETURNING id", (project_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Project not found")
    return no_content()


# --- Deliverables --------------------------------------------------------------


def list_deliverables(project_id, headers, query, **_):
    auth_lib.get_current_user(headers)
    proj_id = validate_uuid(project_id, "project_id")

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, DELIVERABLE_SORT_COLUMNS, default="due_date")

    filters = ["d.project_id = %s"]
    params = [proj_id]

    status = query.get("status")
    if status:
        validate_enum(status, DELIVERABLE_STATUSES, "status")
        filters.append("d.status = %s")
        params.append(status)

    search = query.get("search")
    if search:
        filters.append("d.name ILIKE %s")
        params.append(f"%{search}%")

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        cur.execute("SELECT 1 FROM projects WHERE id = %s", (proj_id,))
        if not cur.fetchone():
            raise NotFoundError("Project not found")

        cur.execute(f"SELECT COUNT(*) AS count FROM deliverables d WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        list_sql = (
            f"SELECT {_DELIVERABLE_COLUMNS_PREFIXED}, "  # nosec B608
            "(SELECT full_name FROM users WHERE id = d.owner_id) AS owner_name "
            f"FROM deliverables d WHERE {where_clause} "
            f"ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(rows, meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total})


def create_deliverable(project_id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")
    proj_id = validate_uuid(project_id, "project_id")

    require_fields(body, "name")
    name = body["name"].strip()
    if not name:
        raise ValidationError("'name' cannot be empty")

    status = validate_enum(body.get("status", "not_started"), DELIVERABLE_STATUSES, "status")
    owner_id = validate_uuid(body["owner_id"], "owner_id") if body.get("owner_id") else None
    due_date = validate_date(body["due_date"], "due_date") if body.get("due_date") else None

    with transaction() as cur:
        cur.execute("SELECT 1 FROM projects WHERE id = %s", (proj_id,))
        if not cur.fetchone():
            raise NotFoundError("Project not found")

        try:
            cur.execute(
                "INSERT INTO deliverables (project_id, name, description, status, owner_id, due_date) "
                f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING {DELIVERABLE_COLUMNS}",  # nosec B608
                (proj_id, name, body.get("description"), status, owner_id, due_date),
            )
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'owner_id' does not reference an existing user") from exc
        deliverable = cur.fetchone()

    return success(deliverable, status_code=201)


def _dependency_side(cur, deliverable_id: str, match_column: str, other_column: str) -> list:
    """Fetches one direction of a deliverable's dependency edges.

    match_column/other_column are always one of the two literal strings passed at the
    two call sites in get_deliverable() below - never derived from request input.
    """
    cur.execute(
        f"SELECT dep.id, dep.dependency_type, d.id AS deliverable_id, d.name, d.status "
        f"FROM dependencies dep JOIN deliverables d ON d.id = dep.{other_column} "
        f"WHERE dep.{match_column} = %s",  # nosec B608
        (deliverable_id,),
    )
    return cur.fetchall()


def get_deliverable(id, headers, **_):
    auth_lib.get_current_user(headers)
    deliverable_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute(
            f"SELECT {_DELIVERABLE_COLUMNS_PREFIXED}, "  # nosec B608 - _DELIVERABLE_COLUMNS_PREFIXED is a fixed constant
            "(SELECT full_name FROM users WHERE id = d.owner_id) AS owner_name "
            "FROM deliverables d WHERE d.id = %s",
            (deliverable_id,),
        )
        deliverable = cur.fetchone()
        if not deliverable:
            raise NotFoundError("Deliverable not found")

        deliverable["blocked_by"] = _dependency_side(cur, deliverable_id, "deliverable_id", "depends_on_deliverable_id")
        deliverable["blocking"] = _dependency_side(cur, deliverable_id, "depends_on_deliverable_id", "deliverable_id")

    return success(deliverable)


def update_deliverable(id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    deliverable_id = validate_uuid(id, "id")

    role = current["role"]
    if role in ("admin", "project_manager", "team_lead"):
        allowed_fields = FULL_UPDATABLE_DELIVERABLE_FIELDS
    elif role == "developer":
        allowed_fields = DEVELOPER_UPDATABLE_DELIVERABLE_FIELDS
    else:
        raise ForbiddenError("Not permitted to update deliverables")

    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        raise ValidationError("No updatable fields provided", details={"allowed": sorted(allowed_fields)})

    if "status" in updates:
        validate_enum(updates["status"], DELIVERABLE_STATUSES, "status")
    if updates.get("owner_id") is not None:
        updates["owner_id"] = validate_uuid(updates["owner_id"], "owner_id")
    if updates.get("due_date") is not None:
        updates["due_date"] = validate_date(updates["due_date"], "due_date")

    # completed_at is never client-settable; it's purely derived from the status transition.
    set_parts = [f"{field} = %s" for field in updates]
    params = list(updates.values())
    if updates.get("status") == "completed":
        set_parts.append("completed_at = now()")
    elif "status" in updates:
        set_parts.append("completed_at = NULL")
    set_clause = ", ".join(set_parts)

    with transaction() as cur:
        try:
            update_sql = (
                f"UPDATE deliverables SET {set_clause} WHERE id = %s RETURNING {DELIVERABLE_COLUMNS}"  # nosec B608
            )
            cur.execute(update_sql, [*params, deliverable_id])
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'owner_id' does not reference an existing user") from exc
        deliverable = cur.fetchone()

    if not deliverable:
        raise NotFoundError("Deliverable not found")
    return success(deliverable)


def delete_deliverable(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")
    deliverable_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM deliverables WHERE id = %s RETURNING id", (deliverable_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Deliverable not found")
    return no_content()


# --- Dependencies --------------------------------------------------------------


def create_dependency(body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")

    require_fields(body, "deliverable_id", "depends_on_deliverable_id")
    deliverable_id = validate_uuid(body["deliverable_id"], "deliverable_id")
    depends_on_id = validate_uuid(body["depends_on_deliverable_id"], "depends_on_deliverable_id")
    dependency_type = validate_enum(body.get("dependency_type", "blocks"), DEPENDENCY_TYPES, "dependency_type")

    if deliverable_id == depends_on_id:
        raise ValidationError("A deliverable cannot depend on itself")

    with transaction() as cur:
        # Only catches the direct A<->B cycle case, not longer N-length cycles - a
        # documented simplification, not full graph cycle detection.
        cur.execute(
            "SELECT 1 FROM dependencies WHERE deliverable_id = %s AND depends_on_deliverable_id = %s",
            (depends_on_id, deliverable_id),
        )
        if cur.fetchone():
            raise ConflictError("This would create a circular dependency")

        try:
            cur.execute(
                "INSERT INTO dependencies (deliverable_id, depends_on_deliverable_id, dependency_type) "
                "VALUES (%s, %s, %s) "
                "RETURNING id, deliverable_id, depends_on_deliverable_id, dependency_type, created_at",
                (deliverable_id, depends_on_id, dependency_type),
            )
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'deliverable_id' or 'depends_on_deliverable_id' does not exist") from exc
        except psycopg.errors.UniqueViolation as exc:
            raise ConflictError("This dependency already exists") from exc
        dependency = cur.fetchone()

    return success(dependency, status_code=201)


def delete_dependency(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")
    dependency_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM dependencies WHERE id = %s RETURNING id", (dependency_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Dependency not found")
    return no_content()


# --- Dashboard -------------------------------------------------------------


def dashboard_summary(headers, **_):
    auth_lib.get_current_user(headers)

    with transaction() as cur:
        cur.execute("SELECT status, COUNT(*) AS count FROM projects GROUP BY status")
        by_status = {row["status"]: row["count"] for row in cur.fetchall()}

        cur.execute("SELECT risk_level, COUNT(*) AS count FROM projects GROUP BY risk_level")
        by_risk = {row["risk_level"]: row["count"] for row in cur.fetchall()}

        cur.execute(f"SELECT COUNT(*) AS count FROM projects p WHERE {_IS_DELAYED_EXPR}")  # nosec B608
        delayed_count = cur.fetchone()["count"]

        cur.execute(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'completed') AS completed FROM deliverables"
        )
        deliverable_totals = cur.fetchone()

        cur.execute(
            "SELECT COALESCE(SUM(b.planned_amount), 0) AS planned, "
            "COALESCE((SELECT SUM(amount) FROM budget_entries), 0) AS spent "
            "FROM budgets b"
        )
        budget_totals = cur.fetchone()

        cur.execute(
            "SELECT d.id, d.name, d.due_date, d.project_id, p.name AS project_name "
            "FROM deliverables d JOIN projects p ON p.id = d.project_id "
            "WHERE d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days' "
            "AND d.status != 'completed' "
            "ORDER BY d.due_date ASC LIMIT 10"
        )
        upcoming_deadlines = cur.fetchall()

    total_deliverables = deliverable_totals["total"] or 0
    completed_deliverables = deliverable_totals["completed"] or 0

    return success({
        "total_projects": sum(by_status.values()),
        "projects_by_status": by_status,
        "projects_by_risk": by_risk,
        "delayed_project_count": delayed_count,
        "total_deliverables": total_deliverables,
        "completed_deliverables": completed_deliverables,
        "deliverable_completion_percent": (
            round((completed_deliverables / total_deliverables) * 100) if total_deliverables else 0
        ),
        "budget_planned": budget_totals["planned"],
        "budget_spent": budget_totals["spent"],
        "upcoming_deadlines": upcoming_deadlines,
    })


router = Router()
router.add("GET", "/dashboard/summary", dashboard_summary)
router.add("GET", "/projects", list_projects)
router.add("POST", "/projects", create_project)
router.add("GET", "/projects/{id}", get_project)
router.add("PATCH", "/projects/{id}", update_project)
router.add("DELETE", "/projects/{id}", delete_project)
router.add("GET", "/projects/{project_id}/deliverables", list_deliverables)
router.add("POST", "/projects/{project_id}/deliverables", create_deliverable)
router.add("GET", "/deliverables/{id}", get_deliverable)
router.add("PATCH", "/deliverables/{id}", update_deliverable)
router.add("DELETE", "/deliverables/{id}", delete_deliverable)
router.add("POST", "/dependencies", create_dependency)
router.add("DELETE", "/dependencies/{id}", delete_dependency)


def handler(event=None, context=None):
    try:
        parsed = parse_event(event or {}, SERVICE_NAME)
        return router.dispatch(
            parsed["method"],
            parsed["path"],
            body=parsed["body"],
            query=parsed["query"],
            headers=parsed["headers"],
        )
    except Exception as exc:  # Lambda's top-level boundary must always return a response, never raise.
        return error_response(exc)


if __name__ == "__main__":
    print(handler())
