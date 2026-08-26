from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import require_role
from app.core.database import get_db
from app.models.base import Booking, BookingSeat, Screen, Show, Theatre, User
from app.schemas.analytics import ScreenOccupancy, TheatreAnalyticsResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/theatre/{theatre_id}")
async def get_theatre_analytics(
    theatre_id: str,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    theatre_res = await db.execute(
        select(Theatre).options(selectinload(Theatre.screens)).where(Theatre.id == theatre_id)
    )
    theatre = theatre_res.scalar_one_or_none()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found")
    if theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    screen_ids = [s.id for s in theatre.screens]

    # Total revenue and bookings
    shows_res = await db.execute(select(Show.id).where(Show.screen_id.in_(screen_ids)))
    show_ids = [s for s in shows_res.scalars().all()]

    bookings_res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.seats))
        .where(Booking.show_id.in_(show_ids), Booking.status == "CONFIRMED")
    )
    bookings = bookings_res.scalars().all()

    total_revenue = sum(b.total_amount for b in bookings)
    total_bookings = len(bookings)

    # Per screen statistics
    screens_stats = []
    for screen in theatre.screens:
        screen_shows_res = await db.execute(select(Show.id).where(Show.screen_id == screen.id))
        screen_show_ids = screen_shows_res.scalars().all()

        screen_bookings = [b for b in bookings if b.show_id in screen_show_ids]
        screen_rev = sum(b.total_amount for b in screen_bookings)
        booked_seats_count = sum(len(b.seats) for b in screen_bookings)

        total_capacity_offered = screen.capacity * len(screen_show_ids) if screen_show_ids else 1
        occupancy_rate = round((booked_seats_count / total_capacity_offered) * 100, 1) if total_capacity_offered else 0.0

        screens_stats.append({
            "screen_id": screen.id,
            "screen_name": screen.name,
            "capacity": screen.capacity,
            "total_bookings": len(screen_bookings),
            "total_revenue": screen_rev,
            "occupancy_rate": min(occupancy_rate, 100.0),
        })

    return {
        "theatre_id": theatre.id,
        "theatre_name": theatre.name,
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "total_shows": len(show_ids),
        "screens": screens_stats,
    }


@router.get("/screen/{screen_id}")
async def get_screen_analytics(
    screen_id: str,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    screen_res = await db.execute(
        select(Screen).options(selectinload(Screen.theatre)).where(Screen.id == screen_id)
    )
    screen = screen_res.scalar_one_or_none()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    shows_res = await db.execute(
        select(Show).options(selectinload(Show.movie)).where(Show.screen_id == screen_id)
    )
    shows = shows_res.scalars().all()
    show_ids = [s.id for s in shows]

    bookings_res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.seats))
        .where(Booking.show_id.in_(show_ids), Booking.status == "CONFIRMED")
    )
    bookings = bookings_res.scalars().all()

    shows_breakdown = []
    for s in shows:
        show_bks = [b for b in bookings if b.show_id == s.id]
        rev = sum(b.total_amount for b in show_bks)
        seat_cnt = sum(len(b.seats) for b in show_bks)
        occ = round((seat_cnt / screen.capacity) * 100, 1) if screen.capacity else 0.0

        shows_breakdown.append({
            "show_id": s.id,
            "movie_title": s.movie.title if s.movie else "Event",
            "start_time": s.start_time.isoformat(),
            "bookings_count": len(show_bks),
            "revenue": rev,
            "occupancy_rate": min(occ, 100.0),
        })

    return {
        "screen_id": screen.id,
        "screen_name": screen.name,
        "theatre_name": screen.theatre.name,
        "capacity": screen.capacity,
        "total_revenue": sum(s["revenue"] for s in shows_breakdown),
        "shows": shows_breakdown,
    }
