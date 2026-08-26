import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

export default function AdminAnalytics() {
  const { theatreId } = useParams<{ theatreId: string }>();
  const [theatre, setTheatre] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = () => {
    if (!theatreId) return;
    setLoading(true);
    api.get(`/theatres/${theatreId}`).then(setTheatre);
    api.get(`/analytics/theatre/${theatreId}`)
      .then((res: any) => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [theatreId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Revenue',
      value: `₹${(data?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-rose-400',
    },
    {
      label: 'Confirmed Bookings',
      value: data?.totalBookings || 0,
      icon: TrendingUp,
      color: 'text-green-400',
    },
    {
      label: 'Tickets Sold',
      value: data?.totalTickets || 0,
      icon: Users,
      color: 'text-blue-400',
    },
    {
      label: 'Scheduled Shows',
      value: data?.totalShows || 0,
      icon: Calendar,
      color: 'text-purple-400',
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">
          Venues
        </Link>
        <span>/</span>
        <span className="text-white">{theatre?.name} — Analytics</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={24} className="text-rose-500" /> Venue Revenue & Analytics
        </h1>
        <button onClick={loadData} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <Icon size={20} className={`${color} mb-2`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {data?.movieBreakdown && data.movieBreakdown.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-bold text-lg mb-4">Top Performing Events & Movies</h2>
          <div className="space-y-3">
            {data.movieBreakdown.map((item: any) => (
              <div key={item.movieId} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-gray-400">
                    {item.ticketsSold} tickets sold · {item.showsCount} shows
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-400">₹{(item.revenue || 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
