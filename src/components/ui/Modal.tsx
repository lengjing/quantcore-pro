import React from 'react';
import { X, Terminal as TerminalIcon } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  width?: string;
}

export const Modal = ({ isOpen, onClose, title, children, width = 'max-w-2xl' }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-terminal-bg border border-terminal-accent shadow-[0_0_15px_rgba(255,153,0,0.1)] w-full ${width} m-4 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-3 py-2 bg-terminal-accent text-black font-bold select-none shrink-0">
          <span className="uppercase tracking-wider text-xs flex items-center gap-2">
            <TerminalIcon size={12} /> {title}
          </span>
          <button onClick={onClose} className="hover:bg-black/20 p-1 rounded">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
