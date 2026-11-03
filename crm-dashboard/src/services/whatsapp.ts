export const WHATSAPP_ACCESS_TOKEN =
  import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN ||
  'EAAZAZB0gvhrGUBSDVyHhhTgWJYVAE0F8kTOSGAFLFyLtTwYGcgDczYSxySO2XlIZAAkXKYQP0mOqYKLpyZAE2Jn0pTWOfZAHNaS3Ki0Hq8QHfUi5af4C1RucZCiTmRaPohqvVy6jlfqkZBxCsHOBYCbUMlcLBqNIdB4DYFpCBH5BMXJbE0ydYJxw6Ht7oj0PiM8qAZDZD';

export const WHATSAPP_PHONE_NUMBER_ID =
  import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || '1240163099173755';

export const SUPPORT_PHONE_DISPLAY = '+91 9820500159';

/**
 * Send WhatsApp plain text message directly via Meta Cloud API from official Traket number
 */
export async function sendWhatsAppNudge(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const recipient = cleanTo.length === 10 ? `91${cleanTo}` : cleanTo;

    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage = data?.error?.message || `Meta API error (${res.status})`;
      console.error('Meta API error sending text message:', data);
      return { success: false, error: errorMessage };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('Network error sending WhatsApp text message:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Send WhatsApp Interactive Quick-Reply Buttons message via Meta Cloud API
 */
export async function sendWhatsAppInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const recipient = cleanTo.length === 10 ? `91${cleanTo}` : cleanTo;

    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({
              type: 'reply',
              reply: {
                id: b.id,
                title: b.title.slice(0, 20), // Meta limit: 20 chars max
              },
            })),
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage = data?.error?.message || `Meta API error (${res.status})`;
      console.error('Meta API error sending interactive buttons:', data);
      return { success: false, error: errorMessage };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('Network error sending WhatsApp buttons:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Formats state string into a human readable label
 */
export function formatStateLabel(state?: string): string {
  if (!state) return 'Cargo Selection';
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Stage 1 Message: Half-way progress reminder customized according to the step
 */
export function getReminder1Text(state?: string): string {
  const stepLabel = formatStateLabel(state);
  return (
    `👋 *Hello from Traket Transport!* 🚛\n\n` +
    `We noticed you started your freight booking on WhatsApp but paused midway at *Step: ${stepLabel}*.\n\n` +
    `📦 *Your progress is saved:* We have your details on file so you don't have to start over!\n\n` +
    `👉 Simply reply to this message to continue right where you left off, or type *Hi* to restart.`
  );
}

/**
 * Stage 2 Message: High attention-grabbing urgency reminder
 */
export function getReminder2Text(): string {
  return (
    `⚡ *URGENT NOTICE: High Transport Demand on Your Route!* 🚛\n\n` +
    `⚠️ Available verified trucks for your route are filling up quickly today. Don't risk dispatch delays or higher spot freight rates.\n\n` +
    `🔒 We are temporarily holding your draft vehicle reservation slot.\n\n` +
    `👉 *Reply now to this message* to lock in your transport and get instant live truck placement!`
  );
}

/**
 * Stage 3 Message: Final 24h notice with interactive Support Call option button
 */
export function getReminder3Text(): string {
  return (
    `🚨 *FINAL NOTICE: Your 24-Hour Priority Booking Window is Closing!* ⏰\n\n` +
    `Our senior operations team noticed your booking was left incomplete. We are ready to place your vehicle immediately or assist with custom freight pricing.\n\n` +
    `👉 *Tap '📞 Call Support' below* for immediate assistance (+91 9820500159), or tap *'💬 Continue Order'*:*`
  );
}

export const REMINDER_3_BUTTONS = [
  { id: 'reminder_call_support', title: '📞 Call Support' },
  { id: 'reminder_continue', title: '💬 Continue Order' },
  { id: 'cta_new', title: '🔄 Start Fresh' },
];

/**
 * Unified sender for Reminder Stages 1, 2, or 3
 */
export async function sendReminderStage(
  phone: string,
  stage: 1 | 2 | 3,
  state?: string,
  customMessage?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (stage === 1) {
    const text = customMessage || getReminder1Text(state);
    return sendWhatsAppNudge(phone, text);
  }

  if (stage === 2) {
    const text = customMessage || getReminder2Text();
    return sendWhatsAppNudge(phone, text);
  }

  if (stage === 3) {
    const text = customMessage || getReminder3Text();
    return sendWhatsAppInteractiveButtons(phone, text, REMINDER_3_BUTTONS);
  }

  return { success: false, error: 'Unknown reminder stage' };
}
