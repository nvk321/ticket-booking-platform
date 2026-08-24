---
name: api-design
description: API design standards, RESTful endpoint naming, and WebSocket event contracts for TicketFlow.
model: inherit
---

# TicketFlow API Design Skill

## Scope & Purpose
Use when creating new HTTP REST endpoints, designing response structures, or introducing new WebSocket event types.

## Core Rules & Patterns
1. **Resource-Oriented REST Structure**: Use plural nouns for resource paths (`/api/theatres`, `/api/screens`, `/api/shows`, `/api/bookings`, `/api/waitlist`).
2. **Consistent Status Codes**:
   - `200 OK` / `201 Created` for successful operations.
   - `400 Bad Request` for invalid input parameters or business constraint violations.
   - `401 Unauthorized` / `403 Forbidden` for auth failures.
   - `404 Not Found` for nonexistent resources.
   - `409 Conflict` for concurrency collisions.
3. **Payload Structure**: Always return structured JSON objects. Error responses must consistently use `{ "error": "Human readable message" }`.
4. **WebSocket Event Naming**: Use noun:verb pairing for Socket.io events (`seats:hold`, `seats:held`, `seats:booked`, `seats:released`, `seats:holdExpired`).
