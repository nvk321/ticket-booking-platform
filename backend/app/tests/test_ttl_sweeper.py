from datetime import datetime, timedelta, timezone
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.base import Movie, Screen, Seat, SeatHold, Show, User, Waitlist, WaitlistStatus
from app.services.hold_service import hold_service
from app.services.waitlist_service import waitlist_service


@pytest.mark.asyncio
async def test_seat_hold_expiration_sweeper(client: AsyncClient):
    async with AsyncSessionLocal() as db:
        show_res = await db.execute(select(Show).limit(1))
        show = show_res.scalar_one()

        seat_res = await db.execute(select(Seat).where(Seat.screen_id == show.screen_id, Seat.status == "ACTIVE").limit(1))
        seat = seat_res.scalar_one()

        # Create an expired hold (expired 10 minutes ago)
        past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        expired_hold = SeatHold(
            seat_id=seat.id,
            show_id=show.id,
            session_id=f"sess_expired_{uuid.uuid4().hex[:6]}",
            expires_at=past_time,
        )
        db.add(expired_hold)
        await db.commit()

        # Run sweeper
        purged_count = await hold_service.sweep_expired_holds(db)
        assert purged_count >= 1

        # Verify hold is deleted
        check_res = await db.execute(select(SeatHold).where(SeatHold.seat_id == seat.id, SeatHold.show_id == show.id))
        assert check_res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_waitlist_offer_expiration_sweeper_cascades(client: AsyncClient):
    # Customer 1 and Customer 2
    email1 = f"wl_exp1_{uuid.uuid4().hex[:6]}@example.com"
    email2 = f"wl_exp2_{uuid.uuid4().hex[:6]}@example.com"

    await client.post("/api/v1/auth/register", json={"email": email1, "password": "Password123!", "name": "WL Exp 1", "role": "CUSTOMER"})
    await client.post("/api/v1/auth/register", json={"email": email2, "password": "Password123!", "name": "WL Exp 2", "role": "CUSTOMER"})

    login1 = await client.post("/api/v1/auth/login", json={"email": email1, "password": "Password123!"})
    token1 = login1.json()["token"]

    login2 = await client.post("/api/v1/auth/login", json={"email": email2, "password": "Password123!"})
    token2 = login2.json()["token"]

    async with AsyncSessionLocal() as db:
        screen_res = await db.execute(select(Screen).limit(1))
        screen = screen_res.scalar_one()

        movie_res = await db.execute(select(Movie).limit(1))
        movie = movie_res.scalar_one()

        show = Show(
            screen_id=screen.id,
            movie_id=movie.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=25, hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=25, hours=3),
            is_active=True,
        )
        db.add(show)
        await db.flush()

        seat_res = await db.execute(select(Seat).where(Seat.screen_id == screen.id, Seat.status == "ACTIVE").limit(1))
        seat = seat_res.scalar_one()
        await db.commit()
        await db.refresh(show)

    # 1. Both join waitlist
    await client.post("/api/v1/waitlist/join", headers={"Authorization": f"Bearer {token1}"}, json={"show_id": show.id, "seat_type_id": seat.seat_type_id})
    await client.post("/api/v1/waitlist/join", headers={"Authorization": f"Bearer {token2}"}, json={"show_id": show.id, "seat_type_id": seat.seat_type_id})

    async with AsyncSessionLocal() as db:
        # Give candidate 1 an offer that is already expired
        wl1_res = await db.execute(select(Waitlist).where(Waitlist.show_id == show.id).order_by(Waitlist.created_at.asc()).limit(1))
        wl1 = wl1_res.scalar_one()
        wl1.status = WaitlistStatus.OFFER_PENDING.value
        wl1.offered_seat_id = seat.id
        wl1.offer_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        await db.commit()

        # Run waitlist sweeper
        swept = await waitlist_service.sweep_expired_waitlist_offers(db)
        assert swept >= 1

        # Check candidate 1 is marked EXPIRED
        await db.refresh(wl1)
        assert wl1.status == WaitlistStatus.EXPIRED.value

        # Check candidate 2 has now automatically received the OFFER_PENDING offer!
        wl2_res = await db.execute(select(Waitlist).where(Waitlist.show_id == show.id, Waitlist.id != wl1.id))
        wl2 = wl2_res.scalar_one()
        assert wl2.status == WaitlistStatus.OFFER_PENDING.value
        assert wl2.offered_seat_id == seat.id
