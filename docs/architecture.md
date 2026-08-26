# TicketFlow — System Architecture & Component Design

## 1. High-Level Architecture

TicketFlow is structured across three tiers with clear domain boundaries:

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             React 18 + Vite + TypeScript + TailwindCSS + Zustand            |  |
|  |  * Interactive Visual Seat Map (Aisles, Categories, Golden, Accessible)     |  |
|  |  * Real-Time WebSocket Client (Native FastAPI WebSocket client)             |  |
|  |  * Customer Booking, History & Waitlist Claiming Flows                       |  |
|  |  * Organiser & Admin Dashboards (Revenue, Seating Matrix & Live Monitor)    |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                       HTTP REST / JSON  |  WebSocket
                       (Port 5000)       |  Bidirectional Events
                                         v
+-----------------------------------------------------------------------------------+
|                              APPLICATION TIER                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             Python 3.13 + FastAPI + Pydantic v2 + SQLAlchemy 2.0            |  |
|  |  * Authentication & RBAC (ADMIN, ORGANISER, CUSTOMER)                        |  |
|  |  * Concurrency Safe Booking Orchestrator (SELECT FOR UPDATE & Unique Idxs)  |  |
|  |  * Real-Time WebSocket Hub (Room-scoped show state broadcasts)              |  |
|  |  * In-Process Async Sweeper for Hold Expirations & Waitlist Cascading        |  |
|  |  * Native Base64 QR Code Generator & Pluggable Email Notification Service  |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                        SQLAlchemy Async Engine / asyncpg
                                         v
+-----------------------------------------------------------------------------------+
|                               DATABASE TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                   PostgreSQL 16 Database (Docker Compose)                   |  |
|  |  * Physical Venue Layouts (venues, screens, seats, seat_types)              |  |
|  |  * Per-Event Runtime State (shows, seat_holds, bookings, booking_seats)     |  |
|  |  * Partial Unique Indexes & Row-Level Locking Guarantees                    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Directory Responsibilities

| Directory | Responsibility |
|---|---|
| `backend/app/api/v1/` | REST API routes, parameter validation, role enforcement, and status codes. |
| `backend/app/core/` | Application configuration (`Settings`), security (JWT/Bcrypt), and async database session lifecycle. |
| `backend/app/models/` | Declarative SQLAlchemy 2.0 relational models. |
| `backend/app/schemas/` | Pydantic v2 request/response validation schemas. |
| `backend/app/services/` | Transactional domain logic (`BookingService`, `HoldService`, `WaitlistService`). |
| `backend/app/realtime/` | WebSocket connection manager supporting room broadcasting (`show:{id}`). |
| `backend/app/jobs/` | Async background TTL sweeper for expired holds and waitlist cascading. |
| `backend/app/integrations/` | QR ticket generation and mock/production email abstractions. |
| `frontend/src/pages/` | Typed React pages for customer booking flows and organiser administration. |
| `frontend/src/lib/` | Axios API client with auth interceptors and native WebSocket connection helper. |
| `frontend/src/store/` | Zustand auth store for client authentication state. |\n