"""Typed API errors mapped to HTTP status codes.

Handlers raise these from anywhere in the call stack; http.error_response()
converts them into a standardized JSON error envelope.
"""


class ApiError(Exception):
    """Base class for errors that should be surfaced to API callers."""

    status_code = 500

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class ValidationError(ApiError):
    """Raised when request input fails validation. Maps to HTTP 400."""

    status_code = 400


class AuthError(ApiError):
    """Raised when authentication is missing or invalid. Maps to HTTP 401."""

    status_code = 401


class ForbiddenError(ApiError):
    """Raised when an authenticated user lacks permission. Maps to HTTP 403."""

    status_code = 403


class NotFoundError(ApiError):
    """Raised when a resource or route does not exist. Maps to HTTP 404."""

    status_code = 404


class MethodNotAllowedError(ApiError):
    """Raised when a route exists but not for the requested HTTP method. Maps to HTTP 405."""

    status_code = 405


class ConflictError(ApiError):
    """Raised when a request conflicts with existing state (e.g. duplicate email). Maps to HTTP 409."""

    status_code = 409
