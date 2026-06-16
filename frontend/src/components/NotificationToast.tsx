import React from 'react';
import { X, BellRing } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export const NotificationToast: React.FC = () => {
  const { toast, hideToast } = useSocket();

  if (!toast.show) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-bounce-short max-w-sm w-full glass rounded-xl shadow-2xl overflow-hidden transition-all duration-300 transform hover:scale-102">
      <div className="p-4 flex items-start space-x-3">
        <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
          <BellRing size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{toast.title}</p>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={hideToast}
          className="text-slate-400 hover:text-white transition-colors duration-150 p-1"
        >
          <X size={16} />
        </button>
      </div>
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500 animate-shrink-width" />
    </div>
  );
};
