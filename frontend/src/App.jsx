import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import socket from './lib/socket';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MoviePage from './pages/MoviePage';
import ShowSeatsPage from './pages/ShowSeatsPage';
import BookingConfirmPage from './pages/BookingConfirmPage';
import MyBookingsPage from './pages/MyBookingsPage';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTheatres from './pages/admin/AdminTheatres';
import AdminScreens from './pages/admin/AdminScreens';
import AdminLayoutBuilder from './pages/admin/AdminLayoutBuilder';
import AdminShows from './pages/admin/AdminShows';
import AdminMovies from './pages/admin/AdminMovies';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminLiveMonitor from './pages/admin/AdminLiveMonitor';

import Layout from './components/Layout';

function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { fetchMe, token } = useAuthStore();

  useEffect(() => {
    if (token) fetchMe();
  }, [token]);

  useEffect(() => {
    // Connect socket once on app mount, keep it alive for the session
    if (!socket.connected) socket.connect();
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/movie/:id" element={<MoviePage />} />
        <Route path="/show/:id/seats" element={<ShowSeatsPage />} />
        <Route path="/booking/:ref" element={
          <ProtectedRoute><BookingConfirmPage /></ProtectedRoute>
        } />
        <Route path="/my-bookings" element={
          <ProtectedRoute><MyBookingsPage /></ProtectedRoute>
        } />
      </Route>

      <Route path="/admin" element={
        <ProtectedRoute roles={['SUPER_ADMIN', 'THEATRE_ADMIN']}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="theatres" element={<AdminTheatres />} />
        <Route path="theatres/:theatreId/screens" element={<AdminScreens />} />
        <Route path="screens/:screenId/layout" element={<AdminLayoutBuilder />} />
        <Route path="screens/:screenId/shows" element={<AdminShows />} />
        <Route path="movies" element={<AdminMovies />} />
        <Route path="analytics/:theatreId" element={<AdminAnalytics />} />
        <Route path="monitor/:screenId" element={<AdminLiveMonitor />} />
      </Route>
    </Routes>
  );
}
