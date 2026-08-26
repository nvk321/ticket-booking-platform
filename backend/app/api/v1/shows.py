from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import require_role
from app.core.database import get_db
from app.models.base import (
    Booking,
    BookingSeat,
    Movie,
    Screen,
    ScreenPricing,
    Seat,
    SeatHold,
    SeatType,
    Show,
    Theatre,
    User,
)
from app.schemas.show import ShowCreate, ShowResponse, ShowSeatsResponse

router = APIRouter(prefix="/shows", tags=["Shows & Schedules"])


@router.get("/movie/{movie_id}")
async def get_shows_by_movie(
    movie_id: str,
    date: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Show)
        .options(
            selectinload(Show.screen).selectinload(Screen.theatre),
            selectinload(Show.movie),
        )
        .where(Show.movie_id == movie_id, Show.is_active == True)
    )

    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
            start_of_day = datetime.combine(d.date(), time.min, tzinfo=timezone.utc)
            end_of_day = datetime.combine(d.date(), time.max, tzinfo=timezone.utc)
            query = query.where(Show.start_time >= start_of_day, Show.start_time <= end_of_day)
        except Exception:
            pass

    query = query.order_by(Show.start_time)
    result = await db.execute(query)
    shows = result.scalars().all()

    if city:
        shows = [s for s in shows if s.screen and s.screen.theatre and s.screen.theatre.city and city.lower() in s.screen.theatre.city.lower()]

    output = []
    for s in shows:
        output.append({
            "id": s.id,
            "screenId": s.screen_id,
            "movieId": s.movie_id,
            "startTime": s.start_time.isoformat(),
            "endTime": s.end_time.isoformat(),
            "isActive": s.is_active,
            "screen": {
                "id": s.screen.id,
                "name": s.screen.name,
                "theatre": {
                    "id": s.screen.theatre.id,
                    "name": s.screen.theatre.name,
                    "address": s.screen.theatre.address,
                    "city": s.screen.theatre.city,
                } if s.screen.theatre else None,
            } if s.screen else None,
            "movie": {
                "id": s.movie.id,
                "title": s.movie.title,
                "duration": s.movie.duration,
            } if s.movie else None,
        })
    return output


@router.get("/screen/{screen_id}")
async def get_shows_by_screen(
    screen_id: str,
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Show)
        .options(selectinload(Show.movie))
        .where(Show.screen_id == screen_id, Show.is_active == True)
    )
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
            start_of_day = datetime.combine(d.date(), time.min, tzinfo=timezone.utc)
            end_of_day = datetime.combine(d.date(), time.max, tzinfo=timezone.utc)
            query = query.where(Show.start_time >= start_of_day, Show.start_time <= end_of_day)
        except Exception:
            pass

    result = await db.execute(query.order_by(Show.start_time))
    shows = result.scalars().all()
    return shows


@router.get("/{id}/seats")
async def get_show_seats(id: str, db: AsyncSession = Depends(get_db)):
    show_res = await db.execute(
        select(Show)
        .options(
            selectinload(Show.movie),
            selectinload(Show.screen).selectinload(Screen.theatre),
            selectinload(Show.screen).selectinload(Screen.seats).selectinload(Seat.seat_type),
        )
        .where(Show.id == id)
    )
    show = show_res.scalar_one_or_none()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    # 1. Fetch active booked seat IDs
    booked_res = await db.execute(
        select(BookingSeat.seat_id)
        .where(
            BookingSeat.show_id == id,
            BookingSeat.is_cancelled == False,
        )
    )
    booked_seat_ids = set(booked_res.scalars().all())

    # 2. Fetch active held seat IDs
    now = datetime.now(timezone.utc)
    held_res = await db.execute(
        select(SeatHold)
        .where(SeatHold.show_id == id, SeatHold.expires_at > now)
    )
    held_list = held_res.scalars().all()
    held_map = {h.seat_id: h for h in held_list}

    # 3. Fetch screen pricing
    pricing_res = await db.execute(
        select(ScreenPricing).where(ScreenPricing.screen_id == show.screen_id)
    )
    pricing_list = pricing_res.scalars().all()
    pricing_map = {p.seat_type_id: p for p in pricing_list}

    is_weekend = show.start_time.weekday() in [5, 6]
    is_peak = show.start_time.hour >= 18

    # 4. Compute per-seat status and category statistics
    category_stats_map = {}
    computed_seats = []

    # Sort physical seats row, col
    sorted_seats = sorted(show.screen.seats, key=lambda s: (s.row, s.col))

    for s in sorted_seats:
        tier_price = pricing_map.get(s.seat_type_id)
        price = s.custom_price or (tier_price.base_price if tier_price else 250.0)
        if is_weekend and tier_price and tier_price.weekend_price:
            price = tier_price.weekend_price
        if is_peak and tier_price and tier_price.peak_price:
            price = max(price, tier_price.peak_price)

        # Determine runtime status
        if booked_seat_ids and s.id in booked_seat_ids:
            runtime_status = "BOOKED"
        elif s.id in held_map:
            runtime_status = "HELD"
        elif s.status != "ACTIVE":
            runtime_status = s.status
        else:
            runtime_status = "AVAILABLE"

        computed_seats.append({
            "id": s.id,
            "screenId": s.screen_id,
            "seatTypeId": s.seat_type_id,
            "row": s.row,
            "col": s.col,
            "label": s.label,
            "rowLabel": s.row_label,
            "status": runtime_status,
            "isGolden": s.is_golden,
            "isAccessible": s.is_accessible,
            "customPrice": s.custom_price,
            "price": price,
            "seatType": {
                "id": s.seat_type.id,
                "name": s.seat_type.name,
                "color": s.seat_type.color,
            } if s.seat_type else None,
        })

        if s.seat_type_id:
            if s.seat_type_id not in category_stats_map:
                category_stats_map[s.seat_type_id] = {
                    "seatTypeId": s.seat_type_id,
                    "seatTypeName": s.seat_type.name if s.seat_type else "Category",
                    "color": s.seat_type.color if s.seat_type else "#6b7280",
                    "total": 0,
                    "available": 0,
                    "held": 0,
                    "booked": 0,
                }
            stat = category_stats_map[s.seat_type_id]
            stat["total"] += 1
            if runtime_status == "BOOKED":
                stat["booked"] += 1
            elif runtime_status == "HELD":
                stat["held"] += 1
            elif runtime_status == "AVAILABLE":
                stat["available"] += 1

    category_stats = [
        {**stat, "isSoldOut": stat["available"] == 0}
        for stat in category_stats_map.values()
    ]

    return {
        "id": show.id,
        "screenId": show.screen_id,
        "movieId": show.movie_id,
        "startTime": show.start_time.isoformat(),
        "endTime": show.end_time.isoformat(),
        "isActive": show.is_active,
        "movie": {
            "id": show.movie.id,
            "title": show.movie.title,
            "duration": show.movie.duration,
            "eventType": show.movie.event_type,
            "posterUrl": show.movie.poster_url,
            "rating": show.movie.rating,
            "genre": show.movie.genre,
        },
        "screen": {
            "id": show.screen.id,
            "name": show.screen.name,
            "theatre": {
                "id": show.screen.theatre.id,
                "name": show.screen.theatre.name,
                "city": show.screen.theatre.city,
                "address": show.screen.theatre.address,
            } if show.screen.theatre else None,
            "seats": computed_seats,
        },
        "categoryStats": category_stats,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_show(
    show_in: ShowCreate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    # Verify screen and ownership
    screen_res = await db.execute(
        select(Screen).options(selectinload(Screen.theatre)).where(Screen.id == show_in.screen_id)
    )
    screen = screen_res.scalar_one_or_none()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Time overlap check on same screen
    conflict_res = await db.execute(
        select(Show).where(
            Show.screen_id == show_in.screen_id,
            Show.is_active == True,
            or_(
                and_(Show.start_time <= show_in.start_time, Show.end_time > show_in.start_time),
                and_(Show.start_time < show_in.end_time, Show.end_time >= show_in.end_time),
                and_(Show.start_time >= show_in.start_time, Show.end_time <= show_in.end_time),
            ),
        )
    )
    if conflict_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Time conflict with an existing show on this screen")

    show = Show(
        screen_id=show_in.screen_id,
        movie_id=show_in.movie_id,
        start_time=show_in.start_time,
        end_time=show_in.end_time,
        available_from=show_in.available_from,
        available_to=show_in.available_to,
        is_active=True,
    )
    db.add(show)
    await db.commit()
    await db.refresh(show)
    return {"message": "Show created successfully", "id": show.id}


@router.patch("/{id}/toggle")
async def toggle_show(
    id: str,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Show).options(selectinload(Show.screen).selectinload(Screen.theatre)).where(Show.id == id)
    )
    show = result.scalar_one_or_none()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    if show.screen.theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    show.is_active = not show.is_active
    await db.commit()
    return {"id": show.id, "isActive": show.is_active}
