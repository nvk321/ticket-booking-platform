from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.event import EventResponse
from app.schemas.screen import ScreenResponse, SeatResponse


class ShowCreate(BaseModel):
    screen_id: str
    movie_id: str
    start_time: datetime
    end_time: datetime
    available_from: Optional[datetime] = None
    available_to: Optional[datetime] = None


class CategoryAvailabilityStat(BaseModel):
    seat_type_id: str
    seat_type_name: str
    color: str
    total: int
    available: int
    held: int
    booked: int
    is_sold_out: bool


class ShowResponse(BaseModel):
    id: str
    screen_id: str
    movie_id: str
    start_time: datetime
    end_time: datetime
    is_active: bool
    created_at: datetime
    movie: Optional[EventResponse] = None
    screen: Optional[ScreenResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ShowSeatStatus(BaseModel):
    id: str
    screen_id: str
    seat_type_id: Optional[str] = None
    row: int
    col: int
    label: str
    row_label: Optional[str] = None
    status: str  # AVAILABLE, HELD, BOOKED, BLOCKED
    is_golden: bool
    is_accessible: bool
    price: float
    seat_type: Optional[Dict[str, Any]] = None


class ShowSeatsResponse(BaseModel):
    id: str
    screen_id: str
    movie_id: str
    start_time: datetime
    end_time: datetime
    is_active: bool
    movie: EventResponse
    screen: Dict[str, Any]
    category_stats: List[CategoryAvailabilityStat]

    model_config = ConfigDict(from_attributes=True)
