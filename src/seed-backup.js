const db = require('./services/supabase');
const localBackup = require('./services/localBackup');
const logger = require('./utils/logger');

async function seedLocalBackup() {
  logger.info('Connecting to Supabase to fetch initial backup snapshot...');
  try {
    const client = db.getClient();

    // 1. Fetch book_vehicle
    const { data: bookings, error: bErr } = await client.from('book_vehicle').select('*');
    if (!bErr && bookings) {
      for (const row of bookings) {
        localBackup.saveRecord('book_vehicle', row, true);
      }
      logger.info(`✅ Backed up ${bookings.length} book_vehicle records to local vault.`);
    }

    // 2. Fetch users_master
    const { data: sessions, error: sErr } = await client.from('users_master').select('*');
    if (!sErr && sessions) {
      for (const row of sessions) {
        localBackup.saveRecord('users_master', row, true);
      }
      logger.info(`✅ Backed up ${sessions.length} users_master sessions to local vault.`);
    }

    const stats = localBackup.getBackupStats();
    logger.info('🎉 Initial backup snapshot successfully created on local disk:', stats);
  } catch (err) {
    logger.error('Failed to seed backup:', err);
  }
}

seedLocalBackup().then(() => process.exit(0));
