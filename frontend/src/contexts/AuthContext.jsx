import { createContext, useState, useEffect } from 'react';
import { api, setTokens, clearTokens, getAccessToken, onAuthChange } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount and token changes
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.auth.me();
        setUser(data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const unsubscribe = onAuthChange(() => {
      if (!getAccessToken()) {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const register = async (email, password) => {
    const data = await api.auth.register(email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const data = await api.auth.login(email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      // Ignore errors, clear tokens anyway
    }
    clearTokens();
    setUser(null);
  };

  const setUsername = async (username, tag) => {
    const data = await api.auth.setUsername(username, tag);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    setUsername,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
