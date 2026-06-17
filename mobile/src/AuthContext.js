import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Web (Expo Web) sürümünde URL'de ?logout=1 varsa: bir oturum varsa
        // sıfırla — QR ile gelen kullanıcı doğrudan Login ekranını görsün.
        // (React Native APK'da window tanımlı olmadığı için try/catch içinde.)
        try {
          if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('logout') === '1') {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              // URL'i parametresiz hale getir ki yenilemede tekrar tetiklenmesin
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
              }
              setLoading(false);
              return;
            }
          }
        } catch (e) {}

        const t = await AsyncStorage.getItem('token');
        const u = await AsyncStorage.getItem('user');
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const res = await api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token, user: u } = res.data;
    // State önce — AsyncStorage.setItem büyük user objesi (avatar 3 MB+) ile
    // localStorage quota'sı aşılıp patlasa bile login akışı tamamlansın.
    // Önceki bug: setItem throw → setToken/setUser hiç çalışmıyor → 'Giriş
    // başarısız' diye ekrana yansıyor, ama backend zaten 200 OK döndü.
    setToken(access_token);
    setUser(u);
    try { await AsyncStorage.setItem('token', access_token); } catch (e) {}
    try { await AsyncStorage.setItem('user', JSON.stringify(u)); } catch (e) {}
    return u;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      // setUser ÖNCE — AsyncStorage başarısız olsa bile (örn. avatar
      // yüklendiğinde localStorage quota aşımı) runtime state güncellenmeli.
      // Önceki sıralama: setItem → setUser; setItem patlarsa setUser hiç
      // çalışmıyordu, ekrandaki avatar görünmüyordu.
      setUser(res.data);
      try {
        await AsyncStorage.setItem('user', JSON.stringify(res.data));
      } catch (storageErr) {
        // Persist edemezsek de runtime state tutarlı; sonraki açılışta
        // /auth/me ile yeniden çekilir.
      }
    } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
