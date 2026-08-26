import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.integrations.email import email_service
from app.integrations.qr import generate_ticket_qr
from app.models.base import (
    Booking,
    Screen,
    BookingSeat,
    Payment,
    Seat,
    SeatHold,
    SeatType,
    Show,
    User,
    Waitlist,
    WaitlistStatus,
)
from app.realtime.manager import manager

logger = logging.getLogger(__name__)


class WaitlistService:
    @staticmethod
    async def join_waitlist(
        db: AsyncSession,
        user_id: str,
        show_id: str,
        seat_type_id: str,
    ) -> dict:
        # Check if already active on waitlist for this category
        existing = await db.execute(
            select(Waitlist).where(
                Waitlist.user_id == user_id,
                Waitlist.show_id == show_id,
                Waitlist.seat_type_id == seat_type_id,
                Waitlist.status.in_([WaitlistStatus.PENDING.value, WaitlistStatus.OFFER_PENDING.value]),
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("You are already on the active waitlist for this category.")

        waitlist_entry = Waitlist(
            user_id=user_id,
            show_id=show_id,
            seat_type_id=seat_type_id,
            status=WaitlistStatus.PENDING.value,
        )
        db.add(waitlist_entry)
        await db.commit()
        await db.refresh(waitlist_entry)

        # Calculate live FIFO queue position
        pos_res = await db.execute(
            select(func.count(Waitlist.id)).where(
                Waitlist.show_id == show_id,
                Waitlist.seat_type_id == seat_type_id,
                Waitlist.status == WaitlistStatus.PENDING.value,
                Waitlist.created_at <= waitlist_entry.created_at,
            )
        )
        queue_pos = pos_res.scalar() or 1

        return {
            "id": waitlist_entry.id,
            "userId": waitlist_entry.user_id,
            "showId": waitlist_entry.show_id,
            "seatTypeId": waitlist_entry.seat_type_id,
            "status": waitlist_entry.status,
            "queuePosition": queue_pos,
            "createdAt": waitlist_entry.created_at.isoformat(),
        }

    @staticmethod
    async def get_user_waitlists(db: AsyncSession, user_id: str) -> List[dict]:
        now = datetime.now(timezone.utc)
        entries_res = await db.execute(
            select(Waitlist)
            .options(
                selectinload(Waitlist.show).selectinload(Show.movie),
                selectinload(Waitlist.show).selectinload(Show.screen).selectinload(Screen.theatre),
                selectinload(Waitlist.seat_type),
                selectinload(Waitlist.offered_seat),
            )
            .where(Waitlist.user_id == user_id)
            .order_by(Waitlist.created_at.desc())
        )
        entries = entries_res.scalars().all()

        results = []
        for w in entries:
            is_offer_expired = False
            if w.status == WaitlistStatus.OFFER_PENDING.value and w.offer_expires_at:
                is_offer_expired = w.offer_expires_at < now

            queue_pos = None
            if w.status == WaitlistStatus.PENDING.value:
                pos_res = await db.execute(
                    select(func.count(Waitlist.id)).where(
                        Waitlist.show_id == w.show_id,
                        Waitlist.seat_type_id == w.seat_type_id,
                        Waitlist.status == WaitlistStatus.PENDING.value,
                        Waitlist.created_at <= w.created_at,
                    )
                )
                queue_pos = pos_res.scalar() or 1

            results.append({
                "id": w.id,
                "userId": w.user_id,
                "showId": w.show_id,
                "seatTypeId": w.seat_type_id,
                "status": w.status,
                "offeredSeatId": w.offered_seat_id,
                "offerExpiresAt": w.offer_expires_at.isoformat() if w.offer_expires_at else None,
                "queuePosition": queue_pos,
                "isOfferExpired": is_offer_expired,
                "createdAt": w.created_at.isoformat(),
                "show": {
                    "id": w.show.id,
                    "startTime": w.show.start_time.isoformat(),
                    "movie": {"id": w.show.movie.id, "title": w.show.movie.title},
                    "screen": {
                        "id": w.show.screen.id,
                        "name": w.show.screen.name,
                        "theatre": {"id": w.show.screen.theatre.id, "name": w.show.screen.theatre.name},
                    },
                } if w.show else None,
                "seatType": {"id": w.seat_type.id, "name": w.seat_type.name, "color": w.seat_type.color} if w.seat_type else None,
                "offeredSeat": {"id": w.offered_seat.id, "label": w.offered_seat.label} if w.offered_seat else None,
            })

        return results

    @staticmethod
    async def cascade_next_offer(
        db: AsyncSession,
        show_id: str,
        seat_type_id: str,
        seat_id: str,
    ) -> Optional[Waitlist]:
        # Lock next eligible FIFO candidate
        candidate_res = await db.execute(
            select(Waitlist)
            .where(
                Waitlist.show_id == show_id,
                Waitlist.seat_type_id == seat_type_id,
                Waitlist.status == WaitlistStatus.PENDING.value,
            )
            .order_by(Waitlist.created_at.asc(), Waitlist.id.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        candidate = candidate_res.scalar_one_or_none()
        if not candidate:
            return None

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.WAITLIST_OFFER_TTL_MINUTES)

        candidate.status = WaitlistStatus.OFFER_PENDING.value
        candidate.offered_seat_id = seat_id
        candidate.offer_expires_at = expires_at

        # Reserve exclusive seat hold for candidate
        await db.execute(
            delete(SeatHold).where(
                SeatHold.show_id == show_id,
                SeatHold.seat_id == seat_id
            )
        )
        hold = SeatHold(
            seat_id=seat_id,
            show_id=show_id,
            session_id=f"waitlist_offer_{candidate.id}",
            expires_at=expires_at,
        )
        db.add(hold)
        await db.commit()
        await db.refresh(candidate)

        # Retrieve metadata for email dispatch
        user_res = await db.execute(select(User).where(User.id == candidate.user_id))
        user = user_res.scalar_one_or_none()

        show_res = await db.execute(
            select(Show).options(selectinload(Show.movie)).where(Show.id == show_id)
        )
        show = show_res.scalar_one_or_none()

        seat_res = await db.execute(select(Seat).where(Seat.id == seat_id))
        seat = seat_res.scalar_one_or_none()

        seat_type_res = await db.execute(select(SeatType).where(SeatType.id == seat_type_id))
        seat_type = seat_type_res.scalar_one_or_none()

        if user and show and seat:
            await email_service.send_waitlist_offer(
                to=user.email,
                event_title=show.movie.title if show.movie else "Your Event",
                category_name=seat_type.name if seat_type else "Category",
                seat_label=seat.label,
                expires_at_str=expires_at.strftime("%I:%M:%S %p"),
                show_id=show_id,
                waitlist_id=candidate.id,
            )

        # Real-time WebSocket broadcast
        await manager.broadcast_to_room(
            f"show:{show_id}",
            {
                "event": "waitlist:offerCreated",
                "showId": show_id,
                "waitlistId": candidate.id,
                "seatId": seat_id,
                "userId": candidate.user_id,
                "expiresAt": expires_at.isoformat(),
            }
        )

        return candidate

    @staticmethod
    async def claim_waitlist_offer(
        db: AsyncSession,
        user_id: str,
        waitlist_id: str,
    ) -> dict:
        now = datetime.now(timezone.utc)

        # Lock waitlist entry
        wl_res = await db.execute(
            select(Waitlist)
            .options(
                selectinload(Waitlist.show).selectinload(Show.screen).selectinload(Screen.theatre),
                selectinload(Waitlist.show).selectinload(Show.movie),
                selectinload(Waitlist.seat_type),
                selectinload(Waitlist.user),
            )
            .where(Waitlist.id == waitlist_id)
            .with_for_update()
        )
        waitlist_entry = wl_res.scalar_one_or_none()

        if not waitlist_entry:
            raise ValueError("Waitlist offer not found")
        if waitlist_entry.user_id != user_id:
            raise ValueError("You are not authorized to claim this offer")
        if waitlist_entry.status != WaitlistStatus.OFFER_PENDING.value:
            raise ValueError(f"Waitlist offer is no longer valid (Status: {waitlist_entry.status})")
        if waitlist_entry.offer_expires_at and waitlist_entry.offer_expires_at < now:
            waitlist_entry.status = WaitlistStatus.EXPIRED.value
            await db.commit()
            raise ValueError("Waitlist offer has expired")

        seat_id = waitlist_entry.offered_seat_id
        show_id = waitlist_entry.show_id

        # Pricing lookup
        seat_res = await db.execute(select(Seat).where(Seat.id == seat_id))
        seat = seat_res.scalar_one_or_none()
        price = seat.custom_price or 500.0

        booking_ref = "BK" + datetime.now().strftime("%y%m%d%H%M%S") + seat_id[:4].upper()
        
        # Create Booking & BookingSeat (with show_id for anti-double booking uniqueness!)
        booking = Booking(
            booking_ref=booking_ref,
            total_amount=price,
            status="CONFIRMED",
            user_id=user_id,
            show_id=show_id,
        )
        db.add(booking)
        await db.flush()

        booking_seat = BookingSeat(
            booking_id=booking.id,
            seat_id=seat_id,
            show_id=show_id,
            price=price,
            is_cancelled=False,
        )
        db.add(booking_seat)

        payment = Payment(
            booking_id=booking.id,
            amount=price,
            currency="INR",
            status="SUCCESS",
            gateway="MOCK",
        )
        db.add(payment)

        # Generate ticket QR
        qr_code = generate_ticket_qr({
            "bookingRef": booking_ref,
            "showId": show_id,
            "seats": [seat.label if seat else "A1"],
            "totalAmount": price,
        })
        booking.qr_code = qr_code

        # Mark waitlist as fulfilled
        waitlist_entry.status = WaitlistStatus.FULFILLED.value

        # Clear hold
        await db.execute(
            delete(SeatHold).where(
                SeatHold.show_id == show_id,
                SeatHold.seat_id == seat_id
            )
        )

        await db.commit()
        await db.refresh(booking)

        # Send confirmation email
        await email_service.send_booking_confirmation(
            to=waitlist_entry.user.email,
            booking_ref=booking_ref,
            event_title=waitlist_entry.show.movie.title,
            venue_name=waitlist_entry.show.screen.theatre.name,
            screen_name=waitlist_entry.show.screen.name,
            start_time_str=waitlist_entry.show.start_time.strftime("%A, %d %B %Y at %I:%M %p"),
            seats=[seat.label if seat else "A1"],
            total_amount=price,
        )

        # Broadcast booked
        await manager.broadcast_to_room(
            f"show:{show_id}",
            {
                "event": "seats:booked",
                "showId": show_id,
                "seatIds": [seat_id],
                "screenId": waitlist_entry.show.screen_id,
            }
        )

        return {
            "id": booking.id,
            "bookingRef": booking.booking_ref,
            "userId": booking.user_id,
            "showId": booking.show_id,
            "totalAmount": booking.total_amount,
            "status": booking.status,
            "qrCode": booking.qr_code,
            "createdAt": booking.created_at.isoformat(),
        }

    @staticmethod
    async def leave_waitlist(db: AsyncSession, user_id: str, waitlist_id: str) -> bool:
        wl_res = await db.execute(select(Waitlist).where(Waitlist.id == waitlist_id))
        entry = wl_res.scalar_one_or_none()
        if not entry:
            raise ValueError("Waitlist entry not found")
        if entry.user_id != user_id:
            raise ValueError("Forbidden")

        was_offered = entry.status == WaitlistStatus.OFFER_PENDING.value
        seat_id = entry.offered_seat_id
        show_id = entry.show_id
        seat_type_id = entry.seat_type_id

        entry.status = WaitlistStatus.CANCELLED.value
        await db.commit()

        if was_offered and seat_id:
            # Cascade seat to next in queue
            await WaitlistService.cascade_next_offer(db, show_id, seat_type_id, seat_id)

        return True

    @staticmethod
    async def sweep_expired_waitlist_offers(db: AsyncSession) -> int:
        now = datetime.now(timezone.utc)
        expired_res = await db.execute(
            select(Waitlist)
            .where(
                Waitlist.status == WaitlistStatus.OFFER_PENDING.value,
                Waitlist.offer_expires_at < now,
            )
            .with_for_update(skip_locked=True)
        )
        expired_entries = expired_res.scalars().all()

        count = 0
        for entry in expired_entries:
            entry.status = WaitlistStatus.EXPIRED.value
            seat_id = entry.offered_seat_id
            show_id = entry.show_id
            seat_type_id = entry.seat_type_id

            await db.commit()

            # Cascade seat to next candidate
            if seat_id:
                await WaitlistService.cascade_next_offer(db, show_id, seat_type_id, seat_id)
            count += 1

        return count


waitlist_service = WaitlistService()
