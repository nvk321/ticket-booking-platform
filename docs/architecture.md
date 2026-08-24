# TicketFlow — System Architecture & Engineering Foundation

## 1. Executive Summary

**TicketFlow** is a full-stack, concurrency-safe, real-time ticket booking platform designed for high-demand entertainment events including **movies and concerts**. The system addresses the fundamental challenges of high-volume ticket distribution: preventing double bookings under high concurrent traffic, managing time-to-live (TTL) temporary seat holds, releasing abandoned inventory automatically, and orchestrating fair, FIFO category-based waitlists with automated offer reassignment upon ticket cancellation.

---

## 2. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             React 18 + Vite + TailwindCSS + Zustand Client                  |  |
|  |  * Visual Seat Map (Aisle / Golden / Accessible / Category layout)          |  |
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
|  |                     Node.js & Express / FastAPI API Gateway                 |  |
|  |                                                                             |  |
|  |  [ Authentication & RBAC Middleware ]                                       |  |
|  |    - JWT Verification, Role Enforcement (ADMIN, ORGANISER, USER)            |  |
|  |                                                                             |  |
|  |  [ Route Controllers ]                                                      |  |
|  |    - /api/auth       - /api/venues (Theatres)  - /api/events (Shows/Movies) |  |
|  |    - /api/holds      - /api/bookings           - /api/waitlist              |  |
|  |    - /api/analytics  - /api/seat-types                                      |  |
|  |                                                                             |  |
|  |  [ Core Business Services & Domain Logic ]                                  |  |
|  |    - Seat Hold & TTL Coordinator                                            |  |
|  |    - Concurrency Safe Booking Orchestrator (DB Transactions)                |  |
|  |    - Waitlist FIFO Queue & Offer Engine                                     |  |
|  |    - QR Code Generation Engine                                              |  |
|  |    - Notification & Email Abstraction Layer                                 |  |
|  |                                                                             |  |
|  |  [ Real-Time WebSocket Hub (Socket.io) ]                                    |  |
|  |    - Show/Event Rooms (`show:{id}`)                                         |  |
|  |    - Broadcasts: `seats:held`, `seats:booked`, `seats:released`, `holdExp`  |  |
|  |                                                                             |  |
|  |  [ Background Expiration Worker ]                                           |  |
|  |    - Periodic TTL Hold Sweeper (30s interval)                               |  |
|  |    - Waitlist Offer Expiration & Cascade Sweeper                            |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                         Prisma ORM / Connection Pool
                                         v
+-----------------------------------------------------------------------------------+
|                               DATABASE TIER                                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                   PostgreSQL 16 Database Engine                             |  |
|  |                                                                             |  |
|  |  [ Physical Layout ]                [ Per-Event Instance State ]            |  |
|  |  * venues (theatres)                * shows (events)                        |  |
|  |  * screens                          * seat_holds (Unique seatId + showId)   |  |
|  |  * seats (VenueSeat blueprint)      * bookings                              |  |
|  |  * seat_types & screen_pricing      * booking_seats (Unique bookingId+seat) |  |
|  |                                     * waitlist_entries                      |  |
|  |  [ Concurrency & Integrity Controls ]                                      |  |
|  |  * Atomic ACID Transactions                                                 |  |
|  |  * PostgreSQL Row Locks / Upsert Constraints                                |  |
|  |  * Cascade & Foreign Key Referential Integrity                              |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Component Justification

| Layer | Technology | Key Justification |
|---|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Zustand | Modern declarative UI, instant HMR, reactive state management without excessive Redux boilerplate, component isolation for interactive seat grids. |
| **Backend** | Node.js, Express, Socket.io, Prisma ORM | High-concurrency event-driven I/O, native bidirectional WebSocket support for instant seat status broadcasts, type-safe database queries, battle-tested connection pooling. |
| **Database** | PostgreSQL 16 | ACID transaction guarantees, robust row-level locking, composite unique constraints for anti-double-booking guarantees. |
| **DevOps** | Docker Compose | Reproducible local development environment, single-command PostgreSQL spin-up, zero external dependencies on the host machine. |
| **Security** | JWT, bcryptjs | Stateless authorization, role-based access control (Admin, Organiser, User), salted password hashing. |

---

## 4. Separation of Concerns & Directory Architecture

The repository is structured as a clean, decoupled monorepo:

```
ticketflow/
├── docker-compose.yml       # Docker Compose infrastructure (PostgreSQL)
├── compose.yaml             # Modern compose definition
├── package.json             # Monorepo root workspace helper scripts
├── .gitignore               # Strict exclusion of secrets, builds, and node_modules
├── AGENTS.md                # Project-specific AI development context and rules
├── docs/                    # Complete engineering specifications & system design
│   ├── architecture.md
│   ├── database-schema.md
│   ├── concurrency.md
│   ├── seat-hold-ttl.md
│   ├── waitlist.md
│   ├── api-design.md
│   ├── development-guide.md
│   ├── decisions.md
│   └── system-design.md
├── backend/                 # Backend service
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma   # PostgreSQL domain schema definition
│   │   └── migrations/     # Versioned SQL migration history
│   └── src/
│       ├── index.js        # Server bootstrap, HTTP + Socket.io server
│       ├── seed.js         # Realistic seed data (venues, seats, movies, shows)
│       ├── lib/            # Prisma client instance & shared utilities
│       ├── middleware/     # JWT authentication & role-based authorization
│       ├── routes/         # REST API route handlers
│       └── socket/         # WebSocket connection lifecycle & hold handlers
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

## 5. Domain Modeling Principles

### Reusable Venue Layout vs Per-Event Seat State
A fundamental architectural tenet in TicketFlow is the strict separation between:
1. **`VenueSeat` (Physical Seat Blueprint)**: Defined once per venue/screen. Represents the physical location (`row`, `col`, `label`), seat category (`Royal`, `Balcony`, `First Class`, `Standard`), and physical features (`isGolden`, `isAccessible`).
2. **`EventSeat` (Per-Event Instance State)**: The runtime status (`AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`) for a specific event showtime. A physical seat in Audi 1 can be BOOKED for the 2:00 PM show and AVAILABLE for the 6:00 PM show.

---

## 6. Real-Time Synchronization Model

1. When a user opens the Seat Map for a show, the frontend subscribes to the WebSocket room `show:{showId}`.
2. When any customer acquires a temporary hold, the server broadcasts `seats:held` to all room subscribers.
3. When a booking completes, `seats:booked` is broadcast.
4. When a hold expires or is explicitly released, `seats:released` or `seats:holdExpired` is broadcast.
5. The frontend updates its in-memory seat map state instantaneously without requiring continuous polling.
