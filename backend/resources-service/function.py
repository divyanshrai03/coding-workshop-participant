"""Team allocation and workload.

Routes (normalized, after the "/api/resources-service" prefix is stripped):
    GET    /resources             - browse team members with computed current allocation
    GET    /resources/{id}        - a team member's profile plus their assignments
    GET    /workload              - team-wide allocation snapshot for the dashboard
    GET    /assignments           - list assignments (filter by project_id/user_id/deliverable_id)
    POST   /assignments           - create an assignment (team_lead+)
    GET    /assignments/{id}      - assignment detail
    PATCH  /assignments/{id}      - update allocation/dates/role_on_project (team_lead+)
    DELETE /assignments/{id}      - remove an assignment (team_lead+)

User records themselves (name/email/role/capacity) are owned by auth-service;
this service only reads users for display and owns the assignments table.
"""
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))

import psycopg  # noqa: E402
import auth as auth_lib  # noqa: E402
from db import transaction  # noqa: E402
from errors import ConflictError, NotFoundError, ValidationError  # noqa: E402
from http_utils import error_response, no_content, parse_event, success  # noqa: E402
from router import Router  # noqa: E402
from validation import (  # noqa: E402
    parse_pagination,
    parse_sort,
    require_fields,
    validate_date,
    validate_enum,
    validate_int,
    validate_uuid,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SERVICE_NAME = "resources-service"

ASSIGNMENT_COLUMNS = (
    "id, project_id, deliverable_id, user_id, allocation_percent, "
    "role_on_project, start_date, end_date, created_at, updated_at"
)
_ASSIGNMENT_COLUMNS_PREFIXED = ", ".join(f"a.{c.strip()}" for c in ASSIGNMENT_COLUMNS.split(","))
ASSIGNMENT_SORT_COLUMNS = {
    "allocation_percent": "allocation_percent",
    "start_date": "start_date",
    "end_date": "end_date",
    "created_at": "created_at",
}
ASSIGNMENT_UPDATABLE_FIELDS = {"deliverable_id", "allocation_percent", "role_on_project", "start_date", "end_date"}

RESOURCE_SORT_COLUMNS = {
    "full_name": "u.full_name",
    "email": "u.email",
    "role": "u.role",
    "capacity_hours_per_week": "u.capacity_hours_per_week",
}

# An assignment counts toward current workload only while "active": unset bounds are
# treated as open-ended, so a row with no start/end date always counts.
_ACTIVE_ALLOCATION_SUBQUERY = """(
    SELECT COALESCE(SUM(a.allocation_percent), 0) FROM assignments a
    WHERE a.user_id = u.id
      AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
)"""


def _with_workload(row: dict) -> dict:
    allocation = row.get("total_allocation_percent") or 0
    capacity = row.get("capacity_hours_per_week")
    row["is_overallocated"] = allocation > 100
    row["allocated_hours_per_week"] = round(float(capacity) * allocation / 100, 2) if capacity is not None else None
    return row


# --- Resources (read-only team roster + workload) ---------------------------------


def list_resources(headers, query, **_):
    auth_lib.get_current_user(headers)

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, RESOURCE_SORT_COLUMNS, default="full_name")

    filters = ["1 = 1"]
    params = []

    role = query.get("role")
    if role:
        validate_enum(role, auth_lib.ROLES, "role")
        filters.append("u.role = %s")
        params.append(role)

    search = query.get("search")
    if search:
        filters.append("(u.full_name ILIKE %s OR u.email ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    if (query.get("is_active") or "").lower() == "true":
        filters.append("u.is_active = TRUE")

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        cur.execute(f"SELECT COUNT(*) AS count FROM users u WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        list_sql = (
            "SELECT u.id, u.full_name, u.email, u.role, u.capacity_hours_per_week, u.is_active, "
            f"{_ACTIVE_ALLOCATION_SUBQUERY} AS total_allocation_percent "
            f"FROM users u WHERE {where_clause} "  # nosec B608
            f"ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(
        [_with_workload(row) for row in rows],
        meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total},
    )


def get_resource(id, headers, **_):
    auth_lib.get_current_user(headers)
    user_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute(
            "SELECT u.id, u.full_name, u.email, u.role, u.capacity_hours_per_week, u.is_active, "  # nosec B608
            f"{_ACTIVE_ALLOCATION_SUBQUERY} AS total_allocation_percent "
            "FROM users u WHERE u.id = %s",
            (user_id,),
        )
        resource = cur.fetchone()
        if not resource:
            raise NotFoundError("Resource not found")

        cur.execute(
            f"SELECT {_ASSIGNMENT_COLUMNS_PREFIXED}, "
            "p.name AS project_name, d.name AS deliverable_name "
            "FROM assignments a "
            "JOIN projects p ON p.id = a.project_id "
            "LEFT JOIN deliverables d ON d.id = a.deliverable_id "
            "WHERE a.user_id = %s ORDER BY a.created_at DESC",  # nosec B608 - ASSIGNMENT_COLUMNS is a fixed constant
            (user_id,),
        )
        resource["assignments"] = cur.fetchall()

    return success(_with_workload(resource))


def workload(headers, **_):
    auth_lib.get_current_user(headers)

    with transaction() as cur:
        cur.execute(
            "SELECT u.id, u.full_name, u.capacity_hours_per_week, "  # nosec B608
            f"{_ACTIVE_ALLOCATION_SUBQUERY} AS total_allocation_percent "
            "FROM users u WHERE u.is_active = TRUE "
            "ORDER BY total_allocation_percent DESC"
        )
        rows = [_with_workload(row) for row in cur.fetchall()]

    overallocated = [r for r in rows if r["is_overallocated"]]
    underallocated = [r for r in rows if (r["total_allocation_percent"] or 0) < 50]
    avg_allocation = round(sum(r["total_allocation_percent"] or 0 for r in rows) / len(rows), 1) if rows else 0

    return success({
        "resources": rows,
        "summary": {
            "total_resources": len(rows),
            "overallocated_count": len(overallocated),
            "underallocated_count": len(underallocated),
            "average_allocation_percent": avg_allocation,
        },
    })


# --- Assignments -------------------------------------------------------------


def _assignment_detail_query() -> str:
    # ASSIGNMENT_COLUMNS is a fixed constant; no user input reaches this string.
    return (
        f"SELECT {_ASSIGNMENT_COLUMNS_PREFIXED}, "  # nosec B608
        "p.name AS project_name, d.name AS deliverable_name, u.full_name AS user_full_name "
        "FROM assignments a "
        "JOIN projects p ON p.id = a.project_id "
        "LEFT JOIN deliverables d ON d.id = a.deliverable_id "
        "JOIN users u ON u.id = a.user_id"
    )


def list_assignments(headers, query, **_):
    auth_lib.get_current_user(headers)

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, ASSIGNMENT_SORT_COLUMNS, default="-created_at")

    filters = ["1 = 1"]
    params = []

    project_id = query.get("project_id")
    if project_id:
        filters.append("a.project_id = %s")
        params.append(validate_uuid(project_id, "project_id"))

    user_id = query.get("user_id")
    if user_id:
        filters.append("a.user_id = %s")
        params.append(validate_uuid(user_id, "user_id"))

    deliverable_id = query.get("deliverable_id")
    if deliverable_id:
        filters.append("a.deliverable_id = %s")
        params.append(validate_uuid(deliverable_id, "deliverable_id"))

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        cur.execute(f"SELECT COUNT(*) AS count FROM assignments a WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        list_sql = f"{_assignment_detail_query()} WHERE {where_clause} ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])  # nosec B608
        rows = cur.fetchall()

    return success(rows, meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total})


def create_assignment(body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")

    require_fields(body, "project_id", "user_id")
    project_id = validate_uuid(body["project_id"], "project_id")
    user_id = validate_uuid(body["user_id"], "user_id")
    deliverable_id = validate_uuid(body["deliverable_id"], "deliverable_id") if body.get("deliverable_id") else None
    allocation_percent = validate_int(body.get("allocation_percent", 100), "allocation_percent", minimum=1, maximum=100)
    role_on_project = (body.get("role_on_project") or "").strip() or None
    start_date = validate_date(body["start_date"], "start_date") if body.get("start_date") else None
    end_date = validate_date(body["end_date"], "end_date") if body.get("end_date") else None

    with transaction() as cur:
        try:
            cur.execute(
                "INSERT INTO assignments (project_id, deliverable_id, user_id, allocation_percent, role_on_project, start_date, end_date) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING {ASSIGNMENT_COLUMNS}",  # nosec B608 - ASSIGNMENT_COLUMNS is a fixed constant
                (project_id, deliverable_id, user_id, allocation_percent, role_on_project, start_date, end_date),
            )
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'project_id', 'deliverable_id' or 'user_id' does not exist") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'end_date' must not be before 'start_date'") from exc
        assignment = cur.fetchone()

    return success(assignment, status_code=201)


def get_assignment(id, headers, **_):
    auth_lib.get_current_user(headers)
    assignment_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute(f"{_assignment_detail_query()} WHERE a.id = %s", (assignment_id,))  # nosec B608
        assignment = cur.fetchone()

    if not assignment:
        raise NotFoundError("Assignment not found")
    return success(assignment)


def update_assignment(id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")
    assignment_id = validate_uuid(id, "id")

    updates = {k: v for k, v in body.items() if k in ASSIGNMENT_UPDATABLE_FIELDS}
    if not updates:
        raise ValidationError("No updatable fields provided", details={"allowed": sorted(ASSIGNMENT_UPDATABLE_FIELDS)})

    if "allocation_percent" in updates:
        updates["allocation_percent"] = validate_int(updates["allocation_percent"], "allocation_percent", minimum=1, maximum=100)
    if updates.get("deliverable_id") is not None:
        updates["deliverable_id"] = validate_uuid(updates["deliverable_id"], "deliverable_id")
    if updates.get("start_date") is not None:
        updates["start_date"] = validate_date(updates["start_date"], "start_date")
    if updates.get("end_date") is not None:
        updates["end_date"] = validate_date(updates["end_date"], "end_date")

    # Field names come only from ASSIGNMENT_UPDATABLE_FIELDS (a hardcoded set); values
    # are always bound as %s params, never interpolated.
    set_clause = ", ".join(f"{field} = %s" for field in updates)

    with transaction() as cur:
        try:
            update_sql = (
                f"UPDATE assignments SET {set_clause} WHERE id = %s RETURNING {ASSIGNMENT_COLUMNS}"  # nosec B608
            )
            cur.execute(update_sql, [*updates.values(), assignment_id])
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'deliverable_id' does not exist") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'end_date' must not be before 'start_date'") from exc
        assignment = cur.fetchone()

    if not assignment:
        raise NotFoundError("Assignment not found")
    return success(assignment)


def delete_assignment(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "team_lead")
    assignment_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM assignments WHERE id = %s RETURNING id", (assignment_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Assignment not found")
    return no_content()


router = Router()
router.add("GET", "/resources", list_resources)
router.add("GET", "/resources/{id}", get_resource)
router.add("GET", "/workload", workload)
router.add("GET", "/assignments", list_assignments)
router.add("POST", "/assignments", create_assignment)
router.add("GET", "/assignments/{id}", get_assignment)
router.add("PATCH", "/assignments/{id}", update_assignment)
router.add("DELETE", "/assignments/{id}", delete_assignment)


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
