import { Page } from 'playwright';

/**
 * Seletores genéricos e específicos para banners, modais e avisos de cookies / LGPD
 */
export const COOKIE_BANNER_SELECTORS = [
  'button:has-text("Aceitar todos")',
  'button:has-text("Aceitar todos os cookies")',
  'button:has-text("Aceitar Cookies")',
  'button:has-text("Aceitar")',
  'button:has-text("Concordo")',
  'a:has-text("Aceitar todos")',
  'a:has-text("Aceitar todos os cookies")',
  'a:has-text("Aceitar")',
  '#cookie-consent button',
  '#cookie-consent a',
  '#cookie-consent',
  '.cookie-banner button',
  '.cookie-banner a',
  '.cookie-banner',
  '[class*="cookie"] button',
  '[class*="cookie"] a',
  '[class*="cookie"]',
  '[class*="lgpd"] button',
  '[class*="lgpd"] a',
  '[class*="lgpd"]',
  '#botao-aceitar-todos',
  '.cookie-accept',
  '#accept-cookies',
  '.btn-accept',
  '[class*="cookie"] button:has-text("OK")',
  '[class*="lgpd"] button:has-text("OK")',
  '.modal button:has-text("OK")',
];

export interface CookieDismissOptions {
  requiresCookieDismissal?: boolean;
  cookieSelectorHint?: string;
  timeoutMs?: number;
}

/**
 * Função utilitária reutilizável chamada dismissCookieBanner(page, options) que:
 * 1. Roda ANTES de qualquer tentativa de login em qualquer fornecedor.
 * 2. Se requires_cookie_dismissal = true / cookieSelectorHint for fornecido, prioriza o seletor salvo.
 * 3. Se o seletor salvo não for encontrado, faz o fallback para a lista genérica de seletores de cookies.
 * 4. Se encontrar, clica e aguarda 500ms para o DOM assentar.
 * 5. Se não encontrar em 2 segundos, segue o fluxo normalmente sem travar o robô.
 * 6. Registra no log [RPA DEBUG] se um banner foi encontrado e fechado, ou se nenhum foi detectado.
 *
 * @param page Instância da página do Playwright
 * @param options Opções de consentimento (opcional: cookieSelectorHint, timeoutMs)
 * @param legacyTimeoutMs Limite padrão se chamado com assinatura simples
 */
export async function dismissCookieBanner(
  page: Page | any,
  options?: CookieDismissOptions | string,
  legacyTimeoutMs = 2000
): Promise<boolean> {
  const startTime = Date.now();

  let hint: string | undefined = undefined;
  let timeoutMs = legacyTimeoutMs;

  if (typeof options === 'string') {
    hint = options;
  } else if (options && typeof options === 'object') {
    hint = options.cookieSelectorHint;
    timeoutMs = options.timeoutMs ?? 2000;
  }

  try {
    // 1. Prioridade: Se houver seletor customizado em cookie_selector_hint
    if (hint && hint.trim()) {
      const hintSel = hint.trim();
      try {
        const hintLocator = page.locator ? page.locator(hintSel).first() : null;
        if (hintLocator) {
          const isHintVisible = await hintLocator.isVisible({ timeout: 500 }).catch(() => false);
          if (isHintVisible) {
            console.log(`[RPA DEBUG] Banner de cookies/LGPD localizado via hint customizado "${hintSel}". Clicando...`);
            await hintLocator.click({ force: true }).catch(() => {});
            await page.waitForTimeout(500);
            console.log(`[RPA DEBUG] Banner de cookies/LGPD fechado com sucesso (hint: "${hintSel}"). DOM assentado (500ms).`);
            return true;
          }
        }
      } catch (hintErr: any) {
        console.warn(`[RPA DEBUG] Hint customizado "${hintSel}" não localizado: ${hintErr?.message || hintErr}. Testando seletores genéricos...`);
      }
    }

    // 2. Fallback Genérico: Lista de seletores padrão de cookies / LGPD
    for (const sel of COOKIE_BANNER_SELECTORS) {
      if (Date.now() - startTime >= timeoutMs) break;

      try {
        const locator = page.locator ? page.locator(sel).first() : null;
        if (!locator) continue;

        const isVisible = await locator.isVisible({ timeout: 150 }).catch(() => false);
        if (isVisible) {
          console.log(`[RPA DEBUG] Banner de cookies/LGPD localizado via seletor genérico "${sel}". Clicando...`);
          await locator.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
          console.log(`[RPA DEBUG] Banner de cookies/LGPD fechado com sucesso. DOM assentado (500ms).`);
          return true;
        }
      } catch {
        // Ignora falha de seletor individual
      }
    }
  } catch (err: any) {
    console.warn(`[RPA DEBUG] Erro ao verificar banner de cookies: ${err?.message || err}. Prosseguindo...`);
    return false;
  }

  console.log(`[RPA DEBUG] Nenhum banner de cookies/LGPD detectado (timeout ${timeoutMs}ms). Prosseguindo...`);
  return false;
}

export default dismissCookieBanner;
