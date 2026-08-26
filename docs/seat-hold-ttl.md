# TicketFlow — Seat Hold & TTL Specification

## 1. Overview
Seat holds provide customers a dedicated 5-minute checkout window (`SEAT_HOLD_TTL_MINUTES = 5`) without permanently locking venue inventory.

## 2. Lifecycle States
1. **Created**: When a user selects seats, `POST /api/v1/bookings/hold` creates records in `seat_holds` with `expires_at = NOW() + 5 minutes`.
2. **Synchronized**: WebSockets broadcast `seats:held` to all users in the show room.
3. **Confirmed**: Upon successful checkout, `seat_holds` are deleted and `booking_seats` are inserted.
4. **Expired**: If unconfirmed after 5 minutes, the background sweeper deletes the hold and broadcasts `seats:holdExpired`.
5. **Released**: If the user deselects seats, `POST /api/v1/bookings/release` deletes the hold immediately.\n