from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SeatTypeResponse(BaseModel):
    id: str
    name: str
    color: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SeatResponse(BaseModel):
    id: str
    screen_id: str
    seat_type_id: Optional[str] = None
    row: int
    col: int
    label: str
    row_label: Optional[str] = None
    status: str
    is_golden: bool
    is_accessible: bool
    custom_price: Optional[float] = None
    seat_type: Optional[SeatTypeResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ScreenBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    capacity: int = 0
    rows: int = 10
    cols: int = 15


class ScreenCreate(ScreenBase):
    theatre_id: str


class ScreenUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    rows: Optional[int] = None
    cols: Optional[int] = None


class ScreenPricingItem(BaseModel):
    seat_type_id: str
    base_price: float
    weekend_price: Optional[float] = None
    peak_price: Optional[float] = None


class ScreenPricingUpdate(BaseModel):
    pricing: List[ScreenPricingItem]


class SeatLayoutItem(BaseModel):
    row: int
    col: int
    label: str
    row_label: Optional[str] = None
    seat_type_id: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    is_golden: Optional[bool] = False
    is_accessible: Optional[bool] = False
    custom_price: Optional[float] = None


class LayoutSaveRequest(BaseModel):
    rows: int
    cols: int
    seats: List[SeatLayoutItem]


class TheatreSummary(BaseModel):
    id: str
    name: str
    city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ScreenResponse(ScreenBase):
    id: str
    theatre_id: str
    created_at: datetime
    updated_at: datetime
    theatre: Optional[TheatreSummary] = None
    seats: Optional[List[SeatResponse]] = None

    model_config = ConfigDict(from_attributes=True)
