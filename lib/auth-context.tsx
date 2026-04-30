import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './query-client';
import { fetch } from 'expo/fetch';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'tradiecatch_auth_token';
const USER_KEY = 'tradiecatch_user';

let _authToken: string | null = null;

export function getAuthToken(): string | null {
  return _authToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const savedUser = await AsyncStorage.getItem(USER_KEY);

        if (savedToken && savedUser) {
          // Optimistically restore from storage so the app feels instant.
          _authToken = savedToken;
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setToken(savedToken);

          // Then validate in the background — only clear if the server
          // explicitly says the token is invalid (401/403), not on network errors.
          try {
            const baseUrl = getApiUrl();
            const res = await fetch(`${baseUrl}api/auth/me`, {
              headers: { Authorization: `Bearer ${savedToken}` },
            });

            if (res.ok) {
              const userData = await res.json();
              setUser(userData);
            } else if (res.status === 401 || res.status === 403) {
              // Token is genuinely invalid — clear it.
              setUser(null);
              setToken(null);
              _authToken = null;
              await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            }
            // Any other status (500, network error, etc.) — keep the stored session.
          } catch {
            // Network error — server may be starting up. Keep the stored session.
            console.log('Auth validation network error — keeping stored session');
          }
        }
      } catch (err) {
        console.log('Auth restore error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }

    const data = await res.json();
    _authToken = data.token;
    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Registration failed');
    }

    const data = await res.json();
    _authToken = data.token;
    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }, []);

  const logout = useCallback(async () => {
    _authToken = null;
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
