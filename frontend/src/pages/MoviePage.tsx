import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Star, Calendar, MapPin, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import { Movie, Show, Theatre, Screen } from '../types';

interface ShowsGroupedByTheatre {
  [theatreId: string]: {
    theatre: Theatre;
    shows: Show[];
  };
}

interface ShowsGroupedByScreen {
  [screenId: string]: {
    screen: Screen;
    shows: Show[];
  };
}

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/movies/${id}`)
      .then((data: any) => setMovie(data))
      .catch(() => setMovie(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get(`/shows/movie/${id}?date=${selectedDate}`)
      .then((data: any) => setShows(data || []))
      .catch(() => setShows([]));
  }, [id, selectedDate]);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const showsByTheatre = shows.reduce<ShowsGroupedByTheatre>((acc, show) => {
    if (!show.screen?.theatre) return acc;
    const key = show.screen.theatre.id;
    if (!acc[key]) {
      acc[key] = { theatre: show.screen.theatre, shows: [] };
    }
    acc[key].shows.push(show);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (!movie) {
    return <div className="text-center py-16 text-gray-500">Event not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="w-48 shrink-0">
          <img
            src={movie.posterUrl || `https://picsum.photos/seed/${movie.id}/300/450`}
            alt={movie.title}
            className="w-full rounded-xl shadow-lg border border-gray-800"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {movie.duration} min
            </span>
            {movie.rating && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={14} className="fill-amber-400" />
                {movie.rating}
              </span>
            )}
            <span>{movie.language}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {movie.genre?.map((g) => (
              <span key={g} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                {g}
              </span>
            ))}
          </div>
          {movie.description && <p className="text-gray-400 leading-relaxed">{movie.description}</p>}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-rose-500" /> Select Date
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((d) => {
            const val = format(d, 'yyyy-MM-dd');
            const isSelected = val === selectedDate;
            return (
              <button
                key={val}
                onClick={() => setSelectedDate(val)}
                className={`shrink-0 flex flex-col items-center px-4 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="text-xs">{format(d, 'EEE')}</span>
                <span className="font-bold">{format(d, 'd')}</span>
                <span className="text-xs">{format(d, 'MMM')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(showsByTheatre).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Monitor size={40} className="mx-auto mb-3 opacity-30" />
          <p>No shows available for this date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(showsByTheatre).map(({ theatre, shows: theatreShows }) => (
            <div key={theatre.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{theatre.name}</h3>
                  <p className="text-gray-400 text-sm flex items-center gap-1">
                    <MapPin size={12} />
                    {theatre.address}, {theatre.city}
                  </p>
                </div>
              </div>

              {Object.values(
                theatreShows.reduce<ShowsGroupedByScreen>((acc, show) => {
                  if (!show.screen) return acc;
                  const key = show.screen.id;
                  if (!acc[key]) acc[key] = { screen: show.screen, shows: [] };
                  acc[key].shows.push(show);
                  return acc;
                }, {})
              ).map(({ screen, shows: screenShows }) => (
                <div key={screen.id} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor size={14} className="text-rose-400" />
                    <span className="text-sm font-medium text-gray-300">{screen.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {screenShows.map((show) => (
                      <button
                        key={show.id}
                        onClick={() => navigate(`/show/${show.id}/seats`)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-rose-500 rounded-lg px-4 py-2 text-sm transition-colors"
                      >
                        <div className="font-semibold">{format(new Date(show.startTime), 'h:mm a')}</div>
                        <div className="text-xs text-gray-400">{format(new Date(show.startTime), 'EEE, MMM d')}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
