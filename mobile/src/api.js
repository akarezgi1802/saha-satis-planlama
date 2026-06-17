import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Web admin paneli ile AYNI backend (saha-satis-planlama.onrender.com) — aynı
// Neon DB. Önceden mobile, eski staging deploy'una (saha-satis-planlama-guncel)
// bağlanıyordu; web admin'de yapılan değişiklikler (şifre dahil) mobile'a
// yansımıyordu çünkü iki backend farklı DB kullanıyordu.
export const API_BASE_URL = 'https://saha-satis-planlama.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const url = config.url || '';
  if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

export default api;
