import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Ticket, Clock, MapPin, Monitor, X, Users, Sparkles, CheckCircle2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Booking, WaitlistEntry } from '../types';

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<'BOOKINGS' | 'WAITLISTS'>('BOOKINGS');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlists, setWaitlists] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingsData, waitlistsData]: any = await Promise.all([
        api.get('/bookings/my'),
        api.get('/waitlist/my').catch(() => []),
      ]);
      setBookings(bookingsData || []);
      setWaitlists(waitlistsData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cancelBooking = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to cancel this booking? Payment will be refunded and seats will be reallocated to waitlist.'
      )
    )
      return;
    try {
      await api.patch(`/bookings/${id}/cancel`);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)));
      toast.success('Booking cancelled and refund initiated');
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to cancel booking');
    }
  };

  const handleClaimOffer = async (waitlistId: string) => {
    setActionLoading(waitlistId);
    try {
      const res: any = await api.post(`/waitlist/${waitlistId}/claim`);
      toast.success('🎉 Waitlist offer claimed successfully!');
      navigate(`/booking/${res.booking.bookingRef}`);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to claim waitlist offer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveWaitlist = async (waitlistId: string) => {
    if (!confirm('Leave this waitlist? You will lose your current FIFO queue position.')) return;
    setActionLoading(waitlistId);
    try {
      await api.post(`/waitlist/${waitlistId}/leave`);
      setWaitlists((prev) => prev.map((w) => (w.id === waitlistId ? { ...w, status: 'CANCELLED' } : w)));
      toast.success('Removed from waitlist');
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to leave waitlist');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  const activeOffersCount = waitlists.filter(
    (w) => w.status === 'OFFER_PENDING' && !w.isOfferExpired
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <Ticket size={24} className="text-rose-500" /> My Purchases & Waitlists
        </h1>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('BOOKINGS')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'BOOKINGS'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ticket size={15} /> Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab('WAITLISTS')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'WAITLISTS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={15} /> Waitlists ({waitlists.length})
            {activeOffersCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
          </button>
        </div>
      </div>

      {activeTab === 'BOOKINGS' ? (
        bookings.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/40 rounded-2xl border border-gray-800 text-gray-500">
            <Ticket size={48} className="mx-auto mb-4 opacity-30 text-gray-400" />
            <p className="text-base font-semibold text-gray-300">No bookings yet.</p>
            <p className="text-xs text-gray-500 mt-1">
              Browse our upcoming movies and concerts to grab your tickets.
            </p>
            <Link to="/" className="btn-primary mt-5 inline-block text-sm">
              Discover Events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="card border-gray-800 hover:border-gray-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-lg text-white">{booking.show?.movie?.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {booking.status}
                      </span>
                      {booking.show?.movie?.eventType && (
                        <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                          {booking.show.movie.eventType}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-gray-400">
                      {booking.show && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-rose-400" />
                            {format(new Date(booking.show.startTime), 'EEE, MMM d yyyy • h:mm a')}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Monitor size={13} className="text-rose-400" />
                            {booking.show.screen?.name}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-rose-400" />
                            {booking.show.screen?.theatre?.name} — {booking.show.screen?.theatre?.city}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-800">
                      <span className="text-xs text-gray-500 mr-1">Seats:</span>
                      {booking.seats.map((bs) => (
                        <span
                          key={bs.id}
                          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2.5 py-0.5 rounded-md font-mono"
                        >
                          {bs.seat?.label} ({bs.seat?.seatType?.name || 'Standard'})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                    <div className="text-xl font-extrabold text-rose-400">
                      ₹{booking.totalAmount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{booking.bookingRef}</div>
                    <div className="flex gap-3 mt-4 sm:justify-end items-center">
                      <Link to={`/booking/${booking.bookingRef}`} className="btn-secondary text-xs py-1.5 px-3">
                        View QR Ticket
                      </Link>
                      {booking.status === 'CONFIRMED' &&
                        booking.show &&
                        new Date(booking.show.startTime) > new Date() && (
                          <button
                            onClick={() => cancelBooking(booking.id)}
                            className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                          >
                            <X size={13} /> Cancel
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : waitlists.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/40 rounded-2xl border border-gray-800 text-gray-500">
          <Users size={48} className="mx-auto mb-4 opacity-30 text-purple-400" />
          <p className="text-base font-semibold text-gray-300">No waitlist entries.</p>
          <p className="text-xs text-gray-500 mt-1">
            If a movie or concert tier sells out, join its waitlist to automatically receive tickets on
            cancellation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {waitlists.map((w) => {
            const isOffer = w.status === 'OFFER_PENDING' && !w.isOfferExpired;
            return (
              <div
                key={w.id}
                className={`card transition-colors ${
                  isOffer
                    ? 'border-2 border-purple-500/80 bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-900'
                    : 'border-gray-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-lg text-white">{w.show?.movie?.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isOffer
                            ? 'bg-purple-900 text-purple-300 border border-purple-500 animate-pulse'
                            : w.status === 'PENDING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : w.status === 'FULFILLED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : w.status === 'EXPIRED'
                            ? 'bg-gray-800 text-gray-400 border border-gray-700'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {isOffer ? '⚡ Offer Available!' : w.status}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-800 text-purple-300">
                        Tier: {w.seatType?.name}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-400">
                      {w.show && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-rose-400" />
                            {format(new Date(w.show.startTime), 'EEE, MMM d yyyy • h:mm a')}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-rose-400" />
                            {w.show.screen?.theatre?.name} — {w.show.screen?.name}
                          </div>
                        </>
                      )}
                    </div>

                    {w.status === 'PENDING' && w.queuePosition && (
                      <div className="mt-3 text-xs text-amber-300 flex items-center gap-1.5">
                        <Users size={14} /> You are{' '}
                        <strong className="text-white">#{w.queuePosition}</strong> in the FIFO waitlist queue
                        for this category.
                      </div>
                    )}

                    {isOffer && (
                      <div className="mt-3 p-3 bg-purple-950/60 rounded-xl border border-purple-500/40 text-xs text-gray-200">
                        <p className="font-semibold text-purple-300 flex items-center gap-1 mb-1">
                          <Sparkles size={14} /> Allocated Seat: {w.offeredSeat?.label || 'Available Seat'}
                        </p>
                        <p className="text-gray-400">
                          Offer expires at:{' '}
                          <span className="font-mono font-bold text-amber-300">
                            {w.offerExpiresAt ? new Date(w.offerExpiresAt).toLocaleTimeString() : 'soon'}
                          </span>
                          . If not claimed, it will cascade to the next user.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="sm:text-right shrink-0 flex sm:flex-col justify-end gap-2">
                    {isOffer && (
                      <button
                        onClick={() => handleClaimOffer(w.id)}
                        disabled={actionLoading === w.id}
                        className="btn-primary bg-purple-600 hover:bg-purple-500 text-xs py-2 px-4 flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        {actionLoading === w.id ? 'Claiming...' : 'Claim Ticket'}
                      </button>
                    )}
                    {(w.status === 'PENDING' || isOffer) && (
                      <button
                        onClick={() => handleLeaveWaitlist(w.id)}
                        disabled={actionLoading === w.id}
                        className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 py-1 sm:justify-end transition-colors"
                      >
                        <Trash2 size={13} /> Leave Waitlist
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
