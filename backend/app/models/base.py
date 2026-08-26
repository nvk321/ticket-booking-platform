import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Double,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ORGANISER = "ORGANISER"
    ADMIN = "ADMIN"
    # Legacy alias mapping
    USER = "CUSTOMER"
    THEATRE_ADMIN = "ORGANISER"
    SUPER_ADMIN = "ADMIN"


class EventType(str, enum.Enum):
    MOVIE = "MOVIE"
    CONCERT = "CONCERT"
    PLAY = "PLAY"
    STANDUP = "STANDUP"


class SeatPhysicalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    MAINTENANCE = "MAINTENANCE"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class WaitlistStatus(str, enum.Enum):
    PENDING = "PENDING"
    OFFER_PENDING = "OFFER_PENDING"
    FULFILLED = "FULFILLED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


# ==========================================
# MODELS
# ==========================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="CUSTOMER", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    theatres: Mapped[List["Theatre"]] = relationship("Theatre", back_populates="admin")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="user")
    waitlists: Mapped[List["Waitlist"]] = relationship("Waitlist", back_populates="user")


class Theatre(Base):
    __tablename__ = "theatres"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="India")
    admin_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    accent_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    admin: Mapped[Optional["User"]] = relationship("User", back_populates="theatres")
    screens: Mapped[List["Screen"]] = relationship("Screen", back_populates="theatre", cascade="all, delete-orphan")


class Screen(Base):
    __tablename__ = "screens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    theatre_id: Mapped[str] = mapped_column(String, ForeignKey("theatres.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    cols: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("theatre_id", "name", name="uq_screen_theatre_name"),
    )

    # Relationships
    theatre: Mapped["Theatre"] = relationship("Theatre", back_populates="screens")
    seats: Mapped[List["Seat"]] = relationship("Seat", back_populates="screen", cascade="all, delete-orphan")
    shows: Mapped[List["Show"]] = relationship("Show", back_populates="screen", cascade="all, delete-orphan")
    pricing: Mapped[List["ScreenPricing"]] = relationship("ScreenPricing", back_populates="screen", cascade="all, delete-orphan")


class SeatType(Base):
    __tablename__ = "seat_types"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#4f46e5")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    seats: Mapped[List["Seat"]] = relationship("Seat", back_populates="seat_type")
    screen_pricing: Mapped[List["ScreenPricing"]] = relationship("ScreenPricing", back_populates="seat_type")
    waitlists: Mapped[List["Waitlist"]] = relationship("Waitlist", back_populates="seat_type")


class Seat(Base):
    __tablename__ = "seats"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    screen_id: Mapped[str] = mapped_column(String, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    seat_type_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("seat_types.id", ondelete="SET NULL"), nullable=True)
    row: Mapped[int] = mapped_column(Integer, nullable=False)
    col: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    row_label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    is_golden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("screen_id", "row", "col", name="uq_seat_screen_row_col"),
        UniqueConstraint("screen_id", "label", name="uq_seat_screen_label"),
    )

    # Relationships
    screen: Mapped["Screen"] = relationship("Screen", back_populates="seats")
    seat_type: Mapped[Optional["SeatType"]] = relationship("SeatType", back_populates="seats")
    holds: Mapped[List["SeatHold"]] = relationship("SeatHold", back_populates="seat", cascade="all, delete-orphan")
    booking_seats: Mapped[List["BookingSeat"]] = relationship("BookingSeat", back_populates="seat")


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(String, default="MOVIE", nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    genre: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    language: Mapped[str] = mapped_column(String, default="English", nullable=False)
    rating: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    poster_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    trailer_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    shows: Mapped[List["Show"]] = relationship("Show", back_populates="movie", cascade="all, delete-orphan")


class Show(Base):
    __tablename__ = "shows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    screen_id: Mapped[str] = mapped_column(String, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    movie_id: Mapped[str] = mapped_column(String, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    available_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    available_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    screen: Mapped["Screen"] = relationship("Screen", back_populates="shows")
    movie: Mapped["Movie"] = relationship("Movie", back_populates="shows")
    holds: Mapped[List["SeatHold"]] = relationship("SeatHold", back_populates="show", cascade="all, delete-orphan")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="show", cascade="all, delete-orphan")
    waitlists: Mapped[List["Waitlist"]] = relationship("Waitlist", back_populates="show", cascade="all, delete-orphan")


class ScreenPricing(Base):
    __tablename__ = "screen_pricing"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    screen_id: Mapped[str] = mapped_column(String, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    seat_type_id: Mapped[str] = mapped_column(String, ForeignKey("seat_types.id", ondelete="CASCADE"), nullable=False)
    base_price: Mapped[float] = mapped_column(Float, nullable=False)
    weekend_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    peak_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("screen_id", "seat_type_id", name="uq_screen_pricing_tier"),
    )

    # Relationships
    screen: Mapped["Screen"] = relationship("Screen", back_populates="pricing")
    seat_type: Mapped["SeatType"] = relationship("SeatType", back_populates="screen_pricing")


class SeatHold(Base):
    __tablename__ = "seat_holds"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    seat_id: Mapped[str] = mapped_column(String, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    show_id: Mapped[str] = mapped_column(String, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("seat_id", "show_id", name="uq_seat_holds_seat_show"),
    )

    # Relationships
    seat: Mapped["Seat"] = relationship("Seat", back_populates="holds")
    show: Mapped["Show"] = relationship("Show", back_populates="holds")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    booking_ref: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    show_id: Mapped[str] = mapped_column(String, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default="CONFIRMED", nullable=False)
    qr_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="MOCK")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="bookings")
    show: Mapped["Show"] = relationship("Show", back_populates="bookings")
    seats: Mapped[List["BookingSeat"]] = relationship("BookingSeat", back_populates="booking", cascade="all, delete-orphan")
    payment: Mapped[Optional["Payment"]] = relationship("Payment", back_populates="booking", uselist=False, cascade="all, delete-orphan")


class BookingSeat(Base):
    __tablename__ = "booking_seats"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    booking_id: Mapped[str] = mapped_column(String, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    seat_id: Mapped[str] = mapped_column(String, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    show_id: Mapped[str] = mapped_column(String, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("booking_id", "seat_id", name="uq_booking_seats_booking_seat"),
        # Anti-double-booking partial index created in DB/Alembic:
        # UNIQUE (show_id, seat_id) WHERE is_cancelled = false
        Index("ix_booking_seats_show_seat_active", "show_id", "seat_id", unique=True, postgresql_where=(is_cancelled == False)),
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="seats")
    seat: Mapped["Seat"] = relationship("Seat", back_populates="booking_seats")
    show: Mapped["Show"] = relationship("Show")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    booking_id: Mapped[str] = mapped_column(String, ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String, default="SUCCESS", nullable=False)
    gateway: Mapped[Optional[str]] = mapped_column(String, default="MOCK", nullable=True)
    gateway_ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="payment")


class Waitlist(Base):
    __tablename__ = "waitlists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    show_id: Mapped[str] = mapped_column(String, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    seat_type_id: Mapped[str] = mapped_column(String, ForeignKey("seat_types.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False, index=True)
    offered_seat_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("seats.id", ondelete="SET NULL"), nullable=True)
    offer_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="waitlists")
    show: Mapped["Show"] = relationship("Show", back_populates="waitlists")
    seat_type: Mapped["SeatType"] = relationship("SeatType", back_populates="waitlists")
    offered_seat: Mapped[Optional["Seat"]] = relationship("Seat")
