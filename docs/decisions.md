# TicketFlow — Architecture Decision Records (ADR)

## ADR-001: Monorepo Architecture with Decoupled Services
- **Status**: Accepted
- **Context**: The project consists of a backend API server, database migration layer, and an interactive single-page React frontend.
- **Decision**: Keep backend and frontend in a unified repository with clear folder separation (`backend/`, `frontend/`, `docs/`) and root-level Docker orchestration.
- **Consequences**: Easy local development, atomic commits across full-stack features, simplified CI/CD.

---

## ADR-002: Technology Stack Selection (Node.js/Express + Prisma vs FastAPI)
- **Status**: Accepted (Compatible Stack Preserved)
- **Context**: The workspace contained a fully functioning, high-quality Node.js/Express + Prisma ORM + Socket.io backend and React + Vite frontend.
- **Decision**: Preserve and standardize the existing compatible Node.js/Express + Prisma + PostgreSQL + Socket.io architecture rather than performing a high-risk, destructive full rewrite.
- **Consequences**: Preserves working visual layout builders, real-time WebSocket infrastructure, and Prisma migrations while keeping the system lightweight, maintainable, and student-accessible.

---

## ADR-003: Database-Centric Concurrency Control & Unique Integrity Constraints
- **Status**: Accepted
- **Context**: Preventing double bookings under simultaneous customer requests is the highest-priority architectural requirement.
- **Decision**: Reject reliance on single-process in-memory locks or frontend state. Use PostgreSQL ACID transactions with composite unique constraints (`UNIQUE(seatId, showId)` on `seat_holds` and `UNIQUE(bookingId, seatId)` on `booking_seats`) and atomic verification logic.
- **Consequences**: Absolute correctness under concurrent load across multiple backend workers without requiring complex distributed lock managers like Redis Redlock.

---

## ADR-004: VenueSeat vs EventSeat Domain Separation
- **Status**: Accepted
- **Context**: Physical venues host multiple events and showtimes over time. Storing global booking status directly on physical seats creates race conditions and prevents historical audits.
- **Decision**: Distinguish physical `VenueSeat` (`seats` table) from per-event availability (`shows`, `seat_holds`, and `booking_seats`).
- **Consequences**: The seat map status for any given event is dynamically computed by evaluating confirmed bookings and active unexpired holds against the immutable venue layout.

---

## ADR-005: Hybrid Hold Expiration Strategy (Background Sweeper + Opportunistic Check)
- **Status**: Accepted
- **Context**: Temporary seat holds have a 5-minute TTL (`SEAT_HOLD_TTL_MINUTES`). Abandoned holds must be returned to inventory.
- **Decision**: Implement a 30-second server-side interval sweeper that deletes expired `seat_holds` and emits `seats:holdExpired` via WebSockets, supplemented by `expiresAt > NOW()` query filters on all API operations.
- **Consequences**: Zero stale holds even if the background timer experiences minor jitter, and instantaneous UI updates for active shoppers.

---

## ADR-006: Category-Specific FIFO Waitlist Design
- **Status**: Accepted
- **Context**: Sold-out events require an orderly queue where cancellations trigger automatic reassignment.
- **Decision**: Partition waitlists by `(showId, seatTypeId)` ordered by `createdAt ASC` (strict FIFO), granting candidates a time-limited hold (`WAITLIST_OFFER_TTL_MINUTES`) upon cancellation before cascading to the next user.
- **Consequences**: Fair distribution of high-demand seats, automated inventory recovery, and zero manual intervention required by organisers.

---

## ADR-007: Docker Compose for Database Infrastructure
- **Status**: Accepted
- **Context**: Developers need a reliable, identical PostgreSQL 16 database without installing native database servers.
- **Decision**: Provide a clean `docker-compose.yml` defining the `postgres:16-alpine` service with persistent named volumes and automated healthchecks.
- **Consequences**: Single-command startup (`docker compose up -d postgres`) across Windows, macOS, and Linux.
