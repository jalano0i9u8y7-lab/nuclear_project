/**
 * 📅 增強版行事曆數據導入工具（支援歷史經驗與事後學習）
 * 
 * 功能：
 * 1. 解析包含歷史市場反應的詳細行事曆數據
 * 2. 提取前後一週的歷史表現數據（5年）
 * 3. 提取風險警示與監控建議
 * 4. 寫入到 P5__CALENDAR 表格（擴展格式）
 * 5. 創建歷史經驗學習表（P5__CALENDAR_HISTORY）
 * 
 * 支援的格式：
 * - Markdown（.md）- 用戶提供的詳細格式
 * - JSON（.json）- 結構化數據
 * 
 * @version V8.0
 * @date 2026-01-19
 */

// ==========================================
// 主要導入函數
// ==========================================

/**
 * 📅 導入增強版行事曆數據（包含歷史經驗）
 * 
 * @param {string} rawData - 原始數據（Markdown 格式）
 * @param {string} sourceFormat - 來源格式（"markdown" | "json" | "auto"）
 * @returns {Object} 導入結果
 */
function importEnhancedCalendarData(rawData, sourceFormat = "auto") {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log(`📅 開始導入增強版行事曆數據（格式：${sourceFormat}）`);
  Logger.log("=".repeat(60));
  
  try {
    // 自動檢測格式
    if (sourceFormat === "auto") {
      sourceFormat = detectFormat(rawData);
      Logger.log(`自動檢測格式：${sourceFormat}`);
    }
    
    // 解析數據
    let parsedData;
    switch (sourceFormat) {
      case "markdown":
        parsedData = parseEnhancedMarkdown(rawData);
        break;
      case "json":
        parsedData = parseJSON(rawData, "economic_events");
        break;
      default:
        throw new Error(`不支援的格式：${sourceFormat}`);
    }
    
    Logger.log(`解析到 ${parsedData.length} 個事件（包含歷史經驗）`);
    
    // 轉換成標準格式
    const standardizedData = parsedData.map(item => standardizeEnhancedEvent(item));
    
    // 寫入到 P5__CALENDAR 表格
    const calendarResult = saveToP5CalendarEnhanced(standardizedData);
    
    // 寫入歷史經驗到 P5__CALENDAR_HISTORY 表格
    const historyResult = saveToCalendarHistory(standardizedData);
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 增強版數據導入完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`事件導入：${calendarResult.success} 筆`);
    Logger.log(`歷史經驗導入：${historyResult.success} 筆`);
    Logger.log(`失敗：${calendarResult.failed + historyResult.failed} 筆`);
    Logger.log("=".repeat(60));
    
    return {
      status: "COMPLETED",
      source_format: sourceFormat,
      parsed_count: parsedData.length,
      calendar_imported: calendarResult.success,
      history_imported: historyResult.success,
      failed: calendarResult.failed + historyResult.failed,
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 增強版數據導入失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    throw error;
  }
}

// ==========================================
// Markdown 解析（增強版）
// ==========================================

/**
 * 解析增強版 Markdown 格式（包含歷史經驗）
 * @param {string} markdown - Markdown 文本
 * @returns {Array} 解析後的數據
 */
function parseEnhancedMarkdown(markdown) {
  const events = [];
  const lines = markdown.split("\n");
  
  let currentEvent = null;
  let currentSection = null;
  let currentSubsection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 檢測事件標題（### 開頭或事件名稱）
    if (line.startsWith("### ") || (line.includes("日期:") && !currentEvent)) {
      if (currentEvent) {
        events.push(currentEvent);
      }
      
      // 解析事件標題
      let eventName = "";
      let dateStr = "";
      
      if (line.startsWith("### ")) {
        eventName = line.replace(/^###\s+/, "").split("(")[0].trim();
      }
      
      // 查找日期行
      let j = i + 1;
      while (j < lines.length && j < i + 5) {
        const nextLine = lines[j].trim();
        if (nextLine.includes("日期:") || nextLine.includes("Date:")) {
          dateStr = nextLine.replace(/.*日期[：:]\s*/, "").trim();
          break;
        }
        j++;
      }
      
      currentEvent = {
        event_name: eventName,
        raw_date: dateStr,
        historical_performance: {
          pre_window: {},
          event_day: {},
          post_window: {}
        },
        monitoring_suggestions: [],
        risk_warnings: [],
        tracking_recommendations: {}
      };
      
      currentSection = null;
      currentSubsection = null;
    }
    
    // 解析歷史市場表現
    if (currentEvent) {
      if (line.includes("歷史市場表現:") || line.includes("歷史表現:")) {
        currentSection = "historical_performance";
      } else if (line.includes("前期表現") || line.includes("展前") || line.includes("會前一週")) {
        currentSubsection = "pre_window";
        if (!currentEvent.historical_performance.pre_window.years) {
          currentEvent.historical_performance.pre_window.years = [];
        }
      } else if (line.includes("當天") || line.includes("決議當天") || line.includes("公布當天")) {
        currentSubsection = "event_day";
        if (!currentEvent.historical_performance.event_day.years) {
          currentEvent.historical_performance.event_day.years = [];
        }
      } else if (line.includes("展後") || line.includes("會後") || line.includes("公布後")) {
        currentSubsection = "post_window";
        if (!currentEvent.historical_performance.post_window.years) {
          currentEvent.historical_performance.post_window.years = [];
        }
      } else if (line.includes("統計規律:") || line.includes("統計:")) {
        currentSubsection = "statistics";
      } else if (line.includes("追蹤建議:") || line.includes("監控建議:")) {
        currentSection = "monitoring";
      } else if (line.includes("風險警示:") || line.includes("風險:")) {
        currentSection = "risk_warnings";
      }
      
      // 解析年份數據（例如：2025年、2024年）
      const yearMatch = line.match(/(\d{4})年[：:]/);
      if (yearMatch && currentSubsection) {
        const year = parseInt(yearMatch[1]);
        const data = extractYearData(line, year);
        
        if (currentSubsection === "pre_window" && currentEvent.historical_performance.pre_window.years) {
          currentEvent.historical_performance.pre_window.years.push(data);
        } else if (currentSubsection === "event_day" && currentEvent.historical_performance.event_day.years) {
          currentEvent.historical_performance.event_day.years.push(data);
        } else if (currentSubsection === "post_window" && currentEvent.historical_performance.post_window.years) {
          currentEvent.historical_performance.post_window.years.push(data);
        }
      }
      
      // 解析統計規律
      if (currentSubsection === "statistics" && line.includes("機率") || line.includes("平均")) {
        const stat = extractStatistic(line);
        if (stat) {
          if (!currentEvent.historical_performance[currentSubsection]) {
            currentEvent.historical_performance[currentSubsection] = {};
          }
          currentEvent.historical_performance[currentSubsection][stat.key] = stat.value;
        }
      }
      
      // 解析追蹤建議
      if (currentSection === "monitoring" && line.startsWith("- ")) {
        currentEvent.monitoring_suggestions.push(line.replace(/^-\s+/, ""));
      }
      
      // 解析風險警示
      if (currentSection === "risk_warnings" && line.trim()) {
        currentEvent.risk_warnings.push(line);
      }
    }
  }
  
  // 添加最後一個事件
  if (currentEvent) {
    events.push(currentEvent);
  }
  
  return events;
}

/**
 * 提取年份數據
 * @param {string} line - 數據行
 * @param {number} year - 年份
 * @returns {Object} 年份數據
 */
function extractYearData(line, year) {
  const data = { year: year };
  
  // 提取股票代碼和漲跌幅（例如：NVDA +8.2%, TSLA +6.5%）
  const tickerMatches = line.matchAll(/([A-Z]{2,5})\s*([+-]?\d+\.?\d*)%/g);
  for (const match of tickerMatches) {
    if (!data.tickers) {
      data.tickers = {};
    }
    data.tickers[match[1]] = parseFloat(match[2]);
  }
  
  // 提取指數漲跌幅（例如：納斯達克 +3.1%）
  const indexMatches = line.match(/(納斯達克|標普|道瓊|VIX)\s*([+-]?\d+\.?\d*)%/);
  if (indexMatches) {
    data.index = {
      name: indexMatches[1],
      change_pct: parseFloat(indexMatches[2])
    };
  }
  
  // 提取日期範圍（例如：12/26-1/5）
  const dateRangeMatch = line.match(/(\d{1,2}\/\d{1,2})-(\d{1,2}\/\d{1,2})/);
  if (dateRangeMatch) {
    data.date_range = {
      start: dateRangeMatch[1],
      end: dateRangeMatch[2]
    };
  }
  
  return data;
}

/**
 * 提取統計數據
 * @param {string} line - 統計行
 * @returns {Object|null} 統計數據
 */
function extractStatistic(line) {
  // 提取機率（例如：上漲機率: 70%）
  const probMatch = line.match(/(.+?)機率[：:]\s*(\d+)%/);
  if (probMatch) {
    return {
      key: probMatch[1].trim(),
      value: parseInt(probMatch[2])
    };
  }
  
  // 提取平均漲幅（例如：平均漲幅: +4.2%）
  const avgMatch = line.match(/(.+?)平均[：:]\s*([+-]?\d+\.?\d*)%/);
  if (avgMatch) {
    return {
      key: avgMatch[1].trim(),
      value: parseFloat(avgMatch[2])
    };
  }
  
  return null;
}

// ==========================================
// 標準化函數（增強版）
// ==========================================

/**
 * 將解析後的數據轉換成標準格式（增強版）
 * @param {Object} item - 解析後的數據項
 * @returns {Object} 標準化後的數據
 */
function standardizeEnhancedEvent(item) {
  // 解析日期
  const dates = parseDateRange(item.raw_date || "");
  
  // 計算 pre_window 和 post_window（從歷史數據推斷，或使用預設值）
  let preWindow = 7;  // 預設前7天
  let postWindow = 7;  // 預設後7天
  
  // 從歷史數據推斷窗口
  if (item.historical_performance && item.historical_performance.pre_window.years) {
    // 檢查歷史數據中的日期範圍
    const firstYear = item.historical_performance.pre_window.years[0];
    if (firstYear && firstYear.date_range) {
      // 簡單推斷：如果日期範圍是 12/26-1/5，則 pre_window 約為 10 天
      preWindow = 7;  // 預設值，可根據實際數據調整
    }
  }
  
  return {
    event_id: item.event_id || generateEventId(item),
    event_name: item.event_name || "",
    date_start: dates.start,
    date_end: dates.end || dates.start,
    date_estimated: item.date_estimated !== undefined ? item.date_estimated : true,
    date_source: item.date_source || "IMPORTED_ENHANCED",
    market: item.market || "GLOBAL",
    event_type: item.event_type || "OTHER",
    mechanism: item.mechanism || "",
    pre_window: preWindow,
    post_window: postWindow,
    prior_weight: item.prior_weight || 0.5,
    prior_confidence: item.prior_confidence || 0.7,
    prior_dimensions_json: JSON.stringify(item.historical_performance || {}),
    current_weight: item.current_weight || 0.5,
    status: item.status || "ACTIVE",
    // ⭐ 新增：歷史經驗數據
    historical_performance_json: JSON.stringify(item.historical_performance || {}),
    monitoring_suggestions_json: JSON.stringify(item.monitoring_suggestions || []),
    risk_warnings_json: JSON.stringify(item.risk_warnings || []),
    tracking_recommendations_json: JSON.stringify(item.tracking_recommendations || {})
  };
}

// ==========================================
// 保存函數（增強版）
// ==========================================

/**
 * 保存到 P5__CALENDAR 表格（增強版）
 * @param {Array} events - 標準化後的事件列表
 * @returns {Object} 保存結果
 */
function saveToP5CalendarEnhanced(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet) {
    initializeAllTabsAndHeaders(false, false);
    sheet = ss.getSheetByName("P5__CALENDAR");
    if (!sheet) {
      throw new Error("P5__CALENDAR 表格不存在且初始化失敗");
    }
  }
  
  // 檢查並添加新欄位（如果不存在）
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const requiredHeaders = [
    "historical_performance_json",
    "monitoring_suggestions_json",
    "risk_warnings_json",
    "tracking_recommendations_json"
  ];
  
  let lastCol = sheet.getLastColumn();
  for (const requiredHeader of requiredHeaders) {
    if (headers.indexOf(requiredHeader) === -1) {
      sheet.getRange(1, lastCol + 1).setValue(requiredHeader);
      headers.push(requiredHeader);
      lastCol++;
    }
  }
  
  const result = { success: 0, failed: 0, skipped: 0 };
  
  for (const event of events) {
    try {
      // 檢查是否已存在
      const eventId = event.event_id || generateEventId(event);
      if (findEventById(sheet, eventId)) {
        result.skipped++;
        continue;
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
            row.push(event.date_source || "IMPORTED_ENHANCED");
            break;
          case "event_name":
            row.push(event.event_name || "");
            break;
          case "event_type":
            row.push(event.event_type || "OTHER");
            break;
          case "market":
            row.push(event.market || "GLOBAL");
            break;
          case "pre_window":
            row.push(event.pre_window || 7);
            break;
          case "post_window":
            row.push(event.post_window || 7);
            break;
          case "prior_weight":
            row.push(event.prior_weight || 0.5);
            break;
          case "prior_confidence":
            row.push(event.prior_confidence || 0.7);
            break;
          case "prior_dimensions_json":
            row.push(event.prior_dimensions_json || "{}");
            break;
          case "current_weight":
            row.push(event.current_weight || 0.5);
            break;
          case "status":
            row.push(event.status || "ACTIVE");
            break;
          case "historical_performance_json":
            row.push(event.historical_performance_json || "{}");
            break;
          case "monitoring_suggestions_json":
            row.push(event.monitoring_suggestions_json || "[]");
            break;
          case "risk_warnings_json":
            row.push(event.risk_warnings_json || "[]");
            break;
          case "tracking_recommendations_json":
            row.push(event.tracking_recommendations_json || "{}");
            break;
          default:
            row.push(event[header.toLowerCase()] || "");
        }
      });
      
      sheet.appendRow(row);
      result.success++;
    } catch (error) {
      Logger.log(`保存事件失敗：${event.event_name || "UNKNOWN"} - ${error.message}`);
      result.failed++;
    }
  }
  
  return result;
}

/**
 * 保存歷史經驗到 P5__CALENDAR_HISTORY 表格
 * @param {Array} events - 標準化後的事件列表
 * @returns {Object} 保存結果
 */
function saveToCalendarHistory(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR_HISTORY");
  
  if (!sheet) {
    // 創建歷史經驗表格
    sheet = ss.insertSheet("P5__CALENDAR_HISTORY");
    const headers = [
      "history_id",
      "event_id",
      "event_name",
      "year",
      "window_type",  // PRE_WINDOW / EVENT_DAY / POST_WINDOW
      "date_range_start",
      "date_range_end",
      "ticker_performance_json",  // {NVDA: +8.2%, TSLA: +6.5%, ...}
      "index_performance_json",  // {name: "納斯達克", change_pct: +3.1%}
      "statistics_json",  // {上漲機率: 70%, 平均漲幅: +4.2%}
      "created_at"
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const result = { success: 0, failed: 0, skipped: 0 };
  
  for (const event of events) {
    try {
      const eventId = event.event_id || generateEventId(event);
      const historicalPerformance = JSON.parse(event.historical_performance_json || "{}");
      
      // 處理 pre_window 歷史數據
      if (historicalPerformance.pre_window && historicalPerformance.pre_window.years) {
        for (const yearData of historicalPerformance.pre_window.years) {
          const historyId = `${eventId}_${yearData.year}_PRE`;
          
          if (findHistoryRecord(sheet, historyId)) {
            result.skipped++;
            continue;
          }
          
          const row = [];
          headers.forEach(header => {
            switch (header) {
              case "history_id":
                row.push(historyId);
                break;
              case "event_id":
                row.push(eventId);
                break;
              case "event_name":
                row.push(event.event_name || "");
                break;
              case "year":
                row.push(yearData.year || null);
                break;
              case "window_type":
                row.push("PRE_WINDOW");
                break;
              case "date_range_start":
                row.push(yearData.date_range?.start || null);
                break;
              case "date_range_end":
                row.push(yearData.date_range?.end || null);
                break;
              case "ticker_performance_json":
                row.push(JSON.stringify(yearData.tickers || {}));
                break;
              case "index_performance_json":
                row.push(JSON.stringify(yearData.index || {}));
                break;
              case "statistics_json":
                row.push(JSON.stringify(historicalPerformance.pre_window.statistics || {}));
                break;
              case "created_at":
                row.push(new Date());
                break;
              default:
                row.push("");
            }
          });
          
          sheet.appendRow(row);
          result.success++;
        }
      }
      
      // 處理 event_day 歷史數據
      if (historicalPerformance.event_day && historicalPerformance.event_day.years) {
        for (const yearData of historicalPerformance.event_day.years) {
          const historyId = `${eventId}_${yearData.year}_EVENT`;
          
          if (findHistoryRecord(sheet, historyId)) {
            result.skipped++;
            continue;
          }
          
          const row = [];
          headers.forEach(header => {
            switch (header) {
              case "history_id":
                row.push(historyId);
                break;
              case "event_id":
                row.push(eventId);
                break;
              case "event_name":
                row.push(event.event_name || "");
                break;
              case "year":
                row.push(yearData.year || null);
                break;
              case "window_type":
                row.push("EVENT_DAY");
                break;
              case "date_range_start":
                row.push(yearData.date_range?.start || null);
                break;
              case "date_range_end":
                row.push(yearData.date_range?.end || null);
                break;
              case "ticker_performance_json":
                row.push(JSON.stringify(yearData.tickers || {}));
                break;
              case "index_performance_json":
                row.push(JSON.stringify(yearData.index || {}));
                break;
              case "statistics_json":
                row.push(JSON.stringify(historicalPerformance.event_day.statistics || {}));
                break;
              case "created_at":
                row.push(new Date());
                break;
              default:
                row.push("");
            }
          });
          
          sheet.appendRow(row);
          result.success++;
        }
      }
      
      // 處理 post_window 歷史數據
      if (historicalPerformance.post_window && historicalPerformance.post_window.years) {
        for (const yearData of historicalPerformance.post_window.years) {
          const historyId = `${eventId}_${yearData.year}_POST`;
          
          if (findHistoryRecord(sheet, historyId)) {
            result.skipped++;
            continue;
          }
          
          const row = [];
          headers.forEach(header => {
            switch (header) {
              case "history_id":
                row.push(historyId);
                break;
              case "event_id":
                row.push(eventId);
                break;
              case "event_name":
                row.push(event.event_name || "");
                break;
              case "year":
                row.push(yearData.year || null);
                break;
              case "window_type":
                row.push("POST_WINDOW");
                break;
              case "date_range_start":
                row.push(yearData.date_range?.start || null);
                break;
              case "date_range_end":
                row.push(yearData.date_range?.end || null);
                break;
              case "ticker_performance_json":
                row.push(JSON.stringify(yearData.tickers || {}));
                break;
              case "index_performance_json":
                row.push(JSON.stringify(yearData.index || {}));
                break;
              case "statistics_json":
                row.push(JSON.stringify(historicalPerformance.post_window.statistics || {}));
                break;
              case "created_at":
                row.push(new Date());
                break;
              default:
                row.push("");
            }
          });
          
          sheet.appendRow(row);
          result.success++;
        }
      }
    } catch (error) {
      Logger.log(`保存歷史經驗失敗：${event.event_name || "UNKNOWN"} - ${error.message}`);
      result.failed++;
    }
  }
  
  return result;
}

/**
 * 查找歷史記錄
 * @param {Sheet} sheet - 表格對象
 * @param {string} historyId - 歷史記錄 ID
 * @returns {boolean} 是否存在
 */
function findHistoryRecord(sheet, historyId) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const historyIdCol = headers.indexOf("history_id");
  
  if (historyIdCol === -1) {
    return false;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][historyIdCol] === historyId) {
      return true;
    }
  }
  
  return false;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 自動檢測格式
 * @param {string} data - 原始數據
 * @returns {string} 格式類型
 */
function detectFormat(data) {
  try {
    JSON.parse(data);
    return "json";
  } catch (e) {
    return "markdown";
  }
}

/**
 * 解析日期範圍（重用 00_CALENDAR_IMPORTER.js 的函數）
 */
function parseDateRange(dateRangeStr) {
  // 重用 00_CALENDAR_IMPORTER.js 中的 parseDateRange 函數
  if (typeof parseDateRange === 'function' && parseDateRange !== arguments.callee) {
    return parseDateRange(dateRangeStr);
  }
  
  // 簡單實現
  const singleDate = parseDate(dateRangeStr);
  return {
    start: singleDate,
    end: singleDate
  };
}

/**
 * 解析日期（重用 00_CALENDAR_IMPORTER.js 的函數）
 */
function parseDate(dateStr) {
  // 重用 00_CALENDAR_IMPORTER.js 中的 parseDate 函數
  if (typeof parseDate === 'function' && parseDate !== arguments.callee) {
    return parseDate(dateStr);
  }
  
  // 簡單實現
  let normalized = dateStr.replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "");
  normalized = normalized.replace(/-(\d)-/g, "-0$1-");
  normalized = normalized.replace(/-(\d)$/g, "-0$1");
  return new Date(normalized);
}

/**
 * 生成事件 ID（重用 00_CALENDAR_IMPORTER.js 的函數）
 */
function generateEventId(event) {
  const name = (event.event_name || event.name || "UNKNOWN").replace(/\s+/g, "_").toUpperCase();
  const date = event.date_start || event.date;
  const dateStr = date ? Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd") : "";
  return `${name}_${dateStr}`;
}

/**
 * 查找事件（重用 00_CALENDAR_IMPORTER.js 的函數）
 */
function findEventById(sheet, eventId) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const eventIdCol = headers.indexOf("event_id");
  
  if (eventIdCol === -1) {
    return false;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][eventIdCol] === eventId) {
      return true;
    }
  }
  
  return false;
}

// ==========================================
// UI 按鈕函數
// ==========================================

/**
 * 📅 增強版行事曆數據導入按鈕（供手動調用）
 */
function BUTTON_ImportEnhancedCalendarData() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    // 輸入數據
    const dataResponse = ui.prompt(
      "導入增強版行事曆數據",
      "請將包含歷史經驗的原始數據（Markdown 格式）貼上到下面的輸入框：\n\n（支援格式：Markdown、JSON）",
      ui.ButtonSet.OK_CANCEL
    );
    
    if (dataResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }
    
    const rawData = dataResponse.getResponseText();
    
    if (!rawData || rawData.trim().length === 0) {
      ui.alert("錯誤", "數據為空", ui.ButtonSet.OK);
      return;
    }
    
    // 執行導入
    const result = importEnhancedCalendarData(rawData, "auto");
    
    // 顯示結果
    let resultMessage = "=".repeat(60) + "\n";
    resultMessage += "✅ 增強版導入完成\n";
    resultMessage += "=".repeat(60) + "\n\n";
    resultMessage += `來源格式：${result.source_format}\n`;
    resultMessage += `解析數量：${result.parsed_count} 筆\n`;
    resultMessage += `事件導入：${result.calendar_imported} 筆\n`;
    resultMessage += `歷史經驗導入：${result.history_imported} 筆\n`;
    resultMessage += `失敗：${result.failed} 筆\n`;
    resultMessage += `總時間：${(result.total_time / 1000).toFixed(1)} 秒\n`;
    resultMessage += "\n";
    resultMessage += "📋 數據已寫入：\n";
    resultMessage += "  - P5__CALENDAR 表格（事件基本資訊 + 歷史經驗 JSON）\n";
    resultMessage += "  - P5__CALENDAR_HISTORY 表格（詳細歷史經驗數據）\n";
    resultMessage += "=".repeat(60) + "\n";
    
    ui.alert("導入完成", resultMessage, ui.ButtonSet.OK);
    Logger.log(resultMessage);
    
  } catch (error) {
    Logger.log(`導入失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("錯誤", `導入失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
