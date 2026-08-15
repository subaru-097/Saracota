'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { HistoricoView } from '@/components/features/HistoricoView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function HistoricoPage() {
  const [activeTab, setActiveTab] = useState('historico');

  return (
    <ProtectedRoute>
      <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
        <HistoricoView />
      </AppShell>
    </ProtectedRoute>
  );
}
