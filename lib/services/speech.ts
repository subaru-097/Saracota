/**
 * Serviço de Reconhecimento de Voz (Speech-to-Text) usando Web Speech API nativa dos navegadores.
 * Compatível com Chrome, Safari, Android, iOS e Edge.
 */

export interface SpeechRecognitionResultHandler {
  onResult: (text: string) => void;
  onError: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class BrowserSpeechService {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'pt-BR';
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public startListening(handlers: SpeechRecognitionResultHandler): boolean {
    if (!this.recognition) {
      handlers.onError('Reconhecimento de voz não é suportado neste navegador. Use a digitação manual.');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      if (handlers.onStart) handlers.onStart();
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript && transcript.trim()) {
        handlers.onResult(transcript.trim());
      } else {
        handlers.onError('Nenhum texto reconhecido no áudio.');
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      console.warn('Erro SpeechRecognition:', event.error);
      let errorMsg = 'Falha ao reconhecer áudio.';
      if (event.error === 'no-speech') {
        errorMsg = 'Nenhuma fala foi detectada. Tente falar novamente mais próximo ao microfone.';
      } else if (event.error === 'not-allowed') {
        errorMsg = 'Permissão de microfone negada. Autorize o microfone no navegador.';
      }
      handlers.onError(errorMsg);
      if (handlers.onEnd) handlers.onEnd();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (handlers.onEnd) handlers.onEnd();
    };

    try {
      this.recognition.start();
      return true;
    } catch (e: any) {
      console.error('Erro ao iniciar reconhecimento de voz:', e);
      handlers.onError('Não foi possível ativar o microfone.');
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore stop error if already stopped
      }
      this.isListening = false;
    }
  }
}

export const speechService = new BrowserSpeechService();
