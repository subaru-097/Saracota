'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center p-1 bg-sara-surface border border-sara-border rounded-xl overflow-x-auto no-scrollbar scroll-smooth min-h-[44px]',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 shrink-0 select-none cursor-pointer min-h-[36px]',
              isActive
                ? 'bg-sara-elevated text-brand font-semibold shadow-sm border border-sara-border-highlight'
                : 'text-content-secondary hover:text-content-primary hover:bg-sara-hover/50'
            )}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                  isActive
                    ? 'bg-brand-light text-brand'
                    : 'bg-sara-hover text-content-tertiary'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
