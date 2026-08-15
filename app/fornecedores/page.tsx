'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { FornecedoresView } from '@/components/features/FornecedoresView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function FornecedoresPage() {
  const [activeTab, setActiveTab] = useState('fornecedores');

  return (
    <ProtectedRoute>
      <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
        <FornecedoresView />
      </AppShell>
    </ProtectedRoute>
  );
}
