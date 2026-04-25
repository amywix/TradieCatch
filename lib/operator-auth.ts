import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '@/lib/query-client';

const STORAGE_KEY = 'operator_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, token);
}

function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}

export interface OperatorUser {
  id: string;
  email: string;
  username: string;
  isOperator: boolean;
}

export function useOperatorAuth() {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<OperatorUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getToken();
    if (stored) {
      setTokenState(stored);
      // Verify the token is still valid
      fetch(`${getApiUrl()}api/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.isOperator) {
            setUser(data);
          } else {
            clearToken();
            setTokenState(null);
          }
        })
        .catch(() => { clearToken(); setTokenState(null); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return false; }
      if (!data.user?.isOperator) { setError('This account does not have operator access'); return false; }
      setToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
      return true;
    } catch {
      setError('Network error — please try again');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const authFetch = useCallback((path: string, init: RequestInit = {}) => {
    const tok = token || getToken();
    return fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as object || {}),
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
    });
  }, [token]);

  return { token, user, isLoading, isAuthenticated: !!token && !!user, error, login, logout, authFetch };
}
