import React from 'react';
import { useSocket } from '../context/SocketContext';
import { Bell, Check, CheckCheck, Calendar } from 'lucide-react';

export const Notifications: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useSocket();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">Notifications Inbox</h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed of newly detected bounties and changes to tracked issues
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="flex items-center space-x-1.5 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-semibold px-3 py-1.5 rounded-xl text-xs transition-all duration-200"
          >
            <CheckCheck size={14} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border border-dashed border-slate-800">
          <Bell size={40} className="mx-auto text-slate-650 mb-3" />
          <h4 className="text-white font-bold text-sm">Notifications inbox is empty</h4>
          <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto">
            You will receive real-time alerts here when bounty events are triggered in your organizations.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-slate-850">
          {notifications.map((notif) => {
            const isBountyUpdate = notif.title.includes('Updated');
            const isClosed = notif.title.includes('Closed');
            
            return (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && markNotificationAsRead(notif.id)}
                className={`p-5 flex items-start space-x-4 transition-all duration-200 cursor-pointer ${
                  notif.isRead
                    ? 'bg-transparent hover:bg-slate-900/10 opacity-60'
                    : 'bg-indigo-950/5 hover:bg-indigo-950/10 border-l-2 border-indigo-500 pl-4.5'
                }`}
              >
                {/* Visual Icon indicator */}
                <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                  notif.isRead
                    ? 'bg-slate-900/60 border border-slate-800 text-slate-500'
                    : isClosed
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : isBountyUpdate
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}>
                  <Bell size={16} />
                </div>

                {/* Content description */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-slate-500 flex items-center space-x-1 flex-shrink-0 pl-3">
                      <Calendar size={11} />
                      <span>{formatTime(notif.createdAt)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    {notif.message}
                  </p>
                </div>

                {/* Read indicator */}
                {!notif.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationAsRead(notif.id);
                    }}
                    className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
