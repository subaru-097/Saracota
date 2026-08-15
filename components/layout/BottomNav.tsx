'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Building2, Clock, Settings } from 'lucide-react';

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface BottomNavProps {
  activeTab: string;
  onChangeTab: (id: string) => void;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'painel',
    href: '/painel',
    label: 'Painel',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    id: 'cotacoes',
    href: '/cotacoes',
    label: 'Cotações',
    icon: <FileText className="w-5 h-5" />,
    badge: 3,
  },
  {
    id: 'fornecedores',
    href: '/fornecedores',
    label: 'Fornecedores',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: 'historico',
    href: '/historico',
    label: 'Histórico',
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: 'ajustes',
    href: '/ajustes',
    label: 'Ajustes',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-[64px] sara-glass border-t border-sara-border md:hidden flex items-center justify-around px-2 pb-safe">
      {NAV_ITEMS.map((item) => {
        const isActive =
          activeTab === item.id ||
          (activeTab === 'dashboard' && item.id === 'painel') ||
          (activeTab === 'quotes' && item.id === 'cotacoes') ||
          (activeTab === 'suppliers' && item.id === 'fornecedores') ||
          (activeTab === 'history' && item.id === 'historico') ||
          (activeTab === 'settings' && item.id === 'ajustes');

        return (
          <Link key={item.id} href={item.href} className="flex-1 cursor-pointer">
            <div
              onClick={() => onChangeTab(item.id)}
              className={cn(
                'flex flex-col items-center justify-center h-full py-1 text-[10px] font-medium transition-all duration-200 relative cursor-pointer min-h-[44px] select-none',
                isActive
                  ? 'text-brand font-semibold'
                  : 'text-content-tertiary hover:text-content-secondary'
              )}
            >
              {/* Active top glow indicator */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-brand rounded-full shadow-glow" />
              )}

              <div className="relative">
                {item.icon}
                {typeof item.badge === 'number' && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] h-[14px] bg-brand text-black text-[9px] font-mono font-bold rounded-full flex items-center justify-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className="mt-1 tracking-tight">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
};
