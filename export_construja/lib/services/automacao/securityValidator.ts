import { Page } from 'playwright-core';
import { Fornecedor } from '@/types';
import { sanitizeLogData } from '@/lib/security/vault';

export interface ResultadoValidacaoSeguranca {
  sucesso: boolean;
  status: 'VALIDO' | 'DOMINIO_SUSPEITO' | 'SSL_INVALIDO' | 'ERRO_CONEXAO';
  mensagem: string;
  dominioCadastrado: string;
  dominioAtual: string;
  sslValido: boolean;
  detalhes?: {
    protocolo?: string;
    urlOriginal?: string;
    urlAtual?: string;
  };
}

/**
 * Extrai o nome de domínio limpo a partir de qualquer URL
 */
export function extractDomain(urlStr: string): string {
  if (!urlStr) return '';
  try {
    let formatted = urlStr.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    const parsed = new URL(formatted);
    return parsed.hostname.toLowerCase();
  } catch (e) {
    return urlStr.toLowerCase().replace(/^https?:\/\//i, '').split('/')[0];
  }
}

/**
 * Validação Anti-Phishing & SSL antes de preencher qualquer credencial em formulários
 */
export async function validarDominioESSL(
  page: Page,
  fornecedor: Partial<Fornecedor>
): Promise<ResultadoValidacaoSeguranca> {
  const urlCadastrada = fornecedor.urlPortalB2B || '';
  const dominioCadastrado = extractDomain(urlCadastrada);
  const urlAtual = page.url();
  const dominioAtual = extractDomain(urlAtual);

  const detalhes = {
    urlOriginal: urlCadastrada,
    urlAtual,
    protocolo: new URL(urlAtual).protocol,
  };

  // 1. Validação de SSL / HTTPS
  const isHttps = urlAtual.startsWith('https://');
  if (!isHttps) {
    const res: ResultadoValidacaoSeguranca = {
      sucesso: false,
      status: 'SSL_INVALIDO',
      mensagem: `Bloqueado por segurança: A URL atual (${urlAtual}) não utiliza conexão segura HTTPS/SSL.`,
      dominioCadastrado,
      dominioAtual,
      sslValido: false,
      detalhes,
    };
    registrarLogAuditoria(fornecedor.id || 'desconhecido', res);
    return res;
  }

  // 2. Validação Anti-Phishing de Domínio (Domínio Atual vs Domínio Cadastrado)
  const mesmoDominio =
    dominioAtual === dominioCadastrado ||
    dominioAtual.endsWith(`.${dominioCadastrado}`) ||
    dominioCadastrado.endsWith(`.${dominioAtual}`);

  if (!mesmoDominio) {
    const res: ResultadoValidacaoSeguranca = {
      sucesso: false,
      status: 'DOMINIO_SUSPEITO',
      mensagem: `Bloqueado por Anti-Phishing: A página foi redirecionada para o domínio não confiável "${dominioAtual}", diferente do cadastrado "${dominioCadastrado}".`,
      dominioCadastrado,
      dominioAtual,
      sslValido: true,
      detalhes,
    };
    registrarLogAuditoria(fornecedor.id || 'desconhecido', res);
    return res;
  }

  const resValida: ResultadoValidacaoSeguranca = {
    sucesso: true,
    status: 'VALIDO',
    mensagem: `Validação de segurança concluída com sucesso. O domínio "${dominioAtual}" é autêntico e possui SSL válido.`,
    dominioCadastrado,
    dominioAtual,
    sslValido: true,
    detalhes,
  };

  registrarLogAuditoria(fornecedor.id || 'desconhecido', resValida);
  return resValida;
}

/**
 * Registra log de auditoria sem expor senhas ou dados sensíveis
 */
export function registrarLogAuditoria(fornecedorId: string, resultado: ResultadoValidacaoSeguranca) {
  const logItem = {
    timestamp: new Date().toISOString(),
    fornecedorId,
    status: resultado.status,
    sucesso: resultado.sucesso,
    dominioCadastrado: resultado.dominioCadastrado,
    dominioAtual: resultado.dominioAtual,
    mensagem: resultado.mensagem,
  };

  const sanitized = sanitizeLogData(logItem);
  console.log(`[Log de Auditoria de Segurança]`, JSON.stringify(sanitized));

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('saracota_audit_logs') || '[]');
      existing.unshift(sanitized);
      // Manter últimos 100 logs
      localStorage.setItem('saracota_audit_logs', JSON.stringify(existing.slice(0, 100)));
    } catch (e) {
      console.warn('Erro ao salvar log de auditoria localmente:', e);
    }
  }
}
