import { chromium, Page } from 'playwright';
import * as crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db/client';
import { decryptAES256 } from '@/lib/security/vault';
import { validarDominioESSL } from './securityValidator';
import { dismissCookieBanner } from './cookieBanner';
import { registrarLogAutomacao } from './logAutomacao';

import { sanitizeSupplierSlug } from '@/lib/utils';

export { dismissCookieBanner };

export type StatusLoginAutomacao = 
  | 'SUCESSO' 
  | 'CAMPOS_NAO_ENCONTRADOS' 
  | 'LOGIN_FALHOU' 
  | 'TIMEOUT' 
  | 'FORNECEDOR_NAO_ENCONTRADO';

export interface ResultadoLoginAutomacao {
  sucesso: boolean;
  status: StatusLoginAutomacao;
  mensagem: string;
  fornecedorId: string;
  fornecedorNome?: string;
  urlNavegada?: string;
  screenshotUrl?: string;
  tempoDeExecucaoMs: number;
}

// Seletores genéricos para formulários de login B2B
const SELECTORES_LOGIN = [
  'input[type="email"]',
  'input[name="email"]',
  '#email',
  'input[name="login"]',
  '#login',
  'input[name="usuario"]',
  '#usuario',
  'input[name="username"]',
  '#username',
  'input[name="cnpj"]',
  '#cnpj',
  'input[placeholder*="login" i]',
  'input[placeholder*="cnpj" i]',
  'input[placeholder*="e-mail" i]',
  'input[placeholder*="usuário" i]',
  'input[type="text"]',
];

const SELECTORES_SENHA = [
  'input[type="password"]',
  'input[name="senha"]',
  '#senha',
  'input[name="password"]',
  '#password',
  'input[placeholder*="senha" i]',
];

const SELECTORES_BOTAO = [
  'button[type="submit"]',
  'input[type="submit"]',
  '#btn-login',
  '#btn-entrar',
  '.btn-login',
  'button:has-text("Entrar")',
  'button:has-text("Login")',
  'button:has-text("Acessar")',
  'button:has-text("Entrar no Portal")',
  'a:has-text("Entrar")',
  'button',
];

/**
 * Garante o diretório de screenshots para auditoria visual de erros
 */
function ensureScreenshotDir(): string {
  const dir = path.join(process.cwd(), 'public', 'logs', 'screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const htmlDir = path.join(process.cwd(), 'public', 'logs', 'html_dumps');
  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
  }
  return dir;
}

/**
 * Digita texto caractere a caractere com delay humano aleatório (entre 80ms e 250ms)
 */
async function typeWithHumanDelay(page: Page, selector: string, text: string): Promise<void> {
  const element = page.locator(selector).first();
  await element.focus();
  await element.clear().catch(() => {});

  for (const char of text) {
    await element.type(char);
    const delay = Math.floor(Math.random() * (250 - 80 + 1)) + 80;
    await page.waitForTimeout(delay);
  }
}

/**
 * Abre o navegador Playwright, efetua login no fornecedor e RETORNA A SESSÃO ABERTA para posterior busca/cotação
 */
export async function obterSessaoLogada(fornecedorId: string): Promise<{
  sucesso: boolean;
  browser?: any;
  context?: any;
  page?: Page;
  fornecedor?: any;
  status?: StatusLoginAutomacao;
  mensagem?: string;
}> {
  let browser = null;

  try {
    const fornecedoresList = await db.fornecedores.list();
    const fornecedor = fornecedoresList.find((f) => f.id === fornecedorId);

    if (!fornecedor) {
      return {
        sucesso: false,
        status: 'FORNECEDOR_NAO_ENCONTRADO',
        mensagem: `Fornecedor com ID "${fornecedorId}" não foi encontrado no banco.`,
      };
    }

    const urlPortal = fornecedor.urlPortalB2B || `https://portal.${sanitizeSupplierSlug(fornecedor.nome)}.com.br/login`;
    const usuarioLogin = (fornecedor.emailLogin || fornecedor.cnpj || fornecedor.email || fornecedor.login || 'compras@saracota.com.br').trim();

    // 🔒 Descriptografia e Sanitização da Senha (.trim())
    const rawEncryptedSenha = (
      fornecedor.rawSenhaCriptografada || 
      fornecedor.senhaLogin || 
      (fornecedor.senhaCriptografada !== '••••••••' ? fornecedor.senhaCriptografada : '') || 
      ''
    ).trim();

    let senhaPlana = '';
    if (rawEncryptedSenha.includes(':') || rawEncryptedSenha.startsWith('enc_sec_')) {
      senhaPlana = decryptAES256(rawEncryptedSenha).trim();
    } else if (rawEncryptedSenha && rawEncryptedSenha !== '••••••••') {
      senhaPlana = rawEncryptedSenha.trim();
    }

    if (!senhaPlana || senhaPlana === '[DESCRIPTOGRAFIA_FALHOU]') {
      senhaPlana = 'SenhaDemo123!';
    }

    // Hash SHA-256 da senha descriptografada para verificação sem expor texto puro em logs
    const senhaHashSHA256 = crypto.createHash('sha256').update(senhaPlana).digest('hex');

    console.log(`🔒 [RPA DEBUG VAULT] Leitura e descriptografia de credenciais (Fornecedor: ${fornecedor.nome}):`);
    console.log(`   - Login preenchido: "${usuarioLogin}"`);
    console.log(`   - Length da senha descriptografada (.trim()): ${senhaPlana.length}`);
    console.log(`   - Hash SHA-256 da senha descriptografada: ${senhaHashSHA256}`);

    // Instanciar browser remoto no Browserbase (para ambiente Vercel serverless) ou fallback local
    const bbApiKey = process.env.BROWSERBASE_API_KEY;
    const bbProjectId = process.env.BROWSERBASE_PROJECT_ID;
    let bbSession: any = null;

    if (bbApiKey && bbApiKey !== 'demo-browserbase-api-key') {
      try {
        console.log(`🔌 [RPA LOGIN REMOTO] Conectando ao Browserbase remoto via CDP...`);
        const { Browserbase } = require('@browserbasehq/sdk');
        const bb = new Browserbase({ apiKey: bbApiKey });
        bbSession = await bb.sessions.create({
          projectId: bbProjectId,
          keepAlive: true,
          timeout: 1800,
        } as any);
        console.log("[COTACAO] sessão criada:", bbSession.id);
        const connectUrl = bbSession.connectUrl || `wss://connect.browserbase.com?apiKey=${bbApiKey}&sessionId=${bbSession.id}`;
        browser = await chromium.connectOverCDP(connectUrl);
        console.log(`✅ [RPA LOGIN REMOTO] Conectado à sessão remota do Browserbase (${bbSession.id})!`);
      } catch (bbErr: any) {
        console.warn('⚠️ [RPA LOGIN REMOTO WARN] Falha ao conectar ao Browserbase, tentando launch local:', bbErr.message);
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }).catch(() => null);
      }
    } else {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }).catch(() => null);
    }

    if (!browser) {
      console.warn('⚠️ [RPA LOGIN REMOTO] Impossível abrir o navegador Chromium no ambiente atual.');
      return {
        sucesso: false,
        status: 'TIMEOUT',
        mensagem: 'Ambiente serverless sem suporte a Chromium local. Configure BROWSERBASE_API_KEY no painel da Vercel.',
      };
    }

    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const pages = context.pages();
    const page: Page = pages.length > 0 ? pages[0] : await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);

    // Network Monitoring / Interceptação de Rede Reutilizável [RPA DEBUG]
    page.on('request', (request) => {
      if (request.url().includes('login') && request.method() === 'POST') {
        console.log('[RPA DEBUG] PAYLOAD ENVIADO:', request.postData());
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('login')) {
        console.log('[RPA DEBUG] STATUS:', response.status());
        try {
          console.log('[RPA DEBUG] RESPOSTA:', await response.text());
        } catch (e: any) {
          console.log('[RPA DEBUG] RESPOSTA (erro ao ler corpo):', e.message);
        }
      }
    });

    let targetUrlPortal = urlPortal;
    if (targetUrlPortal && !targetUrlPortal.startsWith('http://') && !targetUrlPortal.startsWith('https://')) {
      targetUrlPortal = `https://${targetUrlPortal}`;
    }

    console.log(`🌐 [RPA NAVIGATE BEFORE] Executando page.goto("${targetUrlPortal}")... | URL atual: "${page.url()}"`);
    try {
      const navRes = await page.goto(targetUrlPortal, { waitUntil: 'domcontentloaded', timeout: 25000 });
      console.log(`✅ [RPA NAVIGATE AFTER] page.goto("${targetUrlPortal}") concluído! Status HTTP: ${navRes?.status() || 200} | URL final: "${page.url()}"`);
    } catch (navError: any) {
      console.error(`❌ [RPA NAVIGATE ERRO] Erro ao navegar para "${targetUrlPortal}":`, navError.stack || navError.message);
      const screenshotDir = ensureScreenshotDir();
      const screenshotPath = path.join(screenshotDir, `timeout_${fornecedorId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await browser.close();
      return {
        sucesso: false,
        status: 'TIMEOUT',
        mensagem: `Timeout ao carregar portal do fornecedor (${targetUrlPortal}): ${navError.message}`,
      };
    }

    // ------------------------------------------------------------------
    // VALIDAÇÃO SEGURANÇA CRÍTICA: ANTI-PHISHING & SSL (PROMPT 17)
    // ------------------------------------------------------------------
    const validacaoSeguranca = await validarDominioESSL(page, fornecedor);
    if (!validacaoSeguranca.sucesso) {
      const screenshotDir = ensureScreenshotDir();
      const screenshotPath = path.join(screenshotDir, `bloqueio_seguranca_${fornecedorId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await browser.close();
      return {
        sucesso: false,
        status: validacaoSeguranca.status as any,
        mensagem: validacaoSeguranca.mensagem,
      };
    }

    // ------------------------------------------------------------------
    // 1. DISPENSA DE BANNER DE COOKIES / LGPD (ANTES DE QUALQUER LOGIN)
    // ------------------------------------------------------------------
    await dismissCookieBanner(page, {
      requiresCookieDismissal: fornecedor.requiresCookieDismissal,
      cookieSelectorHint: fornecedor.cookieSelectorHint,
    });

    // ------------------------------------------------------------------
    // 2. FLUXO DE LOGIN GENÉRICO USANDO O CAMPO seletores (JSONB)
    // ------------------------------------------------------------------
    const seletores: Record<string, string> = (fornecedor as any).seletores || {};

    // 2a. Clicar em botao_abrir_modal_login (se presente no JSON ou fallback genérico)
    if (seletores.botao_abrir_modal_login) {
      const trigSel = seletores.botao_abrir_modal_login;
      console.log(`[RPA DEBUG] Procurando botao_abrir_modal_login via JSON: "${trigSel}"...`);
      try {
        const trigLoc = page.locator(trigSel).first();
        await trigLoc.waitFor({ state: 'visible', timeout: 10000 });
        await trigLoc.click();
        await page.waitForTimeout(1500);
      } catch (e: any) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'botao_abrir_modal_login',
          motivo: 'Timeout ao aguardar elemento botao_abrir_modal_login',
          mensagem: `Seletor "${trigSel}" não foi encontrado ou não esteve visível: ${e.message}`,
        });
        await browser.close();
        return {
          sucesso: false,
          status: 'CAMPOS_NAO_ENCONTRADOS',
          mensagem: `Botão "botao_abrir_modal_login" ("${trigSel}") não foi localizado.`,
        };
      }
    } else {
      const defaultTriggers = [
        fornecedor.triggerSelector,
        '.componentes-button_login',
        'button:has-text("FAÇA LOGIN")',
        'button:has-text("Entre ou cadastre-se")',
        'button:has-text("Entrar")',
        'a[href*="login"]',
        '.btn-login',
        '#btn-login',
      ].filter(Boolean) as string[];

      for (const trig of defaultTriggers) {
        if (await page.locator(trig).first().isVisible().catch(() => false)) {
          console.log(`[RPA DEBUG] Gatilho de modal localizado via fallback: "${trig}". Clicando...`);
          await page.locator(trig).first().click().catch(() => {});
          await page.waitForTimeout(1500);
          break;
        }
      }
    }

    // 2b. Localizar e Preencher campo_email
    let selectedLoginSelector: string | null = null;
    if (seletores.campo_email) {
      const emailSel = seletores.campo_email;
      try {
        const emailLoc = page.locator(emailSel).first();
        await emailLoc.waitFor({ state: 'visible', timeout: 10000 });
        selectedLoginSelector = emailSel;
      } catch (e: any) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'campo_email',
          motivo: 'Timeout ao aguardar elemento campo_email',
          mensagem: `Seletor de login "${emailSel}" não localizado no DOM: ${e.message}`,
        });
        await browser.close();
        return {
          sucesso: false,
          status: 'CAMPOS_NAO_ENCONTRADOS',
          mensagem: `Campo "campo_email" ("${emailSel}") não foi localizado.`,
        };
      }
    } else {
      for (const sel of SELECTORES_LOGIN) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          selectedLoginSelector = sel;
          break;
        }
      }
    }

    // 2c. Localizar e Preencher campo_senha
    let selectedPassSelector: string | null = null;
    if (seletores.campo_senha) {
      const passSel = seletores.campo_senha;
      try {
        const passLoc = page.locator(passSel).first();
        await passLoc.waitFor({ state: 'visible', timeout: 10000 });
        selectedPassSelector = passSel;
      } catch (e: any) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'campo_senha',
          motivo: 'Timeout ao aguardar elemento campo_senha',
          mensagem: `Seletor de senha "${passSel}" não localizado no DOM: ${e.message}`,
        });
        await browser.close();
        return {
          sucesso: false,
          status: 'CAMPOS_NAO_ENCONTRADOS',
          mensagem: `Campo "campo_senha" ("${passSel}") não foi localizado.`,
        };
      }
    } else {
      for (const sel of SELECTORES_SENHA) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          selectedPassSelector = sel;
          break;
        }
      }
    }

    if (!selectedLoginSelector || !selectedPassSelector) {
      const campoFalho = !selectedLoginSelector ? 'campo_email' : 'campo_senha';
      await registrarLogAutomacao({
        fornecedorId,
        etapa: campoFalho,
        motivo: 'Elemento de formulário não encontrado na página',
        mensagem: `Não foi possível localizar o campo ${campoFalho} no formulário de ${urlPortal}.`,
      });
      const screenshotDir = ensureScreenshotDir();
      const screenshotPath = path.join(screenshotDir, `campos_nao_encontrados_${fornecedorId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await browser.close();
      return {
        sucesso: false,
        status: 'CAMPOS_NAO_ENCONTRADOS',
        mensagem: `Não foi possível localizar os campos de login/senha no formulário (${urlPortal}).`,
      };
    }

    await typeWithHumanDelay(page, selectedLoginSelector, usuarioLogin);
    await page.waitForTimeout(Math.floor(Math.random() * (600 - 300 + 1)) + 300);
    await typeWithHumanDelay(page, selectedPassSelector, senhaPlana);

    const preClickPauseMs = Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
    await page.waitForTimeout(preClickPauseMs);

    // 2d. Clicar em botao_entrar
    let selectedButtonSelector: string | null = null;
    if (seletores.botao_entrar) {
      const btnSel = seletores.botao_entrar;
      try {
        const btnLoc = page.locator(btnSel).first();
        await btnLoc.waitFor({ state: 'visible', timeout: 10000 });
        selectedButtonSelector = btnSel;
      } catch (e: any) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'botao_entrar',
          motivo: 'Timeout ao aguardar elemento botao_entrar',
          mensagem: `Seletor de submit "${btnSel}" não localizado: ${e.message}`,
        });
        await browser.close();
        return {
          sucesso: false,
          status: 'CAMPOS_NAO_ENCONTRADOS',
          mensagem: `Botão "botao_entrar" ("${btnSel}") não foi localizado.`,
        };
      }
    } else {
      const modalBtnSelectors = [
        '.modal.show button[type="submit"]',
        '.modal button[type="submit"]',
        '.modal button:has-text("Entrar")',
        ...SELECTORES_BOTAO
      ];
      for (const sel of modalBtnSelectors) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          selectedButtonSelector = sel;
          break;
        }
      }
    }

    if (selectedButtonSelector) {
      const elHandle = page.locator(selectedButtonSelector).first();
      try {
        await elHandle.click({ timeout: 5000 });
      } catch (clickErr: any) {
        console.log('[RPA DEBUG] Fallback via tecla ENTER...');
        await page.keyboard.press('Enter');
      }
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(3000);

    // 2e. Clicar em botao_selecionar_filial (OPCIONAL & CONDICIONAL)
    if (seletores.botao_selecionar_filial) {
      const filialSel = seletores.botao_selecionar_filial;
      console.log(`[RPA DEBUG] Verificando se botao_selecionar_filial ("${filialSel}") está visível...`);
      try {
        const filialLoc = page.locator(filialSel).first();
        const isVisible = await filialLoc.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
          console.log(`[RPA DEBUG] Clicando em botao_selecionar_filial ("${filialSel}")...`);
          await filialLoc.click();
          await page.waitForTimeout(1500);
        } else {
          console.log(`[RPA DEBUG] botao_selecionar_filial ("${filialSel}") não exibido nesta sessão. Seguindo...`);
        }
      } catch (e: any) {
        console.warn(`[RPA DEBUG] Aviso em botao_selecionar_filial (etapa opcional):`, e.message);
      }
    }

    // 2f. Clicar em botao_confirmar_filial (OPCIONAL & CONDICIONAL)
    if (seletores.botao_confirmar_filial) {
      const confirmFilialSel = seletores.botao_confirmar_filial;
      console.log(`[RPA DEBUG] Verificando se botao_confirmar_filial ("${confirmFilialSel}") está visível...`);
      try {
        const confirmLoc = page.locator(confirmFilialSel).first();
        const isVisible = await confirmLoc.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
          console.log(`[RPA DEBUG] Clicando em botao_confirmar_filial ("${confirmFilialSel}")...`);
          await confirmLoc.click();
          await page.waitForTimeout(1500);
        } else {
          console.log(`[RPA DEBUG] botao_confirmar_filial ("${confirmFilialSel}") não exibido nesta sessão. Seguindo...`);
        }
      } catch (e: any) {
        console.warn(`[RPA DEBUG] Aviso em botao_confirmar_filial (etapa opcional):`, e.message);
      }
    }

    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => '');
    const bodyContent = (await page.content()).toLowerCase();

    console.log(`[RPA DEBUG] ESTADO DO DOM 5 SEGUNDOS APÓS O CLIQUE:`);
    console.log(`   - URL Atual da Página: "${currentUrl}"`);
    console.log(`   - Título da Página: "${currentTitle}"`);
    console.log(`   - Modal .modal.show ainda aberto no DOM? ${bodyContent.includes('modal show') ? 'SIM' : 'NÃO'}`);
    console.log(`   - Desafio anti-bot (reCAPTCHA / Cloudflare) detectado? ${bodyContent.includes('recaptcha') || bodyContent.includes('cloudflare') ? 'SIM' : 'NÃO'}`);
    console.log(`   - Mensagem de erro de credencial detectada no DOM? ${bodyContent.includes('senha incorreta') || bodyContent.includes('não conferem') || bodyContent.includes('credenciais') ? 'SIM' : 'NÃO'}`);

    const isLoginFailed =
      bodyContent.includes('senha incorreta') ||
      bodyContent.includes('usuário não encontrado') ||
      bodyContent.includes('credenciais inválidas') ||
      bodyContent.includes('login inválido') ||
      bodyContent.includes('invalid credentials');

    if (isLoginFailed) {
      const screenshotDir = ensureScreenshotDir();
      const screenshotPath = path.join(screenshotDir, `login_falhou_${fornecedorId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await browser.close();
      return {
        sucesso: false,
        status: 'LOGIN_FALHOU',
        mensagem: `Login falhou no portal de ${fornecedor.nome}: Credenciais rejeitadas pelo servidor.`,
      };
    }

    return {
      sucesso: true,
      browser,
      context,
      page,
      fornecedor,
      sessionId: bbSession?.id || null,
    } as any;
  } catch (error: any) {
    if (browser) {
      await (browser as any).disconnect().catch(() => {});
    }
    return {
      sucesso: false,
      status: 'TIMEOUT',
      mensagem: error.message || 'Exceção ao efetuar login no fornecedor.',
    };
  }
}

/**
 * Função Principal: Executa Login Automatizado usando Playwright Headless
 */
export async function loginFornecedor(fornecedorId: string): Promise<ResultadoLoginAutomacao> {
  const startTime = Date.now();
  const sessao = await obterSessaoLogada(fornecedorId);

  if (!sessao.sucesso) {
    return {
      sucesso: false,
      status: sessao.status || 'LOGIN_FALHOU',
      mensagem: sessao.mensagem || 'Falha ao realizar login no portal.',
      fornecedorId,
      tempoDeExecucaoMs: Date.now() - startTime,
    };
  }

  const currentUrl = sessao.page ? sessao.page.url() : '';
  if (sessao.browser) {
    await (sessao.browser as any).disconnect().catch(() => {});
  }

  return {
    sucesso: true,
    status: 'SUCESSO',
    mensagem: `Login efetuado com sucesso no portal B2B de ${sessao.fornecedor?.nome || 'fornecedor'}!`,
    fornecedorId,
    fornecedorNome: sessao.fornecedor?.nome,
    urlNavegada: currentUrl,
    tempoDeExecucaoMs: Date.now() - startTime,
  };
}
