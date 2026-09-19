import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/api/v1/auth/register', userData),
  login: (credentials) => api.post('/api/v1/auth/login', credentials),
  getMe: () => api.get('/api/v1/auth/me'),
};

export const gamesAPI = {
  getAll: () => api.get('/api/v1/games'),
  getById: (id) => api.get(`/api/v1/games/${id}`),
  create: (gameData) => api.post('/api/v1/games', gameData),
  update: (id, gameData) => api.put(`/api/v1/games/${id}`, gameData),
  delete: (id) => api.delete(`/api/v1/games/${id}`),
};

export const adminAPI = {
  getStats: () => api.get('/api/v1/admin/stats'),
};

export default api;
