# TicketFlow — API Design Specification

## 1. API Standards & Conventions

- **Base URL**: `/api` (Targeting `/api/v1` in future iterations)
- **Protocol**: HTTP/1.1 and JSON payloads
- **Authentication**: JWT Bearer token via `Authorization: Bearer <token>`
- **Response Format**: Predictable JSON responses with standard HTTP status codes:
  - `200 OK`: Successful retrieval or modification
  - `201 Created`: Resource successfully created
  - `400 Bad Request`: Validation error or illegal state transition
  - `401 Unauthorized`: Missing or invalid authentication token
  - `403 Forbidden`: Insufficient role permissions
  - `404 Not Found`: Target entity does not exist
  - `409 Conflict`: Concurrency conflict or double-booking race condition
  - `500 Internal Server Error`: Unhandled server exception

---

## 2. API Endpoints

### 2.1. Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register customer or organiser account |
| `POST` | `/api/auth/login` | Public | Authenticate user and receive JWT token |
| `GET` | `/api/auth/me` | Authenticated | Get current authenticated user profile |

### 2.2. Venues & Theatres (`/api/theatres`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/theatres?city=` | Public | List all active venues with optional city filter |
| `GET` | `/api/theatres/:id` | Public | Get venue details and screen overview |
| `POST` | `/api/theatres` | Admin/Organiser | Create a new venue |
| `PUT` | `/api/theatres/:id` | Admin/Organiser | Update venue information |
| `GET` | `/api/theatres/admin/mine`| Organiser | List venues owned by current organiser |

### 2.3. Screens & Layouts (`/api/screens`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/screens/theatre/:theatreId` | Public | List screens for a venue |
| `GET` | `/api/screens/:id` | Public | Get screen details with complete physical seat grid |
| `POST` | `/api/screens` | Organiser | Create a new screen auditorium |
| `PUT` | `/api/screens/:id` | Organiser | Update screen parameters (name, capacity) |
| `POST` | `/api/screens/:id/layout` | Organiser | Save visual seat layout (rows, cols, types, aisles) |
| `GET` | `/api/screens/:id/pricing`| Public | Get category pricing for a screen |
| `POST` | `/api/screens/:id/pricing`| Organiser | Update category pricing (base, weekend, peak) |

### 2.4. Movies & Events (`/api/movies`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/movies` | Public | List all active movies and events |
| `GET` | `/api/movies/:id` | Public | Get event details with upcoming scheduled showtimes |
| `POST` | `/api/movies` | Admin/Organiser | Create a new movie/event |
| `PUT` | `/api/movies/:id` | Admin/Organiser | Update event metadata |

### 2.5. Shows & Seat Availability (`/api/shows`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/shows/screen/:screenId?date=` | Public | List shows for a specific screen |
| `GET` | `/api/shows/movie/:movieId?date=&city=` | Public | List shows for an event across venues |
| `GET` | `/api/shows/:id/seats` | Public | **Primary Seat Map API**: Computes real-time `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED` status for all seats |
| `POST` | `/api/shows` | Organiser | Schedule an event showtime with time conflict validation |
| `PATCH`| `/api/shows/:id/toggle` | Organiser | Enable or disable a show |

### 2.6. Bookings & Checkout (`/api/bookings`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | Authenticated | **Atomic Booking Endpoint**: Confirms held seats, calculates total price, generates booking reference, creates QR code, and clears transient holds |
| `GET` | `/api/bookings/my` | Authenticated | Retrieve customer booking history |
| `GET` | `/api/bookings/:ref` | Authenticated | Retrieve booking details with QR code and seat breakdown |
| `PATCH`| `/api/bookings/:id/cancel` | Authenticated | Cancel a booking, refund payment, and trigger waitlist reassignment |

### 2.7. Organiser Analytics (`/api/analytics`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/analytics/theatre/:theatreId` | Organiser | Aggregate revenue, total bookings, and screen occupancy rates |
| `GET` | `/api/analytics/screen/:screenId` | Organiser | Screen-level utilization heatmap and per-show revenue |

---

## 3. WebSocket Event Specification

All real-time seat synchronization occurs over Socket.io:

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `show:join` | Client -> Server | `{ showId }` | Subscribes client to event show room `show:{showId}` |
| `show:leave` | Client -> Server | `{ showId }` | Unsubscribes client from show room |
| `seats:hold` | Client -> Server | `{ showId, seatIds, sessionId }` | Requests temporary 5-min hold on selected seats |
| `seats:release` | Client -> Server | `{ showId, seatIds, sessionId }` | Explicitly releases held seats |
| `seats:held` | Server -> Client | `{ showId, seatIds, sessionId, expiresAt }` | Broadcast to all room subscribers when seats are held |
| `seats:booked` | Server -> Client | `{ showId, seatIds, screenId }` | Broadcast when booking is confirmed |
| `seats:released` | Server -> Client | `{ showId, seatIds }` | Broadcast when seats are released or booking is cancelled |
| `seats:holdExpired` | Server -> Client | `{ showId, seatIds }` | Broadcast when background cleaner expires a hold |
