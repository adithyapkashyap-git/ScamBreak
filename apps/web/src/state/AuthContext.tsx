import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { accountApi, ApiError, authApi } from '../api/client';
import type { UserAccount } from '../types/analysis';

interface AuthContextValue {
  user?: UserAccount;
  isLoading: boolean;
  error?: string;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { displayName: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateSettings: (input: { displayName?: string; privacy?: Partial<NonNullable<UserAccount['privacy']>> }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    authApi.me()
      .then((account) => {
        if (active) setUser(account);
      })
      .catch((reason: unknown) => {
        // An unreachable local API should not break the explanatory product UI.
        if (active && reason instanceof ApiError && reason.status !== 0) setError(reason.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    error,
    signIn: async (input) => {
      setError(undefined);
      const account = await authApi.login(input);
      setUser(account);
    },
    register: async (input) => {
      setError(undefined);
      const account = await authApi.register(input);
      setUser(account);
    },
    signOut: async () => {
      await authApi.logout();
      setUser(undefined);
    },
    updateSettings: async (input) => {
      setError(undefined);
      const account = await accountApi.updateSettings(input);
      setUser(account);
    },
  }), [user, isLoading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
