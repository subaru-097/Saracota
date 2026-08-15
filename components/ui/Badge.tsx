'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'emerald' | 'cyan' | 'rose' | 'neutral';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'brand',
      size = 'md',
      pulse = false,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      brand:
        'bg-brand-light text-brand border border-brand/30',
      emerald:
        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      cyan:
        'bg-sky-500/10 text-accent-cyan border border-sky-500/30',
      rose:
        'bg-rose-500/10 text-red-400 border border-rose-500/30',
      neutral:
        'bg-sara-elevated text-content-secondary border border-sara-border-highlight',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px] gap-1 font-mono',
      md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
    };

    const pulseColor = {
      brand: 'bg-brand',
      emerald: 'bg-emerald-400',
      cyan: 'bg-accent-cyan',
      rose: 'bg-red-400',
      neutral: 'bg-content-tertiary',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full tracking-wide transition-colors shrink-0 uppercase select-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                pulseColor[variant]
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-1.5 w-1.5',
                pulseColor[variant]
              )}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
