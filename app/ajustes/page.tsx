'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AjustesView } from '@/components/features/AjustesView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AjustesPage() {
  const [activeTab, setActiveTab] = useState('ajustes');

  return (
    <ProtectedRoute requiredRole="proprietario">
      <AppShell activeTab={activeTab} onChangeTab={setActiveTab}>
        <AjustesView />
      </AppShell>
    </ProtectedRoute>
  );
}
