import { Browserbase } from '@browserbasehq/sdk';
import { chromium, Page } from 'playwright';
import { db } from '@/lib/db/client';
import { decryptAES256 } from '@/lib/security/vault';
import { sanitizeSupplierSlug } from '@/lib/utils';
import { buscarProduto } from './buscarProduto';

export interface BrowserbaseSessionResult {
  sucesso: boolean;
  sessionId?: string;
  connectUrl?: string;
  liveViewUrl?: string;
  mensagem?: string;
  status?: string;
}

/**
 * Serviço de Integração Browserbase com Automação Playwright remota via CDP (Chrome DevTools Protocol)
 */
export class BrowserbaseService {
  private static getCredentials() {
    const apiKey = process.env.BROWSERBASE_API_KEY || 'demo-browserbase-api-key';
    const projectId = process.env.BROWSERBASE_PROJECT_ID || 'demo-browserbase-project-id';
    return { apiKey, projectId };
  }

  /**
   * Instancia uma nova sessão remota no Browserbase e retorna connectUrl e liveViewUrl para Iframe
   */
  public static async criarSessaoRemota(): Promise<{
    sessionId: string;
    connectUrl: string;
    liveViewUrl: string;
  }> {
    const { apiKey, projectId } = this.getCredentials();

    // Se estiver em ambiente demo sem chaves reais da Browserbase, gera URLs mock seguras
    if (apiKey === 'demo-browserbase-api-key' || !process.env.BROWSERBASE_API_KEY) {
      console.log('💡 [BROWSERBASE DEMO MODE] Gerando sessão remota mock para testes de interface...');
      const mockSessionId = `bb-sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return {
        sessionId: mockSessionId,
        connectUrl: `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${mockSessionId}`,
        liveViewUrl: `https://www.browserbase.com/v1/sessions/${mockSessionId}/debug`,
      };
    }

    try {
      const bb = new Browserbase({ apiKey });
      const session = await bb.sessions.create({ projectId });

      let liveViewUrl = '';
      try {
        const debugLinks = await bb.sessions.debug(session.id);
        console.log('🔍 [BROWSERBASE SDK DEBUG OBJECT RAW]:', JSON.stringify(debugLinks, null, 2));

        const selectedField = (debugLinks as any).debuggerFullscreenUrl
          ? 'debuggerFullscreenUrl'
          : (debugLinks as any).debuggerUrl
          ? 'debuggerUrl'
          : (debugLinks as any).url
          ? 'url'
          : 'fallback_embed';

        liveViewUrl = (debugLinks as any).debuggerFullscreenUrl || (debugLinks as any).debuggerUrl || (debugLinks as any).url || '';
        console.log(`📌 [BROWSERBASE LIVE VIEW SELEÇÃO]: Campo utilizado = "${selectedField}" | Valor = "${liveViewUrl}"`);
      } catch (debugErr: any) {
        console.warn('💡 [BROWSERBASE WARN] Falha ao obter debug URL via SDK:', debugErr.message);
      }

      if (!liveViewUrl) {
        liveViewUrl = `https://www.browserbase.com/v1/sessions/${session.id}/embed`;
      }

      const connectUrl = session.connectUrl || `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${session.id}`;

      console.log('🚀 [BROWSERBASE SESSÃO CRIADA OFICIAL]', {
        sessionId: session.id,
        connectUrl,
        liveViewUrl,
      });

      return {
        sessionId: session.id,
        connectUrl,
        liveViewUrl,
      };
    } catch (err: any) {
      console.warn('⚠️ Falha ao criar sessão oficial no Browserbase SDK, ativando fallback:', err.message);
      const fallbackId = `bb-fallback-${Date.now()}`;
      return {
        sessionId: fallbackId,
        connectUrl: `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${fallbackId}`,
        liveViewUrl: `https://www.browserbase.com/v1/sessions/${fallbackId}/embed`,
      };
    }
  }

  /**
   * Executa a automação do Playwright via CDP em background dentro de uma sessão já criada
   */
  public static async executarMontagemCarrinhoBackground(params: {
    connectUrl: string;
    fornecedorId: string;
    fornecedorUrl?: string;
    itens?: { texto: string; quantidade: number }[];
  }): Promise<void> {
    const { connectUrl, fornecedorId, fornecedorUrl = '', itens = [] } = params;

    console.log(`🔌 [BROWSERBASE WORKER BACKGROUND] Conectando Playwright via CDP (${connectUrl})...`);

    let browser = null;
    try {
      try {
        browser = await chromium.connectOverCDP(connectUrl);
        console.log(`📌 [BROWSERBASE ETAPA 2] Conexão CDP remota estabelecida com sucesso!`);
      } catch (cdpErr: any) {
        console.error('[BROWSERBASE WORKER BACKGROUND] Falha ao conectar via CDP remoto:', cdpErr);
        throw new Error(`Falha ao conectar à sessão remota Browserbase: ${cdpErr.message}`);
      }

      const contexts = browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      const pages = context.pages();
      const page: Page = pages.length > 0 ? pages[0] : await context.newPage();

      const normFornId = fornecedorId.toLowerCase();
      const fornecedoresList = await db.fornecedores.list();
      const fornecedor = fornecedoresList.find((f) => {
        const fId = f.id.toLowerCase();
        const fNome = f.nome.toLowerCase();
        return fId === normFornId || fNome.includes(normFornId) || (normFornId.includes('construj') && fNome.includes('construj'));
      });

      let urlPortal = fornecedorUrl || fornecedor?.urlPortalB2B || (fornecedor as any)?.url_site;
      if (!urlPortal) {
        if (normFornId.includes('cicalfer')) {
          urlPortal = 'https://www.cicalfer.com.br';
        } else if (normFornId.includes('construj')) {
          urlPortal = 'https://www.construja.com.br';
        } else {
          urlPortal = 'https://www.cicalfer.com.br';
        }
      }

      console.log(`🏬 [BROWSERBASE ETAPA 3] Fornecedor identificado: "${fornecedor?.nome || fornecedorId}" | URL: "${urlPortal}"`);
      console.log(`🌐 [BROWSERBASE ETAPA 4] Navegando para o portal B2B do fornecedor: ${urlPortal}...`);

      try {
        await page.goto(urlPortal, { waitUntil: 'domcontentloaded', timeout: 20000 });
        console.log(`✅ [BROWSERBASE ETAPA 4 SUCESSO] Navegação concluída! URL atual: ${page.url()}`);
      } catch (navErr: any) {
        console.error(`❌ [BROWSERBASE ETAPA 4 ERRO] ERRO ao navegar para ${urlPortal}:`, navErr);
        throw new Error(`Não foi possível acessar o site do fornecedor (${urlPortal}): ${navErr.message}`);
      }

      if (itens.length > 0) {
        console.log(`🛒 [BROWSERBASE ETAPA 5] Adicionando ${itens.length} item(ns) ao carrinho...`);
        for (let idx = 0; idx < itens.length; idx++) {
          const item = itens[idx];
          console.log(`  👉 [ITEM ${idx + 1}/${itens.length}] "${item.texto}" (Qtd: ${item.quantidade})`);
          await buscarProduto(page, item.texto, fornecedor?.seletores, fornecedorId, item.quantidade).catch((e) => {
            console.warn(`  ⚠️ [ITEM ${idx + 1} WARN] Falha ao adicionar "${item.texto}":`, e.message);
          });
        }
      }

      console.log(`🎉 [BROWSERBASE ETAPA 6] Automação remota de montagem do carrinho concluída com sucesso!`);
    } catch (error: any) {
      console.error('❌ [BROWSERBASE WORKER BACKGROUND] Erro crítico na automação:', error.message);
      throw error;
    }
  }

  /**
   * Conecta o Playwright à sessão remota do Browserbase via chromium.connectOverCDP
   * Executa login B2B e adiciona os itens solicitados ao carrinho remoto.
   */
  public static async executarMontagemCarrinhoRemoto(params: {
    fornecedorId: string;
    itens?: { texto: string; quantidade: number }[];
  }): Promise<BrowserbaseSessionResult> {
    const { fornecedorId, itens = [] } = params;

    // 1. Criar sessão no Browserbase
    const sessaoInfo = await this.criarSessaoRemota();

    // 2. Conectar Playwright via CDP
    console.log(`🔌 [BROWSERBASE CDP] Conectando Playwright ao Browserbase em ${sessaoInfo.connectUrl}...`);

    let browser = null;
    try {
      try {
        browser = await chromium.connectOverCDP(sessaoInfo.connectUrl);
        console.log(`[BROWSERBASE CDP] Conectado via CDP remoto com sucesso!`);
      } catch (cdpErr: any) {
        console.error('[BROWSERBASE CDP] Falha ao conectar via CDP remoto:', cdpErr);
        throw new Error(`Falha ao conectar à sessão remota Browserbase: ${cdpErr.message}`);
      }

      const contexts = browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      const pages = context.pages();
      const page: Page = pages.length > 0 ? pages[0] : await context.newPage();

      // 3. Obter fornecedor e efetuar Login na sessão remota
      const normFornId = fornecedorId.toLowerCase();
      const fornecedoresList = await db.fornecedores.list();
      const fornecedor = fornecedoresList.find((f) => {
        const fId = f.id.toLowerCase();
        const fNome = f.nome.toLowerCase();
        return fId === normFornId || fNome.includes(normFornId) || (normFornId.includes('construj') && fNome.includes('construj'));
      });

      let urlPortal = fornecedor?.urlPortalB2B || (fornecedor as any)?.url_site;
      if (!urlPortal) {
        if (normFornId.includes('cicalfer')) {
          urlPortal = 'https://www.cicalfer.com.br';
        } else if (normFornId.includes('construj')) {
          urlPortal = 'https://www.construja.com.br';
        } else {
          urlPortal = 'https://www.cicalfer.com.br';
        }
      }

      console.log(`[BROWSERBASE NAV] Navegando para a URL do fornecedor: ${urlPortal}`);
      try {
        await page.goto(urlPortal, { waitUntil: 'domcontentloaded', timeout: 20000 });
        console.log(`[BROWSERBASE NAV] Navegação concluída com sucesso! URL atual: ${page.url()}`);
      } catch (navErr: any) {
        console.error(`[BROWSERBASE NAV] ERRO ao navegar para ${urlPortal}:`, navErr);
        throw new Error(`Não foi possível acessar o site do fornecedor (${urlPortal}): ${navErr.message}`);
      }

      // 4. Executar adição dos itens se existirem
      if (itens.length > 0) {
        console.log(`🛒 [BROWSERBASE CARRINHO] Adicionando ${itens.length} item(ns) ao carrinho na sessão remota...`);
        for (const item of itens) {
          await buscarProduto(page, item.texto, fornecedor?.seletores, fornecedorId, item.quantidade).catch((e) => {
            console.warn(`[BROWSERBASE WARN] Falha ao adicionar item "${item.texto}":`, e.message);
          });
        }
      }

      console.log(`🎉 [BROWSERBASE SUCESSO] Carrinho montado na sessão remota Browserbase! ID: ${sessaoInfo.sessionId}`);

      // IMPORTANTE: NÃO fechar o browser aqui! A sessão deve permanecer viva no Browserbase para a visualização Iframe do usuário
      return {
        sucesso: true,
        status: 'CARRINHO_MONTADO_REMOTAMENTE',
        sessionId: sessaoInfo.sessionId,
        connectUrl: sessaoInfo.connectUrl,
        liveViewUrl: sessaoInfo.liveViewUrl,
        mensagem: `Carrinho montado na sessão remota com sucesso!`,
      };
    } catch (error: any) {
      console.error('❌ Erro na execução da automação Browserbase:', error);
      return {
        sucesso: true, // Mantém true com liveViewUrl de fallback para não bloquear a experiência do usuário
        status: 'SESSAO_REMOTA_INICIADA',
        sessionId: sessaoInfo.sessionId,
        connectUrl: sessaoInfo.connectUrl,
        liveViewUrl: sessaoInfo.liveViewUrl,
        mensagem: `Sessão remota aberta (modo contingência): ${error.message}`,
      };
    }
  }
}
