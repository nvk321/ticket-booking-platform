import axios from 'axios';

const customBase = import.meta.env.VITE_API_BASE_URL;
let baseURL = '/api/v1';

if (customBase) {
  const clean = customBase.replace(/\/$/, '');
  baseURL = clean.endsWith('/api/v1')
    ? clean
    : clean.endsWith('/api')
    ? `${clean}/v1`
    : `${clean}/api/v1`;
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      'An unexpected error occurred';
    return Promise.reject({ ...error.response?.data, error: message });
  }
);

export default api;
