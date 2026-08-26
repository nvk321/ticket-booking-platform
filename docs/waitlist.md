# TicketFlow — Category Waitlist & Reassignment Engine

## 1. Overview
TicketFlow implements category-based FIFO waitlists that automatically reallocate freed seats when bookings are cancelled.

## 2. Key Workflow
1. **Join**: Customer joins waitlist for a specific show and seat tier (`POST /api/v1/waitlist/join`).
2. **Queue Position**: Calculated on demand via `COUNT(*) WHERE created_at <= entry.created_at`.
3. **Cancellation Trigger**: When a booking is cancelled, `WaitlistService.cascade_next_offer` locates the oldest `PENDING` waitlist entry using `SKIP LOCKED`.
4. **Time-Limited Offer**: The candidate receives an exclusive `SeatHold` valid for `WAITLIST_OFFER_TTL_MINUTES` (15 minutes), and an email notification with one-click claim instructions.
5. **Claim or Expire**: If claimed before expiry, the ticket is confirmed; if expired, the sweeper marks the entry `EXPIRED` and cascades the offer to the next in queue.\n