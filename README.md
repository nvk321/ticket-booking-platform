# 🎟️ TicketFlow — Smart Ticket Booking Platform

**TicketFlow** is a full-stack, concurrency-safe, real-time ticket booking platform engineered for high-demand entertainment events including **movies and concerts**. 

The platform features interactive visual seat maps, real-time WebSocket seat availability synchronization, configurable TTL temporary seat holds, robust database-authoritative double-booking prevention, and automated FIFO category-based waitlists with time-limited offer cascading upon ticket cancellation.

---

## 🏛️ System Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             React 18 + Vite + TailwindCSS + Zustand Client                  |  |
|  |  * Interactive Visual Seat Map (Aisles, Categories, Golden, Accessible)     |  |
|  |  * Real-Time WebSocket Client (Socket.io-client)                            |  |
|  |  * Customer Booking & History Flows                                         |  |
|  |  * Organiser & Admin Dashboards (Revenue & Seat Occupancy)                  |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                       HTTP REST / JSON  |  WebSocket (Socket.io)
                       (Port 5000)       |  Bidirectional Events
                                         v
+-----------------------------------------------------------------------------------+
|                              APPLICATION TIER                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     Node.js & Express API Gateway                           |  |
|  |  * Authentication & RBAC Middleware (SUPER_ADMIN, THEATRE_ADMIN, USER)      |  |
|  |  * Concurrency Safe Booking Orchestrator (PostgreSQL ACID Transactions)     |  |
|  |  * Real-Time WebSocket Hub (Room-scoped state broadcasts)                   |  |
|  |  * QR Code Ticket Engine & Background Expiration Sweepers                   |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                         Prisma ORM / Connection Pool
                                         v
+-----------------------------------------------------------------------------------+
|                               DATABASE TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                   PostgreSQL 16 Database (Docker Compose)                   |  |
|  |  * Physical Venue Layouts (venues, screens, seats, seat_types)              |  |
|  |  * Per-Event Runtime State (shows, seat_holds, bookings, booking_seats)     |  |
|  |  * Unique Constraints & Atomic Transaction Guarantees                       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 🛠️ Technology Stack

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Zustand | Interactive visual seat grids, dynamic color coding, responsive mobile/desktop layouts. |
| **Backend** | Node.js, Express, Socket.io, Prisma ORM | Event-driven I/O, bidirectional WebSocket channels, type-safe database queries. |
| **Database** | PostgreSQL 16 | Relational modeling, composite unique constraints, ACID transaction isolation. |
| **DevOps** | Docker Compose | Reproducible single-command database containerization with automated healthchecks. |
| **Security** | JWT, bcryptjs | Stateless token authentication, salted password hashing, role-based route guards. |

---

## 📂 Repository Structure

```
ticketflow/
├── docker-compose.yml       # Docker Compose infrastructure (PostgreSQL 16)
├── compose.yaml             # Standard compose specification
├── package.json             # Monorepo root workspace helper scripts
├── .gitignore               # Strict exclusion of secrets, builds, and node_modules
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
│   └── system-design.md     # System design write-up (~800 words)
├── backend/                 # Backend service
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma   # PostgreSQL domain schema definition
│   │   └── migrations/     # Versioned SQL migration history
│   └── src/
│       ├── index.js        # Server bootstrap & WebSocket initialization
│       ├── seed.js         # Realistic seed data generator
│       ├── lib/            # Prisma client instance & shared utilities
│       ├── middleware/     # JWT authentication & role-based authorization
│       ├── routes/         # REST API route controllers
│       └── socket/         # WebSocket connection & seat hold event handlers
└── frontend/                # Interactive React client
    ├── package.json
    ├── vite.config.js
    ├── .env.example
    ├── index.html
    └── src/
        ├── App.jsx         # Client routing & protected routes
        ├── components/     # Reusable layout and navigation components
        ├── lib/            # Axios API client & Socket.io client
        ├── store/          # Zustand authentication & session store
        └── pages/          # Customer & Organiser pages (Seat Map, Checkout, Admin)
```

---

## 📊 Feature Implementation Status

| Feature Domain | Feature Description | Status |
|---|---|---|
| **Authentication & RBAC** | JWT authentication, password hashing, role protection (SUPER_ADMIN, THEATRE_ADMIN, USER) | **IMPLEMENTED** |
| **Venue & Layout Management**| Multi-venue creation, multi-screen management, interactive drag-paint visual layout builder | **IMPLEMENTED** |
| **Event / Show Scheduling** | Movie creation, screen scheduling, time conflict detection, category pricing | **IMPLEMENTED** |
| **Visual Seat Map** | Interactive seat selection, category colors, golden seats, aisle rendering | **IMPLEMENTED** |
| **Seat Holds & TTL** | 5-minute transient holds, database locking, background expiration sweeper, real-time WebSocket sync | **IMPLEMENTED** |
| **Anti-Double-Booking** | Database-authoritative transactions, composite unique constraints | **IMPLEMENTED** |
| **Booking Confirmation** | Booking reference generation, price calculation, payment records, QR code ticket generation | **IMPLEMENTED** |
| **Customer Portal** | Booking history (`/my-bookings`), booking details view, ticket cancellation | **IMPLEMENTED** |
| **Organiser Analytics** | Revenue totals, booking counts, screen occupancy rates, utilization heatmaps | **IMPLEMENTED** |
| **Waitlist FIFO Engine** | Category-based waitlist queueing, cancellation-triggered auto-assignment | **PLANNED (Phase 9-10)** |
| **Email Delivery Abstraction**| Provider interface with development mock for confirmed ticket delivery | **PLANNED (Phase 8)** |

---

## 🚀 Quick Start & Local Development

### Prerequisites
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

### 2. Backend Setup
```bash
cd backend
cp .env.example .env

# Install dependencies, run migrations, and seed sample data
npm install
npx prisma migrate deploy
npm run db:seed

# Start backend server
npm run dev
```
Backend API will be running at `http://localhost:5000` (Healthcheck: `GET http://localhost:5000/health`).

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
cp .env.example .env

# Install dependencies and start Vite dev server
npm install
npm run dev
```
Frontend client will be accessible at `http://localhost:5173`.

---

## 🔑 Demo Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Theatre Admin / Organiser** | `admin@theatre.com` | `admin123` | Venue, screen, layout, show, and analytics management |
| **Customer** | `user@theatre.com` | `user123` | Seat browsing, temporary holds, booking, and history |

---

## 🧠 Core Engineering Principles

### 1. Strict Physical VenueSeat vs EventSeat Separation
- **`VenueSeat` (Physical Seat)**: Stored in `seats`. Defines physical coordinates (`row`, `col`, `label`), screen association, and physical tier (`seatTypeId`). NEVER stores runtime booking status.
- **`EventSeat` (Per-Event State)**: Dynamically computed on demand for a given showtime by aggregating confirmed `booking_seats` and active `seat_holds` (`expiresAt > NOW()`).

### 2. Concurrency Control & Double-Booking Prevention
Simultaneous hold and booking attempts are resolved exclusively at the database layer using PostgreSQL ACID transactions and composite unique constraints (`UNIQUE(seatId, showId)` on `seat_holds`). The system never relies on in-memory locks or client-side validation.

### 3. Hold TTL & Background Cleanup
Seat holds have a configurable TTL (governed by `SEAT_HOLD_TTL_MINUTES`, default 5 minutes). A 30-second background interval purges expired holds and broadcasts `seats:holdExpired` via WebSockets, ensuring seamless inventory recovery.

---

## 📖 Authoritative Documentation Index

- [System Architecture](docs/architecture.md)
- [Database Schema & Data Model](docs/database-schema.md)
- [Concurrency & Race Condition Analysis](docs/concurrency.md)
- [Seat Hold & TTL Specification](docs/seat-hold-ttl.md)
- [Category Waitlist & Reassignment Engine](docs/waitlist.md)
- [API & WebSocket Specification](docs/api-design.md)
- [Local Operations Guide](docs/development-guide.md)
- [Architecture Decision Records (ADR)](docs/decisions.md)
- [System Design Write-Up (~800 Words)](docs/system-design.md)
- [AI Development Context & Rules](AGENTS.md)
