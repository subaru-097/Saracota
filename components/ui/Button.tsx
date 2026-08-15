'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'cyan';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles with mobile touch feedback (min-h 44px for touch targets)
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 ease-smooth select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sara-canvas disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 active:scale-[0.97] active:brightness-95 min-h-[44px] cursor-pointer';

    const variants = {
      primary:
        'bg-brand hover:bg-brand-hover text-black font-semibold shadow-glow border border-amber-400/40 rounded-xl',
      secondary:
        'bg-transparent border border-sara-border-highlight hover:border-brand/50 hover:bg-sara-hover text-content-primary rounded-xl',
      ghost:
        'bg-transparent hover:bg-sara-hover text-content-secondary hover:text-content-primary rounded-xl',
      destructive:
        'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl',
      cyan:
        'bg-accent-cyan hover:bg-sky-400 text-black font-semibold shadow-glow-cyan rounded-xl',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg min-h-[36px]',
      md: 'px-4 py-2.5 text-sm gap-2 rounded-xl min-h-[44px]',
      lg: 'px-6 py-3.5 text-base gap-2.5 rounded-xl min-h-[50px]',
      icon: 'w-11 h-11 p-0 rounded-xl min-w-[44px] min-h-[44px]',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
