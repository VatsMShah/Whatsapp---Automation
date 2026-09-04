const store = require('./sheetsStore');
const config = require('../config');

const TABS = config.google.tabs;

// ---------------------------------------------------------------------
// users_master  (equivalent of "Get Master Row" / "Save Master Session")
// ---------------------------------------------------------------------

/** Equivalent of "Get Master Row" — filters users_master by exact phone match. */
async function getMasterRowsByPhone(phone) {
  const rows = await store.findRows(TABS.master, 'phone', phone);
  return rows.map((r) => r.toObject());
}

/** Equivalent of "Save Master Session" — upsert keyed on user_id. */
async function saveMasterSession(row) {
  return store.upsertRow(TABS.master, 'user_id', {
    user_id: row.user_id,
    state: row.state,
    updated_at: row.updated_at,
    flowType: row.flowType,
    phone: row.phone,
    data: row.data,
  });
}

// ---------------------------------------------------------------------
// BookVehicle  (equivalent of "BookVehicleGetRows" / "BookVehicleAppendUpdateRow")
// ---------------------------------------------------------------------

async function getBookVehicleRow(userId) {
  const rows = await store.findRows(TABS.book, 'user_id', userId);
  return rows.length > 0 ? rows[0].toObject() : {};
}

async function saveBookVehicleRow(row) {
  return store.upsertRow(TABS.book, 'user_id', row);
}

// ---------------------------------------------------------------------
// ProvideVehicle  (equivalent of "ProvideVehicleGetRows" / "ProvideVehicleAppendUpdateRow1")
// ---------------------------------------------------------------------

async function getProvideVehicleRow(userId) {
  const rows = await store.findRows(TABS.provider, 'user_id', userId);
  return rows.length > 0 ? rows[0].toObject() : {};
}

async function saveProvideVehicleRow(row) {
  return store.upsertRow(TABS.provider, 'user_id', row);
}

// ---------------------------------------------------------------------
// Support  (equivalent of "SupportGetRows" / "SupportAppendUpdateRow")
// ---------------------------------------------------------------------

async function getSupportRow(userId) {
  const rows = await store.findRows(TABS.support, 'user_id', userId);
  return rows.length > 0 ? rows[0].toObject() : {};
}

async function saveSupportRow(row) {
  return store.upsertRow(TABS.support, 'user_id', row);
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
