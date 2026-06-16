import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  hasGithubAccount: boolean;
  githubUsername: string | null;
  githubAvatarUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  linkPat: (pat: string) => Promise<{ githubUsername: string; githubAvatarUrl: string }>;
  unlinkPat: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user context:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      setLoading(false);
      throw error.response?.data?.error || 'Login failed';
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      setLoading(false);
      throw error.response?.data?.error || 'Registration failed';
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  const linkPat = async (pat: string) => {
    try {
      const response = await api.post('/github/pat', { pat });
      const { githubUsername, githubAvatarUrl } = response.data;
      
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          hasGithubAccount: true,
          githubUsername,
          githubAvatarUrl,
        };
      });

      return { githubUsername, githubAvatarUrl };
    } catch (error: any) {
      throw error.response?.data?.error || 'Failed to link GitHub PAT';
    }
  };

  const unlinkPat = async () => {
    try {
      await api.delete('/github/pat');
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          hasGithubAccount: false,
          githubUsername: null,
          githubAvatarUrl: null,
        };
      });
    } catch (error: any) {
      throw error.response?.data?.error || 'Failed to unlink GitHub account';
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        linkPat,
        unlinkPat,
        refreshUser,
      }}
    >
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
