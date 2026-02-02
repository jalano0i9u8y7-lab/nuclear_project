/**
 * 📊 P5 Weekly: 市場情緒指標收集
 * 
 * 收集市場情緒指標：
 * - FPE_B（分析師共識 Forward P/E）
 * 
 * ⚠️ 注意：
 * - AAII Sentiment 不使用（選擇權數據更準確）
 * - CNN Greed Fear Index 不使用（已確認不採用）
 * 
 * @version SSOT V8.0
 * @date 2026-01-16
 */

// ==========================================
// FPE_B 收集函數（從 P2 移過來）
// ==========================================

/**
 * 根據市場構建 Yahoo Finance ticker
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @return {string} Yahoo Finance ticker
 */
function convertTickerToYahooFormat(ticker, market) {
  let yahooTicker = ticker;
  if (market === "TW" || market === "Taiwan") {
    yahooTicker = `${ticker}.TW`;
  } else if (market === "JP" || market === "Japan") {
    yahooTicker = `${ticker}.T`;
  }
  // market === "US" 或 "United States" 時不需要修改
  return yahooTicker;
}

/**
 * 由 Yahoo ticker 推斷市場（US/TW/JP）
 * @param {string} yahooTicker
 * @return {string} market
 */
function inferMarketFromYahooTicker(yahooTicker) {
  if (yahooTicker && yahooTicker.includes(".TW")) return "TW";
  if (yahooTicker && yahooTicker.includes(".T")) return "JP";
  return "US";
}

/**
 * 轉換 Yahoo ticker -> GOOGLEFINANCE ticker（用於抓股價）
 * - US: 直接使用 ticker（例：AAPL）
 * - TW: 2330.TW -> TPE:2330
 * - JP: 7203.T -> TYO:7203
 *
 * @param {string} yahooTicker
 * @param {string} market
 * @return {string|null} googleTicker
 */
function convertYahooTickerToGoogleTicker(yahooTicker, market) {
  if (!yahooTicker) return null;
  const m = market || inferMarketFromYahooTicker(yahooTicker);

  if (m === "TW") {
    const base = yahooTicker.replace(".TW", "").trim();
    if (!base) return null;
    return `TPE:${base}`;
  }

  if (m === "JP") {
    const base = yahooTicker.replace(".T", "").trim();
    if (!base) return null;
    return `TYO:${base}`;
  }

  // US
  return yahooTicker.trim();
}

/**
 * Yahoo QuoteSummary JSON 讀取器（比爬 HTML 穩，且自帶歷史）
 * @param {string} yahooTicker
 * @param {Array<string>} modules
 * @return {Object|null} quoteSummary.result[0]
 */
function fetchYahooQuoteSummarySafe(yahooTicker, modules) {
  const maxRetries = 3;
  let retryCount = 0;

  const safeModules = Array.isArray(modules) && modules.length > 0
    ? modules
    : ["price", "defaultKeyStatistics", "financialData", "earningsTrend", "upgradeDowngradeHistory"];

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=${encodeURIComponent(safeModules.join(","))}`;

  while (retryCount < maxRetries) {
    try {
      Logger.log(`P5 Weekly：Yahoo QuoteSummary 讀取：${yahooTicker} modules=${safeModules.join(",")}${retryCount > 0 ? `（重試第 ${retryCount} 次）` : ""}`);

      const resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          "Accept": "application/json,text/plain,*/*"
        }
      });

      const status = resp.getResponseCode();
      const text = resp.getContentText();

      if (status === 200) {
        const parsed = JSON.parse(text);
        const result = parsed && parsed.quoteSummary && parsed.quoteSummary.result && parsed.quoteSummary.result[0];
        if (!result) {
          Logger.log(`P5 Weekly：⚠️ QuoteSummary 無 result[0]（${yahooTicker}）`);
          return null;
        }
        return result;
      }

      if (status === 429 || status === 503) {
        retryCount++;
        const delay = Math.min(2000 * retryCount, 10000);
        Logger.log(`P5 Weekly：⚠️ QuoteSummary HTTP ${status}，等待 ${delay}ms 後重試（${yahooTicker}）`);
        Utilities.sleep(delay);
        continue;
      }

      Logger.log(`P5 Weekly：❌ QuoteSummary HTTP ${status}（${yahooTicker}），body前200=${text ? text.substring(0, 200) : ""}`);
      return null;
    } catch (e) {
      retryCount++;
      const delay = Math.min(2000 * retryCount, 10000);
      Logger.log(`P5 Weekly：⚠️ QuoteSummary 例外（${yahooTicker}）：${e.message}，等待 ${delay}ms 後重試`);
      Utilities.sleep(delay);
    }
  }

  return null;
}

/**
 * 從 QuoteSummary 抽取「共識 Forward EPS」（Next Year / +1y）
 * @param {Object} quoteSummaryResult0
 * @return {Object|null} { value, period, source }
 */
function extractConsensusForwardEPSFromQuoteSummary(quoteSummaryResult0) {
  try {
    const et = quoteSummaryResult0 && quoteSummaryResult0.earningsTrend;
    const trend = et && et.trend ? et.trend : [];
    if (!Array.isArray(trend) || trend.length === 0) return null;

    const preferredPeriods = ["+1y", "1y", "nextYear", "Next Year", "+1Y"];

    const pickFromItem = (item) => {
      if (!item) return null;

      // 常見：earningsEstimate.avg.raw
      const ee = item.earningsEstimate || item.earningsEstimateTrend || item.earningsEstimateData || null;
      const avg1 = ee && ee.avg && (ee.avg.raw !== undefined ? ee.avg.raw : ee.avg);
      if (typeof avg1 === "number" && avg1 > 0) {
        return { value: avg1, period: item.period || null, source: "earningsTrend.trend[].earningsEstimate.avg" };
      }

      // 備用：epsTrend.current.raw
      const epsTrend = item.epsTrend || null;
      const current = epsTrend && epsTrend.current && (epsTrend.current.raw !== undefined ? epsTrend.current.raw : epsTrend.current);
      if (typeof current === "number" && current > 0) {
        return { value: current, period: item.period || null, source: "earningsTrend.trend[].epsTrend.current" };
      }

      return null;
    };

    // 先找 Next Year/+1y
    for (const p of preferredPeriods) {
      const found = trend.find(t => (t && t.period && String(t.period).toLowerCase() === String(p).toLowerCase()));
      const out = pickFromItem(found);
      if (out) return out;
    }

    // 找不到就退而求其次：掃描整個 trend 找第一個合理值
    for (const item of trend) {
      const out = pickFromItem(item);
      if (out) return out;
    }

    return null;
  } catch (e) {
    Logger.log(`P5 Weekly：extractConsensusForwardEPSFromQuoteSummary 失敗：${e.message}`);
    return null;
  }
}

/**
 * 從 QuoteSummary 抽取分析師共識 Forward P/E（若 Yahoo 有提供）
 * @param {Object} quoteSummaryResult0
 * @return {Object|null} { value, source }
 */
function extractConsensusForwardPEFromQuoteSummary(quoteSummaryResult0) {
  const tryGet = (obj, pathDesc) => {
    if (obj && obj.raw !== undefined) return { value: obj.raw, source: pathDesc };
    if (typeof obj === "number") return { value: obj, source: pathDesc };
    return null;
  };

  const a = quoteSummaryResult0 && quoteSummaryResult0.defaultKeyStatistics && quoteSummaryResult0.defaultKeyStatistics.forwardPE;
  const outA = tryGet(a, "defaultKeyStatistics.forwardPE");
  if (outA && typeof outA.value === "number" && outA.value > 0) return outA;

  const b = quoteSummaryResult0 && quoteSummaryResult0.financialData && quoteSummaryResult0.financialData.forwardPE;
  const outB = tryGet(b, "financialData.forwardPE");
  if (outB && typeof outB.value === "number" && outB.value > 0) return outB;

  return null;
}

/**
 * 從 QuoteSummary 抽取當前股價（regularMarketPrice）
 * @param {Object} quoteSummaryResult0
 * @return {number|null}
 */
function extractCurrentPriceFromQuoteSummary(quoteSummaryResult0) {
  const p = quoteSummaryResult0 && quoteSummaryResult0.price && quoteSummaryResult0.price.regularMarketPrice;
  const v = p && (p.raw !== undefined ? p.raw : p);
  return (typeof v === "number" && v > 0) ? v : null;
}

/**
 * V8.9 升級：從資料庫讀取機構評級資料（優先）
 * 
 * @param {string} ticker - 原始 ticker（如 AAPL, 2330, 7203）
 * @param {string} market - 市場（US/TW/JP）
 * @param {number} months - 查詢月數（預設 1 個月）
 * @return {Array} 機構評級陣列
 */
function getInstitutionalRatingsFromDatabase(ticker, market, months) {
  months = months || 1;
  var ratings = [];
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P5 Weekly：INSTITUTIONAL_RATINGS_DAILY 表格不存在或無數據（${ticker}）`);
      return [];
    }
    
    // 讀取所有數據
    var lastRow = sheet.getLastRow();
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 19); // 所有欄位
    var data = dataRange.getValues();
    
    // 計算日期範圍
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    
    // 篩選符合條件的評級
    for (var i = 0; i < data.length; i++) {
      var rowTicker = data[i][1]; // ticker
      var rowMarket = data[i][2]; // market
      var rowDate = data[i][0]; // date
      var rowSuperseded = data[i][18]; // superseded_by
      
      // 跳過被取代的評級
      if (rowSuperseded && rowSuperseded !== "") {
        continue;
      }
      
      // 比對 ticker 和 market
      var tickerMatch = false;
      if (rowTicker === ticker || (rowTicker && ticker && rowTicker.toString() === ticker.toString())) {
        tickerMatch = true;
      }
      
      var marketMatch = (rowMarket === market || rowMarket === (market === "US" ? "United States" : market));
      
      if (tickerMatch && marketMatch) {
        var d = rowDate instanceof Date ? rowDate : new Date(rowDate);
        if (!isNaN(d.getTime()) && d >= startDate) {
          ratings.push({
            date: d.toISOString().split('T')[0],
            firm: data[i][3], // rating_firm
            action: data[i][4], // rating_action
            from_grade: data[i][5] || null,
            to_grade: data[i][6] || null,
            from_price: data[i][7] || null,
            to_price: data[i][8] || null,
            target_change: data[i][9] || null,
            news_title: data[i][10] || "",
            news_summary: data[i][11] || "",
            news_url: data[i][12] || "",
            news_source: data[i][13] || "",
            rating_date: d.toISOString().split('T')[0],
            rating_time: data[i][15] || null,
            implied_fpe: data[i][16] || null
          });
        }
      }
    }
    
    // 按日期排序（最新的在前）
    ratings.sort(function(a, b) {
      var dateA = new Date(a.date).getTime();
      var dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    
    Logger.log(`P5 Weekly：從資料庫讀取 ${ratings.length} 筆機構評級（${ticker}，${market}）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：從資料庫讀取機構評級失敗（${ticker}，${market}）：${error.message}`);
  }
  
  return ratings;
}

/**
 * V8.6 歷史評級挖掘機 (Historical Sentiment Miner)
 * ⭐ V8.9 升級：優先從資料庫讀取，如果資料庫沒有或不足，再使用直接抓取
 * 功能：挖掘過去 6-12 個月的機構評級動作，計算「機構風向動能」
 * - 優先從 INSTITUTIONAL_RATINGS_DAILY 讀取（V8.9 新增）
 * - 美股優先用 Finviz（格式最整齊，且包含目標價變化）
 * - 台/日股用 Yahoo HTML JSON 手術刀（從 root.App.main 挖出 upgradeDowngradeHistory）
 *
 * @param {string} ticker - 原始 ticker（如 AAPL, 2330, 7203）
 * @param {string} market - 市場（US/TW/JP）
 * @return {Object|null}
 */
function getHistoricalRatings(ticker, market) {
  var history = [];
  var source = "";

  // ⭐ V8.9 新增：優先從資料庫讀取（只查詢最近 1 個月，符合去重邏輯）
  history = getInstitutionalRatingsFromDatabase(ticker, market, 1);
  if (history.length > 0) {
    source = "DATABASE";
  }

  // 如果資料庫沒有或不足，使用直接抓取（保持向後兼容）
  if (history.length === 0) {
    // 1. 美股優先用 Finviz (格式最整齊，且包含目標價變化)
    if (market === "US" || market === "United States") {
      history = fetchFinvizHistory(ticker);
      source = "FINVIZ";
    }

    // 2. 如果 Finviz 沒抓到 (或非美股)，啟動 Yahoo JSON 手術刀
    if (history.length === 0) {
      var yahooTicker = convertTickerToYahooFormat(ticker, market);
      history = fetchYahooHistoryFromJSON(yahooTicker);
      source = "YAHOO_HTML_JSON";
    }
    
    // 3. V8.9 新增：如果直接抓取失敗（被封鎖），啟動 CSE 新聞碎片重構法
    if (history.length === 0) {
      Logger.log(`P5 Weekly：直接抓取失敗（${ticker}，${market}），啟動 CSE 新聞碎片重構法`);
      history = fetchInstitutionalRatingsFromCSE(ticker, market);
      source = "CSE_NEWS_RECONSTRUCTION";
    }
  }

  // 3. V8.6 升級：使用「機構言行一致性分析」（結合價格反應驗證）
  var sentiment = analyzeSmartSentiment(history, ticker, market);
  
  return {
    ticker: ticker,
    market: market,
    source: source,
    total_records: history.length,
    latest_action: history.length > 0 ? history[0] : null,
    sentiment_score: sentiment.score, // 正分代表看多，負分代表看空（已結合價格反應）
    sentiment_label: sentiment.label, // STRONG_BULL / BULLISH / NEUTRAL / BEARISH / STRONG_BEAR
    warnings: sentiment.warnings, // 誘多/誘空警告訊號
    history: history // 完整歷史陣列 (可存入 Log 或 Sheet)
  };
}

/**
 * 挖掘機 A: Finviz Parser (針對美股)
 * V8.9 更新：當直接抓取失敗（HTTP 503 被封鎖）時，改用 CSE 新聞碎片重構法
 * 抓取格式如: "Jan-15-26", "Upgrade", "Goldman", "Buy -> Strong Buy", "$150 -> $180"
 *
 * @param {string} ticker - 美股代碼（如 AAPL, NVDA）
 * @return {Array} history 陣列
 */
function fetchFinvizHistory(ticker) {
  var history = [];
  try {
    var url = "https://finviz.com/quote.ashx?t=" + encodeURIComponent(ticker);
    Logger.log(`P5 Weekly：Finviz 歷史評級抓取：${ticker}，URL=${url}`);
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    var status = response.getResponseCode();
    if (status !== 200) {
      if (status === 503 || status === 429) {
        Logger.log(`P5 Weekly：⚠️ Finviz HTTP ${status}（${ticker}）→ 被封鎖，改用 CSE 新聞碎片重構法`);
        // V8.9 備用方案：CSE 新聞碎片重構法
        return fetchInstitutionalRatingsFromCSE(ticker, "US");
      }
      Logger.log(`P5 Weekly：⚠️ Finviz HTTP ${status}（${ticker}）`);
      return [];
    }
    
    var html = response.getContentText();
    
    // Finviz 的評級表在 class="fullview-ratings-outer" 裡面
    var tableStart = html.indexOf('class="fullview-ratings-outer"');
    if (tableStart === -1) {
      Logger.log(`P5 Weekly：⚠️ Finviz 找不到評級表格（${ticker}）`);
      return [];
    }
    
    var tableEnd = html.indexOf('</table>', tableStart);
    if (tableEnd === -1) {
      Logger.log(`P5 Weekly：⚠️ Finviz 表格結構異常（${ticker}）`);
      return [];
    }
    
    var tableHtml = html.substring(tableStart, tableEnd);

    // 使用 Regex 匹配每一行 (Finviz 格式很固定)
    // 範例: <td...>Jan-17-26</td><td...><b>Upgrade</b></td><td...>Goldman</td>...
    var rowRegex = /<td[^>]*>(\w{3}-\d{2}-\d{2})<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/g;
    
    var match;
    while ((match = rowRegex.exec(tableHtml)) !== null) {
      try {
        // 解析數據
        var dateStr = match[1]; // Jan-17-26
        var action = match[2].replace(/<[^>]+>/g, "").trim(); // Upgrade (去掉 bold 標籤)
        var firm = match[3].replace(/<[^>]+>/g, "").trim();   // Goldman
        var rating = match[4].replace(/<[^>]+>/g, "").trim(); // Neutral -> Buy
        var target = match[5].replace(/<[^>]+>/g, "").trim(); // $120 -> $150
        
        history.push({
          date: parseFinvizDate(dateStr),
          firm: firm,
          action: action,
          rating: rating,
          target_change: target
        });
      } catch (e) {
        Logger.log(`P5 Weekly：⚠️ Finviz 解析單筆資料失敗（${ticker}）：${e.message}`);
      }
    }
    
    Logger.log(`P5 Weekly：✅ Finviz 成功抓取 ${history.length} 筆歷史評級（${ticker}）`);
  } catch (e) {
    Logger.log(`P5 Weekly：❌ Finviz History Error（${ticker}）：${e.message}`);
  }
  return history;
}

/**
 * 挖掘機 B: Yahoo JSON 手術刀 (針對全球股市)
 * V8.9 更新：當直接抓取失敗（HTTP 503 被封鎖）時，改用 CSE 新聞碎片重構法
 * 直接挖出 root.App.main 中的 upgradeDowngradeHistory
 *
 * @param {string} yahooTicker - Yahoo ticker（如 AAPL, 2330.TW, 7203.T）
 * @return {Array} history 陣列
 */
function fetchYahooHistoryFromJSON(yahooTicker) {
  var history = [];
  try {
    var url = "https://finance.yahoo.com/quote/" + encodeURIComponent(yahooTicker);
    Logger.log(`P5 Weekly：Yahoo HTML JSON 歷史評級抓取：${yahooTicker}，URL=${url}`);
    
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    var status = response.getResponseCode();
    if (status !== 200) {
      if (status === 503 || status === 429) {
        Logger.log(`P5 Weekly：⚠️ Yahoo HTML HTTP ${status}（${yahooTicker}）→ 被封鎖，改用 CSE 新聞碎片重構法`);
        // V8.9 備用方案：CSE 新聞碎片重構法
        var market = inferMarketFromYahooTicker(yahooTicker);
        var baseTicker = yahooTicker;
        if (market === "TW") baseTicker = baseTicker.replace(".TW", "");
        else if (market === "JP") baseTicker = baseTicker.replace(".T", "");
        return fetchInstitutionalRatingsFromCSE(baseTicker, market);
      }
      Logger.log(`P5 Weekly：⚠️ Yahoo HTML HTTP ${status}（${yahooTicker}）`);
      return [];
    }
    
    var html = response.getContentText();
    
    // 1. 尋找 JSON 起點（可選，我們直接找 upgradeDowngradeHistory）
    // 技巧：直接搜尋 "upgradeDowngradeHistory":{"history":
    var keyStart = html.indexOf('"upgradeDowngradeHistory":{"history":');
    if (keyStart === -1) {
      // 備用：嘗試搜尋 "upgradeDowngradeHistory":{（可能沒有 history 欄位）
      keyStart = html.indexOf('"upgradeDowngradeHistory":{');
      if (keyStart === -1) {
        Logger.log(`P5 Weekly：⚠️ Yahoo HTML 找不到 upgradeDowngradeHistory（${yahooTicker}）`);
        return [];
      }
    }
    
    // 找到陣列的開始 [
    var arrayStart = html.indexOf('[', keyStart);
    if (arrayStart === -1) {
      Logger.log(`P5 Weekly：⚠️ Yahoo HTML 找不到歷史陣列（${yahooTicker}）`);
      return [];
    }
    
    // 找到陣列的結束 ]（需要簡單的括號計數）
    // 簡單法：Yahoo 的 JSON 結構通常緊湊，我們截取到下一個 "maxAge" 或 "}"
    var arrayEnd = html.indexOf('],"maxAge"', arrayStart);
    if (arrayEnd === -1) {
      arrayEnd = html.indexOf(']}', arrayStart + 1);
      if (arrayEnd === -1) {
        Logger.log(`P5 Weekly：⚠️ Yahoo HTML 陣列結束位置不明（${yahooTicker}），嘗試手動計算`);
        // 備用：簡單括號計數（不太可靠，但至少試試）
        var depth = 0;
        var foundStart = false;
        for (var i = arrayStart; i < Math.min(arrayStart + 50000, html.length); i++) {
          if (html.charAt(i) === '[') {
            depth++;
            foundStart = true;
          } else if (html.charAt(i) === ']') {
            depth--;
            if (foundStart && depth === 0) {
              arrayEnd = i;
              break;
            }
          }
        }
        if (arrayEnd === -1) {
          Logger.log(`P5 Weekly：❌ Yahoo HTML 無法確定陣列結束位置（${yahooTicker}）`);
          return [];
        }
      }
    }
    
    if (arrayStart > -1 && arrayEnd > arrayStart) {
      var jsonArrayStr = html.substring(arrayStart, arrayEnd + 1); // 包含 ]
      try {
        var rawData = JSON.parse(jsonArrayStr);
        
        if (!Array.isArray(rawData)) {
          Logger.log(`P5 Weekly：⚠️ Yahoo HTML 解析結果不是陣列（${yahooTicker}）`);
          return [];
        }
        
        // 轉換格式
        for (var i = 0; i < rawData.length; i++) {
          var item = rawData[i];
          try {
            var epoch = item.epochGradeDate;
            if (typeof epoch !== "number") {
              epoch = item.epochGradeDate && item.epochGradeDate.raw !== undefined ? item.epochGradeDate.raw : null;
            }
            
            var toPrice = item.toPrice;
            if (toPrice && typeof toPrice !== "number") {
              toPrice = toPrice.raw !== undefined ? toPrice.raw : null;
            }
            
            var fromPrice = item.fromPrice;
            if (fromPrice && typeof fromPrice !== "number") {
              fromPrice = fromPrice.raw !== undefined ? fromPrice.raw : null;
            }
            
            history.push({
              date: epoch && epoch > 0 ? new Date(epoch * 1000).toISOString().split('T')[0] : null,
              epoch: epoch || null,
              firm: item.firm || item.researchFirm || null,
              action: item.action || null, // Up, Down, Main, Init
              from_grade: item.fromGrade || null,
              to_grade: item.toGrade || null,
              from_price: (typeof fromPrice === "number" ? fromPrice : null),
              to_price: (typeof toPrice === "number" ? toPrice : null),
              target_change: (fromPrice && toPrice && typeof fromPrice === "number" && typeof toPrice === "number") ? (`$${fromPrice.toFixed(2)} -> $${toPrice.toFixed(2)}`) : ""
            });
          } catch (e) {
            Logger.log(`P5 Weekly：⚠️ Yahoo HTML 解析單筆資料失敗（${yahooTicker}，index=${i}）：${e.message}`);
          }
        }
        
        Logger.log(`P5 Weekly：✅ Yahoo HTML JSON 成功抓取 ${history.length} 筆歷史評級（${yahooTicker}）`);
      } catch (e) {
        Logger.log(`P5 Weekly：❌ Yahoo HTML JSON 解析失敗（${yahooTicker}）：${e.message}`);
      }
    }
    
  } catch (e) {
    Logger.log(`P5 Weekly：❌ Yahoo HTML JSON Error（${yahooTicker}）：${e.message}`);
  }
  return history;
}

/**
 * V8.6 升級版：機構言行一致性分析（防詐騙過濾器）
 * 結合「評級日期」與「當時股價反應」來判斷是真訊號還是假動作
 * 
 * 核心邏輯：
 * - Upgrade + 大漲 + 爆量 = 真利多（True Breakout）
 * - Upgrade + 開高走低/不漲 = 誘多出貨（Bull Trap）
 * - Downgrade + 重挫 + 爆量 = 真利空
 * - Downgrade + 利空不跌 = 吃貨訊號（Bear Trap）
 *
 * @param {Array} history - 歷史評級陣列
 * @param {string} ticker - 股票代碼（用於查詢價格反應）
 * @param {string} market - 市場（US/TW/JP）
 * @return {Object} { score, label, warnings }
 */
function analyzeSmartSentiment(history, ticker, market) {
  if (!history || history.length === 0) {
    return { score: 0, label: "NEUTRAL", warnings: null };
  }
  
  var score = 0;
  var warningSignals = []; // 紀錄「誘多」或「誘空」的假動作
  var recentLimit = new Date();
  recentLimit.setMonth(recentLimit.getMonth() - 3); // 只看最近 3 個月
  
  // 構建用於查詢的 ticker（需要轉換為 MARKET_OHLCV_DAILY 的格式）
  var queryTicker = ticker;
  if (market === "TW") {
    queryTicker = `TPE:${ticker}`;
  } else if (market === "JP") {
    queryTicker = `TYO:${ticker}`;
  }
  // US 市場直接使用 ticker（如 AAPL）
  
  for (var i = 0; i < history.length; i++) {
    var item = history[i];
    if (!item || !item.date) continue;
    
    var itemDate = new Date(item.date);
    if (isNaN(itemDate.getTime())) continue;
    
    if (itemDate < recentLimit) break; // 超過 3 個月就不看了 (history 通常按日期排序)
    
    // 1. 基本分（分析師說的話）
    var rawScore = 0;
    var action = (item.action || item.rating_action || "").toLowerCase();
    if (action.indexOf("upgrade") > -1 || action === "upgrade") rawScore = 2;
    else if (action.indexOf("downgrade") > -1 || action === "downgrade") rawScore = -2;
    else if (action.indexOf("initiate") > -1 || action === "initiate") rawScore = 1; // 初始覆蓋通常偏正面
    else if (action.indexOf("maintain") > -1 || action === "maintain") rawScore = 0; // 維持中性
    
    // 根據目標價變化評分（先給基本分）
    if (item.target_change && item.target_change.indexOf("->") > -1) {
      try {
        var parts = item.target_change.split("->");
        var oldPStr = parts[0].replace(/\$|,|NT\$|¥/g, "").trim();
        var newPStr = parts[1].replace(/\$|,|NT\$|¥/g, "").trim();
        var oldP = parseFloat(oldPStr);
        var newP = parseFloat(newPStr);
        if (!isNaN(oldP) && !isNaN(newP)) {
          if (newP > oldP) rawScore += 1;
          if (newP < oldP) rawScore -= 1;
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    } else if (item.from_price && item.to_price) {
      // 處理資料庫格式（可能是字串或數字）
      var fromPrice = typeof item.from_price === "number" ? item.from_price : parseFloat(item.from_price);
      var toPrice = typeof item.to_price === "number" ? item.to_price : parseFloat(item.to_price);
      
      if (!isNaN(fromPrice) && !isNaN(toPrice) && fromPrice > 0 && toPrice > 0) {
        if (toPrice > fromPrice) rawScore += 1;
        if (toPrice < fromPrice) rawScore -= 1;
      }
    }
    
    // 2. 驗證分（市場的反應）- ⭐ V8.9 升級：取得多時間維度的價格反應
    var priceReactions = getPriceReactionMultiTimeframe(queryTicker, item.date);
    var priceReaction = priceReactions ? priceReactions.short_term : null; // 短期反應用於基本判斷
    
    if (rawScore > 0) {
      // 利多情況
      if (priceReaction && priceReaction.changePct > 0.02 && priceReaction.volumeSpike) {
        // ✅ 言行一致，真利多（大漲 + 爆量）
        score += 3;
      } else if (priceReaction && priceReaction.changePct < -0.01) {
        // 🚨 利多不漲反跌 = 出貨盤（扣分！）
        score -= 2;
        var firmName = item.firm || item.rating_firm || "Unknown";
        warningSignals.push(`${item.date} ${firmName} 誘多出貨嫌疑（Upgrade 但股價下跌 ${(priceReaction.changePct * 100).toFixed(2)}%）`);
      } else if (priceReaction && priceReaction.changePct < 0.005 && !priceReaction.volumeSpike) {
        // ⚠️ 利多不漲 + 量縮 = 動能耗盡
        score += 0;
        var firmName2 = item.firm || item.rating_firm || "Unknown";
        warningSignals.push(`${item.date} ${firmName2} 利多不漲（動能耗盡嫌疑）`);
      } else {
        // 反應平淡
        score += 1;
      }
    } else if (rawScore < 0) {
      // 利空情況
      if (priceReaction && priceReaction.changePct < -0.02 && priceReaction.volumeSpike) {
        // ✅ 言行一致，真利空（重挫 + 爆量）
        score -= 3;
      } else if (priceReaction && priceReaction.changePct > 0.01) {
        // 💎 利空不跌 = 吃貨盤（加分！）
        score += 2;
        var firmName3 = item.firm || item.rating_firm || "Unknown";
        warningSignals.push(`${item.date} ${firmName3} 誘空吃貨嫌疑（Downgrade 但股價上漲 ${(priceReaction.changePct * 100).toFixed(2)}%）`);
      } else {
        // 反應平淡
        score -= 1;
      }
    } else {
      // rawScore === 0（如 Initiate），只給基本分
      score += rawScore;
    }
  }
  
  var label = "NEUTRAL";
  if (score >= 5) label = "STRONG_BULL";
  else if (score >= 2) label = "BULLISH";
  else if (score <= -5) label = "STRONG_BEAR";
  else if (score <= -2) label = "BEARISH";
  
  // ⭐ V8.9 新增；V8.19 N2：僅短期 7d、中期 15d
  var multiTimeframeWarnings = [];
  if (priceReactions && priceReactions.short_term && priceReactions.mid_term) {
    var shortChange = priceReactions.short_term.changePct || 0;
    var midChange = priceReactions.mid_term.changePct || 0;
    if (rawScore > 0 && shortChange < 0 && midChange > 0.02) {
      multiTimeframeWarnings.push(`短期誘多但中期跟進（短期下跌 ${(shortChange * 100).toFixed(2)}%，中期上漲 ${(midChange * 100).toFixed(2)}%）`);
    }
    if (rawScore < 0 && shortChange > 0 && midChange < -0.02) {
      multiTimeframeWarnings.push(`短期誘空但中期跟進（短期上漲 ${(shortChange * 100).toFixed(2)}%，中期下跌 ${(midChange * 100).toFixed(2)}%）`);
    }
  }
  
  var allWarnings = warningSignals.concat(multiTimeframeWarnings);
  
  return { 
    score: score, 
    label: label, 
    warnings: allWarnings.length > 0 ? allWarnings.join("; ") : null,
    price_reactions: priceReactions || null  // ⭐ V8.9 新增：返回多時間維度價格反應數據
  };
}

/**
 * 輔助函數：取得評級發布後 N 天內的價格反應
 * ⭐ V8.9 升級；V8.19 N2：支援多時間維度查詢（短期 7d、中期 15d）
 * 
 * @param {string} ticker - 查詢用的 ticker（如 AAPL, TPE:2330, TYO:7203）
 * @param {string} dateStr - 評級發布日期（ISO 格式，如 "2026-01-15"）
 * @param {number|Object} daysOrConfig - 查詢天數（預設 3 天）或配置對象 { startDays: 1, endDays: 5 }
 * @return {Object|null} { changePct, volumeSpike, open, close, high, low, volume } 或 null
 * @return {Object|null} 多時間維度模式：{ short_term: {...}, mid_term: {...} } 或 null
 */
function getPriceReaction(ticker, dateStr, daysOrConfig) {
  // V8.9 新增：支援多時間維度查詢
  if (typeof daysOrConfig === "object" && daysOrConfig.multiTimeframe) {
    return getPriceReactionMultiTimeframe(ticker, dateStr);
  }
  
  var days = typeof daysOrConfig === "number" ? daysOrConfig : 3;
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P5 Weekly：⚠️ MARKET_OHLCV_DAILY 表格不存在或無數據，無法驗證價格反應（${ticker}）`);
      return null;
    }
    
    // 讀取所有數據（或使用更高效的方式，但這裡先簡單處理）
    var lastRow = sheet.getLastRow();
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 8); // date, ticker, open, high, low, close, volume, adj_close
    var data = dataRange.getValues();
    
    // 找到評級發布當天及之後 N 天的數據
    var ratingDate = new Date(dateStr);
    if (isNaN(ratingDate.getTime())) {
      Logger.log(`P5 Weekly：⚠️ 無效的日期格式（${dateStr}）`);
      return null;
    }
    
    ratingDate.setHours(0, 0, 0, 0);
    var endDate = new Date(ratingDate);
    endDate.setDate(endDate.getDate() + days);
    
    var matchingRows = [];
    for (var i = 0; i < data.length; i++) {
      var rowDate = data[i][0]; // date 欄位
      var rowTicker = data[i][1]; // ticker 欄位
      
      if (!rowDate || !rowTicker) continue;
      
      var d = rowDate instanceof Date ? rowDate : new Date(rowDate);
      if (isNaN(d.getTime())) continue;
      
      d.setHours(0, 0, 0, 0);
      
      // 比對 ticker（需要處理不同格式，如 TPE:2330 vs 2330）
      var tickerMatch = false;
      if (rowTicker === ticker) {
        tickerMatch = true;
      } else if (ticker.indexOf(":") > -1) {
        // 如果 ticker 是 TPE:2330，也接受 2330
        var baseTicker = ticker.split(":")[1];
        if (rowTicker === baseTicker || rowTicker === ticker) {
          tickerMatch = true;
        }
      } else if (rowTicker.indexOf(":") > -1) {
        // 如果 rowTicker 是 TPE:2330，ticker 是 2330
        var baseTicker2 = rowTicker.split(":")[1];
        if (baseTicker2 === ticker) {
          tickerMatch = true;
        }
      }
      
      if (tickerMatch && d >= ratingDate && d <= endDate) {
        matchingRows.push({
          date: d,
          open: data[i][2],
          high: data[i][3],
          low: data[i][4],
          close: data[i][5],
          volume: data[i][6],
          adj_close: data[i][7]
        });
      }
    }
    
    if (matchingRows.length === 0) {
      Logger.log(`P5 Weekly：⚠️ 找不到 ${ticker} 在 ${dateStr} 後 ${days} 天的價格數據`);
      return null;
    }
    
    // 計算累積漲跌幅（從評級發布當天的開盤價到最後一天的收盤價）
    var firstOpen = matchingRows[0].open;
    var lastClose = matchingRows[matchingRows.length - 1].close;
    
    if (!firstOpen || !lastClose || firstOpen <= 0) {
      Logger.log(`P5 Weekly：⚠️ 價格數據異常（${ticker}，${dateStr}）`);
      return null;
    }
    
    var changePct = (lastClose - firstOpen) / firstOpen;
    
    // 計算量能是否爆量（與前 20 天平均量比較，如果找不到則跳過此檢查）
    var avgVolume = null;
    var volumeSpike = false;
    
    // 嘗試找前 20 天的平均量（簡單實作，可以優化）
    var beforeDate = new Date(ratingDate);
    beforeDate.setDate(beforeDate.getDate() - 20);
    var volumeData = [];
    for (var j = 0; j < data.length; j++) {
      var d2 = data[j][0] instanceof Date ? data[j][0] : new Date(data[j][0]);
      if (isNaN(d2.getTime())) continue;
      d2.setHours(0, 0, 0, 0);
      
      var tickerMatch2 = false;
      var rowTicker2 = data[j][1];
      if (rowTicker2 === ticker) {
        tickerMatch2 = true;
      } else if (ticker.indexOf(":") > -1) {
        var baseTicker3 = ticker.split(":")[1];
        if (rowTicker2 === baseTicker3 || rowTicker2 === ticker) {
          tickerMatch2 = true;
        }
      } else if (rowTicker2 && rowTicker2.indexOf(":") > -1) {
        var baseTicker4 = rowTicker2.split(":")[1];
        if (baseTicker4 === ticker) {
          tickerMatch2 = true;
        }
      }
      
      if (tickerMatch2 && d2 >= beforeDate && d2 < ratingDate && data[j][6] && data[j][6] > 0) {
        volumeData.push(data[j][6]);
      }
    }
    
    if (volumeData.length > 0) {
      var sum = 0;
      for (var k = 0; k < volumeData.length; k++) {
        sum += volumeData[k];
      }
      avgVolume = sum / volumeData.length;
      
      // 檢查評級發布後是否有爆量（任何一天的成交量 > 2.0 * 平均量）
      for (var m = 0; m < matchingRows.length; m++) {
        if (matchingRows[m].volume && matchingRows[m].volume > 2.0 * avgVolume) {
          volumeSpike = true;
          break;
        }
      }
    }
    
    return {
      changePct: changePct,
      volumeSpike: volumeSpike,
      avgVolume: avgVolume,
      firstOpen: firstOpen,
      lastClose: lastClose,
      daysCount: matchingRows.length
    };
    
  } catch (e) {
    Logger.log(`P5 Weekly：❌ getPriceReaction 失敗（${ticker}，${dateStr}）：${e.message}`);
    return null;
  }
}

/**
 * ⭐ V8.9 新增；V8.19 N2 簡化：多時間維度股價反應驗證
 * 時間維度簡化為 短期 7d、中期 15d（移除長期）
 * 
 * @param {string} ticker - 查詢用的 ticker（如 AAPL, TPE:2330, TYO:7203）
 * @param {string} dateStr - 評級發布日期（ISO 格式，如 "2026-01-15"）
 * @return {Object|null} { short_term: {...}, mid_term: {...} } 或 null
 */
function getPriceReactionMultiTimeframe(ticker, dateStr) {
  try {
    var shortTerm = getPriceReaction(ticker, dateStr, 7);
    var midTerm = getPriceReactionInRange(ticker, dateStr, 7, 15);
    
    return {
      short_term: shortTerm,
      mid_term: midTerm
    };
  } catch (e) {
    Logger.log(`P5 Weekly：❌ getPriceReactionMultiTimeframe 失敗（${ticker}，${dateStr}）：${e.message}`);
    return null;
  }
}

/**
 * ⭐ V8.9 新增：取得評級發布後特定時間範圍的價格反應
 * 
 * @param {string} ticker - 查詢用的 ticker
 * @param {string} dateStr - 評級發布日期
 * @param {number} startDay - 起始天數（從評級發布後的第幾天開始）
 * @param {number} endDay - 結束天數（到評級發布後的第幾天結束）
 * @return {Object|null} 價格反應數據
 */
function getPriceReactionInRange(ticker, dateStr, startDay, endDay) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    var ratingDate = new Date(dateStr);
    if (isNaN(ratingDate.getTime())) {
      return null;
    }
    
    ratingDate.setHours(0, 0, 0, 0);
    var startDate = new Date(ratingDate);
    startDate.setDate(startDate.getDate() + startDay);
    var endDate = new Date(ratingDate);
    endDate.setDate(endDate.getDate() + endDay);
    
    var lastRow = sheet.getLastRow();
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
    var data = dataRange.getValues();
    
    var matchingRows = [];
    for (var i = 0; i < data.length; i++) {
      var rowDate = data[i][0];
      var rowTicker = data[i][1];
      
      if (!rowDate || !rowTicker) continue;
      
      var d = rowDate instanceof Date ? rowDate : new Date(rowDate);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      
      var tickerMatch = false;
      if (rowTicker === ticker) {
        tickerMatch = true;
      } else if (ticker.indexOf(":") > -1) {
        var baseTicker = ticker.split(":")[1];
        if (rowTicker === baseTicker || rowTicker === ticker) {
          tickerMatch = true;
        }
      } else if (rowTicker && rowTicker.indexOf(":") > -1) {
        var baseTicker2 = rowTicker.split(":")[1];
        if (baseTicker2 === ticker) {
          tickerMatch = true;
        }
      }
      
      if (tickerMatch && d >= startDate && d <= endDate) {
        matchingRows.push({
          date: d,
          open: data[i][2],
          high: data[i][3],
          low: data[i][4],
          close: data[i][5],
          volume: data[i][6],
          adj_close: data[i][7]
        });
      }
    }
    
    if (matchingRows.length === 0) {
      return null;
    }
    
    var firstOpen = matchingRows[0].open;
    var lastClose = matchingRows[matchingRows.length - 1].close;
    
    if (!firstOpen || !lastClose || firstOpen <= 0) {
      return null;
    }
    
    var changePct = (lastClose - firstOpen) / firstOpen;
    
    // 計算平均量（用於判斷是否爆量）
    var avgVolume = null;
    var volumeSpike = false;
    
    var beforeDate = new Date(ratingDate);
    beforeDate.setDate(beforeDate.getDate() - 20);
    var volumeData = [];
    
    for (var j = 0; j < data.length; j++) {
      var d2 = data[j][0] instanceof Date ? data[j][0] : new Date(data[j][0]);
      if (isNaN(d2.getTime())) continue;
      d2.setHours(0, 0, 0, 0);
      
      var tickerMatch2 = false;
      var rowTicker2 = data[j][1];
      if (rowTicker2 === ticker) {
        tickerMatch2 = true;
      } else if (ticker.indexOf(":") > -1) {
        var baseTicker3 = ticker.split(":")[1];
        if (rowTicker2 === baseTicker3 || rowTicker2 === ticker) {
          tickerMatch2 = true;
        }
      } else if (rowTicker2 && rowTicker2.indexOf(":") > -1) {
        var baseTicker4 = rowTicker2.split(":")[1];
        if (baseTicker4 === ticker) {
          tickerMatch2 = true;
        }
      }
      
      if (tickerMatch2 && d2 >= beforeDate && d2 < ratingDate && data[j][6] && data[j][6] > 0) {
        volumeData.push(data[j][6]);
      }
    }
    
    if (volumeData.length > 0) {
      var sum = 0;
      for (var k = 0; k < volumeData.length; k++) {
        sum += volumeData[k];
      }
      avgVolume = sum / volumeData.length;
      
      for (var m = 0; m < matchingRows.length; m++) {
        if (matchingRows[m].volume && matchingRows[m].volume > 2.0 * avgVolume) {
          volumeSpike = true;
          break;
        }
      }
    }
    
    return {
      changePct: changePct,
      volumeSpike: volumeSpike,
      avgVolume: avgVolume,
      firstOpen: firstOpen,
      lastClose: lastClose,
      daysCount: matchingRows.length
    };
    
  } catch (e) {
    Logger.log(`P5 Weekly：❌ getPriceReactionInRange 失敗（${ticker}，${dateStr}，${startDay}-${endDay}天）：${e.message}`);
    return null;
  }
}

/**
 * 邏輯運算：計算機構風向 (Institutional Momentum) - 舊版（保留作為備用）
 * 
 * @deprecated 請使用 analyzeSmartSentiment 替代（V8.6 升級版）
 * @param {Array} history - 歷史評級陣列
 * @return {Object} { score, label }
 */
function analyzeSentimentTrend(history) {
  if (!history || history.length === 0) {
    return { score: 0, label: "NEUTRAL" };
  }
  
  var score = 0;
  var recentLimit = new Date();
  recentLimit.setMonth(recentLimit.getMonth() - 3); // 只看最近 3 個月
  
  for (var i = 0; i < history.length; i++) {
    var item = history[i];
    if (!item || !item.date) continue;
    
    var itemDate = new Date(item.date);
    if (isNaN(itemDate.getTime())) continue;
    
    if (itemDate < recentLimit) break;
    
    var action = (item.action || "").toLowerCase();
    if (action.indexOf("upgrade") > -1 || action.indexOf("up") > -1) score += 2;
    if (action.indexOf("downgrade") > -1 || action.indexOf("down") > -1) score -= 2;
    if (action.indexOf("init") > -1) score += 1;
    
    if (item.target_change && item.target_change.indexOf("->") > -1) {
      try {
        var parts = item.target_change.split("->");
        var oldPStr = parts[0].replace(/\$|,/g, "").trim();
        var newPStr = parts[1].replace(/\$|,/g, "").trim();
        var oldP = parseFloat(oldPStr);
        var newP = parseFloat(newPStr);
        if (!isNaN(oldP) && !isNaN(newP)) {
          if (newP > oldP) score += 1;
          if (newP < oldP) score -= 1;
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    } else if (item.from_price && item.to_price && typeof item.from_price === "number" && typeof item.to_price === "number") {
      if (item.to_price > item.from_price) score += 1;
      if (item.to_price < item.from_price) score -= 1;
    }
  }
  
  var label = "NEUTRAL";
  if (score >= 3) label = "BULLISH";
  if (score <= -3) label = "BEARISH";
  
  return { score: score, label: label };
}

/**
 * V8.9 挖掘機 C: CSE 新聞碎片重構法 (針對所有市場)
 * 當 Yahoo/Finviz 被封鎖（HTTP 503）時，改用 CSE 搜尋 Tier 2 快訊聚合網站的新聞標題
 * 從標準化新聞標題重構歷史評級事件
 *
 * @param {string} ticker - 原始 ticker（如 AAPL, 2330, 7203）
 * @param {string} market - 市場（US/TW/JP）
 * @return {Array} history 陣列
 */
function fetchInstitutionalRatingsFromCSE(ticker, market) {
  var history = [];
  try {
    Logger.log(`P5 Weekly：CSE 新聞碎片重構法：${ticker}（${market}）`);
    
    // 構建搜尋查詢（針對不同市場優化）
    var queries = [];
    
    if (market === "US" || market === "United States") {
      // 美股：搜尋 The Fly 格式的標題
      queries.push(`${ticker} upgrade downgrade target price The Fly`);
      queries.push(`${ticker} analyst rating target Goldman Sachs Morgan Stanley Citi`);
      queries.push(`"${ticker}" "target raised" OR "target cut" OR "upgraded" OR "downgraded" site:thefly.com`);
    } else if (market === "TW" || market === "Taiwan") {
      // 台股：搜尋鉅亨網格式的標題
      queries.push(`${ticker} 外資 目標價 調升 調降 鉅亨網`);
      queries.push(`${ticker} 大摩 小摩 目標價 評等 調升`);
      queries.push(`"${ticker}" "目標價" OR "調升" OR "調降" OR "重申" site:anue.com.tw`);
    } else if (market === "JP" || market === "Japan") {
      // 日股：搜尋 Minkabu 格式的標題
      queries.push(`${ticker} レーティング 目標株価 引上げ 引下げ Minkabu`);
      queries.push(`${ticker} 投資判断 目標価格 みんかぶ`);
    }
    
    // 使用 CSE 搜尋（鎖定 Tier 2 快訊聚合網站）
    var cseType = "P5_INSTITUTIONAL_RATINGS"; // V8.9 新增的 CSE 配置
    
    for (var q = 0; q < Math.min(queries.length, 3); q++) {
      try {
        var query = queries[q];
        Logger.log(`P5 Weekly：CSE 搜尋（${q + 1}/${Math.min(queries.length, 3)}）：${query}`);
        
        var jobId = `P5_INSTITUTIONAL_RATINGS_CSE_${ticker}_${Date.now()}_${q}`;
        var step = "CSE_SEARCH";
        var payload = {
          search_query: query,
          cse_type: cseType,
          max_results: 10  // 每個查詢最多 10 筆結果
        };
        
        // 檢查 executeCSESearch 是否存在
        if (typeof executeCSESearch !== "function") {
          Logger.log(`P5 Weekly：⚠️ executeCSESearch 未定義，無法使用 CSE 新聞碎片重構法`);
          break;
        }
        
        var cseResults = executeCSESearch(jobId, step, payload);
        
        if (!cseResults || !cseResults.output || !cseResults.output.search_results || cseResults.output.search_results.length === 0) {
          Logger.log(`P5 Weekly：CSE 搜尋無結果（query=${query}）`);
          continue;
        }
        
        var searchResults = cseResults.output.search_results || [];
        Logger.log(`P5 Weekly：CSE 搜尋找到 ${searchResults.length} 筆結果（query=${query}）`);
        
        // 解析新聞標題和摘要，提取評級事件
        for (var i = 0; i < searchResults.length; i++) {
          var result = searchResults[i];
          try {
            var parsedEvent = parseNewsTitleForRating(result.title || "", result.snippet || "", ticker, market);
            
            if (parsedEvent && parsedEvent.firm && parsedEvent.action) {
              // 檢查是否重複（避免同一事件被多次提取）
              var isDuplicate = history.some(function(h) {
                return h.firm === parsedEvent.firm &&
                       h.action === parsedEvent.action &&
                       h.date === parsedEvent.date &&
                       Math.abs((h.to_price || 0) - (parsedEvent.to_price || 0)) < 0.01;
              });
              
              if (!isDuplicate) {
                history.push(parsedEvent);
              }
            }
          } catch (e) {
            Logger.log(`P5 Weekly：⚠️ 解析新聞標題失敗（${result.link || "unknown"}）：${e.message}`);
          }
        }
        
        // 避免請求過快
        Utilities.sleep(1000);
        
      } catch (e) {
        Logger.log(`P5 Weekly：⚠️ CSE 搜尋失敗（query=${queries[q]}）：${e.message}`);
      }
    }
    
    // 按日期排序（最新的在前）
    history.sort(function(a, b) {
      var dateA = a.date ? new Date(a.date).getTime() : 0;
      var dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // 降序
    });
    
    Logger.log(`P5 Weekly：✅ CSE 新聞碎片重構法成功重構 ${history.length} 筆歷史評級（${ticker}，${market}）`);
    
  } catch (e) {
    Logger.log(`P5 Weekly：❌ CSE 新聞碎片重構法失敗（${ticker}，${market}）：${e.message}`);
  }
  
  return history;
}

/**
 * 從新聞標題和摘要中解析機構評級事件
 * 
 * @param {string} title - 新聞標題
 * @param {string} snippet - 新聞摘要
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @return {Object|null} { date, firm, action, from_grade, to_grade, from_price, to_price, target_change }
 */
function parseNewsTitleForRating(title, snippet, ticker, market) {
  try {
    var text = (title + " " + snippet).toLowerCase();
    
    // 提取日期（從標題或摘要中，或使用當前日期）
    var date = extractDateFromText(title + " " + snippet) || new Date().toISOString().split('T')[0];
    
    // 提取機構名稱（常見機構列表）
    var firm = extractFirmFromText(title + " " + snippet, market);
    
    // 提取動作（Upgrade / Downgrade / Maintain / Initiate）
    var action = extractActionFromText(text);
    
    // 提取目標價變化（from_price -> to_price）
    var priceChange = extractPriceChangeFromText(text, market);
    
    // 提取評級變化（from_grade -> to_grade）
    var gradeChange = extractGradeChangeFromText(text, market);
    
    if (!firm || !action) {
      // 如果沒有機構或動作，無法構建有效事件
      return null;
    }
    
    return {
      date: date,
      firm: firm,
      action: action,
      from_grade: gradeChange.from_grade || null,
      to_grade: gradeChange.to_grade || null,
      from_price: priceChange.from_price || null,
      to_price: priceChange.to_price || null,
      target_change: priceChange.target_change || null,
      source: "CSE_NEWS"
    };
    
  } catch (e) {
    Logger.log(`P5 Weekly：⚠️ parseNewsTitleForRating 失敗：${e.message}`);
    return null;
  }
}

/**
 * 從文字中提取日期
 */
function extractDateFromText(text) {
  try {
    // 嘗試提取常見日期格式（例如：Jan 15, 2026 / 2026-01-15 / 1/15/26）
    var datePatterns = [
      /(\w{3})\s+(\d{1,2}),\s+(\d{4})/i,  // Jan 15, 2026
      /(\d{4})-(\d{2})-(\d{2})/,          // 2026-01-15
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,    // 1/15/2026
      /(\d{1,2})\/(\d{1,2})\/(\d{2})/     // 1/15/26
    ];
    
    for (var i = 0; i < datePatterns.length; i++) {
      var match = text.match(datePatterns[i]);
      if (match) {
        try {
          var date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          // 忽略解析錯誤
        }
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 從文字中提取機構名稱
 */
function extractFirmFromText(text, market) {
  // 常見機構列表（不分市場）
  var commonFirms = [
    "Goldman Sachs", "Goldman", "GS",
    "Morgan Stanley", "Morgan", "MS", "大摩",
    "JPMorgan", "JPM", "JP Morgan", "小摩",
    "Citigroup", "Citi", "Citibank",
    "Bank of America", "BofA", "BOA",
    "Wells Fargo", "Wells",
    "UBS", "Credit Suisse", "CS",
    "Deutsche Bank", "Deutsche",
    "Barclays", "RBC", "TD", "BMO",
    "Jefferies", "Piper Sandler", "Raymond James",
    "Mizuho", "Nomura", "野村", "三菱UFJ", "大和證券", "SMBC"
  ];
  
  var lowerText = text.toLowerCase();
  
  for (var i = 0; i < commonFirms.length; i++) {
    var firm = commonFirms[i];
    if (lowerText.indexOf(firm.toLowerCase()) > -1) {
      // 返回標準化名稱
      if (firm === "大摩") return "Morgan Stanley";
      if (firm === "小摩") return "JPMorgan";
      if (firm === "野村") return "Nomura";
      return firm;
    }
  }
  
  return null;
}

/**
 * 從文字中提取動作（Upgrade / Downgrade / Maintain / Initiate）
 */
function extractActionFromText(text) {
  var lowerText = text.toLowerCase();
  
  if (lowerText.indexOf("upgrade") > -1 || lowerText.indexOf("調升") > -1 || lowerText.indexOf("引上げ") > -1 || lowerText.indexOf("買い") > -1) {
    return "Upgrade";
  }
  if (lowerText.indexOf("downgrade") > -1 || lowerText.indexOf("調降") > -1 || lowerText.indexOf("引下げ") > -1 || lowerText.indexOf("売り") > -1) {
    return "Downgrade";
  }
  if (lowerText.indexOf("initiate") > -1 || lowerText.indexOf("初始") > -1 || lowerText.indexOf("初回") > -1) {
    return "Initiate";
  }
  if (lowerText.indexOf("maintain") > -1 || lowerText.indexOf("reiterate") > -1 || lowerText.indexOf("重申") > -1 || lowerText.indexOf("維持") > -1) {
    return "Maintain";
  }
  
  return null;
}

/**
 * 從文字中提取目標價變化
 */
function extractPriceChangeFromText(text, market) {
  try {
    var lowerText = text.toLowerCase();
    
    // 美股格式：target raised to $180 from $150 / $180 from $150
    var usPattern = /\$(\d+(?:\.\d+)?)\s+from\s+\$(\d+(?:\.\d+)?)|\$(\d+(?:\.\d+)?)\s+to\s+\$(\d+(?:\.\d+)?)/i;
    var usMatch = text.match(usPattern);
    
    if (usMatch) {
      var toPrice = parseFloat(usMatch[1] || usMatch[3] || usMatch[4]);
      var fromPrice = parseFloat(usMatch[2] || usMatch[3]);
      
      if (!isNaN(toPrice) && !isNaN(fromPrice) && toPrice > 0 && fromPrice > 0) {
        return {
          from_price: fromPrice,
          to_price: toPrice,
          target_change: `$${fromPrice.toFixed(2)} -> $${toPrice.toFixed(2)}`
        };
      }
    }
    
    // 台股格式：目標價 1380元 / 調升至 1380元
    var twPattern = /目標價\s*(\d+(?:\.\d+)?)\s*元|調升至\s*(\d+(?:\.\d+)?)\s*元|調降[至到]\s*(\d+(?:\.\d+)?)\s*元/i;
    var twMatch = text.match(twPattern);
    
    if (twMatch && market === "TW") {
      var toPriceTW = parseFloat(twMatch[1] || twMatch[2] || twMatch[3]);
      if (!isNaN(toPriceTW) && toPriceTW > 0) {
        return {
          to_price: toPriceTW,
          target_change: `NT$${toPriceTW.toFixed(2)}`
        };
      }
    }
    
    // 日股格式：目標株価 1500円 / 1500円に引上げ
    var jpPattern = /目標株価\s*(\d+(?:\.\d+)?)\s*円|(\d+(?:\.\d+)?)\s*円に/i;
    var jpMatch = text.match(jpPattern);
    
    if (jpMatch && market === "JP") {
      var toPriceJP = parseFloat(jpMatch[1] || jpMatch[2]);
      if (!isNaN(toPriceJP) && toPriceJP > 0) {
        return {
          to_price: toPriceJP,
          target_change: `¥${toPriceJP.toFixed(2)}`
        };
      }
    }
    
    return { from_price: null, to_price: null, target_change: null };
  } catch (e) {
    return { from_price: null, to_price: null, target_change: null };
  }
}

/**
 * 從文字中提取評級變化
 */
function extractGradeChangeFromText(text, market) {
  try {
    var lowerText = text.toLowerCase();
    
    // 美股格式：Buy -> Strong Buy / Neutral -> Buy
    var usPattern = /(buy|sell|hold|neutral|overweight|underweight|strong buy|strong sell)\s*(?:->|to|from)\s*(buy|sell|hold|neutral|overweight|underweight|strong buy|strong sell)/i;
    var usMatch = text.match(usPattern);
    
    if (usMatch) {
      return {
        from_grade: usMatch[1] || null,
        to_grade: usMatch[2] || null
      };
    }
    
    // 台股格式：優於大盤 -> 買進 / 中立 -> 買進
    var twPattern = /(優於大盤|中立|劣於大盤|買進|賣出|持有)\s*(?:->|至|到)\s*(優於大盤|中立|劣於大盤|買進|賣出|持有)/i;
    var twMatch = text.match(twPattern);
    
    if (twMatch && market === "TW") {
      return {
        from_grade: twMatch[1] || null,
        to_grade: twMatch[2] || null
      };
    }
    
    return { from_grade: null, to_grade: null };
  } catch (e) {
    return { from_grade: null, to_grade: null };
  }
}

/**
 * 輔助：Finviz 日期解析 (Jan-15-26 -> Date)
 *
 * @param {string} dateStr - Finviz 日期格式（如 "Jan-15-26"）
 * @return {string} ISO 日期字串（如 "2026-01-15"）
 */
function parseFinvizDate(dateStr) {
  try {
    var parts = dateStr.split("-"); // [Jan, 15, 26]
    if (parts.length !== 3) return dateStr;
    
    var monthMap = {"Jan":0, "Feb":1, "Mar":2, "Apr":3, "May":4, "Jun":5, "Jul":6, "Aug":7, "Sep":8, "Oct":9, "Nov":10, "Dec":11};
    var monthName = parts[0];
    if (!monthMap.hasOwnProperty(monthName)) return dateStr;
    
    var year = 2000 + parseInt(parts[2]);
    var month = monthMap[monthName];
    var day = parseInt(parts[1]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
    
    var d = new Date(year, month, day);
    if (isNaN(d.getTime())) return dateStr;
    
    return d.toISOString().split('T')[0];
  } catch (e) {
    Logger.log(`P5 Weekly：⚠️ parseFinvizDate 失敗（${dateStr}）：${e.message}`);
    return dateStr;
  }
}

/**
 * 取得 Yahoo「Upgrades & Downgrades」並計算 impliedFPE
 * - V8.6 更新：優先使用歷史評級挖掘機（Finviz/Yahoo HTML JSON）
 * - 若需要 Forward EPS，仍嘗試從 quoteSummary 取得（失敗則用 HTML 解析）
 * - 用共識 Forward EPS（Next Year/+1y）計算 impliedFPE = targetPrice / forwardEPS
 *
 * @param {string} yahooTicker - Yahoo ticker（如 AAPL, 2330.TW, 7203.T）
 * @param {string|null} market - 市場（US/TW/JP）
 * @return {Object|null}
 */
function getInstitutionalSentimentFromYahoo(yahooTicker, market = null) {
  const m = market || inferMarketFromYahooTicker(yahooTicker);
  
  // V8.6：先嘗試歷史評級挖掘機（Finviz/Yahoo HTML JSON）
  var baseTicker = yahooTicker;
  if (m === "TW") baseTicker = baseTicker.replace(".TW", "");
  else if (m === "JP") baseTicker = baseTicker.replace(".T", "");
  
  var historicalData = getHistoricalRatings(baseTicker, m);
  var actions = historicalData && historicalData.history ? historicalData.history : [];
  
  // 嘗試從 quoteSummary 取得 Forward EPS（失敗則用 HTML 解析作為備用）
  var forwardEPS = null;
  var forwardPE = null;
  var currentPriceYahoo = null;
  
  const qs = fetchYahooQuoteSummarySafe(yahooTicker, ["price", "defaultKeyStatistics", "financialData", "earningsTrend"]);
  if (qs) {
    forwardEPS = extractConsensusForwardEPSFromQuoteSummary(qs);
    forwardPE = extractConsensusForwardPEFromQuoteSummary(qs);
    currentPriceYahoo = extractCurrentPriceFromQuoteSummary(qs);
  }
  
  // 若 quoteSummary 失敗，從 HTML 解析 Forward EPS（備用方案，較不準確）
  if (!forwardEPS) {
    Logger.log(`P5 Weekly：⚠️ QuoteSummary 無 Forward EPS，嘗試從 HTML 解析（${yahooTicker}）`);
    // TODO: 實作 HTML 解析 Forward EPS（如果需要）
    // forwardEPS = extractForwardEPSFromYahooHTML(yahooTicker);
  }
  
  // 計算每個 action 的 impliedFPE
  var actionsWithImpliedFPE = [];
  for (var i = 0; i < actions.length; i++) {
    var action = actions[i];
    var toPrice = action.to_price || null;
    var impliedFPE = null;
    
    if (forwardEPS && typeof forwardEPS.value === "number" && forwardEPS.value > 0 && typeof toPrice === "number" && toPrice > 0) {
      impliedFPE = toPrice / forwardEPS.value;
    }
    
    actionsWithImpliedFPE.push({
      date: action.date,
      epoch: action.epoch || null,
      firm: action.firm,
      action: action.action,
      from_grade: action.from_grade,
      to_grade: action.to_grade,
      from_price: action.from_price,
      to_price: toPrice,
      target_change: action.target_change || null,
      implied_fpe: (typeof impliedFPE === "number" && impliedFPE > 0 ? impliedFPE : null)
    });
  }
  
  var sentimentLabel = historicalData && historicalData.sentiment_label ? historicalData.sentiment_label : "N/A";
  var warnings = historicalData && historicalData.warnings ? historicalData.warnings : null;
  
  Logger.log(`P5 Weekly：InstitutionalSentiment ${yahooTicker}：source=${historicalData ? historicalData.source : "UNKNOWN"}, actions=${actionsWithImpliedFPE.length}, forwardEPS=${forwardEPS ? forwardEPS.value : "null"} (${forwardEPS ? forwardEPS.period : "n/a"}), sentiment=${sentimentLabel}${warnings ? `, ⚠️ WARNINGS: ${warnings}` : ""}`);

  return {
    yahoo_ticker: yahooTicker,
    market: m,
    source: historicalData ? historicalData.source : "UNKNOWN",
    consensus_forward_eps: forwardEPS ? forwardEPS.value : null,
    consensus_forward_eps_period: forwardEPS ? forwardEPS.period : null,
    consensus_forward_eps_source: forwardEPS ? forwardEPS.source : null,
    consensus_forward_pe: forwardPE ? forwardPE.value : null,
    consensus_forward_pe_source: forwardPE ? forwardPE.source : null,
    current_price_yahoo: currentPriceYahoo,
    sentiment_score: historicalData ? historicalData.sentiment_score : null,
    sentiment_label: sentimentLabel,
    warnings: warnings, // V8.6 新增：誘多/誘空警告訊號
    actions: actionsWithImpliedFPE,
    total_records: actionsWithImpliedFPE.length
  };
}

/**
 * 從 Yahoo Finance Analysis 頁面抓取 FPE_B（分析師共識 Forward P/E）
 * 
 * ⚠️ 重要說明：
 * 1. **數據來源**：Yahoo Finance Analysis 頁面
 *    - 目標：獲取「分析師共識的 Forward P/E」（多個分析師的平均值）
 *    - 優先：如果 Yahoo Finance 直接提供 Forward P/E，直接提取
 *    - 備用：如果只提供 EPS 預估，則計算 FPE_B = Current Price / Next Year Avg. Estimate EPS
 * 2. **搜尋方法**：使用爬蟲（UrlFetchApp），不是 CSE
 * 
 * @param {string} yahooTicker - Yahoo Finance 股票代碼（例如：AAPL, 2330.TW, 7203.T）
 * @return {number|null} FPE_B 值，如果無法獲取則返回 null
 */
function getFPE_B_FromYahooFinance(yahooTicker, market = null) {
  const m = market || inferMarketFromYahooTicker(yahooTicker);

  // ✅ 以 QuoteSummary JSON 為主（不爬 HTML、不走 CSE、不用財報狗）
  const qs = fetchYahooQuoteSummarySafe(yahooTicker, ["price", "defaultKeyStatistics", "financialData", "earningsTrend"]);
  if (!qs) {
    Logger.log(`P5 Weekly FPE_B：QuoteSummary 無法取得（${yahooTicker}）`);
    return null;
  }

  // 1) 直接拿 Forward P/E（若 Yahoo 有提供）
  const forwardPE = extractConsensusForwardPEFromQuoteSummary(qs);
  if (forwardPE && typeof forwardPE.value === "number" && forwardPE.value > 0) {
    Logger.log(`P5 Weekly FPE_B：✅ 直接取得分析師共識 Forward P/E = ${forwardPE.value.toFixed(2)}（來源：${forwardPE.source}）`);
    return forwardPE.value;
  }

  // 2) 沒有 Forward P/E → 用「共識 Forward EPS（Next Year/+1y）」計算（需股價）
  const forwardEPS = extractConsensusForwardEPSFromQuoteSummary(qs);
  if (!forwardEPS || typeof forwardEPS.value !== "number" || forwardEPS.value <= 0) {
    Logger.log(`P5 Weekly FPE_B：⚠️ 無法取得共識 Forward EPS（${yahooTicker}），返回 null`);
    return null;
  }

  Logger.log(`P5 Weekly FPE_B：Forward EPS（分析師共識預估）= ${forwardEPS.value.toFixed(2)}，period=${forwardEPS.period || "n/a"}，來源=${forwardEPS.source}`);

  // 股價：優先 GOOGLEFINANCE（依你的要求），失敗才用 Yahoo price
  let currentPrice = null;
  const googleTicker = convertYahooTickerToGoogleTicker(yahooTicker, m);
  if (googleTicker && typeof fetchGoogleFinanceSafe === "function") {
    const gv = fetchGoogleFinanceSafe(googleTicker, "price");
    if (typeof gv === "number" && gv > 0) {
      currentPrice = gv;
      Logger.log(`P5 Weekly FPE_B：股價來源=GOOGLEFINANCE（${googleTicker}） price=${currentPrice.toFixed(2)}`);
    }
  }
  if (!currentPrice) {
    currentPrice = extractCurrentPriceFromQuoteSummary(qs);
    if (currentPrice) {
      Logger.log(`P5 Weekly FPE_B：股價來源=Yahoo QuoteSummary regularMarketPrice=${currentPrice.toFixed(2)}（Google 失敗/不可用時備用）`);
    }
  }

  if (!currentPrice || currentPrice <= 0) {
    Logger.log(`P5 Weekly FPE_B：⚠️ 無法取得股價（${yahooTicker}），返回 null`);
    return null;
  }

  const computed = currentPrice / forwardEPS.value;
  Logger.log(`P5 Weekly FPE_B：⚠️ 計算值（非直接共識倍數）FPE_B = price/forwardEPS = ${currentPrice.toFixed(2)} / ${forwardEPS.value.toFixed(2)} = ${computed.toFixed(2)}`);
  return computed;
}

/**
 * 從財報狗獲取 FPE_B（備用方案）
 * @param {string} yahooTicker - Yahoo Finance 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @return {number|null} FPE_B，如果無法獲取則返回 null
 */
function getFPE_B_FromStatementDog(yahooTicker, market) {
  try {
    // 財報狗主要支援美股和台股
    if (market !== "US" && market !== "TW") {
      Logger.log(`P5 Weekly FPE_B：財報狗不支援 ${market} 市場，跳過`);
      return null;
    }
    
    Logger.log(`P5 Weekly FPE_B：開始從財報狗獲取 FPE_B：ticker=${yahooTicker}, market=${market}`);
    
    // 使用 CSE 搜尋財報狗
    const cseType = "P2_US_TAIWAN";  // 財報狗 CSE
    const tickerForSearch = market === "TW" ? yahooTicker.replace(".TW", "") : yahooTicker;
    const query = `${tickerForSearch} 財報狗 Forward P/E 本益比`;
    
    Logger.log(`P5 Weekly FPE_B：CSE 搜尋：query="${query}", cseType=${cseType}`);
    
    // 調用 CSE 搜尋（需要 jobId, step, payload 三個參數）
    const jobId = `P5_FPE_B_STATEMENTDOG_${yahooTicker}_${Date.now()}`;
    const step = "CSE_SEARCH";
    const payload = {
      search_query: query,
      cse_type: cseType,
      max_results: 5
    };
    
    const cseResults = executeCSESearch(jobId, step, payload);
    
    if (!cseResults || !cseResults.output || !cseResults.output.search_results || cseResults.output.search_results.length === 0) {
      Logger.log(`P5 Weekly FPE_B：財報狗 CSE 搜尋無結果`);
      return null;
    }
    
    const searchResults = cseResults.output.search_results || [];
    Logger.log(`P5 Weekly FPE_B：財報狗 CSE 搜尋找到 ${searchResults.length} 筆結果`);
    
    // 從搜尋結果中提取 Forward P/E
    // 財報狗的 Forward P/E 通常在頁面中以「本益比」、「Forward P/E」、「預估本益比」等形式出現
    for (const result of searchResults) {
      if (result.link && result.link.includes("statementdog.com")) {
        // 嘗試從 snippet 或 title 中提取 Forward P/E
        const text = (result.snippet || result.title || "").toLowerCase();
        
        // 匹配 Forward P/E 相關的數字（例如：本益比 25.5、Forward P/E 28.3）
        const fpePatterns = [
          /(?:本益比|forward\s*p\/e|預估本益比)[：:：\s]*(\d+\.?\d*)/i,
          /(\d+\.?\d*)\s*(?:倍|倍數)?\s*(?:本益比|p\/e)/i,
          /p\/e[：:：\s]*(\d+\.?\d*)/i
        ];
        
        for (const pattern of fpePatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const fpeB = parseFloat(match[1]);
            if (!isNaN(fpeB) && fpeB > 0 && fpeB < 1000) {
              Logger.log(`P5 Weekly FPE_B：從財報狗提取 FPE_B = ${fpeB.toFixed(2)}（來源：${result.link}）`);
              return fpeB;
            }
          }
        }
      }
    }
    
    Logger.log(`P5 Weekly FPE_B：無法從財報狗搜尋結果中提取 Forward P/E`);
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly FPE_B：從財報狗獲取 FPE_B 失敗：${error.message}`);
    return null;
  }
}

/**
 * 優先嘗試直接提取 Yahoo Finance 提供的 Forward P/E
 * @param {string} html - HTML 內容
 * @return {number|null} Forward P/E 值，如果無法獲取則返回 null
 */
function parseYahooForwardPE(html) {
  try {
    // ⭐ FPE_B 應該優先使用分析師共識的 Forward P/E，而不是用股價計算
    
    // 方法 1：匹配 JSON 數據中的 forwardPE（分析師共識 Forward P/E）
    // 優先使用 quoteSummaryStore 或 root.App.main 中的 forwardPE
    const forwardPEPattern1 = /"quoteSummaryStore":\s*\{[^}]*"forwardPE":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match1 = html.match(forwardPEPattern1);
    if (match1 && match1[1]) {
      const forwardPE = parseFloat(match1[1]);
      if (!isNaN(forwardPE) && forwardPE > 0) {
        Logger.log(`P5 Weekly FPE_B：從 quoteSummaryStore 成功提取分析師共識 Forward P/E = ${forwardPE.toFixed(2)}`);
        return forwardPE;
      }
    }
    
    // 方法 2：匹配 root.App.main 中的 forwardPE
    const forwardPEPattern2 = /root\.App\.main\s*=\s*\{[^}]*"forwardPE":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match2 = html.match(forwardPEPattern2);
    if (match2 && match2[1]) {
      const forwardPE = parseFloat(match2[1]);
      if (!isNaN(forwardPE) && forwardPE > 0) {
        Logger.log(`P5 Weekly FPE_B：從 root.App.main 成功提取分析師共識 Forward P/E = ${forwardPE.toFixed(2)}`);
        return forwardPE;
      }
    }
    
    // 方法 3：匹配 JSON 數據中的 forwardPE（簡單格式）
    const forwardPEPattern3 = /"forwardPE":\s*([\d.]+)/i;
    const match3 = html.match(forwardPEPattern3);
    if (match3 && match3[1]) {
      const forwardPE = parseFloat(match3[1]);
      if (!isNaN(forwardPE) && forwardPE > 0) {
        Logger.log(`P5 Weekly FPE_B：從 JSON 成功提取 Forward P/E = ${forwardPE.toFixed(2)}`);
        return forwardPE;
      }
    }
    
    // 方法 4：匹配表格中的 Forward P/E（Analysis 頁面的表格）
    const tablePattern = /Forward\s+P\/E[\s\S]{0,200}?<td[^>]*>([\d.]+)<\/td>/i;
    const tableMatch = html.match(tablePattern);
    if (tableMatch && tableMatch[1]) {
      const forwardPE = parseFloat(tableMatch[1]);
      if (!isNaN(forwardPE) && forwardPE > 0) {
        Logger.log(`P5 Weekly FPE_B：從表格成功提取 Forward P/E = ${forwardPE.toFixed(2)}`);
        return forwardPE;
      }
    }
    
    // 方法 5：嘗試從 analysis 頁面的 JSON 數據中提取
    const analysisPattern = /"analysis":\s*\{[^}]*"forwardPE":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const analysisMatch = html.match(analysisPattern);
    if (analysisMatch && analysisMatch[1]) {
      const forwardPE = parseFloat(analysisMatch[1]);
      if (!isNaN(forwardPE) && forwardPE > 0) {
        Logger.log(`P5 Weekly FPE_B：從 analysis JSON 成功提取 Forward P/E = ${forwardPE.toFixed(2)}`);
        return forwardPE;
      }
    }
    
    Logger.log(`P5 Weekly FPE_B：無法直接提取分析師共識 Forward P/E（已嘗試 5 種方法），將使用備用方案（從 EPS 計算）`);
    return null;
  } catch (error) {
    Logger.log(`P5 Weekly FPE_B：解析 Forward P/E 失敗，錯誤：${error.message}`);
    return null;
  }
}

/**
 * 解析 Yahoo Finance Analysis 頁面，提取 Next Year 的「分析師共識預估 EPS」（Avg. Estimate）
 * @param {string} html - HTML 內容
 * @return {number|null} 分析師共識預估 EPS，如果無法獲取則返回 null
 */
function parseYahooAnalysisPage(html) {
  try {
    // 方法 1：使用正則表達式匹配 "Next Year" 行中的數值
    const nextYearPattern = /Next\s+Year[\s\S]{0,500}?Avg\.\s+Estimate[\s\S]{0,200}?<td[^>]*>([\d,]+\.?\d*)<\/td>/i;
    const match = html.match(nextYearPattern);
    
    if (match && match[1]) {
      const epsValue = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(epsValue) && epsValue > 0) {
        Logger.log(`P5 Weekly FPE_B：成功解析 EPS = ${epsValue}`);
        return epsValue;
      }
    }
    
    // 方法 2：嘗試匹配 JSON 數據
    const jsonPattern = /"earningsEstimate":\s*\{[^}]*"nextYear":\s*\{[^}]*"avg":\s*([\d.]+)/i;
    const jsonMatch = html.match(jsonPattern);
    
    if (jsonMatch && jsonMatch[1]) {
      const epsValue = parseFloat(jsonMatch[1]);
      if (!isNaN(epsValue) && epsValue > 0) {
        Logger.log(`P5 Weekly FPE_B：從 JSON 成功解析 EPS = ${epsValue}`);
        return epsValue;
      }
    }
    
    Logger.log(`P5 Weekly FPE_B：無法解析 Next Year 的 Avg. Estimate EPS`);
    return null;
  } catch (error) {
    Logger.log(`P5 Weekly FPE_B：解析 Analysis 頁面失敗，錯誤：${error.message}`);
    return null;
  }
}

/**
 * 獲取當前股價（從 Yahoo Finance Summary 頁面）
 * @param {string} yahooTicker - Yahoo Finance 股票代碼
 * @return {number|null} 當前股價，如果無法獲取則返回 null
 */
function getCurrentPriceFromYahoo(yahooTicker) {
  Logger.log(`P5 Weekly FPE_B：開始從 Yahoo Finance Summary 頁面獲取 ${yahooTicker} 股價`);
  
  // 重試機制（最多 3 次）
  const maxRetries = 3;
  let retryCount = 0;
  let response = null;
  let html = null;
  
  const url = `https://finance.yahoo.com/quote/${yahooTicker}`;
  Logger.log(`P5 Weekly FPE_B：股價獲取 URL = ${url}`);
  
  while (retryCount < maxRetries) {
    try {
      // 使用更真實的 User-Agent 和請求頭（與主函數一致）
      response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      const statusCode = response.getResponseCode();
      
      // 處理響應
      if (statusCode === 200) {
        // 成功，獲取 HTML
        html = response.getContentText();
        break;
      } else if (statusCode === 503 || statusCode === 429) {
        // 服務不可用或請求過多，等待後重試
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = Math.min(2000 * retryCount, 10000); // 指數退避，最多 10 秒
          Logger.log(`P5 Weekly FPE_B：股價獲取返回 HTTP ${statusCode}，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
          Utilities.sleep(delay);
          continue;
        } else {
          Logger.log(`P5 Weekly FPE_B：無法獲取 ${yahooTicker} 的股價，HTTP ${statusCode}（已重試 ${retryCount} 次）`);
          return null;
        }
      } else {
        // 其他錯誤，直接返回
        Logger.log(`P5 Weekly FPE_B：無法獲取 ${yahooTicker} 的股價，HTTP ${statusCode}`);
        return null;
      }
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * retryCount, 10000);
        Logger.log(`P5 Weekly FPE_B：股價獲取異常，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
        Utilities.sleep(delay);
        continue;
      } else {
        Logger.log(`P5 Weekly FPE_B：獲取股價失敗（已重試 ${retryCount} 次），${yahooTicker}，錯誤：${error.message}`);
        return null;
      }
    }
  }
  
  // 如果重試失敗或沒有 HTML，返回 null
  if (!html || retryCount >= maxRetries) {
    return null;
  }
  
  try {
    // 嘗試多種方式提取股價（按優先順序）
    
    // 方法 1：JSON 數據中的 regularMarketPrice（最可靠）
    // ⚠️ 注意：Yahoo Finance 的 JSON 結構可能包含多個 regularMarketPrice，需要找到正確的那個
    // 優先匹配 quoteSummaryStore 或 root.App.main 中的 regularMarketPrice（這些是當前股票的價格）
    const pricePattern1 = /"quoteSummaryStore":\s*\{[^}]*"regularMarketPrice":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match1a = html.match(pricePattern1);
    if (match1a && match1a[1]) {
      const price = parseFloat(match1a[1]);
      if (!isNaN(price) && price > 0 && price < 100000) {  // 添加合理性檢查（股價不應該超過 10 萬）
        Logger.log(`P5 Weekly FPE_B：從 quoteSummaryStore regularMarketPrice 提取股價 = ${price.toFixed(2)}`);
        return price;
      }
    }
    
    // 備用：匹配 root.App.main 中的 regularMarketPrice
    const pricePattern1b = /root\.App\.main\s*=\s*\{[^}]*"regularMarketPrice":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match1b = html.match(pricePattern1b);
    if (match1b && match1b[1]) {
      const price = parseFloat(match1b[1]);
      if (!isNaN(price) && price > 0 && price < 100000) {  // 添加合理性檢查
        Logger.log(`P5 Weekly FPE_B：從 root.App.main regularMarketPrice 提取股價 = ${price.toFixed(2)}`);
        return price;
      }
    }
    
    // 最後備用：匹配任何 regularMarketPrice（但需要合理性檢查和更嚴格的驗證）
    // ⚠️ 問題：32.64 可能是從錯誤的位置提取的，需要更精確的匹配
    // 嘗試匹配 quoteSummary.result[0].price 或其他更具體的結構
    const pricePattern1c_moreSpecific = /"quoteSummary":\s*\{[^}]*"result":\s*\[[^\]]*\{[^}]*"regularMarketPrice":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match1c_specific = html.match(pricePattern1c_moreSpecific);
    if (match1c_specific && match1c_specific[1]) {
      const price = parseFloat(match1c_specific[1]);
      if (!isNaN(price) && price > 0 && price < 100000 && price > 1) {  // 添加最低價格檢查（股價應該 > 1）
        Logger.log(`P5 Weekly FPE_B：從 quoteSummary.result regularMarketPrice 提取股價 = ${price.toFixed(2)}`);
        return price;
      }
    }
    
    // 最後備用：匹配任何 regularMarketPrice（但需要更嚴格的合理性檢查）
    const pricePattern1c = /"regularMarketPrice":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const allMatches = html.match(new RegExp(pricePattern1c.source, 'gi'));  // 全局匹配，找出所有可能的價格
    
    if (allMatches && allMatches.length > 0) {
      // 提取所有價格值
      const allPrices = [];
      for (const match of allMatches) {
        const priceMatch = match.match(/"raw":\s*([\d.]+)/i);
        if (priceMatch && priceMatch[1]) {
          const price = parseFloat(priceMatch[1]);
          if (!isNaN(price) && price > 0 && price < 100000 && price > 1) {
            allPrices.push(price);
          }
        }
      }
      
      // 如果有多個價格，選擇最大的（通常當前股價會是較大的值）
      if (allPrices.length > 0) {
        const maxPrice = Math.max(...allPrices);
        // 但如果所有股票都返回相同的價格（例如 32.64），這可能是錯誤的
        // 添加額外檢查：如果價格在 10-100 之間且所有股票都是這個值，可能是錯誤匹配
        Logger.log(`P5 Weekly FPE_B：找到 ${allPrices.length} 個可能的價格值：${allPrices.map(p => p.toFixed(2)).join(', ')}，選擇最大值 = ${maxPrice.toFixed(2)}`);
        return maxPrice;
      }
    }
    
    // 方法 2：JSON 數據中的 currentPrice（備用）
    const pricePattern2 = /"currentPrice":\s*\{[^}]*"raw":\s*([\d.]+)/i;
    const match2 = html.match(pricePattern2);
    if (match2 && match2[1]) {
      const price = parseFloat(match2[1]);
      // ⚠️ 添加合理性檢查：股價應該在合理範圍內（0.01 到 100000）
      if (!isNaN(price) && price > 0 && price < 100000) {
        Logger.log(`P5 Weekly FPE_B：從 JSON currentPrice 提取股價 = ${price.toFixed(2)}（已通過合理性檢查）`);
        return price;
      } else {
        Logger.log(`P5 Weekly FPE_B：⚠️ 從 JSON currentPrice 提取的股價 ${price.toFixed(2)} 不合理（超出範圍 0.01-100000），跳過此方法`);
      }
    }
    
    // 方法 3：fin-streamer 標籤（data-price）
    const pricePattern3 = /<fin-streamer[^>]*data-field="regularMarketPrice"[^>]*data-price="([\d.]+)"/i;
    const match3 = html.match(pricePattern3);
    if (match3 && match3[1]) {
      const price = parseFloat(match3[1]);
      if (!isNaN(price) && price > 0 && price < 100000) {  // 添加合理性檢查
        Logger.log(`P5 Weekly FPE_B：從 fin-streamer data-price 提取股價 = ${price.toFixed(2)}（已通過合理性檢查）`);
        return price;
      } else {
        Logger.log(`P5 Weekly FPE_B：⚠️ 從 fin-streamer data-price 提取的股價 ${price.toFixed(2)} 不合理，跳過此方法`);
      }
    }
    
    // 方法 4：fin-streamer 標籤（value）
    const pricePattern4 = /<fin-streamer[^>]*data-field="regularMarketPrice"[^>]*value="([\d.]+)"/i;
    const match4 = html.match(pricePattern4);
    if (match4 && match4[1]) {
      const price = parseFloat(match4[1]);
      if (!isNaN(price) && price > 0 && price < 100000) {  // 添加合理性檢查
        Logger.log(`P5 Weekly FPE_B：從 fin-streamer value 提取股價 = ${price.toFixed(2)}（已通過合理性檢查）`);
        return price;
      } else {
        Logger.log(`P5 Weekly FPE_B：⚠️ 從 fin-streamer value 提取的股價 ${price.toFixed(2)} 不合理，跳過此方法`);
      }
    }
    
    // 方法 5：嘗試從 quoteSummaryStore 中提取（已在方法 1 中處理，這裡作為備用）
    // 注意：方法 1 已經優先匹配 quoteSummaryStore，這裡不需要重複
    
    // 方法 6：嘗試從 root.App.main 中提取（已在方法 1 中處理，這裡作為備用）
    // 注意：方法 1 已經優先匹配 root.App.main，這裡不需要重複
    
    // 如果所有方法都失敗，記錄詳細信息以便調試
    Logger.log(`P5 Weekly FPE_B：無法從 ${yahooTicker} 的 Summary 頁面提取股價（已嘗試多種方法）`);
    Logger.log(`P5 Weekly FPE_B：⚠️ 所有提取方法都失敗或返回不合理的價格值`);
    Logger.log(`P5 Weekly FPE_B：HTML 長度 = ${html.length}，前 1000 字元：${html.substring(0, 1000)}`);
    Logger.log(`P5 Weekly FPE_B：建議檢查 Yahoo Finance 的 HTML 結構是否改變，或嘗試使用其他數據源`);
    
    // ⭐ 備用方案：從財報狗獲取 FPE_B
    Logger.log(`P5 Weekly FPE_B：嘗試從財報狗獲取 FPE_B（備用方案）`);
    const fpeBFromStatementDog = getFPE_B_FromStatementDog(yahooTicker, market);
    if (fpeBFromStatementDog && fpeBFromStatementDog > 0) {
      Logger.log(`P5 Weekly FPE_B：成功從財報狗獲取 FPE_B = ${fpeBFromStatementDog.toFixed(2)}`);
      return fpeBFromStatementDog;
    }
    
    return null;
  } catch (error) {
    Logger.log(`P5 Weekly FPE_B：獲取股價失敗，${yahooTicker}，錯誤：${error.message}`);
    return null;
  }
}

// ==========================================
// 市場情緒指標收集主函數
// ==========================================

/**
 * 收集市場情緒指標（FPE_B）
 * 
 * @param {Array<string>} tickers - 股票代碼列表
 * @param {Object} tickerMarkets - ticker 到 market 的映射（例如：{"AAPL": "US", "2330": "TW"}）
 * @return {Object} 市場情緒指標數據
 */
function collectMarketSentimentIndicators(tickers, tickerMarkets) {
  const sentimentData = {
    fpe_b: {},
    institutional_sentiment: {}, // V8.6 新增：機構言行一致性分析
    date: new Date()
  };
  
  Logger.log(`P5 Weekly：開始收集市場情緒指標（${tickers.length} 個股票）`);
  
  // 收集每個股票的 FPE_B 和機構評級
  for (const ticker of tickers) {
    try {
      const market = tickerMarkets && tickerMarkets[ticker] ? tickerMarkets[ticker] : "US";
      const yahooTicker = convertTickerToYahooFormat(ticker, market);
      
      // 1. 收集 FPE_B
      const fpeB = getFPE_B_FromYahooFinance(yahooTicker, market);
      
      if (fpeB && fpeB > 0) {
        sentimentData.fpe_b[ticker] = {
          value: fpeB,
          market: market,
          yahoo_ticker: yahooTicker
        };
        
        // 存儲到 SMART_MONEY_DAILY 表格
        saveMarketSentimentToSheet(ticker, market, fpeB);
        
        Logger.log(`P5 Weekly：成功收集 ${ticker} 的 FPE_B = ${fpeB.toFixed(2)}`);
      } else {
        Logger.log(`P5 Weekly：無法收集 ${ticker} 的 FPE_B`);
      }
      
      // 2. ⭐ V8.9 升級：收集機構言行一致性分析（優先從資料庫讀取）
      try {
        let institutionalData = null;
        
        // 優先從資料庫讀取（只讀取最近 1 個月的評級，符合去重邏輯）
        if (typeof getInstitutionalRatingsFromDatabase === "function") {
          const ratingsFromDB = getInstitutionalRatingsFromDatabase(ticker, market, 1);
          
          if (ratingsFromDB && ratingsFromDB.length > 0) {
            // 從資料庫評級重新計算 sentiment
            institutionalData = analyzeSmartSentiment(ratingsFromDB, ticker, market);
            institutionalData.source = "DATABASE";
            institutionalData.actions = ratingsFromDB;
            institutionalData.total_records = ratingsFromDB.length;
            
            Logger.log(`P5 Weekly：從資料庫讀取 ${ticker} 的機構評級（${ratingsFromDB.length} 筆）`);
          }
        }
        
        // 如果資料庫沒有，使用直接抓取（保持向後兼容）
        if (!institutionalData || !institutionalData.sentiment_label) {
          institutionalData = getInstitutionalSentimentFromYahoo(yahooTicker, market);
        }
        
        if (institutionalData && (institutionalData.actions && institutionalData.actions.length > 0 || institutionalData.sentiment_label)) {
          sentimentData.institutional_sentiment[ticker] = {
            market: market,
            yahoo_ticker: yahooTicker,
            source: institutionalData.source || "UNKNOWN",
            sentiment_score: institutionalData.sentiment_score,
            sentiment_label: institutionalData.sentiment_label, // STRONG_BULL / BULLISH / NEUTRAL / BEARISH / STRONG_BEAR
            warnings: institutionalData.warnings, // 誘多/誘空警告訊號
            consensus_forward_eps: institutionalData.consensus_forward_eps,
            consensus_forward_eps_period: institutionalData.consensus_forward_eps_period,
            consensus_forward_pe: institutionalData.consensus_forward_pe,
            actions_count: institutionalData.total_records || (institutionalData.actions ? institutionalData.actions.length : 0),
            latest_actions: institutionalData.actions ? institutionalData.actions.slice(0, 5) : [] // 只保留最近 5 筆
          };
          
          Logger.log(`P5 Weekly：成功收集 ${ticker} 的機構評級（sentiment=${institutionalData.sentiment_label}, actions=${institutionalData.total_records || (institutionalData.actions ? institutionalData.actions.length : 0)}${institutionalData.warnings ? `, ⚠️ WARNINGS: ${institutionalData.warnings}` : ""}）`);
        } else {
          Logger.log(`P5 Weekly：無法收集 ${ticker} 的機構評級（可能無分析師覆蓋或數據源失敗）`);
        }
      } catch (instError) {
        Logger.log(`P5 Weekly：收集 ${ticker} 的機構評級失敗：${instError.message}`);
      }
      
      // 避免請求過快
      Utilities.sleep(1500); // 稍微延長，因為現在要抓兩個數據源
      
    } catch (error) {
      Logger.log(`P5 Weekly：收集 ${ticker} 的市場情緒指標失敗：${error.message}`);
    }
  }
  
  const fpeBCount = Object.keys(sentimentData.fpe_b).length;
  const instCount = Object.keys(sentimentData.institutional_sentiment).length;
  
  Logger.log(`P5 Weekly：完成市場情緒指標收集（FPE_B: ${fpeBCount} 個，機構評級: ${instCount} 個）`);
  
  return sentimentData;
}

/**
 * 存儲市場情緒指標到 SMART_MONEY_DAILY 表格
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @param {number|null} fpeB - FPE_B 值
 */
function saveMarketSentimentToSheet(ticker, market, fpeB) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SMART_MONEY_DAILY");
    
    if (!sheet) {
      Logger.log("P5 Weekly：SMART_MONEY_DAILY 表格不存在，嘗試創建");
      // TODO: 如果表格不存在，應該通過 initializeSheets() 創建
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 獲取表頭
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dateCol = headers.indexOf("date") + 1;
    const tickerCol = headers.indexOf("ticker") + 1;
    const marketCol = headers.indexOf("market") + 1;
    const fpeBCol = headers.indexOf("fpe_b") + 1;
    const createdAtCol = headers.indexOf("created_at") + 1;
    
    if (dateCol === 0 || tickerCol === 0) {
      Logger.log("P5 Weekly：SMART_MONEY_DAILY 表格欄位不完整");
      return;
    }
    
    // 查找是否已有今天的記錄
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    let existingRow = null;
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol - 1]);
      rowDate.setHours(0, 0, 0, 0);
      if (rowDate.getTime() === today.getTime() && rows[i][tickerCol - 1] === ticker) {
        existingRow = i + 1;
        break;
      }
    }
    
    const rowData = [];
    if (dateCol > 0) rowData[dateCol - 1] = today;
    if (tickerCol > 0) rowData[tickerCol - 1] = ticker;
    if (marketCol > 0) rowData[marketCol - 1] = market;
    if (fpeBCol > 0 && fpeB !== null) rowData[fpeBCol - 1] = fpeB;
    if (createdAtCol > 0) rowData[createdAtCol - 1] = new Date();
    
    if (existingRow) {
      // 更新現有記錄
      for (let col = 0; col < rowData.length; col++) {
        if (rowData[col] !== undefined) {
          sheet.getRange(existingRow, col + 1).setValue(rowData[col]);
        }
      }
      Logger.log(`P5 Weekly：更新 SMART_MONEY_DAILY 記錄（ticker=${ticker}, row=${existingRow}）`);
    } else {
      // 新增記錄
      const newRow = [];
      for (let i = 0; i < headers.length; i++) {
        newRow.push(rowData[i] || "");
      }
      sheet.appendRow(newRow);
      Logger.log(`P5 Weekly：新增 SMART_MONEY_DAILY 記錄（ticker=${ticker}）`);
    }
    
  } catch (error) {
    Logger.log(`P5 Weekly：存儲市場情緒指標到表格失敗：${error.message}`);
  }
}
