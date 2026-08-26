from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: str = "MOVIE"
    duration: int = 120
    genre: Optional[List[str]] = []
    language: str = "English"
    rating: Optional[str] = "U/A"
    poster_url: Optional[str] = None
    trailer_url: Optional[str] = None
    is_active: bool = True


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    duration: Optional[int] = None
    genre: Optional[List[str]] = None
    language: Optional[str] = None
    rating: Optional[str] = None
    poster_url: Optional[str] = None
    trailer_url: Optional[str] = None
    is_active: Optional[bool] = None


class EventResponse(EventBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
