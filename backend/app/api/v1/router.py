from fastapi import APIRouter
from app.api.v1 import (
    analytics,
    auth,
    bookings,
    events,
    health,
    screens,
    shows,
    venues,
    waitlists,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(venues.router)
api_router.include_router(screens.router)
api_router.include_router(events.router)
api_router.include_router(shows.router)
api_router.include_router(bookings.router)
api_router.include_router(waitlists.router)
api_router.include_router(analytics.router)

# Aliases
api_router.include_router(events.router, prefix="/events", tags=["Events Alias"])
api_router.include_router(venues.router, prefix="/venues", tags=["Venues Alias"])
