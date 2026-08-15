'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CotacoesView } from '@/components/features/CotacoesView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function CotacoesPage() {
  const [activeTab, setActiveTab] = useState('cotacoes');

  return (
    <ProtectedRoute>
      <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
        <CotacoesView />
      </AppShell>
    </ProtectedRoute>
  );
}
