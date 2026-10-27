require('dotenv').config();
const db = require('./services/supabase');
const config = require('./config');
const logger = require('./utils/logger');

const TABLES_TO_SYNC = [
  {
    table: 'book_vehicle',
    tabTitle: config.google?.tabs?.book || 'book_vehicle',
    defaultHeaders: [
      'user_id',
      'phone',
      'state',
      'cargo_type',
      'origin',
      'destination',
      'vehicle_or_container',
      'material_or_line',
      'weight',
      'loading_date',
      'time_slot',
      'company_name',
      'contact_name',
      'email',
      'remarks',
      'flow_data',
      'updated_at',
    ],
  },
  {
    table: 'users_master',
    tabTitle: config.google?.tabs?.master || 'users_master',
    defaultHeaders: ['user_id', 'phone', 'state', 'updated_at', 'flow_type', 'data'],
  },
  {
    table: 'provide_vehicle',
    tabTitle: config.google?.tabs?.provider || 'provide_vehicle',
    defaultHeaders: [
      'user_id',
      'state',
      'updated_at',
      'vehicle_type',
      'vehicle_number',
      'driver_name',
      'capacity',
      'route_preference',
      'availability',
      'driver_phone',
      'current_location',
      'notes',
      'documents',
    ],
  },
  {
    table: 'lead_status',
    tabTitle: config.google?.tabs?.leadStatus || 'lead_status',
    defaultHeaders: ['user_id', 'phone', 'name', 'status', 'remarks', 'updated_at'],
  },
  {
    table: 'support',
    tabTitle: config.google?.tabs?.support || 'support',
    defaultHeaders: ['user_id', 'phone', 'contact_name', 'subject', 'message', 'status', 'priority', 'updated_at'],
  },
];

async function syncAllToSheet() {
  logger.info('🚀 Starting complete Supabase -> Google Sheets synchronization...');
  const webhookUrl = config.google?.webhookUrl;
  if (!webhookUrl) {
    logger.error('GOOGLE_SHEET_WEBHOOK_URL is not configured in .env');
    return;
  }

  const client = db.getClient();
  const tablesPayload = {};

  for (const item of TABLES_TO_SYNC) {
    logger.info(`Fetching data from Supabase table "${item.table}"...`);
    const { data, error } = await client.from(item.table).select('*').order('updated_at', { ascending: false });

    if (error) {
      logger.warn(`Could not fetch data for table "${item.table}":`, error.message);
      tablesPayload[item.tabTitle] = {
        headers: item.defaultHeaders,
        rows: [],
      };
      continue;
    }

    const rows = data || [];
    let headers = item.defaultHeaders;
    if (rows.length > 0) {
      // Use actual columns from data plus any missing default headers
      const actualKeys = Object.keys(rows[0]);
      headers = Array.from(new Set([...item.defaultHeaders, ...actualKeys]));
    }

    tablesPayload[item.tabTitle] = {
      headers,
      rows,
    };
    logger.info(`✔ Loaded ${rows.length} records for "${item.tabTitle}".`);
  }

  logger.info('📤 Sending full database payload to Google Sheet Webhook...');
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_all',
      sheetId: config.google.sheetId,
      tables: tablesPayload,
    }),
  });

  const result = await res.json();
  if (result.status === 'success') {
    logger.info('🎉 SUCCESS! All Supabase data structures and rows are synced to Google Sheets!');
    console.log('\n📊 Sync Summary:');
    for (const [tab, data] of Object.entries(tablesPayload)) {
      console.log(`  • Tab "${tab}": ${data.rows.length} rows, ${data.headers.length} columns`);
    }
  } else {
    logger.error('Sync returned error from Google Apps Script:', result);
  }
}

syncAllToSheet().then(() => {
  process.exit(0);
}).catch((err) => {
  logger.error('Sync failed:', err);
  process.exit(1);
});
