import { useEffect, useState } from 'react';
import { Plus, Film, Clock, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const EMPTY = { title: '', description: '', duration: 120, genre: '', language: 'English', rating: 'U/A', posterUrl: '' };

export default function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/movies').then(setMovies); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (m) => {
    setEditing(m.id);
    setForm({ ...m, genre: m.genre?.join(', ') || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, genre: form.genre.split(',').map(g => g.trim()).filter(Boolean), duration: +form.duration };
      if (editing) {
        const updated = await api.put(`/movies/${editing}`, payload);
        setMovies(prev => prev.map(m => m.id === editing ? updated : m));
        toast.success('Movie updated');
      } else {
        const created = await api.post('/movies', payload);
        setMovies(prev => [...prev, created]);
        toast.success('Movie added');
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Film size={24} className="text-rose-500" /> Movies
        </h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Movie
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">{editing ? 'Edit Movie' : 'Add Movie'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {[
                { key: 'title', label: 'Title', required: true },
                { key: 'description', label: 'Description' },
                { key: 'posterUrl', label: 'Poster URL' },
                { key: 'trailerUrl', label: 'Trailer URL' },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input className="input" value={form[key] || ''} required={required}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Duration (min)</label>
                  <input type="number" className="input" value={form.duration}
                    onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Rating</label>
                  <select className="input" value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}>
                    {['U', 'U/A', 'A', 'S'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Language</label>
                  <input className="input" value={form.language}
                    onChange={e => setForm(p => ({ ...p, language: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Genre (comma-separated)</label>
                  <input className="input" placeholder="Action, Drama" value={form.genre}
                    onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add Movie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {movies.map(movie => (
          <div key={movie.id} className="card p-0 overflow-hidden group">
            <div className="aspect-[2/3] bg-gray-800 overflow-hidden relative">
              <img src={movie.posterUrl || `https://picsum.photos/seed/${movie.id}/300/450`}
                alt={movie.title} className="w-full h-full object-cover" />
              <button onClick={() => openEdit(movie)}
                className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 size={14} />
              </button>
            </div>
            <div className="p-2">
              <div className="font-semibold text-sm truncate">{movie.title}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock size={10} />{movie.duration}m • {movie.language}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
