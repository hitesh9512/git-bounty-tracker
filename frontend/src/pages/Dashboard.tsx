import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Building2, Layers, DollarSign, ArrowRight, Award, ListFilter } from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import api from '../services/api';
import { IssueCard } from '../components/IssueCard';
import type { IssueType } from '../components/IssueCard';
import { AddOrgModal } from '../components/AddOrgModal';

interface Stats {
  organizations: number;
  repositories: number;
  activeBounties: number;
  totalBountyValue: number;
}

interface TopRepo {
  id: string;
  name: string;
  fullName: string;
  orgName: string;
  bountyCount: number;
}

interface TopOrg {
  id: string;
  name: string;
  bountyCount: number;
}

interface DashboardProps {
  setCurrentPage: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage }) => {
  // Removed unused user declaration
  const { socket } = useSocket();
  const [stats, setStats] = useState<Stats>({
    organizations: 0,
    repositories: 0,
    activeBounties: 0,
    totalBountyValue: 0,
  });
  const [recentBounties, setRecentBounties] = useState<IssueType[]>([]);
  const [topRepos, setTopRepos] = useState<TopRepo[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrgModal, setShowOrgModal] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/issues/stats');
      setStats(response.data.stats);
      setRecentBounties(response.data.recentBounties);
      setTopRepos(response.data.topRepositories || []);
      setTopOrgs(response.data.topOrganizations || []);
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      // Refresh dashboard on new socket events
      const handleSocketUpdate = () => {
        console.log('Socket event received in dashboard, refreshing values...');
        fetchDashboardData();
      };

      socket.on('new_bounty', handleSocketUpdate);
      socket.on('bounty_updated', handleSocketUpdate);

      return () => {
        socket.off('new_bounty', handleSocketUpdate);
        socket.off('bounty_updated', handleSocketUpdate);
      };
    }
  }, [socket]);

  const statCards = [
    {
      title: 'Tracked Orgs',
      value: stats.organizations,
      icon: Building2,
      color: 'from-blue-500 to-indigo-500',
      shadow: 'shadow-blue-500/10',
    },
    {
      title: 'Scanned Repos',
      value: stats.repositories,
      icon: GithubIcon,
      color: 'from-purple-500 to-indigo-500',
      shadow: 'shadow-purple-500/10',
    },
    {
      title: 'Bounty Issues',
      value: stats.activeBounties,
      icon: Layers,
      color: 'from-indigo-500 to-violet-500',
      shadow: 'shadow-indigo-500/10',
    },
    {
      title: 'Total Bounty Pool',
      value: `$${stats.totalBountyValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-500/10',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Retrieving dashboard telemetry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="glass rounded-3xl p-8 relative overflow-hidden bg-gradient-to-r from-indigo-900/10 via-violet-900/5 to-transparent border border-indigo-500/10">
        <div className="absolute top-0 right-0 p-8 text-indigo-500/10 pointer-events-none">
          <Award size={160} />
        </div>
        
        <div className="relative z-10 max-w-xl">
          <h3 className="text-2xl font-bold text-white mb-2">GitHub Bounty Tracker</h3>
          <p className="text-slate-300 text-sm leading-relaxed mb-6 font-normal">
            Track and monitor issues with financial rewards across multiple GitHub organizations. Receive real-time toast alerts when new bounty prizes are published.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowOrgModal(true)}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              <span>Track Organization</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setCurrentPage('issues')}
              className="border border-slate-800 hover:bg-slate-800/40 text-slate-300 font-semibold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all"
            >
              <ListFilter size={14} />
              <span>Browse All Issues</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`glass rounded-2xl p-6 flex items-center justify-between hover:border-slate-700/80 transition-all ${card.shadow}`}
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
                <p className="text-2xl font-bold text-white">{card.value}</p>
              </div>
              <div className={`p-3.5 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Repositories and Organizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Repositories */}
        <div className="glass rounded-2xl p-6 border border-slate-850 space-y-4 bg-slate-900/10">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Layers className="text-indigo-400" size={18} />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Top Bounty Repositories</h4>
          </div>
          {topRepos.filter(r => r.bountyCount > 0).length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No repositories with active bounties found.</p>
          ) : (
            <div className="space-y-4">
              {topRepos.filter(r => r.bountyCount > 0).map((repo) => (
                <div key={repo.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">{repo.fullName}</span>
                    <span className="text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full">{repo.bountyCount} {repo.bountyCount === 1 ? 'bounty' : 'bounties'}</span>
                  </div>
                  <div className="w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (repo.bountyCount / Math.max(...topRepos.map(r => r.bountyCount), 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Organizations */}
        <div className="glass rounded-2xl p-6 border border-slate-850 space-y-4 bg-slate-900/10">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Building2 className="text-emerald-400" size={18} />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Top Bounty Organizations</h4>
          </div>
          {topOrgs.filter(o => o.bountyCount > 0).length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No organizations with active bounties found.</p>
          ) : (
            <div className="space-y-4">
              {topOrgs.filter(o => o.bountyCount > 0).map((org) => (
                <div key={org.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">{org.name}</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">{org.bountyCount} {org.bountyCount === 1 ? 'bounty' : 'bounties'}</span>
                  </div>
                  <div className="w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (org.bountyCount / Math.max(...topOrgs.map(o => o.bountyCount), 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Recent Bounties */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-white tracking-wide uppercase">Newest Bounty Detections</h3>
          {recentBounties.length > 0 && (
            <button
              onClick={() => setCurrentPage('issues')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {recentBounties.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-dashed border-slate-800">
            <Layers size={36} className="mx-auto text-slate-600 mb-3" />
            <h4 className="text-white font-bold text-sm">No bounties detected yet</h4>
            <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto">
              Link your PAT, track organizations under the Organizations tab, and background scans will populate results here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentBounties.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>

      {/* Add Org modal */}
      <AddOrgModal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
};
