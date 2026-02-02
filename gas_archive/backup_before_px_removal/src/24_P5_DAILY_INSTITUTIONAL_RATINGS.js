/**
 * 📊 P5 Daily: 機構評級資料收集（V8.9 新增）
 * 
 * 定位：⚠️ 「帶風向面」的資料，用於事後驗證指標（非預先判斷）
 * 
 * 功能：
 * - 使用專屬 CSE（P5_INSTITUTIONAL_RATINGS）收集機構評級新聞
 * - 只收錄有持股的歷史評級（從 Phase1_Master_Candidates 或 Phase2_Output 讀取）
 * - 只追蹤各市場五大龍頭機構
 * - 機構名稱和評級動作標準化（多語支持）
 * - 保存到 INSTITUTIONAL_RATINGS_DAILY 表格（按機構分開存儲，rating_firm 欄位）
 * 
 * ⭐ V8.9 更新：使用 AI 處理流程（與一般新聞一致）
 * - Gemini Flash：原子化清洗（雜訊過濾）
 * - Gemini Pro：多語去重（識別同一事件的不同語言版本）
 * 
 * ⭐ 重要：機構評級按機構分開存儲
 * - 每筆評級都有 rating_firm 欄位（標準化後的機構名稱，如 GOLDMAN_SACHS）
 * - 可以按機構查詢歷史評級（例如：高盛對 AAPL, NVDA, ASML, TSM 的所有評級）
 * - 用於追蹤每個機構的可信度（誠實好寶寶 vs 愛騙人的鬼）
 * 
 * @version V8.9
 * @date 2026-01-18
 * @last_update 2026-01-18 (V8.9 AI 處理流程)
 */

// ==========================================
// 機構白名單配置（各市場五大龍頭機構）
// ==========================================

const INSTITUTIONAL_FIRMS = {
  "US": [
    "Goldman Sachs", "GOLDMAN_SACHS", "高盛",
    "Morgan Stanley", "MORGAN_STANLEY", "摩根士丹利",
    "JPMorgan", "JPMORGAN", "J.P. Morgan", "小摩", "摩根大通",
    "Citi", "CITI", "Citigroup", "花旗",
    "Bank of America", "BANK_OF_AMERICA", "BofA", "美銀",
    "Barclays", "BARCLAYS", "巴克萊"
  ],
  "TW": [
    "Morgan Stanley", "MORGAN_STANLEY", "大摩", "摩根士丹利",
    "JPMorgan", "JPMORGAN", "J.P. Morgan", "小摩", "摩根大通",
    "Goldman Sachs", "GOLDMAN_SACHS", "高盛",
    "Nomura", "NOMURA", "野村",
    "CLSA", "里昂",
    "Macquarie", "MACQUARIE", "麥格理",
    "UBS", "瑞銀"
  ],
  "JP": [
    "Nomura", "NOMURA", "野村證券", "野村",
    "Daiwa", "DAIWA", "大和證券", "大和",
    "SMBC Nikko", "SMBC_NIKKO", "日興證券", "日興",
    "Goldman Sachs Japan", "GOLDMAN_SACHS_JAPAN", "高盛日本",
    "Mizuho", "MIZUHO", "瑞穗",
    "Jefferies", "JEFFERIES"
  ]
};

// ==========================================
// 機構名稱標準化對照表
// ==========================================

const FIRM_NAME_STANDARDIZATION = {
  // 美股
  "Goldman Sachs": "GOLDMAN_SACHS",
  "高盛": "GOLDMAN_SACHS",
  "Morgan Stanley": "MORGAN_STANLEY",
  "摩根士丹利": "MORGAN_STANLEY",
  "JPMorgan": "JPMORGAN",
  "J.P. Morgan": "JPMORGAN",
  "小摩": "JPMORGAN",
  "摩根大通": "JPMORGAN",
  "Citi": "CITI",
  "Citigroup": "CITI",
  "花旗": "CITI",
  "Bank of America": "BANK_OF_AMERICA",
  "BofA": "BANK_OF_AMERICA",
  "美銀": "BANK_OF_AMERICA",
  "Barclays": "BARCLAYS",
  "巴克萊": "BARCLAYS",
  // 台股
  "大摩": "MORGAN_STANLEY",
  "CLSA": "CLSA",
  "里昂": "CLSA",
  "Macquarie": "MACQUARIE",
  "麥格理": "MACQUARIE",
  "UBS": "UBS",
  "瑞銀": "UBS",
  // 日股
  "野村證券": "NOMURA",
  "野村": "NOMURA",
  "大和證券": "DAIWA",
  "大和": "DAIWA",
  "日興證券": "SMBC_NIKKO",
  "日興": "SMBC_NIKKO",
  "高盛日本": "GOLDMAN_SACHS_JAPAN",
  "瑞穗": "MIZUHO"
};

// ==========================================
// 評級動作標準化對照表（多語支持）
// ==========================================

const RATING_ACTION_MAP = {
  "upgrade": {
    "en": ["upgrade", "raise", "lift", "boost", "increase", "improve"],
    "zh": ["調升", "上調", "調高", "上修", "調升評等", "上調評等"],
    "ja": ["引上げ", "引き上げ", "上方修正", "引き上げる"]
  },
  "downgrade": {
    "en": ["downgrade", "cut", "lower", "reduce", "decrease"],
    "zh": ["調降", "下調", "調低", "下修", "調降評等", "下調評等"],
    "ja": ["引下げ", "引き下げ", "下方修正", "引き下げる"]
  },
  "maintain": {
    "en": ["maintain", "reiterate", "keep", "hold", "unchanged"],
    "zh": ["維持", "重申", "保持", "不變"],
    "ja": ["維持", "据え置き", "変更なし"]
  },
  "initiate": {
    "en": ["initiate", "start", "begin", "cover", "new coverage"],
    "zh": ["初始", "開始", "首次", "新覆蓋"],
    "ja": ["開始", "新規", "初回"]
  }
};

// ==========================================
// 核心函數
// ==========================================

/**
 * 收集機構評級資料（P5 Daily 主函數）
 * 
 * @return {Object} 收集結果
 */
/**
 * 收集機構評級資料
 * ⭐ V8.12 更新：支持測試模式（接受testTickers參數，不限制時效性）
 * 
 * @param {Object} options - 選項
 *   - testTickers: Array - 測試用的股票代碼列表（格式：[{ticker: "NVDA", market: "US"}, ...]）
 *   - isTestMode: boolean - 是否為測試模式（測試時不限制時效性）
 * @returns {Object} 收集結果
 */
function collectInstitutionalRatings(options = {}) {
  Logger.log(`P5 Daily：開始收集機構評級資料（V8.9${options.isTestMode ? " [測試模式]" : ""}）`);
  
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  try {
    // 1. 讀取持股清單（測試模式使用傳入的testTickers）
    let holdings;
    if (options.isTestMode && options.testTickers && options.testTickers.length > 0) {
      Logger.log(`P5 Daily：測試模式 - 使用指定的測試ticker列表（${options.testTickers.length} 檔）`);
      holdings = options.testTickers;
    } else {
      holdings = getHoldingsList();
      if (!holdings || holdings.length === 0) {
        Logger.log("P5 Daily：無持股清單，跳過機構評級收集");
        return { success: true, count: 0, message: "無持股清單" };
      }
    }
    
    Logger.log(`P5 Daily：${options.isTestMode ? "測試" : "持股"}清單共 ${holdings.length} 檔，開始收集機構評級`);
    
    // 2. 按市場分組
    const holdingsByMarket = groupHoldingsByMarket(holdings);
    
    // 3. 收集各市場的機構評級
    const allRatings = [];
    
    for (const market in holdingsByMarket) {
      const tickers = holdingsByMarket[market];
      Logger.log(`P5 Daily：收集 ${market} 市場機構評級（${tickers.length} 檔）`);
      
      for (const ticker of tickers) {
        try {
          // ⭐ V8.12 測試模式：傳遞isTestMode參數給collectRatingsForTicker
          const ratings = collectRatingsForTicker(ticker, market, { isTestMode: options.isTestMode || false });
          if (ratings && ratings.length > 0) {
            allRatings.push(...ratings);
            Logger.log(`P5 Daily：${ticker} (${market}) 收集到 ${ratings.length} 筆機構評級`);
          }
          
          // 避免請求過快
          Utilities.sleep(1500);
        } catch (error) {
          Logger.log(`P5 Daily：收集 ${ticker} (${market}) 機構評級失敗：${error.message}`);
        }
      }
    }
    
    // 4. Gemini Pro 多語去重（替換程式邏輯）⭐ V8.9 更新
    Logger.log(`P5 Daily：開始使用 Gemini Pro 進行多語去重（共 ${allRatings.length} 筆評級事件）`);
    const deduplicatedRatings = deduplicateRatingsWithGeminiPro(allRatings);
    Logger.log(`P5 Daily：多語去重完成，共 ${deduplicatedRatings.length} 筆（去重前 ${allRatings.length} 筆）`);
    
    // 5. 保存到 INSTITUTIONAL_RATINGS_DAILY（按機構分開存儲，rating_firm 欄位）
    const savedCount = saveRatingsToDatabase(deduplicatedRatings);
    
    // ⭐ V8.12 新增：建立個股索引（類似新聞索引）
    // 從deduplicatedRatings中提取ticker，構建索引
    const ratingsByTicker = {};
    for (const rating of deduplicatedRatings) {
      const ticker = rating.ticker;
      if (!ratingsByTicker[ticker]) {
        ratingsByTicker[ticker] = [];
      }
      ratingsByTicker[ticker].push(rating);
    }
    
    Logger.log(`P5 Daily：機構評級收集完成，共 ${savedCount} 筆（去重後）`);
    
    // ⭐ V8.12 新增：返回個股索引資訊
    const tickerIndexInfo = {};
    for (const ticker in ratingsByTicker) {
      tickerIndexInfo[ticker] = ratingsByTicker[ticker].length;
    }
    
    return {
      success: true,
      count: savedCount,
      total_collected: allRatings.length,
      deduplicated: deduplicatedRatings.length,
      tickerIndex: tickerIndexInfo  // ⭐ V8.12 新增：個股索引資訊
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：機構評級收集失敗：${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 讀取持股清單（從 Phase1_Master_Candidates 或 Phase2_Output）
 * ⭐ V8.9 新增：如果沒有持股清單，返回測試用的持股清單
 */
function getHoldingsList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 優先從 Phase2_Output 讀取（更精確）
    let sheet = ss.getSheetByName("Phase2_Output");
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
      const holdings = data.map(row => ({
        ticker: row[1], // Company_Code
        market: row[2]  // Market
      })).filter(item => item.ticker && item.market);
      
      if (holdings.length > 0) {
        return holdings;
      }
    }
    
    // 備用：從 Phase1_Master_Candidates 讀取
    sheet = ss.getSheetByName("Phase1_Master_Candidates");
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
      const holdings = data.map(row => ({
        ticker: row[0], // Company_Code
        market: row[1]  // Market
      })).filter(item => item.ticker && item.market);
      
      if (holdings.length > 0) {
        return holdings;
      }
    }
    
    // ⭐ V8.9 新增：如果沒有持股清單，返回測試用的持股清單（美股台股日股各三個）
    Logger.log("P5 Daily：無持股清單，使用測試用的持股清單");
    return getTestHoldingsList();
    
  } catch (error) {
    Logger.log(`P5 Daily：讀取持股清單失敗：${error.message}，使用測試用的持股清單`);
    return getTestHoldingsList();
  }
}

/**
 * ⭐ V8.9 新增：獲取測試用的持股清單（美股台股日股各三個）
 * 
 * @returns {Array} 測試用的持股清單
 */
function getTestHoldingsList() {
  return [
    // 美股（三個）
    { ticker: "AAPL", market: "US" },
    { ticker: "NVDA", market: "US" },
    { ticker: "TSM", market: "US" },
    // 台股（三個）
    { ticker: "2330", market: "TW" },
    { ticker: "2454", market: "TW" },
    { ticker: "2308", market: "TW" },
    // 日股（三個）
    { ticker: "8035", market: "JP" },
    { ticker: "7203", market: "JP" },
    { ticker: "6758", market: "JP" }
  ];
}

/**
 * 按市場分組持股清單
 */
function groupHoldingsByMarket(holdings) {
  const grouped = { US: [], TW: [], JP: [] };
  
  for (const holding of holdings) {
    const market = holding.market || "US";
    if (grouped[market]) {
      grouped[market].push(holding.ticker);
    }
  }
  
  return grouped;
}

/**
 * 收集單一股票的機構評級
 * ⭐ V8.9 更新：使用 Gemini Flash 原子化清洗 + Gemini Pro 多語去重
 * ⭐ V8.12 更新：支持測試模式（不限制時效性）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @param {Object} options - 選項
 *   - isTestMode: boolean - 是否為測試模式（測試時不限制時效性）
 */
function collectRatingsForTicker(ticker, market, options = {}) {
  const allRawNews = [];
  
  try {
    // Step 1: 構建搜尋查詢（針對不同市場優化）
    const queries = buildRatingQueries(ticker, market);
    
    // Step 2: 使用 CSE 搜尋原始新聞
    const cseType = "P5_INSTITUTIONAL_RATINGS";
    
    for (const query of queries) {
      try {
        const jobId = `INST_RATINGS_${ticker}_${Date.now()}`;
        const payload = {
          search_query: query,
          cse_type: cseType,
          max_results: 10
        };
        
        if (typeof executeCSESearch !== "function") {
          Logger.log(`P5 Daily：⚠️ executeCSESearch 未定義，無法使用 CSE 收集機構評級`);
          break;
        }
        
        const cseResults = executeCSESearch(jobId, "CSE_SEARCH", payload);
        
        if (!cseResults || !cseResults.output || !cseResults.output.search_results) {
          continue;
        }
        
        const searchResults = cseResults.output.search_results || [];
        
        // 收集原始新聞（用於後續 AI 處理）
        for (const result of searchResults) {
          allRawNews.push({
            title: result.title || "",
            snippet: result.snippet || result.description || "",
            link: result.link || "",
            displayLink: result.displayLink || extractSourceFromUrl(result.link) || "",
            ticker: ticker,
            market: market
          });
        }
        
        Utilities.sleep(1000);
        
      } catch (e) {
        Logger.log(`P5 Daily：⚠️ CSE 搜尋失敗（query=${query}）：${e.message}`);
      }
    }
    
    if (allRawNews.length === 0) {
      Logger.log(`P5 Daily：${ticker} (${market}) 未收集到任何新聞`);
      return [];
    }
    
    Logger.log(`P5 Daily：${ticker} (${market}) 收集到 ${allRawNews.length} 筆原始新聞`);
    
    // Step 3: Gemini Flash 原子化清洗（雜訊過濾）
    const atomizedNews = atomizeRatingNewsWithGeminiFlash(allRawNews, ticker, market);
    
    if (!atomizedNews || atomizedNews.length === 0) {
      Logger.log(`P5 Daily：${ticker} (${market}) 原子化清洗後無有效新聞`);
      return [];
    }
    
    Logger.log(`P5 Daily：${ticker} (${market}) 原子化清洗完成，共 ${atomizedNews.length} 筆`);
    
    // Step 4: 程式邏輯提取評級事件（保留，因為格式固定）
    const parsedEvents = [];
    for (const news of atomizedNews) {
      try {
        const parsedEvent = parseNewsTitleForRating(
          news.title || "",
          news.summary || news.snippet || "",
          ticker,
          market,
          news.link || news.url || "",
          news.source || news.displayLink || extractSourceFromUrl(news.link || news.url) || ""
        );
        
        if (parsedEvent && parsedEvent.rating_firm && parsedEvent.rating_action) {
          // 檢查是否為追蹤的機構
          if (isTrackedFirm(parsedEvent.rating_firm, market)) {
            parsedEvents.push(parsedEvent);
          }
        }
      } catch (e) {
        Logger.log(`P5 Daily：⚠️ 解析評級事件失敗（${news.link || "unknown"}）：${e.message}`);
      }
    }
    
    Logger.log(`P5 Daily：${ticker} (${market}) 提取到 ${parsedEvents.length} 筆評級事件`);
    
    return parsedEvents;
    
  } catch (error) {
    Logger.log(`P5 Daily：收集 ${ticker} (${market}) 機構評級失敗：${error.message}`);
    return [];
  }
}

/**
 * 構建機構評級搜尋查詢（針對不同市場優化）
 * ⭐ V8.9 測試版：不要求當日最新，先看白名單CSE內有沒有足夠非當日評級
 * ⚠️ 正式版未來要恢復當日最新要求
 */
function buildRatingQueries(ticker, market) {
  const queries = [];
  
  // ⭐ V8.9 測試版：移除"today"、"今日"等日期限制，允許收集非當日評級
  // ⚠️ 正式版需要恢復：加入"today"、"今日"等日期限制
  
  if (market === "US" || market === "United States") {
    queries.push(`${ticker} upgrade downgrade target price The Fly`);
    queries.push(`${ticker} analyst rating target Goldman Sachs Morgan Stanley Citi`);
    queries.push(`"${ticker}" "target raised" OR "target cut" OR "upgraded" OR "downgraded" site:thefly.com`);
    queries.push(`${ticker} analyst rating StreetInsider Benzinga`);
  } else if (market === "TW" || market === "Taiwan") {
    queries.push(`${ticker} 外資 目標價 調升 調降 鉅亨網`);
    queries.push(`${ticker} 大摩 小摩 目標價 評等 調升`);
    queries.push(`"${ticker}" "目標價" OR "調升" OR "調降" OR "重申" site:anue.com.tw`);
    queries.push(`${ticker} 外資 評等 經濟日報 工商時報`);
  } else if (market === "JP" || market === "Japan") {
    queries.push(`${ticker} レーティング 目標株価 引上げ 引下げ Minkabu`);
    queries.push(`${ticker} 投資判断 目標価格 みんかぶ`);
    queries.push(`${ticker} アナリスト 予想 Kabutan Traders Web`);
  }
  
  return queries;
}

/**
 * 檢查是否為追蹤的機構
 */
function isTrackedFirm(firmName, market) {
  const trackedFirms = INSTITUTIONAL_FIRMS[market] || [];
  const firmNameLower = firmName.toLowerCase();
  
  for (const firm of trackedFirms) {
    if (firmNameLower.indexOf(firm.toLowerCase()) > -1) {
      return true;
    }
  }
  
  return false;
}

/**
 * 標準化機構名稱
 */
function standardizeFirmName(firmName) {
  // 先檢查對照表
  if (FIRM_NAME_STANDARDIZATION[firmName]) {
    return FIRM_NAME_STANDARDIZATION[firmName];
  }
  
  // 模糊匹配
  for (const [key, value] of Object.entries(FIRM_NAME_STANDARDIZATION)) {
    if (firmName.toLowerCase().indexOf(key.toLowerCase()) > -1) {
      return value;
    }
  }
  
  // 如果無法匹配，返回原始名稱的大寫版本（去除空格）
  return firmName.toUpperCase().replace(/\s+/g, "_");
}

/**
 * 標準化評級動作
 */
function standardizeRatingAction(text, language) {
  const lowerText = text.toLowerCase();
  const langMap = {
    "en": "en",
    "zh": "zh",
    "ja": "ja",
    "zh-TW": "zh",
    "zh-CN": "zh"
  };
  const lang = langMap[language] || "en";
  
  // 檢查每個標準動作
  for (const [standardAction, variants] of Object.entries(RATING_ACTION_MAP)) {
    for (const variant of variants[lang] || []) {
      if (lowerText.indexOf(variant.toLowerCase()) > -1) {
        return standardAction.toUpperCase(); // 返回 "UPGRADE", "DOWNGRADE", "MAINTAIN", "INITIATE"
      }
    }
  }
  
  return null; // 無法識別
}

/**
 * ⭐ V8.9 新增：Gemini Flash 原子化清洗（雜訊過濾）
 * 
 * @param {Array} rawNews - 原始新聞列表（CSE 搜尋結果）
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @returns {Array} atomizedNews - 原子化後的新聞列表
 */
function atomizeRatingNewsWithGeminiFlash(rawNews, ticker, market) {
  if (!rawNews || rawNews.length === 0) {
    return [];
  }
  
  try {
    const jobId = `INST_RATINGS_ATOMIZE_${ticker}_${Date.now()}`;
    
    const payload = {
      raw_news: rawNews,
      ticker: ticker,
      market: market,
      task: "atomize_rating_news",
      instructions: `
請對以下機構評級原始新聞進行原子化清洗：

1. **提取核心資訊**：
   - 標題（title）
   - 摘要（summary）
   - 關鍵事實（機構名稱、評級動作、目標價變化）

2. **標準化格式**：
   - 保留原始連結和來源
   - 識別語言（英文/中文/日文）

3. **雜訊過濾**（必須過濾以下不相關內容）：
   - 網站首頁（homepage, index, main page）
   - 分類頁面（category, section, archive）
   - 廣告頁面（advertisement, ad, sponsored）
   - 登入/註冊頁面（login, signup, register）
   - 搜尋結果頁面（search results, search page）
   - 導覽頁面（navigation, menu, sitemap）
   - 關於我們/聯絡我們頁面（about, contact）
   - 非機構評級新聞（一般財經新聞、股價報價頁面等）

4. **只保留實際的機構評級新聞**：
   - 必須包含機構名稱（如 Goldman Sachs, 高盛, 野村證券）
   - 必須包含評級動作（如 upgrade, downgrade, 調升, 調降, 引上げ, 引下げ）
   - 必須是實際的新聞文章頁面（包含完整新聞內容的 URL）

請返回 JSON 格式的原子化新聞列表，格式：
{
  "atomized_news": [
    {
      "title": "新聞標題",
      "summary": "新聞摘要",
      "link": "原始連結",
      "source": "來源",
      "language": "語言（en/zh/ja）",
      "key_facts": ["關鍵事實1", "關鍵事實2"],
      "has_rating_info": true  // 是否包含評級資訊
    }
  ]
}
      `
    };
    
    const result = executeCapability(jobId, "GEMINI_FLASH", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("無法解析 GEMINI_FLASH 輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      const atomizedNews = parsedResult.atomized_news || parsedResult.news || [];
      
      // 只保留包含評級資訊的新聞
      const filteredNews = atomizedNews.filter(news => news.has_rating_info !== false);
      
      Logger.log(`P5 Daily：${ticker} (${market}) 原子化清洗完成，${filteredNews.length}/${atomizedNews.length} 筆包含評級資訊`);
      
      return filteredNews;
    }
    
    return [];
    
  } catch (error) {
    Logger.log(`P5 Daily：${ticker} (${market}) 原子化清洗失敗：${error.message}`);
    // 失敗時返回原始新聞（但標記為未清洗）
    return rawNews.map(news => ({
      ...news,
      summary: news.snippet || "",
      source: news.displayLink || extractSourceFromUrl(news.link) || "",
      language: detectLanguage(news.title + " " + (news.snippet || "")),
      has_rating_info: true  // 假設都包含評級資訊
    }));
  }
}

/**
 * ⭐ V8.9 新增：Gemini Pro 多語去重（替換程式邏輯）
 * 
 * 識別同一機構評級事件的不同語言版本，例如：
 * - "Goldman Sachs raises AAPL target price to $200" (英文)
 * - "高盛調升 AAPL 目標價至 $200" (中文)
 * - "ゴールドマン・サックス、AAPL目標株価を200ドルに引き上げ" (日文)
 * 
 * @param {Array} ratings - 評級事件列表
 * @returns {Array} deduplicatedRatings - 去重後的評級列表
 */
function deduplicateRatingsWithGeminiPro(ratings) {
  if (!ratings || ratings.length === 0) {
    return [];
  }
  
  try {
    const jobId = `INST_RATINGS_DEDUP_${Date.now()}`;
    
    const payload = {
      ratings: ratings,
      task: "deduplicate_ratings",
      instructions: `
請對以下機構評級事件進行多語去重：

**目標**：識別同一機構對同一檔股票、同一評級事件的不同語言版本，只保留一條。

**去重規則**：
1. **同一事件識別標準**：
   - 相同的 ticker（股票代碼）
   - 相同的 rating_firm（機構名稱，已標準化，如 GOLDMAN_SACHS）
   - 相同的 rating_action（評級動作，如 UPGRADE）
   - 相同或相近的 to_price（目標價，允許 ±2% 誤差）
   - 相同或相近的 rating_date（評級日期，允許 ±1 天誤差）

2. **保留優先順序**：
   - 優先保留英文版本（如果有多語言版本）
   - 如果沒有英文版本，保留最完整的版本（包含最多資訊）
   - 如果都相同，保留日期最新的

3. **特殊情況處理**：
   - 如果同一機構在一個月內對同一檔股票發布兩次不同的評級（例如：1月1日調升，1月15日調降），這是兩個不同事件，都應該保留
   - 只有當評級動作、目標價、日期都相同或相近時，才視為同一事件的不同語言版本

**輸入格式**：
每個評級事件包含：
- ticker: 股票代碼
- market: 市場（US/TW/JP）
- rating_firm: 機構名稱（標準化後，如 GOLDMAN_SACHS）
- rating_action: 評級動作（UPGRADE/DOWNGRADE/MAINTAIN/INITIATE）
- from_grade, to_grade: 評級變化
- from_price, to_price: 目標價變化
- rating_date: 評級發布日期
- news_title: 新聞標題
- news_summary: 新聞摘要
- news_url: 新聞連結
- news_source: 新聞來源

**輸出格式**：
{
  "deduplicated_ratings": [
    // 去重後的評級事件列表（每個事件只保留一條，優先英文版本）
  ],
  "duplicate_groups": [
    // 可選：記錄被去重的重複組（用於日誌）
    {
      "primary_rating": {...},  // 保留的主要評級
      "duplicate_ratings": [...]  // 被去重的重複評級
    }
  ]
}

請返回 JSON 格式的去重結果。
      `
    };
    
    const result = executeCapability(jobId, "GEMINI_PRO", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("無法解析 GEMINI_PRO 輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      const deduplicatedRatings = parsedResult.deduplicated_ratings || parsedResult.ratings || [];
      
      // 記錄去重統計
      if (parsedResult.duplicate_groups) {
        Logger.log(`P5 Daily：多語去重發現 ${parsedResult.duplicate_groups.length} 組重複事件`);
      }
      
      return deduplicatedRatings;
    }
    
    // 如果 AI 失敗，使用程式邏輯作為備援
    Logger.log(`P5 Daily：Gemini Pro 多語去重失敗，使用程式邏輯備援`);
    return deduplicateRatings(ratings);
    
  } catch (error) {
    Logger.log(`P5 Daily：Gemini Pro 多語去重失敗：${error.message}，使用程式邏輯備援`);
    // 失敗時使用程式邏輯作為備援
    return deduplicateRatings(ratings);
  }
}

/**
 * 從新聞標題解析機構評級事件（重用現有邏輯，但加入標準化）
 * ⭐ V8.9 更新：接受更多參數（link, source）
 */
function parseNewsTitleForRating(title, snippet, ticker, market, url, source) {
  try {
    const text = (title + " " + snippet).toLowerCase();
    const language = detectLanguage(title + " " + snippet);
    
    // 提取日期
    const date = extractDateFromText(title + " " + snippet) || new Date().toISOString().split('T')[0];
    
    // 提取機構名稱
    let firm = extractFirmFromText(title + " " + snippet, market);
    if (firm) {
      firm = standardizeFirmName(firm);
    }
    
    // 提取動作（標準化）
    const action = extractActionFromText(text, language);
    const standardizedAction = action ? standardizeRatingAction(action, language) : null;
    
    // 提取目標價變化
    const priceChange = extractPriceChangeFromText(text, market);
    
    // 提取評級變化
    const gradeChange = extractGradeChangeFromText(text, market);
    
    if (!firm || !standardizedAction) {
      return null;
    }
    
    return {
      date: date,
      ticker: ticker,
      market: market,
      rating_firm: firm,
      rating_action: standardizedAction,
      from_grade: gradeChange.from_grade || null,
      to_grade: gradeChange.to_grade || null,
      from_price: priceChange.from_price || null,
      to_price: priceChange.to_price || null,
      target_change: priceChange.target_change || null,
      news_title: title,
      news_summary: snippet,
      news_url: url || null,  // ⭐ V8.9 更新：使用傳入的 URL
      news_source: source || extractSourceFromUrl(url) || "CSE",  // ⭐ V8.9 更新：使用傳入的來源
      rating_date: date,
      rating_time: null,
      implied_fpe: null, // 稍後計算
      created_at: new Date()
    };
    
  } catch (e) {
    Logger.log(`P5 Daily：⚠️ parseNewsTitleForRating 失敗：${e.message}`);
    return null;
  }
}

/**
 * 從文字中提取日期（重用現有邏輯）
 */
function extractDateFromText(text) {
  try {
    const datePatterns = [
      /(\w{3})\s+(\d{1,2}),\s+(\d{4})/i,
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
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
 * 從文字中提取機構名稱（重用現有邏輯，但加入標準化）
 */
function extractFirmFromText(text, market) {
  const commonFirms = INSTITUTIONAL_FIRMS[market] || [];
  const lowerText = text.toLowerCase();
  
  for (const firm of commonFirms) {
    if (lowerText.indexOf(firm.toLowerCase()) > -1) {
      return firm;
    }
  }
  
  return null;
}

/**
 * 從文字中提取動作（重用現有邏輯）
 */
function extractActionFromText(text, language) {
  const lang = language || "en";
  const lowerText = text.toLowerCase();
  
  // 檢查每個標準動作
  for (const [standardAction, variants] of Object.entries(RATING_ACTION_MAP)) {
    for (const variant of variants[lang] || []) {
      if (lowerText.indexOf(variant.toLowerCase()) > -1) {
        return standardAction;
      }
    }
  }
  
  return null;
}

/**
 * 從文字中提取目標價變化（重用現有邏輯）
 */
function extractPriceChangeFromText(text, market) {
  try {
    const lowerText = text.toLowerCase();
    
    // 美股格式：target raised to $180 from $150 / $180 from $150
    const usPattern = /\$(\d+(?:\.\d+)?)\s+from\s+\$(\d+(?:\.\d+)?)|\$(\d+(?:\.\d+)?)\s+to\s+\$(\d+(?:\.\d+)?)/i;
    const usMatch = text.match(usPattern);
    
    if (usMatch) {
      const toPrice = parseFloat(usMatch[1] || usMatch[3] || usMatch[4]);
      const fromPrice = parseFloat(usMatch[2] || usMatch[3]);
      
      if (!isNaN(toPrice) && !isNaN(fromPrice) && toPrice > 0 && fromPrice > 0) {
        return {
          from_price: fromPrice,
          to_price: toPrice,
          target_change: `$${fromPrice.toFixed(2)} -> $${toPrice.toFixed(2)}`
        };
      }
    }
    
    // 台股格式：目標價 1380元 / 調升至 1380元
    if (market === "TW") {
      const twPattern = /目標價\s*(\d+(?:\.\d+)?)\s*元|調升至\s*(\d+(?:\.\d+)?)\s*元|調降[至到]\s*(\d+(?:\.\d+)?)\s*元/i;
      const twMatch = text.match(twPattern);
      
      if (twMatch) {
        const toPriceTW = parseFloat(twMatch[1] || twMatch[2] || twMatch[3]);
        if (!isNaN(toPriceTW) && toPriceTW > 0) {
          return {
            to_price: toPriceTW,
            target_change: `NT$${toPriceTW.toFixed(2)}`
          };
        }
      }
    }
    
    // 日股格式：目標株価 1500円 / 1500円に引上げ
    if (market === "JP") {
      const jpPattern = /目標株価\s*(\d+(?:\.\d+)?)\s*円|(\d+(?:\.\d+)?)\s*円に/i;
      const jpMatch = text.match(jpPattern);
      
      if (jpMatch) {
        const toPriceJP = parseFloat(jpMatch[1] || jpMatch[2]);
        if (!isNaN(toPriceJP) && toPriceJP > 0) {
          return {
            to_price: toPriceJP,
            target_change: `¥${toPriceJP.toFixed(2)}`
          };
        }
      }
    }
    
    return { from_price: null, to_price: null, target_change: null };
  } catch (e) {
    return { from_price: null, to_price: null, target_change: null };
  }
}

/**
 * 從文字中提取評級變化（重用現有邏輯）
 */
function extractGradeChangeFromText(text, market) {
  try {
    const lowerText = text.toLowerCase();
    
    // 美股格式：Buy -> Strong Buy / Neutral -> Buy
    const usPattern = /(buy|sell|hold|neutral|overweight|underweight|strong buy|strong sell)\s*(?:->|to|from)\s*(buy|sell|hold|neutral|overweight|underweight|strong buy|strong sell)/i;
    const usMatch = text.match(usPattern);
    
    if (usMatch) {
      return {
        from_grade: usMatch[1] || null,
        to_grade: usMatch[2] || null
      };
    }
    
    // 台股格式：優於大盤 -> 買進 / 中立 -> 買進
    if (market === "TW") {
      const twPattern = /(優於大盤|中立|劣於大盤|買進|賣出|持有)\s*(?:->|至|到)\s*(優於大盤|中立|劣於大盤|買進|賣出|持有)/i;
      const twMatch = text.match(twPattern);
      
      if (twMatch) {
        return {
          from_grade: twMatch[1] || null,
          to_grade: twMatch[2] || null
        };
      }
    }
    
    return { from_grade: null, to_grade: null };
  } catch (e) {
    return { from_grade: null, to_grade: null };
  }
}

/**
 * 檢測語言
 */
function detectLanguage(text) {
  // 簡單檢測：如果包含中文字符，返回 "zh"；如果包含日文字符，返回 "ja"；否則返回 "en"
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  return "en";
}

/**
 * 從 URL 提取來源
 */
function extractSourceFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (hostname.indexOf("thefly.com") > -1) return "The Fly";
    if (hostname.indexOf("streetinsider.com") > -1) return "StreetInsider";
    if (hostname.indexOf("benzinga.com") > -1) return "Benzinga";
    if (hostname.indexOf("tipranks.com") > -1) return "TipRanks";
    if (hostname.indexOf("anue.com.tw") > -1 || hostname.indexOf("cnyes.com") > -1) return "鉅亨網";
    if (hostname.indexOf("udn.com") > -1) return "經濟日報";
    if (hostname.indexOf("ctee.com.tw") > -1) return "工商時報";
    if (hostname.indexOf("minkabu.jp") > -1) return "Minkabu";
    if (hostname.indexOf("kabutan.jp") > -1) return "Kabutan";
    if (hostname.indexOf("traders.co.jp") > -1) return "Traders Web";
    
    return hostname;
  } catch (e) {
    return null;
  }
}

/**
 * 去重邏輯：同一個機構對同一檔股票，一個月內只看最新的一條動作
 */
function deduplicateRatings(ratings) {
  const ratingMap = {}; // key: `${ticker}_${firm}_${date}`
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  // 按日期排序（最新的在前）
  ratings.sort((a, b) => {
    const dateA = a.rating_date ? new Date(a.rating_date).getTime() : 0;
    const dateB = b.rating_date ? new Date(b.rating_date).getTime() : 0;
    return dateB - dateA;
  });
  
  for (const rating of ratings) {
    const key = `${rating.ticker}_${rating.rating_firm}`;
    const ratingDate = rating.rating_date ? new Date(rating.rating_date) : new Date();
    
    // 如果評級日期在一個月內
    if (ratingDate >= oneMonthAgo) {
      // 如果已經有這個機構對這檔股票的評級，且日期更近，則跳過舊的
      if (ratingMap[key]) {
        const existingDate = ratingMap[key].rating_date ? new Date(ratingMap[key].rating_date) : new Date();
        if (ratingDate > existingDate) {
          // 標記舊的為被取代
          ratingMap[key].superseded_by = rating.rating_id || `${rating.ticker}_${rating.rating_firm}_${rating.rating_date}`;
          ratingMap[key] = rating;
        } else {
          // 舊的保留，新的標記為被取代
          rating.superseded_by = ratingMap[key].rating_id || `${ratingMap[key].ticker}_${ratingMap[key].rating_firm}_${ratingMap[key].rating_date}`;
        }
      } else {
        ratingMap[key] = rating;
      }
    } else {
      // 超過一個月的評級，直接加入（不需要去重）
      ratingMap[`${key}_${rating.rating_date}`] = rating;
    }
  }
  
  return Object.values(ratingMap);
}

/**
 * 保存評級到資料庫
 */
function saveRatingsToDatabase(ratings) {
  try {
    // ⭐ V8.9 新增：確保表格存在
    const sheet = ensureInstitutionalRatingsTableExists();
    
    let savedCount = 0;
    
    for (const rating of ratings) {
      try {
        // 生成 rating_id
        const ratingId = `${rating.ticker}_${rating.rating_firm}_${rating.rating_date}_${Date.now()}`;
        
        const row = [
          rating.date || new Date().toISOString().split('T')[0],
          rating.ticker,
          rating.market,
          rating.rating_firm,
          rating.rating_action,
          rating.from_grade || "",
          rating.to_grade || "",
          rating.from_price || "",
          rating.to_price || "",
          rating.target_change || "",
          rating.news_title || "",
          rating.news_summary || "",
          rating.news_url || "",
          rating.news_source || "",
          rating.rating_date || rating.date || new Date().toISOString().split('T')[0],
          rating.rating_time || "",
          rating.implied_fpe || "",
          rating.superseded_by || "",
          rating.created_at || new Date()
        ];
        
        sheet.appendRow(row);
        savedCount++;
      } catch (e) {
        Logger.log(`P5 Daily：保存單筆評級失敗：${e.message}`);
      }
    }
    
    return savedCount;
  } catch (error) {
    Logger.log(`P5 Daily：保存評級到資料庫失敗：${error.message}`);
    return 0;
  }
}
