import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onBack: () => void;
  label?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onBack, label = 'Quay lại' }) => {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all border border-slate-200 hover:border-blue-200 shadow-sm mb-4"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};
