from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TheatreBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    slug: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    primary_color: Optional[str] = "#e11d48"
    accent_color: Optional[str] = "#f59e0b"
    is_active: bool = True


class TheatreCreate(TheatreBase):
    admin_id: Optional[str] = None


class TheatreUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    is_active: Optional[bool] = None


class TheatreResponse(TheatreBase):
    id: str
    admin_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    screens: Optional[List[dict]] = None

    model_config = ConfigDict(from_attributes=True)
