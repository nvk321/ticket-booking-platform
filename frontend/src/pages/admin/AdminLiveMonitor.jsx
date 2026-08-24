import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, Monitor, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import socket from '../../lib/socket';

const STATUS_COLORS = {
  AVAILABLE: 'bg-gray-700',
  BOOKED: 'bg-red-600',
  HELD: 'bg-yellow-500',
  BLOCKED: 'bg-gray-800 opacity-40',
};

export default function AdminLiveMonitor() {
  const { screenId } = useParams();
  const [screen, setScreen] = useState(null);
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    api.get(`/screens/${screenId}`).then(setScreen);
    api.get(`/shows/screen/${screenId}?date=${format(new Date(), 'yyyy-MM-dd')}`).then(data => {
      setShows(data);
      if (data.length > 0) setSelectedShow(data[0]);
    });

    socket.emit('screen:watch', { screenId });

    return () => socket.off('seats:held');
  }, [screenId]);

  useEffect(() => {
    if (!selectedShow) return;
    loadSeats();

    socket.emit('show:join', { showId: selectedShow.id });

    const handleUpdate = () => { loadSeats(); setLastUpdate(new Date()); };
    socket.on('seats:held', handleUpdate);
    socket.on('seats:booked', handleUpdate);
    socket.on('seats:released', handleUpdate);
    socket.on('seats:holdExpired', handleUpdate);

    return () => {
      socket.emit('show:leave', { showId: selectedShow.id });
      socket.off('seats:held', handleUpdate);
      socket.off('seats:booked', handleUpdate);
      socket.off('seats:released', handleUpdate);
      socket.off('seats:holdExpired', handleUpdate);
    };
  }, [selectedShow]);

  const loadSeats = async () => {
    if (!selectedShow) return;
    setLoading(true);
    try {
      const data = await api.get(`/shows/${selectedShow.id}/seats`);
      setSeats(data.screen.seats);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    available: seats.filter(s => s.status === 'AVAILABLE').length,
    booked: seats.filter(s => s.status === 'BOOKED').length,
    held: seats.filter(s => s.status === 'HELD').length,
    blocked: seats.filter(s => s.status === 'BLOCKED').length,
  };

  const maxRow = seats.length > 0 ? Math.max(...seats.map(s => s.row)) : 0;
  const maxCol = seats.length > 0 ? Math.max(...seats.map(s => s.col)) : 0;
  const seatMap = new Map(seats.map(s => [`${s.row}-${s.col}`, s]));

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <span className="text-white">Live Monitor — {screen?.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity size={20} className="text-rose-500 animate-pulse" /> Live Monitor — {screen?.name}
        </h1>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              Updated: {format(lastUpdate, 'h:mm:ss a')}
            </span>
          )}
          <button onClick={loadSeats} disabled={loading} className="btn-secondary flex items-center gap-1 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Show Selector */}
      {shows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {shows.map(show => (
            <button
              key={show.id}
              onClick={() => setSelectedShow(show)}
              className={`shrink-0 px-4 py-2 rounded-lg border text-sm transition-colors ${
                selectedShow?.id === show.id
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold">{format(new Date(show.startTime), 'h:mm a')}</div>
              <div className="text-xs opacity-70">{show.movie.title}</div>
            </button>
          ))}
        </div>
      )}

      {selectedShow && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Available', value: stats.available, color: 'text-gray-300', bg: 'bg-gray-700' },
              { label: 'Booked', value: stats.booked, color: 'text-red-400', bg: 'bg-red-900/30' },
              { label: 'Held', value: stats.held, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
              { label: 'Blocked', value: stats.blocked, color: 'text-gray-500', bg: 'bg-gray-800' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`card ${bg} text-center`}>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>

          {/* Occupancy bar */}
          <div className="card mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Occupancy</span>
              <span className="font-bold">
                {seats.length > 0 ? Math.round((stats.booked / seats.length) * 100) : 0}%
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
              <div className="bg-red-600 h-full transition-all" style={{ width: `${seats.length > 0 ? (stats.booked / seats.length) * 100 : 0}%` }} />
              <div className="bg-yellow-500 h-full transition-all" style={{ width: `${seats.length > 0 ? (stats.held / seats.length) * 100 : 0}%` }} />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" />Booked</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Held</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />Available</span>
            </div>
          </div>

          {/* Live Seat Grid */}
          <div className="card overflow-auto seat-grid">
            <div className="text-center mb-4">
              <div className="inline-block bg-gradient-to-b from-gray-300 to-gray-500 h-1.5 w-48 rounded-full" />
              <div className="text-xs text-gray-500 mt-1">SCREEN</div>
            </div>
            <div className="inline-block">
              {Array.from({ length: maxRow + 1 }, (_, r) => {
                const rowSeats = seats.filter(s => s.row === r);
                if (rowSeats.length === 0) return null;
                return (
                  <div key={r} className="flex items-center gap-0.5 mb-0.5">
                    <span className="w-5 text-xs text-gray-500 text-right shrink-0">
                      {rowSeats[0]?.rowLabel || String.fromCharCode(65 + r)}
                    </span>
                    <div className="flex gap-0.5 ml-1">
                      {Array.from({ length: maxCol + 1 }, (_, c) => {
                        const seat = seatMap.get(`${r}-${c}`);
                        if (!seat) return <div key={c} className="w-5 h-5" />;
                        return (
                          <div
                            key={c}
                            title={`${seat.label} — ${seat.status}`}
                            className={`w-5 h-5 rounded-t transition-colors ${STATUS_COLORS[seat.status] || 'bg-gray-700'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
