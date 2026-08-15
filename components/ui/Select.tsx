'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, error, leftIcon, disabled, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1">
        {label && (
          <label className="block text-xs font-medium text-content-secondary mb-0.5">
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 text-content-tertiary pointer-events-none shrink-0 flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full bg-sara-surface border border-sara-border text-content-primary text-sm rounded-xl px-4 py-2.5 pr-10 appearance-none transition-all duration-200 focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/40 min-h-[44px] cursor-pointer',
              leftIcon && 'pl-10',
              error && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30',
              disabled && 'opacity-50 cursor-not-allowed bg-sara-elevated',
              className
            )}
            {...props}
          >
            {children}
          </select>

          <ChevronDown className="w-4 h-4 absolute right-3.5 text-content-tertiary pointer-events-none shrink-0" />
        </div>

        {error && (
          <span className="text-[11px] text-red-400 font-mono px-1">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
