const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config');
const logger = require('../utils/logger');

let docPromise = null;

/**
 * Lazily authenticates and loads the spreadsheet once, then reuses it.
 * (google-spreadsheet caches sheet metadata on the instance, so we don't
 * want to re-create this on every webhook call.)
 */
function getDoc() {
  if (!docPromise) {
    const auth = new JWT({
      email: config.google.serviceAccountEmail,
      key: config.google.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(config.google.sheetId, auth);
    docPromise = doc.loadInfo().then(() => doc);
  }
  return docPromise;
}

async function getSheet(tabTitle) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[tabTitle];
  if (!sheet) {
    throw new Error(
      `Sheet tab "${tabTitle}" not found. Check the tab name matches exactly ` +
      `(case-sensitive) and that the service account has access to the spreadsheet.`
    );
  }
  return sheet;
}

/**
 * Equivalent of an n8n Google Sheets "Get Rows" node with a filter —
 * returns all rows where `column` equals `value` (as strings, matching
 * how n8n's Sheets node compares filter values).
 */
async function findRows(tabTitle, column, value) {
  const sheet = await getSheet(tabTitle);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  return rows.filter((r) => String(r.get(column) ?? '') === String(value ?? ''));
}

/**
 * Equivalent of an n8n Google Sheets "Append or Update Row" node —
 * finds the row where `matchColumn` equals `data[matchColumn]`; updates it
 * if found, otherwise appends a new row. Returns the plain-object result.
 */
async function upsertRow(tabTitle, matchColumn, data) {
  const sheet = await getSheet(tabTitle);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();

  const matchValue = String(data[matchColumn] ?? '');
  const existing = rows.find((r) => String(r.get(matchColumn) ?? '') === matchValue);

  if (existing) {
    for (const [key, value] of Object.entries(data)) {
      existing.set(key, value === undefined || value === null ? '' : value);
    }
    await existing.save();
    logger.info(`Updated row in "${tabTitle}"`, { [matchColumn]: matchValue });
    return existing.toObject();
  }

  const newRow = await sheet.addRow(data);
  logger.info(`Appended row in "${tabTitle}"`, { [matchColumn]: matchValue });
  return newRow.toObject();
}

module.exports = { getDoc, findRows, upsertRow };
