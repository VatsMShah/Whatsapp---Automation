require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    // We don't throw here at import-time for every var (so `npm start` gives
    // one clean error instead of crashing on the first missing var during
    // early local setup) — but we do warn loudly.
    console.warn(`⚠️  Missing environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,

  whatsapp: {
    verifyToken: required('WHATSAPP_VERIFY_TOKEN'),
    appSecret: required('WHATSAPP_APP_SECRET'),
    accessToken: required('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0',
    flowId: process.env.WHATSAPP_FLOW_ID || '',
  },
  supabase: {
    url: required('SUPABASE_URL'),
    key: required('SUPABASE_KEY'),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  },
  auth: {
    jwtSecret: (process.env.AUTH_JWT_SECRET || '').trim(),
  },
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID || '1IdG2oaGPdGDzY4H5JwPa0eeHKdXzivMNwkhBslJ5ZUI',
    webhookUrl: process.env.GOOGLE_SHEET_WEBHOOK_URL || '',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    tabs: {
      master: process.env.GOOGLE_TAB_MASTER || 'users_master',
      book: process.env.GOOGLE_TAB_BOOK || 'book_vehicle',
      provider: process.env.GOOGLE_TAB_PROVIDER || 'provide_vehicle',
      support: process.env.GOOGLE_TAB_SUPPORT || 'support',
      leadStatus: process.env.GOOGLE_TAB_LEAD_STATUS || 'lead_status',
    },
    isConfigured: Boolean(
      process.env.GOOGLE_SHEET_WEBHOOK_URL ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
    ),
  },
};
