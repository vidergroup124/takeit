/**
 * ============================================================================
 * TakeIT Store - Google Apps Script สำหรับบันทึกคำสั่งซื้อและเช่าแผ่นเกมลง Google Sheets
 * ============================================================================
 * วิธีติดตั้ง / อัปเดต (ใช้เวลาเพียง 1 นาที):
 * 1. เปิด Google Sheets ของร้าน:
 *    https://docs.google.com/spreadsheets/d/1Aoz7JwpgkzeaEZJR_nDtht5gvoiMu-0K9qjvl7A40WQ/edit
 * 2. ไปที่เมนู Extensions (ส่วนขยาย) > Apps Script
 * 3. ลบโค้ดเก่าออกทั้งหมด แล้ววางโค้ดไฟล์นี้ลงไปแทนที่ จากนั้นกดปุ่ม Save (💾)
 * 4. กดปุ่ม Deploy (ทำให้ใช้งานได้) มุมขวาบน > เลือก New deployment (การทำให้ใช้งานได้รายการใหม่)
 * 5. เลือกชนิดเป็น "Web app" (เว็บแอป) และตั้งค่าดังนี้:
 *    - Execute as: Me (ฉัน)
 *    - Who has access: Anyone (ทุกคน)  <-- สำคัญมาก! ต้องเลือก Anyone (ทุกคน) เท่านั้น
 * 6. กด Deploy แล้วคัดลอก Web app URL (ลงท้ายด้วย /exec) มาใส่ในเว็บ TakeIT
 * ============================================================================
 */

const SPREADSHEET_ID = '1Aoz7JwpgkzeaEZJR_nDtht5gvoiMu-0K9qjvl7A40WQ';
const SHEET_ORDERS = 'Orders';
const SHEET_PRODUCTS = 'Products';

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * สามารถกดปุ่ม ▶️ Run (เรียกใช้) ฟังก์ชันนี้ในหน้า Apps Script โดยตรง
 * เพื่อสร้างหัวตารางและจัดความสวยงามในชีตทันที
 */
function setupSheetTableNow() {
  const ss = getSpreadsheet();
  ensureOrderSheet(ss);
  ensureProductSheet(ss);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    let rawData = '{}';
    if (e && e.postData && e.postData.contents) {
      rawData = e.postData.contents;
    } else if (e && e.parameter && e.parameter.payload) {
      rawData = e.parameter.payload;
    }
    const payload = JSON.parse(rawData);
    return processWebhookPayload(payload);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (e && e.parameter && e.parameter.payload) {
      const payload = JSON.parse(e.parameter.payload);
      return processWebhookPayload(payload);
    }

    const action = (e && e.parameter && e.parameter.action) || 'status';
    const ss = getSpreadsheet();
    ensureOrderSheet(ss);

    if (action === 'get_products') {
      const sheet = ensureProductSheet(ss);
      const rows = sheet.getDataRange().getValues();
      if (rows.length <= 1) {
        return jsonResponse({ status: 'success', products: [] });
      }
      const products = [];
      for (let i = 1; i < rows.length; i++) {
        const jsonCol = rows[i][9];
        if (jsonCol) {
          try {
            products.push(JSON.parse(jsonCol));
          } catch (err) {}
        }
      }
      return jsonResponse({ status: 'success', products: products });
    }

    return jsonResponse({
      status: 'ok',
      service: 'TakeIT Google Sheets Webhook Ready',
      sheetName: ss.getName()
    });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function processWebhookPayload(payload) {
  const action = payload.action || 'create_order';
  const ss = getSpreadsheet();

  if (action === 'test_connection') {
    ensureOrderSheet(ss);
    return jsonResponse({
      status: 'success',
      message: 'เชื่อมต่อกับ Google Sheets ของร้าน TakeIT สำเร็จแล้ว!'
    });
  }

  if (action === 'create_order' || action === 'sync_order') {
    const sheet = ensureOrderSheet(ss);
    const order = payload.order || payload;
    upsertOrderRow(sheet, order);
    return jsonResponse({
      status: 'success',
      orderId: order.id
    });
  }

  if (action === 'delete_order') {
    const sheet = ensureOrderSheet(ss);
    const targetId = payload.orderId || (payload.order && payload.order.id) || '';
    const deleted = deleteOrderRowById(sheet, targetId);
    return jsonResponse({
      status: 'success',
      deleted: deleted,
      orderId: targetId
    });
  }

  if (action === 'sync_all_orders' && Array.isArray(payload.orders)) {
    const sheet = ensureOrderSheet(ss);
    payload.orders.forEach(function(order) {
      upsertOrderRow(sheet, order);
    });
    return jsonResponse({
      status: 'success',
      count: payload.orders.length
    });
  }

  if (action === 'sync_products' && Array.isArray(payload.products)) {
    const productSheet = ensureProductSheet(ss);
    syncProductsToSheet(productSheet, payload.products);
    return jsonResponse({
      status: 'success',
      count: payload.products.length
    });
  }

  return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
}

function ensureOrderSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_ORDERS);
  if (!sheet) {
    const allSheets = ss.getSheets();
    // หากแท็บแรกสุด (gid=0 เช่น ชีต1 หรือ Sheet1) ยังว่างอยู่ ให้ใช้แท็บแรกสุดทันทีเพื่อให้เปิดลิงก์มาแล้วเห็นข้อมูลเลย
    if (allSheets.length > 0 && allSheets[0].getLastRow() === 0 && allSheets[0].getName() !== SHEET_PRODUCTS) {
      sheet = allSheets[0];
      try {
        sheet.setName(SHEET_ORDERS);
      } catch (e) {}
    } else {
      sheet = ss.insertSheet(SHEET_ORDERS, 0);
    }
  }

  if (sheet.getLastRow() === 0) {
    const headers = [
      'รหัสคำสั่งซื้อ (Order ID)',
      'วัน-เวลาที่สั่ง',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'Line ID / ช่องทางติดต่อ',
      'ที่อยู่จัดส่ง',
      'รูปแบบคำสั่งซื้อ',
      'รายละเอียดสินค้า / การเช่าแผ่น',
      'ยอดซื้อสินค้า (บาท)',
      'ค่าเช่าแผ่นรวม (บาท)',
      'ค่ามัดจำแผ่นรวม (บาท)',
      'ค่าจัดส่ง (บาท)',
      'ยอดชำระสุทธิ (บาท)',
      'สถานะคำสั่งซื้อ',
      'หลักฐานการโอน (สลิป)',
      'หมายเหตุจากลูกค้า'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#38bdf8');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertOrderRow(sheet, order) {
  const itemsSummary = (order.items || []).map(function(item, idx) {
    if (item.mode === 'rent') {
      return (idx + 1) + '. [เช่าแผ่น] ' + item.name + ' (' + item.platform + ') x' + item.qty +
        ' | เช่า ' + item.rentDays + ' วัน (' + item.rentRate + ' บ./วัน = ' + (item.rentRate * item.rentDays * item.qty) + ' บ.)' +
        ' | มัดจำ ' + (item.deposit * item.qty) + ' บ.' +
        (item.rentStartDate ? ' | เริ่ม ' + item.rentStartDate + ' คืน ' + item.rentEndDate : '');
    } else {
      return (idx + 1) + '. [ซื้อขาด] ' + item.name + ' (' + item.platform + ') x' + item.qty +
        ' = ' + (item.price * item.qty) + ' บ.';
    }
  }).join('\n');

  const rowValues = [
    order.id || '',
    order.createdAtFormatted || order.createdAt || new Date().toLocaleString('th-TH'),
    (order.customer && order.customer.name) || '',
    (order.customer && order.customer.phone) ? "'" + order.customer.phone : '',
    (order.customer && order.customer.lineId) || '-',
    (order.customer && order.customer.address) || '',
    order.orderTypeLabel || 'ซื้อ/เช่าสินค้า',
    itemsSummary,
    Number(order.buySubtotal || 0),
    Number(order.rentSubtotal || 0),
    Number(order.depositSubtotal || 0),
    Number(order.shippingFee || 0),
    Number(order.grandTotal || 0),
    order.statusLabel || order.status || 'รอตรวจสอบสลิป',
    order.slipNote || (order.slipDataUrl ? 'แนบสลิปแล้ว (ดูรูปในหน้า Admin)' : 'ยังไม่ได้แนบสลิป'),
    (order.customer && order.customer.note) || '-'
  ];

  const data = sheet.getDataRange().getValues();
  let foundRowIndex = -1;
  const lookupId = String(order.originalOrderId || order.id || '');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === lookupId) {
      foundRowIndex = i + 1;
      break;
    }
  }

  if (order.isDeletedByAdmin || order._deleteFromSheet) {
    if (foundRowIndex > 1) {
      sheet.deleteRow(foundRowIndex);
    }
    return;
  }

  if (foundRowIndex > 1) {
    sheet.getRange(foundRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteOrderRowById(sheet, orderId) {
  if (!orderId) return false;
  const data = sheet.getDataRange().getValues();
  let deletedAny = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(orderId)) {
      sheet.deleteRow(i + 1);
      deletedAny = true;
    }
  }
  return deletedAny;
}

function ensureProductSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PRODUCTS);
  }
  if (sheet.getLastRow() === 0) {
    const headers = [
      'รหัสสินค้า',
      'ชื่อสินค้า',
      'หมวดหมู่',
      'แพลตฟอร์ม',
      'ราคาขาย (บาท)',
      'เปิดให้เช่า',
      'ราคาเช่า/วัน (บาท)',
      'ค่ามัดจำแผ่น (บาท)',
      'สต็อกคงเหลือ',
      'RAW_JSON'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#a855f7');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function syncProductsToSheet(sheet, products) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).clearContent();
  }
  if (!products.length) return;
  const rows = products.map(function(p) {
    return [
      p.id,
      p.name,
      p.category,
      p.platform,
      Number(p.price || 0),
      p.canRent ? 'เช่าได้' : 'ขายอย่างเดียว',
      Number(p.rentPricePerDay || 0),
      Number(p.rentDeposit || 0),
      Number(p.stock || 0),
      JSON.stringify(p)
    ];
  });
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
