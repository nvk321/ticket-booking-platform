import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import Theatre, User
from app.schemas.venue import TheatreCreate, TheatreResponse, TheatreUpdate

router = APIRouter(prefix="/theatres", tags=["Venues & Theatres"])


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    return re.sub(r'[-\s]+', '-', s)


@router.get("", response_model=List[TheatreResponse])
async def list_theatres(
    city: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Theatre).options(selectinload(Theatre.screens)).where(Theatre.is_active == True)
    if city:
        query = query.where(Theatre.city.ilike(f"%{city}%"))
    result = await db.execute(query.order_by(Theatre.name))
    theatres = result.scalars().all()
    return [TheatreResponse.model_validate(t) for t in theatres]


@router.get("/admin/mine", response_model=List[TheatreResponse])
async def list_my_theatres(
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Theatre).options(selectinload(Theatre.screens))
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        query = query.where(Theatre.admin_id == current_user.id)
    result = await db.execute(query.order_by(Theatre.name))
    theatres = result.scalars().all()
    return [TheatreResponse.model_validate(t) for t in theatres]


@router.get("/{id}", response_model=TheatreResponse)
async def get_theatre(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Theatre).options(selectinload(Theatre.screens)).where(Theatre.id == id)
    )
    theatre = result.scalar_one_or_none()
    if not theatre:
        raise HTTPException(status_code=404, detail="Venue not found")
    return TheatreResponse.model_validate(theatre)


@router.post("", response_model=TheatreResponse, status_code=status.HTTP_201_CREATED)
async def create_theatre(
    theatre_in: TheatreCreate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    slug = theatre_in.slug or slugify(theatre_in.name)
    # Ensure unique slug
    base_slug = slug
    counter = 1
    while True:
        existing = await db.execute(select(Theatre).where(Theatre.slug == slug))
        if not existing.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    theatre = Theatre(
        name=theatre_in.name.strip(),
        slug=slug,
        address=theatre_in.address,
        city=theatre_in.city,
        state=theatre_in.state,
        country=theatre_in.country,
        admin_id=theatre_in.admin_id or current_user.id,
        primary_color=theatre_in.primary_color,
        accent_color=theatre_in.accent_color,
        is_active=theatre_in.is_active,
    )
    db.add(theatre)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A venue with this name or slug already exists."
        )

    refetched = await db.execute(
        select(Theatre).options(selectinload(Theatre.screens)).where(Theatre.id == theatre.id)
    )
    theatre = refetched.scalar_one()
    return TheatreResponse.model_validate(theatre)


@router.put("/{id}", response_model=TheatreResponse)
async def update_theatre(
    id: str,
    theatre_in: TheatreUpdate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Theatre).where(Theatre.id == id))
    theatre = result.scalar_one_or_none()
    if not theatre:
        raise HTTPException(status_code=404, detail="Venue not found")
    if theatre.admin_id != current_user.id and current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not manage this venue")

    update_data = theatre_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if field == "name" and val:
            val = val.strip()
        setattr(theatre, field, val)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A venue with this name or slug already exists."
        )

    refetched = await db.execute(
        select(Theatre).options(selectinload(Theatre.screens)).where(Theatre.id == theatre.id)
    )
    theatre = refetched.scalar_one()
    return TheatreResponse.model_validate(theatre)
