import React, { useEffect, useState } from 'react';
import { Plus, Film, Clock, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Movie } from '../../types';

const EMPTY = {
  title: '',
  description: '',
  eventType: 'MOVIE',
  duration: 120,
  genre: '',
  language: 'English',
  rating: 'U/A',
  posterUrl: '',
  trailerUrl: '',
};

export default function AdminMovies() {
  const [events, setEvents] = useState<Movie[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    api.get('/movies').then((data: any) => setEvents(data || []));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (m: Movie) => {
    setEditing(m.id);
    setForm({
      ...m,
      eventType: m.eventType || 'MOVIE',
      genre: m.genre?.join(', ') || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        event_type: form.eventType || 'MOVIE',
        duration: +form.duration,
        genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : [],
        language: form.language,
        rating: form.rating,
        poster_url: form.posterUrl,
        trailer_url: form.trailerUrl,
      };
      if (editing) {
        const updated: any = await api.put(`/movies/${editing}`, payload);
        setEvents((prev) => prev.map((m) => (m.id === editing ? updated : m)));
        toast.success('Event updated');
      } else {
        const created: any = await api.post('/movies', payload);
        setEvents((prev) => [...prev, created]);
        toast.success('Event created');
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Film size={24} className="text-rose-500" /> Event & Entertainment Catalog
          </h1>
          <p className="text-xs text-gray-400 mt-1">Manage movies, concerts, and live entertainment showtimes.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Event
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="font-bold text-lg text-white">{editing ? 'Edit Event' : 'Add New Event'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="label">Event Type</label>
                <select
                  className="input"
                  value={form.eventType}
                  onChange={(e) => setForm((p: any) => ({ ...p, eventType: e.target.value }))}
                >
                  <option value="MOVIE">🎬 Movie Feature</option>
                  <option value="CONCERT">🎸 Live Concert / Musical Show</option>
                  <option value="PLAY">🎭 Theatre Play</option>
                  <option value="STANDUP">🎤 Standup Comedy</option>
                </select>
              </div>

              {[
                { key: 'title', label: 'Event Title', required: true, placeholder: 'e.g. Dune: Part Two or Coldplay Live' },
                { key: 'description', label: 'Description', placeholder: 'Event synopsis or performer details' },
                { key: 'posterUrl', label: 'Poster / Banner Image URL', placeholder: 'https://...' },
                { key: 'trailerUrl', label: 'Trailer / Promo Video URL', placeholder: 'https://...' },
              ].map(({ key, label, required, placeholder }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    placeholder={placeholder}
                    value={form[key] || ''}
                    required={required}
                    onChange={(e) => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.duration}
                    onChange={(e) => setForm((p: any) => ({ ...p, duration: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Age Rating / Certification</label>
                  <select
                    className="input"
                    value={form.rating}
                    onChange={(e) => setForm((p: any) => ({ ...p, rating: e.target.value }))}
                  >
                    {['U', 'U/A', 'U/A 16+', 'A', 'S'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Primary Language</label>
                  <input
                    className="input"
                    value={form.language}
                    onChange={(e) => setForm((p: any) => ({ ...p, language: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Genres / Tags (comma-separated)</label>
                  <input
                    className="input"
                    placeholder="Action, Sci-Fi, Live Rock"
                    value={form.genre}
                    onChange={(e) => setForm((p: any) => ({ ...p, genre: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-800">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editing ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {events.map((event) => {
          const isConcert = event.eventType === 'CONCERT';
          return (
            <div key={event.id} className="card p-0 overflow-hidden group border-gray-800 hover:border-gray-700">
              <div className="aspect-[2/3] bg-gray-800 overflow-hidden relative">
                <img
                  src={event.posterUrl || `https://picsum.photos/seed/${event.id}/300/450`}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isConcert ? 'bg-purple-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {isConcert ? 'Concert' : 'Movie'}
                  </span>
                </div>
                <button
                  onClick={() => openEdit(event)}
                  className="absolute top-2 right-2 bg-black/70 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-rose-400"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              <div className="p-3">
                <div className="font-semibold text-sm truncate text-white">{event.title}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <Clock size={11} className="text-rose-400" />
                  {event.duration}m • {event.language}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
