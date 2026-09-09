import axios from 'axios';
import { LoginResponse, UserRole, UserScope } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT Bearer token to all outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('mplads_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('mplads_token');
      localStorage.removeItem('mplads_role');
      localStorage.removeItem('mplads_scope');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth storage helpers
export const setAuthSession = (auth: LoginResponse) => {
  localStorage.setItem('mplads_token', auth.access_token);
  localStorage.setItem('mplads_role', auth.role);
  localStorage.setItem('mplads_scope', JSON.stringify(auth.scope));
};

export const clearAuthSession = () => {
  localStorage.removeItem('mplads_token');
  localStorage.removeItem('mplads_role');
  localStorage.removeItem('mplads_scope');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('mplads_token');
};

export const getStoredRole = (): UserRole | null => {
  return (localStorage.getItem('mplads_role') as UserRole) || null;
};

export const getStoredScope = (): UserScope => {
  try {
    return JSON.parse(localStorage.getItem('mplads_scope') || '{}');
  } catch {
    return {};
  }
};
