from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class BookingSeatCreate(BaseModel):
    seat_id: str
    price: float


class BookingCreateRequest(BaseModel):
    show_id: str
    seat_ids: List[str]
    session_id: str


class BookingSeatResponse(BaseModel):
    id: str
    seat_id: str
    price: float
    is_cancelled: bool
    seat: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentResponse(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    gateway: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingResponse(BaseModel):
    id: str
    booking_ref: str
    user_id: str
    show_id: str
    total_amount: float
    status: str
    qr_code: Optional[str] = None
    created_at: datetime
    seats: List[BookingSeatResponse] = []
    show: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None
    payment: Optional[PaymentResponse] = None

    model_config = ConfigDict(from_attributes=True)


class HoldRequest(BaseModel):
    show_id: str
    seat_ids: List[str]
    session_id: str


class ReleaseRequest(BaseModel):
    show_id: str
    seat_ids: List[str]
    session_id: str
