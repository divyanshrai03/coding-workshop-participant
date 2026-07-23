"""Request parsing and response formatting for Lambda Function URL handlers.

Function URLs deliver events in the API Gateway HTTP API v2.0 payload shape.
CloudFront (AWS) forwards the full "/api/{service-name}/..." path to the
origin, while the local dev proxy (bin/proxy-server.js) already strips that
prefix before forwarding. normalize_path() makes both cases produce the same
in-app path so routes never need to know which environment they're in.
"""
import json
import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from errors import ApiError, ValidationError

logger = logging.getLogger()

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}


class JsonEncoder(json.JSONEncoder):
    """Serializes the UUID / date / Decimal types psycopg returns from PostgreSQL."""

    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def normalize_path(raw_path: str, service_name: str) -> str:
    """Strips leading 'api' and service-name path segments, if present."""
    parts = [p for p in (raw_path or "/").split("/") if p]
    if parts and parts[0] == "api":
        parts = parts[1:]
    if parts and parts[0] == service_name:
        parts = parts[1:]
    return "/" + "/".join(parts)


def parse_event(event: dict, service_name: str) -> dict:
    """Extracts method, normalized path, query params, headers and JSON body from a raw Lambda event."""
    http_ctx = (event.get("requestContext") or {}).get("http") or {}
    method = http_ctx.get("method", event.get("httpMethod", "GET"))
    raw_path = http_ctx.get("path", event.get("rawPath", event.get("path", "/")))

    raw_body = event.get("body")
    body = {}
    if raw_body:
        try:
            body = json.loads(raw_body)
        except (TypeError, ValueError) as exc:
            raise ValidationError("Request body must be valid JSON") from exc

    return {
        "method": method,
        "path": normalize_path(raw_path, service_name),
        "query": event.get("queryStringParameters") or {},
        "headers": {k.lower(): v for k, v in (event.get("headers") or {}).items()},
        "body": body,
    }


def success(data=None, status_code: int = 200, meta: dict | None = None) -> dict:
    payload = {"data": data}
    if meta is not None:
        payload["meta"] = meta
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, cls=JsonEncoder),
    }


def no_content() -> dict:
    """204 responses must not carry a body, per HTTP semantics."""
    return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}


def error_response(err: Exception) -> dict:
    if isinstance(err, ApiError):
        logger.warning("API error (%s): %s", err.status_code, err.message)
        payload = {"error": {"message": err.message}}
        if err.details:
            payload["error"]["details"] = err.details
        return {
            "statusCode": err.status_code,
            "headers": CORS_HEADERS,
            "body": json.dumps(payload, cls=JsonEncoder),
        }

    logger.error("Unhandled error: %s", err, exc_info=True)
    return {
        "statusCode": 500,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": {"message": "Internal server error"}}),
    }
