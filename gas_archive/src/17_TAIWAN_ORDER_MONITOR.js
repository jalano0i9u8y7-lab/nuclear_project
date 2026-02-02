/**
 * 📋 台股掛單監控系統（Taiwan Order Monitor）
 * 
 * ⚠️ V8.0 變更：此檔案已廢棄
 * - 功能已完全搬移到 P6（28_P6_INTRADAY_MONITOR.js）
 * - P6 在盤中每 20 分鐘檢查台股目標價
 * 
 * @version SSOT V8.0（已廢棄）
 * @date 2026-01-17
 */

// ==========================================
// 掛單類型配置
// ==========================================

const TAIWAN_ORDER_TYPES = {
  "BUY": {
    trigger_condition: "current_price <= target_price",  // 買入：當前價格 <= 目標價格
    notification_template: "【台股買入提醒】{ticker} {name} 已達到目標買入價位 {target_price}，目前價格：{current_price}"
  },
  "SELL": {
    trigger_condition: "current_price >= target_price",  // 賣出：當前價格 >= 目標價格
    notification_template: "【台股賣出提醒】{ticker} {name} 已達到目標賣出價位 {target_price}，目前價格：{current_price}"
  },
  "STOP_LOSS": {
    trigger_condition: "current_price <= target_price",  // 停損：當前價格 <= 停損價格
    notification_template: "【台股停損提醒】{ticker} {name} 已觸及停損價位 {target_price}，目前價格：{current_price}，請立即處理！"
  },
  "TAKE_PROFIT": {
    trigger_condition: "current_price >= target_price",  // 停利：當前價格 >= 停利價格
    notification_template: "【台股停利提醒】{ticker} {name} 已達到停利價位 {target_price}，目前價格：{current_price}"
  }
};

// ==========================================
// 核心函數
// ==========================================

/**
 * 添加台股掛單監控
 * @param {Object} orderInfo - 掛單資訊
 * @param {string} orderInfo.ticker - 股票代碼
 * @param {string} orderInfo.name - 股票名稱
 * @param {string} orderInfo.order_type - 掛單類型（BUY / SELL / STOP_LOSS / TAKE_PROFIT）
 * @param {number} orderInfo.target_price - 目標價格
 * @param {number} orderInfo.quantity - 數量（可選）
 * @param {string} orderInfo.reason - 原因（可選）
 * @param {string} orderInfo.source_phase - 來源 Phase（例如：P4、P5.5）
 * @return {string} 監控 ID
 */
function addTaiwanOrderMonitor(orderInfo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("TAIWAN_ORDER_MONITOR");
  
  if (!sheet) {
    // 創建表格
    sheet = ss.insertSheet("TAIWAN_ORDER_MONITOR");
    sheet.appendRow([
      "monitor_id",
      "ticker",
      "name",
      "order_type",
      "target_price",
      "quantity",
      "reason",
      "source_phase",
      "current_price",
      "triggered",
      "notified",
      "created_at",
      "triggered_at",
      "notified_at",
      "status"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const monitorId = `TWMON_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  sheet.appendRow([
    monitorId,
    orderInfo.ticker,
    orderInfo.name || "",
    orderInfo.order_type,
    orderInfo.target_price,
    orderInfo.quantity || 0,
    orderInfo.reason || "",
    orderInfo.source_phase || "",
    null,  // current_price（待更新）
    false,  // triggered
    false,  // notified
    new Date(),  // created_at
    null,  // triggered_at
    null,  // notified_at
    "ACTIVE"  // status
  ]);
  
  Logger.log(`台股掛單監控已添加：monitor_id=${monitorId}, ticker=${orderInfo.ticker}, target_price=${orderInfo.target_price}`);
  
  return monitorId;
}

/**
 * 檢查台股掛單監控（在 P5 Daily 中調用）
 * @param {Array} currentPrices - 當前價格列表 [{ ticker: "2330", price: 580.5 }, ...]
 * @return {Array} 觸發的監控列表
 */
function checkTaiwanOrderMonitor(currentPrices) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TAIWAN_ORDER_MONITOR");
  
  if (!sheet) {
    Logger.log("TAIWAN_ORDER_MONITOR 表格不存在，跳過檢查");
    return [];
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  
  if (rows.length <= 1) {
    return [];  // 沒有監控記錄
  }
  
  // 建立價格映射表
  const priceMap = {};
  for (const priceData of currentPrices) {
    priceMap[priceData.ticker] = priceData.price;
  }
  
  const triggeredOrders = [];
  
  // 檢查每一筆監控記錄
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const monitorId = row[0];
    const ticker = row[1];
    const orderType = row[3];
    const targetPrice = row[4];
    const triggered = row[9];
    const notified = row[10];
    const status = row[14];
    
    // 跳過已觸發、已通知或已關閉的記錄
    if (triggered || notified || status !== "ACTIVE") {
      continue;
    }
    
    // 獲取當前價格
    const currentPrice = priceMap[ticker];
    if (!currentPrice || currentPrice <= 0) {
      continue;  // 沒有當前價格數據
    }
    
    // 更新當前價格
    sheet.getRange(i + 1, 9).setValue(currentPrice);
    
    // 檢查是否觸發
    const orderConfig = TAIWAN_ORDER_TYPES[orderType];
    if (!orderConfig) {
      Logger.log(`警告：未知的掛單類型：${orderType}`);
      continue;
    }
    
    let isTriggered = false;
    
    if (orderType === "BUY" || orderType === "STOP_LOSS") {
      // 買入或停損：當前價格 <= 目標價格
      isTriggered = currentPrice <= targetPrice;
    } else if (orderType === "SELL" || orderType === "TAKE_PROFIT") {
      // 賣出或停利：當前價格 >= 目標價格
      isTriggered = currentPrice >= targetPrice;
    }
    
    if (isTriggered) {
      // 標記為已觸發
      sheet.getRange(i + 1, 10).setValue(true);  // triggered
      sheet.getRange(i + 1, 12).setValue(new Date());  // triggered_at
      
      // 發送通知
      const name = row[2] || ticker;
      const notification = generateTaiwanOrderNotification(
        ticker,
        name,
        orderType,
        targetPrice,
        currentPrice
      );
      
      sendTaiwanOrderNotification(monitorId, notification, row);
      
      // 標記為已通知
      sheet.getRange(i + 1, 11).setValue(true);  // notified
      sheet.getRange(i + 1, 13).setValue(new Date());  // notified_at
      
      triggeredOrders.push({
        monitor_id: monitorId,
        ticker: ticker,
        name: name,
        order_type: orderType,
        target_price: targetPrice,
        current_price: currentPrice,
        notification: notification
      });
      
      Logger.log(`台股掛單觸發：${ticker} ${orderType} 目標價=${targetPrice}, 當前價=${currentPrice}`);
    }
  }
  
  return triggeredOrders;
}

/**
 * 生成台股掛單通知訊息
 */
function generateTaiwanOrderNotification(ticker, name, orderType, targetPrice, currentPrice) {
  const config = TAIWAN_ORDER_TYPES[orderType];
  
  if (!config) {
    return `【台股掛單提醒】${ticker} ${name} 已達到目標價位 ${targetPrice}，目前價格：${currentPrice}`;
  }
  
  return config.notification_template
    .replace("{ticker}", ticker)
    .replace("{name}", name)
    .replace("{target_price}", targetPrice.toFixed(2))
    .replace("{current_price}", currentPrice.toFixed(2));
}

/**
 * 發送台股掛單通知
 */
function sendTaiwanOrderNotification(monitorId, notification, rowData) {
  // 這裡可以擴展為多種通知方式：
  // 1. Email（使用 MailApp）
  // 2. LINE Notify
  // 3. Slack Webhook
  // 4. 記錄到表格（目前實現）
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("TAIWAN_ORDER_NOTIFICATIONS");
  
  if (!sheet) {
    // 創建通知記錄表格
    sheet = ss.insertSheet("TAIWAN_ORDER_NOTIFICATIONS");
    sheet.appendRow([
      "notification_id",
      "monitor_id",
      "ticker",
      "notification_message",
      "sent_at",
      "status"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const notificationId = `TWNOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  sheet.appendRow([
    notificationId,
    monitorId,
    rowData[1],  // ticker
    notification,
    new Date(),
    "SENT"
  ]);
  
  Logger.log(`台股掛單通知已發送：${notificationId}`);
  
  // TODO: 擴展為 Email 或 LINE Notify
  // 例如：
  // MailApp.sendEmail({
  //   to: "user@example.com",
  //   subject: "台股掛單提醒",
  //   body: notification
  // });
}

/**
 * 取消台股掛單監控
 * @param {string} monitorId - 監控 ID
 */
function cancelTaiwanOrderMonitor(monitorId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TAIWAN_ORDER_MONITOR");
  
  if (!sheet) {
    throw new Error("TAIWAN_ORDER_MONITOR 表格不存在");
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === monitorId) {
      sheet.getRange(i + 1, 15).setValue("CANCELLED");  // status
      Logger.log(`台股掛單監控已取消：monitor_id=${monitorId}`);
      return true;
    }
  }
  
  throw new Error(`找不到監控 ID：${monitorId}`);
}

/**
 * 從 P4 或其他 Phase 批量添加台股掛單監控
 * @param {Array} orders - 掛單列表
 */
function batchAddTaiwanOrderMonitor(orders) {
  const results = [];
  
  for (const order of orders) {
    try {
      // 只處理台灣股票（代碼格式：4 位數字或 5 位數字）
      const ticker = order.ticker || order.code || "";
      if (!/^\d{4,5}$/.test(ticker)) {
        continue;  // 不是台灣股票代碼
      }
      
      const monitorId = addTaiwanOrderMonitor(order);
      results.push({
        ticker: ticker,
        monitor_id: monitorId,
        success: true
      });
    } catch (error) {
      results.push({
        ticker: order.ticker || order.code || "UNKNOWN",
        success: false,
        error: error.message
      });
    }
  }
  
  Logger.log(`批量添加台股掛單監控完成：成功=${results.filter(r => r.success).length}, 失敗=${results.filter(r => !r.success).length}`);
  
  return results;
}
