import crypto from 'crypto';

// Chave secreta de 256 bits derivada prioritariamente da variável de ambiente ENCRYPTION_KEY
const VAULT_SECRET =
  process.env.ENCRYPTION_KEY ||
  process.env.VAULT_SECRET ||
  'saracota_vault_master_key_aes256_32bytes_secret';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

// Garantir chave de exatamente 32 bytes (256 bits)
function getDerivedKey(): Buffer {
  return crypto.createHash('sha256').update(VAULT_SECRET).digest();
}

/**
 * Criptografa texto puro usando AES-256-CBC com IV randômico
 */
export function encryptAES256(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getDerivedKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Formato armazenado: iv_hex:encrypted_hex
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Erro ao criptografar no Vault AES-256:', error);
    return `enc_sec_${Date.now()}_${btoa(text)}`;
  }
}

/**
 * Descriptografa texto usando AES-256-CBC
 */
export function decryptAES256(encryptedData: string): string {
  if (!encryptedData) return '';
  try {
    // Tratar fallback legados btoa enc_sec_
    if (encryptedData.startsWith('enc_sec_')) {
      const parts = encryptedData.split('_');
      const encoded = parts[parts.length - 1];
      return atob(encoded);
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 2) return encryptedData;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar no Vault AES-256:', error);
    return '[DESCRIPTOGRAFIA_FALHOU]';
  }
}

/**
 * Mascara qualquer dado sensível para exibição em telas ou APIs públicas
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '';
  return '••••••••';
}

/**
 * Sanitiza objetos de log eliminando senhas e dados sensíveis antes do log no console
 */
export function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['senha', 'password', 'secret', 'token', 'login_salvo', 'senhaCriptografada'];
  const sanitized: Record<string, any> = {};

  for (const key of Object.keys(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitizeLogData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
}
