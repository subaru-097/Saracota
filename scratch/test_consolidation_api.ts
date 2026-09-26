import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const cotacaoId = '2a97a9b3-4130-4f1a-8d71-7d47eb4e111d';
  const url = `http://localhost:3000/api/v1/cotacoes/${cotacaoId}/comparativo?uf=SP`;
  console.log(`Fetching API endpoint: ${url}`);
  try {
    const res = await fetch(url);
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const json = await res.json();
    console.log('API Response Data Summary:');
    console.log('- Obra:', json.data?.obraNome);
    console.log('- Total Itens Solicitados:', json.data?.totalItensSolicitados);
    console.log('- Fornecedores:', json.data?.fornecedoresParticipantes.map((f: any) => `${f.fornecedorNome} (${f.itensAtendidosCount} itens, Total R$ ${f.totalGeralComImpostos})`));
    console.log('- Melhor Fornecedor Unico:', json.data?.melhorFornecedorUnico);
    console.log('- Cesta Otimizada Total R$:', json.data?.cestaOtimizadaSplit?.totalGeralComImpostos);
    console.log('- Economia Estimada:', json.data?.cestaOtimizadaSplit?.economiaEstimadaBRL, `(${json.data?.cestaOtimizadaSplit?.economiaPercentual}%)`);
  } catch (e: any) {
    console.error('Fetch error:', e.message);
  }
}

main();
