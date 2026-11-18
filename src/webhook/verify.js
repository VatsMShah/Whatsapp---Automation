const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Checks if the configured App Secret is a valid, real secret and not an unconfigured placeholder.
 */
function isConfiguredSecret(secret) {
  if (!secret || typeof secret !== 'string') return false;
  const s = secret.trim().toLowerCase();
  return s.length > 0 && !s.startsWith('your_') && s !== 'placeholder' && s !== 'change_me';
}

/**
 * Handles Meta's webhook verification handshake.
 * GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * Meta calls this once when you save the webhook URL in the App Dashboard.
 */
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verification succeeded');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, tokenProvided: Boolean(token) });
  return res.sendStatus(403);
}

/**
 * Validates the X-Hub-Signature-256 header Meta sends on every webhook POST.
 * This proves the request actually came from Meta and not a spoofed source.
 *
 * If WHATSAPP_APP_SECRET is a placeholder (e.g. 'your_meta_app_secret'), it
 * gracefully falls back to accepting messages while logging a warning,
 * matching Supabase Edge Function behavior and preventing inbound message drops.
 * Once the real App Secret is set in .env, strict HMAC-SHA256 is enforced.
 */
function isValidSignature(rawBody, signatureHeader, overrideSecret) {
  const secret = (overrideSecret !== undefined ? overrideSecret : config.whatsapp?.appSecret || '').trim();
  const strictMode = process.env.WHATSAPP_STRICT_SIGNATURE === 'true';

  if (!isConfiguredSecret(secret)) {
    if (strictMode) {
      logger.error('WHATSAPP_STRICT_SIGNATURE is enabled but WHATSAPP_APP_SECRET is a placeholder — rejecting webhook');
      return false;
    }
    // Safe dev/fallback mode (matches Supabase edge function behavior):
    // Do NOT drop incoming customer messages when app secret is still the placeholder.
    logger.warn('WHATSAPP_APP_SECRET is a placeholder. Bypassing HMAC verification in fallback mode so inbound customer chats are NOT dropped. To enable strict cryptographic verification, set your real Meta App Secret in .env.');
    return true;
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    logger.warn('Webhook rejected — missing X-Hub-Signature-256 header');
    return false;
  }

  try {
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(rawBody || '')
      .digest('hex');

    const expectedSignature = `sha256=${expectedHash}`;

    // timingSafeEqual requires equal-length buffers
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    logger.error('Error computing webhook signature:', err);
    return false;
  }
}

module.exports = { handleVerification, isValidSignature, isConfiguredSecret };
