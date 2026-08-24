import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ loading: true });
    try {
      const data = await api.post('/auth/register', payload);
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    try {
      const user = await api.get('/auth/me');
      set({ user });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
