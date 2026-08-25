import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind classes safely with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Currency Formatter BRL (R$)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata números com precisão industrial (ex: metragens, bitolas, unidades)
 */
export function formatQuantity(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Normaliza e sanitiza nomes de fornecedores para slugs/domínios ASCII (removendo acentos e diacríticos)
 * Exemplo: "Construjá" -> "construja", "São Paulo" -> "saopaulo"
 */
export function sanitizeSupplierSlug(name: string): string {
  if (!name) return 'fornecedor';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos/acentos (á -> a, ç -> c, ã -> a)
    .replace(/[^a-z0-9]/g, '');      // Remove caracteres não-alfanuméricos
}

export type CartStrategy = 'session_param' | 'get_params_rebuild' | 'manual_fallback_no_cart_link';

export interface ResolvedCartUrlResult {
  url: string;
  priority: string;
  strategy: CartStrategy;
}

/**
 * Hierarquia prioritária para resolução da URL do carrinho do fornecedor:
 * 1. URL capturada diretamente pelo robô RPA (se existir e for válida)
 * 2. URL base oficial cadastrada no banco/sistema para o fornecedor (sem sub-paths incorretos como /produtos)
 * 3. Fallback reconstruído com o slug devidamente sanitizado (sem perda de acentos)
 */
export function resolveSupplierCartUrl(params: {
  capturedUrl?: string;
  officialPortalUrl?: string;
  supplierName: string;
  supplierId?: string;
}): ResolvedCartUrlResult {
  const normName = (params.supplierName || '').toLowerCase();
  const normId = (params.supplierId || '').toLowerCase();

  console.log('[RESOLVE CART URL BEFORE CALL]', {
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    rawCapturedUrl: params.capturedUrl,
    rawOfficialPortalUrl: params.officialPortalUrl,
  });

  // BUG 3: Cicalfer - Plataforma com auth POST individual / JWT restrita por origem
  if (normName.includes('cicalfer') || normId.includes('cicalfer')) {
    const result: ResolvedCartUrlResult = {
      url: 'https://www.cicalfer.com.br',
      priority: 'priority_3_manual_fallback',
      strategy: 'manual_fallback_no_cart_link',
    };

    console.log('[CART_STRATEGY LOG]', {
      supplier: params.supplierName,
      strategy: 'CART_STRATEGY: manual_fallback_no_cart_link',
      reason: 'Plataforma SPA exige auth POST individual por sessão. Lista cotada completa exibida no modal Sara Cota.',
      resolvedUrl: result.url,
    });
    return result;
  }

  // BUG 2 - Prioridade 1: URL real capturada pelo robô RPA (ex: Construjá com session)
  if (params.capturedUrl && params.capturedUrl.startsWith('http')) {
    const result: ResolvedCartUrlResult = {
      url: params.capturedUrl,
      priority: 'PRIORITY_1: captured_url_rpa',
      strategy: 'session_param',
    };

    console.log('[CART_STRATEGY LOG]', {
      supplier: params.supplierName,
      priority: result.priority,
      strategy: result.strategy,
      resolvedUrl: result.url,
    });
    return result;
  }

  // BUG 2 - Prioridade 2: URL base oficial do cadastro do fornecedor (remove /produtos se presente)
  if (params.officialPortalUrl && params.officialPortalUrl.startsWith('http')) {
    let cleanBase = params.officialPortalUrl.replace(/\/$/, '').replace(/\/produtos$/, '');
    const finalOfficialUrl = cleanBase.endsWith('/carrinho') ? cleanBase : `${cleanBase}/carrinho`;

    const result: ResolvedCartUrlResult = {
      url: finalOfficialUrl,
      priority: 'PRIORITY_2: official_db_url',
      strategy: 'session_param',
    };

    console.log('[CART_STRATEGY LOG]', {
      supplier: params.supplierName,
      priority: result.priority,
      strategy: result.strategy,
      resolvedUrl: result.url,
    });
    return result;
  }

  // BUG 2 - Prioridade 3: Fallback sanitizado com NFD
  const slug = sanitizeSupplierSlug(params.supplierName);

  if (slug.length < 4) {
    console.warn(
      `[URL SANITY WARNING] Slug gerado para "${params.supplierName}" possui apenas ${slug.length} caractere(s) ("${slug}"). Verifique o cadastro do fornecedor.`
    );
  }

  const fallbackUrl = `https://www.${slug || 'fornecedor'}.com.br/carrinho`;
  const result: ResolvedCartUrlResult = {
    url: fallbackUrl,
    priority: 'PRIORITY_3: sanitized_fallback',
    strategy: 'session_param',
  };

  console.log('[CART_STRATEGY LOG]', {
    supplier: params.supplierName,
    priority: result.priority,
    strategy: result.strategy,
    resolvedUrl: result.url,
  });

  return result;
}
