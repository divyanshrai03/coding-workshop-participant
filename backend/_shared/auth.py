"""Password hashing, JWT issuance/verification, and RBAC helpers.

Roles are ranked from most to least privileged:
admin > project_manager > team_lead > developer > viewer
"""
import os
import time
import uuid

import bcrypt
import jwt

from errors import AuthError, ForbiddenError

ACCESS_TOKEN_TTL_SECONDS = 30 * 60
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

ROLES = ("admin", "project_manager", "team_lead", "developer", "viewer")
_ROLE_RANK = {role: rank for rank, role in enumerate(ROLES)}


def _secret() -> str:
    """Reads the JWT signing secret from the environment.

    Returns:
        The configured JWT_SECRET value.

    Raises:
        AuthError: JWT_SECRET is not set - fails closed rather than signing
            tokens with a guessable default.
    """
    secret = os.getenv("JWT_SECRET")
    if not secret:
        # Fails closed rather than falling back to a guessable default.
        raise AuthError("Server is missing JWT_SECRET configuration")
    return secret


def hash_password(password: str) -> str:
    """Hashes a plaintext password with bcrypt for storage."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Checks a plaintext password against a bcrypt hash from storage."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _issue_token(user: dict, token_type: str, ttl_seconds: int) -> str:
    """Signs a JWT for a user.

    Args:
        user: A user row/dict with at least "id", "email", "role".
        token_type: "access" or "refresh" - embedded in the payload and
            checked by decode_token() so one type can't be used as the other.
        ttl_seconds: Seconds until the token expires.

    Returns:
        An HS256-signed JWT string.
    """
    now = int(time.time())
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "type": token_type,
        "iat": now,
        "exp": now + ttl_seconds,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def create_access_token(user: dict) -> str:
    """Issues a short-lived (30 min) access token for a user."""
    return _issue_token(user, "access", ACCESS_TOKEN_TTL_SECONDS)


def create_refresh_token(user: dict) -> str:
    """Issues a long-lived (7 day) refresh token for a user."""
    return _issue_token(user, "refresh", REFRESH_TOKEN_TTL_SECONDS)


def decode_token(token: str, expected_type: str = "access") -> dict:
    """Verifies a JWT's signature, expiry, and type.

    Args:
        token: The raw JWT string.
        expected_type: "access" or "refresh" - must match the token's own "type" claim.

    Returns:
        The decoded token payload (sub, email, role, type, iat, exp, jti).

    Raises:
        AuthError: The token is expired, malformed/invalid, or of the wrong type.
    """
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Invalid token") from exc

    if payload.get("type") != expected_type:
        raise AuthError("Unexpected token type")
    return payload


def get_current_user(headers: dict) -> dict:
    """Extracts and verifies the bearer access token from request headers."""
    auth_header = headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthError("Missing bearer token")
    token = auth_header[len("Bearer "):].strip()
    return decode_token(token, expected_type="access")


def require_role(user: dict, *allowed_roles: str) -> None:
    """Raises ForbiddenError unless the user's role is one of allowed_roles."""
    if user.get("role") not in allowed_roles:
        raise ForbiddenError(f"Role '{user.get('role')}' is not permitted to perform this action")


def require_min_role(user: dict, minimum_role: str) -> None:
    """Raises ForbiddenError unless the user's role is at least as privileged as minimum_role."""
    user_rank = _ROLE_RANK.get(user.get("role"), len(ROLES))
    min_rank = _ROLE_RANK[minimum_role]
    if user_rank > min_rank:
        raise ForbiddenError(f"Requires role '{minimum_role}' or higher")
