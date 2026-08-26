import os
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.integrations.qr import generate_ticket_qr
from app.models.base import (
    Booking,
    BookingSeat,
    Movie,
    Payment,
    Screen,
    ScreenPricing,
    Seat,
    SeatType,
    Show,
    Theatre,
    User,
    Waitlist,
    WaitlistStatus,
)


async def seed_data(reset: bool = False):
    print("[SEED] Connecting to PostgreSQL...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        if reset:
            print("[SEED] Explicit reset requested: Clearing existing transactional records...")
            await db.execute(delete(BookingSeat))
            await db.execute(delete(Payment))
            await db.execute(delete(Booking))
            await db.execute(delete(Waitlist))
            await db.commit()

        # 1. Users
        print("[SEED] Seeding Demo Users...")
        # Admin / Organiser
        user_res = await db.execute(select(User).where(User.email == "admin@theatre.com"))
        admin_user = user_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email="admin@theatre.com",
                password=get_password_hash("admin123"),
                name="Theatre Organiser",
                role="ORGANISER",
            )
            db.add(admin_user)
            await db.flush()

        # Customer
        user_res = await db.execute(select(User).where(User.email == "user@theatre.com"))
        customer_user = user_res.scalar_one_or_none()
        if not customer_user:
            customer_user = User(
                email="user@theatre.com",
                password=get_password_hash("user123"),
                name="Movie Fan",
                role="CUSTOMER",
            )
            db.add(customer_user)
            await db.flush()

        # Super Admin
        user_res = await db.execute(select(User).where(User.email == "superadmin@theatre.com"))
        super_admin = user_res.scalar_one_or_none()
        if not super_admin:
            super_admin = User(
                email="superadmin@theatre.com",
                password=get_password_hash("admin123"),
                name="System Super Admin",
                role="ADMIN",
            )
            db.add(super_admin)
            await db.flush()

        await db.commit()

        # 2. Seat Categories
        print("[SEED] Seeding Seat Categories...")
        seat_types_data = [
            {"name": "Royal", "color": "#9333ea", "description": "Front-row luxury recliner seating with VIP acoustics"},
            {"name": "Balcony", "color": "#f59e0b", "description": "Elevated panoramic viewing deck with spacious legroom"},
            {"name": "First Class", "color": "#10b981", "description": "Prime central sound field with plush ergonomic seats"},
            {"name": "Standard", "color": "#6b7280", "description": "Comfortable auditorium seating with crystal clear sightlines"},
        ]
        seat_type_map = {}
        for st in seat_types_data:
            st_res = await db.execute(select(SeatType).where(SeatType.name == st["name"]))
            existing_st = st_res.scalar_one_or_none()
            if not existing_st:
                existing_st = SeatType(name=st["name"], color=st["color"], description=st["description"])
                db.add(existing_st)
                await db.flush()
            seat_type_map[st["name"]] = existing_st

        # 3. Venues
        print("[SEED] Seeding Venues & Theatres...")
        theatres_data = [
            {
                "name": "CinePlex Mumbai Grand",
                "slug": "cineplex-mumbai-grand",
                "address": "Phoenix Palladium Mall, Lower Parel",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "primary_color": "#e11d48",
                "accent_color": "#f59e0b",
            },
            {
                "name": "PVR Forum Mall Arena",
                "slug": "pvr-forum-mall-arena",
                "address": "Koramangala, Hosur Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "country": "India",
                "primary_color": "#9333ea",
                "accent_color": "#ec4899",
            },
            {
                "name": "Royal Opera Live Stage",
                "slug": "royal-opera-live-stage",
                "address": "Connaught Place, Central Delhi",
                "city": "Delhi",
                "state": "Delhi",
                "country": "India",
                "primary_color": "#3b82f6",
                "accent_color": "#10b981",
            },
        ]
        theatres = []
        for td in theatres_data:
            t_res = await db.execute(select(Theatre).where(Theatre.slug == td["slug"]))
            existing_t = t_res.scalar_one_or_none()
            if not existing_t:
                existing_t = Theatre(
                    name=td["name"],
                    slug=td["slug"],
                    address=td["address"],
                    city=td["city"],
                    state=td["state"],
                    country=td["country"],
                    admin_id=admin_user.id,
                    primary_color=td["primary_color"],
                    accent_color=td["accent_color"],
                )
                db.add(existing_t)
                await db.flush()
            theatres.append(existing_t)

        # 4. Screens, Physical Seats, and Pricing
        print("[SEED] Seeding Screens, Physical Seats, and Pricing...")
        all_screens = []
        for theatre in theatres:
            for s_idx in range(1, 3):
                s_name = f"Audi {s_idx}" if "Stage" not in theatre.name else f"Hall {s_idx}"
                sc_res = await db.execute(
                    select(Screen).where(Screen.theatre_id == theatre.id, Screen.name == s_name)
                )
                screen = sc_res.scalar_one_or_none()
                if not screen:
                    screen = Screen(
                        theatre_id=theatre.id,
                        name=s_name,
                        rows=8,
                        cols=12,
                        capacity=96,
                    )
                    db.add(screen)
                    await db.flush()

                    # Pricing
                    pricing_tiers = [
                        {"st": seat_type_map["Royal"], "base": 550.0, "weekend": 650.0, "peak": 750.0},
                        {"st": seat_type_map["Balcony"], "base": 400.0, "weekend": 480.0, "peak": 550.0},
                        {"st": seat_type_map["First Class"], "base": 280.0, "weekend": 340.0, "peak": 390.0},
                        {"st": seat_type_map["Standard"], "base": 180.0, "weekend": 220.0, "peak": 250.0},
                    ]
                    for pt in pricing_tiers:
                        sp = ScreenPricing(
                            screen_id=screen.id,
                            seat_type_id=pt["st"].id,
                            base_price=pt["base"],
                            weekend_price=pt["weekend"],
                            peak_price=pt["peak"],
                        )
                        db.add(sp)

                    # Physical Seats
                    for r in range(8):
                        row_label = chr(65 + r)
                        if r < 2:
                            st_obj = seat_type_map["Royal"]
                        elif r < 4:
                            st_obj = seat_type_map["Balcony"]
                        elif r < 6:
                            st_obj = seat_type_map["First Class"]
                        else:
                            st_obj = seat_type_map["Standard"]

                        for c in range(12):
                            seat_label = f"{row_label}{c + 1}"
                            is_golden = (r in [2, 3, 4] and c in [4, 5, 6, 7])
                            is_accessible = (r == 7 and c in [0, 1, 10, 11])
                            seat = Seat(
                                screen_id=screen.id,
                                row=r,
                                col=c,
                                label=seat_label,
                                row_label=row_label,
                                seat_type_id=st_obj.id,
                                status="ACTIVE",
                                is_golden=is_golden,
                                is_accessible=is_accessible,
                                custom_price=None,
                            )
                            db.add(seat)
                all_screens.append(screen)

        # 5. Events (Movies & Concerts)
        print("[SEED] Seeding Events (Movies & Live Concerts)...")
        events_data = [
            {
                "title": "Dune: Part Two",
                "description": "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
                "event_type": "MOVIE",
                "duration": 166,
                "genre": ["Sci-Fi", "Adventure", "Action"],
                "language": "English",
                "rating": "U/A 16+",
                "poster_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
                "trailer_url": "https://www.youtube.com/watch?v=Way9Dexny3w",
            },
            {
                "title": "Oppenheimer",
                "description": "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during WWII.",
                "event_type": "MOVIE",
                "duration": 180,
                "genre": ["Biography", "Drama", "History"],
                "language": "English",
                "rating": "A",
                "poster_url": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&auto=format&fit=crop&q=80",
                "trailer_url": "https://www.youtube.com/watch?v=uYPbbksJxIg",
            },
            {
                "title": "Coldplay: Music of the Spheres Live",
                "description": "Experience Coldplay's record-breaking Music of the Spheres world tour with kinetic dance floors, laser spectacles, and iconic anthems.",
                "event_type": "CONCERT",
                "duration": 150,
                "genre": ["Rock", "Pop", "Live Concert"],
                "language": "English",
                "rating": "U",
                "poster_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
                "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
                "title": "A.R. Rahman: Symphony of Dreams",
                "description": "Academy Award-winning maestro A.R. Rahman leads a 100-piece orchestral symphony performing legendary soundtracks live.",
                "event_type": "CONCERT",
                "duration": 180,
                "genre": ["Classical", "Fusion", "World Music"],
                "language": "Hindi/Tamil",
                "rating": "U",
                "poster_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
                "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        ]
        events = []
        for ed in events_data:
            e_res = await db.execute(select(Movie).where(Movie.title == ed["title"]))
            existing_e = e_res.scalar_one_or_none()
            if not existing_e:
                existing_e = Movie(
                    title=ed["title"],
                    description=ed["description"],
                    event_type=ed["event_type"],
                    duration=ed["duration"],
                    genre=ed["genre"],
                    language=ed["language"],
                    rating=ed["rating"],
                    poster_url=ed["poster_url"],
                    trailer_url=ed["trailer_url"],
                    is_active=True,
                )
                db.add(existing_e)
                await db.flush()
            events.append(existing_e)

        # 6. Shows & Schedules
        print("[SEED] Seeding Shows & Schedules...")
        created_shows = []
        now = datetime.now(timezone.utc)
        for day_offset in range(0, 5):
            day = now.date() + timedelta(days=day_offset)
            for sc in all_screens:
                for idx, ev in enumerate(events):
                    hours = [10, 14, 18, 21][idx % 4]
                    mins = [0, 30, 0, 30][idx % 4]
                    start_dt = datetime(day.year, day.month, day.day, hours, mins, tzinfo=timezone.utc)
                    end_dt = start_dt + timedelta(minutes=ev.duration + 20)

                    sh_res = await db.execute(
                        select(Show).where(Show.screen_id == sc.id, Show.start_time == start_dt)
                    )
                    existing_show = sh_res.scalar_one_or_none()
                    if not existing_show:
                        existing_show = Show(
                            screen_id=sc.id,
                            movie_id=ev.id,
                            start_time=start_dt,
                            end_time=end_dt,
                            is_active=True,
                        )
                        db.add(existing_show)
                        await db.flush()
                    created_shows.append(existing_show)

        # 7. Seed Demo Bookings & QR Codes for Customer User
        print("[SEED] Seeding Demo Bookings & Waitlist Records for Customer...")
        bk_check = await db.execute(select(Booking).where(Booking.user_id == customer_user.id))
        if not bk_check.scalars().first() and created_shows:
            demo_show = created_shows[0]
            seats_res = await db.execute(
                select(Seat).where(Seat.screen_id == demo_show.screen_id).limit(4)
            )
            demo_seats = seats_res.scalars().all()
            if len(demo_seats) >= 2:
                # Confirmed Booking 1
                ref_1 = "BK" + datetime.now().strftime("%y%m%d%H%M") + "DEMO"
                qr_code_1 = generate_ticket_qr({
                    "bookingRef": ref_1,
                    "showId": demo_show.id,
                    "seats": [demo_seats[0].label, demo_seats[1].label],
                    "totalAmount": 1100.0,
                })
                bk1 = Booking(
                    booking_ref=ref_1,
                    user_id=customer_user.id,
                    show_id=demo_show.id,
                    total_amount=1100.0,
                    status="CONFIRMED",
                    qr_code=qr_code_1,
                )
                db.add(bk1)
                await db.flush()

                bs1 = BookingSeat(booking_id=bk1.id, seat_id=demo_seats[0].id, show_id=demo_show.id, price=550.0, is_cancelled=False)
                bs2 = BookingSeat(booking_id=bk1.id, seat_id=demo_seats[1].id, show_id=demo_show.id, price=550.0, is_cancelled=False)
                db.add_all([bs1, bs2])

                p1 = Payment(booking_id=bk1.id, amount=1100.0, currency="INR", status="SUCCESS", gateway="MOCK")
                db.add(p1)

                # Waitlist entry for another show
                if len(created_shows) > 1:
                    other_show = created_shows[1]
                    wl = Waitlist(
                        user_id=customer_user.id,
                        show_id=other_show.id,
                        seat_type_id=seat_type_map["Royal"].id,
                        status=WaitlistStatus.PENDING.value,
                    )
                    db.add(wl)

        await db.commit()
        print("[SUCCESS] TicketFlow database successfully seeded with complete demo dataset!")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv or os.getenv("RESET_DB", "").lower() in ["1", "true"]
    asyncio.run(seed_data(reset=reset_flag))
