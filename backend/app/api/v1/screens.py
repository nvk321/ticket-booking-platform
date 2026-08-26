from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Screen, ScreenPricing, Seat, SeatType, Theatre, User
from app.schemas.screen import (
    LayoutSaveRequest,
    ScreenCreate,
    ScreenPricingUpdate,
    ScreenResponse,
    ScreenUpdate,
    SeatResponse,
)

router = APIRouter(prefix="/screens", tags=["Screens & Layouts"])


@router.get("/theatre/{theatre_id}", response_model=List[ScreenResponse])
async def get_screens_by_theatre(theatre_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Screen)
        .options(
            selectinload(Screen.seats).selectinload(Seat.seat_type),
            selectinload(Screen.theatre),
        )
        .where(Screen.theatre_id == theatre_id)
        .order_by(Screen.name)
    )
    screens = result.scalars().all()
    return [ScreenResponse.model_validate(s) for s in screens]


@router.get("/{id}", response_model=ScreenResponse)
async def get_screen(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Screen)
        .options(
            selectinload(Screen.seats).selectinload(Seat.seat_type),
            selectinload(Screen.theatre),
        )
        .where(Screen.id == id)
    )
    screen = result.scalar_one_or_none()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")
    return ScreenResponse.model_validate(screen)


@router.post("", response_model=ScreenResponse, status_code=status.HTTP_201_CREATED)
async def create_screen(
    screen_in: ScreenCreate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    theatre_res = await db.execute(select(Theatre).where(Theatre.id == screen_in.theatre_id))
    theatre = theatre_res.scalar_one_or_none()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found")
    if theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Check for existing screen with the same name in this theatre
    clean_name = screen_in.name.strip()
    existing_screen = await db.execute(
        select(Screen).where(
            Screen.theatre_id == screen_in.theatre_id,
            Screen.name.ilike(clean_name),
        )
    )
    if existing_screen.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A screen named '{clean_name}' already exists in this venue."
        )

    screen = Screen(
        theatre_id=screen_in.theatre_id,
        name=clean_name,
        capacity=screen_in.capacity,
        rows=screen_in.rows,
        cols=screen_in.cols,
    )
    db.add(screen)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A screen named '{clean_name}' already exists in this venue."
        )

    refetched = await db.execute(
        select(Screen)
        .options(
            selectinload(Screen.seats).selectinload(Seat.seat_type),
            selectinload(Screen.theatre),
        )
        .where(Screen.id == screen.id)
    )
    screen_obj = refetched.scalar_one()
    return ScreenResponse.model_validate(screen_obj)


@router.put("/{id}", response_model=ScreenResponse)
async def update_screen(
    id: str,
    screen_in: ScreenUpdate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Screen).options(selectinload(Screen.theatre)).where(Screen.id == id)
    )
    screen = result.scalar_one_or_none()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    if screen_in.name:
        clean_name = screen_in.name.strip()
        existing_screen = await db.execute(
            select(Screen).where(
                Screen.theatre_id == screen.theatre_id,
                Screen.name.ilike(clean_name),
                Screen.id != id,
            )
        )
        if existing_screen.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another screen named '{clean_name}' already exists in this venue."
            )
        screen.name = clean_name

    for field, val in screen_in.model_dump(exclude_unset=True).items():
        if field != "name":
            setattr(screen, field, val)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A screen with this name already exists in this venue."
        )

    refetched = await db.execute(
        select(Screen)
        .options(
            selectinload(Screen.seats).selectinload(Seat.seat_type),
            selectinload(Screen.theatre),
        )
        .where(Screen.id == screen.id)
    )
    screen_obj = refetched.scalar_one()
    return ScreenResponse.model_validate(screen_obj)


@router.post("/{id}/layout")
async def save_layout(
    id: str,
    layout_in: LayoutSaveRequest,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Screen).options(selectinload(Screen.theatre)).where(Screen.id == id)
    )
    screen = result.scalar_one_or_none()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        # Delete existing seats
        await db.execute(delete(Seat).where(Seat.screen_id == id))

        # Insert new physical seats
        active_count = 0
        for s in layout_in.seats:
            new_seat = Seat(
                screen_id=id,
                row=s.row,
                col=s.col,
                label=s.label,
                row_label=s.row_label,
                seat_type_id=s.seat_type_id,
                status=s.status or "ACTIVE",
                is_golden=s.is_golden or False,
                is_accessible=s.is_accessible or False,
                custom_price=s.custom_price,
            )
            db.add(new_seat)
            if (s.status or "ACTIVE") == "ACTIVE":
                active_count += 1

        screen.rows = layout_in.rows
        screen.cols = layout_in.cols
        screen.capacity = active_count

        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate seat coordinates or labels detected in layout."
        )

    return {"message": "Seat layout saved successfully", "capacity": active_count}


@router.get("/{id}/pricing")
async def get_screen_pricing(id: str, db: AsyncSession = Depends(get_db)):
    pricing_res = await db.execute(
        select(ScreenPricing).options(selectinload(ScreenPricing.seat_type)).where(ScreenPricing.screen_id == id)
    )
    return pricing_res.scalars().all()


@router.post("/{id}/pricing")
async def save_screen_pricing(
    id: str,
    pricing_in: ScreenPricingUpdate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    try:
        for p in pricing_in.pricing:
            existing_res = await db.execute(
                select(ScreenPricing).where(
                    ScreenPricing.screen_id == id,
                    ScreenPricing.seat_type_id == p.seat_type_id,
                )
            )
            existing = existing_res.scalar_one_or_none()
            if existing:
                existing.base_price = p.base_price
                existing.weekend_price = p.weekend_price
                existing.peak_price = p.peak_price
            else:
                new_p = ScreenPricing(
                    screen_id=id,
                    seat_type_id=p.seat_type_id,
                    base_price=p.base_price,
                    weekend_price=p.weekend_price,
                    peak_price=p.peak_price,
                )
                db.add(new_p)

        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pricing tier configuration constraint conflict."
        )

    return {"message": "Pricing updated successfully"}
