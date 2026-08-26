import { create } from 'zustand';
import api from '../lib/api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; role?: string }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res: any = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const res: any = await api.post('/auth/register', data);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const user: any = await api.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null });
    }
  },
}));

export default useAuthStore;
