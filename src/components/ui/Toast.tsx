import React from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import type { Notification } from '../../types';

interface ToastContainerProps {
  notifications: Notification[];
  removeNotification: (id: string) => void;
}

export const ToastContainer = ({ notifications, removeNotification }: ToastContainerProps) => (
  <div className="fixed bottom-8 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    {notifications.map((n) => (
      <div
        key={n.id}
        className={`flex items-center gap-3 px-4 py-3 min-w-[300px] border-l-4 shadow-2xl animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto
          ${n.type === 'SUCCESS' ? 'bg-[#0a200a] border-terminal-success text-white' :
            n.type === 'ERROR' ? 'bg-[#200a0a] border-terminal-error text-white' :
              'bg-[#1a1a1a] border-blue-500 text-white'}`}
      >
        {n.type === 'SUCCESS' && <CheckCircle size={16} className="text-terminal-success shrink-0" />}
        {n.type === 'ERROR' && <AlertTriangle size={16} className="text-terminal-error shrink-0" />}
        {n.type === 'INFO' && <Info size={16} className="text-blue-500 shrink-0" />}
        <div className="flex-1 font-mono text-xs font-bold uppercase tracking-wide">{n.message}</div>
        <button onClick={() => removeNotification(n.id)} className="hover:text-gray-400"><X size={12} /></button>
      </div>
    ))}
  </div>
);
