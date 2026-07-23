import json
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

import pytest
from errors import AuthError, ValidationError
from http_utils import JsonEncoder, error_response, no_content, normalize_path, parse_event, success


class TestNormalizePath:
    def test_strips_the_leading_api_and_service_name_segments(self):
        assert normalize_path("/api/projects-service/projects", "projects-service") == "/projects"

    def test_leaves_the_path_alone_when_neither_prefix_is_present(self):
        # The local dev proxy (bin/proxy-server.js) already strips these before forwarding.
        assert normalize_path("/projects", "projects-service") == "/projects"

    def test_handles_a_bare_root_path(self):
        assert normalize_path("/", "projects-service") == "/"

    def test_handles_a_none_path_as_root(self):
        assert normalize_path(None, "projects-service") == "/"

    def test_preserves_path_params_after_the_prefix(self):
        assert normalize_path("/api/projects-service/projects/123/deliverables", "projects-service") == "/projects/123/deliverables"


class TestParseEvent:
    def test_extracts_method_path_query_headers_and_body(self):
        event = {
            "requestContext": {"http": {"method": "POST", "path": "/api/auth-service/login"}},
            "queryStringParameters": {"page": "2"},
            "headers": {"Authorization": "Bearer abc", "Content-Type": "application/json"},
            "body": json.dumps({"email": "a@b.com"}),
        }
        parsed = parse_event(event, "auth-service")
        assert parsed["method"] == "POST"
        assert parsed["path"] == "/login"
        assert parsed["query"] == {"page": "2"}
        # Headers are lowercased so downstream code never has to guess the caller's casing.
        assert parsed["headers"] == {"authorization": "Bearer abc", "content-type": "application/json"}
        assert parsed["body"] == {"email": "a@b.com"}

    def test_defaults_to_an_empty_body_when_none_is_sent(self):
        event = {"requestContext": {"http": {"method": "GET", "path": "/api/auth-service/me"}}}
        parsed = parse_event(event, "auth-service")
        assert parsed["body"] == {}
        assert parsed["query"] == {}
        assert parsed["headers"] == {}

    def test_raises_a_validation_error_for_malformed_json_body(self):
        event = {
            "requestContext": {"http": {"method": "POST", "path": "/api/auth-service/login"}},
            "body": "{not valid json",
        }
        with pytest.raises(ValidationError, match="valid JSON"):
            parse_event(event, "auth-service")

    def test_falls_back_to_httpmethod_and_rawpath_for_a_non_v2_event_shape(self):
        event = {"httpMethod": "GET", "rawPath": "/api/auth-service/me"}
        parsed = parse_event(event, "auth-service")
        assert parsed["method"] == "GET"
        assert parsed["path"] == "/me"


class TestSuccessAndNoContent:
    def test_success_wraps_data_in_a_data_envelope_with_a_200_default(self):
        response = success({"id": "123"})
        assert response["statusCode"] == 200
        assert json.loads(response["body"]) == {"data": {"id": "123"}}

    def test_success_honors_a_custom_status_code(self):
        response = success({"id": "123"}, status_code=201)
        assert response["statusCode"] == 201

    def test_success_includes_meta_only_when_given(self):
        without_meta = success([1, 2, 3])
        assert "meta" not in json.loads(without_meta["body"])

        with_meta = success([1, 2, 3], meta={"page": 1, "total": 3})
        assert json.loads(with_meta["body"])["meta"] == {"page": 1, "total": 3}

    def test_success_sets_the_cors_and_json_content_type_headers(self):
        response = success(None)
        assert response["headers"]["Content-Type"] == "application/json"
        assert response["headers"]["Access-Control-Allow-Origin"] == "*"

    def test_no_content_returns_204_with_an_empty_body(self):
        response = no_content()
        assert response["statusCode"] == 204
        assert response["body"] == ""


class TestErrorResponse:
    def test_maps_a_known_api_error_to_its_status_code_and_message(self):
        response = error_response(AuthError("Invalid email or password"))
        assert response["statusCode"] == 401
        assert json.loads(response["body"]) == {"error": {"message": "Invalid email or password"}}

    def test_includes_details_only_when_the_error_carries_them(self):
        response = error_response(ValidationError("Missing required field(s)", details={"fields": ["email"]}))
        body = json.loads(response["body"])
        assert body["error"]["details"] == {"fields": ["email"]}

    def test_an_unrecognized_exception_becomes_a_generic_500_without_leaking_internals(self):
        response = error_response(RuntimeError("some internal detail that should not leak"))
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert body["error"]["message"] == "Internal server error"
        assert "some internal detail" not in response["body"]


class TestJsonEncoder:
    def test_serializes_a_uuid_as_a_string(self):
        assert json.dumps({"id": UUID("550e8400-e29b-41d4-a716-446655440000")}, cls=JsonEncoder) == (
            '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
        )

    def test_serializes_a_datetime_as_isoformat(self):
        result = json.loads(json.dumps({"at": datetime(2026, 1, 15, 10, 30)}, cls=JsonEncoder))
        assert result["at"] == "2026-01-15T10:30:00"

    def test_serializes_a_date_as_isoformat(self):
        result = json.loads(json.dumps({"on": date(2026, 1, 15)}, cls=JsonEncoder))
        assert result["on"] == "2026-01-15"

    def test_serializes_a_decimal_as_a_float(self):
        result = json.loads(json.dumps({"amount": Decimal("1500.50")}, cls=JsonEncoder))
        assert result["amount"] == 1500.50

    def test_raises_for_a_type_it_does_not_know_how_to_serialize(self):
        with pytest.raises(TypeError):
            json.dumps({"value": {1, 2, 3}}, cls=JsonEncoder)
