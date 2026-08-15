'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ backgroundColor: '#0A0C0E', color: '#FFFFFF', fontFamily: 'sans-serif', padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', background: '#181E27', padding: '32px', borderRadius: '16px', border: '1px solid #2B333E' }}>
          <h2 style={{ fontSize: '20px', color: '#F59E0B', marginBottom: '12px' }}>Sara Cota • Recuperação de Sistema</h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>
            {error?.message || 'Recarregando os componentes essenciais da plataforma...'}
          </p>
          <button
            onClick={() => reset()}
            style={{ backgroundColor: '#F59E0B', color: '#000000', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Atualizar Plataforma
          </button>
        </div>
      </body>
    </html>
  );
}
