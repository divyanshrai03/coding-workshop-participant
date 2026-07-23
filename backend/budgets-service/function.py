"""Budget planning and spend tracking.

Routes (normalized, after the "/api/budgets-service" prefix is stripped):
    GET    /budgets/summary          - planned vs. spent totals, per-project breakdown, spend by category
    GET    /budgets                  - list budgets (filter by project_id)
    POST   /budgets                  - set a project's planned budget (project_manager+)
    GET    /budgets/{id}             - detail incl. spent/remaining/percent_used
    PATCH  /budgets/{id}              - update planned_amount/currency (project_manager+)
    DELETE /budgets/{id}              - remove a budget and its entries (admin only)
    GET    /budgets/{id}/entries     - list spend entries for a budget
    POST   /budgets/{id}/entries     - record a spend entry (project_manager+)
    DELETE /entries/{id}              - remove a spend entry (project_manager+)

Deleting a whole budget wipes its spend history, so that action is restricted to
admin; day-to-day planning and entry management only requires project_manager+.
"""
import logging
import os
import sys
from decimal import Decimal

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
    validate_decimal,
    validate_uuid,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SERVICE_NAME = "budgets-service"

BUDGET_COLUMNS = "id, project_id, planned_amount, currency, created_at, updated_at"
_BUDGET_COLUMNS_PREFIXED = ", ".join(f"b.{c.strip()}" for c in BUDGET_COLUMNS.split(","))
BUDGET_SORT_COLUMNS = {"planned_amount": "b.planned_amount", "currency": "b.currency", "created_at": "b.created_at"}
BUDGET_UPDATABLE_FIELDS = {"planned_amount", "currency"}

ENTRY_COLUMNS = "id, budget_id, category, description, amount, entry_date, created_by, created_at"
ENTRY_SORT_COLUMNS = {"entry_date": "entry_date", "amount": "amount", "category": "category", "created_at": "created_at"}

_SPENT_SUBQUERY = "(SELECT COALESCE(SUM(amount), 0) FROM budget_entries WHERE budget_id = b.id)"

# Per-project and per-category breakdowns on the summary endpoint are capped rather
# than unbounded - fine at workshop scale, called out explicitly rather than silently.
_SUMMARY_BREAKDOWN_LIMIT = 50


def _validate_currency(value) -> str:
    currency = (value or "USD").strip().upper()
    if len(currency) != 3 or not currency.isalpha():
        raise ValidationError("'currency' must be a 3-letter currency code")
    return currency


def _with_budget_math(row: dict) -> dict:
    planned = row.get("planned_amount") or Decimal(0)
    spent = row.get("spent_amount") or Decimal(0)
    row["remaining_amount"] = planned - spent
    row["percent_used"] = round(float(spent / planned) * 100, 1) if planned else None
    return row


# --- Budgets -------------------------------------------------------------------


def list_budgets(headers, query, **_):
    auth_lib.get_current_user(headers)

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, BUDGET_SORT_COLUMNS, default="-created_at")

    filters = ["1 = 1"]
    params = []

    project_id = query.get("project_id")
    if project_id:
        filters.append("b.project_id = %s")
        params.append(validate_uuid(project_id, "project_id"))

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        cur.execute(f"SELECT COUNT(*) AS count FROM budgets b WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        list_sql = (
            f"SELECT {_BUDGET_COLUMNS_PREFIXED}, p.name AS project_name, "
            f"{_SPENT_SUBQUERY} AS spent_amount "
            "FROM budgets b JOIN projects p ON p.id = b.project_id "  # nosec B608
            f"WHERE {where_clause} ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(
        [_with_budget_math(row) for row in rows],
        meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total},
    )


def create_budget(body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")

    require_fields(body, "project_id", "planned_amount")
    project_id = validate_uuid(body["project_id"], "project_id")
    planned_amount = validate_decimal(body["planned_amount"], "planned_amount", minimum=0)
    currency = _validate_currency(body.get("currency"))

    with transaction() as cur:
        try:
            cur.execute(
                "INSERT INTO budgets (project_id, planned_amount, currency) "
                f"VALUES (%s, %s, %s) RETURNING {BUDGET_COLUMNS}",  # nosec B608 - BUDGET_COLUMNS is a fixed constant
                (project_id, planned_amount, currency),
            )
        except psycopg.errors.ForeignKeyViolation as exc:
            raise ValidationError("'project_id' does not exist") from exc
        except psycopg.errors.UniqueViolation as exc:
            raise ConflictError("A budget already exists for this project") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'planned_amount' must be >= 0") from exc
        budget = cur.fetchone()

    budget["spent_amount"] = Decimal(0)
    return success(_with_budget_math(budget), status_code=201)


def get_budget(id, headers, **_):
    auth_lib.get_current_user(headers)
    budget_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute(
            f"SELECT {_BUDGET_COLUMNS_PREFIXED}, p.name AS project_name, "
            f"{_SPENT_SUBQUERY} AS spent_amount "
            "FROM budgets b JOIN projects p ON p.id = b.project_id "
            "WHERE b.id = %s",  # nosec B608 - BUDGET_COLUMNS is a fixed constant, only b.id is parameterized
            (budget_id,),
        )
        budget = cur.fetchone()

    if not budget:
        raise NotFoundError("Budget not found")
    return success(_with_budget_math(budget))


def update_budget(id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")
    budget_id = validate_uuid(id, "id")

    updates = {k: v for k, v in body.items() if k in BUDGET_UPDATABLE_FIELDS}
    if not updates:
        raise ValidationError("No updatable fields provided", details={"allowed": sorted(BUDGET_UPDATABLE_FIELDS)})

    if "planned_amount" in updates:
        updates["planned_amount"] = validate_decimal(updates["planned_amount"], "planned_amount", minimum=0)
    if "currency" in updates:
        updates["currency"] = _validate_currency(updates["currency"])

    # Field names come only from BUDGET_UPDATABLE_FIELDS (a hardcoded set); values are
    # always bound as %s params, never interpolated.
    set_clause = ", ".join(f"{field} = %s" for field in updates)

    with transaction() as cur:
        try:
            update_sql = f"UPDATE budgets SET {set_clause} WHERE id = %s RETURNING {BUDGET_COLUMNS}"  # nosec B608
            cur.execute(update_sql, [*updates.values(), budget_id])
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'planned_amount' must be >= 0") from exc
        budget = cur.fetchone()

        if budget:
            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) AS spent FROM budget_entries WHERE budget_id = %s",
                (budget_id,),
            )
            budget["spent_amount"] = cur.fetchone()["spent"]

    if not budget:
        raise NotFoundError("Budget not found")
    return success(_with_budget_math(budget))


def delete_budget(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_role(current, "admin")
    budget_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM budgets WHERE id = %s RETURNING id", (budget_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Budget not found")
    return no_content()


# --- Spend entries -----------------------------------------------------------


def list_entries(budget_id, headers, query, **_):
    auth_lib.get_current_user(headers)
    b_id = validate_uuid(budget_id, "budget_id")

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, ENTRY_SORT_COLUMNS, default="-entry_date")

    filters = ["budget_id = %s"]
    params = [b_id]

    category = query.get("category")
    if category:
        filters.append("category = %s")
        params.append(category)

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        cur.execute("SELECT 1 FROM budgets WHERE id = %s", (b_id,))
        if not cur.fetchone():
            raise NotFoundError("Budget not found")

        cur.execute(f"SELECT COUNT(*) AS count FROM budget_entries WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        list_sql = (
            f"SELECT {ENTRY_COLUMNS} FROM budget_entries WHERE {where_clause} "  # nosec B608
            f"ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(list_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(rows, meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total})


def create_entry(budget_id, body, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")
    b_id = validate_uuid(budget_id, "budget_id")

    require_fields(body, "category", "amount")
    category = body["category"].strip()
    if not category:
        raise ValidationError("'category' cannot be empty")
    amount = validate_decimal(body["amount"], "amount", minimum=0)
    entry_date = validate_date(body["entry_date"], "entry_date") if body.get("entry_date") else None

    with transaction() as cur:
        cur.execute("SELECT 1 FROM budgets WHERE id = %s", (b_id,))
        if not cur.fetchone():
            raise NotFoundError("Budget not found")

        try:
            # entry_date may be None here; COALESCE falls back to the column's own
            # DEFAULT CURRENT_DATE, which an explicit NULL would otherwise bypass.
            cur.execute(
                "INSERT INTO budget_entries (budget_id, category, description, amount, created_by, entry_date) "
                f"VALUES (%s, %s, %s, %s, %s, COALESCE(%s, CURRENT_DATE)) RETURNING {ENTRY_COLUMNS}",  # nosec B608 - ENTRY_COLUMNS is a fixed constant
                (b_id, category, body.get("description"), amount, current["sub"], entry_date),
            )
        except psycopg.errors.CheckViolation as exc:
            raise ValidationError("'amount' must be >= 0") from exc
        entry = cur.fetchone()

    return success(entry, status_code=201)


def delete_entry(id, headers, **_):
    current = auth_lib.get_current_user(headers)
    auth_lib.require_min_role(current, "project_manager")
    entry_id = validate_uuid(id, "id")

    with transaction() as cur:
        cur.execute("DELETE FROM budget_entries WHERE id = %s RETURNING id", (entry_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("Entry not found")
    return no_content()


# --- Summary -----------------------------------------------------------------


def budgets_summary(headers, **_):
    auth_lib.get_current_user(headers)

    with transaction() as cur:
        cur.execute(
            "SELECT COALESCE(SUM(planned_amount), 0) AS total_planned FROM budgets"
        )
        total_planned = cur.fetchone()["total_planned"]

        cur.execute("SELECT COALESCE(SUM(amount), 0) AS total_spent FROM budget_entries")
        total_spent = cur.fetchone()["total_spent"]

        cur.execute(
            f"SELECT {_BUDGET_COLUMNS_PREFIXED}, p.name AS project_name, "  # nosec B608 - constants only, LIMIT is parameterized
            f"{_SPENT_SUBQUERY} AS spent_amount "
            "FROM budgets b JOIN projects p ON p.id = b.project_id "
            "ORDER BY spent_amount DESC LIMIT %s",
            (_SUMMARY_BREAKDOWN_LIMIT,),
        )
        by_project = [_with_budget_math(row) for row in cur.fetchall()]

        cur.execute(
            "SELECT category, COALESCE(SUM(amount), 0) AS total FROM budget_entries "
            "GROUP BY category ORDER BY total DESC LIMIT %s",
            (_SUMMARY_BREAKDOWN_LIMIT,),
        )
        by_category = cur.fetchall()

    return success({
        "total_planned": total_planned,
        "total_spent": total_spent,
        "overall_percent_used": round(float(total_spent / total_planned) * 100, 1) if total_planned else None,
        "by_project": by_project,
        "by_category": by_category,
    })


router = Router()
router.add("GET", "/budgets/summary", budgets_summary)
router.add("GET", "/budgets", list_budgets)
router.add("POST", "/budgets", create_budget)
router.add("GET", "/budgets/{id}", get_budget)
router.add("PATCH", "/budgets/{id}", update_budget)
router.add("DELETE", "/budgets/{id}", delete_budget)
router.add("GET", "/budgets/{budget_id}/entries", list_entries)
router.add("POST", "/budgets/{budget_id}/entries", create_entry)
router.add("DELETE", "/entries/{id}", delete_entry)


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
