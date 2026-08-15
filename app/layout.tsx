import type { Metadata, Viewport } from 'next';
import { NotificationProvider } from '@/context/NotificationContext';
import { CotacoesProvider } from '@/context/CotacoesContext';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sara Cota | Cotação Inteligente de Materiais de Construção',
  description: 'Plataforma SaaS premium para lojistas, engenheiros e empreiteiros realizarem cotações de material elétrico, hidráulico e construção civil.',
};

export const viewport: Viewport = {
  themeColor: '#0A0C0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-sara-canvas text-content-primary antialiased selection:bg-brand selection:text-black min-h-screen">
        <AuthProvider>
          <NotificationProvider>
            <CotacoesProvider>{children}</CotacoesProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
