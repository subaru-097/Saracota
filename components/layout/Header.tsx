'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import {
  Search,
  Bell,
  Plus,
  Building2,
  Zap,
  CheckCheck,
  X,
  FileText,
  Percent,
  Truck,
  ChevronDown,
  User,
} from 'lucide-react';

export interface HeaderProps {
  onOpenNewQuote?: () => void;
  onOpenSearch?: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewQuote,
  onOpenSearch,
  onNavigateTab,
}) => {
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const { user, isProprietario } = useAuth();

  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);
  const [isCnpjDropdownOpen, setIsCnpjDropdownOpen] = useState(false);
  const [activeObra, setActiveObra] = useState({
    nome: 'Reserva das Palmeiras',
    cnpj: '12.345.678/0001-90',
  });

  const obrasList = [
    { nome: 'Reserva das Palmeiras', cnpj: '12.345.678/0001-90' },
    { nome: 'Condomínio Horizon Bloco B', cnpj: '98.765.432/0001-10' },
    { nome: 'Empreen. Villa Flora', cnpj: '45.678.901/0001-55' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full h-[60px] sara-glass border-b border-sara-border px-4 sm:px-6 flex items-center justify-between">
      {/* Brand Logo & CNPJ Dropdown */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand via-amber-500 to-amber-700 flex items-center justify-center text-black font-extrabold font-mono text-sm shadow-glow shrink-0">
            <Zap className="w-4 h-4 text-black fill-black" />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-content-primary">
            Sara<span className="text-brand">Cota</span>
          </span>
        </div>

        {/* Seletor de CNPJ / Obra Ativo Dropdown */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setIsCnpjDropdownOpen(!isCnpjDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-sara-surface border border-sara-border hover:border-sara-border-highlight text-xs text-content-secondary transition-all cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-brand" />
            <div className="text-left font-mono">
              <span className="font-bold text-content-primary block leading-none text-[11px]">
                {activeObra.nome}
              </span>
              <span className="text-[9px] text-content-tertiary block leading-none">
                {activeObra.cnpj}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-content-tertiary" />
          </button>

          {isCnpjDropdownOpen && (
            <div className="absolute left-0 top-10 z-50 w-64 sara-glass-floating border border-sara-border-highlight rounded-xl p-2 space-y-1 shadow-floating">
              <span className="px-2 py-1 text-[10px] font-mono uppercase text-content-tertiary block">
                Selecione o CNPJ / Obra Ativa:
              </span>
              {obrasList.map((o) => (
                <button
                  key={o.cnpj}
                  type="button"
                  onClick={() => {
                    setActiveObra(o);
                    setIsCnpjDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors ${
                    activeObra.cnpj === o.cnpj
                      ? 'bg-brand-light text-brand font-bold border border-brand/30'
                      : 'hover:bg-sara-hover text-content-secondary'
                  }`}
                >
                  <span className="block font-bold">{o.nome}</span>
                  <span className="text-[10px] text-content-tertiary block">{o.cnpj}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global Search Bar Trigger (Desktop & Tablet) */}
      <div className="hidden sm:flex items-center flex-1 max-w-md mx-4">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-sara-surface hover:bg-sara-hover border border-sara-border hover:border-sara-border-highlight text-content-tertiary text-xs rounded-xl transition-all cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-content-tertiary" />
            <span>Buscar produto, código NCM ou fornecedor...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-sara-elevated border border-sara-border rounded text-content-tertiary">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Quick Actions & Notifications */}
      <div className="flex items-center space-x-2 sm:space-x-3 relative">
        {/* User Role Badge */}
        <Badge variant={isProprietario ? 'brand' : 'emerald'} size="sm" className="hidden lg:inline-flex font-mono uppercase">
          {isProprietario ? 'PROPRIETÁRIO' : 'COLABORADOR'}
        </Badge>

        {/* Notifications Bell Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationPopoverOpen(!isNotificationPopoverOpen)}
            className="p-2 text-content-secondary hover:text-content-primary hover:bg-sara-hover rounded-xl relative min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 min-w-[18px] h-[18px] bg-brand text-black text-[10px] font-mono font-bold rounded-full flex items-center justify-center shadow-glow animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {isNotificationPopoverOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 sara-glass-floating border border-sara-border-highlight rounded-2xl shadow-floating p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-sara-border">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-content-primary">Notificações</h4>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-light text-brand border border-brand/30">
                      {unreadCount} não lidas
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="p-1 text-content-tertiary hover:text-brand rounded text-xs flex items-center gap-1 font-mono transition-colors"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Lidas
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNotificationPopoverOpen(false)}
                    className="p-1 text-content-tertiary hover:text-content-primary rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {notifications.length === 0 ? (
                  <p className="text-xs text-content-tertiary text-center py-4">
                    Nenhuma notificação no momento.
                  </p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        if (notif.linkTab && onNavigateTab) {
                          onNavigateTab(notif.linkTab);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                        !notif.read
                          ? 'bg-sara-elevated border-sara-border-highlight shadow-sm'
                          : 'bg-sara-surface/50 border-sara-border opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {notif.category === 'cotacao' && <FileText className="w-3.5 h-3.5 text-brand shrink-0" />}
                          {notif.category === 'fornecedor' && <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {notif.category === 'tributario' && <Percent className="w-3.5 h-3.5 text-accent-cyan shrink-0" />}
                          <span className="text-xs font-semibold text-content-primary leading-tight">
                            {notif.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-content-tertiary shrink-0">
                          {notif.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-content-secondary font-light leading-relaxed">
                        {notif.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* New Quote CTA Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenNewQuote}
          leftIcon={<Plus className="w-4 h-4 text-black" />}
          className="hidden xs:inline-flex text-xs font-semibold"
        >
          Nova Cotação
        </Button>

        {/* User Avatar */}
        <div className="w-9 h-9 rounded-xl bg-sara-elevated border border-sara-border-highlight flex items-center justify-center text-xs font-mono font-bold text-brand shrink-0 cursor-pointer">
          <User className="w-4 h-4 text-brand" />
        </div>
      </div>
    </header>
  );
};
