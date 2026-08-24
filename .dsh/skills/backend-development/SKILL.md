---
name: backend-development
description: Guidelines and patterns for TicketFlow backend services, route controllers, and socket handlers.
model: inherit
---

# TicketFlow Backend Development Skill

## Scope & Purpose
Use when modifying or creating backend routes, services, socket handlers, middleware, or background jobs for TicketFlow.

## Core Rules & Patterns
1. **Express Route Handlers**: Keep route controllers focused on HTTP parsing, validation, authentication extraction, and error dispatching.
2. **ACID Transactions**: Always wrap multi-entity state changes (such as hold creation, booking confirmation, and ticket cancellation) in `prisma.$transaction`.
3. **Real-Time Synchronization**: When database state updates affect seat availability, emit corresponding Socket.io events (`seats:held`, `seats:booked`, `seats:released`, `seats:holdExpired`) to the relevant show room (`show:{showId}`).
4. **Environment Variables**: Use `process.env` with sensible fallbacks defined in `.env.example`. Never hardcode secrets, ports, or TTL durations.
5. **Clean Error Responses**: Return standardized error payloads (`{ error: string }`) with appropriate HTTP status codes (400, 401, 403, 404, 409, 500).
