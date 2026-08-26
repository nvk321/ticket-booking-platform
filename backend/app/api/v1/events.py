from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import require_role
from app.core.database import get_db
from app.models.base import Movie, User
from app.schemas.event import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/movies", tags=["Movies & Events"])


@router.get("", response_model=List[EventResponse])
async def list_events(
    event_type: Optional[str] = Query(None, alias="eventType"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Movie).where(Movie.is_active == True)
    if event_type and event_type.upper() != "ALL":
        query = query.where(Movie.event_type == event_type.upper())
    if search:
        query = query.where(
            or_(
                Movie.title.ilike(f"%{search}%"),
                Movie.language.ilike(f"%{search}%"),
            )
        )
    result = await db.execute(query.order_by(Movie.title))
    movies = result.scalars().all()
    return [EventResponse.model_validate(m) for m in movies]


@router.get("/{id}", response_model=EventResponse)
async def get_event(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventResponse.model_validate(movie)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    movie = Movie(
        title=event_in.title,
        description=event_in.description,
        event_type=event_in.event_type.upper(),
        duration=event_in.duration,
        genre=event_in.genre or [],
        language=event_in.language,
        rating=event_in.rating,
        poster_url=event_in.poster_url,
        trailer_url=event_in.trailer_url,
        is_active=event_in.is_active,
    )
    db.add(movie)
    await db.commit()
    await db.refresh(movie)
    return EventResponse.model_validate(movie)


@router.put("/{id}", response_model=EventResponse)
async def update_event(
    id: str,
    event_in: EventUpdate,
    current_user: User = Depends(require_role("ORGANISER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Movie).where(Movie.id == id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, val in event_in.model_dump(exclude_unset=True).items():
        if field == "event_type" and val:
            val = val.upper()
        setattr(movie, field, val)

    await db.commit()
    await db.refresh(movie)
    return EventResponse.model_validate(movie)
