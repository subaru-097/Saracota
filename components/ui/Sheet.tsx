'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Content (Bottom-up in mobile, Centered Modal in Desktop) */}
      <div
        className={cn(
          'relative z-10 w-full sm:max-w-lg bg-sara-surface border border-sara-border-highlight rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-floating max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200',
          className
        )}
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-sara-border-highlight rounded-full mx-auto mb-4 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 mb-3 border-b border-sara-border">
          <div>
            {title && (
              <h3 className="text-base sm:text-lg font-semibold text-content-primary tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-content-secondary font-light mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-sara-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-sm text-content-primary">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-4 mt-4 border-t border-sara-border flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
