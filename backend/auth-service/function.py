"""Authentication and user-management Lambda.

Routes (normalized, after the "/api/auth-service" prefix is stripped):
    POST   /register    - create a user. The very first user in the system
                           bootstraps as 'admin' with no auth required;
                           every subsequent registration requires an
                           authenticated admin caller.
    POST   /login        - exchange email/password for an access + refresh token
    POST   /refresh       - exchange a refresh token for a new token pair
    GET    /me            - the authenticated caller's own profile
    GET    /users         - list users (admin only), paginated/sortable/filterable
    GET    /users/{id}    - fetch a user (self or admin)
    PATCH  /users/{id}    - update a user (self: name/capacity; admin: + role/active)
    DELETE /users/{id}    - deactivate a user (admin only, soft delete)
"""
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))

import psycopg  # noqa: E402
import auth as auth_lib  # noqa: E402
from db import transaction  # noqa: E402
from errors import AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError  # noqa: E402
from http_utils import error_response, no_content, parse_event, success  # noqa: E402
from router import Router  # noqa: E402
from validation import parse_pagination, parse_sort, require_fields, validate_enum, validate_uuid  # noqa: E402

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SERVICE_NAME = "auth-service"

USER_COLUMNS = "id, email, full_name, role, capacity_hours_per_week, is_active, created_at"
_PUBLIC_FIELDS = ("id", "email", "full_name", "role", "capacity_hours_per_week", "is_active", "created_at")
USER_SORT_COLUMNS = {"full_name": "full_name", "email": "email", "role": "role", "created_at": "created_at"}
SELF_UPDATABLE_FIELDS = {"full_name", "capacity_hours_per_week"}
ADMIN_UPDATABLE_FIELDS = SELF_UPDATABLE_FIELDS | {"role", "is_active"}


def _public_user(user: dict) -> dict:
    """Strips a user row down to the fields safe to return over the API (drops password_hash)."""
    return {field: user[field] for field in _PUBLIC_FIELDS if field in user}


def register(body, headers, **_):
    """POST /register - creates a user.

    The very first user in the system bootstraps as 'admin' with no auth
    required. Every subsequent registration requires an authenticated admin
    caller and an explicit "role".

    Args:
        body: {"email", "password" (min 8 chars), "full_name", "role"? (ignored for the first user)}.
        headers: Request headers; "authorization" is required once an admin already exists.

    Returns:
        201 with the created user (public fields only).

    Raises:
        ValidationError: A required field is missing, or the password is too short.
        AuthError/ForbiddenError: Not the first user, and the caller isn't an authenticated admin.
        ConflictError: A user with this email already exists.
    """
    require_fields(body, "email", "password", "full_name")
    email = body["email"].strip().lower()
    password = body["password"]
    full_name = body["full_name"].strip()

    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")

    with transaction() as cur:
        cur.execute("SELECT COUNT(*) AS count FROM users")
        is_first_user = cur.fetchone()["count"] == 0

        if is_first_user:
            role = "admin"
        else:
            current = auth_lib.get_current_user(headers)
            auth_lib.require_role(current, "admin")
            role = validate_enum(body.get("role", "viewer"), auth_lib.ROLES, "role")

        password_hash = auth_lib.hash_password(password)
        try:
            cur.execute(
                f"INSERT INTO users (email, password_hash, full_name, role) "
                f"VALUES (%s, %s, %s, %s) RETURNING {USER_COLUMNS}",  # nosec B608 - USER_COLUMNS is a fixed constant, not user input
                (email, password_hash, full_name, role),
            )
        except psycopg.errors.UniqueViolation as exc:
            raise ConflictError("A user with this email already exists") from exc
        user = cur.fetchone()

    return success(_public_user(user), status_code=201)


def login(body, **_):
    """POST /login - exchanges email/password for an access + refresh token pair.

    Args:
        body: {"email", "password"}.

    Returns:
        200 with {"user", "access_token", "refresh_token"}.

    Raises:
        ValidationError: A required field is missing.
        AuthError: No matching active user, or the password is wrong.
    """
    require_fields(body, "email", "password")
    email = body["email"].strip().lower()

    with transaction() as cur:
        cur.execute(
            f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE email = %s",  # nosec B608 - USER_COLUMNS is a fixed constant, not user input
            (email,),
        )
        user = cur.fetchone()

    if not user or not user["is_active"] or not auth_lib.verify_password(body["password"], user["password_hash"]):
        raise AuthError("Invalid email or password")

    return success({
        "user": _public_user(user),
        "access_token": auth_lib.create_access_token(user),
        "refresh_token": auth_lib.create_refresh_token(user),
    })


def refresh(body, **_):
    """POST /refresh - exchanges a valid refresh token for a new access + refresh token pair.

    Args:
        body: {"refresh_token"}.

    Returns:
        200 with {"access_token", "refresh_token"}.

    Raises:
        ValidationError: "refresh_token" is missing.
        AuthError: The token is expired/invalid/not a refresh token, or the user is deactivated.
    """
    require_fields(body, "refresh_token")
    payload = auth_lib.decode_token(body["refresh_token"], expected_type="refresh")

    with transaction() as cur:
        cur.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (payload["sub"],))  # nosec B608 - USER_COLUMNS is a fixed constant, not user input
        user = cur.fetchone()

    if not user or not user["is_active"]:
        raise AuthError("User no longer active")

    return success({
        "access_token": auth_lib.create_access_token(user),
        "refresh_token": auth_lib.create_refresh_token(user),
    })


def me(headers, **_):
    """GET /me - returns the authenticated caller's own profile.

    Args:
        headers: Request headers; must carry a valid bearer access token.

    Returns:
        200 with the caller's user record (public fields only).

    Raises:
        AuthError: Missing/invalid bearer token.
        NotFoundError: The token's subject no longer exists (e.g. deleted since issuance).
    """
    current = auth_lib.get_current_user(headers)
    with transaction() as cur:
        cur.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (current["sub"],))  # nosec B608 - USER_COLUMNS is a fixed constant, not user input
        user = cur.fetchone()

    if not user:
        raise NotFoundError("User not found")
    return success(_public_user(user))


def list_users(headers, query, **_):
    """GET /users - lists users, admin only. Paginated, sortable, filterable, searchable.

    Args:
        headers: Request headers; caller must be an authenticated admin.
        query: Optional "role", "is_active" ("true"/"false"), "search" (matches
            full_name/email), "sort" (see USER_SORT_COLUMNS), "page", "page_size".

    Returns:
        200 with a list of users (public fields only) and pagination meta.

    Raises:
        AuthError/ForbiddenError: Caller isn't an authenticated admin.
        ValidationError: An invalid "role" or "sort" value was supplied.
    """
    current = auth_lib.get_current_user(headers)
    auth_lib.require_role(current, "admin")

    pagination = parse_pagination(query)
    sort_clause = parse_sort(query, USER_SORT_COLUMNS, default="full_name")

    filters = ["1 = 1"]
    params = []

    role = query.get("role")
    if role:
        validate_enum(role, auth_lib.ROLES, "role")
        filters.append("role = %s")
        params.append(role)

    is_active = query.get("is_active")
    if is_active is not None:
        filters.append("is_active = %s")
        params.append(is_active.lower() == "true")

    search = query.get("search")
    if search:
        filters.append("(full_name ILIKE %s OR email ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    where_clause = " AND ".join(filters)

    with transaction() as cur:
        # where_clause is built only from literal filter fragments (never raw user text);
        # user-supplied values always travel through the %s params below.
        cur.execute(f"SELECT COUNT(*) AS count FROM users WHERE {where_clause}", params)  # nosec B608
        total = cur.fetchone()["count"]

        # sort_clause comes from parse_sort()'s allow-listed column map, USER_COLUMNS is a
        # fixed constant; no caller-controlled text reaches the query structure itself.
        select_sql = (
            f"SELECT {USER_COLUMNS} FROM users WHERE {where_clause} "  # nosec B608
            f"ORDER BY {sort_clause} LIMIT %s OFFSET %s"
        )
        cur.execute(select_sql, params + [pagination["limit"], pagination["offset"]])
        rows = cur.fetchall()

    return success(
        [_public_user(row) for row in rows],
        meta={"page": pagination["page"], "page_size": pagination["page_size"], "total": total},
    )


def get_user(id, headers, **_):
    """GET /users/{id} - fetches a user by id. Callers may fetch themselves; only admins may fetch others.

    Args:
        id: Target user's UUID (path parameter).
        headers: Request headers; must carry a valid bearer access token.

    Returns:
        200 with the target user (public fields only).

    Raises:
        ValidationError: "id" is not a valid UUID.
        AuthError/ForbiddenError: Caller isn't authenticated, or isn't self/admin.
        NotFoundError: No user with that id.
    """
    current = auth_lib.get_current_user(headers)
    user_id = validate_uuid(id, "id")
    if current["sub"] != user_id:
        auth_lib.require_role(current, "admin")

    with transaction() as cur:
        cur.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,))  # nosec B608 - USER_COLUMNS is a fixed constant, not user input
        user = cur.fetchone()

    if not user:
        raise NotFoundError("User not found")
    return success(_public_user(user))


def update_user(id, body, headers, **_):
    """PATCH /users/{id} - updates a user.

    Self may update full_name/capacity_hours_per_week. Admins may additionally
    update role/is_active for any user (including others).

    Args:
        id: Target user's UUID (path parameter).
        body: Fields to update - restricted to the caller's allowed field set;
            any other keys are silently dropped.
        headers: Request headers; must carry a valid bearer access token.

    Returns:
        200 with the updated user (public fields only).

    Raises:
        ValidationError: "id"/"role" invalid, or no updatable fields were provided.
        AuthError/ForbiddenError: Caller isn't authenticated, or isn't self/admin.
        NotFoundError: No user with that id.
    """
    current = auth_lib.get_current_user(headers)
    user_id = validate_uuid(id, "id")
    is_self = current["sub"] == user_id
    is_admin = current["role"] == "admin"

    if not is_self and not is_admin:
        raise ForbiddenError("Not permitted to update this user")

    allowed_fields = ADMIN_UPDATABLE_FIELDS if is_admin else SELF_UPDATABLE_FIELDS
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        raise ValidationError("No updatable fields provided", details={"allowed": sorted(allowed_fields)})

    if "role" in updates:
        validate_enum(updates["role"], auth_lib.ROLES, "role")

    # set_clause is built only from field names already filtered against allowed_fields
    # (a hardcoded set) above; values are always passed as %s params, never interpolated.
    set_clause = ", ".join(f"{field} = %s" for field in updates)

    with transaction() as cur:
        update_sql = (
            f"UPDATE users SET {set_clause} WHERE id = %s RETURNING {USER_COLUMNS}"  # nosec B608
        )
        cur.execute(update_sql, [*updates.values(), user_id])
        user = cur.fetchone()

    if not user:
        raise NotFoundError("User not found")
    return success(_public_user(user))


def deactivate_user(id, headers, **_):
    """DELETE /users/{id} - soft-deletes a user (sets is_active = FALSE), admin only.

    This is a soft delete, not a row removal: the user stays in the table and
    still counts toward "is this the first user" checks elsewhere. Admins
    cannot deactivate their own account (to avoid locking themselves out).

    Args:
        id: Target user's UUID (path parameter).
        headers: Request headers; caller must be an authenticated admin.

    Returns:
        204 No Content.

    Raises:
        ValidationError: "id" is not a valid UUID, or the caller targeted themselves.
        AuthError/ForbiddenError: Caller isn't an authenticated admin.
        NotFoundError: No user with that id.
    """
    current = auth_lib.get_current_user(headers)
    auth_lib.require_role(current, "admin")
    user_id = validate_uuid(id, "id")

    if current["sub"] == user_id:
        raise ValidationError("Admins cannot deactivate their own account")

    with transaction() as cur:
        cur.execute("UPDATE users SET is_active = FALSE WHERE id = %s RETURNING id", (user_id,))
        row = cur.fetchone()

    if not row:
        raise NotFoundError("User not found")
    return no_content()


router = Router()
router.add("POST", "/register", register)
router.add("POST", "/login", login)
router.add("POST", "/refresh", refresh)
router.add("GET", "/me", me)
router.add("GET", "/users", list_users)
router.add("GET", "/users/{id}", get_user)
router.add("PATCH", "/users/{id}", update_user)
router.add("DELETE", "/users/{id}", deactivate_user)


def handler(event=None, context=None):
    """Lambda Function URL entry point - parses the event, dispatches to a route, and always returns a response.

    Args:
        event: The raw Lambda Function URL event (API Gateway HTTP API v2.0 shape).
        context: The Lambda context object (unused).

    Returns:
        A Lambda Function URL response dict. Never raises - any exception is
        converted to an error response by error_response().
    """
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
