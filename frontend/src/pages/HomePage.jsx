import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star, Film } from 'lucide-react';
import api from '../lib/api';

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/movies').then(setMovies).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-12 bg-gradient-to-r from-rose-900 via-gray-900 to-gray-900 p-8 md:p-16">
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Book Your <span className="text-rose-400">Perfect</span> Seat
          </h1>
          <p className="text-gray-400 text-lg mb-6 max-w-xl">
            Real-time seat selection across multiple screens. No double bookings, ever.
          </p>
          <Link to="#movies" className="btn-primary inline-flex items-center gap-2">
            <Film size={18} /> Browse Movies
          </Link>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-rose-900/20 to-transparent" />
      </div>

      {/* Movies */}
      <section id="movies">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Film size={24} className="text-rose-500" /> Now Showing
        </h2>
        {movies.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Film size={48} className="mx-auto mb-4 opacity-30" />
            <p>No movies available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {movies.map(movie => (
              <Link key={movie.id} to={`/movie/${movie.id}`} className="group">
                <div className="card p-0 overflow-hidden hover:border-rose-500 transition-colors">
                  <div className="aspect-[2/3] bg-gray-800 overflow-hidden">
                    <img
                      src={movie.posterUrl || `https://picsum.photos/seed/${movie.id}/300/450`}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={12} />{movie.duration}m</span>
                      {movie.rating && <span className="flex items-center gap-1"><Star size={12} />{movie.rating}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {movie.genre?.slice(0, 2).map(g => (
                        <span key={g} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{g}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
