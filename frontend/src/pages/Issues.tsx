import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Search, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import api from '../services/api';
import { IssueCard } from '../components/IssueCard';
import type { IssueType } from '../components/IssueCard';

interface Organization {
  id: string;
  name: string;
}

export const Issues: React.FC = () => {
  const { socket } = useSocket();
  const [issues, setIssues] = useState<IssueType[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const [state, setState] = useState('open');
  const [minBounty, setMinBounty] = useState('');
  const [sortBy, setSortBy] = useState('bountyAmount');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 9;

  const fetchOrgsList = async () => {
    try {
      const response = await api.get('/organizations');
      setOrgs(response.data);
    } catch (error) {
      console.error('Failed to load organizations for dropdown:', error);
    }
  };

  const fetchIssuesList = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        sortBy,
        sortOrder,
        state,
      };

      if (search.trim()) params.search = search.trim();
      if (orgId) params.orgId = orgId;
      if (minBounty) params.minBounty = parseFloat(minBounty);

      const response = await api.get('/issues', { params });
      setIssues(response.data.issues);
      setTotalPages(response.data.pagination.totalPages);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial dropdown options
  useEffect(() => {
    fetchOrgsList();
  }, []);

  // Fetch issues list on filter or page change
  useEffect(() => {
    fetchIssuesList();
  }, [page, orgId, state, sortBy, sortOrder, minBounty]);

  // Handle Search Input submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchIssuesList();
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch('');
    setOrgId('');
    setState('open');
    setMinBounty('');
    setSortBy('bountyAmount');
    setSortOrder('desc');
    setPage(1);
  };

  useEffect(() => {
    if (socket) {
      const handleSocketRefresh = () => {
        console.log('Socket update, reloading issues...');
        fetchIssuesList();
      };
      
      socket.on('new_bounty', handleSocketRefresh);
      socket.on('bounty_updated', handleSocketRefresh);
      
      return () => {
        socket.off('new_bounty', handleSocketRefresh);
        socket.off('bounty_updated', handleSocketRefresh);
      };
    }
  }, [socket]);

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div>
        <h3 className="text-lg font-bold text-white uppercase tracking-wide">Bounty Database</h3>
        <p className="text-xs text-slate-400 mt-1">
          Explore and filter detected bounty payouts from repositories in tracked organizations
        </p>
      </div>

      {/* Filters Form */}
      <div className="glass rounded-2xl p-5 space-y-4">
        {/* Row 1: Search & Org filter */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search in title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none transition-all"
            >
              <option value="">All Organizations</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3 flex space-x-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-600/10"
            >
              <Search size={13} />
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-xs transition-all"
            >
              Clear
            </button>
          </div>
        </form>

        {/* Row 2: Advanced Filters (Sorting, range, state) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-800/40">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              Issue State
            </label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900/40 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              Min Bounty ($)
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={minBounty}
              onChange={(e) => {
                setMinBounty(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900/40 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900/40 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="bountyAmount">Bounty Value</option>
              <option value="createdAt">Date Detected</option>
              <option value="updatedAt">Date Updated</option>
              <option value="number">Issue Number</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              Sort Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900/40 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-1 flex items-end justify-end">
            <span className="text-[10px] text-slate-500 mb-2 font-medium">
              Found {totalItems} matches
            </span>
          </div>
        </div>
      </div>

      {/* Issues Grid view */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Querying database...</span>
        </div>
      ) : issues.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border border-dashed border-slate-800">
          <Layers size={40} className="mx-auto text-slate-650 mb-3" />
          <h4 className="text-white font-bold text-sm">No bounty issues match filters</h4>
          <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto">
            Try adjusting search keyphrases, organization dropdowns, state filters, or min bounty values.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-slate-900/10 p-4 rounded-xl border border-slate-850/40 mt-8">
              <span className="text-xs text-slate-400 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="flex items-center space-x-1 border border-slate-800 hover:bg-slate-800/40 text-slate-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="flex items-center space-x-1 border border-slate-800 hover:bg-slate-800/40 text-slate-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
