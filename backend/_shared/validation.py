"""Request body validation and query-parameter parsing helpers."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID

from errors import ValidationError

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def require_fields(data: dict, *fields: str) -> None:
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        raise ValidationError("Missing required field(s)", details={"fields": missing})


def validate_enum(value, allowed, field_name: str):
    if value not in allowed:
        raise ValidationError(
            f"Invalid value for '{field_name}'",
            details={"field": field_name, "allowed": list(allowed)},
        )
    return value


def validate_uuid(value, field_name: str) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValidationError(f"'{field_name}' must be a valid UUID") from exc


def validate_date(value, field_name: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"'{field_name}' must be a date in YYYY-MM-DD format") from exc
    return value


def validate_int(value, field_name: str, minimum: int | None = None, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"'{field_name}' must be an integer") from exc
    if minimum is not None and parsed < minimum:
        raise ValidationError(f"'{field_name}' must be >= {minimum}")
    if maximum is not None and parsed > maximum:
        raise ValidationError(f"'{field_name}' must be <= {maximum}")
    return parsed


def validate_decimal(value, field_name: str, minimum: int | None = None) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(f"'{field_name}' must be a valid number") from exc
    if minimum is not None and parsed < minimum:
        raise ValidationError(f"'{field_name}' must be >= {minimum}")
    return parsed


def parse_pagination(query: dict) -> dict:
    try:
        page = max(int(query.get("page", 1)), 1)
    except (TypeError, ValueError) as exc:
        raise ValidationError("'page' must be an integer") from exc
    try:
        page_size = int(query.get("page_size", DEFAULT_PAGE_SIZE))
    except (TypeError, ValueError) as exc:
        raise ValidationError("'page_size' must be an integer") from exc

    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    return {"page": page, "page_size": page_size, "limit": page_size, "offset": (page - 1) * page_size}


def parse_sort(query: dict, allowed_columns: dict, default: str) -> str:
    """Maps a caller-supplied ?sort= value to an allow-listed 'column direction' SQL fragment.

    allowed_columns maps public sort keys to real SQL column names so the
    caller-controlled value never reaches the query string directly.
    """
    raw = (query.get("sort") or default).strip()
    direction = "ASC"
    column_key = raw
    if raw.startswith("-"):
        direction = "DESC"
        column_key = raw[1:]

    column = allowed_columns.get(column_key)
    if not column:
        raise ValidationError(
            f"Invalid sort field '{column_key}'", details={"allowed": list(allowed_columns)}
        )
    return f"{column} {direction}"
