import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { extractDomain } from '@/lib/services/automacao/securityValidator';

/**
 * POST /api/seguranca/validar-dominio/:fornecedorId
 * Endpoint de Teste de Validação de Domínio / Anti-Phishing & SSL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { fornecedorId: string } }
) {
  try {
    const fornecedorId = params.fornecedorId;
    const body = await req.json().catch(() => ({}));

    // Permite sobrescrever a URL testada no body para simular redirecionamentos de phishing sem alterar o cadastro
    const urlParaTestar = body.urlTestada || body.urlSimulada;

    const fornecedoresList = await db.fornecedores.list();
    const fornecedor = fornecedoresList.find((f) => f.id === fornecedorId);

    if (!fornecedor && !urlParaTestar) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'FORNECEDOR_NAO_ENCONTRADO',
          mensagem: `Fornecedor com ID "${fornecedorId}" não foi encontrado.`,
        },
        { status: 404 }
      );
    }

    const urlCadastrada = fornecedor?.urlPortalB2B || 'https://portal.fornecedor.com.br';
    const dominioCadastrado = extractDomain(urlCadastrada);

    const urlFinal = urlParaTestar || urlCadastrada;
    const dominioAtual = extractDomain(urlFinal);

    // 1. Validação SSL (HTTPS)
    const isHttps = urlFinal.startsWith('https://');
    if (!isHttps) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'SSL_INVALIDO',
          mensagem: `[BLOQUEADO] O site "${urlFinal}" não utiliza protocolo seguro HTTPS/SSL.`,
          fornecedorId,
          dominioCadastrado,
          dominioAtual,
          sslValido: false,
        },
        { status: 400 }
      );
    }

    // 2. Validação Anti-Phishing (Domínio)
    const mesmoDominio =
      dominioAtual === dominioCadastrado ||
      dominioAtual.endsWith(`.${dominioCadastrado}`) ||
      dominioCadastrado.endsWith(`.${dominioAtual}`);

    if (!mesmoDominio) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'DOMINIO_SUSPEITO',
          mensagem: `[BLOQUEADO POR ANTI-PHISHING] A URL atual (${dominioAtual}) diverge do domínio confiável cadastrado (${dominioCadastrado}).`,
          fornecedorId,
          dominioCadastrado,
          dominioAtual,
          sslValido: true,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        status: 'VALIDO',
        mensagem: `[VALIDADO] O domínio "${dominioAtual}" é autêntico, possui SSL ativo e corresponde à whitelist de confiança.`,
        fornecedorId,
        dominioCadastrado,
        dominioAtual,
        sslValido: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        status: 'ERRO',
        mensagem: error.message || 'Erro ao validar domínio de segurança.',
      },
      { status: 500 }
    );
  }
}
