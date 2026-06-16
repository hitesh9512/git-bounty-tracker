import React from 'react';
import { LayoutDashboard, Users, LogOut, Layers, Bell } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'organizations', label: 'Organizations', icon: Users },
    { id: 'issues', label: 'Bounty Issues', icon: Layers },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="w-64 glass min-h-screen flex flex-col justify-between border-r border-slate-800/60">
      <div className="p-6">
        {/* Brand */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="bg-gradient-to-tr from-indigo-500 to-violet-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <GithubIcon size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">BountyTracker</h1>
            <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">GitHub Monitor</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500 font-semibold pl-3'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 pl-4'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'} />
                  <span className="text-sm">{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session profile */}
      <div className="p-6 border-t border-slate-800/60">
        {user && (
          <div className="mb-4 flex items-center space-x-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
            {user.githubAvatarUrl ? (
              <img
                src={user.githubAvatarUrl}
                alt={user.githubUsername || 'Avatar'}
                className="w-10 h-10 rounded-full ring-2 ring-indigo-500/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <GithubIcon size={20} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 truncate">Logged in as</p>
              <p className="text-sm font-semibold text-slate-200 truncate">
                {user.githubUsername || user.email.split('@')[0]}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all duration-200 text-sm"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
