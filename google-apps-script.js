// ===================================================================
// 起士公爵 生產良率監測系統 — Google Apps Script 後端
// ===================================================================
// 使用方式：
// 1. 開一個新的 Google Sheets（命名為「起士公爵_生產監測資料庫」）
// 2. 點選 擴充功能 → Apps Script
// 3. 把這整段程式碼貼進去（取代原本的 function myFunction）
// 4. 點選 部署 → 新增部署作業
//    - 類型選「網頁應用程式」
//    - 執行身分：我
//    - 存取權限：「所有人」
// 5. 點「部署」，授權後複製 Web App URL
// 6. 到監測系統的「管理設定」→ 貼上此 URL
// ===================================================================

// ========== 自動建立工作表結構 ==========
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 記錄表
  let sheet = ss.getSheetByName('記錄');
  if (!sheet) {
    sheet = ss.insertSheet('記錄');
    sheet.appendRow(['日期','時間戳記','操作人員','工作站','批次','口味','合格數','異常數','嚴重數','外觀不良','備註','原始數據']);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#3A7D5C').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }

  // 工單表
  let woSheet = ss.getSheetByName('工單');
  if (!woSheet) {
    woSheet = ss.insertSheet('工單');
    woSheet.appendRow(['日期','批次編號','輪次','烤箱','口味']);
    woSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#2E6B8A').setFontColor('#fff');
    woSheet.setFrozenRows(1);
  }

  // 人員表
  let opSheet = ss.getSheetByName('人員');
  if (!opSheet) {
    opSheet = ss.insertSheet('人員');
    opSheet.appendRow(['姓名']);
    opSheet.getRange(1, 1, 1, 1).setFontWeight('bold').setBackground('#7B5EA7').setFontColor('#fff');
    opSheet.setFrozenRows(1);
  }

  // 刪除預設的 Sheet1
  const defaultSheet = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

// ========== HTTP 處理 ==========
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    initSheets();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'syncRecords') return syncRecords(data.records);
    if (action === 'saveWorkOrder') return saveWorkOrder(data.date, data.batches);
    if (action === 'saveOperators') return saveOperators(data.operators);
    if (action === 'init') { return jsonResp({ status: 'ok', message: '連線成功' }); }

    return jsonResp({ status: 'error', message: '未知操作: ' + action });
  } catch (err) {
    return jsonResp({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    initSheets();
    const action = e.parameter.action;

    if (action === 'getRecords') return getRecords(e.parameter.from, e.parameter.to);
    if (action === 'getWorkOrder') return getWorkOrder(e.parameter.date);
    if (action === 'getOperators') return getOperators();
    if (action === 'getRecordDates') return getRecordDates();
    if (action === 'ping') return jsonResp({ status: 'ok', time: new Date().toISOString() });

    return jsonResp({ status: 'error', message: '未知查詢: ' + action });
  } catch (err) {
    return jsonResp({ status: 'error', message: err.toString() });
  }
}

// ========== 記錄 ==========
function syncRecords(records) {
  if (!records || !records.length) return jsonResp({ status: 'ok', synced: 0 });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('記錄');
  const existing = sheet.getDataRange().getValues();

  // 建立已存在記錄的索引 (date+batch+station 為唯一鍵)
  const existingKeys = new Set();
  for (let i = 1; i < existing.length; i++) {
    const key = `${existing[i][0]}|${existing[i][4]}|${existing[i][3]}`;
    existingKeys.add(key);
  }

  let synced = 0;
  const newRows = [];

  records.forEach(r => {
    const key = `${r.date}|${r.batch}|${r.station}`;
    if (existingKeys.has(key)) {
      // 更新現有記錄
      for (let i = 1; i < existing.length; i++) {
        const eKey = `${existing[i][0]}|${existing[i][4]}|${existing[i][3]}`;
        if (eKey === key) {
          const row = i + 1;
          sheet.getRange(row, 1, 1, 12).setValues([[
            r.date, r.timestamp, r.operator, r.station, r.batch, r.flavor || '',
            r.summary.passCount || 0, r.summary.failCount || 0, r.summary.criticalCount || 0,
            (r.summary.defects || []).join('、'), r.notes || '',
            JSON.stringify(r.data || {})
          ]]);
          synced++;
          break;
        }
      }
    } else {
      newRows.push([
        r.date, r.timestamp, r.operator, r.station, r.batch, r.flavor || '',
        r.summary.passCount || 0, r.summary.failCount || 0, r.summary.criticalCount || 0,
        (r.summary.defects || []).join('、'), r.notes || '',
        JSON.stringify(r.data || {})
      ]);
      existingKeys.add(key);
      synced++;
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 12).setValues(newRows);
  }

  return jsonResp({ status: 'ok', synced: synced });
}

function getRecords(from, to) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('記錄');
  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const date = data[i][0];
    if (from && date < from) continue;
    if (to && date > to) continue;

    const defectsStr = data[i][9] || '';
    const defects = defectsStr ? defectsStr.split('、').filter(Boolean) : [];
    let rawData = {};
    try { rawData = JSON.parse(data[i][11] || '{}'); } catch(e) {}

    records.push({
      date: date,
      timestamp: data[i][1],
      operator: data[i][2],
      station: data[i][3],
      batch: data[i][4],
      flavor: data[i][5],
      data: rawData,
      defects: defects,
      notes: data[i][10] || '',
      summary: {
        passCount: parseInt(data[i][6]) || 0,
        failCount: parseInt(data[i][7]) || 0,
        criticalCount: parseInt(data[i][8]) || 0,
        defects: defects
      }
    });
  }

  return jsonResp({ status: 'ok', records: records });
}

function getRecordDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('記錄');
  const data = sheet.getDataRange().getValues();
  const dates = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) dates.add(data[i][0]);
  }
  return jsonResp({ status: 'ok', dates: [...dates].sort() });
}

// ========== 工單 ==========
function saveWorkOrder(date, batches) {
  if (!date || !batches) return jsonResp({ status: 'error', message: '缺少日期或批次' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('工單');
  const data = sheet.getDataRange().getValues();

  // 移除該日期的舊工單
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === date) rowsToDelete.push(i + 1);
  }
  rowsToDelete.forEach(r => sheet.deleteRow(r));

  // 寫入新工單
  const newRows = batches.map(b => [date, b.id, b.round, b.oven, b.flavor]);
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
  }

  return jsonResp({ status: 'ok', saved: batches.length });
}

function getWorkOrder(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('工單');
  const data = sheet.getDataRange().getValues();
  const batches = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === date) {
      batches.push({
        id: data[i][1],
        round: parseInt(data[i][2]) || 1,
        oven: data[i][3],
        flavor: data[i][4]
      });
    }
  }

  return jsonResp({ status: 'ok', batches: batches });
}

// ========== 人員 ==========
function saveOperators(operators) {
  if (!operators || !operators.length) return jsonResp({ status: 'error', message: '缺少人員' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('人員');

  // 清除舊資料（保留標題）
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).clearContent();
  }

  const newRows = operators.map(op => [op]);
  sheet.getRange(2, 1, newRows.length, 1).setValues(newRows);

  return jsonResp({ status: 'ok', saved: operators.length });
}

function getOperators() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('人員');
  const data = sheet.getDataRange().getValues();
  const operators = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) operators.push(data[i][0]);
  }
  return jsonResp({ status: 'ok', operators: operators });
}

// ========== 工具 ==========
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
