/**
 * Sensitive PII Masking Utilities
 * Masks customer phone numbers, contact names, and email addresses so only the
 * first 2 characters/digits are visible, with the remaining characters masked.
 */

function maskPhone(phone) {
  if (!phone) return '—';
  const trimmed = String(phone).trim();
  if (!trimmed) return '—';

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length < 3) return trimmed;

  let prefix = '+91 ';
  let core = cleanDigits;

  if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
    prefix = '+91 ';
    core = cleanDigits.slice(2);
  } else if (cleanDigits.length > 10) {
    const extra = cleanDigits.length - 10;
    prefix = `+${cleanDigits.slice(0, extra)} `;
    core = cleanDigits.slice(extra);
  }

  const visible = core.slice(0, 2);
  const maskedLength = Math.max(core.length - 2, 8);
  const masked = '•'.repeat(maskedLength);

  return `${prefix}${visible}${masked}`;
}

function maskName(name) {
  if (!name) return '—';
  const trimmed = String(name).trim();
  if (!trimmed) return '—';

  if (trimmed.length <= 2) return trimmed;

  const visible = trimmed.slice(0, 2);
  const maskedLength = trimmed.length - 2;
  const masked = '•'.repeat(maskedLength);

  return `${visible}${masked}`;
}

function maskEmail(email) {
  if (!email) return '—';
  const trimmed = String(email).trim();
  if (!trimmed) return '—';

  if (!trimmed.includes('@')) {
    return maskName(trimmed);
  }

  const [user, domain] = trimmed.split('@');
  if (!user || user.length <= 2) {
    return `${user}@${domain || ''}`;
  }

  const visible = user.slice(0, 2);
  const masked = '•'.repeat(user.length - 2);

  return `${visible}${masked}@${domain}`;
}

module.exports = {
  maskPhone,
  maskName,
  maskEmail,
};
