# TicketFlow — Concurrency & Race Condition Analysis

## 1. Concurrency Scenarios & Formal Guarantees

### Scenario A: Simultaneous Seat Hold
- **Condition**: User A and User B request a hold on the exact same seat (`seat_id`, `show_id`) at the same millisecond.
- **Resolution**: Both requests open transactions in `HoldService.hold_seats`. The `UNIQUE(seat_id, show_id)` constraint on `seat_holds` ensures PostgreSQL accepts the first insert and raises an `IntegrityError` on the second.
- **Outcome**: The winner receives HTTP 200 with hold expiration timestamp; the loser receives HTTP 409 Conflict with `"Some seats are currently held by another user"`.

### Scenario B: Simultaneous Booking / Checkout
- **Condition**: Two requests attempt to confirm bookings for the same seat simultaneously.
- **Resolution**: `BookingService.create_booking` locks active bookings with `SELECT ... FOR UPDATE` and inserts `BookingSeat` with `show_id`. The partial unique index `ix_booking_seats_show_seat_active` guarantees atomicity.
- **Outcome**: Exactly one booking commits; the conflicting transaction rolls back and returns HTTP 409 Conflict.

### Scenario C: Hold Expiration vs. Concurrent Checkout
- **Condition**: A customer attempts checkout at the moment their hold expires, while another customer attempts to hold the same seat.
- **Resolution**: `create_booking` validates `SeatHold.expires_at > NOW()` within the transaction. If expired, checkout is rejected, ensuring no customer can book an expired hold.

### Scenario D: Booking Cancellation vs. Waitlist Cascading
- **Condition**: A booking is cancelled, triggering waitlist cascading.
- **Resolution**: `WaitlistService.cascade_next_offer` uses `SELECT ... FOR UPDATE SKIP LOCKED` on the oldest `PENDING` waitlist entry, ensuring exactly one eligible candidate receives the offer without contention.\n