# 🎟️ TicketFlow — Smart Ticket Booking Platform

**TicketFlow** is a full-stack, concurrency-safe, real-time ticket booking platform engineered for high-demand entertainment events including **movies and live concerts**.

The platform features interactive visual seat maps, real-time WebSocket seat availability synchronization, configurable TTL temporary seat holds, robust database-authoritative double-booking prevention, and automated FIFO category-based waitlists with time-limited offer cascading upon ticket cancellation.

---

## 🏛️ System Architecture Overview

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

## 🛠️ Technology Stack

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, Zustand | Interactive visual seat grids, dynamic color coding, responsive mobile/desktop layouts, typed state management. |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn | High-performance asynchronous API, strict schema validation, native WebSockets, in-process async sweeper tasks. |
| **Database** | PostgreSQL 16 (via asyncpg & psycopg) | Relational modeling, partial unique indexes, `SELECT ... FOR UPDATE` row locks, ACID transaction isolation. |
| **Migrations**| Alembic | Versioned, declarative database migration schema management. |
| **DevOps** | Docker Compose (`compose.yaml`), Render, Vercel | Reproducible containerized local development and cloud deployment blueprints. |
| **Security** | JWT, Passlib (Bcrypt) | Stateless token authentication, salted password hashing, role-based route guards. |
| **Testing** | Pytest, pytest-asyncio, httpx | Automated test suite covering auth, concurrency collisions, RBAC isolation, and waitlist cascading. |

---

## 📂 Repository Structure

```
ticketflow/
├── compose.yaml             # Canonical Docker Compose specification (PostgreSQL 16)
├── render.yaml              # Render cloud deployment blueprint
├── package.json             # Monorepo root workspace helper scripts
├── .gitignore               # Strict exclusion of secrets, builds, and caches
├── AGENTS.md                # Project-specific AI development context and rules
├── docs/                    # Complete engineering specifications & system design
│   ├── architecture.md      # High-level system design and tier interaction
│   ├── database-schema.md   # Relational data model and state machines
│   ├── concurrency.md       # Concurrency analysis and double-booking prevention
│   ├── seat-hold-ttl.md     # Seat hold lifecycle and TTL expiration architecture
│   ├── waitlist.md          # Category-based FIFO waitlist and offer cascading
│   ├── api-design.md        # HTTP REST and WebSocket event specifications
│   ├── development-guide.md # Local development and operational procedures
│   ├── decisions.md         # Architecture Decision Records (ADRs)
│   └── system-design.md     # System design write-up (~650 words)
├── backend/                 # Python FastAPI Backend
│   ├── alembic.ini          # Alembic configuration
│   ├── alembic/             # Versioned database migration history
│   ├── requirements.txt     # Python dependencies
│   ├── pytest.ini           # Pytest async configuration
│   ├── seed.py              # Realistic demo data generator
│   └── app/
│       ├── main.py          # FastAPI application entrypoint & lifecycle
│       ├── core/            # Config, security, and database engine setup
│       ├── models/          # Declarative SQLAlchemy 2.0 data models
│       ├── schemas/         # Pydantic v2 request/response models
│       ├── services/        # Atomic booking, seat hold, and waitlist engines
│       ├── realtime/        # WebSocket connection manager
│       ├── jobs/            # Background TTL expiration sweeper
│       ├── integrations/    # QR generation and email provider abstractions
│       ├── api/v1/          # REST API endpoints & route controllers
│       └── tests/           # Automated Pytest suite (100% passing)
└── frontend/                # Interactive React TypeScript Client
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.js
    ├── vercel.json          # SPA rewrite configuration for Vercel deployment
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx          # Client routing & protected routes
        ├── types/           # Shared TypeScript domain interfaces
        ├── components/      # Reusable layout and navigation components
        ├── lib/             # Typed Axios API client & WebSocket client
        ├── store/           # Typed Zustand authentication store
        └── pages/           # Customer & Organiser pages (Seat Map, Checkout, Admin)
```

---

## 📊 Feature Implementation Status

| Feature Domain | Feature Description | Status |
|---|---|---|
| **Authentication & RBAC** | JWT authentication, password hashing, role protection (ADMIN, ORGANISER, CUSTOMER) | **IMPLEMENTED** |
| **Venue & Layout Management**| Multi-venue creation, multi-screen management, interactive visual layout builder | **IMPLEMENTED** |
| **Event / Show Scheduling** | Movie & concert creation, screen scheduling, time conflict detection, category pricing | **IMPLEMENTED** |
| **Visual Seat Map** | Interactive seat selection, category colors, golden seats, aisle rendering | **IMPLEMENTED** |
| **Seat Holds & TTL** | 5-minute transient holds, database locking, background expiration sweeper, real-time WebSocket sync | **IMPLEMENTED** |
| **Anti-Double-Booking** | Database-authoritative transactions, partial unique indexes, row-level locks (HTTP 409 Conflict) | **IMPLEMENTED** |
| **Booking Confirmation** | Booking reference generation, price calculation, payment records, QR code ticket generation | **IMPLEMENTED** |
| **Customer Portal** | Booking history (`/my-bookings`), booking details view, ticket cancellation | **IMPLEMENTED** |
| **Organiser Analytics** | Revenue totals, booking counts, screen occupancy rates, utilization heatmaps | **IMPLEMENTED** |
| **Waitlist FIFO Engine** | Category-based waitlist queueing, cancellation-triggered auto-assignment, TTL offer cascading | **IMPLEMENTED** |
| **Email Delivery Abstraction**| Provider interface with development mock and production hooks for ticket and waitlist emails | **IMPLEMENTED** |
| **Automated Test Suite** | 100% passing Pytest suite covering Auth, Concurrency Collisions, and Waitlist Cascading | **IMPLEMENTED** |

---

## 🚀 Quick Start & Local Development

### Prerequisites
- **Python**: 3.11+ (Tested on 3.13)
- **Node.js**: v18+ (Tested on v26)
- **npm**: v9+
- **Docker & Docker Compose**: v24+

### 1. Database Setup via Docker Compose
```bash
# Start PostgreSQL 16 container in background
docker compose up -d postgres

# Verify container is healthy
docker compose ps
```

### 2. Backend Setup & Migrations
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Apply database migrations
alembic upgrade head

# Seed realistic demo data
python seed.py

# Run automated test suite
pytest

# Start FastAPI server with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```
Backend API will be running at `http://localhost:5000` (Health check: `GET http://localhost:5000/health`, Swagger docs: `http://localhost:5000/docs`).

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend

# Install dependencies and start Vite dev server
npm install
npm run dev
```
Frontend client will be accessible at `http://localhost:5173`.

---

## 🔑 Demo Accounts

The database seeder automatically initializes realistic demo accounts:

| Role | Email | Password | Pre-Seeded Data & Capabilities |
|---|---|---|---|
| **Event Organiser** | `admin@theatre.com` | `admin123` | Owns 3 venues (*CinePlex Mumbai Grand*, *PVR Forum Mall*, *Royal Opera Stage*), manages screens, visual seat layouts, pricing tiers, and views occupancy analytics. |
| **Customer** | `user@theatre.com` | `user123` | Has pre-seeded confirmed bookings with QR codes, active waitlist entries, and full permissions to browse seats, book tickets, and cancel reservations. |
| **System Admin** | `superadmin@theatre.com` | `admin123` | Full system-wide administrative access. |

---

## 🧠 Core Engineering Principles

### 1. Strict Physical VenueSeat vs EventSeat Separation
- **`VenueSeat` (Physical Seat)**: Stored in `seats`. Defines physical coordinates (`row`, `col`, `label`), screen association, and physical tier (`seat_type_id`). NEVER stores runtime booking status.
- **`EventSeat` (Per-Event State)**: Dynamically computed on demand for a given showtime by aggregating confirmed `booking_seats` and active `seat_holds` (`expires_at > NOW()`).

### 2. Concurrency Control & Double-Booking Prevention
Simultaneous hold and booking attempts are resolved exclusively at the database layer using PostgreSQL ACID transactions, row-level locks (`SELECT ... FOR UPDATE`), and partial unique indexes (`UNIQUE (show_id, seat_id) WHERE is_cancelled = false` on `booking_seats`). Conflicting concurrent requests return HTTP `409 Conflict`. The system never relies on in-memory locks or client-side validation.

### 3. Hold TTL & Background Cleanup
Seat holds have a configurable TTL (governed by `SEAT_HOLD_TTL_MINUTES`, default 5 minutes). A 30-second background async worker purges expired holds and broadcasts `seats:holdExpired` via WebSockets, ensuring seamless inventory recovery.

### 4. Simulated Payment & Refund Disclaimer
*Note: Payment and cancellation refund flows in TicketFlow are simulated for demonstration and academic evaluation purposes. Payment transactions are recorded with gateway status `MOCK`, and cancellation refunds update database financial records without interfacing with a live external banking gateway.*

### 5. Email Notification Abstraction & Demo Simulation
Email notifications use a mock provider by default (`EMAIL_PROVIDER=mock`). Mock emails are printed directly to the backend console logs and are not delivered to real inboxes. The digital Base64 QR code ticket in the user portal (`/my-bookings` and `/booking/:ref`) serves as the primary reliable entry pass.

---

## 🌐 Cloud Deployment Guide

### Backend Deployment (Render / Railway)
1. Set the root directory to `backend`.
2. Build Command: `pip install -r requirements.txt && alembic upgrade head`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set Environment Variables:
   - `DATABASE_URL`: Connection string of managed PostgreSQL 16 database.
   - `JWT_SECRET`: Secure random string (minimum 32 characters).
   - `ENVIRONMENT`: `production`
   - `FRONTEND_URL`: URL of the deployed frontend (e.g. `https://ticketflow.vercel.app`).
   - `CORS_ORIGINS`: `https://ticketflow.vercel.app`

### Frontend Deployment (Vercel)
1. Set the root directory to `frontend`.
2. Framework Preset: `Vite`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Set Environment Variables:
   - `VITE_API_BASE_URL`: URL of deployed backend (e.g. `https://ticketflow-api.onrender.com`)
   - `VITE_WS_BASE_URL`: WebSocket URL of deployed backend (e.g. `wss://ticketflow-api.onrender.com`)

---

## 📖 Authoritative Documentation Index

- [System Design Document (~650 Words)](docs/system-design.md)
- [System Architecture](docs/architecture.md)
- [Database Schema & Data Model](docs/database-schema.md)
- [Concurrency & Race Condition Analysis](docs/concurrency.md)
- [Seat Hold & TTL Specification](docs/seat-hold-ttl.md)
- [Category Waitlist & Reassignment Engine](docs/waitlist.md)
- [API & WebSocket Specification](docs/api-design.md)
- [Local Operations Guide](docs/development-guide.md)
- [Architecture Decision Records (ADR)](docs/decisions.md)
- [AI Development Context & Rules](AGENTS.md)
