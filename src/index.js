const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const { handleVerification, isValidSignature } = require('./webhook/verify');
const { handleIncomingMessage } = require('./webhook/handler');

const app = express();

// Enable CORS for CRM Dashboard & local clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Capture the raw request body bytes (needed for HMAC signature validation)
// while still giving us the parsed JSON body for normal use.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (_req, res) => res.status(200).send('ok'));

// Auto-reminders API
const reminders = require('./services/reminders');

app.get('/api/reminders/logs', (_req, res) => {
  const logs = reminders.loadReminderLogs();
  res.json({ success: true, logs });
});

app.post('/api/reminders/send', async (req, res) => {
  try {
    const { session, stage } = req.body;
    if (!session || !stage) {
      return res.status(400).json({ error: 'Missing session or stage (1, 2, or 3)' });
    }
    const result = await reminders.sendReminderStage(session, Number(stage));
    res.json(result);
  } catch (err) {
    logger.error('Error sending reminder via API', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reminders/auto-process', async (_req, res) => {
  try {
    const result = await reminders.processAutoReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Error running auto-reminders via API', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta's webhook verification handshake.
app.get('/webhook', handleVerification);

// Meta's actual webhook events (incoming messages, delivery statuses, etc.)
app.post('/webhook', async (req, res) => {
  const signature = req.header('x-hub-signature-256');

  if (!isValidSignature(req.rawBody, signature)) {
    logger.warn('Rejected webhook POST — invalid signature');
    return res.sendStatus(401);
  }

  // Respond to Meta immediately — Meta expects a fast 200 and will retry
  // (and eventually disable the webhook) if you take too long or throw.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        await handleIncomingMessage(change.value);
      }
    }
  } catch (err) {
    logger.error('Error while processing webhook payload', err);
  }
});

app.listen(config.port, () => {
  logger.info(`Traket WhatsApp bot listening on port ${config.port}`);
  logger.info(`Webhook URL (local): http://localhost:${config.port}/webhook`);

  // Start background auto-reminders worker (runs every 3 minutes)
  logger.info('Auto-reminders worker initialized (3-stage 24hr drop-off recovery)');
  setInterval(() => {
    reminders.processAutoReminders().catch((err) => {
      logger.warn('Background auto-reminder run encountered error:', err.message);
    });
  }, 3 * 60 * 1000);
});
