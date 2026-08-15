'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isMono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      isMono = false,
      disabled,
      id,
      placeholder,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-content-secondary tracking-wide select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 text-content-tertiary pointer-events-none shrink-0 flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            type={type}
            ref={ref}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'w-full bg-sara-surface border border-sara-border text-content-primary placeholder:text-content-tertiary text-sm rounded-xl px-4 py-2.5 transition-all duration-200 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 min-h-[44px]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              isMono && 'font-mono text-brand font-medium tracking-tight',
              error && 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30',
              disabled && 'opacity-50 cursor-not-allowed bg-sara-elevated',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 text-content-tertiary shrink-0 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <span className="text-[11px] text-red-400 font-mono px-1 leading-tight">
            {error}
          </span>
        ) : helperText ? (
          <span className="text-[11px] text-content-tertiary font-light px-1 leading-tight">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
