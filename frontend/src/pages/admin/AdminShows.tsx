import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Calendar, Clock, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Movie, Screen, Show } from '../../types';

export default function AdminShows() {
  const { screenId } = useParams<{ screenId: string }>();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [form, setForm] = useState({
    movieId: '',
    startTime: '',
    endTime: '',
    availableFrom: '',
    availableTo: '',
  });
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!screenId) return;
    api.get(`/screens/${screenId}`).then((data: any) => setScreen(data));
    api.get('/movies').then((data: any) => setMovies(data || []));
  }, [screenId]);

  useEffect(() => {
    if (!screenId) return;
    api.get(`/shows/screen/${screenId}?date=${selectedDate}`).then((data: any) => setShows(data || []));
  }, [screenId, selectedDate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/shows', {
        screen_id: screenId,
        movie_id: form.movieId,
        start_time: new Date(form.startTime).toISOString(),
        end_time: new Date(form.endTime).toISOString(),
        available_from: form.availableFrom ? new Date(form.availableFrom).toISOString() : null,
        available_to: form.availableTo ? new Date(form.availableTo).toISOString() : null,
      });
      const refetched: any = await api.get(`/shows/screen/${screenId}?date=${selectedDate}`);
      setShows(refetched || []);
      setShowForm(false);
      setForm({ movieId: '', startTime: '', endTime: '', availableFrom: '', availableTo: '' });
      toast.success('Show created');
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to create show');
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = async (showId: string) => {
    try {
      const updated: any = await api.patch(`/shows/${showId}/toggle`);
      setShows((prev) => prev.map((s) => (s.id === showId ? { ...s, isActive: updated.isActive } : s)));
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to toggle');
    }
  };

  const handleMovieChange = (movieId: string) => {
    const movie = movies.find((m) => m.id === movieId);
    setForm((prev) => {
      const updated = { ...prev, movieId };
      if (movie && prev.startTime) {
        const start = new Date(prev.startTime);
        const end = new Date(start.getTime() + (movie.duration + 15) * 60000);
        updated.endTime = format(end, "yyyy-MM-dd'T'HH:mm");
      }
      return updated;
    });
  };

  const handleStartTimeChange = (startTime: string) => {
    const movie = movies.find((m) => m.id === form.movieId);
    setForm((prev) => {
      const updated = { ...prev, startTime };
      if (movie && startTime) {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + (movie.duration + 15) * 60000);
        updated.endTime = format(end, "yyyy-MM-dd'T'HH:mm");
      }
      return updated;
    });
  };

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">
          Venues
        </Link>
        <span>/</span>
        <Link to={`/admin/theatres/${screen?.theatreId}/screens`} className="hover:text-white">
          Screens
        </Link>
        <span>/</span>
        <span className="text-white">{screen?.name} — Shows</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar size={20} className="text-rose-500" /> Shows — {screen?.name}
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Show
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {dates.map((d) => {
          const val = format(d, 'yyyy-MM-dd');
          const isSelected = val === selectedDate;
          return (
            <button
              key={val}
              onClick={() => setSelectedDate(val)}
              className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="text-xs">{format(d, 'EEE')}</span>
              <span className="font-bold">{format(d, 'd')}</span>
            </button>
          );
        })}
      </div>

      {shows.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p>No shows for this date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shows.map((show) => (
            <div key={show.id} className="card flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="font-bold text-lg">{format(new Date(show.startTime), 'h:mm')}</div>
                  <div className="text-xs text-gray-400">{format(new Date(show.startTime), 'a')}</div>
                </div>
                <div>
                  <div className="font-semibold">{show.movie?.title}</div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <Clock size={12} />
                    {format(new Date(show.startTime), 'h:mm a')} – {format(new Date(show.endTime), 'h:mm a')}
                    <span>•</span>
                    <span>{show.movie?.duration} min</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    show.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {show.isActive ? 'Active' : 'Disabled'}
                </span>
                <button onClick={() => toggleShow(show.id)} className="text-gray-400 hover:text-white">
                  {show.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">Add Show — {screen?.name}</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="label">Event / Movie</label>
                <select
                  className="input"
                  value={form.movieId}
                  onChange={(e) => handleMovieChange(e.target.value)}
                  required
                >
                  <option value="">Select event...</option>
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.duration} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.endTime}
                    onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Creating...' : 'Create Show'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
