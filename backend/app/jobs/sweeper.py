import asyncio
import logging
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.hold_service import hold_service
from app.services.waitlist_service import waitlist_service

logger = logging.getLogger(__name__)


async def run_expiration_sweeper():
    logger.info("Starting background expiration sweeper task...")
    while True:
        try:
            async with AsyncSessionLocal() as session:
                expired_holds = await hold_service.sweep_expired_holds(session)
                if expired_holds > 0:
                    logger.info(f"Purged {expired_holds} expired seat holds")

                expired_offers = await waitlist_service.sweep_expired_waitlist_offers(session)
                if expired_offers > 0:
                    logger.info(f"Cascaded {expired_offers} expired waitlist offers to next candidates")

        except asyncio.CancelledError:
            logger.info("Expiration sweeper task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in background expiration sweeper: {e}")

        await asyncio.sleep(settings.BACKGROUND_SWEEPER_INTERVAL_SECONDS)
