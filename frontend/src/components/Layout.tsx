import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { Key, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { NotificationToast } from './NotificationToast';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  title: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage, title }) => {
  const { user, linkPat, unlinkPat } = useAuth();
  const [showPatModal, setShowPatModal] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const handleLinkPat = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await linkPat(patInput);
      setPatInput('');
      setShowPatModal(false);
    } catch (err: any) {
      setModalError(err || 'Failed to link token');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUnlinkPat = async () => {
    if (window.confirm('Are you sure you want to unlink your GitHub PAT? Scans will stop running for your organizations.')) {
      try {
        await unlinkPat();
      } catch (err) {
        alert('Failed to unlink PAT');
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[#080C14]">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass-nav h-16 px-8 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* GitHub PAT config button */}
            {user?.hasGithubAccount ? (
              <button
                onClick={handleUnlinkPat}
                className="flex items-center space-x-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-1.5 rounded-lg text-xs transition-all duration-200"
              >
                <Check size={14} />
                <span>Token Active (@{user.githubUsername})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPatModal(true)}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium shadow-md shadow-indigo-600/20 transition-all duration-200"
              >
                <Key size={14} />
                <span>Link GitHub PAT</span>
              </button>
            )}
          </div>
        </header>

        {/* Banner warning if no PAT */}
        {!user?.hasGithubAccount && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-3 flex items-center justify-between text-amber-400">
            <div className="flex items-center space-x-2.5 text-sm">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
              <span>
                <strong>Warning:</strong> You must link a GitHub Personal Access Token to trace organizations and search issues.
              </span>
            </div>
            <button
              onClick={() => setShowPatModal(true)}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1 rounded font-semibold text-amber-300 transition-colors"
            >
              Configure Now
            </button>
          </div>
        )}

        {/* Content container */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* PAT Modal */}
      {showPatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md p-6 relative overflow-hidden animate-zoom-in">
            <h3 className="text-lg font-bold text-white mb-2">Configure GitHub Token</h3>
            <p className="text-slate-400 text-xs mb-6">
              Create a Personal Access Token (classic) on GitHub with <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400 font-mono text-[10px]">repo</code> or <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400 font-mono text-[10px]">public_repo</code> scopes to read public issues.
            </p>

            {modalError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl p-3 text-xs mb-4">
                {modalError}
              </div>
            )}

            <form onSubmit={handleLinkPat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  required
                  placeholder="ghp_..."
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPatModal(false);
                    setPatInput('');
                    setModalError('');
                  }}
                  className="flex-1 border border-slate-800 hover:bg-slate-800/40 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-indigo-500/15 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all"
                >
                  {modalLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Link</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating global notifications alerts */}
      <NotificationToast />
    </div>
  );
};
