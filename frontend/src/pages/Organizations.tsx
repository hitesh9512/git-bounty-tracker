import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { AddOrgModal } from '../components/AddOrgModal';

interface Organization {
  id: string;
  name: string;
  createdAt: string;
  reposCount: number;
  bountyCount: number;
}

export const Organizations: React.FC = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ [id: string]: 'idle' | 'scanning' | 'success' }>({});

  const fetchOrgs = async () => {
    try {
      const response = await api.get('/organizations');
      setOrganizations(response.data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleDeleteOrg = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to stop tracking "${name}"? All related repositories and issues will be untracked.`)) {
      try {
        await api.delete(`/organizations/${id}`);
        setOrganizations((prev) => prev.filter((o) => o.id !== id));
      } catch (error) {
        console.error('Failed to untrack organization:', error);
        alert('Failed to delete organization');
      }
    }
  };

  const handleManualScan = async (id: string) => {
    setScanStatus((prev) => ({ ...prev, [id]: 'scanning' }));
    try {
      await api.post(`/organizations/${id}/scan`);
      setScanStatus((prev) => ({ ...prev, [id]: 'success' }));
      
      // Reset after 4 seconds
      setTimeout(() => {
        setScanStatus((prev) => ({ ...prev, [id]: 'idle' }));
        fetchOrgs(); // refresh counts
      }, 4000);
    } catch (error) {
      console.error('Failed to trigger scan:', error);
      setScanStatus((prev) => ({ ...prev, [id]: 'idle' }));
      alert('Failed to trigger scan');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Fetching tracked organizations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">Tracked Organizations</h3>
          <p className="text-xs text-slate-400 mt-1">Manage organizations and profile names traced for code bounty rewards</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/15 transition-all"
        >
          <Plus size={14} />
          <span>Track New Org</span>
        </button>
      </div>

      {organizations.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border border-dashed border-slate-800">
          <Building2 size={44} className="mx-auto text-slate-650 mb-3" />
          <h4 className="text-white font-bold text-sm">No organizations tracked</h4>
          <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto">
            Get started by tracking your first organization (e.g., `facebook`).
          </p>
          {!user?.hasGithubAccount && (
            <div className="mt-4 inline-flex items-center space-x-2 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-2 rounded-xl">
              <AlertCircle size={14} />
              <span>Link your Personal Access Token first.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => {
            const isScanning = scanStatus[org.id] === 'scanning';
            const isSuccess = scanStatus[org.id] === 'success';

            return (
              <div
                key={org.id}
                className="glass rounded-2xl p-6 flex flex-col justify-between hover:border-slate-850 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center space-x-3.5 mb-4">
                    <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-xl text-indigo-400">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{org.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Added {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-900/30 p-3 rounded-xl border border-slate-850/60 mb-6 text-center">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Repositories</p>
                      <p className="text-lg font-bold text-white mt-0.5">{org.reposCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bounties</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">{org.bountyCount}</p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2.5 border-t border-slate-850 pt-4">
                  <button
                    onClick={() => handleManualScan(org.id)}
                    disabled={isScanning || isSuccess}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      isSuccess
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'border-slate-800 hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-indigo-400" />
                        <span>Scanning...</span>
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Scan Queued</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={13} />
                        <span>Scan Now</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteOrg(org.id, org.name)}
                    className="p-2 rounded-xl border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all duration-200"
                    title="Stop tracking"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Org modal */}
      <AddOrgModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchOrgs}
      />
    </div>
  );
};
