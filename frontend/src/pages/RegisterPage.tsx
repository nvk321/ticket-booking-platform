import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER' });
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      toast.success('Account created!');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Film size={40} className="text-rose-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-gray-400 mt-1">Join TicketFlow today</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Account Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            >
              <option value="CUSTOMER">Customer (Book Movies & Concerts)</option>
              <option value="ORGANISER">Event Organiser / Venue Admin</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-rose-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
