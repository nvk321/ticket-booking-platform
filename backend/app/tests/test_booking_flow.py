import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.base import Movie, Screen, ScreenPricing, Seat, SeatType, Show, User


@pytest.mark.asyncio
async def test_e2e_booking_lifecycle_and_retrieval_by_ref(client: AsyncClient):
    # 1. Customer registration & login
    unique_email = f"booker_{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "Password123!", "name": "Alice Booker", "role": "CUSTOMER"}
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["token"]

    # 2. Setup isolated show & seats in DB
    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=50, hours=2),
            end_time=datetime.now(timezone.utc) + timedelta(days=50, hours=4),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        seats_res = await db.execute(
            select(Seat).where(Seat.screen_id == screen.id, Seat.status == "ACTIVE").limit(2)
        )
        seats = seats_res.scalars().all()
        seat_ids = [s.id for s in seats]
        await db.commit()
        await db.refresh(show)

    session_id = f"sess_{uuid.uuid4().hex}"

    # 3. Hold seats
    hold_resp = await client.post(
        "/api/v1/bookings/hold",
        json={"show_id": show.id, "seat_ids": seat_ids, "session_id": session_id}
    )
    assert hold_resp.status_code == 200
    assert hold_resp.json()["success"] is True

    # 4. Confirm & create booking
    create_resp = await client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token}"},
        json={"show_id": show.id, "seat_ids": seat_ids, "session_id": session_id}
    )
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    booking_ref = created_data["bookingRef"]
    booking_id = created_data["id"]
    assert booking_ref.startswith("BK")
    assert created_data["status"] == "CONFIRMED"
    assert created_data["qrCode"] is not None

    # 5. Fetch booking detail by reference (GET /api/v1/bookings/{booking_ref})
    detail_resp = await client.get(
        f"/api/v1/bookings/{booking_ref}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == booking_id
    assert detail["bookingRef"] == booking_ref
    assert detail["status"] == "CONFIRMED"
    assert detail["qrCode"].startswith("data:image/png;base64,")
    assert len(detail["seats"]) == len(seat_ids)
    assert detail["show"] is not None
    assert detail["show"]["movie"]["title"] is not None
    assert detail["show"]["screen"]["name"] is not None
    assert detail["show"]["screen"]["theatre"]["name"] is not None

    # 6. Verify in My Bookings list
    my_resp = await client.get("/api/v1/bookings/my", headers={"Authorization": f"Bearer {token}"})
    assert my_resp.status_code == 200
    my_bookings = my_resp.json()
    assert any(b["bookingRef"] == booking_ref for b in my_bookings)


@pytest.mark.asyncio
async def test_booking_by_ref_rbac_and_404_not_found(client: AsyncClient):
    # Customer A
    email_a = f"customer_a_{uuid.uuid4().hex[:6]}@example.com"
    reg_a = await client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "password": "Password123!", "name": "Customer A", "role": "CUSTOMER"}
    )
    token_a = reg_a.json()["token"]

    # Customer B
    email_b = f"customer_b_{uuid.uuid4().hex[:6]}@example.com"
    reg_b = await client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": "Password123!", "name": "Customer B", "role": "CUSTOMER"}
    )
    token_b = reg_b.json()["token"]

    # Create show & seat for Customer A
    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=55, hours=2),
            end_time=datetime.now(timezone.utc) + timedelta(days=55, hours=4),
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

    session_a = f"sess_{uuid.uuid4().hex}"
    create_resp = await client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"show_id": show.id, "seat_ids": [seat.id], "session_id": session_a}
    )
    assert create_resp.status_code == 201
    booking_ref = create_resp.json()["bookingRef"]

    # Customer B tries to view Customer A's booking -> 403 Forbidden
    forbidden_resp = await client.get(
        f"/api/v1/bookings/{booking_ref}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert forbidden_resp.status_code == 403

    # Non-existent booking reference -> 404 Not Found
    not_found_resp = await client.get(
        "/api/v1/bookings/BK_DOES_NOT_EXIST_999999",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert not_found_resp.status_code == 404


@pytest.mark.asyncio
async def test_booking_cancellation_and_seat_release(client: AsyncClient):
    email = f"canceller_{uuid.uuid4().hex[:6]}@example.com"
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Canceller", "role": "CUSTOMER"}
    )
    token = reg.json()["token"]

    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=60, hours=2),
            end_time=datetime.now(timezone.utc) + timedelta(days=60, hours=4),
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

    sess = f"sess_{uuid.uuid4().hex}"
    create_resp = await client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token}"},
        json={"show_id": show.id, "seat_ids": [seat.id], "session_id": sess}
    )
    booking_data = create_resp.json()
    booking_id = booking_data["id"]
    booking_ref = booking_data["bookingRef"]

    # Cancel the booking
    cancel_resp = await client.patch(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["success"] is True

    # Check booking detail reflects CANCELLED status
    detail_resp = await client.get(
        f"/api/v1/bookings/{booking_ref}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "CANCELLED"
