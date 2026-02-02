/**
 * 📊 P5 Daily: 數據保存函數
 * 
 * 將收集的數據保存到 Google Sheets
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 保存每日數據到表格
 * 
 * @param {Object} collectionResult - 收集結果
 */
function saveDailyDataToSheets(collectionResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  
  // 保存 OHLCV 數據
  if (collectionResult.ohlcv) {
    saveOHLCVToSheet(collectionResult.ohlcv, today);
  }
  
  // 保存技術指標
  if (collectionResult.technical_indicators) {
    saveTechnicalIndicatorsToSheet(collectionResult.technical_indicators, today);
  }
  
  // 保存板塊 ETF 數據
  if (collectionResult.sector_etf) {
    saveSectorETFToSheet(collectionResult.sector_etf, today);
  }
  
  // 保存衍生品數據
  if (collectionResult.derivatives) {
    saveDerivativesToSheet(collectionResult.derivatives, today);
  }
  
  // 保存宏觀數據
  if (collectionResult.macro_data) {
    saveMacroDataToSheet(collectionResult.macro_data, today);
  }
  
  // 保存新聞原子化數據
  if (collectionResult.news_atoms) {
    saveNewsAtomsToSheet(collectionResult.news_atoms, today);
  }
  
  // ⭐ V8.0 新增：整合 P6 異常數據到 Daily 日更資料
  try {
    integrateP6AnomaliesToDaily(today);
  } catch (error) {
    Logger.log(`P5 Daily：整合 P6 異常數據失敗：${error.message}`);
  }
  
  // ⭐ V8.0 新增：整合 P6 異常數據到 Daily 日更資料
  try {
    integrateP6AnomaliesToDaily(today);
  } catch (error) {
    Logger.log(`P5 Daily：整合 P6 異常數據失敗：${error.message}`);
  }
  
  Logger.log("P5 Daily：數據已保存到表格");
}

/**
 * ⭐ V8.0 新增：整合 P6 異常數據到 Daily 日更資料
 * 
 * @param {Date} date - 日期
 * @returns {boolean} success - 是否成功
 */
function integrateP6AnomaliesToDaily(date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const alertsSheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!alertsSheet || alertsSheet.getLastRow() <= 1) {
      Logger.log(`P5 Daily：P6_INTRADAY_ALERTS_DAILY 無數據，跳過整合`);
      return false;
    }
    
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 讀取當天標記為需保留的異常數據
    const dataRange = alertsSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const integratedCol = headers.indexOf("integrated_to_daily");
    
    if (dateCol === -1 || integratedCol === -1) {
      Logger.log(`P5 Daily：P6_INTRADAY_ALERTS_DAILY 表格格式不正確`);
      return false;
    }
    
    let integratedCount = 0;
    
    // 處理當天的異常數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      const isIntegrated = rows[i][integratedCol];
      
      if (rowDate === dateStr && !isIntegrated) {
        const ticker = rows[i][headers.indexOf("ticker")];
        const alertType = rows[i][headers.indexOf("alert_type")];
        const priceDataJson = rows[i][headers.indexOf("price_data_json")];
        
        // 整合到 MARKET_OHLCV_DAILY（如果有價格數據）
        if (priceDataJson) {
          try {
            const priceData = JSON.parse(priceDataJson);
            // 這裡可以將異常數據的詳細價格信息保存到 MARKET_OHLCV_DAILY
            // 或者創建專門的記錄
          } catch (e) {
            Logger.log(`P5 Daily：解析 P6 異常價格數據失敗：${e.message}`);
          }
        }
        
        // 標記為已整合
        alertsSheet.getRange(i + 1, integratedCol + 1).setValue(true);
        alertsSheet.getRange(i + 1, headers.indexOf("updated_at") + 1).setValue(new Date());
        
        integratedCount++;
      }
    }
    
    Logger.log(`P5 Daily：成功整合 ${integratedCount} 筆 P6 異常數據到 Daily 日更資料`);
    
    return true;
    
  } catch (error) {
    Logger.log(`P5 Daily：整合 P6 異常數據失敗：${error.message}`);
    return false;
  }
}

/**
 * 更新 P5 Daily 狀態
 * 
 * @param {Object} collectionResult - 收集結果
 */
function updateP5DailyStatus(collectionResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__DAILY_STATUS");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__DAILY_STATUS");
    sheet.appendRow(P5_DAILY_STATUS_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const ohlcvCount = Object.keys(collectionResult.ohlcv || {}).length;
  const sectorETFCount = Object.keys(collectionResult.sector_etf || {}).length;
  const derivativesCount = Object.keys(collectionResult.derivatives || {}).length;
  const macroDataCount = Object.keys(collectionResult.macro_data?.commodities || {}).length + 
                         Object.keys(collectionResult.macro_data?.currencies || {}).length +
                         Object.keys(collectionResult.macro_data?.bonds || {}).length +
                         Object.keys(collectionResult.macro_data?.indices || {}).length;
  const newsAtomsCount = Object.keys(collectionResult.news_atoms || {}).length;
  
  sheet.appendRow([
    new Date(),
    "COMPLETED",
    ohlcvCount,
    sectorETFCount,
    derivativesCount,
    newsAtomsCount,
    new Date()
  ]);
  
  Logger.log(`P5 Daily 狀態已更新：OHLCV=${ohlcvCount}, ETF=${sectorETFCount}, Derivatives=${derivativesCount}, Macro=${macroDataCount}, News=${newsAtomsCount}`);
}

/**
 * 保存 OHLCV 數據到表格
 * 
 * @param {Object} ohlcvData - OHLCV 數據
 * @param {Date} date - 日期
 */
function saveOHLCVToSheet(ohlcvData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MARKET_OHLCV_DAILY");
      sheet.appendRow(MARKET_OHLCV_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(ohlcvData)) {
      if (data.status === "COMPLETED" && data.date) {
        rows.push([
          data.date,
          ticker,
          data.open,
          data.high,
          data.low,
          data.close,
          data.volume,
          data.adj_close || data.close,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆 OHLCV 數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存 OHLCV 數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存技術指標到表格
 * 
 * @param {Object} indicatorsData - 技術指標數據
 * @param {Date} date - 日期
 */
function saveTechnicalIndicatorsToSheet(indicatorsData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MARKET_INDICATORS_DAILY");
      sheet.appendRow(MARKET_INDICATORS_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(indicatorsData)) {
      if (data.status === "COMPLETED") {
        rows.push([
          date,
          ticker,
          data.rsi_14,
          data.macd ? data.macd.value : null,
          data.macd ? data.macd.signal : null,
          data.macd ? data.macd.histogram : null,
          data.atr_14,
          data.ma20,
          data.ma60,
          data.ma240,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆技術指標數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存技術指標數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存板塊 ETF 數據到表格
 * 
 * @param {Object} sectorETFData - 板塊 ETF 數據
 * @param {Date} date - 日期
 */
function saveSectorETFToSheet(sectorETFData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("SECTOR_ETF_DAILY");
      sheet.appendRow(SECTOR_ETF_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(sectorETFData)) {
      if (data.status === "COMPLETED") {
        rows.push([
          date,
          data.etf_ticker,
          data.sector,
          data.close,
          data.week_performance,
          data.month_performance,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆板塊 ETF 數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存板塊 ETF 數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存衍生品數據到表格
 * 
 * @param {Object} derivativesData - 衍生品數據
 * @param {Date} date - 日期
 */
function saveDerivativesToSheet(derivativesData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("DERIVATIVES_DAILY");
      sheet.appendRow(DERIVATIVES_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(derivativesData)) {
      if (data.status === "COMPLETED" || data.status === "PENDING") {
        rows.push([
          date,
          ticker,
          data.put_call_ratio,
          data.max_oi_strike_call,
          data.max_oi_strike_put,
          data.iv_30d,
          data.days_to_opex,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆衍生品數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存衍生品數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存宏觀數據到表格
 * 
 * @param {Object} macroData - 宏觀數據
 * @param {Date} date - 日期
 */
function saveMacroDataToSheet(macroData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MACRO_DATA_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MACRO_DATA_DAILY");
      sheet.appendRow(MACRO_DATA_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 保存商品價格
    if (macroData.commodities) {
      for (const [symbol, data] of Object.entries(macroData.commodities)) {
        rows.push([
          dateStr,
          "commodities",  // data_type
          symbol,
          data.name || symbol,
          data.price || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存匯率
    if (macroData.currencies) {
      for (const [symbol, data] of Object.entries(macroData.currencies)) {
        rows.push([
          dateStr,
          "currencies",  // data_type
          symbol,
          data.name || symbol,
          data.rate || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存國債利率
    if (macroData.bonds) {
      for (const [symbol, data] of Object.entries(macroData.bonds)) {
        rows.push([
          dateStr,
          "bonds",  // data_type
          symbol,
          data.name || symbol,
          data.yield || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存市場指數
    if (macroData.indices) {
      for (const [symbol, data] of Object.entries(macroData.indices)) {
        rows.push([
          dateStr,
          "indices",  // data_type
          symbol,
          data.name || symbol,
          data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆宏觀數據到表格`);
    }
  } catch (error) {
    Logger.log(`P5 Daily：保存宏觀數據失敗：${error.message}`);
  }
}

/**
 * 保存新聞原子化數據到表格
 * 
 * @param {Object} newsAtomsData - 新聞原子化數據
 * @param {Date} date - 日期
 */
function saveNewsAtomsToSheet(newsAtomsData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("NEWS_ATOMS_DAILY");
      sheet.appendRow(NEWS_ATOMS_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
      Logger.log("P5 Daily：創建 NEWS_ATOMS_DAILY 表格");
    } else {
      // ⭐ V8.13 修正：強制更新表格標題行（確保標題行與 SCHEMA 完全一致）
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const expectedHeaders = NEWS_ATOMS_DAILY_SCHEMA.headers;
      
      // 檢查標題行是否與預期完全一致
      const headersMatch = currentHeaders.length === expectedHeaders.length && 
                           currentHeaders.every((h, i) => h === expectedHeaders[i]);
      
      if (!headersMatch) {
        Logger.log(`P5 Daily V8.13：表格標題行不匹配，強制更新標題行`);
        Logger.log(`P5 Daily V8.13：當前欄位數：${currentHeaders.length}，預期欄位數：${expectedHeaders.length}`);
        
        // ⭐ V8.13 修正：直接重寫整個標題行，而不是逐個插入
        // 這樣可以確保標題行與 SCHEMA 完全一致
        const currentColCount = sheet.getLastColumn();
        const expectedColCount = expectedHeaders.length;
        
        // 如果預期欄位數多於當前欄位數，需要添加新欄位
        if (expectedColCount > currentColCount) {
          const colsToAdd = expectedColCount - currentColCount;
          for (let i = 0; i < colsToAdd; i++) {
            sheet.insertColumnAfter(currentColCount + i);
          }
        } else if (expectedColCount < currentColCount) {
          // 如果預期欄位數少於當前欄位數，刪除多餘的欄位（但這通常不應該發生）
          Logger.log(`P5 Daily V8.13：⚠️ 預期欄位數少於當前欄位數，保留現有欄位`);
        }
        
        // 重寫整個標題行
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        Logger.log(`P5 Daily V8.13：✓ NEWS_ATOMS_DAILY 表格標題行已更新（共 ${expectedHeaders.length} 個欄位）`);
      } else {
        Logger.log(`P5 Daily V8.13：✓ NEWS_ATOMS_DAILY 表格標題行已是最新版本（共 ${currentHeaders.length} 個欄位）`);
      }
    }
    
    if (!newsAtomsData || Object.keys(newsAtomsData).length === 0) {
      Logger.log("P5 Daily：無新聞原子化數據需要保存");
      return;
    }
    
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rows = [];
    
    // ⭐ V8.13 修正：使用完整的 NEWS_ATOMS_DAILY_SCHEMA 欄位順序
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerIndexMap = {};
    for (let i = 0; i < headers.length; i++) {
      headerIndexMap[headers[i]] = i;
    }
    
    // ⭐ V8.9 修正：處理兩種數據格式
    // 格式 1：{atomId: {atom_id, category, ticker, title, ...}} - 已經解析好的格式（V8.12 新格式）
    // 格式 2：{ticker: {ticker, search_results: [...], status: "COMPLETED"}} - 包含 CSE 搜尋結果的格式（舊格式）
    
    for (const [key, item] of Object.entries(newsAtomsData)) {
      // 檢查是否為格式 2（包含 search_results 陣列）
      if (item.search_results && Array.isArray(item.search_results) && item.status === "COMPLETED") {
        // 格式 2：需要解析 search_results 陣列（舊格式，兼容性保留）
        const ticker = item.ticker || key;
        
        for (let i = 0; i < item.search_results.length; i++) {
          const result = item.search_results[i];
          const atomId = `NEWS_${dateStr}_${ticker}_${i + 1}_${Date.now()}`;
          
          // 構建完整的行數據（根據實際表格欄位順序）
          const row = new Array(headers.length);
          row[headerIndexMap["date"]] = dateStr;
          row[headerIndexMap["atom_id"]] = atomId;
          row[headerIndexMap["category"]] = categorizeNewsByContent(result.title || result.snippet || "");
          row[headerIndexMap["ticker"]] = ticker;
          row[headerIndexMap["title"]] = result.title || "";
          row[headerIndexMap["summary"]] = result.snippet || result.description || "";
          row[headerIndexMap["source"]] = extractSourceFromUrl(result.link) || "未知來源";
          row[headerIndexMap["importance"]] = "MEDIUM";
          row[headerIndexMap["url"]] = result.link || "";
          if (headerIndexMap["macro_context_json"] !== undefined) row[headerIndexMap["macro_context_json"]] = "{}";
          // ⭐ V8.12 新增欄位（舊格式數據使用默認值）
          if (headerIndexMap["event_type_json"] !== undefined) row[headerIndexMap["event_type_json"]] = JSON.stringify({ primary: "其他", secondary: [] });
          if (headerIndexMap["impact_scope"] !== undefined) row[headerIndexMap["impact_scope"]] = "STOCK";
          if (headerIndexMap["sentiment_polarity"] !== undefined) row[headerIndexMap["sentiment_polarity"]] = "NEUTRAL";
          if (headerIndexMap["related_tickers_json"] !== undefined) row[headerIndexMap["related_tickers_json"]] = JSON.stringify([ticker]);
          if (headerIndexMap["data_type"] !== undefined) row[headerIndexMap["data_type"]] = "NARRATIVE";
          if (headerIndexMap["data_recency"] !== undefined) row[headerIndexMap["data_recency"]] = "UNCLEAR";
          if (headerIndexMap["data_coherence"] !== undefined) row[headerIndexMap["data_coherence"]] = "CONSISTENT";
          if (headerIndexMap["data_verification"] !== undefined) row[headerIndexMap["data_verification"]] = "NOT_VERIFIED";
          if (headerIndexMap["narrative_direction"] !== undefined) row[headerIndexMap["narrative_direction"]] = null;
          if (headerIndexMap["market_confirmation"] !== undefined) row[headerIndexMap["market_confirmation"]] = null;
          if (headerIndexMap["cross_asset_resonance"] !== undefined) row[headerIndexMap["cross_asset_resonance"]] = null;
          if (headerIndexMap["verification_details_json"] !== undefined) row[headerIndexMap["verification_details_json"]] = JSON.stringify({});
          if (headerIndexMap["created_at"] !== undefined) row[headerIndexMap["created_at"]] = new Date();
          
          rows.push(row);
        }
        
        Logger.log(`P5 Daily：從 ${ticker} 的 search_results 解析出 ${item.search_results.length} 筆新聞`);
        
      } else if (item.atom_id || item.title) {
        // 格式 1：已經解析好的格式（V8.12 新格式）
        const row = new Array(headers.length);
        row[headerIndexMap["date"]] = dateStr;
        row[headerIndexMap["atom_id"]] = item.atom_id || key;
        row[headerIndexMap["category"]] = item.category || "其他";
        row[headerIndexMap["ticker"]] = item.ticker || "";
        row[headerIndexMap["title"]] = item.title || "";
        row[headerIndexMap["summary"]] = item.summary || "";
        row[headerIndexMap["source"]] = item.source || "";
        row[headerIndexMap["importance"]] = item.importance || "MEDIUM";
        row[headerIndexMap["url"]] = item.url || "";
        if (headerIndexMap["macro_context_json"] !== undefined) row[headerIndexMap["macro_context_json"]] = item.macro_context_json || "{}";
        // ⭐ V8.12 新增：多維度標籤系統
        if (headerIndexMap["event_type_json"] !== undefined) {
          const eventType = item.event_type || {};
          row[headerIndexMap["event_type_json"]] = typeof eventType === 'string' ? eventType : JSON.stringify(eventType);
        }
        if (headerIndexMap["impact_scope"] !== undefined) row[headerIndexMap["impact_scope"]] = item.impact_scope || "STOCK";
        if (headerIndexMap["sentiment_polarity"] !== undefined) row[headerIndexMap["sentiment_polarity"]] = item.sentiment_polarity || "NEUTRAL";
        if (headerIndexMap["related_tickers_json"] !== undefined) {
          const relatedTickers = item.related_tickers || [];
          row[headerIndexMap["related_tickers_json"]] = typeof relatedTickers === 'string' ? relatedTickers : JSON.stringify(relatedTickers);
        }
        // ⭐ V8.12 新增：新聞驗證標記
        if (headerIndexMap["data_type"] !== undefined) row[headerIndexMap["data_type"]] = item.data_type || "NARRATIVE";
        if (headerIndexMap["data_recency"] !== undefined) row[headerIndexMap["data_recency"]] = item.data_recency || "UNCLEAR";
        if (headerIndexMap["data_coherence"] !== undefined) row[headerIndexMap["data_coherence"]] = item.data_coherence || "CONSISTENT";
        if (headerIndexMap["data_verification"] !== undefined) row[headerIndexMap["data_verification"]] = item.data_verification || "NOT_VERIFIED";
        if (headerIndexMap["narrative_direction"] !== undefined) row[headerIndexMap["narrative_direction"]] = item.narrative_direction || null;
        if (headerIndexMap["market_confirmation"] !== undefined) row[headerIndexMap["market_confirmation"]] = item.market_confirmation || null;
        if (headerIndexMap["cross_asset_resonance"] !== undefined) row[headerIndexMap["cross_asset_resonance"]] = item.cross_asset_resonance || null;
        if (headerIndexMap["verification_details_json"] !== undefined) {
          const verificationDetails = item.verification_details_json || {};
          row[headerIndexMap["verification_details_json"]] = typeof verificationDetails === 'string' ? verificationDetails : JSON.stringify(verificationDetails);
        }
        if (headerIndexMap["created_at"] !== undefined) row[headerIndexMap["created_at"]] = item.created_at || new Date();
        
        rows.push(row);
      } else {
        // 未知格式，跳過
        Logger.log(`P5 Daily：跳過未知格式的新聞數據：${key}`);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆新聞原子化數據到 NEWS_ATOMS_DAILY 表格`);
    } else {
      Logger.log("P5 Daily：沒有有效的新聞數據需要保存");
    }
  } catch (error) {
    Logger.log(`保存新聞原子化數據到表格失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
  }
}

/**
 * 從 URL 提取來源名稱
 * 
 * @param {string} url - URL
 * @returns {string} source - 來源名稱
 */
function extractSourceFromUrl(url) {
  if (!url) return "未知來源";
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 提取主要網域名稱
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2] + '.' + parts[parts.length - 1];
    }
    return hostname;
  } catch (e) {
    return "未知來源";
  }
}

/**
 * 根據新聞內容分類（簡化版本）
 * 
 * @param {string} content - 新聞標題或摘要
 * @returns {string} category - 分類
 */
function categorizeNewsByContent(content) {
  if (!content) return "其他";
  
  const contentLower = content.toLowerCase();
  
  // 十大分類關鍵字
  if (contentLower.indexOf("earnings") > -1 || contentLower.indexOf("財報") > -1 || contentLower.indexOf("決算") > -1) {
    return "財報";
  }
  if (contentLower.indexOf("ipo") > -1 || contentLower.indexOf("merger") > -1 || contentLower.indexOf("acquisition") > -1 || contentLower.indexOf("併購") > -1 || contentLower.indexOf("買収") > -1) {
    return "IPO/M&A";
  }
  if (contentLower.indexOf("regulation") > -1 || contentLower.indexOf("sec") > -1 || contentLower.indexOf("監管") > -1 || contentLower.indexOf("規制") > -1) {
    return "監管";
  }
  if (contentLower.indexOf("gdp") > -1 || contentLower.indexOf("inflation") > -1 || contentLower.indexOf("interest rate") > -1 || contentLower.indexOf("利率") > -1 || contentLower.indexOf("金利") > -1) {
    return "宏觀經濟";
  }
  if (contentLower.indexOf("sector") > -1 || contentLower.indexOf("industry") > -1 || contentLower.indexOf("板塊") > -1 || contentLower.indexOf("セクター") > -1) {
    return "板塊輪動";
  }
  if (contentLower.indexOf("oil") > -1 || contentLower.indexOf("gold") > -1 || contentLower.indexOf("commodity") > -1 || contentLower.indexOf("商品") > -1 || contentLower.indexOf("原油") > -1) {
    return "商品";
  }
  if (contentLower.indexOf("dollar") > -1 || contentLower.indexOf("currency") > -1 || contentLower.indexOf("匯率") > -1 || contentLower.indexOf("為替") > -1) {
    return "匯率";
  }
  if (contentLower.indexOf("bitcoin") > -1 || contentLower.indexOf("crypto") > -1 || contentLower.indexOf("加密貨幣") > -1 || contentLower.indexOf("暗号通貨") > -1) {
    return "加密貨幣";
  }
  if (contentLower.indexOf("ceo") > -1 || contentLower.indexOf("management") > -1 || contentLower.indexOf("執行長") > -1 || contentLower.indexOf("経営陣") > -1) {
    return "公司新聞";
  }
  
  return "其他";
}
