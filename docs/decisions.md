# TicketFlow — Architecture Decision Records (ADRs)

## ADR-001: Database-Authoritative Concurrency Protection
- **Status**: Accepted
- **Decision**: Prevent double-bookings via PostgreSQL partial unique index `ix_booking_seats_show_seat_active` and `SELECT ... FOR UPDATE` row locks instead of in-memory application mutexes.
- **Rationale**: Guarantees zero double bookings across multiple instances.

## ADR-002: Physical VenueSeat vs. Runtime EventSeat Separation
- **Status**: Accepted
- **Decision**: Maintain physical coordinates and seat metadata in `seats` table, computing runtime availability on the fly from `shows`, `seat_holds`, and `booking_seats`.
- **Rationale**: Prevents physical seats from permanently locking across different showtimes.

## ADR-003: Lightweight In-Process Async Sweeper
- **Status**: Accepted
- **Decision**: Use an asyncio in-process background worker for seat hold and waitlist TTL expirations rather than heavy message brokers (Celery/Redis/Kafka).
- **Rationale**: Minimal infrastructure overhead, zero external broker dependencies, fast local setup.\n