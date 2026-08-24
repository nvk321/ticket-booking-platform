# TicketFlow — Category-Based Waitlist Architecture & Reassignment

## 1. Objectives & Business Context

When high-demand shows (movies or concerts) sell out in specific seat categories (e.g. all Royal or Balcony seats are booked), customers can join a **category-specific waitlist**.

When a confirmed booking is cancelled, TicketFlow's waitlist engine automatically detects newly freed seats and offers them to the next eligible customer in strict **First-In, First-Out (FIFO)** order with a **time-limited offer**.

---

## 2. Core Functional Requirements

1. **Category Scoping**: Waitlists are partitioned by `(eventId/showId, seatTypeId)`. A user waiting for a "Balcony" ticket is not offered a "Second Class" ticket unless they registered for that category.
2. **Duplicate Prevention**: A user cannot register multiple active waitlist entries for the exact same event and category.
3. **Strict FIFO Queue Ordering**: Queue priority is governed by registration timestamp (`createdAt ASC`).
4. **Time-Limited Offers**: When a seat frees up, the candidate receives an exclusive time-limited offer (governed by `WAITLIST_OFFER_TTL_MINUTES`, e.g. 15 minutes).
5. **Cascading Reassignment**: If the customer fails to claim or explicitly declines the offer before it expires, the offer transitions to `EXPIRED` and the seat is automatically offered to the next waitlisted user.

---

## 3. Waitlist State Machine

```
              +-------------------------------------+
              | Customer Joins Waitlist for Category|
              +------------------+------------------+
                                 │
                                 v
                     [ Status: PENDING IN QUEUE ]
                                 │
                 Ticket Cancelled / Seat Freed
                                 │
                                 v
                     [ Status: OFFER_PENDING ]
                     (Hold reserved for user)
                                 │
        ┌────────────────────────┴────────────────────────┐
        │                                                 │
 User Accepts Offer                               Offer TTL Expires /
 (POST /waitlist/claim)                           User Declines
        │                                                 │
        v                                                 v
 [ Status: FULFILLED ]                            [ Status: EXPIRED ]
 (Booking Created & Confirmed)                            │
                                                  Trigger Next Waitlist Candidate
                                                          │
                                                          v
                                                  [ Status: OFFER_PENDING ]
```

---

## 4. Reassignment Workflow on Cancellation

```
1. Customer A initiates booking cancellation:
   PATCH /api/bookings/:id/cancel
   
2. Database transaction:
   a. Updates Booking status to CANCELLED.
   b. Marks Payment as REFUNDED.
   c. Identifies freed seat categories and count.

3. Waitlist Orchestrator:
   a. Queries earliest PENDING waitlist entry for (showId, seatTypeId) with `FOR UPDATE SKIP LOCKED`.
   b. If candidate exists:
      - Creates a temporary exclusive `SeatHold` for candidate with `expiresAt = NOW() + WAITLIST_OFFER_TTL_MINUTES`.
      - Updates waitlist entry to `OFFER_PENDING`.
      - Dispatches notification / email to customer with one-click claim URL.
   c. If no waitlist candidate exists:
      - Emits `seats:released` via WebSocket, returning seat to public `AVAILABLE` inventory.
```

---

## 5. Concurrency & Fairness Guarantees

- **Transactional FIFO Lock**: Waitlist claims use atomic transactional locking to prevent two waitlist candidates from receiving the same cancelled seat.
- **Expiry Cleanup Job**: A scheduled background job runs periodically to sweep `OFFER_PENDING` entries where `offerExpiresAt < NOW()`, marking them `EXPIRED` and triggering the next candidate evaluation.
