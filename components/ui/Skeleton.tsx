'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  ...props
}) => {
  const variants = {
    text: 'h-4 w-full rounded-md',
    circular: 'w-10 h-10 rounded-full',
    rectangular: 'h-12 w-full rounded-xl',
    card: 'h-32 w-full rounded-2xl p-4',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-sara-elevated/70 border border-sara-border/50 animate-pulse',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
