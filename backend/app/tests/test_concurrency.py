import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.base import Movie, Screen, ScreenPricing, Seat, SeatType, Show, User


@pytest.mark.asyncio
async def test_concurrent_seat_hold_collision(client: AsyncClient):
    login_a = await client.post("/api/v1/auth/login", json={"email": "user@theatre.com", "password": "user123"})
    token_a = login_a.json()["token"]

    login_b = await client.post("/api/v1/auth/login", json={"email": "admin@theatre.com", "password": "admin123"})
    token_b = login_b.json()["token"]

    # Create an isolated show and seat specifically for this concurrency test
    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=40, hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=40, hours=3),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        seat_res = await db.execute(
            select(Seat).where(Seat.screen_id == screen.id, Seat.status == "ACTIVE").limit(1)
        )
        seat = seat_res.scalar_one()
        await db.commit()
        await db.refresh(show)

    session_a = f"session_{uuid.uuid4().hex}"
    session_b = f"session_{uuid.uuid4().hex}"

    async def attempt_hold(session_id: str):
        return await client.post(
            "/api/v1/bookings/hold",
            json={
                "show_id": show.id,
                "seat_ids": [seat.id],
                "session_id": session_id,
            }
        )

    # Launch concurrently against PostgreSQL
    resp_a, resp_b = await asyncio.gather(
        attempt_hold(session_a),
        attempt_hold(session_b),
        return_exceptions=True
    )

    statuses = [getattr(resp_a, "status_code", 500), getattr(resp_b, "status_code", 500)]
    
    # Exactly one must succeed (200 OK) and the colliding attempt must receive 409 Conflict
    assert 200 in statuses
    assert (409 in statuses or 400 in statuses)


@pytest.mark.asyncio
async def test_concurrent_booking_anti_double_booking(client: AsyncClient):
    login_a = await client.post("/api/v1/auth/login", json={"email": "user@theatre.com", "password": "user123"})
    token_a = login_a.json()["token"]

    email_b = f"customer_b_{uuid.uuid4().hex[:6]}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": "Password123!", "name": "Customer B", "role": "CUSTOMER"}
    )
    login_b = await client.post("/api/v1/auth/login", json={"email": email_b, "password": "Password123!"})
    token_b = login_b.json()["token"]

    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=41, hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=41, hours=3),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        seat_res = await db.execute(
            select(Seat).where(Seat.screen_id == screen.id, Seat.status == "ACTIVE").limit(1)
        )
        seat = seat_res.scalar_one()
        await db.commit()
        await db.refresh(show)

    session_a = f"sess_book_{uuid.uuid4().hex}"
    session_b = f"sess_book_{uuid.uuid4().hex}"

    async def attempt_booking(token: str, session_id: str):
        return await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "show_id": show.id,
                "seat_ids": [seat.id],
                "session_id": session_id,
            }
        )

    # Launch concurrent checkout transactions against PostgreSQL
    resps = await asyncio.gather(
        attempt_booking(token_a, session_a),
        attempt_booking(token_b, session_b),
        return_exceptions=True
    )

    status_codes = [getattr(r, "status_code", 500) for r in resps]
    
    # Exactly one booking must succeed (201 Created) and the colliding checkout must receive 409 Conflict
    assert 201 in status_codes
    assert (409 in status_codes or 400 in status_codes)
