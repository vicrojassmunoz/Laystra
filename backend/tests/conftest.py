import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store


@pytest.fixture(autouse=True)
def reset_store() -> None:
    store.__init__()  # reseed to a known state before every test


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
