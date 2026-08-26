# TicketFlow — Database Schema & Relational Data Model

## 1. Domain Entities & Separation of Concerns

TicketFlow enforces a strict separation between **Physical Venue Layouts** and **Per-Event Runtime Availability**:

1. **Physical Layout Tier**:
   - `theatres`: Venues and auditoriums owned by organisers or admins.
   - `screens`: Auditoriums with grid dimensions (`rows` × `cols`) and physical `capacity`.
   - `seat_types`: Permanent pricing tiers (e.g. VIP, Premium, Standard) with associated colors.
   - `seats`: Physical seat coordinates (`row`, `col`, `label`, `is_golden`, `is_accessible`). Never store runtime booking status directly.
   - `screen_pricing`: Tier pricing rules per screen (base, weekend, peak).

2. **Per-Event Runtime Tier**:
   - `movies`: Event catalog (movies, concerts, plays, standup shows).
   - `shows`: Scheduled event instances linking a `movie` to a `screen` with `start_time` and `end_time`.
   - `seat_holds`: Ephemeral holds with `UNIQUE(seat_id, show_id)` and UTC `expires_at`.
   - `bookings`: Confirmed reservations with `booking_ref`, total amount, and base64 QR code.
   - `booking_seats`: Individual booked seats linking `booking_id`, `seat_id`, and `show_id` with partial unique index `ix_booking_seats_show_seat_active`.
   - `payments`: Transaction records with payment status and gateway reference.
   - `waitlists`: Category-specific FIFO queue entries with `status` (`PENDING`, `OFFER_PENDING`, `FULFILLED`, `EXPIRED`, `CANCELLED`).

---

## 2. Anti-Double-Booking Constraint Definition

```sql
-- Anti-double-booking partial index:
CREATE UNIQUE INDEX ix_booking_seats_show_seat_active 
ON booking_seats (show_id, seat_id) 
WHERE is_cancelled = false;

-- Ephemeral seat hold uniqueness:
ALTER TABLE seat_holds 
ADD CONSTRAINT uq_seat_holds_seat_show UNIQUE (seat_id, show_id);
```\n