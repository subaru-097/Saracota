'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface NotificationEvent {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: string;
  read: boolean;
  category: 'cotacao' | 'fornecedor' | 'tributario';
  linkTab?: string;
}

interface NotificationContextData {
  notifications: NotificationEvent[];
  unreadCount: number;
  addNotification: (event: Omit<NotificationEvent, 'id' | 'timestamp' | 'read'>) => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  activeToast: NotificationEvent | null;
  dismissToast: () => void;
}

const INITIAL_NOTIFICATIONS: NotificationEvent[] = [
  {
    id: 'notif-1',
    title: 'Nova Cotação Recebida via WhatsApp',
    description: 'Reserva das Palmeiras #8492: 2 itens extraídos de áudio do encarregado Marcos.',
    type: 'success',
    timestamp: 'Há 5 minutos',
    read: false,
    category: 'cotacao',
    linkTab: 'quotes',
  },
  {
    id: 'notif-2',
    title: 'Resposta de Fornecedor Credenciado',
    description: 'Hidráulica & Elétrica Central enviou proposta com menor preço para Tubos 100mm.',
    type: 'info',
    timestamp: 'Há 18 minutos',
    read: false,
    category: 'fornecedor',
    linkTab: 'quotes',
  },
  {
    id: 'notif-3',
    title: 'Alerta de Substituição Tributária (SP → MG)',
    description: 'Alíquota MVA ajustada para NCM 8544.49.00 no projeto Condomínio Horizon.',
    type: 'warning',
    timestamp: 'Há 1 hora',
    read: false,
    category: 'tributario',
    linkTab: 'settings',
  },
];

const NotificationContext = createContext<NotificationContextData>(
  {} as NotificationContextData
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationEvent[]>(
    INITIAL_NOTIFICATIONS
  );
  const [activeToast, setActiveToast] = useState<NotificationEvent | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (event: Omit<NotificationEvent, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: NotificationEvent = {
        ...event,
        id: `notif-${Date.now()}`,
        timestamp: 'Agora mesmo',
        read: false,
      };

      setNotifications((prev) => [newNotif, ...prev]);
      setActiveToast(newNotif);

      // Auto dismiss toast popup after 4 seconds
      setTimeout(() => {
        setActiveToast((current) => (current?.id === newNotif.id ? null : current));
      }, 4500);
    },
    []
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAllAsRead,
        markAsRead,
        removeNotification,
        activeToast,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de um NotificationProvider');
  }
  return context;
}
