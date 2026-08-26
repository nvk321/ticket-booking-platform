import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Activity, Clock, Monitor, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import socket from '../../lib/socket';

export default function AdminLiveMonitor() {
  const { screenId } = useParams<{ screenId: string }>();
  const [screen, setScreen] = useState<any>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [selectedShow, setSelectedShow] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!screenId) return;
    api.get(`/screens/${screenId}`).then(setScreen);
    api.get(`/shows/screen/${screenId}`).then((data: any) => {
      setShows(data || []);
      if (data && data.length > 0) {
        setSelectedShow(data[0]);
      }
    });
  }, [screenId]);

  const loadSeats = (showId: string) => {
    setLoading(true);
    api.get(`/shows/${showId}/seats`)
      .then((data: any) => {
        setSeats(data.screen?.seats || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selectedShow) return;
    loadSeats(selectedShow.id);
    socket.connect(selectedShow.id);

    const onHeld = ({ seatIds }: any) => {
      setSeats((p) => p.map((s) => (seatIds.includes(s.id) ? { ...s, status: 'HELD' } : s)));
    };
    const onBooked = ({ seatIds }: any) => {
      setSeats((p) => p.map((s) => (seatIds.includes(s.id) ? { ...s, status: 'BOOKED' } : s)));
    };
    const onRelease = ({ seatIds }: any) => {
      setSeats((p) => p.map((s) => (seatIds?.includes(s.id) ? { ...s, status: 'AVAILABLE' } : s)));
    };

    socket.on('seats:held', onHeld);
    socket.on('seats:booked', onBooked);
    socket.on('seats:released', onRelease);

    return () => {
      socket.off('seats:held', onHeld);
      socket.off('seats:booked', onBooked);
      socket.off('seats:released', onRelease);
      socket.disconnect();
    };
  }, [selectedShow]);

  const bookedCount = seats.filter((s) => s.status === 'BOOKED').length;
  const heldCount = seats.filter((s) => s.status === 'HELD').length;
  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">
          Venues
        </Link>
        <span>/</span>
        <span className="text-white">{screen?.name} — Live Monitor</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity size={24} className="text-rose-500 animate-pulse" /> Live Real-Time Seat Monitor
        </h1>
        {selectedShow && (
          <button onClick={() => loadSeats(selectedShow.id)} className="btn-secondary flex items-center gap-1 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {shows.map((show) => (
          <button
            key={show.id}
            onClick={() => setSelectedShow(show)}
            className={`px-4 py-2 rounded-lg border text-sm transition-all text-left ${
              selectedShow?.id === show.id
                ? 'bg-rose-600 border-rose-600 text-white shadow-lg'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <div className="font-semibold">{show.movie?.title}</div>
            <div className="text-xs opacity-80">{new Date(show.startTime).toLocaleTimeString()}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <div className="card p-3">
          <div className="text-2xl font-bold text-emerald-400">{availableCount}</div>
          <div className="text-xs text-gray-400">Available</div>
        </div>
        <div className="card p-3">
          <div className="text-2xl font-bold text-amber-400">{heldCount}</div>
          <div className="text-xs text-gray-400">Active Holds</div>
        </div>
        <div className="card p-3">
          <div className="text-2xl font-bold text-rose-500">{bookedCount}</div>
          <div className="text-xs text-gray-400">Confirmed</div>
        </div>
      </div>

      <div className="card">
        <div className="text-center text-xs text-gray-500 uppercase tracking-widest mb-4">Stage / Screen</div>
        <div className="flex flex-wrap gap-1 justify-center max-w-2xl mx-auto">
          {seats.map((seat) => (
            <div
              key={seat.id}
              title={`${seat.label} (${seat.status})`}
              className={`w-6 h-6 rounded-t flex items-center justify-center text-[9px] font-mono font-bold ${
                seat.status === 'BOOKED'
                  ? 'bg-red-900 text-red-300'
                  : seat.status === 'HELD'
                  ? 'bg-amber-800 text-amber-200 animate-pulse'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {seat.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
