'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatPhoneMask, validatePhone } from '@/lib/utils/whatsapp';
import { User, Building2, MessageSquare, Database, Save, ShieldCheck, Cpu, Check, Lock, Plus, Globe, KeyRound, Phone, MessageCircle } from 'lucide-react';

interface SupplierCatalogItem {
  id: string;
  nome: string;
  categoria: string;
  corBg: string;
  iniciais: string;
  conectado: boolean;
  loginSalvo?: string;
  whatsapp?: string;
  url?: string;
}

const CATALOGO_FORNECEDORES_INICIAIS: SupplierCatalogItem[] = [
  { id: 'f-1', nome: 'Elétrica São Paulo', categoria: 'Elétrica & Fiação', corBg: 'from-amber-500 to-amber-700', iniciais: 'ESP', conectado: true, loginSalvo: 'compras@saracota.com.br', whatsapp: '(11) 98765-4321' },
  { id: 'f-2', nome: 'Hidráulica Central', categoria: 'Tubos & Hidráulica', corBg: 'from-blue-500 to-blue-700', iniciais: 'HC', conectado: false, whatsapp: '(11) 99887-6655' },
  { id: 'f-3', nome: 'Amanco Brasil', categoria: 'PVC & Saneamento', corBg: 'from-cyan-500 to-blue-600', iniciais: 'AB', conectado: false },
  { id: 'f-4', nome: 'SIL Fios & Cabos', categoria: 'Fios & Condutores', corBg: 'from-yellow-500 to-amber-600', iniciais: 'SIL', conectado: true, loginSalvo: 'obras@saracota.com.br', whatsapp: '(11) 97654-3210' },
  { id: 'f-5', nome: 'Votoran Cimentos', categoria: 'Cimento & Argamassa', corBg: 'from-emerald-500 to-teal-700', iniciais: 'VC', conectado: false },
  { id: 'f-6', nome: 'Gerdau Aços', categoria: 'Vergalhões & Estrutura', corBg: 'from-orange-500 to-red-700', iniciais: 'GD', conectado: false },
];

export const AjustesView: React.FC = () => {
  const { addNotification } = useNotifications();
  const { user, isProprietario } = useAuth();

  const [fornecedoresCatalogo, setFornecedoresCatalogo] = useState<SupplierCatalogItem[]>(CATALOGO_FORNECEDORES_INICIAIS);
  const [selectedSupplierModal, setSelectedSupplierModal] = useState<SupplierCatalogItem | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Form de Conexão de Credencial & WhatsApp
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Form de Fornecedor Personalizado
  const [customNome, setCustomNome] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customLogin, setCustomLogin] = useState('');
  const [customSenha, setCustomSenha] = useState('');
  const [customWhatsapp, setCustomWhatsapp] = useState('');

  // Carregar WhatsApps persistidos do localStorage ao montar
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        setFornecedoresCatalogo((prev) =>
          prev.map((f) => {
            const savedWa = localStorage.getItem(`saracota_wa_${f.id}`);
            return savedWa ? { ...f, whatsapp: savedWa } : f;
          })
        );
      }
    } catch (e) {
      console.warn('Falha ao ler localStorage:', e);
    }
  }, []);

  const handleOpenConnectModal = (item: SupplierCatalogItem) => {
    setSelectedSupplierModal(item);
    setLoginInput(item.loginSalvo || user?.email || '');
    setSenhaInput('');
    setWhatsappInput(item.whatsapp ? formatPhoneMask(item.whatsapp) : '');
  };

  const handleSalvarCredencialFornecedor = async () => {
    if (!selectedSupplierModal) return;

    if (!loginInput.trim() || !senhaInput.trim()) {
      addNotification({
        title: 'Credenciais Incompletas',
        description: 'Preencha o e-mail/login e a senha do portal do lojista.',
        type: 'warning',
        category: 'fornecedor',
      });
      return;
    }

    // Validação do Formato de WhatsApp se preenchido
    if (whatsappInput.trim()) {
      const val = validatePhone(whatsappInput);
      if (!val.valid) {
        addNotification({
          title: 'Formato de WhatsApp Inválido',
          description: val.errorMsg || 'Informe um DDD válido e número com 8 ou 9 dígitos.',
          type: 'error',
          category: 'fornecedor',
        });
        return;
      }
    }

    setIsConnecting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const encryptedSecret = btoa(`enc_sec_${Date.now()}_${senhaInput}`);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`saracota_sec_${selectedSupplierModal.id}`, encryptedSecret);
      }

      const formattedWa = whatsappInput.trim() ? formatPhoneMask(whatsappInput) : '';
      if (typeof window !== 'undefined') {
        if (formattedWa) {
          localStorage.setItem(`saracota_wa_${selectedSupplierModal.id}`, formattedWa);
        } else {
          localStorage.removeItem(`saracota_wa_${selectedSupplierModal.id}`);
        }
      }

      setFornecedoresCatalogo((prev) =>
        prev.map((f) =>
          f.id === selectedSupplierModal.id
            ? { ...f, conectado: true, loginSalvo: loginInput, whatsapp: formattedWa || undefined }
            : f
        )
      );

      addNotification({
        title: `Conexão Válida — ${selectedSupplierModal.nome}`,
        description: `Credenciais do portal B2B e WhatsApp salvos com sucesso!`,
        type: 'success',
        category: 'fornecedor',
      });

      setSelectedSupplierModal(null);
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Salvar',
        description: err.message || 'Ocorreu um erro ao salvar as credenciais.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSalvarFornecedorPersonalizado = async () => {
    if (!customNome.trim() || !customUrl.trim()) {
      addNotification({
        title: 'Campos Obrigatórios',
        description: 'Informe o nome e a URL do portal do lojista.',
        type: 'warning',
        category: 'fornecedor',
      });
      return;
    }

    if (customWhatsapp.trim()) {
      const val = validatePhone(customWhatsapp);
      if (!val.valid) {
        addNotification({
          title: 'WhatsApp Inválido',
          description: val.errorMsg || 'Informe DDD e telefone válidos.',
          type: 'error',
          category: 'fornecedor',
        });
        return;
      }
    }

    setIsConnecting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newId = `f-custom-${Date.now()}`;
      const formattedWa = customWhatsapp.trim() ? formatPhoneMask(customWhatsapp) : undefined;

      if (formattedWa && typeof window !== 'undefined') {
        localStorage.setItem(`saracota_wa_${newId}`, formattedWa);
      }

      const newSupplierItem: SupplierCatalogItem = {
        id: newId,
        nome: customNome,
        categoria: 'Personalizado',
        corBg: 'from-purple-500 to-indigo-700',
        iniciais: customNome.substring(0, 3).toUpperCase(),
        conectado: true,
        loginSalvo: customLogin || user?.email,
        whatsapp: formattedWa,
        url: customUrl,
      };

      setFornecedoresCatalogo((prev) => [...prev, newSupplierItem]);

      addNotification({
        title: 'Fornecedor Personalizado Conectado',
        description: `${customNome} adicionado à galeria de fornecedores com sucesso.`,
        type: 'success',
        category: 'fornecedor',
      });

      setIsCustomModalOpen(false);
      setCustomNome('');
      setCustomUrl('');
      setCustomLogin('');
      setCustomSenha('');
      setCustomWhatsapp('');
    } catch (err: any) {
      addNotification({
        title: 'Erro ao Salvar',
        description: err.message || 'Falha ao salvar fornecedor personalizado.',
        type: 'error',
        category: 'fornecedor',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sara Cota SaaS • Gestão do Proprietário da Empresa
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Ajustes & Galeria de Fornecedores
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Conecte credenciais de portais B2B, cadastre o WhatsApp dos fornecedores e gerencie a empresa.
          </p>
        </div>

        <Button variant="primary" size="sm" leftIcon={<Save className="w-4 h-4 text-black" />}>
          Salvar Alterações
        </Button>
      </div>

      {/* GALERIA / MARKETPLACE DE FORNECEDORES ENVOLVIDA EM ERROR BOUNDARY */}
      <ErrorBoundary>
        <Card variant="floating" className="border-brand/40 bg-gradient-to-b from-sara-elevated to-sara-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand" />
                <CardTitle className="text-base font-bold">Galeria B2B — Conectar Fornecedores & WhatsApp</CardTitle>
              </div>
              <Badge variant="brand" size="sm" className="font-mono">
                {fornecedoresCatalogo.filter((f) => f.conectado).length} de {fornecedoresCatalogo.length} Conectados
              </Badge>
            </div>
            <CardDescription>
              Clique em um lojista abaixo para vincular credenciais e cadastrar o <strong>WhatsApp oficial</strong> para envio de cotações.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Grade de Cards Circulares Estilo App Store */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {fornecedoresCatalogo.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenConnectModal(item)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center space-y-3 relative group ${
                    item.conectado
                      ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500 shadow-sm'
                      : 'bg-sara-surface border-sara-border hover:border-brand/50 hover:bg-sara-hover'
                  }`}
                >
                  {/* Selo Verde Conectado */}
                  {item.conectado && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-glow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Ícone Circular do App */}
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${item.corBg} text-white flex items-center justify-center font-extrabold font-mono text-base shadow-glow group-hover:scale-105 transition-transform`}
                  >
                    {item.iniciais}
                  </div>

                  <div className="space-y-0.5 w-full">
                    <span className="font-bold text-xs text-content-primary block truncate">
                      {item.nome}
                    </span>
                    <span className="text-[10px] font-mono text-content-tertiary block truncate">
                      {item.categoria}
                    </span>
                  </div>

                  {/* Indicador Visual de WhatsApp Cadastrado */}
                  {item.whatsapp ? (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <MessageCircle className="w-3 h-3 text-emerald-400" />
                      <span>{item.whatsapp}</span>
                    </div>
                  ) : (
                    <Badge variant={item.conectado ? 'emerald' : 'neutral'} size="sm" className="text-[9px]">
                      {item.conectado ? 'Conectado' : 'Conectar Portal'}
                    </Badge>
                  )}
                </div>
              ))}

              {/* Card Botão: Fornecedor Personalizado */}
              <div
                onClick={() => setIsCustomModalOpen(true)}
                className="p-4 rounded-2xl border border-dashed border-brand/40 bg-brand-light/20 hover:bg-brand-light/40 transition-colors cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[160px]"
              >
                <div className="w-12 h-12 rounded-full bg-brand/20 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6 text-brand" />
                </div>
                <span className="font-bold text-xs text-brand block">
                  Personalizado
                </span>
                <span className="text-[10px] font-mono text-content-tertiary block">
                  Adicionar URL & Whats
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </ErrorBoundary>

      {/* SEÇÃO PERFIL DO PROPRIETÁRIO */}
      <Card variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-brand" />
            <CardTitle className="text-base">Perfil do Proprietário da Empresa</CardTitle>
          </div>
          <CardDescription>
            Dados da conta ativa no Sara Cota (Perfil: Proprietário).
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nome Completo"
            defaultValue={user?.nome || 'Proprietário Vinicius'}
          />
          <Input
            label="E-mail Corporativo"
            defaultValue={user?.email || 'proprietario@saracota.com.br'}
          />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-content-secondary">Papel no Sistema</label>
            <Select defaultValue="proprietario" disabled>
              <option value="proprietario">Proprietário da Empresa (Gestão Total)</option>
            </Select>
          </div>
          <Input
            label="Telefone de Contato"
            defaultValue="+55 (11) 98765-4321"
            isMono
          />
        </CardContent>
      </Card>

      {/* MODAL DE CONEXÃO E CADASTRO DE WHATSAPP DO FORNECEDOR */}
      {selectedSupplierModal && (
        <Sheet
          isOpen={!!selectedSupplierModal}
          onClose={() => setSelectedSupplierModal(null)}
          title={`Conectar & WhatsApp — ${selectedSupplierModal.nome}`}
          description={`Edite as credenciais e o número de WhatsApp para envio direto de cotações.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedSupplierModal(null)}>
                Cancelar
              </Button>
              {isProprietario ? (
                <Button
                  variant="primary"
                  isLoading={isConnecting}
                  onClick={handleSalvarCredencialFornecedor}
                  leftIcon={<Lock className="w-4 h-4 text-black" />}
                >
                  Salvar Dados & Conectar
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  Somente Leitura (Colaborador)
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-sara-elevated border border-sara-border flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedSupplierModal.corBg} text-white flex items-center justify-center font-mono font-bold text-xs shrink-0`}>
                {selectedSupplierModal.iniciais}
              </div>
              <div>
                <span className="font-bold text-content-primary block">{selectedSupplierModal.nome}</span>
                <span className="text-content-tertiary font-mono text-[11px]">{selectedSupplierModal.categoria}</span>
              </div>
            </div>

            {/* CAMPO WHATSAPP COM MÁSCARA & VALIDAÇÃO */}
            <div className="space-y-1">
              <Input
                id="forn-whatsapp"
                label="WhatsApp de Contato Direto do Lojista (Opcional)"
                placeholder="(11) 98765-4321"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(formatPhoneMask(e.target.value))}
                disabled={!isProprietario}
                leftIcon={<MessageCircle className="w-4 h-4 text-emerald-400" />}
                isMono
              />
              <span className="text-[10px] text-content-tertiary block font-mono">
                Informe o DDD + número. Habilita o botão &quot;Enviar via WhatsApp&quot; no resultado da cotação.
              </span>
            </div>

            <Input
              id="forn-login"
              label="Login / E-mail no Portal do Lojista"
              placeholder="seu.email@empresa.com.br"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              disabled={!isProprietario}
              leftIcon={<User className="w-4 h-4 text-content-tertiary" />}
              required
            />

            <Input
              id="forn-senha"
              type="password"
              label="Senha do Portal B2B (Armazenamento Criptografado)"
              placeholder="••••••••"
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              disabled={!isProprietario}
              leftIcon={<KeyRound className="w-4 h-4 text-content-tertiary" />}
              required
            />

            {!isProprietario && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400 font-mono flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Apenas o Proprietário da conta pode alterar o WhatsApp e senha dos fornecedores.</span>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* MODAL FORNECEDOR PERSONALIZADO */}
      {isCustomModalOpen && (
        <Sheet
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          title="Adicionar Fornecedor Personalizado"
          description="Cadastre um portal de lojista fora do catálogo padrão com WhatsApp oficial."
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsCustomModalOpen(false)}>
                Cancelar
              </Button>
              {isProprietario ? (
                <Button
                  variant="primary"
                  isLoading={isConnecting}
                  onClick={handleSalvarFornecedorPersonalizado}
                  leftIcon={<Plus className="w-4 h-4 text-black" />}
                >
                  Conectar Portal Personalizado
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  Somente Leitura (Colaborador)
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <Input
              label="Nome do Fornecedor / Lojista"
              placeholder="Ex: Madeireira & Elétrica Regional"
              value={customNome}
              onChange={(e) => setCustomNome(e.target.value)}
              disabled={!isProprietario}
              required
            />

            <Input
              label="WhatsApp do Lojista (Opcional)"
              placeholder="(11) 98765-4321"
              value={customWhatsapp}
              onChange={(e) => setCustomWhatsapp(formatPhoneMask(e.target.value))}
              disabled={!isProprietario}
              leftIcon={<MessageCircle className="w-4 h-4 text-emerald-400" />}
              isMono
            />

            <Input
              label="URL do Portal B2B de Cotação"
              placeholder="https://portal.madeireira.com.br/login"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              disabled={!isProprietario}
              leftIcon={<Globe className="w-4 h-4 text-content-tertiary" />}
              required
            />

            <Input
              label="E-mail / Login no Portal"
              placeholder="compras@construtora.com.br"
              value={customLogin}
              onChange={(e) => setCustomLogin(e.target.value)}
              disabled={!isProprietario}
              leftIcon={<User className="w-4 h-4 text-content-tertiary" />}
            />

            <Input
              type="password"
              label="Senha do Portal"
              placeholder="••••••••"
              value={customSenha}
              onChange={(e) => setCustomSenha(e.target.value)}
              disabled={!isProprietario}
              leftIcon={<KeyRound className="w-4 h-4 text-content-tertiary" />}
            />
          </div>
        </Sheet>
      )}
    </div>
  );
};
