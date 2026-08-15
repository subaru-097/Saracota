'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PainelView } from '@/components/features/PainelView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function PainelPage() {
  const [activeTab, setActiveTab] = useState('painel');

  return (
    <ProtectedRoute>
      <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
        <PainelView
          onNavigateTab={setActiveTab}
          onOpenNovaCotacao={() => setActiveTab('cotacoes')}
        />
      </AppShell>
    </ProtectedRoute>
  );
}
