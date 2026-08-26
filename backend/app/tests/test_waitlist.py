import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.base import Movie, Screen, ScreenPricing, Seat, SeatType, Show, User


@pytest.mark.asyncio
async def test_waitlist_fifo_and_cancellation_cascade(client: AsyncClient):
    # 1. Create two customers
    email_w1 = f"waitlist1_{uuid.uuid4().hex[:6]}@example.com"
    email_w2 = f"waitlist2_{uuid.uuid4().hex[:6]}@example.com"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email_w1, "password": "Password123!", "name": "Waitlist User 1", "role": "CUSTOMER"}
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": email_w2, "password": "Password123!", "name": "Waitlist User 2", "role": "CUSTOMER"}
    )

    login1 = await client.post("/api/v1/auth/login", json={"email": email_w1, "password": "Password123!"})
    token1 = login1.json()["token"]

    login2 = await client.post("/api/v1/auth/login", json={"email": email_w2, "password": "Password123!"})
    token2 = login2.json()["token"]

    # 2. Create isolated show and seat category
    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=22, hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=22, hours=3),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        st_res = await db.execute(select(SeatType).limit(1))
        seat_type = st_res.scalar_one()

        seat_res = await db.execute(
            select(Seat).where(Seat.screen_id == screen.id, Seat.seat_type_id == seat_type.id).limit(1)
        )
        seat = seat_res.scalar_one()
        await db.commit()
        await db.refresh(show)

    # 3. User 1 joins waitlist -> queuePosition = 1
    join_resp1 = await client.post(
        "/api/v1/waitlist/join",
        headers={"Authorization": f"Bearer {token1}"},
        json={"show_id": show.id, "seat_type_id": seat_type.id}
    )
    assert join_resp1.status_code == 201
    wl1_data = join_resp1.json()
    assert wl1_data["queuePosition"] == 1
    assert wl1_data["status"] == "PENDING"

    # 4. User 2 joins waitlist -> queuePosition = 2
    join_resp2 = await client.post(
        "/api/v1/waitlist/join",
        headers={"Authorization": f"Bearer {token2}"},
        json={"show_id": show.id, "seat_type_id": seat_type.id}
    )
    assert join_resp2.status_code == 201
    wl2_data = join_resp2.json()
    assert wl2_data["queuePosition"] == 2
    assert wl2_data["status"] == "PENDING"

    # 5. Book the seat under an initial user, then cancel it to trigger cascading
    init_book = await client.post(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token2}"},
        json={"show_id": show.id, "seat_ids": [seat.id], "session_id": "sess_initial"}
    )
    assert init_book.status_code == 201
    booking_id = init_book.json()["id"]

    # Cancel the booking
    cancel_resp = await client.patch(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert cancel_resp.status_code == 200

    # 6. Check User 1's waitlist: User 1 must now have status OFFER_PENDING with offeredSeatId
    my_wl1 = await client.get(
        "/api/v1/waitlist/my",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert my_wl1.status_code == 200
    wls = my_wl1.json()
    entry1 = next(item for item in wls if item["id"] == wl1_data["id"])
    assert entry1["status"] == "OFFER_PENDING"
    assert entry1["offeredSeatId"] == seat.id

    # 7. User 1 claims the offer -> successfully creates confirmed booking!
    claim_resp = await client.post(
        f"/api/v1/waitlist/{wl1_data['id']}/claim",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert claim_resp.status_code == 200
    claim_data = claim_resp.json()
    assert "booking" in claim_data
    assert claim_data["booking"]["status"] == "CONFIRMED"
