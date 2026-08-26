# TicketFlow — AI Agent Development Context & Rules

## 1. Project Overview & Identity
- **Project Name**: TicketFlow — Smart Ticket Booking Platform
- **Domain**: High-concurrency ticket booking platform for movies and concerts featuring interactive visual seat maps, real-time WebSocket availability, configurable TTL seat holds, and category-based FIFO waitlists with automated offer cascading.
- **Repository Structure**: Monorepo with `backend/` (FastAPI, SQLAlchemy, Pydantic), `frontend/` (React, Vite, TypeScript), `docs/`, and root `docker-compose.yml`.

---

## 2. Mandatory Rules for Future AI Agents

### Rule 1: Always Inspect Before Modifying
Never assume a feature exists or is missing without inspecting the actual code, schema, and API routes. Always check Git status and existing files before proposing changes.

### Rule 2: Strict VenueSeat vs EventSeat Separation
- **`VenueSeat` (Physical Seat)**: Defined in the `seats` table. Represents physical coordinates, screen association, and permanent category (`seat_type_id`). NEVER write runtime booking status (`BOOKED`, `HELD`) directly to the physical `seats` table.
- **`EventSeat` (Runtime Availability)**: Computed on the fly for a given `show_id` by aggregating `shows`, active `seat_holds` (`expires_at > NOW()`), and confirmed `booking_seats`.

### Rule 3: Database as the Single Source of Truth for Concurrency
- Never rely on in-memory locks, global Python variables, single-container memory, or frontend state for booking safety.
- All hold creations, checkout confirmations, and cancellations MUST execute within atomic database transactions with appropriate locking and partial unique indexes.
- Always respect and maintain database unique constraints (`UNIQUE(seat_id, show_id)` on `seat_holds` and partial index `ix_booking_seats_show_seat_active` on `booking_seats`).

### Rule 4: Configurable TTL Rules (No Hardcoded Constants)
- Hold durations MUST be configurable via environment variables (`SEAT_HOLD_TTL_MINUTES`, `WAITLIST_OFFER_TTL_MINUTES`).
- Server time in UTC MUST be used for all timestamp comparisons (`expires_at > NOW()`).

### Rule 5: Strict Security & Secret Hygiene
- NEVER commit `.env` files or hardcode credentials, JWT secrets, or database passwords in code or documentation.
- Maintain `.env.example` with safe development placeholders.
- Enforce JWT authentication and role-based access control (`ADMIN`, `ORGANISER`, `CUSTOMER`) on all protected endpoints.

### Rule 6: Minimal Dependency & Clean Infrastructure Policy
- Do not introduce heavy messaging brokers (Kafka, RabbitMQ, Celery, Redis locks) unless an unavoidable requirement is proven.
- Keep the local development workflow minimal: Docker Compose manages PostgreSQL 16; frontend and backend run natively with hot-reloading.

### Rule 7: Honest Feature Status Reporting
- Never mark a feature as IMPLEMENTED if only scaffolding or partial routes exist.
- Distinguish clearly between IMPLEMENTED, PARTIALLY IMPLEMENTED, and PLANNED.

---

## 3. Directory Responsibilities

| Directory | Purpose & Boundaries |
|---|---|
| `backend/app/api/v1/` | HTTP request/response handling, parameter validation, role checking. Delegate complex workflows to transactional logic. |
| `backend/app/realtime/` | Real-time WebSocket connection handling, room management (`show:{id}`), and broadcast events. |
| `backend/app/core/` | Database engine, configuration loading, password hashing, and JWT tokens. |
| `backend/app/models/` | Declarative SQLAlchemy 2.0 data models and relationships. |
| `backend/app/services/` | Transactional domain logic (Booking, Hold, Waitlist). |
| `frontend/src/pages/` | Page components for customers (Seat Map, Movie Detail, History) and Organisers (Dashboard, Layout Builder, Analytics). |
| `frontend/src/lib/` | Shared Axios API client with auth interceptors and WebSocket client instance. |
| `frontend/src/store/` | Typed Zustand state stores (Authentication & Session). |
| `docs/` | Authoritative engineering documentation, architectural decisions, and requirement matrices. |

---

## 4. Verification Workflow
After making significant changes, agents MUST:
1. Verify PostgreSQL container health: `docker compose ps`
2. Run database seed & tests: `cd backend && pytest`
3. Verify backend health endpoint: `GET http://localhost:5000/health`
4. Test frontend production build: `cd frontend && npm run build`
5. Test relevant API endpoints and verify no console/runtime regressions.
