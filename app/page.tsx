'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroSection } from '@/components/features/HeroSection';
import { PainelView } from '@/components/features/PainelView';
import { CotacoesView } from '@/components/features/CotacoesView';
import { FornecedoresView } from '@/components/features/FornecedoresView';
import { HistoricoView } from '@/components/features/HistoricoView';
import { AjustesView } from '@/components/features/AjustesView';
import DesignSystemShowcasePage from './design-system/page';

export default function Home() {
  const [activeTab, setActiveTab] = useState('hero');

  return (
    <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
      {(activeTab === 'hero' || activeTab === 'painel' || activeTab === 'dashboard') && (
        <div className="space-y-10">
          <HeroSection />
          <PainelView onNavigateTab={setActiveTab} />
        </div>
      )}

      {(activeTab === 'cotacoes' || activeTab === 'quotes') && <CotacoesView />}

      {(activeTab === 'fornecedores' || activeTab === 'suppliers') && <FornecedoresView />}

      {(activeTab === 'historico' || activeTab === 'history') && <HistoricoView />}

      {(activeTab === 'ajustes' || activeTab === 'settings') && <AjustesView />}

      {activeTab === 'design-system' && <DesignSystemShowcasePage />}
    </AppShell>
  );
}
