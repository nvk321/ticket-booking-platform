# TicketFlow — REST API & WebSocket Specification

## 1. REST Endpoints (`/api/v1`)

### Authentication (`/api/v1/auth`)
- `POST /register` — Register a new account (`CUSTOMER`, `ORGANISER`).
- `POST /login` — Authenticate and receive JWT access token.
- `GET /me` — Retrieve current authenticated user profile.

### Venues & Theatres (`/api/v1/theatres`)
- `GET /` — List public active venues (optional `city` filter).
- `GET /admin/mine` — List venues managed by current organiser.
- `GET /{id}` — Retrieve venue details and screens.
- `POST /` — Create a new venue (Organiser/Admin).
- `PUT /{id}` — Update venue configuration.

### Screens & Layouts (`/api/v1/screens`)
- `GET /theatre/{theatre_id}` — List screens for a venue.
- `GET /{id}` — Get screen grid dimensions and seats.
- `POST /` — Create a screen.
- `PUT /{id}` — Update screen metadata.
- `POST /{id}/layout` — Save visual seat layout matrix.
- `GET /{id}/pricing` — Get tier pricing for screen.
- `POST /{id}/pricing` — Update tier pricing.

### Events & Movies (`/api/v1/movies`)
- `GET /` — List events with optional search and category filters.
- `GET /{id}` — Get event details.
- `POST /` — Create a new movie or concert (Organiser/Admin).
- `PUT /{id}` — Update event details.

### Shows & Schedules (`/api/v1/shows`)
- `GET /movie/{movie_id}` — List shows for an event.
- `GET /screen/{screen_id}` — List shows for a screen.
- `GET /{id}/seats` — Get computed runtime seat map with pricing and category stats.
- `POST /` — Schedule a show (with time-conflict validation).
- `PATCH /{id}/toggle` — Enable/disable a show.

### Bookings & Holds (`/api/v1/bookings`)
- `POST /` — Confirm ticket checkout.
- `GET /my` — List customer booking history.
- `GET /{ref}` — Get booking details by reference with QR code.
- `PATCH /{id}/cancel` — Cancel booking and initiate refund/waitlist cascade.
- `POST /hold` — Reserve temporary seat hold.
- `POST /release` — Release temporary seat hold.

### Waitlists (`/api/v1/waitlist`)
- `POST /join` — Join category waitlist.
- `GET /my` — Get user waitlist entries and live queue positions.
- `POST /{id}/claim` — Claim a pending waitlist offer.
- `POST /{id}/leave` — Leave waitlist.
- `GET /show/{show_id}` — Get waitlist counts by tier.

### Analytics (`/api/v1/analytics`)
- `GET /theatre/{theatre_id}` — Organiser venue revenue and screen occupancy analytics.
- `GET /screen/{screen_id}` — Screen performance breakdown.

### Health (`/api/v1/health`)
- `GET /` — Service health check.

## 2. Real-Time WebSocket Protocol
- Connection: `ws://localhost:5000/api/v1/ws/shows/{show_id}`
- Broadcast Events: `seats:held`, `seats:released`, `seats:booked`, `seats:holdExpired`, `waitlist:offerCreated`.\n