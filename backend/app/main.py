import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.jobs.sweeper import run_expiration_sweeper
from app.realtime.manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ticketflow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing TicketFlow backend engine...")
    sweeper_task = asyncio.create_task(run_expiration_sweeper())
    yield
    logger.info("Shutting down TicketFlow backend engine...")
    sweeper_task.cancel()
    try:
        await sweeper_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-concurrency ticket booking platform with real-time seat locks and FIFO waitlists.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def root_health_check():
    return {
        "status": "ok",
        "service": "ticketflow-backend",
        "environment": settings.ENVIRONMENT,
    }


# Mount API Routers (/api/v1 and /api)
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")


# Native WebSocket endpoint for live seat map updates (Read-Only Broadcasts)
@app.websocket("/ws/shows/{show_id}")
@app.websocket("/api/v1/ws/shows/{show_id}")
@app.websocket("/api/ws/shows/{show_id}")
async def websocket_show_endpoint(websocket: WebSocket, show_id: str):
    room = f"show:{show_id}"
    await manager.connect(websocket, room)
    try:
        await websocket.send_text(json.dumps({"event": "show:joined", "showId": show_id}))
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                logger.info(f"Received WS message in {room}: {msg}")
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    except Exception as e:
        logger.warning(f"WebSocket error in {room}: {e}")
        manager.disconnect(websocket, room)
