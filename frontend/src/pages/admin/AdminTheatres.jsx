import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Monitor, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const EMPTY = { name: '', description: '', address: '', city: '', state: '', phone: '', email: '', primaryColor: '#e11d48', accentColor: '#f59e0b' };

export default function AdminTheatres() {
  const [theatres, setTheatres] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/theatres/admin/mine').then(setTheatres);
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ ...t }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.put(`/theatres/${editing}`, form);
        setTheatres(prev => prev.map(t => t.id === editing ? { ...t, ...updated } : t));
        toast.success('Theatre updated');
      } else {
        const created = await api.post('/theatres', form);
        setTheatres(prev => [...prev, { ...created, screens: [], _count: { screens: 0 } }]);
        toast.success('Theatre created');
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
        <h1 className="text-2xl font-bold">Theatres</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Theatre
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">{editing ? 'Edit Theatre' : 'New Theatre'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {[
                { key: 'name', label: 'Theatre Name', required: true },
                { key: 'description', label: 'Description' },
                { key: 'address', label: 'Address', required: true },
                { key: 'city', label: 'City', required: true },
                { key: 'state', label: 'State', required: true },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input className="input" value={form[key] || ''} required={required}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Primary Color</label>
                  <input type="color" className="input h-10 p-1" value={form.primaryColor}
                    onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Accent Color</label>
                  <input type="color" className="input h-10 p-1" value={form.accentColor}
                    onChange={e => setForm(p => ({ ...p, accentColor: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Theatre List */}
      {theatres.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No theatres yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {theatres.map(theatre => (
            <div key={theatre.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: theatre.primaryColor }} />
                    <h3 className="font-bold">{theatre.name}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{theatre.address}, {theatre.city}</p>
                </div>
                <button onClick={() => openEdit(theatre)} className="text-gray-400 hover:text-white">
                  <Edit2 size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/theatres/${theatre.id}/screens`}
                  className="btn-secondary text-xs flex items-center gap-1 flex-1 justify-center">
                  <Monitor size={12} /> {theatre.screens.length} Screens
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
