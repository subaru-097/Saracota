// 02-codigo-depois.js: Cálculo corrigido sem multiplicadores e sem despesaST

// 1. Em context/CotacoesContext.tsx (linha 228):
// subtotalComSt agora é EXATAMENTE precoUnitario * quantidade (sem multiplicar por 1.12):
const subtotalComSt = sub;

// 2. Em components/features/ModalDetalheFornecedor.tsx (linha 160):
// subtotalItem calcula estritamente precoUnitario * quantidade:
const subtotalItem = Number((unitPrice * qtd).toFixed(2));

// 3. Em components/features/ModalDetalheFornecedor.tsx (linhas 103-133):
// Removido o card de "Despesa Acessória / ST", restando apenas Subtotal Produtos e Total do Pedido:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <div className="p-3.5 rounded-xl bg-sara-surface border border-sara-border flex flex-col justify-between space-y-1.5">
    <div className="flex items-center justify-between text-content-tertiary">
      <span className="text-[11px] font-mono font-medium uppercase tracking-wider">Subtotal Produtos</span>
      <ShoppingCart className="w-4 h-4 text-content-tertiary opacity-70" />
    </div>
    <p className="text-base sm:text-lg font-bold font-mono text-content-primary">
      {formatCurrencyBRL(valProdutos)}
    </p>
  </div>

  <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/40 flex flex-col justify-between space-y-1.5 shadow-glow">
    <div className="flex items-center justify-between text-brand">
      <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Total do Pedido</span>
      <Sparkles className="w-4 h-4 text-brand" />
    </div>
    <p className="text-lg sm:text-xl font-bold font-mono text-brand">
      {formatCurrencyBRL(valTotal)}
    </p>
  </div>
</div>

// 4. Em components/features/CotacoesView.tsx (linhas 507-510):
// despesaST zerada e totalGeral igual ao total de produtos:
const despesaST = 0;
const totalGeral = Number(totalProdutos.toFixed(2));
