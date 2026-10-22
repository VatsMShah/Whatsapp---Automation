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

// =====================================================================
// DATA BACKUP & FAILOVER API ENDPOINTS
// =====================================================================
const localBackup = require('./services/localBackup');
const db = require('./services/supabase');
const sheets = require('./services/sheets');

/** Check backup system status and Supabase / Sheets connectivity */
app.get('/api/backup/status', async (_req, res) => {
  const stats = localBackup.getBackupStats();

  let supabaseOnline = false;
  let supabaseError = null;
  try {
    const client = db.getClient();
    const { error } = await client.from('book_vehicle').select('user_id').limit(1);
    if (!error) {
      supabaseOnline = true;
    } else {
      supabaseError = error.message;
    }
  } catch (err) {
    supabaseError = err.message;
  }

  res.json({
    ...stats,
    supabase: {
      online: supabaseOnline,
      error: supabaseError,
    },
    googleSheets: {
      configured: sheets.isConfigured(),
      sheetId: config.google?.sheetId || null,
    },
  });
});

/** Export backup data as CSV or JSON */
app.get('/api/backup/export', (req, res) => {
  const type = req.query.type || 'bookings'; // 'bookings' | 'sessions' | 'all'
  const format = req.query.format || 'csv';   // 'csv' | 'json'

  let data = [];
  let filename = `traket_${type}_backup_${new Date().toISOString().split('T')[0]}`;

  if (type === 'bookings') {
    data = localBackup.getRecords('book_vehicle');
  } else if (type === 'sessions') {
    data = localBackup.getRecords('users_master');
  } else if (type === 'support') {
    data = localBackup.getRecords('support');
  } else if (type === 'all') {
    const allData = {
      book_vehicle: localBackup.getRecords('book_vehicle'),
      users_master: localBackup.getRecords('users_master'),
      provide_vehicle: localBackup.getRecords('provide_vehicle'),
      support: localBackup.getRecords('support'),
      exportedAt: new Date().toISOString(),
    };
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(allData);
  }

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(data);
  }

  // Default to CSV
  const csv = localBackup.toCSV(data);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  return res.send(csv);
});

/** Trigger re-sync of offline leads into Supabase */
app.post('/api/backup/resync-supabase', async (_req, res) => {
  try {
    const result = await db.resyncPendingToSupabase();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Trigger bulk sync to Google Sheets */
app.post('/api/backup/sync-sheets', async (_req, res) => {
  try {
    const bookings = localBackup.getRecords('book_vehicle');
    const result = await sheets.syncAllBookingsToSheets(bookings);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
  logger.info(`Backup API: http://localhost:${config.port}/api/backup/status`);
});
