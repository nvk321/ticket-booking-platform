# TicketFlow — Local Development & Operations Guide

## 1. Prerequisites

Ensure your development workstation has:
- **Node.js**: v18.0.0 or higher (Tested on Node v26)
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose**: Docker Engine v24+ / Compose v2+
- **Git**

---

## 2. Fast-Track Local Setup

### Step 1: Clone and Configure Environment Files
```bash
# Backend environment setup
cp backend/.env.example backend/.env

# Frontend environment setup
cp frontend/.env.example frontend/.env
```

### Step 2: Start PostgreSQL Database Container
TicketFlow utilizes Docker Compose to run an isolated PostgreSQL 16 instance.
```bash
docker compose up -d postgres
```
Verify the container is healthy:
```bash
docker compose ps
```

### Step 3: Run Database Migrations & Seed Sample Data
```bash
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
```

This seeds realistic test data including:
- **Admin Account**: `admin@theatre.com` / `admin123`
- **Customer Account**: `user@theatre.com` / `user123`
- Multiplex venue with multiple auditoriums (Audi 1, Audi 2), custom seat grids, category pricing, active movies, and scheduled showtimes.

### Step 4: Start Backend API & WebSocket Server
```bash
cd backend
npm run dev
```
Backend starts on `http://localhost:5000` (Healthcheck: `http://localhost:5000/health`).

### Step 5: Start Frontend Development Server
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend client runs on `http://localhost:5173`.

---

## 3. Stopping Infrastructure
To stop background Docker services:
```bash
docker compose down
```

> [!CAUTION]
> Running `docker compose down -v` will destroy the persistent PostgreSQL volume and all seeded data. Only use when performing a complete database reset.

---

## 4. Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| `Port 5432 already in use` | A local PostgreSQL service is running on the host machine. | Either stop local PostgreSQL or change `POSTGRES_PORT=5433` in `.env` and `docker-compose.yml`. |
| `P1001: Can't reach database server` | PostgreSQL container is still initializing or stopped. | Run `docker compose up -d postgres` and wait for status to become `(healthy)`. |
| `Socket disconnect on refresh` | Normal WebSocket client reconnection. | Handled automatically by `Socket.io-client` reconnection strategy. |
| `CORS Error` | Frontend URL differs from `CLIENT_URL` in `backend/.env`. | Ensure `CLIENT_URL=http://localhost:5173` matches your browser port. |
