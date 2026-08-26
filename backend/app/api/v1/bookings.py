from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.base import Booking, BookingSeat, Movie, Payment, Screen, Seat, SeatType, Show, Theatre, User
from app.schemas.booking import BookingCreateRequest, HoldRequest, ReleaseRequest
from app.services.booking_service import booking_service
from app.services.hold_service import hold_service

router = APIRouter(prefix="/bookings", tags=["Bookings & Holds"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_booking(
    req: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        booking = await booking_service.create_booking(
            db=db,
            user=current_user,
            show_id=req.show_id,
            seat_ids=req.seat_ids,
            session_id=req.session_id,
        )
        return booking
    except ValueError as e:
        err_msg = str(e).lower()
        if "already been booked" in err_msg or "currently held by another" in err_msg or "another customer" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/my")
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.seats).selectinload(BookingSeat.seat).selectinload(Seat.seat_type),
            selectinload(Booking.show).selectinload(Show.movie),
            selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theatre),
            selectinload(Booking.payment),
        )
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    bookings = res.scalars().all()

    notification_status = "SENT" if settings.EMAIL_PROVIDER.lower() in ["production", "smtp", "sendgrid"] else "MOCK_SENT"

    output = []
    for b in bookings:
        output.append({
            "id": b.id,
            "bookingRef": b.booking_ref,
            "totalAmount": b.total_amount,
            "status": b.status,
            "qrCode": b.qr_code,
            "notificationStatus": notification_status,
            "createdAt": b.created_at.isoformat(),
            "show": {
                "id": b.show.id,
                "startTime": b.show.start_time.isoformat(),
                "movie": {
                    "id": b.show.movie.id,
                    "title": b.show.movie.title,
                    "eventType": b.show.movie.event_type,
                } if b.show and b.show.movie else None,
                "screen": {
                    "id": b.show.screen.id,
                    "name": b.show.screen.name,
                    "theatre": {
                        "id": b.show.screen.theatre.id,
                        "name": b.show.screen.theatre.name,
                        "city": b.show.screen.theatre.city,
                    } if b.show.screen and b.show.screen.theatre else None,
                } if b.show and b.show.screen else None,
            } if b.show else None,
            "seats": [
                {
                    "id": bs.id,
                    "seatId": bs.seat_id,
                    "price": bs.price,
                    "seat": {
                        "id": bs.seat.id,
                        "label": bs.seat.label,
                        "seatType": {"name": bs.seat.seat_type.name} if bs.seat.seat_type else None,
                    } if bs.seat else None,
                }
                for bs in b.seats
            ],
            "payment": {
                "amount": b.payment.amount,
                "status": b.payment.status,
                "gateway": b.payment.gateway,
            } if b.payment else None,
        })
    return output


@router.get("/{ref}")
async def get_booking_by_ref(
    ref: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.seats).selectinload(BookingSeat.seat).selectinload(Seat.seat_type),
            selectinload(Booking.show).selectinload(Show.movie),
            selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theatre),
            selectinload(Booking.payment),
            selectinload(Booking.user),
        )
        .where(Booking.booking_ref == ref)
    )
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != current_user.id and current_user.role not in ["ADMIN", "ORGANISER", "SUPER_ADMIN", "THEATRE_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view this ticket")

    notification_status = "SENT" if settings.EMAIL_PROVIDER.lower() in ["production", "smtp", "sendgrid"] else "MOCK_SENT"

    return {
        "id": booking.id,
        "bookingRef": booking.booking_ref,
        "totalAmount": booking.total_amount,
        "status": booking.status,
        "qrCode": booking.qr_code,
        "notificationStatus": notification_status,
        "createdAt": booking.created_at.isoformat(),
        "show": {
            "id": booking.show.id,
            "startTime": booking.show.start_time.isoformat(),
            "movie": {
                "id": booking.show.movie.id,
                "title": booking.show.movie.title,
                "eventType": booking.show.movie.event_type,
            } if booking.show and booking.show.movie else None,
            "screen": {
                "id": booking.show.screen.id,
                "name": booking.show.screen.name,
                "theatre": {
                    "id": booking.show.screen.theatre.id,
                    "name": booking.show.screen.theatre.name,
                    "city": booking.show.screen.theatre.city,
                } if booking.show.screen and booking.show.screen.theatre else None,
            } if booking.show and booking.show.screen else None,
        } if booking.show else None,
        "seats": [
            {
                "id": bs.id,
                "seatId": bs.seat_id,
                "price": bs.price,
                "seat": {
                    "id": bs.seat.id,
                    "label": bs.seat.label,
                    "seatType": {"name": bs.seat.seat_type.name} if bs.seat.seat_type else None,
                } if bs.seat else None,
            }
            for bs in booking.seats
        ],
        "payment": {
            "amount": booking.payment.amount,
            "status": booking.payment.status,
            "gateway": booking.payment.gateway,
        } if booking.payment else None,
    }


@router.patch("/{id}/cancel")
async def cancel_booking(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await booking_service.cancel_booking(db=db, user=current_user, booking_id=id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/hold")
async def hold_seats_http(
    req: HoldRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await hold_service.hold_seats(
        db=db,
        show_id=req.show_id,
        seat_ids=req.seat_ids,
        session_id=req.session_id,
    )
    if not result.get("success"):
        err = result.get("error", "Failed to hold seats")
        err_msg = err.lower()
        if "held by another" in err_msg or "already booked" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err)
        raise HTTPException(status_code=400, detail=err)
    return result


@router.post("/release")
async def release_seats_http(
    req: ReleaseRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await hold_service.release_seats(
        db=db,
        show_id=req.show_id,
        seat_ids=req.seat_ids,
        session_id=req.session_id,
    )
    return result
