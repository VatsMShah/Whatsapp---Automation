const db = require('./services/supabase');
const logger = require('./utils/logger');

async function testSupabase() {
  logger.info('Testing connection and permissions to Supabase...');

  try {
    // 1. Create a dummy session
    const testUserId = `test_user_${Date.now()}`;
    const testRow = {
      user_id: testUserId,
      phone: '9999999999',
      state: 'main_menu',
      updated_at: new Date().toISOString(),
      flowType: 'book',
      data: JSON.stringify({ testKey: 'testValue' }),
    };

    logger.info('Attempting to upsert session in users_master...');
    await db.saveMasterSession(testRow);
    logger.info('Upsert succeeded.');

    // 2. Fetch it back
    logger.info('Attempting to retrieve session by phone...');
    const rows = await db.getMasterRowsByPhone('9999999999');
    const matched = rows.find(r => r.user_id === testUserId);

    if (matched) {
      logger.info('Retrieval succeeded. Retrieved data:', matched);
    } else {
      throw new Error('Test session was saved but could not be found via getMasterRowsByPhone.');
    }

    // 3. Save Book Vehicle Row
    logger.info('Attempting to upsert row in book_vehicle...');
    const testBookRow = {
      user_id: testUserId,
      state: 'route_details',
      updated_at: new Date().toISOString(),
      loadingPin: '400701',
      unloadingPin: '110020',
      cargoType: 'Domestic',
      vehicleType: 'Tempo',
      vehicleSubType: 'Pickup – 1 MT',
      material: 'Test material',
      loadingDate: '15-Jan-2026',
      company: 'Test Company',
      contactName: 'Test Contact',
      phone: '9999999999',
      email: 'test@example.com',
      website: 'www.test.com',
    };
    await db.saveBookVehicleRow(testBookRow);
    logger.info('Book vehicle upsert succeeded.');

    // 4. Retrieve Book Vehicle Row
    logger.info('Attempting to retrieve book vehicle row...');
    const bookRow = await db.getBookVehicleRow(testUserId);
    logger.info('Book vehicle retrieval succeeded. Retrieved data:', bookRow);

    logger.info('🎉 Supabase integration verification test PASSED successfully!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Supabase verification test FAILED:', err);
    process.exit(1);
  }
}

testSupabase();
