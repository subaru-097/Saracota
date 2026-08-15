'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CotacoesView } from '@/components/features/CotacoesView';

export default function NovaCotacaoPage() {
  const [activeTab, setActiveTab] = useState('cotacoes');

  return (
    <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
      <CotacoesView />
    </AppShell>
  );
}
