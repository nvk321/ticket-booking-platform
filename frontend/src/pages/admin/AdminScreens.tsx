import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Monitor, Grid, Calendar, BarChart3, Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function AdminScreens() {
  const { theatreId } = useParams<{ theatreId: string }>();
  const [theatre, setTheatre] = useState<any>(null);
  const [screens, setScreens] = useState<any[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState({ name: '', rows: 10, cols: 15 });
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!theatreId) return;
    api.get(`/theatres/${theatreId}`).then(setTheatre);
    api.get(`/screens/theatre/${theatreId}`).then((data: any) => setScreens(data || []));
  }, [theatreId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const screen: any = await api.post('/screens', { ...form, theatre_id: theatreId, capacity: 0 });
      setScreens((prev) => [...prev, screen]);
      setShowForm(false);
      setForm({ name: '', rows: 10, cols: 15 });
      toast.success('Screen created');
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to create screen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">
          Venues
        </Link>
        <span>/</span>
        <span className="text-white">{theatre?.name || '...'}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Monitor size={24} className="text-rose-500" /> Screens & Auditoriums
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Screen
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">New Screen</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="label">Screen Name</label>
                <input
                  className="input"
                  placeholder="e.g. Audi 1, Hall 2"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rows</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={50}
                    value={form.rows}
                    onChange={(e) => setForm((p) => ({ ...p, rows: +e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Columns</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={50}
                    value={form.cols}
                    onChange={(e) => setForm((p) => ({ ...p, cols: +e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Grid size: {form.rows} × {form.cols} = up to {form.rows * form.cols} seats (configure layout next)
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Creating...' : 'Create Screen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {screens.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Monitor size={40} className="mx-auto mb-3 opacity-30" />
          <p>No screens yet. Add your first screen!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {screens.map((screen) => (
            <div key={screen.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{screen.name}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-center text-sm">
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="font-bold">{screen.capacity}</div>
                  <div className="text-xs text-gray-400">Seats</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="font-bold">
                    {screen.rows}×{screen.cols}
                  </div>
                  <div className="text-xs text-gray-400">Grid</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/admin/screens/${screen.id}/layout`}
                  className="btn-secondary text-xs flex items-center justify-center gap-1"
                >
                  <Grid size={12} /> Layout
                </Link>
                <Link
                  to={`/admin/screens/${screen.id}/shows`}
                  className="btn-secondary text-xs flex items-center justify-center gap-1"
                >
                  <Calendar size={12} /> Shows
                </Link>
                <Link
                  to={`/admin/analytics/${theatreId}`}
                  className="btn-secondary text-xs flex items-center justify-center gap-1"
                >
                  <BarChart3 size={12} /> Analytics
                </Link>
                <Link
                  to={`/admin/monitor/${screen.id}`}
                  className="btn-secondary text-xs flex items-center justify-center gap-1"
                >
                  <Activity size={12} /> Live
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
