/**
 * Utilitários para formatação, validação e geração de links diretos do WhatsApp.
 */

export function cleanPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatPhoneMask(val: string): string {
  const digits = cleanPhoneDigits(val);
  if (!digits) return '';

  // Se o usuário digitou sem 55, adicionar ou formatar localmente
  let d = digits;
  if (d.startsWith('55') && d.length > 10) {
    d = d.substring(2);
  }

  if (d.length <= 2) {
    return `(${d}`;
  }
  if (d.length <= 7) {
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function validatePhone(phone: string): { valid: boolean; formatted: string; digits: string; errorMsg?: string } {
  const digits = cleanPhoneDigits(phone);
  if (!digits) {
    return { valid: true, formatted: '', digits: '' }; // Campo é opcional
  }

  // Se tiver 55 no início e mais de 10 dígitos, normalizar
  let norm = digits;
  if (norm.startsWith('55') && norm.length >= 12) {
    norm = norm.substring(2);
  }

  // DDD (2 dígitos) + Número (8 ou 9 dígitos) -> 10 ou 11 dígitos totais
  if (norm.length < 10 || norm.length > 11) {
    return {
      valid: false,
      formatted: formatPhoneMask(phone),
      digits: norm,
      errorMsg: 'O telefone deve conter DDD válido (2 dígitos) e número com 8 ou 9 dígitos.',
    };
  }

  const ddd = parseInt(norm.substring(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return {
      valid: false,
      formatted: formatPhoneMask(phone),
      digits: norm,
      errorMsg: 'DDD inválido. Informe um DDD brasileiro válido (ex: 11, 21, 31).',
    };
  }

  const fullWithCountryCode = `55${norm}`;
  return {
    valid: true,
    formatted: formatPhoneMask(norm),
    digits: fullWithCountryCode,
  };
}

export function generateWhatsAppLink(phone: string, message: string = 'Quero negociar essa cotação.'): string {
  const { digits } = validatePhone(phone);
  const targetNumber = digits.startsWith('55') ? digits : `55${digits}`;
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${targetNumber}?text=${encodedText}`;
}
