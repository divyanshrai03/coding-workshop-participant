"""Request body validation and query-parameter parsing helpers."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID

from errors import ValidationError

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def require_fields(data: dict, *fields: str) -> None:
    """Raises ValidationError listing every field in `fields` that is missing, None, or ''.

    Args:
        data: The parsed request body.
        *fields: Names of required top-level fields.

    Raises:
        ValidationError: One or more fields are missing/empty; details.fields lists them.
    """
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        raise ValidationError("Missing required field(s)", details={"fields": missing})


def validate_enum(value, allowed, field_name: str):
    """Raises ValidationError unless value is a member of allowed.

    Args:
        value: The value to check.
        allowed: An iterable of permitted values.
        field_name: Name used in the error message/details.

    Returns:
        value, unchanged, if it's allowed.
    """
    if value not in allowed:
        raise ValidationError(
            f"Invalid value for '{field_name}'",
            details={"field": field_name, "allowed": list(allowed)},
        )
    return value


def validate_uuid(value, field_name: str) -> str:
    """Parses value as a UUID and returns its canonical string form.

    Args:
        value: The candidate UUID (string or UUID-like).
        field_name: Name used in the error message.

    Returns:
        The UUID's canonical (hyphenated, lowercase) string form.

    Raises:
        ValidationError: value is not a valid UUID.
    """
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValidationError(f"'{field_name}' must be a valid UUID") from exc


def validate_date(value, field_name: str) -> str:
    """Validates value is a YYYY-MM-DD date string and returns it unchanged.

    Args:
        value: The candidate date string.
        field_name: Name used in the error message.

    Returns:
        value, unchanged, if it parses as a valid date.

    Raises:
        ValidationError: value is not in YYYY-MM-DD format.
    """
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"'{field_name}' must be a date in YYYY-MM-DD format") from exc
    return value


def validate_int(value, field_name: str, minimum: int | None = None, maximum: int | None = None) -> int:
    """Parses value as an int, optionally enforcing an inclusive [minimum, maximum] range.

    Args:
        value: The candidate value (any type int() accepts).
        field_name: Name used in error messages.
        minimum: Optional inclusive lower bound.
        maximum: Optional inclusive upper bound.

    Returns:
        The parsed int.

    Raises:
        ValidationError: value isn't an integer, or falls outside the given bounds.
    """
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
    """Parses value as a Decimal, optionally enforcing an inclusive minimum.

    Args:
        value: The candidate value (any type Decimal() accepts via str()).
        field_name: Name used in error messages.
        minimum: Optional inclusive lower bound.

    Returns:
        The parsed Decimal.

    Raises:
        ValidationError: value isn't a valid number, or is below minimum.
    """
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(f"'{field_name}' must be a valid number") from exc
    if minimum is not None and parsed < minimum:
        raise ValidationError(f"'{field_name}' must be >= {minimum}")
    return parsed


def parse_pagination(query: dict) -> dict:
    """Parses and clamps ?page=/?page_size= query params into pagination values.

    page_size is clamped to [1, MAX_PAGE_SIZE]; page is clamped to >= 1.

    Args:
        query: The raw query-string parameters.

    Returns:
        A dict with page, page_size, limit (== page_size), and offset for use in SQL.

    Raises:
        ValidationError: page or page_size is not an integer.
    """
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
