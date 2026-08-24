# TicketFlow — Seat Hold & TTL (Time-To-Live) Architecture

## 1. Objective & Business Rules

During the checkout process, customers need a reasonable window of time (e.g. 5 minutes) to review their selection, enter attendee information, and submit payment. However, if customers abandon their shopping cart or close their browser, held seats must not remain locked indefinitely.

**Core Rules**:
1. **Configurable TTL**: Hold duration is governed by environment configuration (`SEAT_HOLD_TTL_MINUTES`, defaulting to 5 minutes) rather than hardcoded magic constants.
2. **Session & User Scoping**: A hold is tied to a specific customer session identifier (`sessionId`) or authenticated user.
3. **Automatic Cleanup & Re-release**: Expired holds must be evicted promptly and returned to the pool of `AVAILABLE` seats.
4. **Authoritative Expiration**: The backend/database timestamp (`expiresAt`), NOT client system clocks, determines hold validity.

---

## 2. Hold Lifecycle State Progression

```
[ Customer clicks seat ]
        │
        ▼
   seats:hold (WebSocket/REST)
        │
        ├────────────────────────────────────────────────┐
        ▼                                                ▼
[ Validation Success ]                           [ Validation Failure ]
* Seat is AVAILABLE                              * Seat is already BOOKED
* No foreign hold active                         * Seat is held by another user
        │                                                │
        ▼                                                ▼
[ Insert / Upsert `seat_holds` ]                 [ Error Returned to Client ]
* `expiresAt = NOW() + TTL`
* `sessionId = client.sessionId`
        │
        ├────────────────────────────────────────────────┐
        ▼                                                ▼
[ Checkout Completed in Time ]                   [ Time-To-Live (TTL) Expires ]
* User submits POST /api/bookings                * Sweeper job identifies expired hold
* Transaction confirms booking                   * Record deleted from `seat_holds`
* Hold converted to `booking_seats`              * Real-time `seats:holdExpired` event
* Broadcast `seats:booked`                       * Seat becomes `AVAILABLE`
```

---

## 3. Hold Expiration Mechanisms

TicketFlow employs a dual-strategy for hold eviction:

### A. Active Background Sweeper
- A lightweight server-side background interval (running every 30 seconds) queries PostgreSQL for holds where `expiresAt < NOW()`.
- Expired holds are deleted in batch.
- A WebSocket broadcast (`seats:holdExpired`) notifies all active clients viewing that event's seat map, updating UI seat colors immediately.

### B. Passive / Opportunistic Expiration
- During any seat lookup (`GET /api/shows/:id/seats`) or booking attempt (`POST /api/bookings`), queries filter holds using `expiresAt > NOW()`.
- Even if the periodic background job has not run yet, any hold whose timestamp has passed is considered legally available.

---

## 4. Edge Cases & Race Conditions

### 1. Checkout Attempt at the Moment of Expiration
- **Scenario**: Customer clicks "Pay Now" with 1 second remaining, but network latency causes the request to arrive 2 seconds later.
- **Handling**: The database transaction checks `expiresAt > NOW()`. If expired, the transaction aborts with a clear error: `"Hold expired — please reselect your seats"`. The customer is not charged.

### 2. Client Disconnection / Tab Closure
- **Scenario**: Customer closes their browser window while holding 4 seats.
- **Handling**: The WebSocket `disconnect` event captures the socket ID and immediately purges all active holds associated with that `sessionId`, broadcasting `seats:released` to other shoppers without waiting for the full 5-minute TTL.

### 3. Clock Skew Resilience
- Expiration checks are computed using PostgreSQL server time (`CURRENT_TIMESTAMP` / UTC), preventing client-side clock tampering.
