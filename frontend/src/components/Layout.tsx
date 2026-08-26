import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Film, Ticket, LogOut, LayoutDashboard, Menu, X, Sparkles } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isOrganiser = user && ['SUPER_ADMIN', 'THEATRE_ADMIN', 'ADMIN', 'ORGANISER'].includes(user.role.toUpperCase());

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="bg-gray-900/90 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-rose-500 hover:text-rose-400 transition-colors">
            <Film size={26} className="text-rose-500" />
            <span className="bg-gradient-to-r from-rose-500 to-amber-400 bg-clip-text text-transparent">
              TicketFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 font-medium">
              <Sparkles size={16} className="text-rose-400" /> Discover Events
            </Link>

            {user && (
              <Link to="/my-bookings" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 font-medium">
                <Ticket size={16} className="text-emerald-400" /> My Bookings & Waitlists
              </Link>
            )}

            {isOrganiser && (
              <Link to="/admin" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 font-medium bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700">
                <LayoutDashboard size={16} className="text-amber-400" /> Organiser Portal
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-gray-800">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-medium text-gray-200">{user.name}</span>
                  <span className="text-[11px] text-rose-400 capitalize">{user.role === 'THEATRE_ADMIN' ? 'Organiser' : user.role.toLowerCase()}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-gray-700 transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-gray-300 hover:text-white px-3 py-1.5 font-medium">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-4 rounded-lg font-medium shadow-md shadow-rose-950">Get Started</Link>
              </div>
            )}
          </nav>

          <button className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 py-4 flex flex-col gap-3 text-sm">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-gray-300 py-1">Discover Events</Link>
            {user && (
              <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="text-gray-300 py-1">
                My Bookings & Waitlists
              </Link>
            )}
            {isOrganiser && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-amber-400 py-1 font-medium">
                Organiser Portal
              </Link>
            )}
            {user ? (
              <button onClick={handleLogout} className="text-rose-400 text-left py-1 font-medium">Log Out ({user.name})</button>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="text-gray-300 py-1">Sign In</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-center py-2">Get Started</Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-rose-500">
            <Film size={20} /> TicketFlow
          </div>
          <p className="text-xs text-gray-500">
            High-concurrency live event & movie ticketing platform with real-time seat locks and FIFO waitlists.
          </p>
          <p className="text-xs text-gray-600">
            © 2026 TicketFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
