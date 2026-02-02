/**
 * 📊 P5 Weekly: 優化數據讀取模組（V8.12 新增）
 * 
 * 提供優化後的數據讀取函數，使用Daily建立的索引和波動度計算結果
 * 避免Weekly重複工作100次
 * 
 * @version V8.12
 * @date 2026-01-19
 */

// ==========================================
// 1. 讀取宏觀數據週度波動度
// ==========================================

/**
 * 讀取宏觀數據週度波動度計算結果 ⭐ V8.12 新增
 * 
 * @param {string} weekStartDate - 週開始日期（可選，如果不提供則自動計算本週）
 * @returns {Object} metrics - 宏觀數據週度波動度（按data_type和symbol組織）
 */
function getMacroWeeklyMetrics(weekStartDate = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(MACRO_DATA_WEEKLY_METRICS_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly V8.12：MACRO_DATA_WEEKLY_METRICS 表格不存在或為空");
      return {};
    }
    
    // 計算本週日期範圍
    let weekStart, weekEnd;
    if (weekStartDate) {
      weekStart = new Date(weekStartDate);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);  // 週五
    } else {
      const today = new Date();
      const dayOfWeek = today.getDay();  // 0=Sunday, 1=Monday, ..., 5=Friday
      weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
      weekEnd = new Date(today);  // 週五
    }
    
    const weekStartDateStr = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekStartCol = headers.indexOf("week_start_date");
    const dataTypeCol = headers.indexOf("data_type");
    const symbolCol = headers.indexOf("symbol");
    
    if (weekStartCol === -1 || dataTypeCol === -1 || symbolCol === -1) {
      Logger.log("P5 Weekly V8.12：MACRO_DATA_WEEKLY_METRICS 表格欄位不完整");
      return {};
    }
    
    const metrics = {};
    
    // 讀取本週的數據
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekStartCol] === weekStartDateStr) {
        const dataType = rows[i][dataTypeCol];
        const symbol = rows[i][symbolCol];
        
        if (!metrics[dataType]) {
          metrics[dataType] = {};
        }
        
        // 構建完整的指標對象
        const metric = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = rows[i][j];
          
          // 嘗試解析JSON欄位
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              metric[header] = JSON.parse(value);
            } catch (e) {
              metric[header] = value;
            }
          } else {
            metric[header] = value;
          }
        }
        
        metrics[dataType][symbol] = metric;
      }
    }
    
    Logger.log(`P5 Weekly V8.12：讀取宏觀數據週度波動度完成，共 ${Object.keys(metrics).length} 個數據類型`);
    
    return metrics;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：讀取宏觀數據週度波動度失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 2. 讀取技術指標週度波動度
// ==========================================

/**
 * 讀取技術指標週度波動度計算結果 ⭐ V8.12 新增
 * 
 * @param {Array} tickers - 股票代碼列表（可選）
 * @param {string} weekStartDate - 週開始日期（可選，如果不提供則自動計算本週）
 * @returns {Object} metrics - 技術指標週度波動度（按ticker組織）
 */
function getTechnicalWeeklyMetrics(tickers = null, weekStartDate = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly V8.12：TECHNICAL_INDICATORS_WEEKLY_METRICS 表格不存在或為空");
      return {};
    }
    
    // 計算本週日期範圍
    let weekStart, weekEnd;
    if (weekStartDate) {
      weekStart = new Date(weekStartDate);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);  // 週五
    } else {
      const today = new Date();
      const dayOfWeek = today.getDay();  // 0=Sunday, 1=Monday, ..., 5=Friday
      weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
      weekEnd = new Date(today);  // 週五
    }
    
    const weekStartDateStr = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekStartCol = headers.indexOf("week_start_date");
    const tickerCol = headers.indexOf("ticker");
    
    if (weekStartCol === -1 || tickerCol === -1) {
      Logger.log("P5 Weekly V8.12：TECHNICAL_INDICATORS_WEEKLY_METRICS 表格欄位不完整");
      return {};
    }
    
    const metrics = {};
    
    // 讀取本週的數據
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekStartCol] === weekStartDateStr) {
        const ticker = rows[i][tickerCol];
        
        // 如果指定了tickers列表，則只讀取這些ticker的數據
        if (tickers && !tickers.includes(ticker)) {
          continue;
        }
        
        // 構建完整的指標對象
        const metric = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = rows[i][j];
          
          // 嘗試解析JSON欄位
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              metric[header] = JSON.parse(value);
            } catch (e) {
              metric[header] = value;
            }
          } else {
            metric[header] = value;
          }
        }
        
        metrics[ticker] = metric;
      }
    }
    
    Logger.log(`P5 Weekly V8.12：讀取技術指標週度波動度完成，共 ${Object.keys(metrics).length} 個ticker`);
    
    return metrics;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：讀取技術指標週度波動度失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 3. 讀取個股新聞索引
// ==========================================

/**
 * 讀取個股新聞索引（本週）⭐ V8.12 新增
 * 
 * @param {Array} tickers - 股票代碼列表（可選，如果不提供則讀取所有）
 * @param {string} dateStr - 日期字符串（可選，如果不提供則使用今天）
 * @returns {Object} newsIndex - 個股新聞索引（按ticker組織）
 */
function getStockNewsIndexForWeek(tickers = null, dateStr = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(STOCK_NEWS_INDEX_DAILY_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly V8.12：STOCK_NEWS_INDEX_DAILY 表格不存在或為空");
      return {};
    }
    
    // 計算本週日期範圍
    const today = new Date();
    if (!dateStr) {
      dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
    const weekEnd = new Date(today);  // 週五
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    
    if (dateCol === -1 || tickerCol === -1) {
      Logger.log("P5 Weekly V8.12：STOCK_NEWS_INDEX_DAILY 表格欄位不完整");
      return {};
    }
    
    const newsIndex = {};
    
    // 讀取本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        const ticker = rows[i][tickerCol];
        
        // 如果指定了tickers列表，則只讀取這些ticker的數據
        if (tickers && !tickers.includes(ticker)) {
          continue;
        }
        
        // 構建完整的索引對象
        const index = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = rows[i][j];
          
          // 嘗試解析JSON欄位
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              index[header] = JSON.parse(value);
            } catch (e) {
              index[header] = value;
            }
          } else {
            index[header] = value;
          }
        }
        
        // 如果該ticker已存在，合併數據（本週可能有多天的數據）
        if (!newsIndex[ticker]) {
          newsIndex[ticker] = {
            ticker: ticker,
            news_count: 0,
            bullish_count: 0,
            bearish_count: 0,
            neutral_count: 0,
            news_ids: [],
            sentiment_summary: {}
          };
        }
        
        newsIndex[ticker].news_count += index.news_count || 0;
        newsIndex[ticker].bullish_count += index.bullish_count || 0;
        newsIndex[ticker].bearish_count += index.bearish_count || 0;
        newsIndex[ticker].neutral_count += index.neutral_count || 0;
        
        if (index.news_ids_json && Array.isArray(index.news_ids_json)) {
          newsIndex[ticker].news_ids = newsIndex[ticker].news_ids.concat(index.news_ids_json);
        }
        
        // 更新情緒摘要（使用最新的）
        if (index.sentiment_summary_json) {
          newsIndex[ticker].sentiment_summary = index.sentiment_summary_json;
        }
      }
    }
    
    // 去重新聞ID
    for (const ticker in newsIndex) {
      newsIndex[ticker].news_ids = [...new Set(newsIndex[ticker].news_ids)];
    }
    
    Logger.log(`P5 Weekly V8.12：讀取個股新聞索引完成，共 ${Object.keys(newsIndex).length} 個ticker`);
    
    return newsIndex;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：讀取個股新聞索引失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 4. 讀取板塊/產業新聞索引
// ==========================================

/**
 * 讀取板塊/產業新聞索引（本週）⭐ V8.12 新增
 * 
 * @param {Array} sectors - 板塊/產業列表（可選，如果不提供則讀取所有）
 * @param {string} dateStr - 日期字符串（可選，如果不提供則使用今天）
 * @returns {Object} sectorIndex - 板塊/產業新聞索引（按sector_or_industry組織）
 */
function getSectorNewsIndexForWeek(sectors = null, dateStr = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SECTOR_NEWS_INDEX_DAILY_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly V8.12：SECTOR_NEWS_INDEX_DAILY 表格不存在或為空");
      return {};
    }
    
    // 計算本週日期範圍
    const today = new Date();
    if (!dateStr) {
      dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
    const weekEnd = new Date(today);  // 週五
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const sectorCol = headers.indexOf("sector_or_industry");
    
    if (dateCol === -1 || sectorCol === -1) {
      Logger.log("P5 Weekly V8.12：SECTOR_NEWS_INDEX_DAILY 表格欄位不完整");
      return {};
    }
    
    const sectorIndex = {};
    
    // 讀取本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        const sector = rows[i][sectorCol];
        
        // 如果指定了sectors列表，則只讀取這些sector的數據
        if (sectors && !sectors.includes(sector)) {
          continue;
        }
        
        // 構建完整的索引對象
        const index = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = rows[i][j];
          
          // 嘗試解析JSON欄位
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              index[header] = JSON.parse(value);
            } catch (e) {
              index[header] = value;
            }
          } else {
            index[header] = value;
          }
        }
        
        // 如果該sector已存在，合併數據（本週可能有多天的數據）
        if (!sectorIndex[sector]) {
          sectorIndex[sector] = {
            sector_or_industry: sector,
            sector_type: index.sector_type,
            news_count: 0,
            bullish_count: 0,
            bearish_count: 0,
            neutral_count: 0,
            news_ids: [],
            sentiment_summary: {},
            key_events: []
          };
        }
        
        sectorIndex[sector].news_count += index.news_count || 0;
        sectorIndex[sector].bullish_count += index.bullish_count || 0;
        sectorIndex[sector].bearish_count += index.bearish_count || 0;
        sectorIndex[sector].neutral_count += index.neutral_count || 0;
        
        if (index.news_ids_json && Array.isArray(index.news_ids_json)) {
          sectorIndex[sector].news_ids = sectorIndex[sector].news_ids.concat(index.news_ids_json);
        }
        
        // 更新情緒摘要和關鍵事件（使用最新的）
        if (index.sentiment_summary_json) {
          sectorIndex[sector].sentiment_summary = index.sentiment_summary_json;
        }
        if (index.key_events_json && Array.isArray(index.key_events_json)) {
          sectorIndex[sector].key_events = sectorIndex[sector].key_events.concat(index.key_events_json);
        }
      }
    }
    
    // 去重新聞ID和關鍵事件
    for (const sector in sectorIndex) {
      sectorIndex[sector].news_ids = [...new Set(sectorIndex[sector].news_ids)];
      // 關鍵事件去重（基於news_id）
      const seenEvents = new Set();
      sectorIndex[sector].key_events = sectorIndex[sector].key_events.filter(event => {
        const eventId = event.news_id || JSON.stringify(event);
        if (seenEvents.has(eventId)) {
          return false;
        }
        seenEvents.add(eventId);
        return true;
      });
    }
    
    Logger.log(`P5 Weekly V8.12：讀取板塊/產業新聞索引完成，共 ${Object.keys(sectorIndex).length} 個板塊/產業`);
    
    return sectorIndex;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：讀取板塊/產業新聞索引失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 5. 讀取事件索引
// ==========================================

/**
 * 讀取事件索引（本週）⭐ V8.12 新增
 * 
 * @param {Array} tickers - 股票代碼列表（可選，如果不提供則讀取所有）
 * @param {string} weekStartDate - 週開始日期（可選，如果不提供則自動計算本週）
 * @returns {Object} eventsIndex - 事件索引（按ticker組織）
 */
function getEventsIndexForWeek(tickers = null, weekStartDate = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(EVENTS_INDEX_WEEKLY_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly V8.12：EVENTS_INDEX_WEEKLY 表格不存在或為空");
      return {};
    }
    
    // 計算本週日期範圍
    let weekStart, weekEnd;
    if (weekStartDate) {
      weekStart = new Date(weekStartDate);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4);  // 週五
    } else {
      const today = new Date();
      const dayOfWeek = today.getDay();  // 0=Sunday, 1=Monday, ..., 5=Friday
      weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
      weekEnd = new Date(today);  // 週五
    }
    
    const weekStartDateStr = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekStartCol = headers.indexOf("week_start_date");
    const tickerCol = headers.indexOf("ticker");
    
    if (weekStartCol === -1 || tickerCol === -1) {
      Logger.log("P5 Weekly V8.12：EVENTS_INDEX_WEEKLY 表格欄位不完整");
      return {};
    }
    
    const eventsIndex = {};
    
    // 讀取本週的數據
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekStartCol] === weekStartDateStr) {
        const ticker = rows[i][tickerCol];
        
        // 如果指定了tickers列表，則只讀取這些ticker的數據
        if (tickers && !tickers.includes(ticker)) {
          continue;
        }
        
        // 構建完整的索引對象
        const index = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = rows[i][j];
          
          // 嘗試解析JSON欄位
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              index[header] = JSON.parse(value);
            } catch (e) {
              index[header] = value;
            }
          } else {
            index[header] = value;
          }
        }
        
        eventsIndex[ticker] = index;
      }
    }
    
    Logger.log(`P5 Weekly V8.12：讀取事件索引完成，共 ${Object.keys(eventsIndex).length} 個ticker`);
    
    return eventsIndex;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：讀取事件索引失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 6. 獲取股票的板塊/產業歸屬
// ==========================================

/**
 * 獲取股票的板塊/產業歸屬 ⭐ V8.12 新增
 * 用於從板塊/產業新聞索引中查找相關新聞
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object} sectorInfo - 板塊/產業信息
 */
function getStockSectorInfo(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { sector: null, industry: null };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("Company_Code");
    const themeTrackCol = headers.indexOf("Theme_Track");
    const themeIdCol = headers.indexOf("Theme_ID");
    
    if (tickerCol === -1) {
      return { sector: null, industry: null };
    }
    
    // 查找該ticker的數據
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker) {
        const themeTrack = rows[i][themeTrackCol] || "";
        const themeId = rows[i][themeIdCol] || "";
        
        // 從Theme_Track推斷板塊/產業（這裡需要根據實際的主題映射來調整）
        return {
          sector: inferSectorFromTheme(themeTrack),
          industry: themeId || null
        };
      }
    }
    
    return { sector: null, industry: null };
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：獲取股票板塊/產業歸屬失敗（${ticker}）：${error.message}`);
    return { sector: null, industry: null };
  }
}

/**
 * 從Theme_Track推斷板塊
 */
function inferSectorFromTheme(themeTrack) {
  // 這裡需要根據實際的主題映射來調整
  // 暫時返回null，實際應用時需要完善這個映射
  return null;
}
