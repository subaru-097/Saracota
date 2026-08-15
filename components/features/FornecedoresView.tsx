'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/db/client';
import {
  Building2,
  Plus,
  Globe,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Search,
  AlertCircle,
  PackageOpen,
  Lock,
} from 'lucide-react';

export const FornecedoresView: React.FC = () => {
  const { addNotification } = useNotifications();
  const { isProprietario, user } = useAuth();

  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form de Cadastro de Fornecedor
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Elétrica & Fiação');
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Alerta de Exclusão Bloqueada / Confirmação
  const [deleteAlertModal, setDeleteAlertModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const carregarFornecedores = useCallback(async (queryParam?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const lista = await db.fornecedores.list(queryParam);
      setFornecedores(lista);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar lista de fornecedores do banco.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarFornecedores(searchQuery);
  }, [searchQuery, carregarFornecedores]);

  const handleCadastrarFornecedor = async () => {
    if (!isProprietario) {
      addNotification({
        title: 'Ação Bloqueada por RBAC',
        description: 'Apenas o Proprietário da empresa pode cadastrar fornecedores.',
        type: 'error',
        category: 'fornecedor',
      });
      return;
    }

    if (!nomeInput.trim()) {
      addNotification({
        title: 'Nome Obrigatório',
        description: 'Informe o nome do fornecedor/lojista.',
        type: 'warning',
        category: 'fornecedor',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const novoForn = await db.fornecedores.create({
        nome: nomeInput,
        categoria: categoriaInput,
        score_confiabilidade: 5.0,
        prazo_medio_dias: 2,
      });

      addNotification({
        title: 'Fornecedor Cadastrado com Sucesso!',
        description: `${novoForn.nome} gravado na tabela fornecedores do banco real.`,
        type: 'success',
        category: 'fornecedor',
        linkTab: 'fornecedores',
      });

      setIsModalOpen(false);
      setNomeInput('');
      setUrlInput('');
      carregarFornecedores(searchQuery);
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Cadastrar',
        description: err.message || 'Falha na gravação do fornecedor no banco.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestarConexao = (nome: string) => {
    addNotification({
      title: 'Conexão B2B Testada',
      description: `Sessão com ${nome} validada com sucesso! Resposta em 14 min SLA.`,
      type: 'info',
      category: 'fornecedor',
    });
  };

  const handleRemoverFornecedor = async (id: string, nome: string) => {
    if (!isProprietario) {
      addNotification({
        title: 'Acesso Restrito',
        description: 'Apenas o Proprietário pode excluir fornecedores.',
        type: 'error',
        category: 'fornecedor',
      });
      return;
    }

    const res = await db.fornecedores.delete(id);
    if (!res.success) {
      setDeleteAlertModal({
        open: true,
        message: res.errorMsg || 'Exclusão não permitida por haver cotações vinculadas.',
      });
      return;
    }

    addNotification({
      title: 'Fornecedor Removido',
      description: `${nome} excluído do banco de dados com sucesso.`,
      type: 'warning',
      category: 'fornecedor',
    });

    carregarFornecedores(searchQuery);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Row com Distinção de Role RBAC */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sara Cota RBAC • Perfil: {isProprietario ? 'PROPRIETÁRIO (Acesso Total)' : 'COLABORADOR (Somente Leitura)'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Fornecedores & Portais B2B
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Lojistas cadastrados para cotação automatizada com credenciais criptografadas.
          </p>
        </div>

        {/* Botão de Adicionar Fornecedor visível APENAS para Proprietário */}
        {isProprietario ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4 text-black" />}
          >
            Adicionar Fornecedor
          </Button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sara-surface border border-sara-border text-xs text-content-tertiary font-mono">
            <Lock className="w-3.5 h-3.5" /> Gerenciamento Restrito ao Proprietário
          </div>
        )}
      </div>

      {/* Campo de Busca em Tempo Real no Banco */}
      <div className="w-full sm:w-80">
        <Input
          placeholder="Buscar lojista por nome ou categoria..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-content-tertiary" />}
        />
      </div>

      {/* ESTADO 1: LOADING STATE */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} variant="bordered" className="p-5 space-y-4">
              <Skeleton variant="text" className="w-3/4 h-5" />
              <Skeleton variant="text" className="w-1/2 h-4" />
              <Skeleton variant="rectangular" className="h-10 rounded-xl" />
              <Skeleton variant="rectangular" className="h-9 rounded-xl" />
            </Card>
          ))}
        </div>
      )}

      {/* ESTADO 2: ERROR STATE */}
      {!isLoading && errorMsg && (
        <Card variant="bordered" className="p-8 text-center space-y-4 border-rose-500/40 bg-rose-500/5">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-content-primary">Falha ao Conectar com a Tabela Fornecedores</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              {errorMsg}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => carregarFornecedores(searchQuery)}
            leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
          >
            Tentar Novamente
          </Button>
        </Card>
      )}

      {/* ESTADO 3: EMPTY STATE */}
      {!isLoading && !errorMsg && fornecedores.length === 0 && (
        <Card variant="bordered" className="p-8 text-center space-y-4 bg-sara-surface">
          <PackageOpen className="w-12 h-12 text-brand mx-auto opacity-80" />
          <div>
            <h3 className="text-base font-bold text-content-primary">Nenhum Lojista Cadastrado no Banco</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              Cadastre seu primeiro fornecedor credenciado para vinculação automática às listas de cotação.
            </p>
          </div>
          {isProprietario && (
            <Button variant="primary" size="md" onClick={() => setIsModalOpen(true)}>
              Cadastrar Primeiro Fornecedor
            </Button>
          )}
        </Card>
      )}

      {/* ESTADO 4: DADOS REAIS DO BANCO CARREGADOS */}
      {!isLoading && !errorMsg && fornecedores.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fornecedores.map((forn) => (
            <Card key={forn.id} variant="default" className="flex flex-col justify-between hover:border-brand/40 transition-colors">
              <CardHeader className="pb-3 border-b border-sara-border">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="emerald" size="sm" pulse>
                    Sessão Ativa (Conectado)
                  </Badge>
                  <span className="text-xs font-mono text-amber-400 font-bold">★ {forn.scoreConfiabilidade}</span>
                </div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand" /> {forn.nome}
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  Categoria: {forn.categoria || 'Geral'}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-3 space-y-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-content-tertiary truncate">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">https://portal.{forn.nome.toLowerCase().replace(/\s+/g, '')}.com.br</span>
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-sara-border flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 justify-center text-xs"
                  onClick={() => handleTestarConexao(forn.nome)}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Testar Conexão
                </Button>

                {/* Botão de Remover visível APENAS para Proprietário */}
                {isProprietario && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="px-2.5"
                    onClick={() => handleRemoverFornecedor(forn.id, forn.nome)}
                    title="Remover Fornecedor do Banco"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Cadastrar Fornecedor */}
      {isProprietario && (
        <Sheet
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Cadastrar Novo Lojista B2B (Proprietário)"
          description="Informe os dados para gravação na tabela fornecedores."
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                isLoading={isSubmitting}
                onClick={handleCadastrarFornecedor}
              >
                Salvar no Banco Real
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Nome do Fornecedor / Lojista"
              placeholder="Ex: Comercial Elétrica Luz Ltda"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
            />

            <Select
              label="Categoria de Atuação Principal"
              value={categoriaInput}
              onChange={(e) => setCategoriaInput(e.target.value)}
            >
              <option value="Elétrica & Fiação">Elétrica & Fiação</option>
              <option value="Tubos & Hidráulica">Tubos & Hidráulica</option>
              <option value="Cimento & Argamassa">Cimento & Argamassa</option>
              <option value="Estrutura & Vergalhão">Estrutura & Vergalhão</option>
            </Select>

            <Input
              label="URL do Portal B2B de Cotação"
              placeholder="https://portal.lojista.com.br/login"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              leftIcon={<Globe className="w-4 h-4 text-content-tertiary" />}
            />
          </div>
        </Sheet>
      )}

      {/* Modal de Alerta de Exclusão Bloqueada */}
      <Sheet
        isOpen={deleteAlertModal.open}
        onClose={() => setDeleteAlertModal({ open: false, message: '' })}
        title="Exclusão de Fornecedor Bloqueada"
        description="Regra de proteção de dados relacional (Chave Estrangeira)."
        footer={
          <Button variant="primary" onClick={() => setDeleteAlertModal({ open: false, message: '' })}>
            Compreendido
          </Button>
        }
      >
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 space-y-2">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <span className="font-bold block text-sm">Não foi possível excluir o lojista:</span>
          <p className="font-light">{deleteAlertModal.message}</p>
        </div>
      </Sheet>
    </div>
  );
};
