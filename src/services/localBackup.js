const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const BACKUP_DIR = path.resolve(__dirname, '../../data/backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const FILES = {
  book_vehicle: path.join(BACKUP_DIR, 'book_vehicle.jsonl'),
  users_master: path.join(BACKUP_DIR, 'users_master.jsonl'),
  provide_vehicle: path.join(BACKUP_DIR, 'provide_vehicle.jsonl'),
  support: path.join(BACKUP_DIR, 'support.jsonl'),
  meta: path.join(BACKUP_DIR, 'backup_meta.json'),
};

/**
 * Reads all rows from a .jsonl file, returning a Map keyed by idField (default user_id)
 */
function readJsonl(filePath, idField = 'user_id') {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj[idField]) {
          map.set(String(obj[idField]), obj);
        }
      } catch (e) {
        // skip malformed line
      }
    }
  } catch (err) {
    logger.error(`Error reading backup file ${filePath}:`, err);
  }
  return map;
}

/**
 * Rewrites a Map to a .jsonl file
 */
function writeJsonl(filePath, map) {
  try {
    const lines = [];
    for (const item of map.values()) {
      lines.push(JSON.stringify(item));
    }
    fs.writeFileSync(filePath, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf-8');
  } catch (err) {
    logger.error(`Error writing backup file ${filePath}:`, err);
  }
}

/**
 * Updates metadata JSON
 */
function updateMeta(table, recordId) {
  try {
    let meta = {
      lastBackupAt: new Date().toISOString(),
      counts: {},
      pendingSupabaseSync: 0,
    };
    if (fs.existsSync(FILES.meta)) {
      meta = JSON.parse(fs.readFileSync(FILES.meta, 'utf-8') || '{}');
    }

    meta.lastBackupAt = new Date().toISOString();
    meta.lastUpdatedTable = table;
    meta.lastRecordId = recordId;

    // Recount
    const bookMap = readJsonl(FILES.book_vehicle);
    let pending = 0;
    for (const b of bookMap.values()) {
      if (b._synced_to_supabase === false) pending++;
    }

    meta.counts = {
      book_vehicle: bookMap.size,
      users_master: readJsonl(FILES.users_master).size,
      provide_vehicle: readJsonl(FILES.provide_vehicle).size,
      support: readJsonl(FILES.support).size,
    };
    meta.pendingSupabaseSync = pending;

    fs.writeFileSync(FILES.meta, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    // ignore
  }
}

/**
 * Save or update a record in the local disk backup vault
 * @param {'book_vehicle' | 'users_master' | 'provide_vehicle' | 'support'} table
 * @param {object} row
 * @param {boolean} syncedToSupabase - whether Supabase write succeeded
 */
function saveRecord(table, row, syncedToSupabase = false) {
  if (!FILES[table] || !row || !row.user_id) return row;

  try {
    const filePath = FILES[table];
    const map = readJsonl(filePath);
    const existing = map.get(String(row.user_id)) || {};

    const enriched = {
      ...existing,
      ...row,
      _local_backup_at: new Date().toISOString(),
      _synced_to_supabase: syncedToSupabase,
    };

    map.set(String(row.user_id), enriched);
    writeJsonl(filePath, map);
    updateMeta(table, row.user_id);

    logger.info(`💾 Local disk vault: Saved ${table} for ${row.user_id} (Supabase synced: ${syncedToSupabase})`);
    return enriched;
  } catch (err) {
    logger.error(`Failed to save record to local backup vault:`, err);
    return row;
  }
}

/**
 * Mark a record as successfully synced to Supabase
 */
function markSyncedToSupabase(table, userId) {
  if (!FILES[table]) return;
  try {
    const filePath = FILES[table];
    const map = readJsonl(filePath);
    if (map.has(String(userId))) {
      const item = map.get(String(userId));
      item._synced_to_supabase = true;
      item._synced_at = new Date().toISOString();
      map.set(String(userId), item);
      writeJsonl(filePath, map);
      updateMeta(table, userId);
    }
  } catch (err) {
    logger.error('Failed to mark synced to Supabase:', err);
  }
}

/**
 * Get all rows for a table from local disk
 */
function getRecords(table) {
  if (!FILES[table]) return [];
  const map = readJsonl(FILES[table]);
  return Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.updated_at || a._local_backup_at || 0).getTime();
    const tB = new Date(b.updated_at || b._local_backup_at || 0).getTime();
    return tB - tA;
  });
}

/**
 * Get all records that failed to sync to Supabase
 */
function getPendingSupabaseRecords(table = 'book_vehicle') {
  const records = getRecords(table);
  return records.filter((r) => r._synced_to_supabase === false);
}

/**
 * Get backup stats for dashboard
 */
function getBackupStats() {
  try {
    const bookMap = readJsonl(FILES.book_vehicle);
    const masterMap = readJsonl(FILES.users_master);
    const supportMap = readJsonl(FILES.support);
    const providerMap = readJsonl(FILES.provide_vehicle);

    let pendingBookings = 0;
    for (const b of bookMap.values()) {
      if (b._synced_to_supabase === false) pendingBookings++;
    }

    let meta = {};
    if (fs.existsSync(FILES.meta)) {
      try {
        meta = JSON.parse(fs.readFileSync(FILES.meta, 'utf-8'));
      } catch (e) {}
    }

    return {
      status: 'active',
      backupDirectory: BACKUP_DIR,
      lastBackupAt: meta.lastBackupAt || new Date().toISOString(),
      counts: {
        book_vehicle: bookMap.size,
        users_master: masterMap.size,
        provide_vehicle: providerMap.size,
        support: supportMap.size,
        total: bookMap.size + masterMap.size + supportMap.size + providerMap.size,
      },
      pendingSupabaseSync: pendingBookings,
    };
  } catch (err) {
    logger.error('Failed to get backup stats:', err);
    return {
      status: 'error',
      error: err.message,
    };
  }
}

/**
 * Convert an array of objects to CSV string
 */
function toCSV(records, fields) {
  if (!records || records.length === 0) return '';
  const headers = fields || Object.keys(records[0]).filter((k) => !k.startsWith('_'));
  
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = records.map((row) =>
    headers.map((h) => escapeCell(row[h])).join(',')
  );

  return [headerLine, ...rowLines].join('\n');
}

module.exports = {
  saveRecord,
  markSyncedToSupabase,
  getRecords,
  getPendingSupabaseRecords,
  getBackupStats,
  toCSV,
  BACKUP_DIR,
};
