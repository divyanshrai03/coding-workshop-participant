"""Minimal path-pattern router for Lambda Function URL handlers.

Registers (method, "/projects/{id}"-style pattern) -> handler pairs and
dispatches a normalized (method, path) to the first matching handler,
passing extracted path params as keyword arguments.
"""
import re

from errors import MethodNotAllowedError, NotFoundError

_PARAM_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _compile(pattern: str) -> re.Pattern:
    regex = _PARAM_RE.sub(r"(?P<\1>[^/]+)", pattern)
    return re.compile(f"^{regex}$")


class Router:
    def __init__(self):
        self._routes = []

    def add(self, method: str, pattern: str, handler):
        self._routes.append((method.upper(), _compile(pattern), handler))
        return self

    def dispatch(self, method: str, path: str, **kwargs):
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
