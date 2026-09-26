import { db } from '../lib/db/client';

async function saveActiveCofemaQuote() {
  console.log('💾 Inserindo/Atualizando card de cotação ativa do Cofema no banco de dados da Saracota...');

  const fornList = await db.fornecedores.list();
  const cofema = fornList.find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));

  if (!cofema) throw new Error('Cofema não encontrado!');

  const userIds = ['usr-admin-1', '61ab64e4-c2cb-46df-bb14-6cc326293085', 'cli-default'];

  for (const userId of userIds) {
    const res = await db.cotacoesAtivas.upsert({
      userId,
      user_id: userId,
      obraId: 'Reserva das Palmeiras',
      obra_id: 'Reserva das Palmeiras',
      fornecedorId: cofema.id,
      fornecedor_id: cofema.id,
      fornecedorNome: 'Cofema',
      fornecedor_nome: 'Cofema',
      valor_total: 439.50,
      status: 'concluida',
      itens: [
        {
          itemId: 'item-ducha-300500',
          nomeSolicitado: 'DUCHA LORENZETTI BELLA DUCHA 220V',
          nomeEncontrado: 'DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA 7531212',
          quantidade: 5,
          unidade: 'un',
          precoUnitario: 87.90,
          precoTotal: 439.50,
          status: 'encontrado'
        }
      ]
    });
    console.log(`✅ Card da Cofema salvo para ${userId}:`, res.id);
  }
}

saveActiveCofemaQuote().catch(console.error);
