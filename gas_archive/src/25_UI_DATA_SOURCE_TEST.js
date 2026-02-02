/**
 * 🧪 UI 數據源測試模組（V8.12 新增）
 * 
 * 提供三個獨立的數據源測試功能：
 * 1. Daily 市場數據測試
 * 2. 一般當日新聞測試
 * 3. 機構評級新聞測試
 * 
 * @version V8.12
 * @date 2026-01-19
 */

/**
 * 菜單：測試 Daily 市場數據
 * 測試重點：是否有拿到全部正確數據
 */
function menuTestDailyMarketData() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '📊 Daily 市場數據測試 (V8.12)',
    '這將測試 P5 Daily 市場數據收集功能。\n\n測試內容：\n' +
    '- 宏觀數據（油價、貴金屬、匯率、國債利率、VIX等）\n' +
    '- 所有 Tier 1 + Tier 2 數據（V8.12 新增）\n\n' +
    '是否繼續？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      Logger.log('🧪 開始 Daily 市場數據測試...');
      
      // 測試宏觀數據收集
      const macroData = collectMacroData();
      
      // 檢查收集結果
      const results = {
        commodities: Object.keys(macroData.commodities || {}).length,
        currencies: Object.keys(macroData.currencies || {}).length,
        bonds: Object.keys(macroData.bonds || {}).length,
        indices: Object.keys(macroData.indices || {}).length
      };
      
      // 檢查是否有收集到V8.12新增的數據
      const newTier1Data = [];
      const newTier2Data = [];
      
      if (macroData.indices) {
        for (const symbol in macroData.indices) {
          const index = macroData.indices[symbol];
          if (index.tier === 'Tier1' && (symbol === 'TLT.VOL' || symbol === 'LQD' || symbol === 'RSP')) {
            newTier1Data.push(symbol);
          } else if (index.tier === 'Tier2') {
            newTier2Data.push(symbol);
          }
        }
      }
      
      const message = 
        `✅ Daily 市場數據測試完成\n\n` +
        `📊 收集結果：\n` +
        `- 商品價格：${results.commodities} 項\n` +
        `- 匯率：${results.currencies} 項\n` +
        `- 國債利率：${results.bonds} 項\n` +
        `- 市場指數：${results.indices} 項\n\n` +
        `⭐ V8.12 新增數據：\n` +
        `- Tier 1 新增：${newTier1Data.length > 0 ? newTier1Data.join(', ') : '無'}\n` +
        `- Tier 2 新增：${newTier2Data.length} 項\n\n` +
        `詳細日誌請查看 Logger。`;
      
      ui.alert('測試完成', message, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log(`❌ Daily 市場數據測試失敗：${error.message}`);
      ui.alert('測試失敗', `錯誤：${error.message}\n\n請查看 Logger 了解詳細資訊。`, ui.ButtonSet.OK);
    }
  }
}

/**
 * 菜單：測試一般當日新聞
 * 測試重點：有蒐集到正確的當日(加減6小時)的財經新聞，並且有成功的flash清洗與gemini多語去重分類，以及有做到新增的驗證程序與個股索引
 * 測試模式：時效性放寬到前一天
 */
function menuTestDailyNews() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '📰 一般當日新聞測試 (V8.12)',
    '這將測試 P5 Daily 一般新聞收集功能。\n\n測試重點：\n' +
    '- 收集數量：英文50則、中文25則、日文25則\n' +
    '- 時效性：測試模式放寬到前一天\n' +
    '- Flash清洗：雜訊過濾、時效性檢查\n' +
    '- Gemini Pro：多語去重、多維度標籤分類\n' +
    '- 驗證機制：數據驗證、Proxy驗證\n' +
    '- 個股索引：建立反向索引\n\n' +
    '是否繼續？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      Logger.log('🧪 開始一般當日新聞測試（測試模式：時效性放寬到前一天）...');
      
      // ⭐ 測試模式設定（V8.12）
      // 1. 時效性放寬到前一天（isTestMode: true）
      // 2. 收集數量：英文50則、中文25則、日文25則（已在collectRawNews中設定）
      const testTickers = [];  // 空列表，因為V8.12不再針對特定ticker收集
      const testMacroData = { 
        isTestMode: true  // ⭐ 測試模式：時效性放寬到前一天
      };
      
      Logger.log('🧪 測試模式設定：isTestMode=true（時效性放寬到前一天）');
      Logger.log('🧪 收集數量：英文50則、中文25則、日文25則');
      
      // 收集新聞（測試模式）
      const newsAtoms = collectNewsAtoms(testTickers, testMacroData);
      
      // ⭐ V8.13 新增：保存新聞到表格
      if (newsAtoms && Object.keys(newsAtoms).length > 0) {
        try {
          const today = new Date();
          saveNewsAtomsToSheet(newsAtoms, today);
          Logger.log(`🧪 測試：已保存 ${Object.keys(newsAtoms).length} 筆新聞到 NEWS_ATOMS_DAILY 表格`);
        } catch (saveError) {
          Logger.log(`🧪 測試：保存新聞到表格失敗：${saveError.message}`);
        }
      }
      
      // 統計結果
      const newsCount = Object.keys(newsAtoms).length;
      const newsList = Object.values(newsAtoms);
      
      // 統計多維度標籤
      let withEventType = 0;
      let withRelatedTickers = 0;
      let withVerification = 0;
      
      for (const news of newsList) {
        if (news.event_type_json) {
          try {
            const eventType = typeof news.event_type_json === 'string' ? JSON.parse(news.event_type_json) : news.event_type_json;
            if (eventType && eventType.primary) withEventType++;
          } catch (e) {}
        }
        if (news.related_tickers_json) {
          try {
            const tickers = typeof news.related_tickers_json === 'string' ? JSON.parse(news.related_tickers_json) : news.related_tickers_json;
            if (tickers && tickers.length > 0) withRelatedTickers++;
          } catch (e) {}
        }
        if (news.data_verification && news.data_verification !== 'NOT_VERIFIED') {
          withVerification++;
        }
      }
      
      // 檢查個股索引是否建立
      const today = new Date();
      const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const tickerIndex = buildTickerNewsIndex(newsAtoms, dateStr);
      const tickerCount = Object.keys(tickerIndex).length;
      
      const message = 
        `✅ 一般當日新聞測試完成\n\n` +
        `📰 收集結果：\n` +
        `- 收集到新聞：${newsCount} 筆\n` +
        `- 含多維度標籤：${withEventType} 筆\n` +
        `- 含關聯股票代碼：${withRelatedTickers} 筆\n` +
        `- 已驗證數據：${withVerification} 筆\n\n` +
        `📊 個股索引：\n` +
        `- 建立索引的ticker數：${tickerCount}\n\n` +
        `💾 數據已保存到 NEWS_ATOMS_DAILY 表格\n\n` +
        `詳細日誌請查看 Logger。`;
      
      ui.alert('測試完成', message, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log(`❌ 一般當日新聞測試失敗：${error.message}`);
      ui.alert('測試失敗', `錯誤：${error.message}\n\n請查看 Logger 了解詳細資訊。`, ui.ButtonSet.OK);
    }
  }
}

/**
 * 菜單：測試機構評級新聞
 * 測試重點：有蒐集到正確的當日(加減6小時)的評級新聞，並且有成功的flash清洗與gemini多語去重分類，以及有做到加上個股索引
 * 測試模式：先不管時效性，先抓10檔隨機的來測試就好
 */
function menuTestInstitutionalRatings() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '⭐ 機構評級新聞測試 (V8.12)',
    '這將測試 P5 Daily 機構評級新聞收集功能。\n\n測試重點：\n' +
    '- 測試模式：不管時效性，抓10檔隨機股票\n' +
    '- Flash清洗：雜訊過濾\n' +
    '- Gemini Pro：多語去重\n' +
    '- 個股索引：建立反向索引\n\n' +
    '⚠️ 注意：正式版只抓持股與觀察清單\n\n' +
    '是否繼續？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      Logger.log('🧪 開始機構評級新聞測試（測試模式：10檔隨機股票，不限制時效性）...');
      
      // ⭐ 測試模式設定（V8.12）
      // 1. 不管時效性（isTestMode: true）
      // 2. 抓10檔隨機股票（美股、台股、日股各一些）
      const testTickers = [
        'NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD',  // 美股
        '2330', '2317', '2454',                  // 台股
        '8035', '9984'                           // 日股
      ];
      
      Logger.log('🧪 測試模式設定：isTestMode=true（不限制時效性）');
      Logger.log(`🧪 測試股票：${testTickers.join(', ')}（共${testTickers.length}檔）`);
      
      // 收集機構評級（測試模式：不限制時效性）
      const ratingsData = collectInstitutionalRatingsTestMode(testTickers);
      
      // 統計結果
      const ratingsCount = ratingsData.count || 0;
      const tickerIndex = ratingsData.tickerIndex || {};
      const tickerCount = Object.keys(tickerIndex).length;
      const tickerIndexDetails = Object.keys(tickerIndex).map(ticker => 
        `${ticker}(${tickerIndex[ticker]}筆)`
      ).join(', ');
      
      const message = 
        `✅ 機構評級新聞測試完成\n\n` +
        `⭐ 收集結果：\n` +
        `- 收集到評級：${ratingsCount} 筆\n` +
        `- 測試股票數：${testTickers.length} 檔\n\n` +
        `📊 個股索引：\n` +
        `- 建立索引的ticker數：${tickerCount}\n` +
        `${tickerCount > 0 ? `- 索引詳情：${tickerIndexDetails}\n` : ''}\n` +
        `詳細日誌請查看 Logger。`;
      
      ui.alert('測試完成', message, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log(`❌ 機構評級新聞測試失敗：${error.message}`);
      ui.alert('測試失敗', `錯誤：${error.message}\n\n請查看 Logger 了解詳細資訊。`, ui.ButtonSet.OK);
    }
  }
}

/**
 * 機構評級收集（測試模式）
 * 測試模式：不限制時效性，抓指定ticker列表的評級
 * 
 * @param {Array} testTickers - 測試用的股票代碼列表（簡單格式：["NVDA", "AAPL"]）
 * @returns {Object} ratingsData - 機構評級數據（包含個股索引）
 */
function collectInstitutionalRatingsTestMode(testTickers) {
  Logger.log(`P5 Daily：機構評級收集（測試模式）- 測試 ${testTickers.length} 檔股票`);
  
  try {
    // 轉換格式為 holdings 格式：[{ticker: "NVDA", market: "US"}, ...]
    const holdings = testTickers.map(ticker => {
      // 根據ticker格式判斷市場
      let market = "US";  // 默認美股
      if (/^23\d{2}$/.test(ticker) || /^24\d{2}$/.test(ticker)) {
        // 23xx, 24xx 開頭是台股
        market = "TW";
      } else if (/^\d{4}$/.test(ticker) && !ticker.startsWith('23') && !ticker.startsWith('24')) {
        // 其他4位數字可能是日股
        market = "JP";
      }
      return { ticker: ticker, market: market };
    });
    
    Logger.log(`P5 Daily：測試模式 - 轉換後的holdings：${JSON.stringify(holdings)}`);
    
    // 調用機構評級收集函數（測試模式）
    const result = collectInstitutionalRatings({
      testTickers: holdings,
      isTestMode: true  // 測試模式：不限制時效性
    });
    
      // 從收集結果中獲取個股索引資訊
      const tickerIndex = result.tickerIndex || {};
      
      return {
        ratings: result,
        tickerIndex: tickerIndex,
        success: result.success,
        count: result.count || 0
      };
    
  } catch (error) {
    Logger.log(`P5 Daily：機構評級收集（測試模式）失敗：${error.message}`);
    return {
      ratings: {},
      tickerIndex: {},
      success: false,
      error: error.message
    };
  }
}
