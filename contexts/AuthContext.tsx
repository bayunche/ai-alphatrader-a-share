
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User } from '../types';
import { useTranslation } from './LanguageContext';
import { authApi } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const storedUser = localStorage.getItem('alpha_trader_current_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('alpha_trader_current_user');
      }
    }
  }, []);

  const login = async (username: string) => {
    setError(null);
    const res = await authApi.login(username);
    if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('alpha_trader_current_user', JSON.stringify(res.data));
    } else {
        setError(res.error || t('authError'));
    }
  };

  const register = async (username: string) => {
    setError(null);
    const res = await authApi.register(username);
    if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('alpha_trader_current_user', JSON.stringify(res.data));
    } else {
        setError(res.error || t('authError'));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('alpha_trader_current_user');
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
