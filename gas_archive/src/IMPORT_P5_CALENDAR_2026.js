/**
 * 📅 P5 Calendar 2026 數據導入腳本
 * 
 * 將用戶提供的 2026 年重大財經行事曆和產業龍頭財報行事曆導入到 P5__CALENDAR 表格
 * 
 * 數據來源：
 * 1. 2026年全球重大財經行事曆（Markdown 格式）
 * 2. 各產業板塊風向球公司財報行事曆（Markdown 格式）
 * 
 * @version V1.0
 * @date 2025-01-14
 */

// ==========================================
// 數據導入主函數
// ==========================================

/**
 * 導入 2026 年重大財經行事曆和產業龍頭財報行事曆
 * 
 * 注意：此函數需要手動調用，並將 Markdown 數據作為參數傳入
 * 或者將 Markdown 數據保存為文件後讀取
 * 
 * @param {string} economicEventsMarkdown - 重大財經行事曆 Markdown 文本
 * @param {string} earningsCalendarMarkdown - 產業龍頭財報行事曆 Markdown 文本
 * @return {Object} 導入結果
 */
function importP5Calendar2026(economicEventsMarkdown, earningsCalendarMarkdown) {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log("📅 開始導入 P5 Calendar 2026 數據");
  Logger.log("=".repeat(60));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet) {
      // 如果表格不存在，先初始化
      Logger.log("P5__CALENDAR 表格不存在，先初始化...");
      initializeSheets();
      sheet = ss.getSheetByName("P5__CALENDAR");
      if (!sheet) {
        throw new Error("P5__CALENDAR 表格初始化失敗");
      }
    }
    
    // 確保表格結構是最新的（包含 date_estimated 和 date_source）
    migrateSheetsToV8_0(ss);
    
    // 解析並導入重大財經事件
    Logger.log("\n📊 開始導入重大財經事件...");
    const economicEvents = parseEconomicEventsMarkdown(economicEventsMarkdown);
    Logger.log(`解析到 ${economicEvents.length} 個重大財經事件`);
    
    let economicEventsImported = 0;
    for (const event of economicEvents) {
      try {
        const eventId = saveEventToCalendar(sheet, event);
        economicEventsImported++;
        Logger.log(`✓ 導入事件：${event.event_name} (${eventId})`);
      } catch (error) {
        Logger.log(`✗ 導入事件失敗：${event.event_name} - ${error.message}`);
      }
    }
    
    // 解析並導入產業龍頭財報
    Logger.log("\n💰 開始導入產業龍頭財報...");
    const earningsEvents = parseEarningsCalendarMarkdown(earningsCalendarMarkdown);
    Logger.log(`解析到 ${earningsEvents.length} 個財報事件`);
    
    let earningsEventsImported = 0;
    for (const event of earningsEvents) {
      try {
        const eventId = saveEventToCalendar(sheet, event);
        earningsEventsImported++;
        Logger.log(`✓ 導入財報：${event.event_name} (${eventId})`);
      } catch (error) {
        Logger.log(`✗ 導入財報失敗：${event.event_name} - ${error.message}`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 數據導入完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`重大財經事件：${economicEventsImported}/${economicEvents.length}`);
    Logger.log(`產業龍頭財報：${earningsEventsImported}/${earningsEvents.length}`);
    Logger.log("=".repeat(60));
    
    return {
      status: "COMPLETED",
      economic_events: {
        total: economicEvents.length,
        imported: economicEventsImported,
        failed: economicEvents.length - economicEventsImported
      },
      earnings_events: {
        total: earningsEvents.length,
        imported: earningsEventsImported,
        failed: earningsEvents.length - earningsEventsImported
      },
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 數據導入失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    throw error;
  }
}

// ==========================================
// Markdown 解析函數
// ==========================================

/**
 * 解析重大財經事件 Markdown
 * @param {string} markdown - Markdown 文本
 * @return {Array} 事件列表
 */
function parseEconomicEventsMarkdown(markdown) {
  const events = [];
  
  // 這裡需要根據實際的 Markdown 格式進行解析
  // 由於用戶提供的數據格式複雜，建議先手動轉換為 JSON 格式
  // 或者使用正則表達式逐行解析
  
  // 示例：解析 CES 2026
  // 格式：### CES 2026 (消費電子展)
  // **日期:** 2026年1月6日-9日
  
  // 暫時返回空數組，需要根據實際 Markdown 格式實現解析邏輯
  Logger.log("⚠️ parseEconomicEventsMarkdown 需要根據實際 Markdown 格式實現");
  
  return events;
}

/**
 * 解析產業龍頭財報行事曆 Markdown
 * @param {string} markdown - Markdown 文本
 * @return {Array} 財報事件列表
 */
function parseEarningsCalendarMarkdown(markdown) {
  const events = [];
  
  // 這裡需要根據實際的 Markdown 格式進行解析
  // 由於用戶提供的數據格式複雜，建議先手動轉換為 JSON 格式
  // 或者使用正則表達式逐行解析
  
  // 示例：解析 NVDA 財報
  // 格式：### NVIDIA (NVDA)
  // **財報週期:** 財年結束於1月31日
  // **2026年財報日期:**
  // - Q4 FY2026: **2月25日 (確認)** 盤後
  
  // 暫時返回空數組，需要根據實際 Markdown 格式實現解析邏輯
  Logger.log("⚠️ parseEarningsCalendarMarkdown 需要根據實際 Markdown 格式實現");
  
  return events;
}

// ==========================================
// 事件保存函數
// ==========================================

/**
 * 保存事件到 P5__CALENDAR 表格
 * @param {Sheet} sheet - P5__CALENDAR 表格
 * @param {Object} event - 事件對象
 * @return {string} event_id
 */
function saveEventToCalendar(sheet, event) {
  // 獲取表格標題
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 生成 event_id
  const eventId = event.event_id || generateEventId(event);
  
  // 檢查事件是否已存在
  const existingEvent = findEventById(sheet, eventId);
  if (existingEvent) {
    Logger.log(`事件已存在：${eventId}，跳過導入`);
    return eventId;
  }
  
  // 準備數據行
  const row = [];
  headers.forEach(header => {
    switch (header) {
      case "event_id":
        row.push(eventId);
        break;
      case "date_start":
        row.push(event.date_start || null);
        break;
      case "date_end":
        row.push(event.date_end || event.date_start || null);
        break;
      case "date_estimated":
        row.push(event.date_estimated !== undefined ? event.date_estimated : true);
        break;
      case "date_source":
        row.push(event.date_source || "ESTIMATED");
        break;
      case "market":
        row.push(event.market || "GLOBAL");
        break;
      case "event_name":
        row.push(event.event_name || "");
        break;
      case "event_type":
        row.push(event.event_type || "ECONOMIC_EVENT");
        break;
      case "mechanism":
        row.push(event.mechanism || "");
        break;
      case "pre_window":
        row.push(event.pre_window || calculatePreWindow(event));
        break;
      case "post_window":
        row.push(event.post_window || calculatePostWindow(event));
        break;
      case "prior_weight":
        row.push(event.prior_weight || calculatePriorWeight(event));
        break;
      case "prior_confidence":
        row.push(event.prior_confidence || calculatePriorConfidence(event));
        break;
      case "prior_dimensions_json":
        row.push(JSON.stringify(event.prior_dimensions_json || {}));
        break;
      case "current_weight":
        row.push(event.current_weight || event.prior_weight || 0.5);
        break;
      case "last_updated":
        row.push(new Date());
        break;
      case "learning_history_json":
        row.push(JSON.stringify([]));
        break;
      case "consecutive_success":
        row.push(0);
        break;
      case "consecutive_failure":
        row.push(0);
        break;
      case "kill_switch_triggered":
        row.push(false);
        break;
      case "verification_condition":
        row.push(event.verification_condition || "");
        break;
      case "invalidation_clause":
        row.push(event.invalidation_clause || "");
        break;
      case "status":
        row.push(event.status || "ACTIVE");
        break;
      default:
        row.push(null);
    }
  });
  
  // 追加到表格
  sheet.appendRow(row);
  
  return eventId;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 生成事件 ID
 * @param {Object} event - 事件對象
 * @return {string} event_id
 */
function generateEventId(event) {
  const eventName = (event.event_name || "").replace(/\s+/g, "_").toUpperCase();
  const dateStr = event.date_start ? Utilities.formatDate(new Date(event.date_start), Session.getScriptTimeZone(), "yyyyMMdd") : "";
  return `EVENT_${eventName}_${dateStr}_${Date.now()}`;
}

/**
 * 查找事件（根據 event_id）
 * @param {Sheet} sheet - P5__CALENDAR 表格
 * @param {string} eventId - 事件 ID
 * @return {Object|null} 事件對象或 null
 */
function findEventById(sheet, eventId) {
  if (sheet.getLastRow() <= 1) {
    return null;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const eventIdCol = headers.indexOf("event_id");
  
  if (eventIdCol === -1) {
    return null;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][eventIdCol] === eventId) {
      const event = {};
      headers.forEach((header, colIndex) => {
        event[header.toLowerCase()] = rows[i][colIndex];
      });
      return event;
    }
  }
  
  return null;
}

/**
 * 計算事件前監控窗口（根據歷史數據）
 * @param {Object} event - 事件對象
 * @return {number} 天數
 */
function calculatePreWindow(event) {
  // 根據事件類型和歷史數據計算
  // 例如：CES 展前 7-10 天，FOMC 會前一週
  if (event.event_type === "CONFERENCE") {
    return 7;  // 展會前 7 天
  } else if (event.event_type === "ECONOMIC_EVENT") {
    return 7;  // 重大財經事件前一週
  } else if (event.event_type === "EARNINGS") {
    return 14;  // 財報前兩週
  }
  return 7;  // 預設 7 天
}

/**
 * 計算事件後監控窗口（根據歷史數據）
 * @param {Object} event - 事件對象
 * @return {number} 天數
 */
function calculatePostWindow(event) {
  // 根據事件類型和歷史數據計算
  if (event.event_type === "CONFERENCE") {
    return 7;  // 展會後 7 天
  } else if (event.event_type === "ECONOMIC_EVENT") {
    return 7;  // 重大財經事件後一週
  } else if (event.event_type === "EARNINGS") {
    return 14;  // 財報後兩週
  }
  return 7;  // 預設 7 天
}

/**
 * 計算事件權重（根據歷史統計）
 * @param {Object} event - 事件對象
 * @return {number} 權重（0-1）
 */
function calculatePriorWeight(event) {
  // 根據歷史統計數據計算權重
  // 例如：如果歷史平均影響幅度大，權重高
  if (event.prior_dimensions_json && event.prior_dimensions_json.historical_stats) {
    const stats = event.prior_dimensions_json.historical_stats;
    const avgImpact = stats.average_impact || 0;
    // 根據平均影響幅度計算權重（0-1）
    return Math.min(1, Math.max(0, Math.abs(avgImpact) / 10));  // 假設 10% 為滿分
  }
  return 0.5;  // 預設權重
}

/**
 * 計算事件信心度（根據歷史統計）
 * @param {Object} event - 事件對象
 * @return {number} 信心度（0-1）
 */
function calculatePriorConfidence(event) {
  // 根據歷史統計數據計算信心度
  // 例如：如果歷史成功率 high，信心度高
  if (event.prior_dimensions_json && event.prior_dimensions_json.historical_stats) {
    const stats = event.prior_dimensions_json.historical_stats;
    const successRate = stats.success_rate || 0.5;
    // 成功率即為信心度
    return successRate;
  }
  return 0.5;  // 預設信心度
}

// ==========================================
// 事件數據結構構建函數
// ==========================================

/**
 * 構建重大財經事件對象
 * @param {Object} rawData - 原始數據
 * @return {Object} 事件對象
 */
function buildEconomicEvent(rawData) {
  return {
    event_name: rawData.name || "",
    date_start: parseDate(rawData.date_start || rawData.date),
    date_end: parseDate(rawData.date_end || rawData.date),
    date_estimated: rawData.date_estimated !== undefined ? rawData.date_estimated : true,
    date_source: rawData.date_source || "ESTIMATED",
    market: rawData.market || "GLOBAL",
    event_type: determineEventType(rawData.name || ""),
    mechanism: rawData.mechanism || "",
    pre_window: rawData.pre_window || calculatePreWindow({ event_type: determineEventType(rawData.name || "") }),
    post_window: rawData.post_window || calculatePostWindow({ event_type: determineEventType(rawData.name || "") }),
    prior_weight: rawData.prior_weight || 0.5,
    prior_confidence: rawData.prior_confidence || 0.5,
    prior_dimensions_json: {
      description: rawData.description || "",
      historical_stats: rawData.historical_stats || {},
      monitoring_suggestions: rawData.monitoring_suggestions || {},
      tracking_suggestions: rawData.tracking_suggestions || "",
      market_impact_analysis: rawData.market_impact_analysis || ""
    },
    status: "ACTIVE"
  };
}

/**
 * 構建產業龍頭財報事件對象
 * @param {Object} rawData - 原始數據
 * @return {Object} 事件對象
 */
function buildEarningsEvent(rawData) {
  return {
    event_name: `${rawData.company || ""} ${rawData.quarter || ""} 財報`,
    date_start: parseDate(rawData.earnings_date || rawData.date),
    date_end: parseDate(rawData.earnings_date || rawData.date),  // 財報通常只有一個日期
    date_estimated: rawData.date_estimated !== undefined ? rawData.date_estimated : true,
    date_source: rawData.date_source || "ESTIMATED",
    market: rawData.market || "US",
    event_type: "EARNINGS",
    mechanism: "",
    pre_window: rawData.pre_window || 14,  // 財報前兩週
    post_window: rawData.post_window || 14,  // 財報後兩週
    prior_weight: rawData.prior_weight || 0.7,  // 財報通常權重較高
    prior_confidence: rawData.prior_confidence || 0.6,
    prior_dimensions_json: {
      company: rawData.company || "",
      ticker: rawData.ticker || "",
      quarter: rawData.quarter || "",
      historical_performance: rawData.historical_performance || {},
      key_metrics: rawData.key_metrics || {},
      monitoring_suggestions: rawData.monitoring_suggestions || {},
      tracking_suggestions: rawData.tracking_suggestions || ""
    },
    status: "ACTIVE"
  };
}

/**
 * 解析日期字符串
 * @param {string} dateStr - 日期字符串（如 "2026年1月6日" 或 "2026-01-06"）
 * @return {Date|null} Date 對象或 null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // 處理中文日期格式：2026年1月6日
    const chineseDateMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (chineseDateMatch) {
      const year = parseInt(chineseDateMatch[1]);
      const month = parseInt(chineseDateMatch[2]) - 1;  // JavaScript 月份從 0 開始
      const day = parseInt(chineseDateMatch[3]);
      return new Date(year, month, day);
    }
    
    // 處理標準日期格式：2026-01-06
    const standardDate = new Date(dateStr);
    if (!isNaN(standardDate.getTime())) {
      return standardDate;
    }
    
    Logger.log(`警告：無法解析日期格式：${dateStr}`);
    return null;
  } catch (error) {
    Logger.log(`日期解析失敗：${dateStr} - ${error.message}`);
    return null;
  }
}

/**
 * 根據事件名稱判斷事件類型
 * @param {string} eventName - 事件名稱
 * @return {string} 事件類型
 */
function determineEventType(eventName) {
  const name = eventName.toUpperCase();
  
  if (name.includes("FOMC") || name.includes("NFP") || name.includes("CPI") || name.includes("GDP")) {
    return "ECONOMIC_EVENT";
  } else if (name.includes("CES") || name.includes("MWC") || name.includes("COMPUTEX")) {
    return "CONFERENCE";
  } else if (name.includes("G7") || name.includes("G20") || name.includes("峰會")) {
    return "POLITICAL_EVENT";
  } else if (name.includes("感恩節") || name.includes("聖誕節") || name.includes("THANKSGIVING") || name.includes("CHRISTMAS")) {
    return "HOLIDAY";
  } else if (name.includes("財報") || name.includes("EARNINGS")) {
    return "EARNINGS";
  }
  
  return "ECONOMIC_EVENT";  // 預設
}

// ==========================================
// 手動數據構建函數（用於測試）
// ==========================================

/**
 * 手動構建測試事件數據（用於驗證導入功能）
 * @return {Array} 測試事件列表
 */
function buildTestEvents() {
  return [
    // 測試：CES 2026
    buildEconomicEvent({
      name: "CES 2026",
      date_start: "2026年1月6日",
      date_end: "2026年1月9日",
      date_estimated: false,  // 已確認日期
      date_source: "OFFICIAL",
      market: "GLOBAL",
      description: "消費電子展",
      historical_stats: {
        pre_period_performance: { success_rate: 0.7, average_impact: 4.2 },
        event_day_performance: { average_volatility: 2.1 },
        post_period_performance: { success_rate: 0.68, average_impact: -4.8 }
      }
    }),
    
    // 測試：NVDA Q4 FY2026 財報
    buildEarningsEvent({
      company: "NVIDIA",
      ticker: "NVDA",
      quarter: "Q4 FY2026",
      earnings_date: "2026年2月25日",
      date_estimated: false,  // 已確認日期
      date_source: "OFFICIAL",
      market: "US",
      historical_performance: {
        pre_earnings_performance: { success_rate: 0.6, average_impact: 6.8 },
        earnings_day_performance: { average_volatility: 8.5 },
        post_earnings_performance: { success_rate: 0.7, average_impact: 3.2 }
      }
    })
  ];
}

/**
 * 測試導入功能（使用測試數據）
 */
function testImportP5Calendar2026() {
  Logger.log("🧪 開始測試 P5 Calendar 數據導入功能...");
  
  const testEvents = buildTestEvents();
  Logger.log(`構建了 ${testEvents.length} 個測試事件`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName("P5__CALENDAR");
  }
  
  // 確保表格結構是最新的
  migrateSheetsToV8_0(ss);
  
  let imported = 0;
  for (const event of testEvents) {
    try {
      const eventId = saveEventToCalendar(sheet, event);
      imported++;
      Logger.log(`✓ 測試導入成功：${event.event_name} (${eventId})`);
    } catch (error) {
      Logger.log(`✗ 測試導入失敗：${event.event_name} - ${error.message}`);
    }
  }
  
  Logger.log(`🎉 測試完成：成功導入 ${imported}/${testEvents.length} 個事件`);
  return { imported, total: testEvents.length };
}

// ==========================================
// 批量導入函數（從結構化數據）
// ==========================================

/**
 * 從結構化 JSON 數據批量導入事件
 * 
 * 使用方式：
 * 1. 將 Markdown 數據手動轉換為 JSON 格式
 * 2. 調用此函數導入
 * 
 * @param {Array} events - 事件對象數組
 * @return {Object} 導入結果
 */
function importEventsFromJSON(events) {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log(`📅 開始批量導入 ${events.length} 個事件`);
  Logger.log("=".repeat(60));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet) {
      initializeSheets();
      sheet = ss.getSheetByName("P5__CALENDAR");
    }
    
    // 確保表格結構是最新的
    migrateSheetsToV8_0(ss);
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const eventData of events) {
      try {
        // 構建事件對象
        let event;
        if (eventData.event_type === "EARNINGS") {
          event = buildEarningsEvent(eventData);
        } else {
          event = buildEconomicEvent(eventData);
        }
        
        // 檢查是否已存在
        const eventId = generateEventId(event);
        const existing = findEventById(sheet, eventId);
        if (existing) {
          skipped++;
          Logger.log(`⏭ 跳過已存在事件：${event.event_name}`);
          continue;
        }
        
        // 保存事件
        const savedEventId = saveEventToCalendar(sheet, event);
        imported++;
        Logger.log(`✓ 導入成功：${event.event_name} (${savedEventId})`);
        
      } catch (error) {
        failed++;
        Logger.log(`✗ 導入失敗：${eventData.name || eventData.company || "未知"} - ${error.message}`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 批量導入完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`成功：${imported}，跳過：${skipped}，失敗：${failed}`);
    Logger.log("=".repeat(60));
    
    return {
      status: "COMPLETED",
      imported,
      skipped,
      failed,
      total: events.length,
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 批量導入失敗：${error.message}`);
    throw error;
  }
}
