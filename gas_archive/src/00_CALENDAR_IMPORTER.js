/**
 * 📅 行事曆數據自動導入工具
 * 
 * 功能：
 * 1. 接受多種格式的原始檔案（Markdown、CSV、JSON、純文字）
 * 2. 自動解析並轉換成標準格式
 * 3. 寫入到對應的 tab 中（P5__CALENDAR、EARNINGS_CALENDAR 等）
 * 
 * 支援的格式：
 * - Markdown（.md）
 * - CSV（.csv）
 * - JSON（.json）
 * - 純文字（.txt）
 * 
 * @version V8.0
 * @date 2026-01-19
 */

// ==========================================
// 主要導入函數
// ==========================================

/**
 * 📅 自動導入行事曆數據
 * 
 * @param {string} rawData - 原始數據（可以是 Markdown、CSV、JSON 或純文字）
 * @param {string} dataType - 數據類型（"economic_events" | "earnings_calendar" | "holdings_earnings"）
 * @param {string} sourceFormat - 來源格式（"markdown" | "csv" | "json" | "text" | "auto"）
 * @returns {Object} 導入結果
 */
function importCalendarData(rawData, dataType, sourceFormat = "auto") {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log(`📅 開始導入行事曆數據（類型：${dataType}，格式：${sourceFormat}）`);
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
        parsedData = parseMarkdown(rawData, dataType);
        break;
      case "csv":
        parsedData = parseCSV(rawData, dataType);
        break;
      case "json":
        parsedData = parseJSON(rawData, dataType);
        break;
      case "text":
        parsedData = parseText(rawData, dataType);
        break;
      default:
        throw new Error(`不支援的格式：${sourceFormat}`);
    }
    
    Logger.log(`解析到 ${parsedData.length} 筆數據`);
    
    // 轉換成標準格式
    const standardizedData = parsedData.map(item => standardizeEvent(item, dataType));
    
    // 寫入到對應的 tab
    let importResult;
    switch (dataType) {
      case "economic_events":
        importResult = saveToP5Calendar(standardizedData);
        break;
      case "earnings_calendar":
        importResult = saveToEarningsCalendar(standardizedData);
        break;
      case "holdings_earnings":
        importResult = saveToHoldingsEarningsCalendar(standardizedData);
        break;
      default:
        throw new Error(`不支援的數據類型：${dataType}`);
    }
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 數據導入完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`成功：${importResult.success} 筆`);
    Logger.log(`失敗：${importResult.failed} 筆`);
    Logger.log(`跳過（已存在）：${importResult.skipped} 筆`);
    Logger.log("=".repeat(60));
    
    return {
      status: "COMPLETED",
      data_type: dataType,
      source_format: sourceFormat,
      parsed_count: parsedData.length,
      imported: importResult.success,
      failed: importResult.failed,
      skipped: importResult.skipped,
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 數據導入失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    throw error;
  }
}

// ==========================================
// 格式檢測
// ==========================================

/**
 * 自動檢測數據格式
 * @param {string} data - 原始數據
 * @returns {string} 格式類型
 */
function detectFormat(data) {
  // 檢查是否為 JSON
  try {
    JSON.parse(data);
    return "json";
  } catch (e) {
    // 不是 JSON
  }
  
  // 檢查是否為 CSV（包含逗號分隔）
  if (data.includes(",") && data.split("\n").length > 1) {
    const firstLine = data.split("\n")[0];
    if (firstLine.split(",").length >= 3) {
      return "csv";
    }
  }
  
  // 檢查是否為 Markdown（包含 # 或 **）
  if (data.includes("#") || data.includes("**") || data.includes("###")) {
    return "markdown";
  }
  
  // 預設為純文字
  return "text";
}

// ==========================================
// 解析函數
// ==========================================

/**
 * 解析 Markdown 格式
 * @param {string} markdown - Markdown 文本
 * @param {string} dataType - 數據類型
 * @returns {Array} 解析後的數據
 */
function parseMarkdown(markdown, dataType) {
  const events = [];
  const lines = markdown.split("\n");
  
  if (dataType === "economic_events") {
    // 解析重大財經事件 Markdown
    // 格式範例：
    // ### CES 2026 (消費電子展)
    // **日期:** 2026年1月6日-9日
    // **市場:** US
    // **類型:** 展覽
    
    let currentEvent = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 檢測事件標題（### 開頭）
      if (line.startsWith("### ")) {
        if (currentEvent) {
          events.push(currentEvent);
        }
        currentEvent = {
          event_name: line.replace(/^###\s+/, "").split("(")[0].trim(),
          raw_line: line
        };
      } else if (currentEvent && line.includes("**")) {
        // 解析屬性（**屬性名:** 值）
        const match = line.match(/\*\*([^:]+):\*\*\s*(.+)/);
        if (match) {
          const key = match[1].trim().toLowerCase();
          const value = match[2].trim();
          
          switch (key) {
            case "日期":
            case "date":
              const dates = parseDateRange(value);
              currentEvent.date_start = dates.start;
              currentEvent.date_end = dates.end;
              break;
            case "市場":
            case "market":
              currentEvent.market = value;
              break;
            case "類型":
            case "type":
            case "event_type":
              currentEvent.event_type = value;
              break;
            default:
              currentEvent[key] = value;
          }
        }
      }
    }
    
    if (currentEvent) {
      events.push(currentEvent);
    }
  } else if (dataType === "earnings_calendar" || dataType === "holdings_earnings") {
    // 解析財報行事曆 Markdown
    // 格式範例：
    // ### NVIDIA (NVDA)
    // **財報週期:** 財年結束於1月31日
    // **2026年財報日期:**
    // - Q4 FY2026: **2月25日 (確認)** 盤後
    
    let currentCompany = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 檢測公司標題（### 開頭）
      if (line.startsWith("### ")) {
        currentCompany = {
          company_name: line.replace(/^###\s+/, "").split("(")[0].trim(),
          ticker: line.match(/\(([^)]+)\)/)?.[1] || "",
          raw_line: line
        };
      } else if (currentCompany && line.startsWith("- ")) {
        // 解析財報日期行
        const match = line.match(/- (.+):\s*\*\*(.+?)\*\*/);
        if (match) {
          const quarter = match[1].trim();
          const dateStr = match[2].trim();
          
          const event = {
            ...currentCompany,
            quarter: quarter,
            earnings_date: parseDate(dateStr),
            status: dateStr.includes("確認") ? "CONFIRMED" : "ESTIMATED"
          };
          
          events.push(event);
        }
      }
    }
  }
  
  return events;
}

/**
 * 解析 CSV 格式
 * @param {string} csv - CSV 文本
 * @param {string} dataType - 數據類型
 * @returns {Array} 解析後的數據
 */
function parseCSV(csv, dataType) {
  const events = [];
  const lines = csv.split("\n").filter(line => line.trim());
  
  if (lines.length < 2) {
    return events;  // 至少需要 header 和一行數據
  }
  
  const headers = lines[0].split(",").map(h => h.trim());
  const headerMap = {};
  headers.forEach((header, index) => {
    headerMap[header.toLowerCase()] = index;
  });
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim());
    const event = {};
    
    headers.forEach((header, index) => {
      event[header] = values[index] || "";
    });
    
    events.push(event);
  }
  
  return events;
}

/**
 * 解析 JSON 格式
 * @param {string} json - JSON 文本
 * @param {string} dataType - 數據類型
 * @returns {Array} 解析後的數據
 */
function parseJSON(json, dataType) {
  try {
    const data = JSON.parse(json);
    
    // 如果是數組，直接返回
    if (Array.isArray(data)) {
      return data;
    }
    
    // 如果是對象，嘗試提取數組
    if (data.events && Array.isArray(data.events)) {
      return data.events;
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // 如果都不是，返回空數組
    return [];
  } catch (error) {
    throw new Error(`JSON 解析失敗：${error.message}`);
  }
}

/**
 * 解析純文字格式
 * @param {string} text - 純文字文本
 * @param {string} dataType - 數據類型
 * @returns {Array} 解析後的數據
 */
function parseText(text, dataType) {
  const events = [];
  const lines = text.split("\n").filter(line => line.trim());
  
  // 嘗試智能解析（根據常見格式）
  for (const line of lines) {
    // 嘗試解析日期格式
    const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch) {
      const event = {
        raw_text: line,
        date_start: parseDate(dateMatch[1])
      };
      
      // 嘗試提取事件名稱（日期前後的文字）
      const parts = line.split(dateMatch[1]);
      if (parts[0]) {
        event.event_name = parts[0].trim();
      }
      if (parts[1]) {
        event.description = parts[1].trim();
      }
      
      events.push(event);
    }
  }
  
  return events;
}

// ==========================================
// 日期解析
// ==========================================

/**
 * 解析日期字符串
 * @param {string} dateStr - 日期字符串（例如："2026年1月6日"、"2026-01-06"）
 * @returns {Date} Date 對象
 */
function parseDate(dateStr) {
  // 處理中文日期格式：2026年1月6日
  let normalized = dateStr.replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "");
  
  // 處理單數月份和日期（補零）
  normalized = normalized.replace(/-(\d)-/g, "-0$1-");
  normalized = normalized.replace(/-(\d)$/g, "-0$1");
  
  // 嘗試解析
  const date = new Date(normalized);
  
  if (isNaN(date.getTime())) {
    throw new Error(`無法解析日期：${dateStr}`);
  }
  
  return date;
}

/**
 * 解析日期範圍
 * @param {string} dateRangeStr - 日期範圍字符串（例如："2026年1月6日-9日"、"2026-01-06 至 2026-01-09"）
 * @returns {Object} {start: Date, end: Date}
 */
function parseDateRange(dateRangeStr) {
  // 處理 "2026年1月6日-9日" 格式
  const rangeMatch = dateRangeStr.match(/(\d{4}[-/年]\d{1,2}[-/月])(\d{1,2})[日]?[-至到]\s*(\d{1,2})[日]?/);
  if (rangeMatch) {
    const startStr = rangeMatch[1] + rangeMatch[2] + (rangeRangeStr.includes("日") ? "日" : "");
    const endStr = rangeMatch[1] + rangeMatch[3] + (dateRangeStr.includes("日") ? "日" : "");
    return {
      start: parseDate(startStr),
      end: parseDate(endStr)
    };
  }
  
  // 處理 "2026-01-06 至 2026-01-09" 格式
  const fullRangeMatch = dateRangeStr.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})[日]?\s*[-至到]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})[日]?/);
  if (fullRangeMatch) {
    return {
      start: parseDate(fullRangeMatch[1]),
      end: parseDate(fullRangeMatch[2])
    };
  }
  
  // 如果只有單一日期，開始和結束日期相同
  const singleDate = parseDate(dateRangeStr);
  return {
    start: singleDate,
    end: singleDate
  };
}

// ==========================================
// 標準化函數
// ==========================================

/**
 * 將解析後的數據轉換成標準格式
 * @param {Object} item - 解析後的數據項
 * @param {string} dataType - 數據類型
 * @returns {Object} 標準化後的數據
 */
function standardizeEvent(item, dataType) {
  if (dataType === "economic_events") {
    return {
      event_id: item.event_id || generateEventId(item),
      event_name: item.event_name || item.name || "",
      date_start: item.date_start || item.date || null,
      date_end: item.date_end || item.date_start || item.date || null,
      date_estimated: item.date_estimated !== undefined ? item.date_estimated : true,
      date_source: item.date_source || "IMPORTED",
      market: item.market || "GLOBAL",
      event_type: item.event_type || item.type || "OTHER",
      mechanism: item.mechanism || "",
      status: item.status || "ACTIVE"
    };
  } else if (dataType === "earnings_calendar" || dataType === "holdings_earnings") {
    return {
      ticker: item.ticker || item.company_code || "",
      company_name: item.company_name || item.name || "",
      earnings_date: item.earnings_date || item.date || null,
      quarter: item.quarter || "",
      market: item.market || "US",
      status: item.status || "ESTIMATED",
      time: item.time || "AFTER_HOURS"  // BEFORE_MARKET / AFTER_HOURS
    };
  }
  
  return item;
}

/**
 * 生成事件 ID
 * @param {Object} event - 事件對象
 * @returns {string} 事件 ID
 */
function generateEventId(event) {
  const name = (event.event_name || event.name || "UNKNOWN").replace(/\s+/g, "_").toUpperCase();
  const date = event.date_start || event.date;
  const dateStr = date ? Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd") : "";
  return `${name}_${dateStr}`;
}

// ==========================================
// 保存函數
// ==========================================

/**
 * 保存到 P5__CALENDAR 表格
 * @param {Array} events - 標準化後的事件列表
 * @returns {Object} 保存結果
 */
function saveToP5Calendar(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet) {
    // 如果表格不存在，先初始化
    initializeAllTabsAndHeaders(false, false);
    sheet = ss.getSheetByName("P5__CALENDAR");
    if (!sheet) {
      throw new Error("P5__CALENDAR 表格不存在且初始化失敗");
    }
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
            row.push(event.date_source || "IMPORTED");
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
          case "status":
            row.push(event.status || "ACTIVE");
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
 * 保存到 EARNINGS_CALENDAR 表格
 * @param {Array} events - 標準化後的事件列表
 * @returns {Object} 保存結果
 */
function saveToEarningsCalendar(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
  
  if (!sheet) {
    // 如果表格不存在，創建它
    sheet = ss.insertSheet("EARNINGS_CALENDAR");
    const headers = ["ticker", "company_name", "earnings_date", "quarter", "market", "status", "time", "created_at"];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const result = { success: 0, failed: 0, skipped: 0 };
  
  for (const event of events) {
    try {
      // 檢查是否已存在（根據 ticker 和 earnings_date）
      if (findEarningsEvent(sheet, event.ticker, event.earnings_date)) {
        result.skipped++;
        continue;
      }
      
      // 準備數據行
      const row = [];
      headers.forEach(header => {
        switch (header) {
          case "ticker":
            row.push(event.ticker || "");
            break;
          case "company_name":
            row.push(event.company_name || "");
            break;
          case "earnings_date":
            row.push(event.earnings_date || null);
            break;
          case "quarter":
            row.push(event.quarter || "");
            break;
          case "market":
            row.push(event.market || "US");
            break;
          case "status":
            row.push(event.status || "ESTIMATED");
            break;
          case "time":
            row.push(event.time || "AFTER_HOURS");
            break;
          case "created_at":
            row.push(new Date());
            break;
          default:
            row.push(event[header.toLowerCase()] || "");
        }
      });
      
      sheet.appendRow(row);
      result.success++;
    } catch (error) {
      Logger.log(`保存財報事件失敗：${event.ticker || "UNKNOWN"} - ${error.message}`);
      result.failed++;
    }
  }
  
  return result;
}

/**
 * 保存到持股財報行事曆（與 EARNINGS_CALENDAR 相同結構，但用於持股清單）
 * @param {Array} events - 標準化後的事件列表
 * @returns {Object} 保存結果
 */
function saveToHoldingsEarningsCalendar(events) {
  // 持股財報行事曆使用相同的表格結構
  return saveToEarningsCalendar(events);
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 查找事件（根據 event_id）
 * @param {Sheet} sheet - 表格對象
 * @param {string} eventId - 事件 ID
 * @returns {boolean} 是否存在
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

/**
 * 查找財報事件（根據 ticker 和 earnings_date）
 * @param {Sheet} sheet - 表格對象
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @returns {boolean} 是否存在
 */
function findEarningsEvent(sheet, ticker, earningsDate) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const tickerCol = headers.indexOf("ticker");
  const dateCol = headers.indexOf("earnings_date");
  
  if (tickerCol === -1 || dateCol === -1) {
    return false;
  }
  
  for (let i = 1; i < rows.length; i++) {
    const rowTicker = rows[i][tickerCol];
    const rowDate = rows[i][dateCol];
    
    if (rowTicker === ticker && rowDate && earningsDate) {
      const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const earningsDateStr = Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (rowDateStr === earningsDateStr) {
        return true;
      }
    }
  }
  
  return false;
}

// ==========================================
// UI 按鈕函數
// ==========================================

/**
 * 📅 行事曆數據導入按鈕（供手動調用）
 * 
 * 使用方式：
 * 1. 準備原始數據（Markdown、CSV、JSON 或純文字）
 * 2. 調用此函數
 * 3. 選擇數據類型和格式
 * 4. 貼上數據
 */
function BUTTON_ImportCalendarData() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    // 選擇數據類型
    const dataTypeResponse = ui.prompt(
      "導入行事曆數據",
      "請選擇數據類型：\n1. economic_events（重大財經事件）\n2. earnings_calendar（板塊龍頭財報）\n3. holdings_earnings（持股財報）\n\n請輸入數字（1-3）：",
      ui.ButtonSet.OK_CANCEL
    );
    
    if (dataTypeResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }
    
    const dataTypeChoice = dataTypeResponse.getResponseText().trim();
    let dataType;
    switch (dataTypeChoice) {
      case "1":
        dataType = "economic_events";
        break;
      case "2":
        dataType = "earnings_calendar";
        break;
      case "3":
        dataType = "holdings_earnings";
        break;
      default:
        ui.alert("錯誤", "無效的選擇", ui.ButtonSet.OK);
        return;
    }
    
    // 選擇格式
    const formatResponse = ui.prompt(
      "選擇數據格式",
      "請選擇數據格式：\n1. auto（自動檢測）\n2. markdown\n3. csv\n4. json\n5. text\n\n請輸入數字（1-5）：",
      ui.ButtonSet.OK_CANCEL
    );
    
    if (formatResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }
    
    const formatChoice = formatResponse.getResponseText().trim();
    let sourceFormat;
    switch (formatChoice) {
      case "1":
        sourceFormat = "auto";
        break;
      case "2":
        sourceFormat = "markdown";
        break;
      case "3":
        sourceFormat = "csv";
        break;
      case "4":
        sourceFormat = "json";
        break;
      case "5":
        sourceFormat = "text";
        break;
      default:
        sourceFormat = "auto";
    }
    
    // 輸入數據
    const dataResponse = ui.prompt(
      "貼上原始數據",
      "請將原始數據貼上到下面的輸入框：\n\n（如果數據太長，可以分多次導入）",
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
    const result = importCalendarData(rawData, dataType, sourceFormat);
    
    // 顯示結果
    let resultMessage = "=".repeat(60) + "\n";
    resultMessage += "✅ 導入完成\n";
    resultMessage += "=".repeat(60) + "\n\n";
    resultMessage += `數據類型：${result.data_type}\n`;
    resultMessage += `來源格式：${result.source_format}\n`;
    resultMessage += `解析數量：${result.parsed_count} 筆\n`;
    resultMessage += `成功導入：${result.imported} 筆\n`;
    resultMessage += `失敗：${result.failed} 筆\n`;
    resultMessage += `跳過（已存在）：${result.skipped} 筆\n`;
    resultMessage += `總時間：${(result.total_time / 1000).toFixed(1)} 秒\n`;
    resultMessage += "=".repeat(60) + "\n";
    
    ui.alert("導入完成", resultMessage, ui.ButtonSet.OK);
    Logger.log(resultMessage);
    
  } catch (error) {
    Logger.log(`導入失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("錯誤", `導入失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
