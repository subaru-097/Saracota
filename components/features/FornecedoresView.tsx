'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/db/client';
import { Fornecedor, RegistroExecucaoRPA } from '@/types';
import { formatPhoneMask, validatePhone } from '@/lib/utils/whatsapp';
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
  Edit3,
  MessageCircle,
  User,
  KeyRound,
  FileText,
  Mail,
  CreditCard,
  CheckCircle2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertTriangle,
  Camera,
  FileCode,
} from 'lucide-react';

const CATEGORIAS_FORNECEDOR = [
  'Elétrica',
  'Hidráulica',
  'Construção',
  'Ferragens',
  'Outros',
];

export type LoginType = 'email' | 'cnpj' | 'login';

/**
 * Máscara de CNPJ: 00.000.000/0000-00
 */
export function formatCNPJMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Validação de dígitos verificadores de CNPJ
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let tamanho = digits.length - 2;
  let numeros = digits.substring(0, tamanho);
  const digitos = digits.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = digits.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return resultado === Number(digitos.charAt(1));
}

export const FornecedoresView: React.FC = () => {
  const { addNotification } = useNotifications();
  const { isProprietario } = useAuth();

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ESTADOS DO MODAL (CRIAR / EDITAR)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFornecedorId, setEditingFornecedorId] = useState<string | null>(null);

  // Campos do Formulário Flexível de Cadastro
  const [nomeInput, setNomeInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Elétrica');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Estado de Validação em Tempo Real da URL
  const [urlChecking, setUrlChecking] = useState(false);
  const [urlCheckResult, setUrlCheckResult] = useState<{
    status: 'VALIDO' | 'SSL_INVALIDO' | 'DOMINIO_SUSPEITO' | 'INACESSIVEL' | null;
    mensagem: string | null;
  }>({ status: null, mensagem: null });

  // SELEÇÃO ÚNICA POR RADIO BUTTONS
  const [loginType, setLoginType] = useState<LoginType>('email');
  const [showGenericLoginOption, setShowGenericLoginOption] = useState(false);

  // Valores das Credenciais Dinâmicas
  const [emailInput, setEmailInput] = useState('');
  const [cnpjInput, setCnpjInput] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [observacoesInput, setObservacoesInput] = useState('');

  // Configurações de Automação RPA (Modal vs Page)
  const [rpaLoginType, setRpaLoginType] = useState<'modal' | 'page'>('modal');
  const [rpaTriggerSelector, setRpaTriggerSelector] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal de Confirmação de Exclusão
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item: Fornecedor | null }>({
    open: false,
    item: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // ESTADO DO MODAL DE LOGS RPA DETALHADOS E OBSERVABILIDADE
  const [rpaModal, setRpaModal] = useState<{
    open: boolean;
    supplier: Fornecedor | null;
    result: any | null;
    isRunning: boolean;
  }>({
    open: false,
    supplier: null,
    result: null,
    isRunning: false,
  });
  const [showFullLogs, setShowFullLogs] = useState(false);

  // TROCA DE RADIO BUTTON LIMPA O CAMPO ANTERIOR
  const handleSelectLoginType = (type: LoginType) => {
    setLoginType(type);
    if (type !== 'email') setEmailInput('');
    if (type !== 'cnpj') setCnpjInput('');
    if (type !== 'login') setLoginInput('');
  };

  // CARREGAR FORNECEDORES DO BANCO REAL COM SUPORTE A BUSCA
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

  // BUSCA AUTOMÁTICA DE FAVICON / LOGO VIA GOOGLE FAVICON API
  const handleUrlBlur = () => {
    if (!urlInput.trim()) return;

    let urlTratada = urlInput.trim();
    if (!/^https?:\/\//i.test(urlTratada)) {
      urlTratada = `https://${urlTratada}`;
      setUrlInput(urlTratada);
    }

    try {
      const parsed = new URL(urlTratada);
      const domain = parsed.hostname;
      if (domain) {
        const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        setLogoUrl(iconUrl);
      }
    } catch (e) {
      console.warn('URL inválida para favicon:', e);
    }
  };

  // VERIFICAÇÃO DE URL EM TEMPO REAL
  const handleVerificarUrl = async () => {
    if (!urlInput.trim()) {
      setUrlCheckResult({
        status: 'INACESSIVEL',
        mensagem: '❌ URL inválida ou inacessível',
      });
      return;
    }

    let urlFormatada = urlInput.trim();
    if (!/^https?:\/\//i.test(urlFormatada)) {
      urlFormatada = `https://${urlFormatada}`;
      setUrlInput(urlFormatada);
    }

    setUrlChecking(true);
    setUrlCheckResult({ status: null, mensagem: null });

    try {
      const res = await fetch('/api/seguranca/validar-dominio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlCadastrada: urlFormatada, urlTestada: urlFormatada }),
      });
      const data = await res.json();

      if (res.ok && data.sucesso) {
        setUrlCheckResult({
          status: 'VALIDO',
          mensagem: '✅ Domínio acessível e certificado SSL válido',
        });
      } else if (data.status === 'SSL_INVALIDO') {
        setUrlCheckResult({
          status: 'SSL_INVALIDO',
          mensagem: '⚠️ Não foi possível validar o certificado SSL',
        });
      } else {
        setUrlCheckResult({
          status: 'INACESSIVEL',
          mensagem: '❌ URL inválida ou inacessível',
        });
      }
    } catch (e) {
      setUrlCheckResult({
        status: 'INACESSIVEL',
        mensagem: '❌ URL inválida ou inacessível',
      });
    } finally {
      setUrlChecking(false);
    }
  };

  // CÁLCULO DE VALIDAÇÃO GERAL DO FORMULÁRIO COM SELEÇÃO ÚNICA RADIO
  const isIdentificacaoValid =
    loginType === 'email'
      ? Boolean(emailInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim()))
      : loginType === 'cnpj'
      ? Boolean(cnpjInput.replace(/\D/g, '').length === 14)
      : Boolean(loginInput.trim().length > 0);

  const isSenhaValid = editingFornecedorId ? true : senhaInput.trim().length >= 4;

  const isFormValid = Boolean(
    nomeInput.trim() &&
    urlInput.trim() &&
    isIdentificacaoValid &&
    isSenhaValid
  );

  // ABRIR MODAL PARA CRIAR NOVO FORNECEDOR
  const handleOpenCreateModal = () => {
    setEditingFornecedorId(null);
    setNomeInput('');
    setUrlInput('');
    setUrlCheckResult({ status: null, mensagem: null });
    setLogoUrl(null);
    setCategoriaInput('Elétrica');
    setWhatsappInput('');
    setLoginType('email');
    setShowGenericLoginOption(false);
    setEmailInput('');
    setCnpjInput('');
    setLoginInput('');
    setSenhaInput('');
    setRpaLoginType('modal');
    setRpaTriggerSelector('');
    setObservacoesInput('');
    setIsModalOpen(true);
  };

  // ABRIR MODAL PARA EDITAR FORNECEDOR EXISTENTE
  const handleOpenEditModal = (forn: Fornecedor) => {
    setEditingFornecedorId(forn.id);
    setNomeInput(forn.nome);
    setUrlInput(forn.urlPortalB2B || '');
    setUrlCheckResult({ status: null, mensagem: null });
    setLogoUrl(forn.logoUrl || null);
    setCategoriaInput(forn.categoria || 'Elétrica');
    setWhatsappInput(forn.whatsapp ? formatPhoneMask(forn.whatsapp) : '');
    setRpaLoginType(forn.loginType || 'modal');
    setRpaTriggerSelector(forn.triggerSelector || '');

    const tipos = forn.tiposLogin || [];
    const emailVal = forn.email || (forn.login && forn.login.includes('@') ? forn.login : '');
    const cnpjVal = forn.cnpj || (forn.login && !forn.login.includes('@') && forn.login.length >= 14 ? forn.login : '');

    if (cnpjVal || tipos.includes('cnpj')) {
      setLoginType('cnpj');
    } else if (forn.login && !forn.login.includes('@')) {
      setLoginType('login');
      setShowGenericLoginOption(true);
    } else {
      setLoginType('email');
    }

    setEmailInput(emailVal);
    setCnpjInput(cnpjVal ? formatCNPJMask(cnpjVal) : '');
    setLoginInput(forn.login || '');
    setSenhaInput('');
    setObservacoesInput(forn.observacoes || '');
    setIsModalOpen(true);
  };

  // CADASTRAR OU ATUALIZAR FORNECEDOR
  const handleSaveFornecedor = async () => {
    if (!isProprietario || !isFormValid) return;

    let urlValidada = urlInput.trim();
    if (!/^https?:\/\//i.test(urlValidada)) {
      urlValidada = `https://${urlValidada}`;
    }

    const tiposLoginArray: string[] = [loginType];

    setIsSubmitting(true);
    try {
      if (editingFornecedorId) {
        const updatePayload = {
          nome: nomeInput.trim(),
          categoria: categoriaInput,
          whatsapp: whatsappInput.trim() ? formatPhoneMask(whatsappInput) : undefined,
          urlPortalB2B: urlValidada,
          tiposLogin: tiposLoginArray,
          loginType: rpaLoginType,
          triggerSelector: rpaTriggerSelector.trim() || undefined,
          email: loginType === 'email' ? emailInput.trim() : undefined,
          cnpj: loginType === 'cnpj' ? formatCNPJMask(cnpjInput) : undefined,
          login: loginType === 'login' ? loginInput.trim() : undefined,
          senha: senhaInput.trim() || undefined,
          logoUrl: logoUrl || undefined,
          observacoes: observacoesInput.trim() || undefined,
        };

        console.log('🔄 [SUBMIT FORM EDITAR FORNECEDOR] Salvando alteração:', {
          id: editingFornecedorId,
          ...updatePayload,
          senha: senhaInput.trim() ? '••••••••' : '(sem alteração)',
        });

        await db.fornecedores.update(editingFornecedorId, updatePayload);

        addNotification({
          title: 'Fornecedor Atualizado!',
          description: `Os dados e método de login de ${nomeInput} foram atualizados com segurança.`,
          type: 'success',
          category: 'fornecedor',
        });
      } else {
        const novoForn = await db.fornecedores.create({
          nome: nomeInput.trim(),
          categoria: categoriaInput,
          whatsapp: whatsappInput.trim() ? formatPhoneMask(whatsappInput) : undefined,
          urlPortalB2B: urlValidada,
          tiposLogin: tiposLoginArray,
          loginType: rpaLoginType,
          triggerSelector: rpaTriggerSelector.trim() || undefined,
          email: loginType === 'email' ? emailInput.trim() : undefined,
          cnpj: loginType === 'cnpj' ? formatCNPJMask(cnpjInput) : undefined,
          login: loginType === 'login' ? loginInput.trim() : undefined,
          senha: senhaInput.trim(),
          logoUrl: logoUrl || undefined,
          observacoes: observacoesInput.trim() || undefined,
        });

        addNotification({
          title: 'Fornecedor Cadastrado com Sucesso! 🎉',
          description: `${novoForn.nome} gravado no cofre de credenciais B2B com suporte a automação.`,
          type: 'success',
          category: 'fornecedor',
        });
      }

      setIsModalOpen(false);
      carregarFornecedores(searchQuery);
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Salvar',
        description: err.message || 'Falha na comunicação com o banco de dados.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // TESTAR AUTOMAÇÃO DE LOGIN RPA COM LOGGING COMPLETO, SCREENSHOT E DUMP HTML
  const handleTestarConexaoRPA = async (forn: Fornecedor) => {
    setTestingId(forn.id);
    setShowFullLogs(false);
    setRpaModal({
      open: true,
      supplier: forn,
      result: null,
      isRunning: true,
    });

    try {
      const res = await fetch('/api/v1/rpa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: forn.id, headless: true }),
      });

      const data = await res.json();
      const rawRes = data.data || data || {};
      const rpaRes = {
        ...rawRes,
        errorCode: rawRes.errorCode || (rawRes.code ? `ERR_${rawRes.code}` : 'ERR_RPA_FAILURE'),
        categoryLabel: rawRes.categoryLabel || 'Falha na automação',
        errorMsg: rawRes.errorMsg || rawRes.message || 'Falha ao executar teste RPA.',
        logs: rawRes.logs && rawRes.logs.length > 0 ? rawRes.logs : [
          {
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            level: 'error',
            step: 'API_RESPONSE',
            message: rawRes.message || rawRes.errorMsg || 'Resposta obtida do servidor de automação.',
          }
        ]
      };

      setRpaModal((prev) => ({
        ...prev,
        result: rpaRes,
        isRunning: false,
      }));

      // REGISTRAR NO HISTÓRICO DO CARD DO FORNECEDOR
      const novoRegistro: RegistroExecucaoRPA = {
        id: `exec-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        sucesso: Boolean(rpaRes.success),
        tempoMs: rpaRes.executionTimeMs || 0,
        categoria: rpaRes.categoryLabel || (rpaRes.success ? 'Sucesso' : 'Erro desconhecido'),
        erroCodigo: rpaRes.errorCode,
        mensagem: rpaRes.errorMsg,
      };

      const historicoAtual = forn.historicoExecucoesRPA || [];
      const novoHistorico = [novoRegistro, ...historicoAtual].slice(0, 5);

      setFornecedores((prev) =>
        prev.map((f) => (f.id === forn.id ? { ...f, historicoExecucoesRPA: novoHistorico } : f))
      );

      if (rpaRes.success) {
        addNotification({
          title: 'Automação RPA Concluída com Sucesso! 🤖',
          description: `Login no portal de ${forn.nome} autenticado. Tempo: ${(rpaRes.executionTimeMs / 1000).toFixed(1)}s.`,
          type: 'success',
          category: 'fornecedor',
        });
      } else {
        addNotification({
          title: `Falha RPA: ${rpaRes.categoryLabel || 'Erro no Login'}`,
          description: `${rpaRes.errorCode || 'ERR_RPA'}: ${rpaRes.errorMsg || 'Erro no portal.'}`,
          type: 'error',
          category: 'fornecedor',
        });
      }
    } catch (err: any) {
      const errRes = {
        success: false,
        categoryLabel: 'Erro de rede',
        errorCode: 'ERR_NETWORK_FAILURE',
        errorMsg: err.message || 'Falha de conexão com o servidor de automação.',
        timestamp: new Date().toISOString(),
        stackTrace: err.stack || String(err),
      };

      setRpaModal((prev) => ({
        ...prev,
        result: errRes,
        isRunning: false,
      }));

      addNotification({
        title: 'Erro na Execução RPA',
        description: err.message || 'Falha de comunicação com a API de automação.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setTestingId(null);
    }
  };

  // CONFIRMAR E REMOVER FORNECEDOR
  const handleConfirmDelete = async () => {
    if (!deleteModal.item || !isProprietario) return;

    setIsDeleting(true);
    try {
      const res = await db.fornecedores.delete(deleteModal.item.id);
      if (!res.success) {
        addNotification({
          title: 'Exclusão Não Permitida',
          description: res.errorMsg || 'Existem cotações ativas vinculadas a este lojista.',
          type: 'warning',
          category: 'fornecedor',
        });
      } else {
        addNotification({
          title: 'Fornecedor Removido',
          description: `${deleteModal.item.nome} foi excluído do banco de dados.`,
          type: 'warning',
          category: 'fornecedor',
        });
        carregarFornecedores(searchQuery);
      }
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Excluir',
        description: err.message || 'Falha ao remover o fornecedor.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setIsDeleting(false);
      setDeleteModal({ open: false, item: null });
    }
  };

  const getBadgeVariant = (cat?: string) => {
    switch (cat) {
      case 'Elétrica':
        return 'brand';
      case 'Hidráulica':
        return 'emerald';
      case 'Construção':
        return 'rose';
      case 'Ferragens':
        return 'cyan';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Row com Controle RBAC */}
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
            Gestão de credenciais flexíveis com criptografia AES-256 e favicon automático.
          </p>
        </div>

        {/* Botão "+ Adicionar Fornecedor" (Apenas Proprietário) */}
        {isProprietario ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreateModal}
            leftIcon={<Plus className="w-4 h-4 text-black" />}
          >
            + Adicionar Fornecedor
          </Button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sara-surface border border-sara-border text-xs text-content-tertiary font-mono">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Somente Leitura (Colaborador)
          </div>
        )}
      </div>

      {/* Campo de Busca em Tempo Real */}
      <div className="w-full sm:w-80">
        <Input
          placeholder="Filtrar por nome ou categoria..."
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
            <h3 className="text-base font-bold text-content-primary">Nenhum Lojista Encontrado</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              {searchQuery
                ? `Nenhum fornecedor atende ao filtro "${searchQuery}".`
                : 'Cadastre seu primeiro fornecedor com credenciais de e-mail, CNPJ ou usuário.'}
            </p>
          </div>
          {isProprietario && (
            <Button variant="primary" size="md" onClick={handleOpenCreateModal}>
              Cadastrar Primeiro Fornecedor
            </Button>
          )}
        </Card>
      )}

      {/* ESTADO 4: CARDS DE FORNECEDORES COM FAVICON E HISTÓRICO RPA */}
      <ErrorBoundary>
        {!isLoading && !errorMsg && fornecedores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fornecedores.map((forn) => {
              const temCredential = Boolean(forn.login || forn.email || forn.cnpj || forn.urlPortalB2B || forn.senhaCriptografada);

              return (
                <Card
                  key={forn.id}
                  variant="default"
                  className="flex flex-col justify-between hover:border-brand/40 transition-all group"
                >
                  <CardHeader className="pb-3 border-b border-sara-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={getBadgeVariant(forn.categoria)} size="sm">
                        {forn.categoria || 'Geral'}
                      </Badge>

                      {temCredential ? (
                        <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <Lock className="w-3 h-3 text-emerald-400" /> Credenciado
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <AlertCircle className="w-3 h-3 text-amber-400" /> Sem credencial
                        </span>
                      )}
                    </div>

                    <CardTitle className="text-base flex items-center gap-2.5">
                      {forn.logoUrl ? (
                        <img
                          src={forn.logoUrl}
                          alt={forn.nome}
                          className="w-5 h-5 rounded object-contain shrink-0 bg-white p-0.5 border border-sara-border"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-brand shrink-0" />
                      )}
                      <span className="truncate">{forn.nome}</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-3 space-y-2 text-xs font-mono">
                    {/* URL Portal B2B */}
                    {forn.urlPortalB2B && (
                      <div className="flex items-center gap-1.5 text-brand font-semibold truncate">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <a href={forn.urlPortalB2B} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                          {forn.urlPortalB2B}
                        </a>
                      </div>
                    )}

                    {/* WhatsApp */}
                    {forn.whatsapp && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold truncate">
                        <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">{forn.whatsapp}</span>
                      </div>
                    )}

                    {/* E-mail de Login */}
                    {forn.email && (
                      <div className="flex items-center gap-1.5 text-content-secondary truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0 text-content-tertiary" />
                        <span className="truncate">E-mail: {forn.email}</span>
                      </div>
                    )}

                    {/* CNPJ de Login */}
                    {forn.cnpj && (
                      <div className="flex items-center gap-1.5 text-content-secondary truncate">
                        <CreditCard className="w-3.5 h-3.5 shrink-0 text-content-tertiary" />
                        <span className="truncate">CNPJ: {forn.cnpj}</span>
                      </div>
                    )}

                    {/* Usuário de Login */}
                    {forn.login && (
                      <div className="flex items-center gap-1.5 text-content-secondary truncate">
                        <User className="w-3.5 h-3.5 shrink-0 text-content-tertiary" />
                        <span className="truncate">User: {forn.login}</span>
                      </div>
                    )}

                    {/* Observações */}
                    {forn.observacoes && (
                      <p className="text-[11px] text-content-tertiary font-sans line-clamp-2 pt-1 border-t border-sara-border/50">
                        {forn.observacoes}
                      </p>
                    )}

                    {/* HISTÓRICO DE EXECUÇÕES RPA NO CARD */}
                    {forn.historicoExecucoesRPA && forn.historicoExecucoesRPA.length > 0 && (
                      <div className="pt-2 border-t border-sara-border/50 space-y-1 font-mono">
                        <span className="text-[10px] font-bold text-content-tertiary uppercase block">
                          Histórico de Execuções RPA:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {forn.historicoExecucoesRPA.slice(0, 2).map((reg) => (
                            <span
                              key={reg.id}
                              className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                                reg.sucesso
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}
                              title={reg.mensagem || reg.categoria}
                            >
                              {reg.sucesso ? '✅' : '❌'} {reg.timestamp} • {reg.categoria}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-sara-border flex items-center justify-between gap-2">
                    {isProprietario ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 justify-center text-xs hover:border-brand/50"
                          onClick={() => handleTestarConexaoRPA(forn)}
                          isLoading={testingId === forn.id}
                          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-brand" />}
                        >
                          Testar Login RPA
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="px-2.5 text-xs hover:text-brand"
                          onClick={() => handleOpenEditModal(forn)}
                          title="Editar Fornecedor"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="px-2.5 text-xs"
                          onClick={() => setDeleteModal({ open: true, item: forn })}
                          title="Remover Fornecedor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <div className="w-full text-center text-[11px] font-mono text-content-tertiary">
                        Somente Leitura (Colaborador)
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </ErrorBoundary>

      {/* MODAL DE CADASTRAR / EDITAR FORNECEDOR */}
      {isProprietario && (
        <Sheet
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingFornecedorId ? `Editar Fornecedor — ${nomeInput}` : 'Adicionar Novo Fornecedor B2B'}
          description="Preencha a URL oficial do fornecedor e defina os campos de login exigidos pelo portal."
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                isLoading={isSubmitting}
                disabled={!isFormValid}
                onClick={handleSaveFornecedor}
                leftIcon={<ShieldCheck className="w-4 h-4 text-black" />}
              >
                {editingFornecedorId ? 'Salvar Alterações' : 'Salvar Fornecedor'}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            {/* PREVIEW DE LOGO / FAVICON OBTIDO AUTOMATICAMENTE */}
            {logoUrl && (
              <div className="p-3 rounded-xl bg-sara-bg border border-sara-border flex items-center gap-3 animate-in fade-in duration-200">
                <img
                  src={logoUrl}
                  alt="Logo Preview"
                  className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-sara-border shadow-sm"
                />
                <div>
                  <span className="text-[11px] font-mono text-brand font-bold block">Favicon Obtido via Google API:</span>
                  <span className="text-xs font-bold text-content-primary">{nomeInput || 'Logo do Portal'}</span>
                </div>
              </div>
            )}

            <Input
              label="Nome do Fornecedor / Lojista"
              placeholder="Ex: Elétrica São Paulo Ltda"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              required
            />

            {/* CAMPO DE URL COM BOTÃO "VERIFICAR" E FEEDBACK EM TEMPO REAL */}
            <div className="space-y-1.5">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="URL do Site / Portal B2B do Fornecedor"
                    placeholder="https://portal.lojista.com.br/login"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setUrlCheckResult({ status: null, mensagem: null });
                    }}
                    onBlur={handleUrlBlur}
                    leftIcon={<Globe className="w-4 h-4 text-content-tertiary" />}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="shrink-0 h-10 px-3 hover:border-brand/50 text-xs"
                  onClick={handleVerificarUrl}
                  isLoading={urlChecking}
                  leftIcon={<ShieldCheck className="w-4 h-4 text-brand" />}
                >
                  Verificar
                </Button>
              </div>

              {/* FEEDBACK VISUAL DA VALIDAÇÃO DE URL */}
              {urlCheckResult.mensagem && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200 ${
                    urlCheckResult.status === 'VALIDO'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : urlCheckResult.status === 'SSL_INVALIDO'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {urlCheckResult.status === 'VALIDO' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {urlCheckResult.status === 'SSL_INVALIDO' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {urlCheckResult.status === 'INACESSIVEL' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{urlCheckResult.mensagem}</span>
                </div>
              )}
            </div>

            <Select
              label="Categoria de Atuação"
              value={categoriaInput}
              onChange={(e) => setCategoriaInput(e.target.value)}
            >
              {CATEGORIAS_FORNECEDOR.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Input
              label="WhatsApp Oficial para Cotações (Opcional)"
              placeholder="(11) 98765-4321"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(formatPhoneMask(e.target.value))}
              leftIcon={<MessageCircle className="w-4 h-4 text-emerald-400" />}
              isMono
            />

            {/* SEÇÃO TIPO DE ARQUITETURA RPA / LOGIN */}
            <div className="p-4 rounded-xl bg-sara-bg border border-sara-border space-y-3">
              <div>
                <label className="block text-xs font-bold text-content-primary tracking-tight">
                  Tipo de Automação RPA (Como o login é exibido na página?)
                </label>
                <p className="text-[11px] text-content-tertiary font-light mt-0.5 leading-relaxed">
                  Defina se o fornecedor abre o formulário por um modal na home (padrão B2B) ou por página própria:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  onClick={() => setRpaLoginType('modal')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    rpaLoginType === 'modal'
                      ? 'bg-brand/10 border-brand/50 text-content-primary shadow-sm ring-1 ring-brand/30'
                      : 'bg-sara-surface border-sara-border text-content-secondary hover:border-sara-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="rpaLoginTypeRadio"
                    checked={rpaLoginType === 'modal'}
                    onChange={() => setRpaLoginType('modal')}
                    className="w-4 h-4 text-brand focus:ring-brand bg-sara-surface border-sara-border cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Modal Dinâmico (Padrão)</span>
                    <span className="text-[10px] text-content-tertiary">Botão no header que abre modal/popup</span>
                  </div>
                </label>

                <label
                  onClick={() => setRpaLoginType('page')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    rpaLoginType === 'page'
                      ? 'bg-brand/10 border-brand/50 text-content-primary shadow-sm ring-1 ring-brand/30'
                      : 'bg-sara-surface border-sara-border text-content-secondary hover:border-sara-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="rpaLoginTypeRadio"
                    checked={rpaLoginType === 'page'}
                    onChange={() => setRpaLoginType('page')}
                    className="w-4 h-4 text-brand focus:ring-brand bg-sara-surface border-sara-border cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Página Direta (/login)</span>
                    <span className="text-[10px] text-content-tertiary">URL dedicada de login</span>
                  </div>
                </label>
              </div>

              {rpaLoginType === 'modal' && (
                <Input
                  label="Seletor / Texto do Botão Gatilho (Opcional)"
                  placeholder="Ex: .componentes-button_login ou FAÇA LOGIN"
                  value={rpaTriggerSelector}
                  onChange={(e) => setRpaTriggerSelector(e.target.value)}
                  isMono
                />
              )}
            </div>

            {/* SEÇÃO "FORMA DE LOGIN" COM RADIO BUTTONS DE SELEÇÃO ÚNICA */}
            <div className="p-4 rounded-xl bg-sara-bg border border-sara-border space-y-3">
              <div>
                <label className="block text-xs font-bold text-content-primary tracking-tight">
                  Forma de Login (Como este portal exige a identificação?)
                </label>
                <p className="text-[11px] text-content-tertiary font-light mt-1 leading-relaxed">
                  Selecione a forma de acesso utilizada pelo lojista no portal B2B:
                </p>
              </div>

              {/* GRID DE SELEÇÃO ÚNICA POR RADIO BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Opção 1: E-mail e Senha */}
                <label
                  onClick={() => handleSelectLoginType('email')}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    loginType === 'email'
                      ? 'bg-brand/10 border-brand/50 text-content-primary shadow-sm ring-1 ring-brand/30'
                      : 'bg-sara-surface border-sara-border hover:border-sara-border/80 text-content-secondary'
                  }`}
                >
                  <input
                    type="radio"
                    name="loginTypeRadio"
                    checked={loginType === 'email'}
                    onChange={() => handleSelectLoginType('email')}
                    className="w-4 h-4 text-brand focus:ring-brand bg-sara-surface border-sara-border cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <Mail className={`w-4 h-4 ${loginType === 'email' ? 'text-brand' : 'text-content-tertiary'}`} />
                    <span className="text-xs font-bold">E-mail e Senha</span>
                  </div>
                </label>

                {/* Opção 2: CNPJ e Senha */}
                <label
                  onClick={() => handleSelectLoginType('cnpj')}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    loginType === 'cnpj'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-content-primary shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-sara-surface border-sara-border hover:border-sara-border/80 text-content-secondary'
                  }`}
                >
                  <input
                    type="radio"
                    name="loginTypeRadio"
                    checked={loginType === 'cnpj'}
                    onChange={() => handleSelectLoginType('cnpj')}
                    className="w-4 h-4 text-emerald-400 focus:ring-emerald-400 bg-sara-surface border-sara-border cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <CreditCard className={`w-4 h-4 ${loginType === 'cnpj' ? 'text-emerald-400' : 'text-content-tertiary'}`} />
                    <span className="text-xs font-bold">CNPJ e Senha</span>
                  </div>
                </label>

                {/* Opção 3 (Expandível): Login/Usuário e Senha */}
                {(showGenericLoginOption || loginType === 'login') && (
                  <label
                    onClick={() => handleSelectLoginType('login')}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none sm:col-span-2 animate-in fade-in duration-200 ${
                      loginType === 'login'
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-content-primary shadow-sm ring-1 ring-cyan-500/30'
                        : 'bg-sara-surface border-sara-border hover:border-sara-border/80 text-content-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="loginTypeRadio"
                      checked={loginType === 'login'}
                      onChange={() => handleSelectLoginType('login')}
                      className="w-4 h-4 text-cyan-400 focus:ring-cyan-400 bg-sara-surface border-sara-border cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${loginType === 'login' ? 'text-cyan-400' : 'text-content-tertiary'}`} />
                      <span className="text-xs font-bold">Login/Usuário e Senha</span>
                    </div>
                  </label>
                )}
              </div>

              {/* LINK DISCRETO PARA EXPANDIR USUÁRIO GENÉRICO */}
              {!showGenericLoginOption && loginType !== 'login' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenericLoginOption(true);
                      handleSelectLoginType('login');
                    }}
                    className="text-[11px] text-brand hover:underline font-mono flex items-center gap-1"
                  >
                    <span>Usar outro tipo de login (usuário genérico)</span>
                  </button>
                </div>
              )}

              {/* EXIBIÇÃO DINÂMICA DO CAMPO DE IDENTIFICAÇÃO SELECIONADO */}
              <div className="space-y-3 pt-2">
                {/* 1. CAMPO E-MAIL */}
                {loginType === 'email' && (
                  <Input
                    label="Digite o e-mail de login"
                    placeholder="compras@suaempresa.com.br"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4 text-brand" />}
                    required
                  />
                )}

                {/* 2. CAMPO CNPJ COM MÁSCARA */}
                {loginType === 'cnpj' && (
                  <Input
                    label="Digite o CNPJ de acesso"
                    placeholder="00.000.000/0000-00"
                    value={cnpjInput}
                    onChange={(e) => setCnpjInput(formatCNPJMask(e.target.value))}
                    leftIcon={<CreditCard className="w-4 h-4 text-emerald-400" />}
                    isMono
                    required
                  />
                )}

                {/* 3. CAMPO LOGIN / USUÁRIO */}
                {loginType === 'login' && (
                  <Input
                    label="Digite o login/usuário"
                    placeholder="usuario123"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    leftIcon={<User className="w-4 h-4 text-cyan-400" />}
                    required
                  />
                )}

                {/* CAMPO SENHA ÚNICO E FIXO EMBAIXO DO CAMPO DE IDENTIFICAÇÃO */}
                <div className="space-y-1">
                  <Input
                    type="password"
                    label="Senha de Acesso (Criptografada AES-256 no Banco)"
                    placeholder={editingFornecedorId ? '•••••••• (deixe em branco para manter a atual)' : '••••••••'}
                    value={senhaInput}
                    onChange={(e) => setSenhaInput(e.target.value)}
                    leftIcon={<KeyRound className="w-4 h-4 text-amber-400" />}
                    required={!editingFornecedorId}
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary font-mono pt-1">
                    <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>🔒 Usada apenas durante a automação, nunca exibida em tela.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-content-secondary">Observações Internas (Opcional)</label>
              <textarea
                className="w-full h-20 p-3 rounded-xl bg-sara-surface border border-sara-border text-xs text-content-primary focus:border-brand focus:outline-none resize-none font-sans"
                placeholder="Ex: Condições de frete grátis a partir de R$ 2.500,00..."
                value={observacoesInput}
                onChange={(e) => setObservacoesInput(e.target.value)}
              />
            </div>
          </div>
        </Sheet>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteModal.open && deleteModal.item && (
        <Sheet
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, item: null })}
          title="Confirmar Exclusão de Fornecedor"
          description="Esta ação removerá o lojista permanentemente da base de dados."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteModal({ open: false, item: null })}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                isLoading={isDeleting}
                onClick={handleConfirmDelete}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Excluir Definitivamente
              </Button>
            </>
          }
        >
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 space-y-2 font-mono">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <span className="font-bold block text-sm">Tem certeza que deseja excluir o fornecedor abaixo?</span>
            <p className="font-bold text-content-primary">{deleteModal.item.nome}</p>
            <p className="text-[11px] text-content-tertiary font-light">
              Esta ação removerá também os registros locais de credenciais e WhatsApp cadastrados.
            </p>
          </div>
        </Sheet>
      )}

      {/* MODAL DE LOGS RPA COM LOGGING DETALHADO, SCREENSHOT E DUMP HTML */}
      {rpaModal.open && rpaModal.supplier && (
        <Sheet
          isOpen={rpaModal.open}
          onClose={() => setRpaModal({ open: false, supplier: null, result: null, isRunning: false })}
          title={`Automação RPA Headless — ${rpaModal.supplier.nome}`}
          description="Log em tempo real do robô de autenticação com observabilidade completa e diagnóstico de erros."
          footer={
            <div className="flex items-center justify-between w-full gap-2">
              <Button variant="ghost" onClick={() => setRpaModal({ open: false, supplier: null, result: null, isRunning: false })}>
                Fechar
              </Button>
              <Button
                variant="primary"
                isLoading={rpaModal.isRunning}
                onClick={() => handleTestarConexaoRPA(rpaModal.supplier!)}
                leftIcon={<RefreshCw className="w-4 h-4 text-black" />}
              >
                Tentar Novamente
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs font-mono">
            {/* EXIBIÇÃO CATEGORIZADA DO RESULTADO COM CÓDIGO TÉCNICO ESPECÍFICO */}
            <div
              className={`p-4 rounded-xl border space-y-2.5 ${
                rpaModal.isRunning
                  ? 'bg-brand/5 border-brand/30 text-brand'
                  : rpaModal.result?.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold text-sm">
                    {rpaModal.isRunning
                      ? 'Robô Executando...'
                      : rpaModal.result?.success
                      ? '✅ Sessão Autenticada com Sucesso'
                      : `❌ ${rpaModal.result?.categoryLabel || 'Falha na Automação'}`}
                  </span>
                </div>
                {rpaModal.result?.executionTimeMs && (
                  <span className="text-[11px] opacity-80">
                    {(rpaModal.result.executionTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              {!rpaModal.isRunning && rpaModal.result && !rpaModal.result.success && (
                <div className="space-y-1.5 pt-1 text-[11px] border-t border-rose-500/20">
                  <p className="font-sans text-xs font-medium text-content-primary">
                    {rpaModal.result.errorMsg || 'Credenciais ou seletor rejeitado.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span>
                      Código Técnico:{' '}
                      <strong className="text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {rpaModal.result.errorCode || 'ERR_RPA_UNKNOWN'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Timestamp:{' '}
                      {rpaModal.result.timestamp
                        ? new Date(rpaModal.result.timestamp).toLocaleTimeString('pt-BR')
                        : new Date().toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* BOTÕES DE OBSERVABILIDADE: SCREENSHOT & DUMP HTML */}
            {!rpaModal.isRunning && rpaModal.result && !rpaModal.result.success && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rpaModal.result.screenshotUrl && (
                  <a
                    href={rpaModal.result.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-sara-surface border border-sara-border hover:border-brand/40 text-xs font-mono text-brand font-bold transition-all justify-center"
                  >
                    <Camera className="w-4 h-4 text-brand" />
                    <span>📸 Ver Screenshot do Erro</span>
                  </a>
                )}

                {rpaModal.result.htmlDumpUrl && (
                  <a
                    href={rpaModal.result.htmlDumpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-sara-surface border border-sara-border hover:border-cyan-400/40 text-xs font-mono text-cyan-400 font-bold transition-all justify-center"
                  >
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>📄 Baixar / Inspecionar HTML</span>
                  </a>
                )}
              </div>
            )}

            {/* SUGESTÃO INTELIGENTE DE AÇÃO */}
            {!rpaModal.isRunning &&
              rpaModal.result &&
              !rpaModal.result.success &&
              (rpaModal.result.categoryLabel === 'Elemento não encontrado' ||
                rpaModal.result.categoryLabel === 'Bloqueio anti-bot' ||
                rpaModal.result.errorCode === 'ERR_CAPTCHA_DETECTED' ||
                rpaModal.result.errorCode === 'ERR_LOGIN_FIELD_NOT_FOUND' ||
                rpaModal.result.errorCode === 'ERR_PASSWORD_FIELD_NOT_FOUND' ||
                rpaModal.result.errorCode === 'ERR_SUBMIT_BUTTON_NOT_FOUND') && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 space-y-1.5 font-sans">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Sugestão de Ação Recomendada:</span>
                  </div>
                  <p className="text-xs font-light leading-relaxed">
                    💡 Este site pode exigir login manual assistido ou ajuste no seletor de campos. Considere usar modo semi-automático.
                  </p>
                </div>
              )}

            {/* EXPANSÃO ACCORDION DE LOGS DETALHADOS LINHA A LINHA */}
            {!rpaModal.isRunning && rpaModal.result && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowFullLogs(!showFullLogs)}
                  className="w-full p-2.5 rounded-xl bg-sara-surface border border-sara-border hover:border-brand/40 text-left flex items-center justify-between text-xs text-content-secondary font-mono transition-all"
                >
                  <span className="flex items-center gap-2 font-bold text-content-primary">
                    <Terminal className="w-4 h-4 text-brand" /> Ver Log Completo & Stack Trace ({rpaModal.result.logs?.length || 0} passos)
                  </span>
                  {showFullLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFullLogs && (
                  <div className="p-3 rounded-xl bg-sara-bg border border-sara-border text-[11px] font-mono space-y-2 max-h-72 overflow-y-auto animate-in fade-in duration-200">
                    <span className="text-[10px] text-brand font-bold block uppercase border-b border-sara-border pb-1">
                      Linha a Linha do Robô RPA:
                    </span>
                    {rpaModal.result.logs && rpaModal.result.logs.length > 0 ? (
                      rpaModal.result.logs.map((log: any, idx: number) => {
                        const isError = log.level === 'error';
                        const isSuccess = log.level === 'success';
                        const isWarn = log.level === 'warn';

                        return (
                          <div key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-content-tertiary shrink-0">[{log.timestamp}]</span>
                            <span
                              className={`font-bold shrink-0 px-1 rounded ${
                                isError
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : isSuccess
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isWarn
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-brand/20 text-brand'
                              }`}
                            >
                              [{log.step}]
                            </span>
                            <span
                              className={`${
                                isError ? 'text-rose-300' : isSuccess ? 'text-emerald-300' : 'text-content-primary'
                              }`}
                            >
                              {log.message}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-content-tertiary">Nenhum log gravado.</p>
                    )}

                    {rpaModal.result.htmlDumpSnippet && (
                      <div className="pt-2 border-t border-sara-border/60">
                        <span className="text-[10px] text-cyan-400 font-bold block uppercase mb-1">
                          Preview do HTML Dump (Primeiros 450 chars):
                        </span>
                        <pre className="text-[10px] text-cyan-300 font-mono whitespace-pre-wrap bg-black/40 p-2 rounded border border-cyan-500/20">
                          {rpaModal.result.htmlDumpSnippet}
                        </pre>
                      </div>
                    )}

                    {rpaModal.result.stackTrace && (
                      <div className="pt-2 border-t border-sara-border/60">
                        <span className="text-[10px] text-rose-400 font-bold block uppercase mb-1">
                          Stack Trace de Exceção:
                        </span>
                        <pre className="text-[10px] text-rose-300 font-mono whitespace-pre-wrap bg-black/40 p-2 rounded border border-rose-500/20">
                          {rpaModal.result.stackTrace}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
};
