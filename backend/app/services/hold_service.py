from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.base import BookingSeat, Screen, Seat, SeatHold, Show
from app.realtime.manager import manager


class HoldService:
    @staticmethod
    async def hold_seats(
        db: AsyncSession,
        show_id: str,
        seat_ids: List[str],
        session_id: str,
    ) -> dict:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.SEAT_HOLD_TTL_MINUTES)

        # 1. Verify show exists & active
        show_res = await db.execute(select(Show).where(Show.id == show_id, Show.is_active == True))
        show = show_res.scalar_one_or_none()
        if not show:
            return {"success": False, "error": "Show not found or inactive"}

        # 2. Verify all seats belong to screen
        seats_res = await db.execute(
            select(Seat).where(Seat.id.in_(seat_ids), Seat.screen_id == show.screen_id)
        )
        seats = seats_res.scalars().all()
        if len(seats) != len(seat_ids):
            return {"success": False, "error": "Invalid seats for this screen"}

        # 3. Check if already booked
        booked_res = await db.execute(
            select(BookingSeat).where(
                BookingSeat.show_id == show_id,
                BookingSeat.seat_id.in_(seat_ids),
                BookingSeat.is_cancelled == False,
            )
        )
        booked = booked_res.scalars().all()
        if booked:
            return {"success": False, "error": "Some seats are already booked"}

        # 4. Check active holds by another user
        holds_res = await db.execute(
            select(SeatHold).where(
                SeatHold.show_id == show_id,
                SeatHold.seat_id.in_(seat_ids),
                SeatHold.expires_at > now,
            )
        )
        active_holds = holds_res.scalars().all()
        foreign_holds = [h for h in active_holds if h.session_id != session_id]
        if foreign_holds:
            return {"success": False, "error": "Some seats are currently held by another user"}

        # 5. Delete any previous holds for these seats
        await db.execute(
            delete(SeatHold).where(
                SeatHold.show_id == show_id,
                SeatHold.seat_id.in_(seat_ids)
            )
        )

        # 6. Insert new holds with atomic integrity error handling
        try:
            for seat_id in seat_ids:
                new_hold = SeatHold(
                    seat_id=seat_id,
                    show_id=show_id,
                    session_id=session_id,
                    expires_at=expires_at,
                )
                db.add(new_hold)

            await db.commit()
        except IntegrityError:
            await db.rollback()
            return {"success": False, "error": "Some seats are currently held by another user"}

        # 7. Broadcast real-time update
        await manager.broadcast_to_room(
            f"show:{show_id}",
            {
                "event": "seats:held",
                "showId": show_id,
                "seatIds": seat_ids,
                "sessionId": session_id,
                "expiresAt": expires_at.isoformat(),
            }
        )

        return {"success": True, "expiresAt": expires_at.isoformat()}

    @staticmethod
    async def release_seats(
        db: AsyncSession,
        show_id: str,
        seat_ids: List[str],
        session_id: str,
    ) -> dict:
        await db.execute(
            delete(SeatHold).where(
                SeatHold.show_id == show_id,
                SeatHold.seat_id.in_(seat_ids),
                SeatHold.session_id == session_id,
            )
        )
        await db.commit()

        await manager.broadcast_to_room(
            f"show:{show_id}",
            {
                "event": "seats:released",
                "showId": show_id,
                "seatIds": seat_ids,
            }
        )
        return {"success": True}

    @staticmethod
    async def sweep_expired_holds(db: AsyncSession) -> int:
        now = datetime.now(timezone.utc)
        expired_res = await db.execute(
            select(SeatHold).where(SeatHold.expires_at < now)
        )
        expired = expired_res.scalars().all()
        if not expired:
            return 0

        # Group by showId
        by_show = {}
        for h in expired:
            by_show.setdefault(h.show_id, []).append(h.seat_id)

        await db.execute(delete(SeatHold).where(SeatHold.expires_at < now))
        await db.commit()

        for show_id, seat_ids in by_show.items():
            await manager.broadcast_to_room(
                f"show:{show_id}",
                {
                    "event": "seats:holdExpired",
                    "showId": show_id,
                    "seatIds": seat_ids,
                }
            )

        return len(expired)


hold_service = HoldService()
