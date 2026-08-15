'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  subtitle?: string;
  badgeText?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  subtitle,
  badgeText,
  className,
}) => {
  return (
    <Card variant="interactive" className={cn('p-4 sm:p-5 flex flex-col justify-between', className)}>
      <div className="flex items-start justify-between space-x-2">
        <div className="space-y-1">
          <span className="text-xs text-content-secondary font-medium tracking-wide uppercase">
            {title}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-content-primary tracking-tight">
            {value}
          </div>
        </div>

        {icon && (
          <div className="w-10 h-10 rounded-xl bg-brand-light border border-brand/20 text-brand flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      {(change || subtitle || badgeText) && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-sara-border text-xs">
          {change && (
            <div
              className={cn(
                'inline-flex items-center gap-1 font-mono font-medium',
                trend === 'up' && 'text-emerald-400',
                trend === 'down' && 'text-red-400',
                trend === 'neutral' && 'text-content-secondary'
              )}
            >
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change}</span>
            </div>
          )}

          {subtitle && (
            <span className="text-content-tertiary font-light truncate">
              {subtitle}
            </span>
          )}

          {badgeText && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sara-elevated border border-sara-border text-content-secondary uppercase">
              {badgeText}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
