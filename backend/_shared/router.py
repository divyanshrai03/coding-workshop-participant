"""Minimal path-pattern router for Lambda Function URL handlers.

Registers (method, "/projects/{id}"-style pattern) -> handler pairs and
dispatches a normalized (method, path) to the first matching handler,
passing extracted path params as keyword arguments.
"""
import re

from errors import MethodNotAllowedError, NotFoundError

_PARAM_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _compile(pattern: str) -> re.Pattern:
    """Turns a '/projects/{id}'-style pattern into a regex with a named group per '{param}'.

    Args:
        pattern: Route pattern using '{name}' placeholders for path parameters.

    Returns:
        A compiled regex matching the full path, with one named group per placeholder.
    """
    regex = _PARAM_RE.sub(r"(?P<\1>[^/]+)", pattern)
    return re.compile(f"^{regex}$")


class Router:
    """Registers (method, path pattern) -> handler pairs and dispatches requests to them."""

    def __init__(self):
        """Starts with an empty route table; routes are added via add()."""
        self._routes = []

    def add(self, method: str, pattern: str, handler):
        """Registers a handler for a given HTTP method and path pattern.

        Args:
            method: HTTP method (e.g. "GET", "POST"); matched case-insensitively.
            pattern: Route pattern, e.g. "/projects/{id}".
            handler: Callable invoked with path params (as keyword args) plus
                whatever extra kwargs dispatch() is called with.

        Returns:
            self, so registrations can be chained.
        """
        self._routes.append((method.upper(), _compile(pattern), handler))
        return self

    def dispatch(self, method: str, path: str, **kwargs):
        """Finds the first route matching (method, path) and invokes its handler.

        Args:
            method: HTTP method of the incoming request.
            path: Normalized request path (no query string).
            **kwargs: Extra arguments forwarded to the handler (body, query, headers, ...).

        Returns:
            Whatever the matched handler returns.

        Raises:
            MethodNotAllowedError: The path matches a route, but not for this method.
            NotFoundError: No registered route matches the path at all.
        """
        method = method.upper()
        path_matched = False
        for route_method, regex, handler in self._routes:
            match = regex.match(path)
            if not match:
                continue
            path_matched = True
            if route_method == method:
                return handler(**match.groupdict(), **kwargs)
        if path_matched:
            raise MethodNotAllowedError(f"Method {method} not allowed for {path}")
        raise NotFoundError(f"No route matches {path}")
