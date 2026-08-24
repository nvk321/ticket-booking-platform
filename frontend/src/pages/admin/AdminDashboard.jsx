import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Monitor, Ticket, TrendingUp, ChevronRight, BarChart3 } from 'lucide-react';
import api from '../../lib/api';

export default function AdminDashboard() {
  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/theatres/admin/mine').then(setTheatres).finally(() => setLoading(false));
  }, []);

  const totalScreens = theatres.reduce((s, t) => s + t.screens.length, 0);
  const totalSeats = theatres.reduce((s, t) => s + t.screens.reduce((ss, sc) => ss + sc.capacity, 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Theatres', value: theatres.length, icon: Building2, color: 'text-rose-400' },
          { label: 'Screens', value: totalScreens, icon: Monitor, color: 'text-blue-400' },
          { label: 'Total Seats', value: totalSeats.toLocaleString(), icon: Ticket, color: 'text-purple-400' },
          { label: 'Active', value: theatres.filter(t => t.isActive).length, icon: TrendingUp, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <Icon size={20} className={`${color} mb-2`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Theatres */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Theatres</h2>
        <Link to="/admin/theatres" className="text-sm text-rose-400 hover:underline">Manage →</Link>
      </div>

      {theatres.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No theatres yet.</p>
          <Link to="/admin/theatres" className="btn-primary mt-4 inline-block">Create Theatre</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {theatres.map(theatre => (
            <div key={theatre.id} className="card hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{theatre.name}</h3>
                  <p className="text-sm text-gray-400">{theatre.city}, {theatre.state}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${theatre.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                  {theatre.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="font-bold">{theatre.screens.length}</div>
                  <div className="text-xs text-gray-400">Screens</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="font-bold">{theatre.screens.reduce((s, sc) => s + sc.capacity, 0)}</div>
                  <div className="text-xs text-gray-400">Seats</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="font-bold">{theatre.screens.reduce((s, sc) => s + sc._count.shows, 0)}</div>
                  <div className="text-xs text-gray-400">Shows</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link to={`/admin/theatres/${theatre.id}/screens`} className="btn-secondary text-xs flex-1 text-center flex items-center justify-center gap-1">
                  <Monitor size={12} /> Screens
                </Link>
                <Link to={`/admin/analytics/${theatre.id}`} className="btn-secondary text-xs flex-1 text-center flex items-center justify-center gap-1">
                  <BarChart3 size={12} /> Analytics
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
