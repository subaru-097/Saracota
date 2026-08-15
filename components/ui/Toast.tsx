'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ToastItem } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-brand shrink-0" />,
    info: <Info className="w-5 h-5 text-accent-cyan shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/40',
    error: 'border-red-500/40',
    warning: 'border-amber-500/40',
    info: 'border-sky-500/40',
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl sara-glass-floating border shadow-floating flex items-start space-x-3 transition-all animate-in slide-in-from-top-2 duration-200 text-xs w-full max-w-sm',
        borders[toast.type || 'info']
      )}
    >
      {icons[toast.type || 'info']}

      <div className="flex-1 space-y-0.5">
        <h4 className="font-semibold text-content-primary leading-snug">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-content-secondary font-light leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-content-tertiary hover:text-content-primary p-0.5 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
