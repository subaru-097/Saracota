'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { db } from '@/lib/db/client';
import { Fornecedor } from '@/types';
import { Building2, Star, Clock, MapPin, CheckCircle2, ShieldCheck, PhoneCall, PackageOpen } from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setIsLoading(true);
      try {
        const lista = await db.fornecedores.list();
        setFornecedores(lista);
      } finally {
        setIsLoading(false);
      }
    }
    carregar();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Rede Credenciada de Fornecedores • Banco Real
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Lojistas Credenciados
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Parceiros integrados com SLA rápido de resposta a cotações e protocolo ST validado no PostgreSQL.
          </p>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} variant="bordered" className="p-4 space-y-3">
              <Skeleton variant="text" className="w-1/2 h-5" />
              <Skeleton variant="text" className="w-3/4 h-4" />
              <Skeleton variant="rectangular" className="w-full h-24 rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && fornecedores.length === 0 && (
        <Card variant="bordered" className="p-8 text-center space-y-4 bg-sara-surface">
          <PackageOpen className="w-12 h-12 text-brand mx-auto opacity-80" />
          <div>
            <h3 className="text-base font-bold text-content-primary">Nenhum Lojista Cadastrado no Banco</h3>
            <p className="text-xs text-content-secondary font-light mt-1 max-w-md mx-auto">
              Cadastre novos fornecedores na aba Fornecedores do aplicativo para vincular às cotações.
            </p>
          </div>
        </Card>
      )}

      {/* Suppliers Grid */}
      {!isLoading && fornecedores.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fornecedores.map((supp) => (
            <Card key={supp.id} variant="default" className="flex flex-col justify-between hover:border-brand/40 transition-colors">
              <div>
                <CardHeader className="pb-3 border-b border-sara-border">
                  <div className="flex items-center justify-between">
                    <Badge variant="emerald" size="sm" pulse>
                      {supp.verificado ? 'Verificado Sara Cota' : 'Credenciado'}
                    </Badge>
                    <div className="flex items-center gap-1 text-amber-400 font-mono text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{supp.scoreConfiabilidade}</span>
                    </div>
                  </div>

                  <CardTitle className="text-base mt-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-brand shrink-0" />
                    <span>{supp.nome}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-content-tertiary shrink-0" />
                    <span>{supp.uf} • Atendimento Regional</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-3 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-sara-elevated border border-sara-border font-mono text-[11px]">
                    <div>
                      <span className="text-content-tertiary block">SLA RESPOSTA</span>
                      <span className="text-brand font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~{supp.slaMinutos} min
                      </span>
                    </div>
                    <div>
                      <span className="text-content-tertiary block">COTAÇÕES</span>
                      <span className="text-content-primary font-bold">{supp.cotacoesAtendidasCount} feitas</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-content-tertiary uppercase block">
                      Acordo Tributário:
                    </span>
                    <span className="text-emerald-400 font-mono text-[11px] block font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {supp.acordoST}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-mono text-content-tertiary uppercase block">
                      Especialidades:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {supp.especialidades.map((spec) => (
                        <span key={spec} className="px-2 py-0.5 rounded text-[10px] bg-sara-surface border border-sara-border text-content-secondary">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </div>

              <CardFooter className="pt-3 border-t border-sara-border">
                <Button variant="secondary" size="sm" className="w-full justify-center" leftIcon={<PhoneCall className="w-3.5 h-3.5" />}>
                  Solicitar Cotação Direta
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
