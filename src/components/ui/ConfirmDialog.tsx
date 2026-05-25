import React from 'react';
import { AlertTriangle, Terminal as TerminalIcon, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export const ConfirmDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  variant = 'default',
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-sm m-4 flex flex-col ${
          isDanger
            ? 'bg-terminal-bg border-2 border-red-700 shadow-[0_0_20px_rgba(220,38,38,0.2)]'
            : 'bg-terminal-bg border border-terminal-accent shadow-[0_0_15px_rgba(255,153,0,0.1)]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 font-bold select-none shrink-0 ${
            isDanger ? 'bg-red-900/60 text-red-200' : 'bg-terminal-accent text-black'
          }`}
        >
          <span className="uppercase tracking-wider text-xs flex items-center gap-2">
            {isDanger ? <AlertTriangle size={12} /> : <TerminalIcon size={12} />}
            {title}
          </span>
          <button
            onClick={onCancel}
            className={`p-1 rounded ${isDanger ? 'hover:bg-red-700/50' : 'hover:bg-black/20'}`}
          >
            <X size={14} />
          </button>
        </div>
        {/* Body */}
        <div className="p-4">
          <p className="text-xs font-mono text-gray-300 leading-relaxed">{message}</p>
        </div>
        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={onCancel}
            className="text-[10px] font-mono font-bold px-3 py-1.5 text-gray-500 hover:text-gray-200 border border-[#333] hover:border-[#555] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`text-[10px] font-mono font-bold px-3 py-1.5 transition-colors ${
              isDanger
                ? 'bg-red-700 text-white hover:bg-red-600'
                : 'bg-terminal-accent text-black hover:bg-yellow-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
