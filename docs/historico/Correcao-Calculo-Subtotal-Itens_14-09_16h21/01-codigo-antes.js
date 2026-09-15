// 01-codigo-antes.js: Cálculo original com o bug (multiplicador 1.12 e despesaST)

// 1. Em context/CotacoesContext.tsx (linha 228):
// O subtotalComSt era calculado multiplicando por 1.12 (12% inflado incorretamente):
const subtotalComSt = Number((sub * 1.12).toFixed(2));

// 2. Em components/features/ModalDetalheFornecedor.tsx (linha 162):
// O modal lia subtotalComSt em vez de (unitPrice * qtd):
const subtotalItem = it.subtotalComSt || Number((unitPrice * qtd).toFixed(2));

// 3. Em components/features/ModalDetalheFornecedor.tsx (linhas 114-122):
// Exibia card fixo "Despesa Acessória / ST" e somava valorST ao total:
<div className="p-3.5 rounded-xl bg-sara-surface border border-sara-border flex flex-col justify-between space-y-1.5">
  <div className="flex items-center justify-between text-accent-cyan">
    <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Despesa Acessória / ST</span>
    <FileCheck className="w-4 h-4 text-accent-cyan opacity-80" />
  </div>
  <p className="text-base sm:text-lg font-bold font-mono text-accent-cyan">
    {formatCurrencyBRL(valST)}
  </p>
</div>

// 4. Em components/features/CotacoesView.tsx (linhas 508-509):
// Adicionava despesaST = 4.90 ao total geral:
const despesaST = 4.90;
const totalGeral = Number((totalProdutos + despesaST).toFixed(2));
