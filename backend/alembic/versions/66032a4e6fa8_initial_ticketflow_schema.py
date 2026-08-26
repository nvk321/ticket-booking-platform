"""initial_ticketflow_schema

Revision ID: 66032a4e6fa8
Revises: 
Create Date: 2026-08-26 16:56:51.932552

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '66032a4e6fa8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='CUSTOMER'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True, if_not_exists=True)

    # 2. theatres
    op.create_table(
        'theatres',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True, server_default='India'),
        sa.Column('admin_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('primary_color', sa.String(), nullable=True, server_default='#e11d48'),
        sa.Column('accent_color', sa.String(), nullable=True, server_default='#f59e0b'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_theatres_slug', 'theatres', ['slug'], unique=True, if_not_exists=True)
    op.create_index('ix_theatres_city', 'theatres', ['city'], unique=False, if_not_exists=True)

    # 3. screens
    op.create_table(
        'screens',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('theatre_id', sa.String(), sa.ForeignKey('theatres.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('cols', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('theatre_id', 'name', name='uq_screen_theatre_name'),
        if_not_exists=True,
    )

    # 4. seat_types
    op.create_table(
        'seat_types',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('color', sa.String(), nullable=False, server_default='#4f46e5'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )

    # 5. seats
    op.create_table(
        'seats',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('screen_id', sa.String(), sa.ForeignKey('screens.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seat_type_id', sa.String(), sa.ForeignKey('seat_types.id', ondelete='SET NULL'), nullable=True),
        sa.Column('row', sa.Integer(), nullable=False),
        sa.Column('col', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('row_label', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='ACTIVE'),
        sa.Column('is_golden', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_accessible', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('custom_price', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('screen_id', 'row', 'col', name='uq_seat_screen_row_col'),
        sa.UniqueConstraint('screen_id', 'label', name='uq_seat_screen_label'),
        if_not_exists=True,
    )

    # 6. movies
    op.create_table(
        'movies',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_type', sa.String(), nullable=False, server_default='MOVIE'),
        sa.Column('duration', sa.Integer(), nullable=False, server_default='120'),
        sa.Column('genre', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('language', sa.String(), nullable=False, server_default='English'),
        sa.Column('rating', sa.String(), nullable=True),
        sa.Column('poster_url', sa.String(), nullable=True),
        sa.Column('trailer_url', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_movies_title', 'movies', ['title'], unique=False, if_not_exists=True)

    # 7. shows
    op.create_table(
        'shows',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('screen_id', sa.String(), sa.ForeignKey('screens.id', ondelete='CASCADE'), nullable=False),
        sa.Column('movie_id', sa.String(), sa.ForeignKey('movies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('available_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('available_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_shows_start_time', 'shows', ['start_time'], unique=False, if_not_exists=True)

    # 8. screen_pricing
    op.create_table(
        'screen_pricing',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('screen_id', sa.String(), sa.ForeignKey('screens.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seat_type_id', sa.String(), sa.ForeignKey('seat_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('base_price', sa.Float(), nullable=False),
        sa.Column('weekend_price', sa.Float(), nullable=True),
        sa.Column('peak_price', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('screen_id', 'seat_type_id', name='uq_screen_pricing_tier'),
        if_not_exists=True,
    )

    # 9. seat_holds
    op.create_table(
        'seat_holds',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('seat_id', sa.String(), sa.ForeignKey('seats.id', ondelete='CASCADE'), nullable=False),
        sa.Column('show_id', sa.String(), sa.ForeignKey('shows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('seat_id', 'show_id', name='uq_seat_holds_seat_show'),
        if_not_exists=True,
    )
    op.create_index('ix_seat_holds_expires_at', 'seat_holds', ['expires_at'], unique=False, if_not_exists=True)
    op.create_index('ix_seat_holds_session_id', 'seat_holds', ['session_id'], unique=False, if_not_exists=True)

    # 10. bookings
    op.create_table(
        'bookings',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('booking_ref', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('show_id', sa.String(), sa.ForeignKey('shows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='CONFIRMED'),
        sa.Column('qr_code', sa.Text(), nullable=True),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('payment_method', sa.String(), nullable=True, server_default='MOCK'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_bookings_booking_ref', 'bookings', ['booking_ref'], unique=True, if_not_exists=True)

    # 11. booking_seats
    op.create_table(
        'booking_seats',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('booking_id', sa.String(), sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seat_id', sa.String(), sa.ForeignKey('seats.id', ondelete='CASCADE'), nullable=False),
        sa.Column('show_id', sa.String(), sa.ForeignKey('shows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('is_cancelled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('booking_id', 'seat_id', name='uq_booking_seats_booking_seat'),
        if_not_exists=True,
    )

    # CRITICAL: PostgreSQL partial unique index for Anti-Double-Booking Guarantee
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_booking_seats_show_seat_active 
        ON booking_seats (show_id, seat_id) 
        WHERE is_cancelled = false;
    """)

    # 12. payments
    op.create_table(
        'payments',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('booking_id', sa.String(), sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(), nullable=False, server_default='SUCCESS'),
        sa.Column('gateway', sa.String(), nullable=True, server_default='MOCK'),
        sa.Column('gateway_ref', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('booking_id', name='uq_payments_booking_id'),
        if_not_exists=True,
    )

    # 13. waitlists
    op.create_table(
        'waitlists',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('show_id', sa.String(), sa.ForeignKey('shows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seat_type_id', sa.String(), sa.ForeignKey('seat_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('offered_seat_id', sa.String(), sa.ForeignKey('seats.id', ondelete='SET NULL'), nullable=True),
        sa.Column('offer_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        if_not_exists=True,
    )
    op.create_index('ix_waitlists_status', 'waitlists', ['status'], unique=False, if_not_exists=True)
    op.create_index('ix_waitlists_offer_expires_at', 'waitlists', ['offer_expires_at'], unique=False, if_not_exists=True)
    op.create_index('ix_waitlists_created_at', 'waitlists', ['created_at'], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_booking_seats_show_seat_active;")
    op.drop_table('waitlists')
    op.drop_table('payments')
    op.drop_table('booking_seats')
    op.drop_table('bookings')
    op.drop_table('seat_holds')
    op.drop_table('screen_pricing')
    op.drop_table('shows')
    op.drop_table('movies')
    op.drop_table('seats')
    op.drop_table('seat_types')
    op.drop_table('screens')
    op.drop_table('theatres')
    op.drop_table('users')
