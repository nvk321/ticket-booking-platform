from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ScreenOccupancy(BaseModel):
    screen_id: str
    screen_name: str
    capacity: int
    total_bookings: int
    total_revenue: float
    occupancy_rate: float


class TheatreAnalyticsResponse(BaseModel):
    theatre_id: str
    theatre_name: str
    total_revenue: float
    total_bookings: int
    total_shows: int
    screens: List[ScreenOccupancy]
