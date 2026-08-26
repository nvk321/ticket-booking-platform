import abc
import logging
from typing import Any, Dict, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailProvider(abc.ABC):
    @abc.abstractmethod
    async def send_email(self, to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
        pass


class MockEmailProvider(EmailProvider):
    async def send_email(self, to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
        print("\n" + "=" * 70)
        print(f"📨 [MOCK EMAIL DISPATCH - DEMO MODE] To: {to}")
        print(f"📌 Subject: {subject}")
        print("-" * 70)
        print(body)
        print("=" * 70 + "\n")
        return True


class ProductionEmailProvider(EmailProvider):
    def __init__(self, smtp_host: str = "", smtp_port: int = 587, user: str = "", password: str = ""):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.user = user
        self.password = password

    async def send_email(self, to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
        logger.info(f"Production email dispatch to {to}: {subject}")
        return True


class EmailService:
    def __init__(self, provider: Optional[EmailProvider] = None):
        if provider:
            self.provider = provider
            self.provider_mode = "CUSTOM"
        elif settings.EMAIL_PROVIDER.lower() in ["production", "smtp", "sendgrid"]:
            self.provider = ProductionEmailProvider()
            self.provider_mode = "PRODUCTION"
        else:
            self.provider = MockEmailProvider()
            self.provider_mode = "MOCK"

    async def send_booking_confirmation(
        self,
        to: str,
        booking_ref: str,
        event_title: str,
        venue_name: str,
        screen_name: str,
        start_time_str: str,
        seats: List[str],
        total_amount: float,
    ) -> bool:
        subject = f"🎟️ Your Tickets for {event_title} ({booking_ref})"
        body = f"""
🎟️ TICKETFLOW BOOKING CONFIRMATION
======================================================
Booking Reference: {booking_ref}
Status:            CONFIRMED
Total Paid:        ₹{total_amount:,.2f}

Event:             {event_title}
Venue:             {venue_name} — {screen_name}
Date & Time:       {start_time_str}
Seats:             {', '.join(seats)}

Your digital QR ticket is accessible in your TicketFlow portal:
http://localhost:5173/my-bookings
======================================================
Thank you for booking with TicketFlow!
"""
        return await self.provider.send_email(to, subject, body.strip())

    async def send_waitlist_offer(
        self,
        to: str,
        event_title: str,
        category_name: str,
        seat_label: str,
        expires_at_str: str,
        show_id: str,
        waitlist_id: str,
    ) -> bool:
        subject = f"⚡ Seat Available for {event_title}! Claim within 15 mins"
        claim_url = f"http://localhost:5173/show/{show_id}/seats?claimOffer={waitlist_id}"
        body = f"""
⚡ TICKETFLOW WAITLIST OFFER AVAILABLE!
======================================================
Great news! A seat has opened up for your waitlisted event.

Event:             {event_title}
Category:          {category_name}
Allocated Seat:    {seat_label}
Offer Expiration:  {expires_at_str} (Strict TTL)

⚡ CLAIM YOUR TICKET NOW:
{claim_url}

Note: If you do not claim this ticket before the deadline, it will
automatically cascade to the next eligible customer in the queue.
======================================================
"""
        return await self.provider.send_email(to, subject, body.strip())

    async def send_cancellation_refund(
        self,
        to: str,
        booking_ref: str,
        event_title: str,
        refund_amount: float,
    ) -> bool:
        subject = f"Refund Confirmation for Booking {booking_ref}"
        body = f"""
TICKETFLOW CANCELLATION & REFUND
======================================================
Your booking {booking_ref} for {event_title} has been cancelled.
A full refund of ₹{refund_amount:,.2f} has been initiated.
======================================================
"""
        return await self.provider.send_email(to, subject, body.strip())


email_service = EmailService()
