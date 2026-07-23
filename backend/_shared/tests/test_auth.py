import time

import jwt
import pytest
from errors import AuthError, ForbiddenError

import auth as auth_lib

USER = {"id": "550e8400-e29b-41d4-a716-446655440000", "email": "dev@acme-test.com", "role": "developer"}


class TestSecretFailsClosed:
    def test_raises_rather_than_falling_back_to_a_default_secret(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET", raising=False)
        with pytest.raises(AuthError, match="JWT_SECRET"):
            auth_lib.create_access_token(USER)


class TestPasswordHashing:
    def test_hash_is_not_the_plaintext_password(self):
        assert auth_lib.hash_password("supersecret1") != "supersecret1"

    def test_verify_password_accepts_the_correct_password(self):
        hashed = auth_lib.hash_password("supersecret1")
        assert auth_lib.verify_password("supersecret1", hashed) is True

    def test_verify_password_rejects_a_wrong_password(self):
        hashed = auth_lib.hash_password("supersecret1")
        assert auth_lib.verify_password("wrong-password", hashed) is False

    def test_hashing_the_same_password_twice_produces_different_hashes(self):
        # bcrypt salts each hash independently - this is what prevents rainbow-table lookups.
        assert auth_lib.hash_password("supersecret1") != auth_lib.hash_password("supersecret1")


class TestTokenIssuanceAndDecoding:
    def test_create_access_token_decodes_back_to_the_same_user_claims(self):
        token = auth_lib.create_access_token(USER)
        payload = auth_lib.decode_token(token, expected_type="access")
        assert payload["sub"] == USER["id"]
        assert payload["email"] == USER["email"]
        assert payload["role"] == USER["role"]
        assert payload["type"] == "access"

    def test_create_refresh_token_is_typed_refresh(self):
        token = auth_lib.create_refresh_token(USER)
        payload = auth_lib.decode_token(token, expected_type="refresh")
        assert payload["type"] == "refresh"

    def test_decode_token_rejects_an_access_token_presented_as_a_refresh_token(self):
        token = auth_lib.create_access_token(USER)
        with pytest.raises(AuthError, match="Unexpected token type"):
            auth_lib.decode_token(token, expected_type="refresh")

    def test_decode_token_rejects_a_malformed_token(self):
        with pytest.raises(AuthError, match="Invalid token"):
            auth_lib.decode_token("not-a-real-jwt", expected_type="access")

    def test_decode_token_rejects_a_token_signed_with_a_different_secret(self):
        forged = jwt.encode({"sub": USER["id"], "type": "access", "exp": int(time.time()) + 60}, "wrong-secret", algorithm="HS256")
        with pytest.raises(AuthError, match="Invalid token"):
            auth_lib.decode_token(forged, expected_type="access")

    def test_decode_token_rejects_an_expired_token(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-production")
        expired = jwt.encode(
            {"sub": USER["id"], "type": "access", "iat": int(time.time()) - 120, "exp": int(time.time()) - 60},
            "test-secret-do-not-use-in-production",
            algorithm="HS256",
        )
        with pytest.raises(AuthError, match="Token has expired"):
            auth_lib.decode_token(expired, expected_type="access")

    def test_each_issued_token_has_a_unique_jti(self):
        first = auth_lib.decode_token(auth_lib.create_access_token(USER), expected_type="access")
        second = auth_lib.decode_token(auth_lib.create_access_token(USER), expected_type="access")
        assert first["jti"] != second["jti"]


class TestGetCurrentUser:
    def test_extracts_and_decodes_a_valid_bearer_token(self):
        token = auth_lib.create_access_token(USER)
        payload = auth_lib.get_current_user({"authorization": f"Bearer {token}"})
        assert payload["sub"] == USER["id"]

    def test_raises_when_the_authorization_header_is_missing(self):
        with pytest.raises(AuthError, match="Missing bearer token"):
            auth_lib.get_current_user({})

    def test_raises_when_the_header_does_not_start_with_bearer(self):
        token = auth_lib.create_access_token(USER)
        with pytest.raises(AuthError, match="Missing bearer token"):
            auth_lib.get_current_user({"authorization": token})

    def test_raises_for_a_refresh_token_used_as_a_bearer_token(self):
        token = auth_lib.create_refresh_token(USER)
        with pytest.raises(AuthError, match="Unexpected token type"):
            auth_lib.get_current_user({"authorization": f"Bearer {token}"})


class TestRequireRole:
    def test_passes_when_the_role_is_in_the_allowed_list(self):
        auth_lib.require_role({"role": "admin"}, "admin", "project_manager")

    def test_raises_when_the_role_is_not_in_the_allowed_list(self):
        with pytest.raises(ForbiddenError):
            auth_lib.require_role({"role": "viewer"}, "admin", "project_manager")


class TestRequireMinRole:
    @pytest.mark.parametrize(
        "role,minimum,should_pass",
        [
            ("admin", "team_lead", True),  # more privileged than the minimum
            ("team_lead", "team_lead", True),  # exactly at the minimum
            ("developer", "team_lead", False),  # less privileged than the minimum
            ("viewer", "admin", False),
        ],
    )
    def test_enforces_the_role_hierarchy(self, role, minimum, should_pass):
        if should_pass:
            auth_lib.require_min_role({"role": role}, minimum)
        else:
            with pytest.raises(ForbiddenError):
                auth_lib.require_min_role({"role": role}, minimum)

    def test_an_unrecognized_role_is_treated_as_the_least_privileged(self):
        with pytest.raises(ForbiddenError):
            auth_lib.require_min_role({"role": "not_a_real_role"}, "viewer")
