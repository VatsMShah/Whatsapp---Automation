/**
 * Sensitive PII Masking Utilities
 * Masks customer phone numbers, contact names, and email addresses so only the
 * first 2 characters/digits are visible, with the remaining characters masked.
 */

/**
 * Masks a phone number to reveal only the first 2 digits of the local number.
 * Preserves country code prefixes (+91).
 *
 * Examples:
 *   "+91 72086 72150" -> "+91 72••••••••"
 *   "9820500159"      -> "+91 98••••••••"
 *   "7208672150"      -> "+91 72••••••••"
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  const trimmed = String(phone).trim();
  if (!trimmed) return '—';

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length < 3) return trimmed;

  // Extract core 10 digits and optional country code
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

/**
 * Masks a contact person's name so only the first 2 characters/letters are visible.
 * Handles phone numbers entered as names seamlessly.
 *
 * Examples:
 *   "Jhatu"            -> "Jh•••"
 *   "Baraiya nirubhai" -> "Ba••••••••••••••"
 *   "Chetan lodaya"    -> "Ch•••••••••••"
 *   "8879774616"       -> "88••••••••"
 *   "Al"               -> "Al"
 */
export function maskName(name?: string | null): string {
  if (!name) return '—';
  const trimmed = String(name).trim();
  if (!trimmed) return '—';

  if (trimmed.length <= 2) return trimmed;

  const visible = trimmed.slice(0, 2);
  const maskedLength = trimmed.length - 2;
  const masked = '•'.repeat(maskedLength);

  return `${visible}${masked}`;
}

/**
 * Masks an email address to reveal only the first 2 letters of the local user part,
 * preserving the @domain.com format.
 *
 * Examples:
 *   "mukesh.ambani@reliance.com" -> "mu••••••••••@reliance.com"
 *   "support@traket.in"          -> "su•••••@traket.in"
 */
export function maskEmail(email?: string | null): string {
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
