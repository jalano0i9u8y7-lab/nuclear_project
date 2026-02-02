/**
 * 📊 P5 Daily: Weekly系統優化模組（V8.12 新增）
 * 
 * 實現Weekly系統優化，避免「重複工作100次」：
 * 1. 板塊/產業新聞索引（避免重複搜尋板塊/產業新聞100次）
 * 2. 事件索引（避免重複過濾事件列表100次）
 * 3. 宏觀數據週度波動度計算（程式計算，不用AI）
 * 4. 技術指標週度波動度計算（程式計算，不用AI）
 * 
 * 執行時機：每週五（週度聚合）
 * 
 * @version V8.12
 * @date 2026-01-19
 */

// ==========================================
// 1. 板塊/產業新聞索引建立
// ==========================================

/**
 * 建立板塊/產業新聞索引 ⭐ V8.12 新增
 * 
 * @param {Object} newsAtoms - 新聞原子化數據（已處理過）
 * @param {string} dateStr - 日期字符串
 * @returns {Object} sectorIndex - 板塊/產業索引
 */
function buildSectorNewsIndex(newsAtoms, dateStr) {
  try {
    Logger.log(`P5 Daily V8.12：開始建立板塊/產業新聞索引（日期：${dateStr}）`);
    
    const sectorIndex = {};
    const newsList = Object.values(newsAtoms);
    
    // 讀取股票的板塊/產業歸屬（從Phase2_Output）
    const stockSectorMap = getStockSectorMapping();
    
    // 第一遍：從新聞的related_tickers提取，並關聯到板塊/產業
    for (const news of newsList) {
      if (!news.related_tickers_json) continue;
      
      try {
        const relatedTickers = JSON.parse(news.related_tickers_json);
        const eventType = news.event_type_json ? JSON.parse(news.event_type_json) : null;
        const impactScope = news.impact_scope || "STOCK";
        
        // 提取板塊/產業標籤（從event_type和impact_scope推斷）
        const sectors = extractSectorsFromNews(news, relatedTickers, stockSectorMap, eventType, impactScope);
        
        // 聚合到索引
        for (const sector of sectors) {
          if (!sectorIndex[sector]) {
            sectorIndex[sector] = {
              sector_or_industry: sector,
              sector_type: determineSectorType(sector),
              news_ids: [],
              bullish_count: 0,
              bearish_count: 0,
              neutral_count: 0
            };
          }
          
          sectorIndex[sector].news_ids.push(news.news_id || news.id || `news_${Date.now()}_${Math.random()}`);
          
          // 統計情緒
          const sentiment = news.sentiment_polarity || "NEUTRAL";
          if (sentiment.includes("BULLISH")) {
            sectorIndex[sector].bullish_count++;
          } else if (sentiment.includes("BEARISH")) {
            sectorIndex[sector].bearish_count++;
          } else {
            sectorIndex[sector].neutral_count++;
          }
        }
      } catch (e) {
        Logger.log(`P5 Daily V8.12：解析新聞 ${news.news_id} 的相關tickers失敗：${e.message}`);
      }
    }
    
    // 生成情緒摘要和關鍵事件
    for (const sector in sectorIndex) {
      const index = sectorIndex[sector];
      index.news_count = index.news_ids.length;
      
      // 生成情緒摘要（簡單統計）
      index.sentiment_summary = {
        bullish_pct: index.news_count > 0 ? (index.bullish_count / index.news_count * 100).toFixed(1) : 0,
        bearish_pct: index.news_count > 0 ? (index.bearish_count / index.news_count * 100).toFixed(1) : 0,
        neutral_pct: index.news_count > 0 ? (index.neutral_count / index.news_count * 100).toFixed(1) : 0
      };
      
      // 提取關鍵事件（從相關新聞中）
      index.key_events = extractKeyEventsFromSectorNews(newsList, index.news_ids);
    }
    
    Logger.log(`P5 Daily V8.12：板塊/產業新聞索引建立完成，共 ${Object.keys(sectorIndex).length} 個板塊/產業`);
    
    return sectorIndex;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：建立板塊/產業新聞索引失敗：${error.message}`);
    return {};
  }
}

/**
 * 從新聞中提取板塊/產業標籤
 */
function extractSectorsFromNews(news, relatedTickers, stockSectorMap, eventType, impactScope) {
  const sectors = new Set();
  
  // 方法1：從股票的板塊/產業歸屬推斷
  for (const ticker of relatedTickers) {
    if (stockSectorMap[ticker]) {
      if (stockSectorMap[ticker].sector) {
        sectors.add(stockSectorMap[ticker].sector);
      }
      if (stockSectorMap[ticker].industry) {
        sectors.add(stockSectorMap[ticker].industry);
      }
    }
  }
  
  // 方法2：從event_type推斷（如果是SECTOR或GLOBAL級別的影響）
  if (impactScope === "SECTOR" && eventType && eventType.primary) {
    const primaryEvent = eventType.primary[0] || "";
    // 從事件類型推斷板塊（例如：Tech_Earnings -> Tech Sector）
    const inferredSector = inferSectorFromEventType(primaryEvent);
    if (inferredSector) {
      sectors.add(inferredSector);
    }
  }
  
  return Array.from(sectors);
}

/**
 * 從事件類型推斷板塊
 */
function inferSectorFromEventType(eventType) {
  const sectorMap = {
    "Tech_Earnings": "Technology",
    "Tech_Product": "Technology",
    "Tech_Regulation": "Technology",
    "Financial_Earnings": "Financial",
    "Financial_Policy": "Financial",
    "Energy_Price": "Energy",
    "Energy_Supply": "Energy",
    "Healthcare_Approval": "Healthcare",
    "Healthcare_Trial": "Healthcare"
    // 可以繼續擴展...
  };
  
  for (const [key, sector] of Object.entries(sectorMap)) {
    if (eventType.includes(key)) {
      return sector;
    }
  }
  
  return null;
}

/**
 * 判斷板塊類型（SECTOR或INDUSTRY）
 */
function determineSectorType(sectorName) {
  // 簡單判斷：如果是常見的板塊名稱，則是SECTOR，否則可能是INDUSTRY
  const commonSectors = ["Technology", "Financial", "Energy", "Healthcare", "Consumer", "Industrial", "Materials", "Real Estate", "Utilities", "Communication"];
  
  if (commonSectors.includes(sectorName)) {
    return "SECTOR";
  }
  
  return "INDUSTRY";
}

/**
 * 從股票數據中讀取板塊/產業歸屬映射
 */
function getStockSectorMapping() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("Company_Code");
    const themeTrackCol = headers.indexOf("Theme_Track");
    const themeIdCol = headers.indexOf("Theme_ID");
    
    if (tickerCol === -1) {
      return {};
    }
    
    const mapping = {};
    
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      const themeTrack = rows[i][themeTrackCol] || "";
      const themeId = rows[i][themeIdCol] || "";
      
      if (ticker) {
        // 從Theme_Track推斷板塊/產業（這裡需要根據實際的主題映射來調整）
        mapping[ticker] = {
          sector: inferSectorFromTheme(themeTrack),
          industry: themeId || null
        };
      }
    }
    
    return mapping;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：讀取股票板塊/產業映射失敗：${error.message}`);
    return {};
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

/**
 * 從板塊相關新聞中提取關鍵事件
 */
function extractKeyEventsFromSectorNews(newsList, newsIds) {
  const keyEvents = [];
  
  for (const news of newsList) {
    const newsId = news.news_id || news.id;
    if (newsIds.includes(newsId)) {
      const impactScope = news.impact_scope || "STOCK";
      if (impactScope === "SECTOR" || impactScope === "GLOBAL") {
        keyEvents.push({
          news_id: newsId,
          title: news.title || news.headline || "",
          impact_scope: impactScope,
          sentiment: news.sentiment_polarity || "NEUTRAL"
        });
      }
    }
  }
  
  return keyEvents.slice(0, 10);  // 最多返回10個關鍵事件
}

/**
 * 保存板塊/產業新聞索引到表格 ⭐ V8.12 新增
 */
function saveSectorNewsIndexToSheet(sectorIndex, dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SECTOR_NEWS_INDEX_DAILY_SCHEMA.sheetName);
    
    // 如果表格不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet(SECTOR_NEWS_INDEX_DAILY_SCHEMA.sheetName);
      sheet.appendRow(SECTOR_NEWS_INDEX_DAILY_SCHEMA.headers);
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, SECTOR_NEWS_INDEX_DAILY_SCHEMA.headers.length).getValues()[0];
    if (headers.length !== SECTOR_NEWS_INDEX_DAILY_SCHEMA.headers.length || 
        headers[0] !== SECTOR_NEWS_INDEX_DAILY_SCHEMA.headers[0]) {
      sheet.clear();
      sheet.appendRow(SECTOR_NEWS_INDEX_DAILY_SCHEMA.headers);
    }
    
    // 刪除當天的舊數據（如果存在）
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const dateCol = headers.indexOf("date");
    
    if (dateCol !== -1) {
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][dateCol] === dateStr) {
          sheet.deleteRow(i + 1);
        }
      }
    }
    
    // 寫入新數據
    const now = new Date();
    for (const sector in sectorIndex) {
      const index = sectorIndex[sector];
      const row = [
        dateStr,
        index.sector_or_industry,
        index.sector_type,
        index.news_count,
        index.bullish_count,
        index.bearish_count,
        index.neutral_count,
        JSON.stringify(index.news_ids || []),
        JSON.stringify(index.sentiment_summary || {}),
        JSON.stringify(index.key_events || []),
        now
      ];
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Daily V8.12：板塊/產業新聞索引已保存到 ${SECTOR_NEWS_INDEX_DAILY_SCHEMA.sheetName}`);
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：保存板塊/產業新聞索引失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 2. 事件索引建立（週度）
// ==========================================

/**
 * 建立事件索引（按ticker聚合）⭐ V8.12 新增
 * 
 * @param {Array} eventsList - 事件列表（從P5 Weekly Events收集）
 * @param {string} weekStartDate - 週開始日期
 * @param {string} weekEndDate - 週結束日期
 * @returns {Object} eventsIndex - 事件索引
 */
function buildEventsIndex(eventsList, weekStartDate, weekEndDate) {
  try {
    Logger.log(`P5 Daily V8.12：開始建立事件索引（週：${weekStartDate} 至 ${weekEndDate}）`);
    
    const eventsIndex = {};
    
    // 遍歷所有事件，建立ticker到事件的映射
    for (const event of eventsList) {
      const tickers = event.tickers || [];
      
      for (const ticker of tickers) {
        if (!eventsIndex[ticker]) {
          eventsIndex[ticker] = {
            ticker: ticker,
            events: [],
            event_types: new Set(),
            alert_levels: new Set()
          };
        }
        
        eventsIndex[ticker].events.push(event);
        
        if (event.event_type) {
          eventsIndex[ticker].event_types.add(event.event_type);
        }
        
        if (event.alert_level) {
          eventsIndex[ticker].alert_levels.add(event.alert_level);
        }
      }
    }
    
    // 格式化輸出
    const formattedIndex = {};
    for (const ticker in eventsIndex) {
      const index = eventsIndex[ticker];
      formattedIndex[ticker] = {
        ticker: ticker,
        event_count: index.events.length,
        upcoming_events: index.events.map(e => ({
          event_id: e.event_id || e.id,
          event_name: e.event_name || e.name,
          event_type: e.event_type,
          alert_level: e.alert_level,
          days_until_event: e.days_until_event || null,
          date_start: e.date_start || null
        })),
        event_types: Array.from(index.event_types),
        alert_levels: Array.from(index.alert_levels)
      };
    }
    
    Logger.log(`P5 Daily V8.12：事件索引建立完成，共 ${Object.keys(formattedIndex).length} 個ticker`);
    
    return formattedIndex;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：建立事件索引失敗：${error.message}`);
    return {};
  }
}

/**
 * 保存事件索引到表格 ⭐ V8.12 新增
 */
function saveEventsIndexToSheet(eventsIndex, weekStartDate, weekEndDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(EVENTS_INDEX_WEEKLY_SCHEMA.sheetName);
    
    // 如果表格不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet(EVENTS_INDEX_WEEKLY_SCHEMA.sheetName);
      sheet.appendRow(EVENTS_INDEX_WEEKLY_SCHEMA.headers);
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, EVENTS_INDEX_WEEKLY_SCHEMA.headers.length).getValues()[0];
    if (headers.length !== EVENTS_INDEX_WEEKLY_SCHEMA.headers.length || 
        headers[0] !== EVENTS_INDEX_WEEKLY_SCHEMA.headers[0]) {
      sheet.clear();
      sheet.appendRow(EVENTS_INDEX_WEEKLY_SCHEMA.headers);
    }
    
    // 刪除本週的舊數據（如果存在）
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const weekStartCol = headers.indexOf("week_start_date");
    
    if (weekStartCol !== -1) {
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][weekStartCol] === weekStartDate) {
          sheet.deleteRow(i + 1);
        }
      }
    }
    
    // 寫入新數據
    const now = new Date();
    for (const ticker in eventsIndex) {
      const index = eventsIndex[ticker];
      const row = [
        weekStartDate,
        weekEndDate,
        index.ticker,
        index.event_count,
        JSON.stringify(index.upcoming_events || []),
        JSON.stringify(index.event_types || []),
        JSON.stringify(index.alert_levels || []),
        now
      ];
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Daily V8.12：事件索引已保存到 ${EVENTS_INDEX_WEEKLY_SCHEMA.sheetName}`);
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：保存事件索引失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 3. 宏觀數據週度波動度計算（程式計算）
// ==========================================

/**
 * 計算宏觀數據週度波動度 ⭐ V8.12 新增
 * 
 * @param {string} weekStartDate - 週開始日期
 * @param {string} weekEndDate - 週結束日期
 * @returns {Array} metricsList - 計算結果列表
 */
function calculateMacroWeeklyMetrics(weekStartDate, weekEndDate) {
  try {
    Logger.log(`P5 Daily V8.12：開始計算宏觀數據週度波動度（週：${weekStartDate} 至 ${weekEndDate}）`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MACRO_DATA_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Daily V8.12：MACRO_DATA_DAILY 表格不存在或為空");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const dataTypeCol = headers.indexOf("data_type");
    const symbolCol = headers.indexOf("symbol");
    const nameCol = headers.indexOf("name");
    const valueCol = headers.indexOf("value");
    const volumeCol = headers.indexOf("volume");
    
    if (dateCol === -1 || dataTypeCol === -1 || symbolCol === -1 || valueCol === -1) {
      Logger.log("P5 Daily V8.12：MACRO_DATA_DAILY 表格欄位不完整");
      return [];
    }
    
    // 收集本週和上週的數據
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekEndDate);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
    
    const thisWeekData = {};
    const prevWeekData = {};
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      const dataType = rows[i][dataTypeCol];
      const symbol = rows[i][symbolCol];
      
      if (!symbol) continue;
      
      const key = `${dataType}_${symbol}`;
      const value = parseFloat(rows[i][valueCol]);
      const volume = volumeCol !== -1 ? parseFloat(rows[i][volumeCol]) : null;
      
      if (isNaN(value)) continue;
      
      // 分類到本週或上週
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        if (!thisWeekData[key]) {
          thisWeekData[key] = {
            data_type: dataType,
            symbol: symbol,
            name: rows[i][nameCol] || symbol,
            values: [],
            volumes: []
          };
        }
        thisWeekData[key].values.push(value);
        if (volume !== null && !isNaN(volume)) {
          thisWeekData[key].volumes.push(volume);
        }
      } else if (rowDate >= prevWeekStart && rowDate <= prevWeekEnd) {
        if (!prevWeekData[key]) {
          prevWeekData[key] = {
            data_type: dataType,
            symbol: symbol,
            values: [],
            volumes: []
          };
        }
        prevWeekData[key].values.push(value);
        if (volume !== null && !isNaN(volume)) {
          prevWeekData[key].volumes.push(volume);
        }
      }
    }
    
    // 計算每個數據項的波動度
    const metricsList = [];
    
    for (const key in thisWeekData) {
      const thisWeek = thisWeekData[key];
      const prevWeek = prevWeekData[key];
      
      if (thisWeek.values.length < 2) continue;  // 至少需要2個數據點
      
      // 計算本週波動度
      const priceVolatility = calculateVolatility(thisWeek.values);
      const priceMaxAmplitude = calculateMaxAmplitude(thisWeek.values);
      const volumeVolatility = thisWeek.volumes.length >= 2 ? calculateVolatility(thisWeek.volumes) : null;
      const priceVolumeCorrelation = thisWeek.volumes.length === thisWeek.values.length 
        ? calculateCorrelation(thisWeek.values, thisWeek.volumes) 
        : null;
      const divergenceScore = calculateDivergenceScore(thisWeek.values, thisWeek.volumes);
      
      // 計算上週波動度（用於比對）
      const prevWeekVolatility = prevWeek && prevWeek.values.length >= 2 
        ? calculateVolatility(prevWeek.values) 
        : null;
      const volatilityChangePct = prevWeekVolatility !== null
        ? ((priceVolatility - prevWeekVolatility) / prevWeekVolatility * 100).toFixed(2)
        : null;
      
      // 判斷趨勢變化
      const trendChange = determineTrendChange(priceVolatility, prevWeekVolatility);
      
      metricsList.push({
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        data_type: thisWeek.data_type,
        symbol: thisWeek.symbol,
        name: thisWeek.name,
        price_volatility: priceVolatility.toFixed(4),
        price_max_amplitude: priceMaxAmplitude.toFixed(4),
        volume_volatility: volumeVolatility !== null ? volumeVolatility.toFixed(4) : null,
        price_volume_correlation: priceVolumeCorrelation !== null ? priceVolumeCorrelation.toFixed(4) : null,
        divergence_score: divergenceScore.toFixed(4),
        prev_week_volatility: prevWeekVolatility !== null ? prevWeekVolatility.toFixed(4) : null,
        volatility_change_pct: volatilityChangePct,
        trend_change: trendChange
      });
    }
    
    Logger.log(`P5 Daily V8.12：宏觀數據週度波動度計算完成，共 ${metricsList.length} 項數據`);
    
    return metricsList;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：計算宏觀數據週度波動度失敗：${error.message}`);
    return [];
  }
}

/**
 * 計算波動度（標準差）
 */
function calculateVolatility(values) {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 計算最大振幅
 */
function calculateMaxAmplitude(values) {
  if (values.length < 2) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  return ((max - min) / min) * 100;  // 百分比振幅
}

/**
 * 計算相關性係數
 */
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return null;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return null;
  
  return numerator / denominator;
}

/**
 * 計算背離度評分（0-1，1為完全背離）
 */
function calculateDivergenceScore(prices, volumes) {
  if (prices.length < 2 || volumes.length < 2 || prices.length !== volumes.length) {
    return 0;  // 無法計算
  }
  
  // 計算價格和成交量的變化方向
  const priceChanges = [];
  const volumeChanges = [];
  
  for (let i = 1; i < prices.length; i++) {
    priceChanges.push(prices[i] > prices[i - 1] ? 1 : -1);
    volumeChanges.push(volumes[i] > volumes[i - 1] ? 1 : -1);
  }
  
  // 計算方向不一致的比例
  let divergenceCount = 0;
  for (let i = 0; i < priceChanges.length; i++) {
    if (priceChanges[i] * volumeChanges[i] < 0) {
      divergenceCount++;
    }
  }
  
  return divergenceCount / priceChanges.length;
}

/**
 * 判斷趨勢變化
 */
function determineTrendChange(currentVolatility, prevVolatility) {
  if (prevVolatility === null) return "STABLE";
  
  const changePct = (currentVolatility - prevVolatility) / prevVolatility * 100;
  
  if (changePct > 10) {
    return "ACCELERATING";
  } else if (changePct < -10) {
    return "DECELERATING";
  } else {
    return "STABLE";
  }
}

/**
 * 保存宏觀數據週度波動度到表格 ⭐ V8.12 新增
 */
function saveMacroWeeklyMetricsToSheet(metricsList) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(MACRO_DATA_WEEKLY_METRICS_SCHEMA.sheetName);
    
    // 如果表格不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet(MACRO_DATA_WEEKLY_METRICS_SCHEMA.sheetName);
      sheet.appendRow(MACRO_DATA_WEEKLY_METRICS_SCHEMA.headers);
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, MACRO_DATA_WEEKLY_METRICS_SCHEMA.headers.length).getValues()[0];
    if (headers.length !== MACRO_DATA_WEEKLY_METRICS_SCHEMA.headers.length || 
        headers[0] !== MACRO_DATA_WEEKLY_METRICS_SCHEMA.headers[0]) {
      sheet.clear();
      sheet.appendRow(MACRO_DATA_WEEKLY_METRICS_SCHEMA.headers);
    }
    
    // 刪除本週的舊數據（如果存在）
    if (metricsList.length > 0) {
      const weekStartDate = metricsList[0].week_start_date;
      const dataRange = sheet.getDataRange();
      const rows = dataRange.getValues();
      const weekStartCol = headers.indexOf("week_start_date");
      
      if (weekStartCol !== -1) {
        for (let i = rows.length - 1; i >= 1; i--) {
          if (rows[i][weekStartCol] === weekStartDate) {
            sheet.deleteRow(i + 1);
          }
        }
      }
    }
    
    // 寫入新數據
    const now = new Date();
    for (const metric of metricsList) {
      const row = [
        metric.week_start_date,
        metric.week_end_date,
        metric.data_type,
        metric.symbol,
        metric.name,
        metric.price_volatility,
        metric.price_max_amplitude,
        metric.volume_volatility,
        metric.price_volume_correlation,
        metric.divergence_score,
        metric.prev_week_volatility,
        metric.volatility_change_pct,
        metric.trend_change,
        now
      ];
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Daily V8.12：宏觀數據週度波動度已保存到 ${MACRO_DATA_WEEKLY_METRICS_SCHEMA.sheetName}`);
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：保存宏觀數據週度波動度失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 4. 技術指標週度波動度計算（程式計算）
// ==========================================

/**
 * 計算技術指標週度波動度 ⭐ V8.12 新增
 * 
 * @param {Array} tickers - 股票代碼列表
 * @param {string} weekStartDate - 週開始日期
 * @param {string} weekEndDate - 週結束日期
 * @returns {Array} metricsList - 計算結果列表
 */
function calculateTechnicalWeeklyMetrics(tickers, weekStartDate, weekEndDate) {
  try {
    Logger.log(`P5 Daily V8.12：開始計算技術指標週度波動度（週：${weekStartDate} 至 ${weekEndDate}，共 ${tickers.length} 檔）`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Daily V8.12：MARKET_INDICATORS_DAILY 表格不存在或為空");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const rsiCol = headers.indexOf("rsi_14");
    const macdValueCol = headers.indexOf("macd_value");
    const macdSignalCol = headers.indexOf("macd_signal");
    const ma20Col = headers.indexOf("ma20");
    const ma60Col = headers.indexOf("ma60");
    const volumeCol = headers.indexOf("volume");  // 需要從OHLCV表格讀取
    
    if (dateCol === -1 || tickerCol === -1) {
      Logger.log("P5 Daily V8.12：MARKET_INDICATORS_DAILY 表格欄位不完整");
      return [];
    }
    
    // 收集本週和上週的技術指標數據
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekEndDate);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
    
    const thisWeekData = {};
    const prevWeekData = {};
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      const ticker = rows[i][tickerCol];
      
      if (!ticker || !tickers.includes(ticker)) continue;
      
      // 分類到本週或上週
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        if (!thisWeekData[ticker]) {
          thisWeekData[ticker] = {
            rsi: [],
            macd_value: [],
            macd_signal: [],
            ma20: [],
            ma60: []
          };
        }
        
        if (rsiCol !== -1 && rows[i][rsiCol]) {
          thisWeekData[ticker].rsi.push(parseFloat(rows[i][rsiCol]));
        }
        if (macdValueCol !== -1 && rows[i][macdValueCol]) {
          thisWeekData[ticker].macd_value.push(parseFloat(rows[i][macdValueCol]));
        }
        if (macdSignalCol !== -1 && rows[i][macdSignalCol]) {
          thisWeekData[ticker].macd_signal.push(parseFloat(rows[i][macdSignalCol]));
        }
        if (ma20Col !== -1 && rows[i][ma20Col]) {
          thisWeekData[ticker].ma20.push(parseFloat(rows[i][ma20Col]));
        }
        if (ma60Col !== -1 && rows[i][ma60Col]) {
          thisWeekData[ticker].ma60.push(parseFloat(rows[i][ma60Col]));
        }
      } else if (rowDate >= prevWeekStart && rowDate <= prevWeekEnd) {
        if (!prevWeekData[ticker]) {
          prevWeekData[ticker] = {
            rsi: [],
            macd_value: [],
            macd_signal: [],
            ma20: [],
            ma60: []
          };
        }
        
        if (rsiCol !== -1 && rows[i][rsiCol]) {
          prevWeekData[ticker].rsi.push(parseFloat(rows[i][rsiCol]));
        }
        if (macdValueCol !== -1 && rows[i][macdValueCol]) {
          prevWeekData[ticker].macd_value.push(parseFloat(rows[i][macdValueCol]));
        }
        if (macdSignalCol !== -1 && rows[i][macdSignalCol]) {
          prevWeekData[ticker].macd_signal.push(parseFloat(rows[i][macdSignalCol]));
        }
        if (ma20Col !== -1 && rows[i][ma20Col]) {
          prevWeekData[ticker].ma20.push(parseFloat(rows[i][ma20Col]));
        }
        if (ma60Col !== -1 && rows[i][ma60Col]) {
          prevWeekData[ticker].ma60.push(parseFloat(rows[i][ma60Col]));
        }
      }
    }
    
    // 讀取成交量數據（從OHLCV表格）
    const volumeData = getVolumeDataForWeek(tickers, weekStartDate, weekEndDate);
    
    // 計算每個ticker的波動度
    const metricsList = [];
    
    for (const ticker of tickers) {
      const thisWeek = thisWeekData[ticker];
      const prevWeek = prevWeekData[ticker];
      
      if (!thisWeek) continue;
      
      // 計算RSI變化範圍
      const rsiChangeRange = thisWeek.rsi.length >= 2 ? {
        min: Math.min(...thisWeek.rsi).toFixed(2),
        max: Math.max(...thisWeek.rsi).toFixed(2),
        change: (Math.max(...thisWeek.rsi) - Math.min(...thisWeek.rsi)).toFixed(2)
      } : null;
      
      // 計算MACD背離
      const macdDivergence = thisWeek.macd_value.length >= 2 && thisWeek.macd_signal.length >= 2
        ? detectMACDDivergence(thisWeek.macd_value, thisWeek.macd_signal)
        : { has_divergence: false, type: null };
      
      // 計算均線交叉情況
      const maCrossovers = detectMACrossovers(thisWeek.ma20, thisWeek.ma60);
      
      // 計算成交量趨勢
      const volumes = volumeData[ticker] || [];
      const volumeTrend = volumes.length >= 2 ? determineVolumeTrend(volumes) : "STABLE";
      
      // 與上週對比
      const prevWeekComparison = prevWeek ? {
        rsi_change: thisWeek.rsi.length >= 2 && prevWeek.rsi.length >= 2
          ? (thisWeek.rsi[thisWeek.rsi.length - 1] - prevWeek.rsi[prevWeek.rsi.length - 1]).toFixed(2)
          : null,
        macd_change: thisWeek.macd_value.length >= 2 && prevWeek.macd_value.length >= 2
          ? (thisWeek.macd_value[thisWeek.macd_value.length - 1] - prevWeek.macd_value[prevWeek.macd_value.length - 1]).toFixed(4)
          : null
      } : null;
      
      metricsList.push({
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        ticker: ticker,
        rsi_change_range: rsiChangeRange,
        macd_divergence: macdDivergence,
        ma_crossovers: maCrossovers,
        volume_trend: volumeTrend,
        prev_week_comparison: prevWeekComparison
      });
    }
    
    Logger.log(`P5 Daily V8.12：技術指標週度波動度計算完成，共 ${metricsList.length} 檔股票`);
    
    return metricsList;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：計算技術指標週度波動度失敗：${error.message}`);
    return [];
  }
}

/**
 * 檢測MACD背離
 */
function detectMACDDivergence(macdValues, macdSignals) {
  if (macdValues.length < 2 || macdSignals.length < 2) {
    return { has_divergence: false, type: null };
  }
  
  // 簡化版：檢查MACD和Signal的交叉
  let crosses = 0;
  for (let i = 1; i < macdValues.length; i++) {
    const prevDiff = macdValues[i - 1] - macdSignals[i - 1];
    const currDiff = macdValues[i] - macdSignals[i];
    
    if (prevDiff * currDiff < 0) {
      crosses++;
    }
  }
  
  // 如果交叉次數過多，可能存在背離
  if (crosses >= 2) {
    return { has_divergence: true, type: "FREQUENT_CROSSES" };
  }
  
  return { has_divergence: false, type: null };
}

/**
 * 檢測均線交叉情況
 */
function detectMACrossovers(ma20, ma60) {
  if (ma20.length < 2 || ma60.length < 2) {
    return { has_crossover: false, type: null };
  }
  
  const crossovers = [];
  
  for (let i = 1; i < ma20.length; i++) {
    const prevMa20Above = ma20[i - 1] > ma60[i - 1];
    const currMa20Above = ma20[i] > ma60[i];
    
    if (prevMa20Above !== currMa20Above) {
      crossovers.push({
        type: currMa20Above ? "GOLDEN_CROSS" : "DEATH_CROSS",
        date_index: i
      });
    }
  }
  
  return {
    has_crossover: crossovers.length > 0,
    crossovers: crossovers
  };
}

/**
 * 判斷成交量趨勢
 */
function determineVolumeTrend(volumes) {
  if (volumes.length < 2) return "STABLE";
  
  // 計算前後半段的平均成交量
  const midPoint = Math.floor(volumes.length / 2);
  const firstHalf = volumes.slice(0, midPoint);
  const secondHalf = volumes.slice(midPoint);
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const changePct = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (changePct > 10) {
    return "INCREASING";
  } else if (changePct < -10) {
    return "DECREASING";
  } else {
    return "STABLE";
  }
}

/**
 * 獲取週度成交量數據
 */
function getVolumeDataForWeek(tickers, weekStartDate, weekEndDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const volumeCol = headers.indexOf("volume");
    
    if (dateCol === -1 || tickerCol === -1 || volumeCol === -1) {
      return {};
    }
    
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekEndDate);
    
    const volumeData = {};
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      const ticker = rows[i][tickerCol];
      const volume = parseFloat(rows[i][volumeCol]);
      
      if (!ticker || !tickers.includes(ticker) || isNaN(volume)) continue;
      
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        if (!volumeData[ticker]) {
          volumeData[ticker] = [];
        }
        volumeData[ticker].push(volume);
      }
    }
    
    return volumeData;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：讀取成交量數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 保存技術指標週度波動度到表格 ⭐ V8.12 新增
 */
function saveTechnicalWeeklyMetricsToSheet(metricsList) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.sheetName);
    
    // 如果表格不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet(TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.sheetName);
      sheet.appendRow(TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.headers);
    }
    
    // 檢查標題行
    const headers = sheet.getRange(1, 1, 1, TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.headers.length).getValues()[0];
    if (headers.length !== TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.headers.length || 
        headers[0] !== TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.headers[0]) {
      sheet.clear();
      sheet.appendRow(TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.headers);
    }
    
    // 刪除本週的舊數據（如果存在）
    if (metricsList.length > 0) {
      const weekStartDate = metricsList[0].week_start_date;
      const dataRange = sheet.getDataRange();
      const rows = dataRange.getValues();
      const weekStartCol = headers.indexOf("week_start_date");
      const tickerCol = headers.indexOf("ticker");
      
      if (weekStartCol !== -1) {
        for (let i = rows.length - 1; i >= 1; i--) {
          if (rows[i][weekStartCol] === weekStartDate) {
            sheet.deleteRow(i + 1);
          }
        }
      }
    }
    
    // 寫入新數據
    const now = new Date();
    for (const metric of metricsList) {
      const row = [
        metric.week_start_date,
        metric.week_end_date,
        metric.ticker,
        JSON.stringify(metric.rsi_change_range || {}),
        JSON.stringify(metric.macd_divergence || {}),
        JSON.stringify(metric.ma_crossovers || {}),
        metric.volume_trend,
        JSON.stringify(metric.prev_week_comparison || {}),
        now
      ];
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Daily V8.12：技術指標週度波動度已保存到 ${TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA.sheetName}`);
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：保存技術指標週度波動度失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 週度聚合主函數（在週五調用）
// ==========================================

/**
 * 執行週度聚合優化（在週五調用）⭐ V8.12 新增
 * 
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源
 * @param {Object} params.newsAtoms - 新聞原子化數據（可選，如果不提供則從表格讀取）
 * @param {Array} params.eventsList - 事件列表（可選，如果不提供則從Weekly Events讀取）
 * @param {Array} params.tickers - 股票代碼列表（可選）
 */
function executeWeeklyOptimization(params) {
  try {
    Logger.log(`P5 Daily V8.12：開始執行週度聚合優化（trigger=${params.trigger}）`);
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 計算本週的開始和結束日期（週一到週五）
    const dayOfWeek = today.getDay();  // 0=Sunday, 1=Monday, ..., 5=Friday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));  // 週一
    const weekEnd = new Date(today);  // 週五
    
    const weekStartDate = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const weekEndDate = Utilities.formatDate(weekEnd, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    Logger.log(`P5 Daily V8.12：週度聚合範圍：${weekStartDate} 至 ${weekEndDate}`);
    
    // 1. 建立板塊/產業新聞索引
    try {
      let newsAtoms = params.newsAtoms;
      if (!newsAtoms) {
        // 從表格讀取本週的新聞
        newsAtoms = getNewsAtomsForWeek(weekStartDate, weekEndDate);
      }
      
      if (newsAtoms && Object.keys(newsAtoms).length > 0) {
        const sectorIndex = buildSectorNewsIndex(newsAtoms, dateStr);
        saveSectorNewsIndexToSheet(sectorIndex, dateStr);
        Logger.log(`P5 Daily V8.12：板塊/產業新聞索引完成`);
      }
    } catch (error) {
      Logger.log(`P5 Daily V8.12：板塊/產業新聞索引失敗：${error.message}`);
    }
    
    // 2. 建立事件索引
    try {
      let eventsList = params.eventsList;
      if (!eventsList) {
        // 從Weekly Events讀取本週的事件
        eventsList = getEventsForWeek(weekStartDate, weekEndDate);
      }
      
      if (eventsList && eventsList.length > 0) {
        const eventsIndex = buildEventsIndex(eventsList, weekStartDate, weekEndDate);
        saveEventsIndexToSheet(eventsIndex, weekStartDate, weekEndDate);
        Logger.log(`P5 Daily V8.12：事件索引完成`);
      }
    } catch (error) {
      Logger.log(`P5 Daily V8.12：事件索引失敗：${error.message}`);
    }
    
    // 3. 計算宏觀數據週度波動度
    try {
      const macroMetrics = calculateMacroWeeklyMetrics(weekStartDate, weekEndDate);
      if (macroMetrics.length > 0) {
        saveMacroWeeklyMetricsToSheet(macroMetrics);
        Logger.log(`P5 Daily V8.12：宏觀數據週度波動度計算完成`);
      }
    } catch (error) {
      Logger.log(`P5 Daily V8.12：宏觀數據週度波動度計算失敗：${error.message}`);
    }
    
    // 4. 計算技術指標週度波動度
    try {
      const tickers = params.tickers || getHoldingsTickers();
      if (tickers.length > 0) {
        const technicalMetrics = calculateTechnicalWeeklyMetrics(tickers, weekStartDate, weekEndDate);
        if (technicalMetrics.length > 0) {
          saveTechnicalWeeklyMetricsToSheet(technicalMetrics);
          Logger.log(`P5 Daily V8.12：技術指標週度波動度計算完成`);
        }
      }
    } catch (error) {
      Logger.log(`P5 Daily V8.12：技術指標週度波動度計算失敗：${error.message}`);
    }
    
    Logger.log(`P5 Daily V8.12：週度聚合優化完成`);
    
    return {
      status: "SUCCESS",
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      message: "週度聚合優化完成"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：執行週度聚合優化失敗：${error.message}`);
    throw error;
  }
}

/**
 * 從表格讀取本週的新聞原子化數據
 */
function getNewsAtomsForWeek(weekStartDate, weekEndDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const newsIdCol = headers.indexOf("news_id");
    
    if (dateCol === -1 || newsIdCol === -1) {
      return {};
    }
    
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekEndDate);
    const newsAtoms = {};
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      
      if (rowDate >= weekStart && rowDate <= weekEnd) {
        const newsId = rows[i][newsIdCol];
        if (newsId) {
          // 構建新聞對象（簡化版，實際需要讀取所有欄位）
          const news = {};
          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            const value = rows[i][j];
            
            // 嘗試解析JSON欄位
            if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
              try {
                news[header] = JSON.parse(value);
              } catch (e) {
                news[header] = value;
              }
            } else {
              news[header] = value;
            }
          }
          
          newsAtoms[newsId] = news;
        }
      }
    }
    
    return newsAtoms;
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：讀取本週新聞失敗：${error.message}`);
    return {};
  }
}

/**
 * 從Weekly Events讀取本週的事件列表
 */
function getEventsForWeek(weekStartDate, weekEndDate) {
  try {
    // 這裡需要調用Weekly Events相關函數來獲取事件
    // 暫時返回空數組，實際應用時需要實現
    Logger.log(`P5 Daily V8.12：getEventsForWeek 需要實現（從Weekly Events讀取）`);
    return [];
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：讀取本週事件失敗：${error.message}`);
    return [];
  }
}
