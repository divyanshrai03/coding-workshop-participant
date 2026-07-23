import pytest


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    """auth.py's _secret() fails closed (raises AuthError) with no JWT_SECRET set."""
    monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-production")
