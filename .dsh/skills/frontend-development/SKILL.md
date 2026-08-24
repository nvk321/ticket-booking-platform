---
name: frontend-development
description: Guidelines and conventions for TicketFlow React components, visual seat grid, and Zustand stores.
model: inherit
---

# TicketFlow Frontend Development Skill

## Scope & Purpose
Use when building or modifying React components, interactive seat maps, admin layout builders, customer checkout flows, or client state management.

## Core Rules & Patterns
1. **Separation of API Calls**: Use the centralized Axios client in `src/lib/api.js` rather than calling `fetch` or `axios` directly inside visual components.
2. **Real-Time Seat State**: In seat map views (`ShowSeatsPage.jsx`), subscribe to the Socket.io room on mount, listen for seat status events, and clean up listeners on unmount.
3. **Optimistic & Authoritative UI**: Highlight user-selected seats immediately for responsive UX, but always confirm hold validity with the backend server via WebSocket callback or API response.
4. **State Machine Awareness**: Render visual seats with distinct styling based on status (`AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`, `SELECTED`), category color, and prime view flags (`isGolden`, `isAccessible`).
5. **Loading & Error Boundaries**: Always provide loading skeletons or spinners and informative error banners for network or booking failures.
