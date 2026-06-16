import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Organizations } from './pages/Organizations';
import { Issues } from './pages/Issues';
import { Notifications } from './pages/Notifications';
import { Layout } from './components/Layout';

export const App: React.FC = () => {
  const { user, token, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // Route protection
  useEffect(() => {
    if (!loading) {
      if (!token || !user) {
        if (currentPage !== 'register') {
          setCurrentPage('login');
        }
      } else if (currentPage === 'login' || currentPage === 'register') {
        setCurrentPage('dashboard');
      }
    }
  }, [token, user, loading, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center space-y-3 text-slate-400">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium tracking-wide">Syncing session profile...</span>
      </div>
    );
  }

  // Render auth flows
  if (!user || !token) {
    if (currentPage === 'register') {
      return <Register setCurrentPage={setCurrentPage} />;
    }
    return <Login setCurrentPage={setCurrentPage} />;
  }

  // Render authenticated pages wrapped in Layout
  let pageContent = <Dashboard setCurrentPage={setCurrentPage} />;
  let pageTitle = 'Dashboard';

  switch (currentPage) {
    case 'dashboard':
      pageContent = <Dashboard setCurrentPage={setCurrentPage} />;
      pageTitle = 'Dashboard Telemetry';
      break;
    case 'organizations':
      pageContent = <Organizations />;
      pageTitle = 'Manage Organizations';
      break;
    case 'issues':
      pageContent = <Issues />;
      pageTitle = 'Bounty Database';
      break;
    case 'notifications':
      pageContent = <Notifications />;
      pageTitle = 'Notifications Inbox';
      break;
  }

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage} title={pageTitle}>
      {pageContent}
    </Layout>
  );
};

export default App;
