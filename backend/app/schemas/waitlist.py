from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.booking import BookingResponse


class WaitlistJoinRequest(BaseModel):
    show_id: str
    seat_type_id: str


class WaitlistResponse(BaseModel):
    id: str
    user_id: str
    show_id: str
    seat_type_id: str
    status: str
    offered_seat_id: Optional[str] = None
    offer_expires_at: Optional[datetime] = None
    queue_position: Optional[int] = None
    is_offer_expired: Optional[bool] = False
    created_at: datetime
    show: Optional[Dict[str, Any]] = None
    seat_type: Optional[Dict[str, Any]] = None
    offered_seat: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class WaitlistClaimResponse(BaseModel):
    message: str
    booking: BookingResponse
