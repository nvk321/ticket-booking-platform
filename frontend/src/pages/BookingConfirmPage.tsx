import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, Ticket, MapPin, Monitor, Clock, Mail, Info } from 'lucide-react';
import api from '../lib/api';
import { Booking } from '../types';

export default function BookingConfirmPage() {
  const { ref } = useParams<{ ref: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!ref) return;
    api.get(`/bookings/${ref}`)
      .then((data: any) => setBooking(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ref]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (!booking) {
    return <div className="text-center py-16 text-gray-500">Booking not found</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
        <p className="text-gray-400 mt-1">Your tickets are ready</p>
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Booking Ref</div>
            <div className="font-mono font-bold text-rose-400 text-lg">{booking.bookingRef}</div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              booking.status === 'CONFIRMED'
                ? 'bg-green-900/50 text-green-400'
                : 'bg-red-900/50 text-red-400'
            }`}
          >
            {booking.status}
          </span>
        </div>

        <h2 className="font-bold text-xl mb-3">{booking.show?.movie?.title}</h2>

        <div className="space-y-2 text-sm text-gray-400 mb-4">
          {booking.show && (
            <>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-rose-400" />
                {format(new Date(booking.show.startTime), 'EEEE, MMMM d yyyy • h:mm a')}
              </div>
              <div className="flex items-center gap-2">
                <Monitor size={14} className="text-rose-400" />
                {booking.show.screen?.name}
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-rose-400" />
                {booking.show.screen?.theatre?.name}, {booking.show.screen?.theatre?.city}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-500 mb-2">Seats</div>
          <div className="flex flex-wrap gap-2">
            {booking.seats.map((bs) => (
              <span key={bs.id} className="bg-gray-700 px-2 py-1 rounded text-sm font-mono">
                {bs.seat?.label}
                {bs.seat?.seatType?.name && (
                  <span className="text-gray-400 text-xs ml-1">({bs.seat.seatType.name})</span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between font-bold text-lg">
          <span>Total Paid</span>
          <span className="text-rose-400">₹{booking.totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Transparent Email Notification Notice */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 mb-4 text-xs text-gray-400 flex items-start gap-2.5">
        <Mail size={16} className="text-rose-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-gray-300 font-medium">
            {booking.notificationStatus === 'SENT'
              ? 'Confirmation email dispatched to your inbox.'
              : 'Confirmation email simulated (demo mode).'}
          </p>
          <p className="text-gray-500 mt-0.5">
            Your digital QR ticket below and in{' '}
            <Link to="/my-bookings" className="text-rose-400 hover:underline">
              My Bookings
            </Link>{' '}
            is your primary reliable ticket source.
          </p>
        </div>
      </div>

      {booking.qrCode && (
        <div className="card text-center mb-4">
          <div className="text-sm text-gray-400 mb-3 flex items-center justify-center gap-1">
            <Ticket size={14} /> Show this QR at the entrance
          </div>
          <img src={booking.qrCode} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg shadow-md" />
        </div>
      )}

      <div className="flex gap-3">
        <Link to="/my-bookings" className="btn-secondary flex-1 text-center">
          My Bookings
        </Link>
        <Link to="/" className="btn-primary flex-1 text-center">
          Book More
        </Link>
      </div>
    </div>
  );
}
