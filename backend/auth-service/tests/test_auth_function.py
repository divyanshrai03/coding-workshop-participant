import pytest


@pytest.fixture(scope="module")
def auth_function(load_service_function):
    return load_service_function("auth-service")


class TestPublicUser:
    """_public_user() is what keeps password_hash out of every API response."""

    def test_keeps_only_the_whitelisted_public_fields(self, auth_function):
        row = {
            "id": "u1",
            "email": "dev@acme-test.com",
            "full_name": "Dev User",
            "role": "developer",
            "capacity_hours_per_week": 40,
            "is_active": True,
            "created_at": "2026-01-01T00:00:00",
            "password_hash": "$2b$12$shouldneverleak",
        }
        result = auth_function._public_user(row)
        assert "password_hash" not in result
        assert result == {
            "id": "u1",
            "email": "dev@acme-test.com",
            "full_name": "Dev User",
            "role": "developer",
            "capacity_hours_per_week": 40,
            "is_active": True,
            "created_at": "2026-01-01T00:00:00",
        }

    def test_tolerates_a_row_missing_some_public_fields(self, auth_function):
        # list_users()'s SELECT always includes every USER_COLUMNS field, but _public_user
        # itself only requires what's actually present - defend that contract directly.
        result = auth_function._public_user({"id": "u1", "email": "dev@acme-test.com"})
        assert result == {"id": "u1", "email": "dev@acme-test.com"}
