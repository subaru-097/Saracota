import { NextRequest, NextResponse } from 'next/server';
import { extractDomain } from '@/lib/services/automacao/securityValidator';

/**
 * POST /api/seguranca/validar-dominio
 * Endpoint de Simulação de Teste de Segurança Anti-Phishing (sem necessidade de fornecedor cadastrado)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { urlCadastrada, urlTestada } = body;

    const urlBase = urlCadastrada || 'https://portal.fornecedorteste.com.br';
    const urlCheck = urlTestada || urlBase;

    const dominioCadastrado = extractDomain(urlBase);
    const dominioAtual = extractDomain(urlCheck);

    // 1. SSL Check
    const isHttps = urlCheck.startsWith('https://');
    if (!isHttps) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'SSL_INVALIDO',
          mensagem: `[BLOQUEADO] Protocolo inseguro HTTP sem SSL.`,
          dominioCadastrado,
          dominioAtual,
          sslValido: false,
        },
        { status: 400 }
      );
    }

    // 2. Anti-Phishing Check
    const mesmoDominio =
      dominioAtual === dominioCadastrado ||
      dominioAtual.endsWith(`.${dominioCadastrado}`) ||
      dominioCadastrado.endsWith(`.${dominioAtual}`);

    if (!mesmoDominio) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'DOMINIO_SUSPEITO',
          mensagem: `[BLOQUEADO POR ANTI-PHISHING] Tentativa de login em domínio não autorizado ("${dominioAtual}"). Domínio de confiança cadastrado: "${dominioCadastrado}".`,
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
        mensagem: `[VALIDADO] Domínio autêntico e conexões protegidas por SSL.`,
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
        mensagem: error.message || 'Erro ao realizar validação de segurança.',
      },
      { status: 500 }
    );
  }
}
