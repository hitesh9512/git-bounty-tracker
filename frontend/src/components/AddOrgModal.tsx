import React, { useState } from 'react';
import { X, Plus, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface AddOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddOrgModal: React.FC<AddOrgModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setLoading(true);
    setError('');

    try {
      await api.post('/organizations', { name: orgName.trim() });
      setOrgName('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass rounded-2xl w-full max-w-md p-6 relative overflow-hidden animate-zoom-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Track Organization</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors duration-150 p-1"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-xs mb-6">
          Provide the name of the GitHub Organization or User profile (e.g., <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400 font-mono text-[10px]">facebook</code>, <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-400 font-mono text-[10px]">vercel</code>) to scan public repositories for bounty issues.
        </p>

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl p-3 text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              GitHub Organization/User Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. facebook"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-800 hover:bg-slate-800/40 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-indigo-500/15 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Verifying & Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Start Tracking</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
