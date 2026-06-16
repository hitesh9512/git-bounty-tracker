import React, { useState } from 'react';
import { ExternalLink, History, ChevronDown, ChevronUp, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import api from '../services/api';

export interface IssueType {
  id: string;
  githubId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  bountyAmount: number | null;
  hasBounty: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  repository: {
    fullName: string;
    name: string;
  };
}

interface IssueCardProps {
  issue: IssueType;
}

interface HistoryItem {
  id: string;
  oldAmount: number | null;
  newAmount: number | null;
  oldState: string | null;
  newState: string | null;
  changedAt: string;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleHistory = async () => {
    if (!showHistory && history.length === 0) {
      setLoadingHistory(true);
      try {
        const response = await api.get(`/issues/${issue.id}/history`);
        setHistory(response.data);
      } catch (error) {
        console.error('Failed to load issue history:', error);
      } finally {
        setLoadingHistory(false);
      }
    }
    setShowHistory(!showHistory);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="glass rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="p-6">
        {/* Header line */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              {issue.repository.fullName}
            </span>
            <h4 className="text-base font-bold text-white leading-snug mt-1 line-clamp-2 pr-4">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-300 transition-colors flex items-center space-x-1.5"
              >
                <span>{issue.title}</span>
                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            </h4>
          </div>
          
          {/* Bounty Badge */}
          {issue.hasBounty && (
            <div className="flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-1.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/5 flex-shrink-0">
              <DollarSign size={14} />
              <span>{issue.bountyAmount !== null ? issue.bountyAmount.toLocaleString() : 'Unspecified'}</span>
            </div>
          )}
        </div>

        {/* Issue Number & Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400 mb-4 border-b border-slate-800/40 pb-3">
          <span className="font-mono text-slate-500">#{issue.number}</span>
          <span className="h-1 w-1 bg-slate-700 rounded-full" />
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
            issue.state === 'open' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'
          }`}>
            {issue.state}
          </span>
          <span className="h-1 w-1 bg-slate-700 rounded-full" />
          <div className="flex items-center space-x-1 text-slate-500">
            <Calendar size={12} />
            <span>Detected {formatDate(issue.createdAt)}</span>
          </div>
        </div>

        {/* Body snippet */}
        {issue.body && (
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mb-4 font-normal">
            {issue.body.replace(/[\r\n]+/g, ' ')}
          </p>
        )}

        {/* Labels list */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {issue.labels.slice(0, 5).map((label, index) => (
              <span
                key={index}
                className="bg-slate-850 text-slate-400 border border-slate-800/80 px-2 py-0.5 rounded-md text-[10px] font-medium"
              >
                {label}
              </span>
            ))}
            {issue.labels.length > 5 && (
              <span className="text-[10px] text-slate-500 pl-1 font-semibold">
                +{issue.labels.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* History Toggle Bar */}
        <div className="pt-2 flex justify-between items-center text-xs">
          <button
            onClick={toggleHistory}
            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors py-1"
          >
            <History size={13} />
            <span>Revision History</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Expandable History Panel */}
        {showHistory && (
          <div className="mt-4 bg-slate-900/60 rounded-xl p-3 border border-slate-850 max-h-48 overflow-y-auto space-y-2.5 animate-slide-down">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4 space-x-2 text-slate-400 text-xs">
                <RefreshCw size={12} className="animate-spin" />
                <span>Loading log history...</span>
              </div>
            ) : history.length === 0 ? (
              <p className="text-center py-3 text-xs text-slate-500">No revisions detected yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="text-[11px] border-b border-slate-800/30 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>{new Date(h.changedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-slate-300">
                    {h.oldAmount !== h.newAmount && (
                      <span>
                        Bounty: <span className="text-red-400 font-mono">${h.oldAmount || '0'}</span> →{' '}
                        <span className="text-emerald-400 font-mono">${h.newAmount || '0'}</span>
                      </span>
                    )}
                    {h.oldState !== h.newState && (
                      <span>
                        State: <span className="text-slate-500 uppercase">{h.oldState}</span> →{' '}
                        <span className="text-indigo-400 uppercase font-semibold">{h.newState}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
