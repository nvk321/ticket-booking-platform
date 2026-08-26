import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    # Test root /health
    root_resp = await client.get("/health")
    assert root_resp.status_code == 200
    assert root_resp.json()["status"] == "ok"

    # Test /api/v1/health
    v1_resp = await client.get("/api/v1/health")
    assert v1_resp.status_code == 200
    data = v1_resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "ticketflow-backend"


@pytest.mark.asyncio
async def test_auth_register_and_login(client: AsyncClient):
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "password": "Password123!",
        "name": "Integration Tester",
        "role": "CUSTOMER",
    }
    
    # 1. Register
    reg_resp = await client.post("/api/v1/auth/register", json=payload)
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "token" in reg_data
    assert reg_data["user"]["email"] == unique_email
    assert reg_data["user"]["role"] == "CUSTOMER"

    # 2. Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "Password123!"}
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    token = login_data["token"]
    assert token is not None

    # 3. Access /me
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == unique_email


@pytest.mark.asyncio
async def test_auth_invalid_credentials(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "wrongpassword"}
    )
    assert resp.status_code == 401
