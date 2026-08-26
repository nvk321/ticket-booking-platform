import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Film } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate(redirect);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Film size={40} className="text-rose-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-gray-400 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-gray-400">
            No account?{' '}
            <Link to="/register" className="text-rose-400 hover:underline">
              Sign up
            </Link>
          </p>
        </form>

        <div className="mt-4 card text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-1">Demo credentials:</p>
          <p>Organiser: admin@theatre.com / admin123</p>
          <p>Customer: user@theatre.com / user123</p>
        </div>
      </div>
    </div>
  );
}
