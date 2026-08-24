# TicketFlow — Concurrency Architecture & Double-Booking Prevention

## 1. Concurrency Problem Statement

In high-demand ticket sales (e.g. blockbuster movie premiere or stadium concert), hundreds of concurrent customers may attempt to select, hold, and purchase the exact same high-value seat (e.g. Row C, Seat 8) at the exact same millisecond.

A naive implementation that relies on:
1. Application-level memory locks (e.g. Node.js variables or Python threading locks),
2. Single-container memory, or
3. Application-level "check-then-act" queries without database transactions (`SELECT status; if (status == AVAILABLE) UPDATE ...`)

**WILL FAIL catastrophically under concurrent load**, leading to race conditions where two customers both receive confirmation for the same physical seat.

---

## 2. Theoretical Scenario & Race Condition Analysis

### The Flawed Flow (Double-Booking Vulnerability)
```
  Customer A                             Database                             Customer B
      │                                     │                                     │
  (1) ├─────── Check Seat A1 Available? ────>│                                     │
      │                                     │<────── Check Seat A1 Available? ────┤ (2)
      │<────── Return "AVAILABLE" ──────────┤                                     │
      │                                     ├─────── Return "AVAILABLE" ─────────>│
  (3) ├─────── Book Seat A1 ───────────────>│                                     │
      │                                     │<────── Book Seat A1 ────────────────┤ (4)
      │<────── Booking Confirmed! ──────────┤                                     │
      │                                     ├─────── Booking Confirmed! ─────────>│ (DOUBLE BOOKING)
```

In the naive scenario, both requests read the state before either writes back the new state.

---

## 3. TicketFlow Concurrency Control Strategy

TicketFlow prevents double-booking through a multi-layered database-authoritative model:

```
+-----------------------------------------------------------------------------+
| Layer 1: PostgreSQL ACID Transactions (ISOLATION LEVEL / ATOMICITY)         |
| All hold checks, price calculations, hold creation, and bookings run within |
| an atomic database transaction (`prisma.$transaction`).                      |
+-----------------------------------------------------------------------------+
                                      │
                                      v
+-----------------------------------------------------------------------------+
| Layer 2: Relational Unique Integrity Constraints                            |
| * `seat_holds`: UNIQUE(seatId, showId)                                      |
| * `booking_seats`: UNIQUE(bookingId, seatId)                                |
| The database engine rejects duplicate insert attempts at the storage level. |
+-----------------------------------------------------------------------------+
                                      │
                                      v
+-----------------------------------------------------------------------------+
| Layer 3: Atomic Conditional Evaluation During Hold & Checkout               |
| When Customer A and Customer B simultaneously attempt to hold/book Seat A1: |
| 1. The transaction checks for existing active holds (`expiresAt > NOW()`).  |
| 2. The transaction checks for existing confirmed bookings.                  |
| 3. If any conflict exists, the transaction throws and rolls back cleanly.   |
| 4. Database upsert / unique lock ensures only one write succeeds.          |
+-----------------------------------------------------------------------------+
```

---

## 4. Detailed Sequence: Simultaneous Hold Acquisition

When **Customer A** (Session 1) and **Customer B** (Session 2) simultaneously request a 5-minute hold on Seat A1 for Show 101:

```
Customer A (Session 1)                   PostgreSQL Server                Customer B (Session 2)
        │                                        │                                   │
        │─── BEGIN TRANSACTION ─────────────────>│                                   │
        │                                        │<─── BEGIN TRANSACTION ────────────│
        │─── Check Existing Confirmed Bookings ─>│                                   │
        │                                        │<─── Check Existing Confirmed Bookings
        │─── Check Active Holds (expiresAt>now)─>│                                   │
        │                                        │<─── Check Active Holds ───────────│
        │─── UPSERT seat_holds ─────────────────>│                                   │
        │    (Acquires Unique Constraint Lock)   │                                   │
        │                                        │─── UPSERT seat_holds (BLOCKED) ───>
        │<── Commit Success ─────────────────────┤                                   │
        │                                        │    (Customer A holds lock)        │
        │                                        │<── Evaluates Customer B ──────────┤
        │                                        │    Sees foreign active hold!      │
        │                                        │─── Rollback / Error Returned ────>│
        │<── 200 OK: Hold Granted (5 min TTL)    │                                   │
        │                                        │<── 400 Bad Request: Seat Held ────│
```

---

## 5. Booking Confirmation Concurrency Safety

When confirming a booking:
1. The transaction verifies that every requested seat either:
   - Is actively held by the current user's session (`sessionId` match and `expiresAt > NOW()`), OR
   - Is completely unheld and unbooked.
2. The transaction inserts the booking and `booking_seats` rows.
3. The transaction deletes the corresponding `seat_holds` records.
4. If another customer tries to book or hold in the interim, the transaction fails and rolls back completely without leaving orphan holds or partial reservations.

---

## 6. Multi-Worker & Multi-Instance Scalability

Because concurrency safety is anchored directly in **PostgreSQL transaction semantics and unique table constraints**, the system remains 100% concurrency-safe even when:
- Multiple Node.js backend processes run behind a load balancer (PM2 / Kubernetes / Docker replicas).
- Multiple threads or asynchronous event loops process simultaneous HTTP/WebSocket requests.
- Distributed worker processes execute hold expiration jobs.

No shared in-memory state or distributed lock managers (like Redis Redlock) are required for baseline correctness, keeping the architecture simple, robust, and student-accessible.
