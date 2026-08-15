'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TAX_RULES_DATABASE } from '@/lib/services/tax';
import { Percent, MessageSquare, Save, ShieldCheck, Database } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Parâmetros da Empresa & Regras de Negócio • Banco Real
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Configurações do Sistema
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Configure seu estado padrão (UF) para consulta na tabela tax_rules e preferências do WhatsApp.
          </p>
        </div>

        <Button variant="primary" size="sm" leftIcon={<Save className="w-4 h-4 text-black" />}>
          Salvar Alterações
        </Button>
      </div>

      {/* Settings Cards */}
      <div className="space-y-6">
        {/* Card 1: Tax Parameters */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-brand" />
              <CardTitle className="text-base">Parâmetros Tributários (ICMS-ST)</CardTitle>
            </div>
            <CardDescription>
              Defina a UF de destino padrão dos projetos para consulta automatizada na tabela tax_rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="UF Padrão do Comprador / Obra" defaultValue="SP">
              <option value="SP">São Paulo (SP)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="PR">Paraná (PR)</option>
            </Select>

            <Select label="Regime Tributário da Empresa" defaultValue="simples">
              <option value="simples">Simples Nacional (Com Exceção ST)</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
            </Select>
          </CardContent>
        </Card>

        {/* Card 2: Database Tax Rules Inspection */}
        <Card variant="bordered">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-accent-cyan" />
                <CardTitle className="text-base">Tabela de Regras Fiscais (tax_rules)</CardTitle>
              </div>
              <Badge variant="cyan" size="sm" className="font-mono">
                {TAX_RULES_DATABASE.length} Regras Ativas
              </Badge>
            </div>
            <CardDescription>
              Regras oficiais de MVA e alíquotas de ICMS por NCM e UF de origem/destino.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-sara-border text-content-tertiary uppercase">
                    <th className="py-2 px-2">NCM</th>
                    <th className="py-2 px-2">UF Origem → Destino</th>
                    <th className="py-2 px-2">ICMS Orig. / Dest.</th>
                    <th className="py-2 px-2">MVA ST</th>
                    <th className="py-2 px-2">Protocolo / Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sara-border/40 text-content-secondary">
                  {TAX_RULES_DATABASE.map((rule) => (
                    <tr key={rule.id} className="hover:bg-sara-hover/30">
                      <td className="py-2 px-2 font-bold text-content-primary">{rule.ncm}</td>
                      <td className="py-2 px-2 text-brand">{rule.ufOrigem} → {rule.ufDestino}</td>
                      <td className="py-2 px-2">{(rule.aliquotaIcmsOrigem * 100)}% / {(rule.aliquotaIcmsDestino * 100)}%</td>
                      <td className="py-2 px-2 text-emerald-400 font-bold">{(rule.mvaST * 100)}%</td>
                      <td className="py-2 px-2 text-content-tertiary">{rule.isencaoProtocolo || 'Padrão ST'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: WhatsApp Integration */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base">Integração WhatsApp Business API</CardTitle>
            </div>
            <CardDescription>
              Receba listas por áudio de encarregados e envie notificações aos lojistas diretamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Número do WhatsApp Cadastrado"
              defaultValue="+55 (11) 98765-4321"
              isMono
            />
            <div className="flex items-center justify-between p-3 rounded-xl bg-sara-surface border border-sara-border text-xs">
              <div>
                <span className="font-semibold text-content-primary block">Reconhecimento de Áudios por IA</span>
                <span className="text-content-tertiary block font-light">Extrai bitolas, voltagens e quantitativos em tempo real.</span>
              </div>
              <Badge variant="emerald">Ativo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
