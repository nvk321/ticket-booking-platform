---
name: security-review
description: Security review guidelines, secret hygiene, and role authorization validation for TicketFlow.
model: inherit
---

# TicketFlow Security Review Skill

## Scope & Purpose
Use when auditing code changes, authentication mechanisms, authorization middlewares, and environment configurations.

## Core Rules & Patterns
1. **Zero Secret Leakage**: Ensure `.env` files, production JWT secrets, and database credentials are never committed to version control. Maintain `.env.example` with safe dummy values.
2. **Strict Backend Authorization**: Never trust client-side role claims. Every administrative and booking route must enforce `authenticate` and `requireRole(...)` on the backend.
3. **Safe QR Code Payloads**: QR codes generated for tickets must contain only safe identifiers (`bookingRef`, `showId`, `seatIds`) and never expose private customer data or payment tokens.
4. **Input Sanitization & Validation**: Validate all incoming payloads with express-validator or schema definitions to prevent SQL injection, prototype pollution, or parameter tampering.
5. **Session Isolation**: Ensure temporary seat holds and bookings cannot be hijacked or cancelled by unauthorized users.
