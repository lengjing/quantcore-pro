import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface NavIconProps {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  tooltip: string;
}

export const NavIcon = ({ icon: Icon, active, onClick, tooltip }: NavIconProps) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-sm transition-all duration-100 relative group flex justify-center w-full
      ${active ? 'text-terminal-accent bg-[#1a1a1a] border-l-2 border-terminal-accent' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}`}
  >
    <Icon size={18} strokeWidth={2} />
    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 border border-terminal-border whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 pointer-events-none shadow-xl">
      {tooltip}
    </div>
  </button>
);
