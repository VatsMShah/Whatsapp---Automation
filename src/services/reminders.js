const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const whatsapp = require('./whatsapp');
const db = require('./supabase');

const REMINDER_STORAGE_FILE = path.join(__dirname, '../../scratch/reminder_logs.json');

// Ensure scratch directory exists
try {
  const dir = path.dirname(REMINDER_STORAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
} catch (e) {
  // ignore
}

function loadReminderLogs() {
  try {
    if (fs.existsSync(REMINDER_STORAGE_FILE)) {
      const data = fs.readFileSync(REMINDER_STORAGE_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (e) {
    logger.warn('Failed reading reminder logs from file', e.message);
  }
  return {};
}

function saveReminderLogs(logs) {
  try {
    fs.writeFileSync(REMINDER_STORAGE_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    logger.warn('Failed writing reminder logs to file', e.message);
  }
}

function formatStateLabel(state) {
  if (!state) return 'Cargo Selection';
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Stage 1 Reminder: Helpful half-way reminder tailored to where customer stopped
 */
function getReminder1Message(session) {
  const stepLabel = formatStateLabel(session.state);
  return (
    `👋 *Hello from Traket Transport!* 🚛\n\n` +
    `We noticed you started your freight booking on WhatsApp but paused midway at *Step: ${stepLabel}*.\n\n` +
    `📦 *Your progress is saved:* We have your details on file so you don't have to start over!\n\n` +
    `👉 Simply reply to this message to continue right where you left off, or type *Hi* to restart.`
  );
}

/**
 * Stage 2 Reminder: High attention-grabbing urgency reminder
 */
function getReminder2Message(session) {
  return (
    `⚡ *URGENT NOTICE: High Transport Demand on Your Route!* 🚛\n\n` +
    `⚠️ Available verified trucks for your route are filling up quickly today. Don't risk dispatch delays or higher spot freight rates.\n\n` +
    `🔒 We are temporarily holding your draft vehicle reservation slot.\n\n` +
    `👉 *Reply now to this message* to lock in your transport and get instant live truck placement!`
  );
}

/**
 * Stage 3 Reminder: Final 24h notice with interactive Support Call option button
 */
function getReminder3Message(session) {
  return (
    `🚨 *FINAL NOTICE: Your 24-Hour Priority Booking Window is Closing!* ⏰\n\n` +
    `Our senior operations team noticed your booking was left incomplete. We are ready to place your vehicle immediately or assist with custom freight pricing.\n\n` +
    `👉 *Tap '📞 Call Support' below* for immediate assistance (+91 9820500159), or tap *'💬 Continue Order'*:*`
  );
}

/**
 * Send a specific reminder stage to a recipient
 * @param {object} session - Session object from users_master
 * @param {number} stage - 1, 2, or 3
 */
async function sendReminderStage(session, stage) {
  const phone = session.phone;
  if (!phone) throw new Error('Session has no phone number');

  logger.info(`Sending Reminder Stage ${stage} to ${phone} (State: ${session.state})`);

  let res;
  if (stage === 1) {
    const text = getReminder1Message(session);
    res = await whatsapp.sendText(phone, text);
  } else if (stage === 2) {
    const text = getReminder2Message(session);
    res = await whatsapp.sendText(phone, text);
  } else if (stage === 3) {
    const text = getReminder3Message(session);
    res = await whatsapp.sendSupportReminderButtons(phone, text);
  } else {
    throw new Error(`Invalid reminder stage: ${stage}`);
  }

  // Record into persistent log
  const logs = loadReminderLogs();
  const now = new Date().toISOString();
  if (!logs[session.user_id]) logs[session.user_id] = {};

  logs[session.user_id][`r${stage}_sent_at`] = now;
  logs[session.user_id].last_stage = stage;
  logs[session.user_id].phone = phone;
  logs[session.user_id].state = session.state;

  saveReminderLogs(logs);

  return { success: true, stage, sentAt: now, result: res };
}

/**
 * Evaluates all active in-progress sessions and auto-sends pending reminders
 */
async function processAutoReminders() {
  try {
    const client = db.getClient();
    const { data: sessions, error } = await client
      .from('users_master')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error || !sessions) {
      logger.warn('Could not fetch sessions for auto reminders', error);
      return { processed: 0, sent: [] };
    }

    // Query recent completed bookings so we NEVER send abandoned reminders to customers who already converted
    const { data: recentBookings } = await client
      .from('book_vehicle')
      .select('phone, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);

    const bookedPhoneMap = new Map();
    (recentBookings || []).forEach((b) => {
      const p = String(b.phone || '').replace(/[^0-9]/g, '').slice(-10);
      if (p) {
        const t = new Date(b.updated_at).getTime();
        if (!bookedPhoneMap.has(p) || t > bookedPhoneMap.get(p)) {
          bookedPhoneMap.set(p, t);
        }
      }
    });

    const logs = loadReminderLogs();
    const now = Date.now();
    const sent = [];
    const seenPhones = new Set();

    for (const session of sessions) {
      if (!session.phone) continue;

      // Group by phone: Only evaluate the LATEST active session for each phone number
      const normPhone = String(session.phone || '').replace(/[^0-9]/g, '').slice(-10);
      if (seenPhones.has(normPhone)) {
        continue;
      }
      seenPhones.add(normPhone);

      // Check if user has already placed a booking recently
      const sessionTime = new Date(session.updated_at).getTime();
      const lastBookedAt = bookedPhoneMap.get(normPhone);
      if (lastBookedAt && lastBookedAt >= sessionTime - 12 * 3600 * 1000) {
        // Converted customer — skip reminders
        continue;
      }

      // Skip completed, support or fresh main menu states
      const state = (session.state || '').toLowerCase();
      if (['cta_menu', 'completed', 'support_flow', 'main_menu', 'start'].includes(state)) {
        continue;
      }

      const elapsedHours = (now - sessionTime) / (1000 * 60 * 60);

      // Must be within 24-hour Meta customer service window
      if (elapsedHours < 0 || elapsedHours > 24) {
        continue;
      }

      const sessionLogs = logs[session.user_id] || {};

      // Stage 1: Send if elapsed >= 1 hour and not yet sent
      if (elapsedHours >= 1 && !sessionLogs.r1_sent_at) {
        try {
          await sendReminderStage(session, 1);
          sent.push({ user_id: session.user_id, phone: session.phone, stage: 1 });
        } catch (e) {
          logger.error(`Auto Reminder 1 failed for ${session.phone}`, e.message);
        }
        continue;
      }

      // Stage 2: Send if elapsed >= 6 hours and not yet sent
      if (elapsedHours >= 6 && !sessionLogs.r2_sent_at) {
        try {
          await sendReminderStage(session, 2);
          sent.push({ user_id: session.user_id, phone: session.phone, stage: 2 });
        } catch (e) {
          logger.error(`Auto Reminder 2 failed for ${session.phone}`, e.message);
        }
        continue;
      }

      // Stage 3: Send if elapsed >= 18 hours and not yet sent
      if (elapsedHours >= 18 && !sessionLogs.r3_sent_at) {
        try {
          await sendReminderStage(session, 3);
          sent.push({ user_id: session.user_id, phone: session.phone, stage: 3 });
        } catch (e) {
          logger.error(`Auto Reminder 3 failed for ${session.phone}`, e.message);
        }
        continue;
      }
    }

    if (sent.length > 0) {
      logger.info(`Auto-reminder runner completed. Sent ${sent.length} reminders.`);
    }

    return { processed: sessions.length, sent };
  } catch (err) {
    logger.error('Error during auto-reminder processing', err);
    return { error: err.message };
  }
}

module.exports = {
  loadReminderLogs,
  saveReminderLogs,
  getReminder1Message,
  getReminder2Message,
  getReminder3Message,
  sendReminderStage,
  processAutoReminders,
};
