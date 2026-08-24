---
name: architecture-review
description: Architectural alignment and domain integrity review checklist for TicketFlow features.
model: inherit
---

# TicketFlow Architecture Review Skill

## Scope & Purpose
Use when reviewing PRs, planning new phases, or making substantial structural changes to the codebase.

## Core Rules & Patterns
1. **VenueSeat vs EventSeat Compliance**: Verify that physical seats in `seats` remain immutable blueprints, and runtime availability is always computed dynamically per show/event.
2. **Minimal Dependency Policy**: Reject unnecessary heavy dependencies (e.g. Redis locks, Kafka queues, Celery workers) unless an unavoidable technical requirement is proven.
3. **Database Concurrency Guarantee**: Ensure all seat state transitions and checkout flows use atomic PostgreSQL transactions and respect composite unique constraints.
4. **Clean Code & Honest Status**: Maintain separation between controllers, services, and data layers. Never mark unbuilt features as IMPLEMENTED.
