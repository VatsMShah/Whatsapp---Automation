const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = config.supabase.url;
    const key = config.supabase.key;
    if (!url || !key || url.startsWith('your_') || key.startsWith('your_')) {
      logger.error('Supabase credentials are not configured or are still placeholders. Please update .env.');
      throw new Error('Supabase credentials not configured');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

// =====================================================================
// MAPPINGS: JS CamelCase <-> DB SnakeCase
// =====================================================================

function mapMasterToJS(dbRow) {
  if (!dbRow) return null;
  return {
    user_id: dbRow.user_id,
    phone: dbRow.phone,
    state: dbRow.state,
    updated_at: dbRow.updated_at,
    flowType: dbRow.flow_type,
    // data is stored as JSONB in DB, but the state machine expects a JSON string
    data: dbRow.data ? JSON.stringify(dbRow.data) : '{}',
  };
}

function mapMasterToDB(jsRow) {
  let parsedData = {};
  try {
    parsedData = typeof jsRow.data === 'string' ? JSON.parse(jsRow.data) : jsRow.data || {};
  } catch (err) {
    logger.warn('Failed to parse session data string, storing empty object', err);
  }

  return {
    user_id: jsRow.user_id,
    phone: jsRow.phone,
    state: jsRow.state,
    updated_at: jsRow.updated_at || new Date().toISOString(),
    flow_type: jsRow.flowType || '',
    data: parsedData,
  };
}

function mapBookToJS(dbRow) {
  if (!dbRow) return {};
  return {
    user_id: dbRow.user_id,
    state: dbRow.state,
    updated_at: dbRow.updated_at,
    loadingPin: dbRow.loading_pin,
    unloadingPin: dbRow.unloading_pin,
    cargoType: dbRow.cargo_type,
    vehicleType: dbRow.vehicle_type,
    vehicleSubType: dbRow.vehicle_sub_type,
    material: dbRow.material,
    loadingDate: dbRow.loading_date,
    company: dbRow.company,
    contactName: dbRow.contact_name,
    phone: dbRow.phone,
    email: dbRow.email,
    website: dbRow.website,
  };
}

function mapBookToDB(jsRow) {
  return {
    user_id: jsRow.user_id,
    state: jsRow.state,
    updated_at: jsRow.updated_at || new Date().toISOString(),
    loading_pin: jsRow.loadingPin || '',
    unloading_pin: jsRow.unloadingPin || '',
    cargo_type: jsRow.cargoType || '',
    vehicle_type: jsRow.vehicleType || '',
    vehicle_sub_type: jsRow.vehicleSubType || '',
    material: jsRow.material || '',
    loading_date: jsRow.loadingDate || '',
    company: jsRow.company || '',
    contact_name: jsRow.contactName || '',
    phone: jsRow.phone || '',
    email: jsRow.email || '',
    website: jsRow.website || '',
  };
}

function mapProvideToJS(dbRow) {
  if (!dbRow) return {};
  return {
    user_id: dbRow.user_id,
    state: dbRow.state,
    updated_at: dbRow.updated_at,
    vehicleType: dbRow.vehicle_type,
    vehicleNumber: dbRow.vehicle_number,
    driverName: dbRow.driver_name,
    capacity: dbRow.capacity,
    routePreference: dbRow.route_preference,
    availability: dbRow.availability,
    driverPhone: dbRow.driver_phone,
    currentLocation: dbRow.current_location,
    notes: dbRow.notes,
    documents: dbRow.documents,
  };
}

function mapProvideToDB(jsRow) {
  return {
    user_id: jsRow.user_id,
    state: jsRow.state,
    updated_at: jsRow.updated_at || new Date().toISOString(),
    vehicle_type: jsRow.vehicleType || '',
    vehicle_number: jsRow.vehicleNumber || '',
    driver_name: jsRow.driverName || '',
    capacity: jsRow.capacity || '',
    route_preference: jsRow.routePreference || '',
    availability: jsRow.availability || '',
    driver_phone: jsRow.driverPhone || '',
    current_location: jsRow.currentLocation || '',
    notes: jsRow.notes || '',
    documents: jsRow.documents || '',
  };
}

function mapSupportToJS(dbRow) {
  if (!dbRow) return {};
  return {
    user_id: dbRow.user_id,
    updated_at: dbRow.updated_at,
  };
}

function mapSupportToDB(jsRow) {
  return {
    user_id: jsRow.user_id,
    updated_at: jsRow.updated_at || new Date().toISOString(),
  };
}

// =====================================================================
// API INTERFACE (Mirrors sheets.js)
// =====================================================================

/** Get all master session rows by phone number */
async function getMasterRowsByPhone(phone) {
  const client = getClient();
  const { data, error } = await client
    .from('users_master')
    .select('*')
    .eq('phone', phone);

  if (error) {
    logger.error('Failed to get master rows by phone', error);
    throw error;
  }

  return (data || []).map(mapMasterToJS);
}

/** Save or update master session row */
async function saveMasterSession(row) {
  const client = getClient();
  const dbRow = mapMasterToDB(row);

  const { data, error } = await client
    .from('users_master')
    .upsert(dbRow)
    .select();

  if (error) {
    logger.error('Failed to save master session', error);
    throw error;
  }

  logger.info('Saved master session in Supabase', { user_id: row.user_id });
  return data && data.length > 0 ? mapMasterToJS(data[0]) : null;
}

/** Get BookVehicle row */
async function getBookVehicleRow(userId) {
  const client = getClient();
  const { data, error } = await client
    .from('book_vehicle')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get book vehicle row', error);
    throw error;
  }

  return mapBookToJS(data);
}

/** Save or update BookVehicle row */
async function saveBookVehicleRow(row) {
  const client = getClient();
  const dbRow = mapBookToDB(row);

  const { data, error } = await client
    .from('book_vehicle')
    .upsert(dbRow)
    .select();

  if (error) {
    logger.error('Failed to save book vehicle row', error);
    throw error;
  }

  logger.info('Saved book vehicle row in Supabase', { user_id: row.user_id });
  return data && data.length > 0 ? mapBookToJS(data[0]) : null;
}

/** Get ProvideVehicle row */
async function getProvideVehicleRow(userId) {
  const client = getClient();
  const { data, error } = await client
    .from('provide_vehicle')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get provide vehicle row', error);
    throw error;
  }

  return mapProvideToJS(data);
}

/** Save or update ProvideVehicle row */
async function saveProvideVehicleRow(row) {
  const client = getClient();
  const dbRow = mapProvideToDB(row);

  const { data, error } = await client
    .from('provide_vehicle')
    .upsert(dbRow)
    .select();

  if (error) {
    logger.error('Failed to save provide vehicle row', error);
    throw error;
  }

  logger.info('Saved provide vehicle row in Supabase', { user_id: row.user_id });
  return data && data.length > 0 ? mapProvideToJS(data[0]) : null;
}

/** Get Support row */
async function getSupportRow(userId) {
  const client = getClient();
  const { data, error } = await client
    .from('support')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get support row', error);
    throw error;
  }

  return mapSupportToJS(data);
}

/** Save or update Support row */
async function saveSupportRow(row) {
  const client = getClient();
  const dbRow = mapSupportToDB(row);

  const { data, error } = await client
    .from('support')
    .upsert(dbRow)
    .select();

  if (error) {
    logger.error('Failed to save support row', error);
    throw error;
  }

  logger.info('Saved support row in Supabase', { user_id: row.user_id });
  return data && data.length > 0 ? mapSupportToJS(data[0]) : null;
}

module.exports = {
  getMasterRowsByPhone,
  saveMasterSession,
  getBookVehicleRow,
  saveBookVehicleRow,
  getProvideVehicleRow,
  saveProvideVehicleRow,
  getSupportRow,
  saveSupportRow,
};
