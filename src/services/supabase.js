const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;

function getClient() {
  if (!supabase) {
    const rawUrl = config.supabase.url;
    const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '') : rawUrl;
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
  const flow = dbRow.flow_data || {};
  return {
    user_id: dbRow.user_id,
    phone: dbRow.phone,
    state: dbRow.state,
    cargoType: dbRow.cargo_type,
    origin: dbRow.origin,
    destination: dbRow.destination,
    vehicleOrContainer: dbRow.vehicle_or_container,
    materialOrLine: dbRow.material_or_line,
    weight: dbRow.weight,
    loadingDate: dbRow.loading_date,
    timeSlot: dbRow.time_slot,
    company: dbRow.company_name,
    contactName: dbRow.contact_name,
    email: dbRow.email,
    remarks: dbRow.remarks,
    updated_at: dbRow.updated_at,
    loadingPin: flow.loading_pin || dbRow.origin,
    unloadingPin: flow.unloading_pin || dbRow.destination,
    vehicleType: flow.vehicle_type || dbRow.vehicle_or_container,
    vehicleSubType: flow.vehicle_sub_type,
    material: flow.material || dbRow.material_or_line,
    fclType: flow.fcl_type,
    containerType: flow.container_type,
    shippingLine: flow.shipping_line || dbRow.material_or_line,
    loadingYard: flow.loading_yard || dbRow.origin,
    unloadingAddress: flow.unloading_address || dbRow.destination,
    emptyYard: flow.empty_yard,
    stuffingAddress: flow.stuffing_address || dbRow.origin,
    portCfs: flow.port_cfs || dbRow.destination,
    bodyType: flow.body_type,
    openClose: flow.open_close,
    trailerBedType: flow.trailer_bed_type,
    trailerDimType: flow.trailer_dim_type,
  };
}

function mapBookToDB(jsRow) {
  const origin = jsRow.loadingYard || jsRow.stuffingAddress || jsRow.loadingPin || '';
  const destination = jsRow.unloadingAddress || jsRow.portCfs || jsRow.unloadingPin || '';

  let vehicleOrContainer = '';
  if (jsRow.fclType) {
    vehicleOrContainer = `${jsRow.fclType}${jsRow.containerType ? ` (${jsRow.containerType})` : ''}`;
  } else if (jsRow.vehicleType) {
    vehicleOrContainer = jsRow.vehicleType;
    if (jsRow.vehicleSubType) vehicleOrContainer += ` – ${jsRow.vehicleSubType}`;
    if (jsRow.bodyType) vehicleOrContainer += ` (${jsRow.bodyType})`;
  }

  const materialOrLine = jsRow.shippingLine || jsRow.material || '';

  let remarks = jsRow.remarks || '';
  if (jsRow.emptyYard && !remarks.includes(jsRow.emptyYard)) {
    remarks = remarks ? `Empty Yard: ${jsRow.emptyYard} | ${remarks}` : `Empty Yard: ${jsRow.emptyYard}`;
  }

  return {
    user_id: jsRow.user_id,
    phone: jsRow.phone || '',
    state: jsRow.state || '',
    cargo_type: jsRow.cargoType || '',
    origin: origin,
    destination: destination,
    vehicle_or_container: vehicleOrContainer,
    material_or_line: materialOrLine,
    weight: jsRow.weight || '',
    loading_date: jsRow.loadingDate || '',
    time_slot: jsRow.loadingTime || '',
    company_name: jsRow.company || '',
    contact_name: jsRow.contactName || '',
    email: jsRow.email || '',
    remarks: remarks,
    flow_data: {
      loading_pin: jsRow.loadingPin || '',
      unloading_pin: jsRow.unloadingPin || '',
      vehicle_type: jsRow.vehicleType || '',
      vehicle_sub_type: jsRow.vehicleSubType || '',
      body_type: jsRow.bodyType || '',
      open_close: jsRow.openClose || '',
      trailer_bed_type: jsRow.trailerBedType || '',
      trailer_dim_type: jsRow.trailerDimType || '',
      fcl_type: jsRow.fclType || '',
      container_type: jsRow.containerType || '',
      shipping_line: jsRow.shippingLine || '',
      loading_yard: jsRow.loadingYard || '',
      unloading_address: jsRow.unloadingAddress || '',
      empty_yard: jsRow.emptyYard || '',
      stuffing_address: jsRow.stuffingAddress || '',
      port_cfs: jsRow.portCfs || '',
      cargo_dimensions: jsRow.dimensions || '',
      website: jsRow.website || '',
    },
    updated_at: jsRow.updated_at || new Date().toISOString(),
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
// In-memory fallback stores when Supabase is unreachable or paused
const memoryStore = {
  users_master: new Map(),
  book_vehicle: new Map(),
  provide_vehicle: new Map(),
  support: new Map(),
};

// =====================================================================
// API INTERFACE (Mirrors sheets.js)
// =====================================================================

/** Get all master session rows by phone number */
async function getMasterRowsByPhone(phone) {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('users_master')
      .select('*')
      .eq('phone', phone);

    if (error) throw error;
    return (data || []).map(mapMasterToJS);
  } catch (err) {
    logger.warn('Supabase getMasterRowsByPhone failed, using memory fallback:', err.message || err);
    const rows = [];
    for (const row of memoryStore.users_master.values()) {
      if (row.phone === phone) {
        rows.push(row);
      }
    }
    return rows;
  }
}

/** Save or update master session row */
async function saveMasterSession(row) {
  // Always update memory store
  memoryStore.users_master.set(row.user_id, row);

  try {
    const client = getClient();
    const dbRow = mapMasterToDB(row);

    const { data, error } = await client
      .from('users_master')
      .upsert(dbRow)
      .select();

    if (error) throw error;

    logger.info('Saved master session in Supabase', { user_id: row.user_id });
    return data && data.length > 0 ? mapMasterToJS(data[0]) : row;
  } catch (err) {
    logger.warn('Supabase saveMasterSession failed, saved to memory store:', err.message || err);
    return row;
  }
}

/** Get BookVehicle row */
async function getBookVehicleRow(userId) {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('book_vehicle')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return mapBookToJS(data);
  } catch (err) {
    logger.warn('Supabase getBookVehicleRow failed, using memory fallback:', err.message || err);
    return memoryStore.book_vehicle.get(userId) || {};
  }
}

/** Save or update BookVehicle row */
async function saveBookVehicleRow(row) {
  memoryStore.book_vehicle.set(row.user_id, row);

  try {
    const client = getClient();
    const dbRow = mapBookToDB(row);

    const { data, error } = await client
      .from('book_vehicle')
      .upsert(dbRow)
      .select();

    if (error) throw error;

    logger.info('Saved book vehicle row in Supabase', { user_id: row.user_id });
    return data && data.length > 0 ? mapBookToJS(data[0]) : row;
  } catch (err) {
    logger.warn('Supabase saveBookVehicleRow failed, saved to memory store:', err.message || err);
    return row;
  }
}

/** Get ProvideVehicle row */
async function getProvideVehicleRow(userId) {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('provide_vehicle')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return mapProvideToJS(data);
  } catch (err) {
    logger.warn('Supabase getProvideVehicleRow failed, using memory fallback:', err.message || err);
    return memoryStore.provide_vehicle.get(userId) || {};
  }
}

/** Save or update ProvideVehicle row */
async function saveProvideVehicleRow(row) {
  memoryStore.provide_vehicle.set(row.user_id, row);

  try {
    const client = getClient();
    const dbRow = mapProvideToDB(row);

    const { data, error } = await client
      .from('provide_vehicle')
      .upsert(dbRow)
      .select();

    if (error) throw error;

    logger.info('Saved provide vehicle row in Supabase', { user_id: row.user_id });
    return data && data.length > 0 ? mapProvideToJS(data[0]) : row;
  } catch (err) {
    logger.warn('Supabase saveProvideVehicleRow failed, saved to memory store:', err.message || err);
    return row;
  }
}

/** Get Support row */
async function getSupportRow(userId) {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('support')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return mapSupportToJS(data);
  } catch (err) {
    logger.warn('Supabase getSupportRow failed, using memory fallback:', err.message || err);
    return memoryStore.support.get(userId) || {};
  }
}

/** Save or update Support row */
async function saveSupportRow(row) {
  memoryStore.support.set(row.user_id, row);

  try {
    const client = getClient();
    const dbRow = mapSupportToDB(row);

    const { data, error } = await client
      .from('support')
      .upsert(dbRow)
      .select();

    if (error) throw error;

    logger.info('Saved support row in Supabase', { user_id: row.user_id });
    return data && data.length > 0 ? mapSupportToDB(data[0]) : row;
  } catch (err) {
    logger.warn('Supabase saveSupportRow failed, saved to memory store:', err.message || err);
    return row;
  }
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
