const config = require('../config');
const logger = require('../utils/logger');

function graphUrl() {
  return `https://graph.facebook.com/${config.whatsapp.graphApiVersion}/${config.whatsapp.phoneNumberId}/messages`;
}

function cleanRecipient(to) {
  const digits = String(to || '').replace(/[^0-9]/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function callGraphApi(body) {
  if (body?.to) {
    body.to = cleanRecipient(body.to);
  }

  const res = await fetch(graphUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error('WhatsApp Graph API call failed', { status: res.status, data });
    throw new Error(`WhatsApp API error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Equivalent of the n8n "Send message1-summary" WhatsApp node —
 * sends a plain text reply.
 */
async function sendText(to, text) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

/**
 * Equivalent of the n8n "HTTP Request" node — sends the 3-button
 * interactive CTA menu shown after a flow completes (state === "cta_menu").
 */
async function sendCtaButtons(to) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: '👉 What would you like to do next?' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'cta_new', title: 'Post New Order' } },
          { type: 'reply', reply: { id: 'cta_ai', title: 'Know About Traket' } },
          { type: 'reply', reply: { id: 'cta_support', title: 'Support' } },
        ],
      },
    },
  });
}

/**
 * Sends a native WhatsApp Flow with in-app DatePicker calendar.
 */
async function sendFlowDatePicker(to, flowId, minDate) {
  const today = minDate || new Date().toISOString().split('T')[0];
  return callGraphApi({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: '📅 Loading Date',
      },
      body: {
        text: 'Tap below to open the calendar and choose your vehicle loading date:',
      },
      footer: {
        text: 'Traket Transport',
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: `flow_${to}_${Date.now()}`,
          flow_id: flowId,
          flow_cta: '📅 Select Date',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'DATE_SELECTION',
            data: {
              min_date: today,
            },
          },
        },
      },
    },
  });
}

/**
 * Sends interactive quick-reply buttons (up to 3 buttons)
 */
async function sendInteractiveButtons(to, bodyText, buttons) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Sends a 3-button interactive reminder message with Direct Call to Support
 */
async function sendSupportReminderButtons(to, bodyText) {
  return sendInteractiveButtons(to, bodyText, [
    { id: 'reminder_call_support', title: '📞 Call Support' },
    { id: 'reminder_continue', title: '💬 Continue Order' },
    { id: 'cta_new', title: '🔄 Start Fresh' },
  ]);
}

module.exports = {
  sendText,
  sendCtaButtons,
  sendFlowDatePicker,
  sendInteractiveButtons,
  sendSupportReminderButtons,
};
