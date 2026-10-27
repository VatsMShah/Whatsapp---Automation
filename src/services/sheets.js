const store = require('./sheetsStore');
const config = require('../config');
const logger = require('../utils/logger');

const TABS = config.google?.tabs || {
  master: 'users_master',
  book: 'BookVehicle',
  provider: 'ProvideVehicle',
  support: 'Support',
};

function isConfigured() {
  return Boolean(config.google?.isConfigured);
}

// ---------------------------------------------------------------------
// users_master  (equivalent of "Get Master Row" / "Save Master Session")
// ---------------------------------------------------------------------

/** Equivalent of "Get Master Row" — filters users_master by exact phone match. */
async function getMasterRowsByPhone(phone) {
  if (!isConfigured()) return [];
  try {
    const rows = await store.findRows(TABS.master, 'phone', phone);
    return rows.map((r) => r.toObject());
  } catch (err) {
    logger.warn('Google Sheets getMasterRowsByPhone failed:', err.message);
    return [];
  }
}

/** Equivalent of "Save Master Session" — upsert keyed on user_id. */
async function saveMasterSession(row) {
  if (!isConfigured()) return row;
  try {
    const formatted = {
      user_id: row.user_id,
      phone: row.phone || '',
      state: row.state || '',
      flow_type: row.flowType || row.flow_type || '',
      session_data: typeof row.data === 'object' ? JSON.stringify(row.data) : (row.data || '{}'),
      updated_at: row.updated_at || new Date().toISOString(),
    };
    return await store.upsertRow(TABS.master, 'user_id', formatted);
  } catch (err) {
    logger.warn('Google Sheets saveMasterSession failed:', err.message);
    return row;
  }
}

// ---------------------------------------------------------------------
// BookVehicle  (equivalent of "BookVehicleGetRows" / "BookVehicleAppendUpdateRow")
// ---------------------------------------------------------------------

async function getBookVehicleRow(userId) {
  if (!isConfigured()) return {};
  try {
    const rows = await store.findRows(TABS.book, 'user_id', userId);
    return rows.length > 0 ? rows[0].toObject() : {};
  } catch (err) {
    logger.warn('Google Sheets getBookVehicleRow failed:', err.message);
    return {};
  }
}

async function saveBookVehicleRow(row) {
  if (!isConfigured()) return row;
  try {
    const formattedRow = {
      user_id: row.user_id,
      phone: row.phone || '',
      loadingDate: row.loadingDate || row.loading_date || '',
      loadingTime: row.loadingTime || row.time_slot || '',
      origin: row.origin || row.loadingYard || row.stuffingAddress || row.loadingPin || '',
      destination: row.destination || row.unloadingAddress || row.portCfs || row.unloadingPin || '',
      cargoType: row.cargoType || row.cargo_type || '',
      vehicleType: row.vehicleType || row.vehicle_or_container || '',
      vehicleSubType: row.vehicleSubType || '',
      weight: row.weight || '',
      material: row.material || row.shippingLine || row.material_or_line || '',
      company: row.company || row.company_name || '',
      contactName: row.contactName || row.contact_name || '',
      email: row.email || '',
      remarks: row.remarks || '',
      updated_at: row.updated_at || new Date().toISOString(),
    };
    return await store.upsertRow(TABS.book, 'user_id', formattedRow);
  } catch (err) {
    logger.warn('Google Sheets saveBookVehicleRow failed:', err.message);
    return row;
  }
}

// ---------------------------------------------------------------------
// ProvideVehicle  (equivalent of "ProvideVehicleGetRows" / "ProvideVehicleAppendUpdateRow1")
// ---------------------------------------------------------------------

async function getProvideVehicleRow(userId) {
  if (!isConfigured()) return {};
  try {
    const rows = await store.findRows(TABS.provider, 'user_id', userId);
    return rows.length > 0 ? rows[0].toObject() : {};
  } catch (err) {
    logger.warn('Google Sheets getProvideVehicleRow failed:', err.message);
    return {};
  }
}

async function saveProvideVehicleRow(row) {
  if (!isConfigured()) return row;
  try {
    const formatted = {
      user_id: row.user_id,
      driver_phone: row.driver_phone || row.driverPhone || row.phone || '',
      driver_name: row.driver_name || row.driverName || '',
      vehicle_type: row.vehicle_type || row.vehicleType || '',
      vehicle_number: row.vehicle_number || row.vehicleNumber || '',
      capacity: row.capacity || '',
      route_preference: row.route_preference || row.routePreference || '',
      availability: row.availability || '',
      current_location: row.current_location || row.currentLocation || '',
      notes: row.notes || '',
      documents: row.documents || '',
      state: row.state || '',
      updated_at: row.updated_at || new Date().toISOString(),
    };
    return await store.upsertRow(TABS.provider, 'user_id', formatted);
  } catch (err) {
    logger.warn('Google Sheets saveProvideVehicleRow failed:', err.message);
    return row;
  }
}

// ---------------------------------------------------------------------
// Support  (equivalent of "SupportGetRows" / "SupportAppendUpdateRow")
// ---------------------------------------------------------------------

async function getSupportRow(userId) {
  if (!isConfigured()) return {};
  try {
    const rows = await store.findRows(TABS.support, 'user_id', userId);
    return rows.length > 0 ? rows[0].toObject() : {};
  } catch (err) {
    logger.warn('Google Sheets getSupportRow failed:', err.message);
    return {};
  }
}

async function saveSupportRow(row) {
  if (!isConfigured()) return row;
  try {
    const formatted = {
      user_id: row.user_id,
      phone: row.phone || '',
      query: row.query || '',
      status: row.status || 'open',
      notes: row.notes || '',
      updated_at: row.updated_at || new Date().toISOString(),
    };
    return await store.upsertRow(TABS.support, 'user_id', formatted);
  } catch (err) {
    logger.warn('Google Sheets saveSupportRow failed:', err.message);
    return row;
  }
}

// ---------------------------------------------------------------------
// LeadStatus  (CRM Lead Tracking & Follow-ups)
// ---------------------------------------------------------------------

async function saveLeadStatusRow(row) {
  if (!isConfigured()) return row;
  try {
    const formatted = {
      user_id: row.user_id,
      phone: row.phone || '',
      name: row.name || '',
      status: row.status || 'new',
      remarks: row.remarks || '',
      updated_at: row.updated_at || new Date().toISOString(),
    };
    return await store.upsertRow(TABS.leadStatus, 'user_id', formatted);
  } catch (err) {
    logger.warn('Google Sheets saveLeadStatusRow failed:', err.message);
    return row;
  }
}

/**
 * Initialize a tab with default headers if it's currently empty
 */
async function initTabWithHeaders(tabTitle, sampleData) {
  if (!isConfigured()) return;
  try {
    await store.upsertRow(tabTitle, 'user_id', sampleData);
  } catch (err) {
    logger.warn(`Failed to init tab ${tabTitle}:`, err.message);
  }
}

/**
 * Bulk sync an array of bookings to Google Sheets
 */
async function syncAllBookingsToSheets(bookings) {
  if (!isConfigured()) {
    throw new Error('Google Sheets is not configured.');
  }
  let count = 0;
  for (const b of bookings) {
    try {
      await saveBookVehicleRow(b);
      count++;
    } catch (e) {
      logger.warn(`Failed to sync booking ${b.user_id} to sheet:`, e.message);
    }
  }
  return { syncedCount: count, total: bookings.length };
}

module.exports = {
  isConfigured,
  getMasterRowsByPhone,
  saveMasterSession,
  getBookVehicleRow,
  saveBookVehicleRow,
  getProvideVehicleRow,
  saveProvideVehicleRow,
  getSupportRow,
  saveSupportRow,
  saveLeadStatusRow,
  initTabWithHeaders,
  syncAllBookingsToSheets,
};
