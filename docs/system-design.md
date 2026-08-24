# TicketFlow — System Design Document

## 1. System Overview & Problem Statement

**TicketFlow** is a distributed, real-time ticket booking platform designed for movies, concerts, and live entertainment. High-demand events suffer from two core failure modes:
1. **Severe Concurrency Contention**: Hundreds of concurrent users compete for the same premier seats, causing double bookings and race conditions.
2. **Inventory Wastage**: Abandoned checkout carts lock seats indefinitely, while event cancellations leave valuable seats unused even when hundreds of customers desire tickets.

TicketFlow solves these challenges through database-authoritative concurrency control, time-to-live (TTL) temporary seat holds, real-time WebSocket synchronization, and automated FIFO category-based waitlists with time-limited offer cascading.

---

## 2. Seat Hold and Time-To-Live (TTL) Mechanism

When a customer selects seats on the interactive visual map, the platform initiates a temporary hold to grant the user a dedicated checkout window:
- **Configurable TTL**: The hold duration is governed by `SEAT_HOLD_TTL_MINUTES` (default: 5 minutes) defined in environment variables.
- **Session Scoping & Persistence**: Holds are stored in PostgreSQL (`seat_holds`) with a composite unique key `(seatId, showId)` and an absolute UTC timestamp `expiresAt`.
- **Hybrid Expiration Architecture**:
  - *Active Sweeper*: A lightweight background worker runs every 30 seconds, purging expired records (`expiresAt < NOW()`) and broadcasting a `seats:holdExpired` WebSocket event to update all active client seat maps immediately.
  - *Passive Verification*: All seat retrieval (`GET /api/shows/:id/seats`) and booking confirmation (`POST /api/bookings`) queries evaluate `expiresAt > NOW()` on the fly, ensuring expired holds can never be checked out even before the background sweeper executes.
- **Socket Disconnect Handling**: When a customer abruptly disconnects or closes their tab, the WebSocket gateway catches the disconnect event and promptly purges the user's unconfirmed holds.

---

## 3. Concurrency Protection & Anti-Double-Booking Architecture

Preventing double bookings under intense concurrent traffic is the system's highest correctness requirement.

### Why In-Memory and Application-Level Locks Fail
In-memory locks (such as JavaScript mutexes or Python threading locks) and single-container memory models fail in multi-worker or multi-container deployments. Similarly, naive "check availability then insert" application-level code suffers from race conditions where two simultaneous transactions both observe `AVAILABLE` before either commits.

### PostgreSQL Database as the Single Source of Truth
TicketFlow guarantees consistency at the storage engine level:
1. **ACID Transaction Wrapping**: Hold creation and checkout operations are executed inside atomic PostgreSQL transactions (`prisma.$transaction`).
2. **Storage Unique Constraints**: The `seat_holds` table enforces `UNIQUE(seatId, showId)`, while `booking_seats` enforces `UNIQUE(bookingId, seatId)`.
3. **Simultaneous Hold Walkthrough**:
   - Customer A and Customer B submit hold requests for Seat A1 at the exact same millisecond.
   - Transaction A and Transaction B begin concurrently.
   - Transaction A acquires the database row lock/upsert on `(seatId, showId)`.
   - Transaction A verifies that no active booking or foreign hold exists, writes `expiresAt = NOW() + TTL`, and commits.
   - Transaction B attempts the same write; the database enforces isolation, and Transaction B observes the active hold created by Customer A.
   - Transaction B aborts cleanly and returns HTTP `400 Bad Request` ("Seat is held by another user").
   - Result: Exactly one customer receives the hold; zero double bookings occur.

---

## 4. Category-Based Waitlist & Automated Reassignment Engine

When a show sells out in a specific seat tier (e.g. Royal, Balcony, Standard), users can join an event- and category-specific waitlist.

### FIFO Priority Queue
Waitlist entries are partitioned by `(showId, seatTypeId)` and sorted strictly by registration timestamp (`createdAt ASC`). Unique constraints prevent a single user from inserting duplicate entries in the same queue.

### Automated Reassignment on Cancellation
When a customer cancels a confirmed booking:
1. The booking record is marked `CANCELLED` and payment is set to `REFUNDED` inside a database transaction.
2. The waitlist engine queries the oldest `PENDING` waitlist entry for the freed seat's category using transactional row locking (`FOR UPDATE SKIP LOCKED`).
3. If an eligible customer is found:
   - A dedicated `SeatHold` is created for that user with an expiration deadline of `NOW() + WAITLIST_OFFER_TTL_MINUTES` (default: 15 minutes).
   - The waitlist status transitions to `OFFER_PENDING`.
   - An email/push notification is dispatched to the user containing a secure one-click checkout link.
4. If no waitlisted customer exists, the seat status is emitted via WebSocket as `AVAILABLE` for general public booking.

### Time-Limited Offer Expiration & Cascading
If the waitlisted customer does not accept the offer before `WAITLIST_OFFER_TTL_MINUTES` elapses:
1. The background expiration job marks the offer as `EXPIRED`.
2. The hold is revoked and the engine automatically cascades the opportunity to the next eligible customer in the FIFO queue.
3. This process repeats until the seat is claimed or the queue is exhausted.

---

## 5. Summary of Architecture Benefits

- **Correctness**: Zero double-booking risk guaranteed by PostgreSQL transactions and unique indexes.
- **Fairness**: Strict FIFO waitlists with automated offer cascading upon cancellation.
- **Efficiency**: Minimal infrastructure overhead without heavy distributed message brokers.
- **Real-Time Responsiveness**: Instantaneous seat state reflection across all connected clients via WebSockets.
