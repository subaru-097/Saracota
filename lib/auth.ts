import { Usuario } from '@/types';

export const CURRENT_MOCK_USER: Usuario = {
  id: 'usr-01',
  nome: 'Engenheiro Marcos Silva',
  email: 'marcos@engenharia-alfa.com.br',
  role: 'colaborador',
  cargo: 'comprador',
  clienteId: 'cli-01',
  avatarUrl: '',
};

export interface AuthState {
  user: Usuario | null;
  isAuthenticated: boolean;
  role: 'colaborador' | 'proprietario';
}

export function createMockToken(user: Usuario): string {
  const payload = {
    sub: user.id,
    email: user.email,
    cargo: user.cargo,
    role: user.role,
    iat: Date.now(),
  };
  return btoa(JSON.stringify(payload));
}
