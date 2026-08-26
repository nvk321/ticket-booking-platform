import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.base import Booking, BookingSeat, Movie, Screen, Seat, Show, Theatre, User


@pytest.mark.asyncio
async def test_customer_cannot_access_admin_endpoints(client: AsyncClient):
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "user@theatre.com", "password": "user123"}
    )
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/theatres",
        headers=headers,
        json={"name": "Hacked Theatre", "address": "123 Street", "city": "City"}
    )
    assert resp.status_code == 403

    resp = await client.get("/api/v1/theatres/admin/mine", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_customer_cannot_access_other_customer_booking(client: AsyncClient):
    email1 = f"c1_{uuid.uuid4().hex[:6]}@example.com"
    email2 = f"c2_{uuid.uuid4().hex[:6]}@example.com"

    await client.post("/api/v1/auth/register", json={"email": email1, "password": "Password123!", "name": "C1", "role": "CUSTOMER"})
    await client.post("/api/v1/auth/register", json={"email": email2, "password": "Password123!", "name": "C2", "role": "CUSTOMER"})

    login1 = await client.post("/api/v1/auth/login", json={"email": email1, "password": "Password123!"})
    token1 = login1.json()["token"]

    login2 = await client.post("/api/v1/auth/login", json={"email": email2, "password": "Password123!"})
    token2 = login2.json()["token"]

    # Customer 1 creates a booking on a dedicated isolated show
    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=30, hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=30, hours=3),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        seat_res = await db.execute(select(Seat).where(Seat.screen_id == screen.id, Seat.status == "ACTIVE").limit(1))
        seat = seat_res.scalar_one()
        await db.commit()
        await db.refresh(show)

    book_resp = await client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token1}"},
        json={"show_id": show.id, "seat_ids": [seat.id], "session_id": f"sess_{uuid.uuid4().hex}"}
    )
    assert book_resp.status_code == 201
    booking_ref = book_resp.json()["bookingRef"]
    booking_id = book_resp.json()["id"]

    # Customer 2 attempts to view Customer 1's booking via ref -> 403 Forbidden
    view_resp = await client.get(
        f"/api/v1/bookings/{booking_ref}",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert view_resp.status_code == 403

    # Customer 2 attempts to cancel Customer 1's booking -> 400 with Forbidden detail
    cancel_resp = await client.patch(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert cancel_resp.status_code == 400
    assert "Forbidden" in cancel_resp.json()["detail"]


@pytest.mark.asyncio
async def test_organiser_ownership_isolation(client: AsyncClient):
    email_a = f"org_a_{uuid.uuid4().hex[:6]}@example.com"
    email_b = f"org_b_{uuid.uuid4().hex[:6]}@example.com"

    await client.post("/api/v1/auth/register", json={"email": email_a, "password": "Password123!", "name": "Org A", "role": "ORGANISER"})
    await client.post("/api/v1/auth/register", json={"email": email_b, "password": "Password123!", "name": "Org B", "role": "ORGANISER"})

    login_a = await client.post("/api/v1/auth/login", json={"email": email_a, "password": "Password123!"})
    token_a = login_a.json()["token"]

    login_b = await client.post("/api/v1/auth/login", json={"email": email_b, "password": "Password123!"})
    token_b = login_b.json()["token"]

    create_resp = await client.post(
        "/api/v1/theatres",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": f"Venue A {uuid.uuid4().hex[:4]}", "address": "Street A", "city": "Bengaluru"}
    )
    assert create_resp.status_code == 201
    venue_id = create_resp.json()["id"]

    mod_resp = await client.put(
        f"/api/v1/theatres/{venue_id}",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"name": "Hijacked Venue"}
    )
    assert mod_resp.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_screen_name_in_theatre_rejected(client: AsyncClient):
    email = f"org_screen_{uuid.uuid4().hex[:6]}@example.com"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "name": "Org Screen", "role": "ORGANISER"})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create theatre
    t_resp = await client.post(
        "/api/v1/theatres",
        headers=headers,
        json={"name": f"Screen Test Cinema {uuid.uuid4().hex[:4]}", "address": "123 Screen Way", "city": "Mumbai"}
    )
    theatre_id = t_resp.json()["id"]

    # 1. Create first screen "IMAX 1"
    s1_resp = await client.post(
        "/api/v1/screens",
        headers=headers,
        json={"theatre_id": theatre_id, "name": "IMAX 1", "capacity": 100, "rows": 10, "cols": 10}
    )
    assert s1_resp.status_code == 201

    # 2. Attempt duplicate screen "IMAX 1" in same theatre -> Must return 409 Conflict
    s2_resp = await client.post(
        "/api/v1/screens",
        headers=headers,
        json={"theatre_id": theatre_id, "name": "IMAX 1", "capacity": 100, "rows": 10, "cols": 10}
    )
    assert s2_resp.status_code == 409
    assert "already exists" in s2_resp.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_user_registration_rejected(client: AsyncClient):
    email = f"dup_user_{uuid.uuid4().hex[:6]}@example.com"
    # First registration -> 201 Created
    r1 = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "User 1", "role": "CUSTOMER"}
    )
    assert r1.status_code == 201

    # Duplicate registration -> 409 Conflict
    r2 = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "User 2", "role": "CUSTOMER"}
    )
    assert r2.status_code == 409
