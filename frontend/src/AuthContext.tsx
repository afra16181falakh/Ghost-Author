import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, clearToken } from './api/client';
import type { GhostUser } from './types';

interface AuthCtx {
  user: GhostUser | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GhostUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<GhostUser>('/api/auth/me');
      setUser(me);
    } catch {
      // No token or backend unreachable — silent fail, user stays null
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/auth/github/login`;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* ignore */ }
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
