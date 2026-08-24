---
name: testing
description: Testing strategy and validation patterns for unit, integration, and concurrent booking scenarios in TicketFlow.
model: inherit
---

# TicketFlow Testing Skill

## Scope & Purpose
Use when writing tests, validating business logic, simulating concurrent seat holds, or verifying API behaviors.

## Core Rules & Patterns
1. **Realistic Concurrency Testing**: When testing race conditions and double booking, use actual PostgreSQL transactions with concurrent asynchronous promises rather than artificial single-threaded mocks.
2. **Key Test Priority Matrix**:
   - Simultaneous seat-hold attempts on the exact same seat.
   - Simultaneous booking confirmation on the exact same seat.
   - Expired hold eviction and automatic re-availability.
   - Checkout attempts on expired holds (rejection verification).
   - Cancellation lifecycle and refund status updates.
   - FIFO waitlist priority order preservation upon cancellation.
   - Time-limited waitlist offer expiration and automatic cascading.
3. **Role Authorization Checks**: Verify that unauthorized customers cannot access organiser analytics or create screens/shows.
