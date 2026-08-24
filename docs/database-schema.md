# TicketFlow — Database Schema & Data Modeling

## 1. Overview & Principles

The TicketFlow persistence layer is built on **PostgreSQL 16** managed via **Prisma ORM** with versioned migrations. The relational model enforces referential integrity, strong composite uniqueness constraints, and strict separation between the reusable physical venue layout and dynamic event-specific seat availability.

---

## 2. Core Architectural Distinction: VenueSeat vs EventSeat

| Model Concept | Database Table | Responsibility | Mutability |
|---|---|---|---|
| **Physical Venue Seat** | `seats` | Defines physical coordinates (`row`, `col`, `label`), physical screen association, default category (`seatTypeId`), accessibility flags, and physical maintenance status. | Immutable across shows; modified only by venue administrators. |
| **Dynamic Seat Hold** | `seat_holds` | Tracks temporary checkout holds scoped strictly to `(seatId, showId)`. Holds an expiration timestamp (`expiresAt`) and customer session reference (`sessionId`). | Transient; created on hold, destroyed on expiration or booking confirmation. |
| **Confirmed Booking Seat** | `booking_seats` | Tracks immutable confirmed reservation of a seat for a specific booking and show. Stores the snapshot price paid at time of checkout. | Immutable once booking is confirmed. |

---

## 3. Entity-Relationship Diagram (ERD)

```
+----------------+          +-------------------+          +-------------------+
|     users      | 1      * |     theatres      | 1      * |      screens      |
+----------------+----------+-------------------+----------+-------------------+
| id (PK)        |          | id (PK)           |          | id (PK)           |
| email (UQ)     |          | name              |          | name              |
| password       |          | slug (UQ)         |          | capacity          |
| name           |          | address, city     |          | rows, cols        |
| role (ENUM)    |          | adminId (FK)      |          | theatreId (FK)    |
+-------+--------+          +-------------------+          +---+-----------+---+
        |                                                      |           |
        | 1                                                  1 |           | 1
        |                                                      |           |
        | *                                                  * |           | *
+-------+--------+          +-------------------+          +---+---+   +---+---+
|    bookings    | *      1 |       shows       | 1      * | seats |   | pricing
+----------------+----------+-------------------+----------+-------+   +-------+
| id (PK)        |          | id (PK)           |          | id(PK)|   | id(PK)|
| bookingRef(UQ) |          | startTime, endTime|          |row,col|   |screen |
| totalAmount    |          | screenId (FK)     |          |label  |   |seatTyp|
| status (ENUM)  |          | movieId (FK)      |          |screen |   |basePrc|
| userId (FK)    |          +---+-----------+---+          |seatTyp|   +-------+
| showId (FK)    |              |           |              +---+---+
+-------+--------+            1 |         1 |                  | 1
        |                       |           |                  |
      1 |                     * |         * |                * |
+-------+--------+          +---+-----------+---+          +---+---+
| booking_seats  |          |    seat_holds     |          | waitlist_entries
+----------------+          +-------------------+          +------------------
| id (PK)        |          | id (PK)           |          | id (PK)
| bookingId (FK) |          | sessionId         |          | eventId / showId
| seatId (FK)    |          | expiresAt         |          | seatTypeId
| price          |          | seatId (FK)       |          | userId (FK)
| UQ(booking,seat|          | showId (FK)       |          | status (PENDING..)
+----------------+          | UQ(seatId, showId)|          | priorityRank
                            +-------------------+          +------------------
```

---

## 4. Complete Table Specifications

### 4.1. `users`
Represents customer accounts, theatre organisers, and system administrators.
- `id` (TEXT, PK, UUID): Unique identifier.
- `email` (TEXT, UNIQUE, NOT NULL): User email address.
- `password` (TEXT, NOT NULL): Bcrypt-hashed password.
- `name` (TEXT, NOT NULL): Full name.
- `role` (ENUM `Role`: `SUPER_ADMIN`, `THEATRE_ADMIN`, `USER`, DEFAULT `USER`).
- `createdAt`, `updatedAt` (TIMESTAMP).

### 4.2. `theatres` (Venues)
Represents physical venues hosting screens and events.
- `id` (TEXT, PK, UUID): Unique identifier.
- `name` (TEXT, NOT NULL): Venue display name.
- `slug` (TEXT, UNIQUE, NOT NULL): URL-safe slug.
- `address`, `city`, `state`, `country` (TEXT).
- `adminId` (TEXT, FK `users.id`): Assigned theatre organiser / admin.
- `primaryColor`, `accentColor` (TEXT): Branding configuration.
- `isActive` (BOOLEAN, DEFAULT true).

### 4.3. `screens` (Auditoriums / Halls)
Represents distinct performance halls inside a venue.
- `id` (TEXT, PK, UUID).
- `theatreId` (TEXT, FK `theatres.id`, CASCADE ON DELETE).
- `name` (TEXT, NOT NULL): e.g. "Audi 1", "Main Stage".
- `capacity` (INTEGER, NOT NULL).
- `rows`, `cols` (INTEGER, DEFAULT 20, 30).
- **Constraints**: `UNIQUE(theatreId, name)`.

### 4.4. `seat_types` (Seat Categories)
Defines categorization tiers (e.g. Royal, Balcony, First Class, Standard).
- `id` (TEXT, PK, UUID).
- `name` (TEXT, UNIQUE, NOT NULL): Category name.
- `color` (TEXT, NOT NULL): UI color hex code.
- `description` (TEXT).

### 4.5. `seats` (Physical Venue Seats)
- `id` (TEXT, PK, UUID).
- `screenId` (TEXT, FK `screens.id`, CASCADE ON DELETE).
- `seatTypeId` (TEXT, FK `seat_types.id`).
- `row` (INTEGER), `col` (INTEGER).
- `label` (TEXT, e.g. "A12"), `rowLabel` (TEXT, e.g. "A").
- `status` (ENUM `SeatStatus`: `ACTIVE`, `BLOCKED`, `MAINTENANCE`).
- `isGolden` (BOOLEAN, DEFAULT false): Best view / prime acoustical position.
- `isAccessible` (BOOLEAN, DEFAULT false): Wheelchair accessible.
- `customPrice` (DOUBLE PRECISION, NULLABLE).
- **Constraints**:
  - `UNIQUE(screenId, row, col)`
  - `UNIQUE(screenId, label)`

### 4.6. `movies` / `events`
Represents performance metadata (movies, concerts, theatrical events).
- `id` (TEXT, PK, UUID).
- `title` (TEXT, NOT NULL).
- `description` (TEXT).
- `duration` (INTEGER, minutes).
- `genre` (TEXT[]).
- `language` (TEXT, DEFAULT 'English').
- `rating` (TEXT, e.g. 'U/A', 'PG-13').
- `posterUrl`, `trailerUrl` (TEXT).
- `isActive` (BOOLEAN, DEFAULT true).

### 4.7. `shows` (Event Showtimes)
Instance of an event scheduled in a specific auditorium.
- `id` (TEXT, PK, UUID).
- `screenId` (TEXT, FK `screens.id`, CASCADE ON DELETE).
- `movieId` (TEXT, FK `movies.id`).
- `startTime`, `endTime` (TIMESTAMP, NOT NULL).
- `isActive` (BOOLEAN, DEFAULT true).
- `availableFrom`, `availableTo` (TIMESTAMP).

### 4.8. `screen_pricing`
Category pricing configuration per screen.
- `id` (TEXT, PK, UUID).
- `screenId` (TEXT, FK `screens.id`).
- `seatTypeId` (TEXT, FK `seat_types.id`).
- `basePrice` (DOUBLE PRECISION, NOT NULL).
- `weekendPrice` (DOUBLE PRECISION, NULLABLE).
- `peakPrice` (DOUBLE PRECISION, NULLABLE).
- **Constraints**: `UNIQUE(screenId, seatTypeId)`.

### 4.9. `seat_holds` (Transient Holds)
Active temporary reservations for a customer during checkout.
- `id` (TEXT, PK, UUID).
- `seatId` (TEXT, FK `seats.id`, CASCADE ON DELETE).
- `showId` (TEXT, FK `shows.id`, CASCADE ON DELETE).
- `sessionId` (TEXT, NOT NULL): Client session/socket identifier.
- `expiresAt` (TIMESTAMP, NOT NULL): Expiration deadline.
- `createdAt` (TIMESTAMP, DEFAULT NOW).
- **Constraints**: `UNIQUE(seatId, showId)`.

### 4.10. `bookings`
Confirmed or pending customer reservations.
- `id` (TEXT, PK, UUID).
- `bookingRef` (TEXT, UNIQUE, NOT NULL): Human-readable reference (e.g. `BKABC123`).
- `userId` (TEXT, FK `users.id`).
- `showId` (TEXT, FK `shows.id`).
- `totalAmount` (DOUBLE PRECISION, NOT NULL).
- `status` (ENUM `BookingStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `REFUNDED`).
- `qrCode` (TEXT): Base64 Data URL of generated ticket QR.
- `paymentId`, `paymentMethod` (TEXT).

### 4.11. `booking_seats`
Individual seats reserved within a booking.
- `id` (TEXT, PK, UUID).
- `bookingId` (TEXT, FK `bookings.id`, CASCADE ON DELETE).
- `seatId` (TEXT, FK `seats.id`).
- `price` (DOUBLE PRECISION, NOT NULL).
- **Constraints**: `UNIQUE(bookingId, seatId)`.

### 4.12. `payments`
Transaction records for confirmed bookings.
- `id` (TEXT, PK, UUID).
- `bookingId` (TEXT, UNIQUE, FK `bookings.id`).
- `amount` (DOUBLE PRECISION).
- `currency` (TEXT, DEFAULT 'INR').
- `status` (ENUM `PaymentStatus`: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`).
- `gateway`, `gatewayRef` (TEXT).

---

## 5. State Machine Specifications

### 5.1. Seat Status Machine (Per-Show Computed State)
```
          +-------------+
          |  AVAILABLE  |
          +------+------+
                 |
   Hold Acquired | Hold Released /
   (seats:hold)  | TTL Expired
                 v
          +------+------+
          |    HELD     |
          +------+------+
                 |
   Checkout Paid |
   (POST /book)  |
                 v
          +-------------+
          |   BOOKED    |
          +------+------+
                 |
    Cancellation | (Triggers Waitlist Reassignment)
                 v
          +-------------+
          |  AVAILABLE  |
          +-------------+
```

### 5.2. Booking State Machine
```
   [ Customer Initiates ] ──> PENDING
                                 │
                 Payment Success │ Payment Failure / Timeout
                                 v
                             CONFIRMED ──> CANCELLED ──> REFUNDED
```
