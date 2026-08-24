import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Film, Ticket, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-rose-500">
            <Film size={24} />
            TicketFlow
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">Movies</Link>
            {user && (
              <Link to="/my-bookings" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                <Ticket size={16} /> My Bookings
              </Link>
            )}
            {user && ['SUPER_ADMIN', 'THEATRE_ADMIN'].includes(user.role) && (
              <Link to="/admin" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                <LayoutDashboard size={16} /> Admin
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-gray-400 flex items-center gap-1"><User size={16} />{user.name}</span>
                <button onClick={handleLogout} className="text-gray-400 hover:text-rose-400 transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-gray-300 hover:text-white">Login</Link>
                <Link to="/register" className="btn-primary text-sm py-1.5">Sign Up</Link>
              </div>
            )}
          </nav>

          <button className="md:hidden text-gray-400" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 py-4 flex flex-col gap-4 text-sm">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-gray-300">Movies</Link>
            {user && <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="text-gray-300">My Bookings</Link>}
            {user && ['SUPER_ADMIN', 'THEATRE_ADMIN'].includes(user.role) && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-gray-300">Admin Panel</Link>
            )}
            {user ? (
              <button onClick={handleLogout} className="text-rose-400 text-left">Logout</button>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="text-gray-300">Login</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="text-gray-300">Sign Up</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-6 text-center text-gray-500 text-sm">
        © 2026 TicketFlow — Smart Ticket Booking Platform
      </footer>
    </div>
  );
}
