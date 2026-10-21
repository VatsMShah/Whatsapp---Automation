export const WHATSAPP_ACCESS_TOKEN =
  import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN ||
  'EAAZAZB0gvhrGUBSDVyHhhTgWJYVAE0F8kTOSGAFLFyLtTwYGcgDczYSxySO2XlIZAAkXKYQP0mOqYKLpyZAE2Jn0pTWOfZAHNaS3Ki0Hq8QHfUi5af4C1RucZCiTmRaPohqvVy6jlfqkZBxCsHOBYCbUMlcLBqNIdB4DYFpCBH5BMXJbE0ydYJxw6Ht7oj0PiM8qAZDZD';

export const WHATSAPP_PHONE_NUMBER_ID =
  import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || '1240163099173755';

/**
 * Send WhatsApp text message (Nudge) directly via Meta Cloud API from official Traket number
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
      console.error('Meta API error sending nudge:', data);
      return { success: false, error: errorMessage };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('Network error sending WhatsApp nudge:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}
