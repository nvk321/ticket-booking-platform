# TicketFlow — Local Development & Operations Guide

## 1. Prerequisites
- **Python**: 3.11+ (Tested on Python 3.13)
- **Node.js**: v18+ (Tested on v26)
- **npm**: v9+
- **Docker & Docker Compose**: v24+

## 2. Quick Setup

```bash
# 1. Start PostgreSQL 16 container
docker compose up -d postgres

# 2. Setup and seed backend
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py
pytest

# 3. Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload

# 4. Setup and start frontend (in separate terminal)
cd frontend
npm install
npm run dev
```

## 3. Swagger API Documentation
Interactive API docs available at `http://localhost:5000/docs` (OpenAPI schema: `http://localhost:5000/openapi.json`).\n