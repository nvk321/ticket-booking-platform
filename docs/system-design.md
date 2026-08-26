# TicketFlow — System Design Document

## 1. System Overview
**TicketFlow** is a full-stack, concurrency-safe, real-time ticket booking platform engineered for high-demand entertainment events including movies and live concerts. High-demand ticketing platforms face two fundamental challenges: severe concurrency contention where thousands of users compete for the same physical seats, and inventory stagnation caused by abandoned checkouts or sudden cancellations. TicketFlow solves these challenges using database-authoritative ACID transactions, configurable Time-to-Live (TTL) seat holds, real-time WebSocket state distribution, and an automated category-based FIFO waitlist with cascading offer reassignments.

---

## 2. Seat Hold and Time-To-Live (TTL) Mechanism
When a customer selects seats on the interactive visual map, TicketFlow creates a temporary hold reserving those seats for checkout:
- **Configurable TTL**: Hold duration is configured via `SEAT_HOLD_TTL_MINUTES` (default: 5 minutes) and evaluated strictly in UTC.
- **Session Scoping & Persistence**: Holds are persisted in PostgreSQL (`seat_holds`) with a composite unique constraint `UNIQUE(seat_id, show_id)` and an absolute timestamp `expires_at`.
- **Hybrid Expiration Architecture**:
  - *Active Sweeper*: An asynchronous in-process background worker runs every 30 seconds, purging expired records (`expires_at < NOW()`) and broadcasting `seats:holdExpired` WebSocket events to synchronize client seat grids in real time.
  - *Passive Verification*: Every seat query (`GET /api/v1/shows/{id}/seats`) and checkout attempt evaluates `expires_at > NOW()` on the fly, guaranteeing expired holds cannot be purchased even before the background sweeper executes.

---

## 3. Concurrency Protection & Anti-Double-Booking Architecture
Preventing double bookings under high concurrency is the platform's highest architectural priority.

### Why Application-Level Locks Fail
In-memory locks (such as Python threading mutexes or Node single-threaded variables) fail completely across multi-worker or multi-container deployments. Similarly, naive "check availability then insert" application-level code suffers from race conditions where two simultaneous transactions both observe `AVAILABLE` before either commits.

### Database as the Single Source of Truth
TicketFlow enforces consistency at the database engine level:
1. **Row-Level Locking**: Checkout transactions acquire row-level locks on existing bookings using `SELECT ... FOR UPDATE` before writing new booking seats.
2. **Partial Unique Index**: The `booking_seats` table enforces a database-level partial unique index:
   ```sql
   CREATE UNIQUE INDEX ix_booking_seats_show_seat_active 
   ON booking_seats (show_id, seat_id) 
   WHERE is_cancelled = false;
   ```
3. **Simultaneous Hold & Booking Resolution**:
   - Customer A and Customer B attempt to hold or book the same seat at the exact same millisecond.
   - Both transactions execute concurrently in PostgreSQL.
   - The first transaction commits successfully and acquires the unique slot.
   - The second transaction triggers a unique constraint violation (`IntegrityError`), rolls back cleanly, and returns HTTP `409 Conflict`.
   - Result: Exactly one customer succeeds; double bookings are physically impossible.

---

## 4. Category-Based Waitlist Auto-Assignment & Offer Cascading
When a show sells out in a specific seat tier (e.g., VIP, Premium, Standard), customers can join a category-specific FIFO waitlist.

### Automated Reassignment on Cancellation
When a confirmed booking is cancelled:
1. The booking status is updated to `CANCELLED` and its `booking_seats.is_cancelled` flags are set to `true` within an atomic transaction.
2. For each released seat, the waitlist service queries the next eligible customer from `waitlists` ordered by `(created_at ASC, id ASC)` using `SELECT ... FOR UPDATE SKIP LOCKED`.
3. If an eligible candidate exists:
   - The entry transitions to `OFFER_PENDING` and receives a reserved `SeatHold` expiring in `NOW() + WAITLIST_OFFER_TTL_MINUTES` (default: 15 minutes).
   - An email notification is dispatched containing event details, reserved seat label, and expiration countdown.
   - A WebSocket event `waitlist:offerCreated` is broadcast to notify the user.
4. If no waitlisted user exists, the seat is broadcast as `seats:released` (`AVAILABLE`) for general booking.

### Time-Limited Offer Expiration & Cascading
If the offered user does not claim the ticket before the TTL expires:
1. The background sweeper marks the entry as `EXPIRED`.
2. The engine automatically cascades the freed seat to the next eligible FIFO candidate in line.
3. This cascading loop continues automatically until the seat is claimed or the waitlist queue is exhausted.\n