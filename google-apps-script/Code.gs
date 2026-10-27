var SHEET_ID = "1IdG2oaGPdGDzY4H5JwPa0eeHKdXzivMNwkhBslJ5ZUI";

function doGet(e) {
  return ContentService.createTextOutput("✅ Traket WhatsApp Bot Google Sheet Webhook is Live!").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var payload = JSON.parse(e.postData.contents);
    var targetSheetId = payload.sheetId || SHEET_ID;
    var ss = SpreadsheetApp.openById(targetSheetId);

    // =========================================================================
    // 1. FULL SYNC OF ALL SUPABASE TABLES (Data Structure + Records)
    // =========================================================================
    if (payload.action === "sync_all" && payload.tables) {
      var tableNames = Object.keys(payload.tables);

      tableNames.forEach(function(tableName) {
        var tableData = payload.tables[tableName];
        var headers = tableData.headers || [];
        var rows = tableData.rows || [];

        var sheet = ss.getSheetByName(tableName) || ss.insertSheet(tableName);
        sheet.clear();

        if (headers.length > 0) {
          var matrix = [headers];
          rows.forEach(function(r) {
            var rowVals = headers.map(function(h) {
              var val = r[h];
              return val !== undefined && val !== null 
                ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) 
                : "";
            });
            matrix.push(rowVals);
          });

          sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);

          // Header styling
          var headerRange = sheet.getRange(1, 1, 1, headers.length);
          headerRange.setFontWeight("bold");
          headerRange.setBackground("#1E293B"); // Elegant Dark Slate
          headerRange.setFontColor("#FFFFFF");
          sheet.setFrozenRows(1);
          sheet.autoResizeColumns(1, Math.min(headers.length, 25));
        }
      });

      // Remove legacy/test tabs
      var cleanupTabs = ["Sheet1", "test_ping", "test_concurrency", "BookVehicle"];
      cleanupTabs.forEach(function(tName) {
        var s = ss.getSheetByName(tName);
        if (s && ss.getSheets().length > 1) {
          try { ss.deleteSheet(s); } catch (err) {}
        }
      });

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "All Supabase tables synced successfully!", 
        syncedTables: tableNames 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 2. LIVE WHATSAPP BOT UPSERT (Background Auto-Backup)
    // =========================================================================
    var tabTitle = payload.tabTitle || "book_vehicle";
    var sheet = ss.getSheetByName(tabTitle) || ss.insertSheet(tabTitle);
    var data = payload.data || {};
    var headers = Object.keys(data);
    var matchColumn = payload.matchColumn || "user_id";
    var matchValue = String(data[matchColumn] || "");

    if (sheet.getLastRow() === 0 && headers.length > 0) {
      sheet.appendRow(headers);
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setFontWeight("bold");
      hr.setBackground("#1E293B");
      hr.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var colIndex = existingHeaders.indexOf(matchColumn);
    var rowValues = existingHeaders.map(function(h) {
      var val = data[h];
      return val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : "";
    });

    var rowFound = -1;
    if (colIndex !== -1 && matchValue !== "" && sheet.getLastRow() > 1) {
      var colValues = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < colValues.length; i++) {
        if (String(colValues[i][0]) === matchValue) {
          rowFound = i + 2;
          break;
        }
      }
    }

    if (rowFound > 0) {
      sheet.getRange(rowFound, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", updatedRow: rowFound }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
