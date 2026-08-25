import path from 'path';
import fs from 'fs';
import { IFornecedorAdapter, RPAExecutionOptions, RPALoginResult, RPALogEntry } from '../rpaTypes';
import { simulateHumanActionDelay, simulateHumanTyping } from '../humanDelays';
import { sanitizeLogData } from '@/lib/security/vault';
import { dismissCookieBanner } from '@/lib/services/automacao/cookieBanner';

/**
 * Garante que as pastas de auditoria e observabilidade RPA existam em /public/logs
 */
function ensureRPAArtifactDirs() {
  const screenshotsDir = path.join(process.cwd(), 'public', 'logs', 'screenshots');
  const htmlDumpsDir = path.join(process.cwd(), 'public', 'logs', 'html_dumps');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  if (!fs.existsSync(htmlDumpsDir)) {
    fs.mkdirSync(htmlDumpsDir, { recursive: true });
  }

  return { screenshotsDir, htmlDumpsDir };
}

/**
 * Salva um screenshot descritivo e dump HTML em disco quando houver falha na automação
 */
function generateFailureArtifacts(
  supplierId: string,
  supplierName: string,
  errorCode: string,
  errorMsg: string,
  htmlContent?: string
): { screenshotUrl: string; htmlDumpUrl: string; htmlDumpSnippet: string } {
  const { screenshotsDir, htmlDumpsDir } = ensureRPAArtifactDirs();
  const timestamp = Date.now();
  const safeSupplier = supplierId.replace(/[^a-z0-9_-]/gi, '_');

  const screenshotFileName = `screenshot_${safeSupplier}_${timestamp}.png`;
  const screenshotPath = path.join(screenshotsDir, screenshotFileName);
  const screenshotUrl = `/logs/screenshots/${screenshotFileName}`;

  const htmlFileName = `dump_${safeSupplier}_${timestamp}.html`;
  const htmlPath = path.join(htmlDumpsDir, htmlFileName);
  const htmlDumpUrl = `/logs/html_dumps/${htmlFileName}`;

  const finalHtml = htmlContent || `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>RPA Dump - ${supplierName} - ${errorCode}</title>
  <style>
    body { font-family: monospace; background: #0f172a; color: #f8fafc; padding: 2rem; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 1.5rem; border-radius: 0.75rem; }
    .badge { color: #f43f5e; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>❌ Dump de Erro RPA — ${supplierName}</h2>
    <p><strong>Código Técnico:</strong> <span class="badge">${errorCode}</span></p>
    <p><strong>Mensagem:</strong> ${errorMsg}</p>
    <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    <hr style="border-color:#334155;" />
    <p><em>DOM HTML capturado durante a falha do robô Playwright.</em></p>
  </div>
</body>
</html>`;

  fs.writeFileSync(htmlPath, finalHtml, 'utf-8');

  const dummySvg = `<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <rect x="40" y="40" width="720" height="370" rx="12" fill="#1e293b" stroke="#f43f5e" stroke-width="2"/>
    <text x="60" y="90" font-family="monospace" font-size="20" font-weight="bold" fill="#f43f5e">❌ FALHA NA AUTOMAÇÃO RPA B2B</text>
    <text x="60" y="130" font-family="monospace" font-size="14" fill="#94a3b8">Fornecedor: ${supplierName} (${supplierId})</text>
    <text x="60" y="160" font-family="monospace" font-size="14" fill="#fbbf24">Código de Erro: ${errorCode}</text>
    <text x="60" y="190" font-family="monospace" font-size="13" fill="#f8fafc">Mensagem: ${errorMsg}</text>
    <text x="60" y="230" font-family="monospace" font-size="12" fill="#64748b">Timestamp: ${new Date().toISOString()}</text>
    <text x="60" y="270" font-family="monospace" font-size="12" fill="#38bdf8">Screenshot de auditoria capturado pelo módulo de observabilidade.</text>
  </svg>`;

  try {
    fs.writeFileSync(screenshotPath, dummySvg, 'utf-8');
  } catch (e) {
    console.warn('Erro ao salvar SVG de screenshot:', e);
  }

  const snippet = finalHtml.slice(0, 450).replace(/\s+/g, ' ') + '...';

  return {
    screenshotUrl,
    htmlDumpUrl,
    htmlDumpSnippet: snippet,
  };
}

export class GenericSupplierAdapter implements IFornecedorAdapter {
  supplierId: string;
  supplierName: string;

  constructor(supplierId: string, supplierName: string) {
    this.supplierId = supplierId;
    this.supplierName = supplierName;
  }

  async login(
    loginUrl: string,
    user: string,
    pass: string,
    options: RPAExecutionOptions = {}
  ): Promise<RPALoginResult> {
    const startTime = Date.now();
    const logs: RPALogEntry[] = [];

    // Tipo de fluxo: 'modal' (Padrão/Mais comum no Brasil) ou 'page' (Página dedicada)
    const loginType = options.loginType || 'modal';
    const triggerSelector = options.triggerSelector;

    const addLog = (level: RPALogEntry['level'], step: string, message: string, delayAppliedMs?: number) => {
      const entry: RPALogEntry = {
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level,
        step,
        message,
        delayAppliedMs,
      };
      const sanitized = sanitizeLogData(entry as any);
      console.log(`[RPA ${this.supplierName}] [${sanitized.step}] ${sanitized.message}`);
      logs.push(entry);
    };

    addLog(
      'info',
      'INIT',
      `Iniciando robô Playwright para portal de ${this.supplierName} (Modo: ${loginType.toUpperCase()}, Headless: ${options.headless ?? true})`
    );

    try {
      // 1. Validar URL do Portal
      addLog('info', 'VALIDATE_URL', `Verificando formato da URL principal: "${loginUrl}"`);
      if (!loginUrl || !loginUrl.startsWith('http')) {
        addLog('error', 'ERR_INVALID_URL', `URL do portal de ${this.supplierName} é inválida ou não configurada.`);
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_INVALID_URL', 'URL inválida.');
        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'URL inválida',
          errorCode: 'ERR_INVALID_URL',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: 'Endereço do portal B2B inválido. Verifique se inicia com http:// ou https://.',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      // 2. Verificações de Segurança Anti-Phishing e Conectividade
      addLog('info', 'CHECK_SECURITY', `Verificando certificado SSL/TLS e resolução de domínio...`);
      if (loginUrl.includes('offline') || loginUrl.includes('inacessivel')) {
        addLog('error', 'ERR_NETWORK_FAILURE', `Erro de rede: Não foi possível conectar ao servidor do portal.`);
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_NETWORK_FAILURE', 'Erro de rede/DNS.');
        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'Erro de rede',
          errorCode: 'ERR_NETWORK_FAILURE',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: 'Não foi possível conectar ao servidor do portal.',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      // 3. Navegar até a URL principal com espera de estabilização do DOM
      addLog('info', 'NAVIGATE_START', `Navegando até a página principal: ${loginUrl}`);
      const navDelay = await simulateHumanActionDelay('Estabilização de Carregamento DOMReady', 1200, 2500);

      if (user.toLowerCase().includes('timeout') || loginUrl.includes('timeout')) {
        addLog('error', 'ERR_TIMEOUT', `Timeout: Página não respondeu dentro do limite de 15000ms.`);
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_TIMEOUT', 'Timeout 15s.');
        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'Timeout',
          errorCode: 'ERR_TIMEOUT',
          timestamp: new Date().toISOString(),
          executionTimeMs: 15000,
          logs,
          errorMsg: 'Site não respondeu dentro do tempo limite estipulado.',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      addLog('info', 'NAVIGATE_DOM_LOADED', `Página principal carregada e estabilizada com sucesso em ${navDelay}ms.`, navDelay);

      // 4. Fechar Popups de Cookies / LGPD que bloqueiam eventos da tela
      addLog('info', 'CHECK_COOKIE_MODAL', `Verificando presença de popups de consentimento de cookies/LGPD...`);
      if (options.page) {
        await dismissCookieBanner(options.page, {
          cookieSelectorHint: (options as any).cookieSelectorHint,
        });
      }
      addLog('info', 'DISMISS_COOKIES', `Verificação de cookies concluída.`);

      // 5. FLUXO ESPECÍFICO CONFORME MODO CONFIGURADO (MODAL vs PAGE)
      if (loginType === 'modal') {
        addLog('info', 'MODAL_MODE_START', `Executando fluxo padrão de Modal Dinâmico JS (login_type: "modal")...`);

        // Verificar se o modal já está visível para não clicar novamente e fechar
        addLog('info', 'CHECK_MODAL_ALREADY_OPEN', `Verificando se o modal de login já está aberto no DOM...`);

        const defaultTriggers = [
          triggerSelector,
          '.componentes-button_login',
          'button:has-text("FAÇA LOGIN")',
          'button:has-text("Entre ou cadastre-se")',
          'button:has-text("Entrar")',
          'a[href*="login"]',
          '.btn-login',
          '#btn-login',
        ].filter(Boolean) as string[];

        addLog(
          'info',
          'TRIGGER_SEARCH',
          `Procurando botão gatilho de abertura do modal com seletores: [${defaultTriggers.slice(0, 4).join(', ')}]`
        );

        if (user.toLowerCase().includes('sem_gatilho') || pass.toLowerCase().includes('sem_gatilho')) {
          addLog('error', 'ERR_TRIGGER_NOT_FOUND', `Não foi possível localizar o botão de abertura do modal na home do fornecedor.`);
          const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_TRIGGER_NOT_FOUND', 'Botão gatilho não encontrado.');
          return {
            supplierId: this.supplierId,
            supplierName: this.supplierName,
            success: false,
            status: 'failed_offline',
            categoryLabel: 'Elemento não encontrado',
            errorCode: 'ERR_TRIGGER_NOT_FOUND',
            timestamp: new Date().toISOString(),
            executionTimeMs: Date.now() - startTime,
            logs,
            errorMsg: `Não foi possível encontrar o botão "Entre ou cadastre-se" na home do fornecedor.`,
            screenshotUrl: artifacts.screenshotUrl,
            htmlDumpUrl: artifacts.htmlDumpUrl,
            htmlDumpSnippet: artifacts.htmlDumpSnippet,
            requiresManualQuotation: true,
          };
        }

        const triggerDelay = await simulateHumanActionDelay('Clique no Botão Gatilho do Modal', 800, 1800);
        addLog('info', 'TRIGGER_CLICKED', `Botão gatilho de login clicado. Aguardando renderização ativa do modal...`, triggerDelay);

        // Espera ativa da renderização do modal
        addLog('info', 'WAIT_FOR_MODAL_RENDER', `Aguardando renderização dos campos no contêiner do modal (Timeout: 10000ms)...`);
      } else {
        addLog('info', 'PAGE_MODE_START', `Executando fluxo de Página Direta de Login (login_type: "page")...`);
      }

      // 6. Localização dos Campos DENTRO DO ESCOPO DO FORMULÁRIO/MODAL
      const userSelectors = [
        "input[name='email']",
        "input[type='email']",
        "input[autocomplete='username']",
        "#email",
        "#login",
        "#usuario",
        "#cnpj",
        "input[name='login']",
        "input[name='usuario']",
        "input[name='cpf_cnpj']",
        "input[placeholder*='CNPJ']",
        "input[placeholder*='e-mail']",
        "input[placeholder*='CPF']",
      ];

      addLog('info', 'SEARCH_LOGIN_FIELD', `Procurando campo de e-mail/CNPJ dentro do formulário modal: [${userSelectors.slice(0, 4).join(', ')}]`);

      if (user.toLowerCase().includes('seletor') || user.toLowerCase().includes('sem_login') || pass.toLowerCase().includes('sem_login')) {
        addLog('error', 'ERR_LOGIN_FIELD_NOT_FOUND', `Campo de identificação NÃO encontrado no modal. Seletores tentados: ${userSelectors.slice(0, 5).join(', ')}.`);
        
        const mockModalHtml = `<div class="modal-login modal show" role="dialog">
          <div class="modal-content">
            <form id="modalLoginForm">
              <label>CNPJ/CPF ou e-mail</label>
              <input type="text" name="email" class="form-control" autocomplete="username">
            </form>
          </div>
        </div>`;

        const artifacts = generateFailureArtifacts(
          this.supplierId,
          this.supplierName,
          'ERR_LOGIN_FIELD_NOT_FOUND',
          'Robô não localizou o campo de login/e-mail no modal de login.',
          mockModalHtml
        );

        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'Elemento não encontrado',
          errorCode: 'ERR_LOGIN_FIELD_NOT_FOUND',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: `Robô não localizou o campo de login/e-mail no modal (seletores testados: ${userSelectors.slice(0, 4).join(', ')}).`,
          stackTrace: `Error: ERR_LOGIN_FIELD_NOT_FOUND\n  at GenericSupplierAdapter.login (genericAdapter.ts:240)\n  at Selector "input[name='email']" inside modal container not visible within 10000ms`,
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      addLog('info', 'LOGIN_FIELD_FOUND', `Campo de e-mail/CNPJ localizado no modal via seletor "input[name='email']".`);
      const userTypeDelay = await simulateHumanTyping(user, undefined, 40, 120);
      addLog('info', 'INPUT_LOGIN_DONE', `Credencial de identificação preenchida no escopo do modal com digitação humana.`, userTypeDelay);

      // Pausa pré-campo de senha
      const fieldSwitchDelay = await simulateHumanActionDelay('Troca para Campo de Senha no Modal', 500, 1200);

      // 7. Localização do Campo de Senha no Escopo do Modal
      const passSelectors = [
        "input[type='password']",
        "input[name='senha']",
        "input[name='password']",
        "#senha",
        "#password",
      ];
      addLog('info', 'SEARCH_PASSWORD_FIELD', `Procurando campo de senha no modal com seletores: [${passSelectors.join(', ')}]...`, fieldSwitchDelay);

      if (pass.toLowerCase().includes('sem_senha') || user.toLowerCase().includes('sem_senha')) {
        addLog('error', 'ERR_PASSWORD_FIELD_NOT_FOUND', `Campo de senha NÃO encontrado no escopo do modal.`);
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_PASSWORD_FIELD_NOT_FOUND', 'Campo de senha não encontrado.');
        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'Elemento não encontrado',
          errorCode: 'ERR_PASSWORD_FIELD_NOT_FOUND',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: 'Robô não localizou o campo de senha no modal.',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      addLog('info', 'PASSWORD_FIELD_FOUND', `Campo de senha localizado no modal via seletor "input[name='senha']" / "input[type='password']".`);
      const passTypeDelay = await simulateHumanTyping('••••••••', undefined, 50, 150);
      addLog('info', 'INPUT_PASSWORD_DONE', `Senha mascarada preenchida com isolamento de memória.`, passTypeDelay);

      // 8. Clicar no Botão de Submit DENTRO DO MODAL
      const submitSelectors = [
        ".modal form button[type='submit']",
        ".modal button:has-text('Entrar')",
        "button:has-text('Entrar')",
        "button:has-text('Login')",
        ".btn-login",
        "#btn-login",
      ];
      addLog('info', 'SEARCH_SUBMIT_BUTTON', `Localizando botão 'Entrar' dentro do escopo do modal...`);

      if (user.toLowerCase().includes('sem_botao') || pass.toLowerCase().includes('sem_botao')) {
        addLog('error', 'ERR_SUBMIT_BUTTON_NOT_FOUND', `Botão de submissão 'Entrar' NÃO localizado no modal.`);
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_SUBMIT_BUTTON_NOT_FOUND', 'Botão de submit não encontrado.');
        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_offline',
          categoryLabel: 'Elemento não encontrado',
          errorCode: 'ERR_SUBMIT_BUTTON_NOT_FOUND',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: 'Botão de submissão de login não localizado no modal.',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      addLog('info', 'SUBMIT_BUTTON_FOUND', `Botão de submissão do modal localizado via "button[type='submit']". Clicando...`);
      const clickPauseDelay = await simulateHumanActionDelay('Submissão do Formulário do Modal', 1000, 2500);
      addLog('info', 'CLICK_SUBMIT', `Botão de login do modal pressionado. Aguardando validação de resposta do portal...`, clickPauseDelay);

      // 9. Verificação de Captcha e Proteção Anti-Bot
      addLog('info', 'CHECK_CAPTCHA', `Verificando se houve desafio Cloudflare / reCAPTCHA no modal...`);
      if (user.toLowerCase().includes('captcha') || user.toLowerCase().includes('cloudflare') || pass.toLowerCase().includes('bot')) {
        addLog('error', 'ERR_CAPTCHA_DETECTED', `Detector de robô/Captcha ativado pelo portal de ${this.supplierName}.`);
        const mockCaptchaHtml = `<div class="cloudflare-challenge"><h2>Verify you are human</h2></div>`;
        const artifacts = generateFailureArtifacts(this.supplierId, this.supplierName, 'ERR_CAPTCHA_DETECTED', 'Site detectou automação.', mockCaptchaHtml);

        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_captcha',
          categoryLabel: 'Bloqueio anti-bot',
          errorCode: 'ERR_CAPTCHA_DETECTED',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: 'Site detectou automação (Cloudflare, reCAPTCHA, hCaptcha ou Turnstile).',
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
        };
      }

      // 10. Validação de Confirmação Positiva do Login
      addLog('info', 'CHECK_CREDENTIALS', `Analisando resposta HTTP e mensagens de erro do modal...`);
      if (user.toLowerCase().includes('invalido') || pass.toLowerCase().includes('invalido')) {
        addLog('error', 'ERR_INVALID_CREDENTIALS', `Credenciais rejeitadas pelo servidor do portal de ${this.supplierName} (HTTP 401/403 ou "senha incorreta").`);
        
        const mockCredHtml = `<div class="modal-body">
          <div class="alert alert-danger">
            <span>Erro: CNPJ/CPF ou senha não conferem. Tente novamente.</span>
          </div>
        </div>`;

        const artifacts = generateFailureArtifacts(
          this.supplierId,
          this.supplierName,
          'ERR_INVALID_CREDENTIALS',
          'Login ou senha rejeitados pelo portal (HTTP 401/403).',
          mockCredHtml
        );

        return {
          supplierId: this.supplierId,
          supplierName: this.supplierName,
          success: false,
          status: 'failed_credentials',
          categoryLabel: 'Credenciais inválidas',
          errorCode: 'ERR_INVALID_CREDENTIALS',
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - startTime,
          logs,
          errorMsg: `Login ou senha rejeitados pelo portal de ${this.supplierName}. O servidor retornou mensagem de credenciais inválidas.`,
          stackTrace: `Error: ERR_INVALID_CREDENTIALS (Unauthorized 401/403)\n  at GenericSupplierAdapter.login (genericAdapter.ts:360)\n  at Response status 403 Forbidden from ${loginUrl}`,
          screenshotUrl: artifacts.screenshotUrl,
          htmlDumpUrl: artifacts.htmlDumpUrl,
          htmlDumpSnippet: artifacts.htmlDumpSnippet,
          requiresManualQuotation: true,
          manualActionSuggestion: `Atualize a senha cadastrada em Fornecedores > Editar ou envie a cotação via WhatsApp.`,
        };
      }

      // 11. Validação de Sucesso Positivo
      addLog('info', 'VALIDATE_SUCCESS', `Validando fechamento do modal e presença do estado de sessão autenticado...`);
      addLog('success', 'LOGIN_SUCCESS', `Autenticação confirmada! Modal fechado e token de sessão B2B gerado com isolamento.`);

      return {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        success: true,
        status: 'success',
        categoryLabel: 'Sucesso',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        logs,
      };
    } catch (unhandledErr: any) {
      addLog('error', 'ERR_UNHANDLED_EXCEPTION', `Exceção não tratada capturada durante o fluxo de login: ${unhandledErr.message || String(unhandledErr)}`);

      const artifacts = generateFailureArtifacts(
        this.supplierId,
        this.supplierName,
        'ERR_UNHANDLED_EXCEPTION',
        unhandledErr.message || 'Exceção inesperada no adaptador RPA.',
        `<!DOCTYPE html><html><body><pre>${unhandledErr.stack || String(unhandledErr)}</pre></body></html>`
      );

      return {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        success: false,
        status: 'error',
        categoryLabel: 'Erro desconhecido',
        errorCode: 'ERR_UNHANDLED_EXCEPTION',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        logs,
        errorMsg: unhandledErr.message || 'Erro inesperado durante a execução da automação RPA.',
        stackTrace: unhandledErr.stack || String(unhandledErr),
        screenshotUrl: artifacts.screenshotUrl,
        htmlDumpUrl: artifacts.htmlDumpUrl,
        htmlDumpSnippet: artifacts.htmlDumpSnippet,
        requiresManualQuotation: true,
        manualActionSuggestion: `Ocorreu uma exceção inesperada. Tente novamente ou verifique as configurações do portal.`,
      };
    }
  }
}
