import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.integrations.email import email_service
from app.integrations.qr import generate_ticket_qr
from app.models.base import (
    Booking,
    BookingSeat,
    Movie,
    Payment,
    Screen,
    ScreenPricing,
    Seat,
    SeatHold,
    SeatType,
    Show,
    Theatre,
    User,
)
from app.realtime.manager import manager
from app.services.waitlist_service import waitlist_service

logger = logging.getLogger("ticketflow.booking")


class BookingService:
    @staticmethod
    async def create_booking(
        db: AsyncSession,
        user: User,
        show_id: str,
        seat_ids: List[str],
        session_id: str,
    ) -> dict:
        now = datetime.now(timezone.utc)

        # 1. Fetch show with screen and theatre
        show_res = await db.execute(
            select(Show)
            .options(
                selectinload(Show.movie),
                selectinload(Show.screen).selectinload(Screen.theatre),
            )
            .where(Show.id == show_id, Show.is_active == True)
        )
        show = show_res.scalar_one_or_none()
        if not show:
            raise ValueError("Show not found or is inactive")

        # 2. Fetch seats & verify screen association
        seats_res = await db.execute(
            select(Seat)
            .options(selectinload(Seat.seat_type))
            .where(Seat.id.in_(seat_ids), Seat.screen_id == show.screen_id)
        )
        seats = seats_res.scalars().all()
        if len(seats) != len(seat_ids):
            raise ValueError("Some selected seats do not belong to this venue auditorium")

        # 3. Check if already booked with row locks
        booked_res = await db.execute(
            select(BookingSeat)
            .where(
                BookingSeat.show_id == show_id,
                BookingSeat.seat_id.in_(seat_ids),
                BookingSeat.is_cancelled == False,
            )
            .with_for_update()
        )
        already_booked = booked_res.scalars().all()
        if already_booked:
            raise ValueError("One or more selected seats have already been booked")

        # 4. Check active holds
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
            raise ValueError("One or more seats are currently held by another checkout session")

        # 5. Fetch screen pricing
        pricing_res = await db.execute(
            select(ScreenPricing).where(ScreenPricing.screen_id == show.screen_id)
        )
        pricing_list = pricing_res.scalars().all()
        pricing_map = {p.seat_type_id: p for p in pricing_list}

        is_weekend = show.start_time.weekday() in [5, 6]
        is_peak = show.start_time.hour >= 18

        total_amount = 0.0
        booking_seats_data = []

        for seat in seats:
            tier_price = pricing_map.get(seat.seat_type_id)
            price = seat.custom_price or (tier_price.base_price if tier_price else 250.0)
            if is_weekend and tier_price and tier_price.weekend_price:
                price = tier_price.weekend_price
            if is_peak and tier_price and tier_price.peak_price:
                price = max(price, tier_price.peak_price)

            total_amount += price
            booking_seats_data.append({"seat_id": seat.id, "price": price})

        booking_ref = "BK" + datetime.now().strftime("%y%m%d%H%M%S") + uuid.uuid4().hex[:4].upper()

        # 6. Insert Booking record with atomic commit
        try:
            booking = Booking(
                booking_ref=booking_ref,
                user_id=user.id,
                show_id=show_id,
                total_amount=total_amount,
                status="CONFIRMED",
            )
            db.add(booking)
            await db.flush()

            # 7. Insert BookingSeat records (with show_id for engine-level uniqueness!)
            for item in booking_seats_data:
                bs = BookingSeat(
                    booking_id=booking.id,
                    seat_id=item["seat_id"],
                    show_id=show_id,
                    price=item["price"],
                    is_cancelled=False,
                )
                db.add(bs)

            # 8. Create Payment record
            payment = Payment(
                booking_id=booking.id,
                amount=total_amount,
                currency="INR",
                status="SUCCESS",
                gateway="MOCK",
            )
            db.add(payment)

            # 9. Generate QR code
            seat_labels = [s.label for s in seats]
            qr_code = generate_ticket_qr({
                "bookingRef": booking_ref,
                "showId": show_id,
                "seats": seat_labels,
                "totalAmount": total_amount,
            })
            booking.qr_code = qr_code

            # 10. Delete temporary holds
            await db.execute(
                delete(SeatHold).where(
                    SeatHold.show_id == show_id,
                    SeatHold.seat_id.in_(seat_ids)
                )
            )

            await db.commit()
            await db.refresh(booking)

        except IntegrityError:
            await db.rollback()
            raise ValueError("One or more selected seats have already been booked by another customer")

        # 11. Dispatch confirmation email (Non-blocking secondary notification)
        email_status = "MOCK_SENT"
        try:
            start_time_str = show.start_time.strftime("%A, %d %B %Y at %I:%M %p")
            sent = await email_service.send_booking_confirmation(
                to=user.email,
                booking_ref=booking_ref,
                event_title=show.movie.title,
                venue_name=show.screen.theatre.name,
                screen_name=show.screen.name,
                start_time_str=start_time_str,
                seats=seat_labels,
                total_amount=total_amount,
            )
            email_status = "SENT" if email_service.provider_mode == "PRODUCTION" and sent else "MOCK_SENT"
        except Exception as e:
            logger.warning(f"Non-fatal error dispatching confirmation email: {e}")
            email_status = "FAILED"

        # 12. Broadcast real-time booked seats
        await manager.broadcast_to_room(
            f"show:{show_id}",
            {
                "event": "seats:booked",
                "showId": show_id,
                "seatIds": seat_ids,
                "screenId": show.screen_id,
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
            "notificationStatus": email_status,
            "createdAt": booking.created_at.isoformat(),
        }

    @staticmethod
    async def cancel_booking(db: AsyncSession, user: User, booking_id: str) -> dict:
        # 1. Fetch booking with seats, show, payment
        bk_res = await db.execute(
            select(Booking)
            .options(
                selectinload(Booking.seats).selectinload(BookingSeat.seat),
                selectinload(Booking.show).selectinload(Show.movie),
                selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theatre),
                selectinload(Booking.payment),
                selectinload(Booking.user),
            )
            .where(Booking.id == booking_id)
        )
        booking = bk_res.scalar_one_or_none()
        if not booking:
            raise ValueError("Booking not found")

        # 2. Check ownership
        if booking.user_id != user.id and user.role not in ["ADMIN", "ORGANISER", "SUPER_ADMIN", "THEATRE_ADMIN"]:
            raise ValueError("Forbidden: You do not own this booking")

        if booking.status == "CANCELLED":
            raise ValueError("Booking is already cancelled")

        # 3. Update status
        booking.status = "CANCELLED"
        if booking.payment:
            booking.payment.status = "REFUNDED"

        freed_seats = []
        for bs in booking.seats:
            bs.is_cancelled = True
            if bs.seat:
                freed_seats.append(bs.seat)

        await db.commit()

        # 4. Process waitlist reassignments for each freed seat
        reassigned_seat_ids = set()
        for seat in freed_seats:
            if seat.seat_type_id:
                candidate = await waitlist_service.cascade_next_offer(
                    db=db,
                    show_id=booking.show_id,
                    seat_type_id=seat.seat_type_id,
                    seat_id=seat.id,
                )
                if candidate:
                    reassigned_seat_ids.add(seat.id)

        # 5. Broadcast remaining released seats
        unassigned_ids = [s.id for s in freed_seats if s.id not in reassigned_seat_ids]
        if unassigned_ids:
            await manager.broadcast_to_room(
                f"show:{booking.show_id}",
                {
                    "event": "seats:released",
                    "showId": booking.show_id,
                    "seatIds": unassigned_ids,
                }
            )

        # 6. Send cancellation email
        try:
            await email_service.send_cancellation_refund(
                to=booking.user.email,
                booking_ref=booking.booking_ref,
                event_title=booking.show.movie.title if booking.show else "Event",
                refund_amount=booking.total_amount,
            )
        except Exception as e:
            logger.warning(f"Non-fatal error sending cancellation email: {e}")

        return {"success": True, "message": "Booking cancelled and refund processed"}


booking_service = BookingService()
