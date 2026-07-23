from decimal import Decimal

import pytest
from errors import ValidationError
from validation import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    parse_pagination,
    parse_sort,
    require_fields,
    validate_date,
    validate_decimal,
    validate_enum,
    validate_int,
    validate_uuid,
)


class TestRequireFields:
    def test_passes_when_all_fields_present_and_truthy(self):
        require_fields({"email": "a@b.com", "password": "secret1"}, "email", "password")

    def test_raises_when_a_field_is_missing_entirely(self):
        with pytest.raises(ValidationError) as exc_info:
            require_fields({"email": "a@b.com"}, "email", "password")
        assert exc_info.value.details["fields"] == ["password"]

    def test_raises_when_a_field_is_present_but_empty_string(self):
        # get(f) in (None, "") - an empty string is treated the same as missing.
        with pytest.raises(ValidationError) as exc_info:
            require_fields({"email": "", "password": "secret1"}, "email", "password")
        assert exc_info.value.details["fields"] == ["email"]

    def test_reports_every_missing_field_at_once(self):
        with pytest.raises(ValidationError) as exc_info:
            require_fields({}, "email", "password", "full_name")
        assert exc_info.value.details["fields"] == ["email", "password", "full_name"]

    def test_a_falsy_but_present_value_like_zero_is_not_missing(self):
        # Only None/"" count as missing - 0 and False are legitimate values.
        require_fields({"allocation_percent": 0}, "allocation_percent")


class TestValidateEnum:
    def test_passes_through_an_allowed_value(self):
        assert validate_enum("active", ("planning", "active"), "status") == "active"

    def test_raises_for_a_disallowed_value_with_the_allowed_list_in_details(self):
        with pytest.raises(ValidationError) as exc_info:
            validate_enum("bogus", ("planning", "active"), "status")
        assert exc_info.value.details == {"field": "status", "allowed": ["planning", "active"]}

    def test_is_case_sensitive(self):
        with pytest.raises(ValidationError):
            validate_enum("ACTIVE", ("active",), "status")


class TestValidateUuid:
    def test_passes_through_a_valid_uuid_normalized_to_canonical_form(self):
        result = validate_uuid("550E8400-E29B-41D4-A716-446655440000", "id")
        assert result == "550e8400-e29b-41d4-a716-446655440000"

    def test_raises_for_a_malformed_uuid(self):
        with pytest.raises(ValidationError):
            validate_uuid("not-a-uuid", "id")

    def test_raises_for_none(self):
        with pytest.raises(ValidationError):
            validate_uuid(None, "id")


class TestValidateDate:
    def test_passes_through_a_valid_iso_date(self):
        assert validate_date("2026-01-15", "start_date") == "2026-01-15"

    def test_raises_for_a_non_iso_format(self):
        with pytest.raises(ValidationError):
            validate_date("01/15/2026", "start_date")

    def test_raises_for_an_invalid_calendar_date(self):
        with pytest.raises(ValidationError):
            validate_date("2026-02-30", "start_date")

    def test_raises_for_none(self):
        with pytest.raises(ValidationError):
            validate_date(None, "start_date")


class TestValidateInt:
    def test_parses_a_numeric_string(self):
        assert validate_int("42", "page") == 42

    def test_raises_for_a_non_numeric_value(self):
        with pytest.raises(ValidationError):
            validate_int("not-a-number", "page")

    def test_enforces_a_minimum(self):
        with pytest.raises(ValidationError):
            validate_int(0, "allocation_percent", minimum=1)
        assert validate_int(1, "allocation_percent", minimum=1) == 1

    def test_enforces_a_maximum(self):
        with pytest.raises(ValidationError):
            validate_int(101, "allocation_percent", maximum=100)
        assert validate_int(100, "allocation_percent", maximum=100) == 100


class TestValidateDecimal:
    def test_parses_a_numeric_string_to_decimal(self):
        assert validate_decimal("1500.50", "planned_amount") == Decimal("1500.50")

    def test_raises_for_a_non_numeric_value(self):
        with pytest.raises(ValidationError):
            validate_decimal("not-a-number", "planned_amount")

    def test_enforces_a_minimum(self):
        with pytest.raises(ValidationError):
            validate_decimal("-1", "planned_amount", minimum=0)
        assert validate_decimal("0", "planned_amount", minimum=0) == Decimal("0")


class TestParsePagination:
    def test_defaults_when_query_is_empty(self):
        result = parse_pagination({})
        assert result == {"page": 1, "page_size": DEFAULT_PAGE_SIZE, "limit": DEFAULT_PAGE_SIZE, "offset": 0}

    def test_computes_offset_from_page_and_page_size(self):
        result = parse_pagination({"page": "3", "page_size": "10"})
        assert result == {"page": 3, "page_size": 10, "limit": 10, "offset": 20}

    def test_clamps_page_below_one_up_to_one(self):
        result = parse_pagination({"page": "0"})
        assert result["page"] == 1

    def test_clamps_page_size_above_the_maximum(self):
        result = parse_pagination({"page_size": str(MAX_PAGE_SIZE + 50)})
        assert result["page_size"] == MAX_PAGE_SIZE

    def test_clamps_page_size_below_one_up_to_one(self):
        result = parse_pagination({"page_size": "0"})
        assert result["page_size"] == 1

    def test_raises_for_a_non_integer_page(self):
        with pytest.raises(ValidationError):
            parse_pagination({"page": "not-a-number"})

    def test_raises_for_a_non_integer_page_size(self):
        with pytest.raises(ValidationError):
            parse_pagination({"page_size": "not-a-number"})


class TestParseSort:
    ALLOWED = {"name": "p.name", "created_at": "p.created_at"}

    def test_defaults_to_the_given_default_when_no_sort_param(self):
        assert parse_sort({}, self.ALLOWED, default="name") == "p.name ASC"

    def test_ascending_when_no_direction_prefix(self):
        assert parse_sort({"sort": "name"}, self.ALLOWED, default="name") == "p.name ASC"

    def test_descending_with_a_leading_hyphen(self):
        assert parse_sort({"sort": "-created_at"}, self.ALLOWED, default="name") == "p.created_at DESC"

    def test_raises_for_a_sort_key_not_in_the_allow_list(self):
        # Guards against SQL injection via the sort param - only allow-listed columns pass.
        with pytest.raises(ValidationError) as exc_info:
            parse_sort({"sort": "1; DROP TABLE users;"}, self.ALLOWED, default="name")
        assert exc_info.value.details["allowed"] == ["name", "created_at"]

    def test_raises_for_a_disallowed_key_even_with_a_direction_prefix(self):
        with pytest.raises(ValidationError):
            parse_sort({"sort": "-not_a_real_column"}, self.ALLOWED, default="name")
