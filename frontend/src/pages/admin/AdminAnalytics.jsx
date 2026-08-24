import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Monitor, Ticket, DollarSign, Activity } from 'lucide-react';
import api from '../../lib/api';

export default function AdminAnalytics() {
  const { theatreId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/theatre/${theatreId}`).then(setData).finally(() => setLoading(false));
  }, [theatreId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" /></div>;
  if (!data) return <div className="text-gray-500">No data</div>;

  const maxRevenue = Math.max(...data.screens.map(s => s.totalRevenue), 1);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <span className="text-white">Analytics — {data.theatreName}</span>
      </div>

      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <BarChart3 size={24} className="text-rose-500" /> Analytics
      </h1>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `₹${data.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Total Bookings', value: data.totalBookings, icon: Ticket, color: 'text-blue-400' },
          { label: 'Total Screens', value: data.totalScreens, icon: Monitor, color: 'text-purple-400' },
          { label: 'Total Seats', value: data.totalSeats.toLocaleString(), icon: Activity, color: 'text-rose-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <Icon size={20} className={`${color} mb-2`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Screen-wise breakdown */}
      <h2 className="text-lg font-semibold mb-4">Screen Performance</h2>
      <div className="space-y-4 mb-8">
        {data.screens.map(screen => (
          <div key={screen.screenId} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-rose-400" />
                <span className="font-semibold">{screen.screenName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{screen.totalBookings} bookings</span>
                <span className="font-bold text-white">₹{screen.totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            {/* Revenue bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Revenue</span>
                <span>₹{screen.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600 rounded-full transition-all"
                  style={{ width: `${(screen.totalRevenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>

            {/* Occupancy bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Occupancy Rate</span>
                <span>{screen.occupancyRate}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    screen.occupancyRate > 70 ? 'bg-green-500' :
                    screen.occupancyRate > 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${screen.occupancyRate}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
              <div className="bg-gray-800 rounded p-2">
                <div className="font-bold">{screen.totalSeats}</div>
                <div className="text-xs text-gray-400">Seats</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="font-bold">{screen.totalShows}</div>
                <div className="text-xs text-gray-400">Shows</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="font-bold">{screen.occupancyRate}%</div>
                <div className="text-xs text-gray-400">Occupancy</div>
              </div>
            </div>

            <div className="mt-3">
              <Link to={`/admin/monitor/${screen.screenId}`}
                className="text-xs text-rose-400 hover:underline flex items-center gap-1">
                <Activity size={12} /> View Live Monitor →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
