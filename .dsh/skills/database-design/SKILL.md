---
name: database-design
description: Data modeling, relational integrity, and migration rules for PostgreSQL and Prisma ORM in TicketFlow.
model: inherit
---

# TicketFlow Database Design Skill

## Scope & Purpose
Use when modifying `schema.prisma`, creating new database migrations, adding indexes, or designing relational models.

## Core Rules & Patterns
1. **VenueSeat vs EventSeat Isolation**: NEVER add mutable booking status to the physical `seats` table. Physical seats represent venue architecture; `seat_holds` and `booking_seats` represent per-event runtime state.
2. **Unique Constraints for Concurrency**: Always back anti-double-booking guarantees with database-level composite unique constraints (`UNIQUE(seatId, showId)` on `seat_holds`, `UNIQUE(bookingId, seatId)` on `booking_seats`).
3. **Migration Discipline**: Apply all schema changes using `npx prisma migrate dev` (in development) or `npx prisma migrate deploy` (in production). Never edit SQL migration files after they have been deployed.
4. **Referential Integrity**: Use explicit foreign keys with appropriate `ON DELETE CASCADE` or `ON DELETE RESTRICT` actions to prevent orphan records.
5. **Index Optimization**: Maintain indexes on frequently filtered foreign keys (`showId`, `screenId`, `userId`) and lookup fields (`bookingRef`, `slug`).
