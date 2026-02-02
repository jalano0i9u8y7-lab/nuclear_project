/**
 * 🎨 Nuclear Project UI：Human Signal 輸入模組
 * 
 * 處理用戶輸入的分析文章、新聞等資訊，整合到 P5 Daily
 * 
 * ⭐ V8.17 地雷修復：Human Lock 機制
 * - Human = Governor，不是 Analyst
 * - 優先級：Human LOCK > Risk Kill Switch > AI Strategy > Programmatic Adjustment
 * - 防止 AI 覆蓋人類手動決策
 * 
 * @version SSOT V7.1 + V8.17 地雷修復
 * @date 2025-01-12
 */

// ==========================================
// Human Signal 輸入
// ==========================================

/**
 * ⭐ V8.17 地雷修復：提交 Human Signal（支援 Human Lock）
 * 
 * @param {Object} signalData - 信號數據
 * @param {string} signalData.type - 類型（ARTICLE / NEWS / ANALYSIS / TRADE_ACTION / OTHER）
 * @param {string} signalData.content - 內容
 * @param {string} signalData.url - URL（可選）
 * @param {Array} signalData.tags - 標籤列表（可選）
 * @param {Array} signalData.tickers - 相關股票代碼列表（可選）
 * @param {string} signalData.importance - 重要性（LOW / MEDIUM / HIGH / CRITICAL）
 * @param {Object} signalData.human_lock - ⭐ V8.17 新增：Human Lock 配置
 *   - {boolean} locked - 是否鎖定（true = AI 不得覆蓋）
 *   - {string} action - 鎖定動作（BUY / SELL / HOLD / ADJUST）
 *   - {string} reason - 鎖定原因
 *   - {Date} expiry - 過期時間（可選，null = 永久）
 * @returns {Object} result - 操作結果
 */
function UI_SubmitHumanSignal(signalData) {
  try {
    Logger.log("UI：提交 Human Signal");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("HUMAN_SIGNAL");
    
    if (!sheet) {
      sheet = ss.insertSheet("HUMAN_SIGNAL");
      sheet.appendRow(HUMAN_SIGNAL_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const signalId = `HUMAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const today = new Date();
    
    // ⭐ V8.17 地雷修復：Human Lock 配置
    const humanLock = signalData.human_lock || {};
    const humanLockJson = {
      locked: humanLock.locked || false,
      action: humanLock.action || null,
      reason: humanLock.reason || "",
      timestamp: today.toISOString(),
      expiry: humanLock.expiry ? humanLock.expiry.toISOString() : null
    };
    
    // 保存到 HUMAN_SIGNAL 表格
    sheet.appendRow([
      signalId,
      Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      signalData.type || "OTHER",
      JSON.stringify(signalData.tags || []),
      signalData.content || "",
      signalData.url || "",
      JSON.stringify(signalData.tickers || []),
      signalData.importance || "MEDIUM",
      false,  // processed
      null,   // processed_at
      null,   // processed_by
      today,
      "USER",  // created_by
      JSON.stringify(humanLockJson)  // ⭐ V8.17 新增：human_lock_json
    ]);
    
    Logger.log(`✓ Human Signal 已提交：${signalId}`);
    
    // 觸發 P5 Daily 處理（可選，可以立即處理或等待下次 Daily 執行）
    // 這裡可以選擇立即處理或標記為待處理
    if (signalData.process_immediately) {
      processHumanSignal(signalId);
    }
    
    return {
      success: true,
      signal_id: signalId,
      message: "Human Signal 已提交"
    };
  } catch (error) {
    Logger.log(`提交 Human Signal 失敗：${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * 處理 Human Signal（整合到 P5 Daily）
 * 
 * @param {string} signalId - 信號 ID
 * @returns {Object} result - 處理結果
 */
function processHumanSignal(signalId) {
  try {
    Logger.log(`處理 Human Signal：${signalId}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("HUMAN_SIGNAL");
    
    if (!sheet) {
      return { success: false, message: "HUMAN_SIGNAL 表格不存在" };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const signalIdCol = headers.indexOf("signal_id");
    const contentCol = headers.indexOf("content");
    const tagsCol = headers.indexOf("tags_json");
    const tickersCol = headers.indexOf("tickers_json");
    const importanceCol = headers.indexOf("importance");
    const processedCol = headers.indexOf("processed");
    
    // 查找信號
    let signalRow = null;
    let signalRowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][signalIdCol] === signalId) {
        signalRow = rows[i];
        signalRowIndex = i + 1;
        break;
      }
    }
    
    if (!signalRow) {
      return { success: false, message: "信號不存在" };
    }
    
    // 檢查是否已處理
    if (signalRow[processedCol] === true) {
      return { success: false, message: "信號已處理" };
    }
    
    // 提取信號數據
    const signal = {
      content: signalRow[contentCol],
      tags: signalRow[tagsCol] ? JSON.parse(signalRow[tagsCol]) : [],
      tickers: signalRow[tickersCol] ? JSON.parse(signalRow[tickersCol]) : [],
      importance: signalRow[importanceCol] || "MEDIUM"
    };
    
    // 整合到 P5 Daily 新聞處理流程
    // 這裡可以調用 P5 Daily 的新聞處理函數
    // 簡化實現：直接保存到 NEWS_ATOMS_DAILY（作為人工輸入的新聞）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let newsSheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
      
      if (newsSheet) {
        const today = new Date();
        const atomId = `HUMAN_${signalId}`;
        
        newsSheet.appendRow([
          Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
          atomId,
          signal.tags[0] || "OTHER",  // category
          signal.tickers.length > 0 ? signal.tickers[0] : "",  // ticker
          signal.content.substring(0, 200),  // title（截取前 200 字）
          signal.content,  // summary
          "HUMAN_SIGNAL",  // source
          signal.importance,  // importance
          "",  // url
          JSON.stringify({}),  // macro_context_json
          today
        ]);
        
        Logger.log(`✓ Human Signal 已整合到 P5 Daily：${atomId}`);
      }
    } catch (error) {
      Logger.log(`整合到 P5 Daily 失敗：${error.message}`);
    }
    
    // 標記為已處理
    sheet.getRange(signalRowIndex, processedCol + 1).setValue(true);
    sheet.getRange(signalRowIndex, headers.indexOf("processed_at") + 1).setValue(new Date());
    sheet.getRange(signalRowIndex, headers.indexOf("processed_by") + 1).setValue("P5_DAILY");
    
    return { success: true, message: "Human Signal 已處理" };
  } catch (error) {
    Logger.log(`處理 Human Signal 失敗：${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * 從 URL 抓取內容（輔助函數）
 * 
 * @param {string} url - URL
 * @returns {string} content - 內容
 */
function fetchContentFromURL(url) {
  try {
    // 使用 UrlFetchApp 抓取內容
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.getResponseCode() === 200) {
      const html = response.getContentText();
      // 簡單的 HTML 清理（實際應該使用更複雜的解析）
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
      
      return text.substring(0, 10000);  // 限制長度
    } else {
      throw new Error(`HTTP ${response.getResponseCode()}`);
    }
  } catch (error) {
    Logger.log(`從 URL 抓取內容失敗：${error.message}`);
    return null;
  }
}
