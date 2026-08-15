'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Building2,
  Clock,
  Settings,
  Sparkles,
  Zap,
  LogOut,
  User,
} from 'lucide-react';

export interface SidebarProps {
  activeTab?: string;
  onChangeTab?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab = 'painel',
  onChangeTab = () => {},
}) => {
  const { user, isProprietario, signOut } = useAuth();

  const menuItems = [
    { id: 'painel', href: '/painel', label: 'Painel', icon: LayoutDashboard },
    { id: 'cotacoes', href: '/cotacoes', label: 'Cotações', icon: FileText, badge: '3' },
    { id: 'fornecedores', href: '/fornecedores', label: 'Fornecedores', icon: Building2 },
    { id: 'historico', href: '/historico', label: 'Histórico', icon: Clock },
    { id: 'ajustes', href: '/ajustes', label: 'Ajustes', icon: Settings, isRestricted: !isProprietario },
    { id: 'design-system', href: '/design-system', label: 'Design System Showcase', icon: Sparkles, badge: 'UI' },
  ];

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between sara-glass border-r border-sara-border min-h-[calc(100vh-60px)] p-4">
      <div className="space-y-6">
        {/* Workspace / Project Switcher */}
        <div className="p-3 rounded-xl bg-sara-surface border border-sara-border flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center font-bold text-xs font-mono shrink-0">
            <Zap className="w-4 h-4 text-brand" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-bold text-content-primary truncate block">
              Reserva das Palmeiras
            </span>
            <span className="text-[10px] font-mono text-content-tertiary block">
              CNPJ 12.345.678/0001-90
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-content-tertiary block mb-2">
            Menu Principal
          </span>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (activeTab === 'dashboard' && item.id === 'painel') ||
              (activeTab === 'quotes' && item.id === 'cotacoes') ||
              (activeTab === 'suppliers' && item.id === 'fornecedores') ||
              (activeTab === 'history' && item.id === 'historico') ||
              (activeTab === 'settings' && item.id === 'ajustes');

            return (
              <Link key={item.id} href={item.href} className="block cursor-pointer">
                <div
                  onClick={() => onChangeTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand text-black font-bold shadow-glow'
                      : 'text-content-secondary hover:text-content-primary hover:bg-sara-hover'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-content-tertiary'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                        isActive
                          ? 'bg-black/20 text-black font-bold'
                          : 'bg-brand-light text-brand font-semibold'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer & Logout Button */}
      <div className="pt-4 border-t border-sara-border space-y-3">
        <div className="flex items-center space-x-2 px-2">
          <div className="w-8 h-8 rounded-full bg-brand-light border border-brand/30 text-brand flex items-center justify-center text-xs font-bold font-mono shrink-0">
            <User className="w-4 h-4 text-brand" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <span className="text-xs font-bold text-content-primary truncate block">
              {user?.nome || (isProprietario ? 'Proprietário' : 'Colaborador')}
            </span>
            <span className="text-[10px] font-mono text-content-tertiary truncate block">
              {user?.email || 'usuario@construtora.com'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
};
