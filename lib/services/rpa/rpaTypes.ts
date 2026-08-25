/**
 * Tipos e Interfaces da Arquitetura RPA do Sara Cota
 */

export type RPASessionStatus = 
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'navigating'
  | 'success'
  | 'failed_credentials'
  | 'failed_offline'
  | 'failed_captcha'
  | 'error';

export interface RPALogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  step: string;
  message: string;
  delayAppliedMs?: number;
}

export interface RPALoginResult {
  supplierId: string;
  supplierName: string;
  success: boolean;
  status: RPASessionStatus;
  executionTimeMs: number;
  logs: RPALogEntry[];
  errorMsg?: string;
  errorCode?: string;
  categoryLabel?: 'Sucesso' | 'Timeout' | 'Credenciais inválidas' | 'Elemento não encontrado' | 'Bloqueio anti-bot' | 'Erro de rede' | 'URL inválida' | 'Erro desconhecido';
  timestamp?: string;
  stackTrace?: string;
  screenshotUrl?: string;
  htmlDumpUrl?: string;
  htmlDumpSnippet?: string;
  requiresManualQuotation?: boolean;
  manualActionSuggestion?: string;
}

export interface RPAExecutionOptions {
  headless?: boolean;
  minCharacterDelayMs?: number;
  maxCharacterDelayMs?: number;
  actionDelayMinMs?: number;
  actionDelayMaxMs?: number;
  timeoutMs?: number;
  loginType?: 'modal' | 'page';
  triggerSelector?: string;
  modalSelector?: string;
  seletores?: Record<string, string> | null;
  page?: any;
}

export interface IFornecedorAdapter {
  supplierId: string;
  supplierName: string;
  login(loginUrl: string, user: string, pass: string, options?: RPAExecutionOptions): Promise<RPALoginResult>;
}
