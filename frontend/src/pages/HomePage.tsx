import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star, Film, Music, Search, Sparkles } from 'lucide-react';
import api from '../lib/api';
import { Movie } from '../types';

export default function HomePage() {
  const [events, setEvents] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'MOVIE' | 'CONCERT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    api.get('/movies')
      .then((data: any) => setEvents(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesTab = activeTab === 'ALL' || (event.eventType || 'MOVIE') === activeTab;
    const matchesSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.genre?.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden mb-10 bg-gradient-to-r from-rose-950 via-gray-900 to-indigo-950 border border-gray-800 p-8 md:p-14 shadow-2xl shadow-rose-950/20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles size={14} /> Next-Gen Event Ticketing
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 text-white leading-tight">
            Book <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">Movies & Live Concerts</span> with Zero Double Bookings
          </h1>
          <p className="text-gray-300 text-base sm:text-lg mb-8 leading-relaxed">
            Interactive visual seating, real-time 5-minute hold guarantees, and automated category waitlists for sold-out premier shows.
          </p>

          {/* Quick Search */}
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by event title, artist, or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-900/90 border border-gray-700 rounded-xl text-sm focus:outline-none focus:border-rose-500 text-white placeholder-gray-500 shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Category Tabs & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-xl border border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'ALL'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('MOVIE')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'MOVIE'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Film size={15} /> Movies
          </button>
          <button
            onClick={() => setActiveTab('CONCERT')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'CONCERT'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Music size={15} /> Concerts & Live
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Showing {filteredEvents.length} active events
        </p>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card p-0 overflow-hidden animate-pulse border-gray-800">
              <div className="aspect-[16/10] bg-gray-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800/80">
          <Film size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-1">No events found</h3>
          <p className="text-sm text-gray-500">Try adjusting your search query or tab filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredEvents.map((event) => {
            const isConcert = event.eventType === 'CONCERT';
            return (
              <Link
                key={event.id}
                to={`/movie/${event.id}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-rose-500/70 hover:shadow-xl hover:shadow-rose-950/20 transition-all duration-200"
              >
                <div className="relative aspect-[16/10] sm:aspect-[4/3] bg-gray-800 overflow-hidden">
                  <img
                    src={
                      event.posterUrl ||
                      `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80`
                    }
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                        isConcert
                          ? 'bg-purple-600/90 text-white backdrop-blur'
                          : 'bg-rose-600/90 text-white backdrop-blur'
                      }`}
                    >
                      {isConcert ? <Music size={12} /> : <Film size={12} />}
                      {isConcert ? 'Live Concert' : 'Movie'}
                    </span>
                  </div>
                  {event.rating && (
                    <div className="absolute top-3 right-3 bg-gray-950/80 backdrop-blur px-2 py-0.5 rounded text-[11px] font-semibold text-amber-400 flex items-center gap-1 border border-amber-500/30">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      {event.rating}
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-base text-gray-100 group-hover:text-rose-400 transition-colors line-clamp-1 mb-1.5">
                      {event.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                      {event.description || 'Join thousands of fans for this premier live entertainment experience.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-rose-400" /> {event.duration} mins
                    </span>
                    <span className="text-rose-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                      Book Seats →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
