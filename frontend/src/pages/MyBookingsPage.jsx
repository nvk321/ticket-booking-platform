import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Ticket, Clock, MapPin, Monitor, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings/my').then(setBookings).finally(() => setLoading(false));
  }, []);

  const cancelBooking = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await api.patch(`/bookings/${id}/cancel`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error(err.error || 'Failed to cancel');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Ticket size={24} className="text-rose-500" /> My Bookings
      </h1>

      {bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Ticket size={48} className="mx-auto mb-4 opacity-30" />
          <p>No bookings yet.</p>
          <Link to="/" className="btn-primary mt-4 inline-block">Browse Movies</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{booking.show.movie.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      booking.status === 'CONFIRMED' ? 'bg-green-900/50 text-green-400' :
                      booking.status === 'CANCELLED' ? 'bg-red-900/50 text-red-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {booking.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      {format(new Date(booking.show.startTime), 'EEE, MMM d yyyy • h:mm a')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Monitor size={12} />
                      {booking.show.screen.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} />
                      {booking.show.screen.theatre.name}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {booking.seats.map(bs => (
                      <span key={bs.id} className="bg-gray-800 text-xs px-2 py-0.5 rounded font-mono">
                        {bs.seat.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-rose-400">₹{booking.totalAmount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 font-mono mt-1">{booking.bookingRef}</div>
                  <div className="flex gap-2 mt-3 justify-end">
                    <Link to={`/booking/${booking.bookingRef}`} className="text-xs text-rose-400 hover:underline">
                      View
                    </Link>
                    {booking.status === 'CONFIRMED' && new Date(booking.show.startTime) > new Date() && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-0.5"
                      >
                        <X size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
