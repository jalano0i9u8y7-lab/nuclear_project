/**
 * 📊 P5 Daily: 新聞原子化數據收集
 * 
 * 多語去重、十大類分類、關聯性分析、世界觀學習
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 收集新聞原子化數據
 * 
 * @param {Array} tickers - 股票代碼列表
 * @param {Object} macroData - 宏觀數據（用於世界觀分析）
 * @returns {Object} newsData - 新聞數據
 */
function collectNewsAtoms(tickers, macroData) {
  Logger.log(`P5 Daily：開始收集新聞原子化數據（${tickers.length} 檔股票）`);
  
  const newsAtoms = {};
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  try {
    // Step 1: 收集多語新聞（使用 CSE）
    // ⭐ V8.12：支持測試模式選項
    const isTestMode = macroData && macroData.isTestMode || false;
    Logger.log(`P5 Daily V8.12：開始收集原始新聞（測試模式：${isTestMode}）`);
    const rawNews = collectRawNews(tickers, { isTestMode: isTestMode });
    
    if (!rawNews || rawNews.length === 0) {
      Logger.log("P5 Daily：未收集到任何新聞（collectRawNews 返回空數組）");
      return {};
    }
    
    Logger.log(`P5 Daily：收集到 ${rawNews.length} 筆原始新聞`);
    
    // ⭐ V8.14 升級：使用 GEMINI_FLASH 3.0 整合處理（清洗+去重+分類一次完成）
    // 利用 2M 長窗口特性，採用 Batch Processing 策略，一次處理約 100 則新聞
    let processedNews = [];
    const batchSize = 100;  // ⭐ V8.14：批次大小設為 100（利用 2M 長窗口）
    
    if (rawNews.length > batchSize) {
      Logger.log(`P5 Daily V8.14：新聞數量較多（${rawNews.length} 筆），分批處理（每批 ${batchSize} 筆）`);
      
      for (let i = 0; i < rawNews.length; i += batchSize) {
        const batch = rawNews.slice(i, i + batchSize);
        Logger.log(`P5 Daily V8.14：處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawNews.length / batchSize)}（${batch.length} 筆）`);
        
        try {
          const batchResult = processNewsBatchWithGeminiFlash(batch, { isTestMode: isTestMode });
          processedNews = processedNews.concat(batchResult);
          
          // 批次之間稍作延遲，避免 API 過載
          if (i + batchSize < rawNews.length) {
            Utilities.sleep(2000);  // 延遲 2 秒
          }
        } catch (error) {
          Logger.log(`P5 Daily V8.14：批次處理失敗，使用默認值：${error.message}`);
          // 使用默認值繼續處理（保留原始新聞的基本信息）
          const defaultBatch = batch.map(news => ({
            title: news.title || "",
            summary: news.snippet || "",
            link: news.link || "",
            source: news.source || "",
            language: news.language || "en",
            category: "其他",
            importance: "MEDIUM",
            event_type: { primary: "其他", secondary: [] },
            impact_scope: "STOCK",
            sentiment_polarity: "NEUTRAL",
            related_tickers: [],
            data_type: "NARRATIVE",
            data_recency: "UNCLEAR",
            data_coherence: "CONSISTENT"
          }));
          processedNews = processedNews.concat(defaultBatch);
        }
      }
    } else {
      processedNews = processNewsBatchWithGeminiFlash(rawNews, { isTestMode: isTestMode });
    }
    
    Logger.log(`P5 Daily V8.14：完成整合處理（清洗+去重+分類），共 ${processedNews.length} 筆`);
    
    // Step 3.5: ⭐ V8.12 新增：批量驗證新聞數據（使用Daily DB硬數據）
    const verifiedNews = batchVerifyNewsData(processedNews, macroData);
    
    Logger.log(`P5 Daily V8.12：完成新聞數據驗證，共 ${verifiedNews.length} 筆`);
    
    // Step 4: GEMINI_PRO 簡單留存快照（不進行推理分析）
    // ⭐ V8.0 修正：Daily 只做簡單快照留存，整週的快照連貫性動態分析是 Weekly 的工作
    const analyzedNews = saveDailyWorldviewSnapshot(verifiedNews, macroData);
    
    // ⭐ V8.0 新增：從新聞中檢測財報公布信息並更新行事曆
    try {
      if (typeof updateHoldingsEarningsCalendarFromNews === 'function') {
        const earningsUpdateResult = updateHoldingsEarningsCalendarFromNews(analyzedNews);
        Logger.log(`P5 Daily：財報行事曆更新完成，檢測 ${earningsUpdateResult.detected}，更新 ${earningsUpdateResult.updated}`);
      }
    } catch (error) {
      Logger.log(`P5 Daily：財報行事曆更新失敗：${error.message}（不影響新聞收集）`);
    }
    
    // Step 5: 生成原子 ID 並組織數據（⭐ V8.12：包含多維度標籤）
    for (let i = 0; i < analyzedNews.length; i++) {
      const news = analyzedNews[i];
      const atomId = `NEWS_${dateStr}_${i + 1}_${Date.now()}`;
      
      // ⭐ V8.12：處理多維度標籤
      const eventType = news.event_type || {};
      const relatedTickers = news.related_tickers || [];
      
      newsAtoms[atomId] = {
        atom_id: atomId,
        date: dateStr,
        category: news.category || "其他",  // 保留作為兼容性欄位
        ticker: news.ticker || null,  // 保留作為兼容性欄位（主要使用related_tickers_json）
        title: news.title || "",
        summary: news.summary || "",
        source: news.source || "",
        importance: news.importance || "MEDIUM",
        url: news.url || news.link || "",
        macro_context_json: JSON.stringify(news.macro_context || {}),  // ⭐ V8.0 保留欄位，但不再填充（由 Weekly 分析）
        // ⭐ V8.12 新增：多維度標籤系統
        event_type_json: JSON.stringify(eventType),  // 事件屬性（JSON格式）
        impact_scope: news.impact_scope || "STOCK",  // 影響層級
        sentiment_polarity: news.sentiment_polarity || "NEUTRAL",  // 情緒極性
        related_tickers_json: JSON.stringify(relatedTickers),  // 關聯股票代碼列表（JSON格式）
        // ⭐ V8.12 新增：新聞驗證標記（初步，Phase 4會進一步驗證）
        data_type: news.data_type || "NARRATIVE",  // 數據類型
        data_recency: news.data_recency || "UNCLEAR",  // 數據時效性
        data_coherence: news.data_coherence || "CONSISTENT",  // 數據語意一致性
        data_verification: "NOT_VERIFIED",  // 將由Phase 4驗證機制填充
        narrative_direction: null,  // 將由Phase 4驗證機制填充
        market_confirmation: null,  // 將由Phase 4驗證機制填充
        cross_asset_resonance: null,  // 將由Phase 4驗證機制填充
        verification_details_json: JSON.stringify({}),  // 驗證詳細信息
        created_at: today
      };
    }
    
    Logger.log(`P5 Daily：完成新聞原子化，共 ${Object.keys(newsAtoms).length} 筆`);
    
  } catch (error) {
    Logger.log(`P5 Daily：收集新聞原子化數據失敗：${error.message}`);
  }
  
  return newsAtoms;
}

/**
 * 收集原始新聞（使用 CSE）
 * ⭐ V8.12 修正：移除關鍵字搜尋，改為直接CSE搜尋（由CSE後臺白名單限制）
 * 既然CSE已經白名單限制，應該抓白名單網站每天最新的所有新聞
 * 程式責任：判斷日期是當日最新（±6小時，測試時可放寬到前一天）
 * Flash清洗責任：洗掉雜訊 + 篩選出"當日"的"新聞"
 * 
 * @param {Array} tickers - 股票代碼列表（已棄用，保留以維持API兼容性）
 * @param {Object} options - 選項（測試模式可調整時效性）
 *   - isTestMode: boolean - 是否為測試模式（測試時放寬時效性到前一天）
 * @returns {Array} rawNews - 原始新聞列表
 */
function collectRawNews(tickers, options = {}) {
  const rawNews = [];
  
  // ⭐ V8.12 修正：移除關鍵字搜尋，改為直接CSE搜尋
  // 使用日期相關的通用查詢來獲取白名單網站當天最新新聞
  // 由CSE後臺白名單限制網站範圍，程式碼不加任何限制語句
  const today = new Date();
  let queryDate = today;
  
  // ⭐ V8.12 測試模式：時效性放寬到前一天
  if (options.isTestMode) {
    queryDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);  // 前一天
  }
  
  const dateStr = Utilities.formatDate(queryDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // 構建日期相關的通用查詢（用於獲取當天最新新聞）
  // 使用日期字串作為查詢，讓CSE返回該日期相關的最新新聞
  // ⭐ V8.12 正式版：英文50則、中文25則、日文25則
  const searchQueries = [
    { query: dateStr, language: "en", maxResults: 50 },   // 英語：50則
    { query: dateStr, language: "zh", maxResults: 25 },   // 中文：25則
    { query: dateStr, language: "ja", maxResults: 25 }    // 日語：25則
  ];
  
  try {
    for (const queryConfig of searchQueries) {
      try {
        // 使用 M0 的 CSE_SEARCH 功能
        // ⭐ V8.12：直接CSE搜尋，不使用關鍵字限制，由CSE後臺白名單限制
        const jobId = `NEWS_COLLECT_V8.12_${queryConfig.language}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const payload = {
          search_query: queryConfig.query,  // 使用日期查詢，獲取當天最新新聞
          cse_type: "P5_NEWS",  // CSE類型由後臺白名單限制
          max_results: queryConfig.maxResults
        };
        
        if (typeof executeCSESearch !== "function") {
          Logger.log(`P5 Daily：⚠️ executeCSESearch 未定義，無法使用 CSE 收集新聞`);
          break;
        }
        
        const result = executeCSESearch(jobId, "CSE_SEARCH", payload);
        
        // ⭐ V8.13 新增：詳細日誌，用於調試
        if (!result) {
          Logger.log(`P5 Daily V8.12：${queryConfig.language} CSE 搜尋返回 null 或 undefined`);
        } else if (!result.output) {
          Logger.log(`P5 Daily V8.12：${queryConfig.language} CSE 搜尋結果沒有 output 欄位`);
        } else if (!result.output.search_results) {
          Logger.log(`P5 Daily V8.12：${queryConfig.language} CSE 搜尋結果沒有 search_results 欄位`);
        } else if (result.output.search_results.length === 0) {
          Logger.log(`P5 Daily V8.12：${queryConfig.language} CSE 搜尋返回 0 筆結果`);
        }
        
        if (result && result.output && result.output.search_results) {
          const searchResults = result.output.search_results;
          
          // ⭐ V8.12：程式責任 - 判斷日期是當日最新（±6小時）
          const now = new Date();
          const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          
          for (const item of searchResults) {
            // 嘗試從snippet或title中提取日期信息（由Flash清洗進一步驗證）
            rawNews.push({
              ticker: null,  // 由後續AI處理識別相關ticker
              title: item.title || "",
              snippet: item.snippet || "",
              link: item.link || "",
              source: extractSourceFromUrl(item.link || ""),
              language: queryConfig.language,
              publish_date: null,  // 將由Flash清洗時提取和驗證
              raw_data: item
            });
          }
          
          Logger.log(`P5 Daily V8.12：${queryConfig.language} 新聞收集完成，獲得 ${searchResults.length} 筆（將由Flash清洗驗證時效性）`);
        }
        
        // 避免請求過快
        Utilities.sleep(1000);
        
      } catch (error) {
        Logger.log(`P5 Daily V8.12：${queryConfig.language} 新聞收集失敗：${error.message}`);
      }
    }
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：收集財經新聞失敗：${error.message}`);
  }
  
  Logger.log(`P5 Daily V8.12：收集到 ${rawNews.length} 筆原始新聞（將由Flash清洗篩選當日新聞並去除雜訊）`);
  
  return rawNews;
}

/**
 * ⭐ V8.14 新增：整合新聞處理（使用 GEMINI_FLASH 3.0）
 * 一次呼叫完成：清洗 + 去重 + 分類
 * 利用 2M 長窗口特性，批次處理約 100 則新聞
 * 
 * @param {Array} rawNews - 原始新聞列表
 * @param {Object} options - 選項（測試模式可調整時效性）
 *   - isTestMode: boolean - 是否為測試模式（測試時放寬時效性到前一天）
 * @returns {Array} processedNews - 處理後的新聞列表（包含多維度標籤）
 */
function processNewsBatchWithGeminiFlash(rawNews, options = {}) {
  if (!rawNews || rawNews.length === 0) {
    return [];
  }
  
  try {
    const jobId = `NEWS_PROCESS_V8.14_${Date.now()}`;
    const today = new Date();
    let validDate = today;
    let validDateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // ⭐ V8.12 測試模式：時效性放寬到前一天
    if (options.isTestMode) {
      validDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);  // 前一天
      validDateStr = Utilities.formatDate(validDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    const payload = {
      raw_news: rawNews,
      task: "integrated_process",  // ⭐ V8.14：整合處理任務
      instructions: `
請對以下原始新聞進行整合處理（⭐ V8.14 新系統：一次完成清洗+去重+分類）：

**階段一：時效性檢查與雜訊過濾**

**1. 時效性檢查**
- 必須篩選出"當日"發布的新聞（不能是好幾天前發布的）
- 檢查新聞發布日期，只保留${options.isTestMode ? "昨天或今天" : "今天"}（${validDateStr}${options.isTestMode ? " 或 " + Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd") : ""}）發布的新聞
- ${options.isTestMode ? "測試模式：允許前一天的新聞（放寬時效性）" : "允許±6小時的時間誤差範圍（考慮時區差異）"}
- 如果無法確定發布日期，但標題/內容明顯提及${options.isTestMode ? "最近" : "今天"}或"最新"，則保留
- 如果明顯是舊新聞（幾天前、幾週前、幾個月前），必須過濾掉

**2. 雜訊過濾**
必須過濾以下不相關內容：
- 網站首頁（homepage, index, main page）
- 分類頁面（category, section, archive）
- 廣告頁面（advertisement, ad, sponsored）
- 登入/註冊頁面（login, signup, register）
- 搜尋結果頁面（search results, search page）
- 導覽頁面（navigation, menu, sitemap）
- 關於我們/聯絡我們頁面（about, contact）
- 論壇/討論區頁面（forum, discussion, comments）
- 非正式新聞內容（非新聞網站的文章）
- 其他非新聞內容頁面

只保留實際的新聞文章頁面（包含完整新聞內容的 URL）。

**階段二：多語去重**
- 識別不同語言但內容相同的新聞，合併為一則新聞
- 保留最完整的版本（通常是最詳細的摘要）

**階段三：多維度標籤分類**

**維度一：事件屬性 (Event Type)**
決定「發生了什麼事」，可以標記多個（主事件 + 次要事件）：
- **宏觀與政策**：Central_Bank（央行政策）、Econ_Data（經濟數據）、Geopolitics（地緣政治）、Fiscal_Reg（財政與監管）
- **企業基本面**：Earnings_Result（財報結果）、Guidance（前瞻指引）、M_A_SpinOff（併購與重組）、Product_Tech（產品與技術）、Management（管理層變動）
- **資金與籌碼**：Analyst_Ratings（機構評級）、Insider_Activity（內部人交易）、Institutional_Flow（機構流向）、Buyback_Offering（股票回購/增資）
- **市場結構**：Sector_Rotation（板塊輪動）、Derivatives（衍生品異動）、Technical_Signal（技術訊號）
- **專項追蹤**：AI_Semi（AI與半導體）、Crypto（加密貨幣）
- **原物料與匯率**：Energy（能源）、Precious_Metals（貴金屬）、Industrial_Metals（工業金屬）、Agriculture（農產品）、Forex（匯率變動）

**維度二：影響層級 (Impact Scope)**
決定 AI 該如何調整資金權重：
- **GLOBAL**：影響全市場（如：聯準會升息）
- **SECTOR**：影響單一產業（如：美國限制 AI 晶片出口）
- **STOCK**：僅影響單一公司（如：財報）

**維度三：情緒極性 (Sentiment Polarity)**
決定是要「進攻」還是「防守」：
- **VERY_BULLISH**：結構性改變的利好（如 AI 工業革命）
- **SLIGHTLY_BULLISH**：暫時性利好
- **NEUTRAL**：事實陳述，無明顯方向
- **SLIGHTLY_BEARISH**：暫時性利空（如庫存調整）
- **VERY_BEARISH**：毀滅性打擊（如造假、戰爭）

**維度四：關聯股票代碼 (Related Tickers)**
從新聞中提取相關的股票代碼列表（如：["NVDA", "AMD"]），用於個股新聞索引。

**階段四：數據驗證標記**

**1. 新聞時效性檢驗**
檢查新聞所引用的數據是否明顯不是「最近可得數據」：
- 是否使用模糊時間詞（recent / lately / over the past years）
- 是否把舊高點 / 舊均值當成現在
- 輸出：DATA_RECENCY = OK | STALE | UNCLEAR

**2. 數據語意健檢**
判斷新聞是否存在明顯錯誤引用：
- 數字級錯、比例失真、絕對值 vs 相對值誤導、分母未說清楚
- 輸出：DATA_COHERENCE = CONSISTENT | QUESTIONABLE | INCONSISTENT
- ⚠️ 禁止輸出任何市場結論，只做數據健檢

**3. 數據類型判斷**
- **HARD**：硬數據（如：股價、匯率、利率）
- **SEMI_STRUCTURED**：半結構化數據（如：財報數字、經濟數據）
- **NARRATIVE**：敘事性數據（如：分析師觀點、市場評論）

**4. 重要性評估**
評估重要性（HIGH / MEDIUM / LOW）

**輸出格式（JSON）：**
必須方便Weekly AI讀取和使用，格式設計以weekly決策時如何好讀取已經夠精確為方向：

{
  "processed_news": [
    {
      "title": "新聞標題",
      "summary": "新聞摘要（合併後的最完整版本）",
      "link": "原始連結（保留最完整的版本）",
      "source": "來源",
      "language": "主要語言",
      "category": "舊分類（兼容性保留）",
      "importance": "HIGH / MEDIUM / LOW",
      // ⭐ V8.12 新增：多維度標籤
      "event_type": {
        "primary": "主要事件類型（如 Central_Bank）",
        "secondary": ["次要事件類型1", "次要事件類型2"]
      },
      "impact_scope": "GLOBAL / SECTOR / STOCK",
      "sentiment_polarity": "VERY_BULLISH / SLIGHTLY_BULLISH / NEUTRAL / SLIGHTLY_BEARISH / VERY_BEARISH",
      "related_tickers": ["NVDA", "AMD"],  // 關聯股票代碼列表
      // ⭐ V8.12 新增：驗證標記（初步，Phase 4會進一步驗證）
      "data_recency": "OK / STALE / UNCLEAR",
      "data_coherence": "CONSISTENT / QUESTIONABLE / INCONSISTENT",
      "data_type": "HARD / SEMI_STRUCTURED / NARRATIVE",
      "publish_date": "發布日期（YYYY-MM-DD格式，如果可識別）",
      // ⭐ V8.0 新增：財報日期信息（僅當 event_type 包含 Earnings_Date_Announcement 時）
      "earnings_date_info": {
        "ticker": "AAPL",  // 股票代碼（必須）
        "quarter": "Q1",   // 季度（Q1/Q2/Q3/Q4，如果可識別）
        "fiscal_year": 2025,  // 財年（如果可識別）
        "earnings_date": "2025-05-02",  // 財報日期（YYYY-MM-DD格式，如果可識別）
        "announcement_date": "2025-04-15",  // 公告日期（YYYY-MM-DD格式，如果可識別）
        "confidence": 0.8  // 提取置信度（0.0-1.0）
      }  // 僅當 event_type 包含 Earnings_Date_Announcement 且可提取日期信息時才包含此欄位
    }
  ]
}
      `
    };
    
    Logger.log(`P5 Daily V8.14：開始使用 GEMINI_FLASH 3.0 整合處理 ${rawNews.length} 筆新聞（批次大小：${batchSize}）`);
    const result = executeCapability(jobId, "GEMINI_FLASH", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              Logger.log(`P5 Daily V8.14：無法解析 GEMINI_FLASH 輸出（JSON解析失敗）：${e2.message}`);
              throw new Error("無法解析 GEMINI_FLASH 輸出");
            }
          } else {
            Logger.log(`P5 Daily V8.14：無法解析 GEMINI_FLASH 輸出（找不到JSON）`);
            throw new Error("無法解析 GEMINI_FLASH 輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      // ⭐ V8.14 修正：安全地訪問數組
      if (parsedResult && parsedResult.processed_news && Array.isArray(parsedResult.processed_news)) {
        Logger.log(`P5 Daily V8.14：成功解析 GEMINI_FLASH 輸出，獲得 ${parsedResult.processed_news.length} 筆處理後新聞`);
        return parsedResult.processed_news;
      } else if (parsedResult && parsedResult.deduplicated_news && Array.isArray(parsedResult.deduplicated_news)) {
        Logger.log(`P5 Daily V8.14：使用備用欄位 'deduplicated_news'，獲得 ${parsedResult.deduplicated_news.length} 筆新聞`);
        return parsedResult.deduplicated_news;
      } else if (parsedResult && parsedResult.news && Array.isArray(parsedResult.news)) {
        Logger.log(`P5 Daily V8.14：使用備用欄位 'news'，獲得 ${parsedResult.news.length} 筆新聞`);
        return parsedResult.news;
      } else {
        Logger.log(`P5 Daily V8.14：⚠️ GEMINI_FLASH 輸出格式不符合預期，使用默認值`);
        throw new Error("GEMINI_FLASH 輸出格式不符合預期");
      }
    }
    
    Logger.log(`P5 Daily V8.14：⚠️ GEMINI_FLASH 返回空結果，使用默認值`);
    return [];
    
  } catch (error) {
    Logger.log(`P5 Daily V8.14：整合處理失敗：${error.message}`);
    // 失敗時返回默認值（保留原始新聞的基本信息）
    return rawNews.map(news => ({
      title: news.title || "",
      summary: news.snippet || "",
      link: news.link || "",
      source: news.source || "",
      language: news.language || "en",
      category: "其他",
      importance: "MEDIUM",
      event_type: { primary: "其他", secondary: [] },
      impact_scope: "STOCK",
      sentiment_polarity: "NEUTRAL",
      related_tickers: [],
      data_type: "NARRATIVE",
      data_recency: "UNCLEAR",
      data_coherence: "CONSISTENT"
    }));
  }
}

/**
 * GEMINI_FLASH 2.5 清洗（Atom 化）
 * ⭐ V8.14 廢棄：此函數已被 processNewsBatchWithGeminiFlash 取代
 * 保留此函數僅為向後兼容，新代碼應使用 processNewsBatchWithGeminiFlash
 * 
 * @param {Array} rawNews - 原始新聞列表
 * @param {Object} options - 選項（測試模式可調整時效性）
 *   - isTestMode: boolean - 是否為測試模式（測試時放寬時效性到前一天）
 * @returns {Array} atomizedNews - 原子化後的新聞列表
 */
function atomizeNewsWithGeminiFlash(rawNews, options = {}) {
  if (!rawNews || rawNews.length === 0) {
    return [];
  }
  
  try {
    const jobId = `NEWS_ATOMIZE_V8.12_${Date.now()}`;
    const today = new Date();
    let validDate = today;
    let validDateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // ⭐ V8.12 測試模式：時效性放寬到前一天
    if (options.isTestMode) {
      validDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);  // 前一天
      validDateStr = Utilities.formatDate(validDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    
    const payload = {
      raw_news: rawNews,
      task: "atomize",
      instructions: `
請對以下原始新聞進行原子化清洗：

**1. 時效性檢查（⭐ V8.12 新增）**
- 必須篩選出"當日"發布的新聞（不能是好幾天前發布的）
- 檢查新聞發布日期，只保留${options.isTestMode ? "昨天或今天" : "今天"}（${validDateStr}${options.isTestMode ? " 或 " + Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd") : ""}）發布的新聞
- ${options.isTestMode ? "測試模式：允許前一天的新聞（放寬時效性）" : "允許±6小時的時間誤差範圍（考慮時區差異）"}
- 如果無法確定發布日期，但標題/內容明顯提及${options.isTestMode ? "最近" : "今天"}或"最新"，則保留
- 如果明顯是舊新聞（幾天前、幾週前、幾個月前），必須過濾掉

**2. 雜訊過濾（⭐ V8.12 加強）**
必須過濾以下不相關內容：
- 網站首頁（homepage, index, main page）
- 分類頁面（category, section, archive）
- 廣告頁面（advertisement, ad, sponsored）
- 登入/註冊頁面（login, signup, register）
- 搜尋結果頁面（search results, search page）
- 導覽頁面（navigation, menu, sitemap）
- 關於我們/聯絡我們頁面（about, contact）
- 論壇/討論區頁面（forum, discussion, comments）
- 非正式新聞內容（非新聞網站的文章）
- 其他非新聞內容頁面

只保留實際的新聞文章頁面（包含完整新聞內容的 URL）。

**3. 提取核心資訊**
- 提取新聞標題、摘要、關鍵事實
- 提取發布日期（如果可識別）
- 標準化格式
- 移除重複和無關資訊
- 保留原始連結和來源

**4. 提取關聯股票代碼（⭐ V8.12 新增）**
- 從新聞標題和摘要中提取相關的股票代碼（如 NVDA, AMD, TSM）
- 如果新聞涉及特定股票，請在 related_tickers 欄位中列出

請返回 JSON 格式的原子化新聞列表，格式：
{
  "atomized_news": [
    {
      "title": "新聞標題",
      "summary": "新聞摘要",
      "link": "原始連結",
      "source": "來源",
      "language": "語言",
      "publish_date": "發布日期（YYYY-MM-DD格式，如果可識別）",
      "related_tickers": ["NVDA", "AMD"],  // ⭐ V8.12 新增：關聯股票代碼列表
      "key_facts": ["關鍵事實1", "關鍵事實2"],
      "is_today_news": true  // ⭐ V8.12 新增：是否為當日新聞
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
      
      // ⭐ V8.12：過濾掉非當日新聞（測試模式放寬到前一天）
      const atomizedNews = parsedResult.atomized_news || parsedResult.news || [];
      const today = new Date();
      const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const validDates = options.isTestMode ? [todayStr, yesterdayStr] : [todayStr];
      
      const filteredNews = atomizedNews.filter(news => {
        // 如果AI標記為非當日新聞，則過濾掉
        if (news.is_today_news === false && !options.isTestMode) {
          return false;
        }
        
        // 如果發布日期存在且不在有效日期範圍內，則過濾掉
        if (news.publish_date && validDates.indexOf(news.publish_date) === -1) {
          return false;
        }
        
        // 如果沒有明確標記且沒有發布日期，保留（後續由Gemini Pro進一步驗證）
        return true;
      });
      
      Logger.log(`P5 Daily V8.12：Flash清洗完成，${atomizedNews.length} 筆 → ${filteredNews.length} 筆（過濾掉 ${atomizedNews.length - filteredNews.length} 筆非當日新聞）`);
      
      return filteredNews;
    }
    
    return rawNews;
    
  } catch (error) {
    Logger.log(`P5 Daily：原子化清洗失敗：${error.message}`);
    return rawNews;  // 失敗時返回原始新聞
  }
}

/**
 * GEMINI_PRO 3.0（多語審查 去重 + 多維度標籤分類）⭐ V8.12 升級
 * ⭐ V8.12：從平面分類 → 多維度標籤系統
 * 
 * @param {Array} atomizedNews - 原子化後的新聞列表
 * @returns {Array} deduplicatedNews - 去重後的新聞列表（包含多維度標籤）
 */
function deduplicateAndCategorizeWithGeminiPro(atomizedNews) {
  if (!atomizedNews || atomizedNews.length === 0) {
    return [];
  }
  
  try {
    const jobId = `NEWS_DEDUP_V8.12_${Date.now()}`;
    
    const payload = {
      atomized_news: atomizedNews,
      task: "deduplicate_and_categorize_multidim",
      instructions: `
請對以下原子化新聞進行多語去重和多維度標籤分類（⭐ V8.12 新系統）：

**1. 多語去重**
識別不同語言但內容相同的新聞，合併為一則新聞。

**2. 多維度標籤系統（取代平面分類）**

**維度一：事件屬性 (Event Type)**
決定「發生了什麼事」，可以標記多個（主事件 + 次要事件）：
- **宏觀與政策**：Central_Bank（央行政策）、Econ_Data（經濟數據）、Geopolitics（地緣政治）、Fiscal_Reg（財政與監管）
- **企業基本面**：Earnings_Result（財報結果）、Guidance（前瞻指引）、M_A_SpinOff（併購與重組）、Product_Tech（產品與技術）、Management（管理層變動）
- **資金與籌碼**：Analyst_Ratings（機構評級）、Insider_Activity（內部人交易）、Institutional_Flow（機構流向）、Buyback_Offering（股票回購/增資）
- **市場結構**：Sector_Rotation（板塊輪動）、Derivatives（衍生品異動）、Technical_Signal（技術訊號）
- **專項追蹤**：AI_Semi（AI與半導體）、Crypto（加密貨幣）
- **原物料與匯率**：Energy（能源）、Precious_Metals（貴金屬）、Industrial_Metals（工業金屬）、Agriculture（農產品）、Forex（匯率變動）

**維度二：影響層級 (Impact Scope)**
決定 AI 該如何調整資金權重：
- **GLOBAL**：影響全市場（如：聯準會升息）
- **SECTOR**：影響單一產業（如：美國限制 AI 晶片出口）
- **STOCK**：僅影響單一公司（如：財報）

**維度三：情緒極性 (Sentiment Polarity)**
決定是要「進攻」還是「防守」：
- **VERY_BULLISH**：結構性改變的利好（如 AI 工業革命）
- **SLIGHTLY_BULLISH**：暫時性利好
- **NEUTRAL**：事實陳述，無明顯方向
- **SLIGHTLY_BEARISH**：暫時性利空（如庫存調整）
- **VERY_BEARISH**：毀滅性打擊（如造假、戰爭）

**維度四：關聯股票代碼 (Related Tickers)**
從新聞中提取相關的股票代碼列表（如：["NVDA", "AMD"]），用於個股新聞索引。

**⭐ V8.27 新增：反覆矛盾檢測（REVERSAL_NOISE / CONTRADICTORY_SIGNAL）**

**任務**：檢測同一索引個股的新聞是否反覆改變立場或反覆矛盾

**檢測邏輯**：
1. **聚類檢測**：檢查過去 7 天的新聞中，是否有「同一主題的反覆報導」
   - 例如：「美國同意出貨 H200」→「美國說不行」→「有條件可以」→「中國不同意」
   - 這是「反覆噪音」

2. **反覆次數計算**：
   - 如果同一主題在 7 天內「情緒反轉 >= 3 次」：
     - \`event_stability = "REVERSAL_NOISE"\`
     - \`stability_description = "短期政策反覆，尚未穩定（7 天內反轉 X 次）"\`
   - 如果同一主題在 7 天內「情緒一致 >= 5 天」：
     - \`event_stability = "STABLE_EVENT"\`
     - \`stability_description = "事件已穩定，可作為決策依據"\`
   - 其他情況：
     - \`event_stability = "EVOLVING"\`
     - \`stability_description = "事件尚在演進中，需持續觀察"\`

3. **矛盾模式識別**：
   - 如果檢測到反覆矛盾，提供 \`contradiction_pattern\`：
     - 例如：\`["週一利好", "週二利空", "週三利好", "週四利空"]\`
   - 提供 \`contradiction_reasoning\`：
     - 例如：「政策尚未穩定，媒體反覆報導，可能是媒體配合主力炒作或政策尚未定案」

**重要原則**：
- ⚠️ **不要直接標記為 TIER_4 並讓 Weekly 忽略**
- ✅ **只做標記和描述，讓 Weekly 深度思考為什麼會這樣**
- ✅ **提供 \`contradiction_reasoning\` 幫助 Weekly 判斷是媒體配合主力炒作還是政策尚未穩定**

**3. 新聞時效性檢驗（⭐ V8.12 新增）**
檢查新聞所引用的數據是否明顯不是「最近可得數據」：
- 是否使用模糊時間詞（recent / lately / over the past years）
- 是否把舊高點 / 舊均值當成現在
- 輸出：DATA_RECENCY = OK | STALE | UNCLEAR

**4. 數據語意健檢（⭐ V8.12 新增）**
判斷新聞是否存在明顯錯誤引用：
- 數字級錯、比例失真、絕對值 vs 相對值誤導、分母未說清楚
- 輸出：DATA_COHERENCE = CONSISTENT | QUESTIONABLE | INCONSISTENT
- ⚠️ 禁止輸出任何市場結論，只做數據健檢

**5. 重要性評估**
評估重要性（HIGH / MEDIUM / LOW）

**輸出格式（JSON）：**
必須方便Weekly AI讀取和使用，格式設計以weekly決策時如何好讀取已經夠精確為方向：

{
  "deduplicated_news": [
    {
      "title": "新聞標題",
      "summary": "新聞摘要",
      "link": "原始連結",
      "source": "來源",
      "language": "主要語言",
      "category": "舊分類（兼容性保留）",
      "importance": "HIGH / MEDIUM / LOW",
      // ⭐ V8.12 新增：多維度標籤
      "event_type": {
        "primary": "主要事件類型（如 Central_Bank）",
        "secondary": ["次要事件類型1", "次要事件類型2"]
      },
      "impact_scope": "GLOBAL / SECTOR / STOCK",
      "sentiment_polarity": "VERY_BULLISH / SLIGHTLY_BULLISH / NEUTRAL / SLIGHTLY_BEARISH / VERY_BEARISH",
      "related_tickers": ["NVDA", "AMD"],  // 關聯股票代碼列表
      // ⭐ V8.27 新增：反覆矛盾檢測
      "event_stability": "REVERSAL_NOISE" | "STABLE_EVENT" | "EVOLVING",
      "stability_description": "描述（例如：H200 出貨政策 7 天內反轉 4 次，尚未穩定）",
      "contradiction_pattern": ["週一利好", "週二利空", "週三利好", "週四利空"],  // 僅當 event_stability = "REVERSAL_NOISE" 時
      "contradiction_reasoning": "矛盾原因分析（例如：政策尚未穩定、媒體配合主力炒作等）",  // 僅當 event_stability = "REVERSAL_NOISE" 時
      // ⭐ V8.12 新增：驗證標記（初步，Phase 4會進一步驗證）
      "data_recency": "OK / STALE / UNCLEAR",
      "data_coherence": "CONSISTENT / QUESTIONABLE / INCONSISTENT",
      "data_type": "HARD / SEMI_STRUCTURED / NARRATIVE"  // 初步判斷數據類型
    }
  ]
}
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
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              Logger.log(`P5 Daily V8.12：無法解析 GEMINI_PRO 輸出（JSON解析失敗）：${e2.message}`);
              throw new Error("無法解析 GEMINI_PRO 輸出");
            }
          } else {
            Logger.log(`P5 Daily V8.12：無法解析 GEMINI_PRO 輸出（找不到JSON）`);
            throw new Error("無法解析 GEMINI_PRO 輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      // ⭐ V8.13 修正：安全地訪問數組，避免 "Cannot read properties of undefined (reading '0')" 錯誤
      if (parsedResult && parsedResult.deduplicated_news && Array.isArray(parsedResult.deduplicated_news)) {
        Logger.log(`P5 Daily V8.12：成功解析 GEMINI_PRO 輸出，獲得 ${parsedResult.deduplicated_news.length} 筆去重後新聞`);
        return parsedResult.deduplicated_news;
      } else if (parsedResult && parsedResult.news && Array.isArray(parsedResult.news)) {
        Logger.log(`P5 Daily V8.12：使用備用欄位 'news'，獲得 ${parsedResult.news.length} 筆新聞`);
        return parsedResult.news;
      } else {
        Logger.log(`P5 Daily V8.12：⚠️ GEMINI_PRO 輸出格式不符合預期，使用默認值`);
        throw new Error("GEMINI_PRO 輸出格式不符合預期");
      }
    }
    
    Logger.log(`P5 Daily V8.12：⚠️ GEMINI_PRO 返回空結果，使用默認值`);
    return [];
    
  } catch (error) {
    Logger.log(`P5 Daily：多語去重和分類失敗：${error.message}`);
      return atomizedNews.map(news => ({
        ...news,
        category: "其他",
        importance: "MEDIUM",
        event_type: { primary: "其他", secondary: [] },
        impact_scope: "STOCK",
        sentiment_polarity: "NEUTRAL",
        related_tickers: [],
        data_type: "NARRATIVE",
        data_recency: "UNCLEAR",
        data_coherence: "CONSISTENT"
      }));
  }
}

/**
 * 驗證新聞數據（使用Daily DB硬數據）⭐ V8.12 新增
 * 由Gemini Pro執行驗證邏輯，使用我們提供的Daily DB數據，禁止AI自行網路搜尋
 * 
 * @param {Object} news - 新聞對象
 * @param {Object} dailyDBData - Daily DB硬數據（包含股價、匯率、利率、ETF等）
 * @returns {Object} verificationResult - 驗證結果
 */
function verifyNewsDataWithDailyDB(news, dailyDBData) {
  if (!news || !dailyDBData) {
    return {
      data_verification: "NOT_VERIFIED",
      narrative_direction: null,
      market_confirmation: null,
      cross_asset_resonance: null,
      verification_details: {}
    };
  }
  
  try {
    const jobId = `NEWS_VERIFY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      news: news,
      daily_db_data: dailyDBData,  // 提供Daily DB硬數據給AI
      task: "verify_news_data",
      instructions: `
請使用提供的Daily DB硬數據驗證以下新聞：

**重要限制**：
- ❌ **禁止讓AI去網路搜尋**，避免AI幻覺
- ✅ **只能使用我們提供的Daily DB數據**進行驗證
- ✅ 所有驗證邏輯由AI模型智慧判斷，不寫死程式邏輯

**驗證任務**：

**1. 數據驗證（Cross-check）**
- 檢查新聞中提到的數值是否與Daily DB數據一致
- 例如：新聞說「油價上漲4.2%」→ 檢查Daily DB中的USO/XLE數據
- 例如：新聞說「10年美債利率3.5%」→ 檢查Daily DB中的US10Y數據
- 輸出：DATA_VERIFICATION = VERIFIED | NOT_VERIFIED | NOT_APPLICABLE

**2. Proxy驗證（方向與敘事檢驗）**
使用Proxy驗證「方向與敘事是否被市場行為支持」：

**① 敘事方向檢驗 (Direction Check)**
- 檢查對應proxy是否「明顯朝同一方向移動」？
- 例如：新聞說「油價大漲」→ 檢查USO/XLE是否上漲
- 輸出：NARRATIVE_DIRECTION = CONSISTENT | UNCONFIRMED | CONFLICTING

**② 市場重要性檢驗 (Significance Check)**
- 市場有沒有把這件事當一回事？
- 檢查proxy的幅度/成交量/是否突破
- 例如：新聞說「AI泡沫破裂」→ SOXX只是-0.4%、量縮 → 市場不買單
- 輸出：MARKET_CONFIRMATION = STRONG | MODERATE | WEAK

**③ 共振檢驗 (Cross-Asset Resonance)**
- 真正重要的新聞，通常會產生「共振」
- 例如：原油新聞 → USO + XLE + CAD/NOK都反應
- 如果新聞很大，但proxy沒有「多點共振」→ 不能給高權重
- 輸出：CROSS_ASSET_RESONANCE = STRONG | MODERATE | WEAK

**⚠️ 重要原則**：
- ❌ **禁止**：用ETF/proxy去驗證新聞中的精確數字（如「油價上漲4.2%」）
- ✅ **允許**：用Proxy驗證「方向與敘事是否被市場行為支持」
- 新聞中的數字存在，但標記為「未驗證、僅敘事引用」
- 如果無法確定，標記為NOT_VERIFIED或UNCONFIRMED

**輸出格式（JSON）**：
{
  "data_verification": "VERIFIED / NOT_VERIFIED / NOT_APPLICABLE",
  "narrative_direction": "CONSISTENT / UNCONFIRMED / CONFLICTING",
  "market_confirmation": "STRONG / MODERATE / WEAK",
  "cross_asset_resonance": "STRONG / MODERATE / WEAK",
  "verification_details": {
    "checked_assets": ["USO", "XLE"],
    "reasoning": "驗證邏輯說明"
  }
}
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
            throw new Error("無法解析驗證結果");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      return {
        data_verification: parsedResult.data_verification || "NOT_VERIFIED",
        narrative_direction: parsedResult.narrative_direction || null,
        market_confirmation: parsedResult.market_confirmation || null,
        cross_asset_resonance: parsedResult.cross_asset_resonance || null,
        verification_details: parsedResult.verification_details || {}
      };
    }
    
    return {
      data_verification: "NOT_VERIFIED",
      narrative_direction: null,
      market_confirmation: null,
      cross_asset_resonance: null,
      verification_details: {}
    };
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：新聞數據驗證失敗：${error.message}`);
    return {
      data_verification: "NOT_VERIFIED",
      narrative_direction: null,
      market_confirmation: null,
      cross_asset_resonance: null,
      verification_details: {}
    };
  }
}

/**
 * 批量驗證新聞數據（在Daily流程中調用）⭐ V8.12 新增
 * 
 * @param {Array} newsList - 新聞列表
 * @param {Object} macroData - 宏觀數據（Daily DB硬數據）
 * @returns {Array} verifiedNewsList - 驗證後的新聞列表
 */
function batchVerifyNewsData(newsList, macroData) {
  if (!newsList || newsList.length === 0) {
    return [];
  }
  
  // 構建Daily DB數據結構（供驗證使用）
  const dailyDBData = {
    commodities: macroData.commodities || {},
    currencies: macroData.currencies || {},
    bonds: macroData.bonds || {},
    indices: macroData.indices || {},
    sector_etf: {},  // 需要從其他數據源獲取
    // 其他Daily DB數據...
  };
  
  const verifiedNewsList = [];
  
  // 只對需要驗證的新聞進行驗證（避免過度消耗AI算力）
  for (const news of newsList) {
    // 如果數據類型是HARD且DATA_COHERENCE不是CONSISTENT，或屬於高權重宏觀新聞，則進行驗證
    const needsVerification = 
      (news.data_type === "HARD" && news.data_coherence !== "CONSISTENT") ||
      (news.impact_scope === "GLOBAL" && (news.event_type?.primary?.includes("Central_Bank") || 
                                          news.event_type?.primary?.includes("Econ_Data")));
    
    if (needsVerification) {
      const verificationResult = verifyNewsDataWithDailyDB(news, dailyDBData);
      
      // 更新新聞的驗證標記
      news.data_verification = verificationResult.data_verification;
      news.narrative_direction = verificationResult.narrative_direction;
      news.market_confirmation = verificationResult.market_confirmation;
      news.cross_asset_resonance = verificationResult.cross_asset_resonance;
      news.verification_details_json = JSON.stringify(verificationResult.verification_details);
    }
    
    verifiedNewsList.push(news);
  }
  
  Logger.log(`P5 Daily V8.12：批量驗證完成，共 ${verifiedNewsList.length} 筆新聞`);
  
  return verifiedNewsList;
}

/**
 * GEMINI_PRO 簡單留存每日世界觀快照（不進行推理分析）
 * ⭐ V8.0 修正：Daily 只做簡單快照留存，整週的快照連貫性動態分析是 Weekly 的工作
 * 
 * @param {Array} deduplicatedNews - 去重後的新聞列表
 * @param {Object} macroData - 宏觀數據
 * @returns {Array} newsWithSnapshot - 新聞列表（添加簡單快照標記）
 */
function saveDailyWorldviewSnapshot(deduplicatedNews, macroData) {
  if (!deduplicatedNews || deduplicatedNews.length === 0) {
    return [];
  }
  
  try {
    const jobId = `NEWS_SNAPSHOT_${Date.now()}`;
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 讀取昨日快照（用於簡單對比）
    const yesterdaySnapshot = getLatestDailyWorldviewSnapshot();
    
    const payload = {
      deduplicated_news: deduplicatedNews,
      macro_data: macroData,
      previous_snapshot: yesterdaySnapshot,
      task: "save_daily_snapshot",
      instructions: `
請對以下去重和分類後的新聞進行簡單快照留存：

1. **簡單整理**：將今日新聞按類別整理成結構化格式
2. **簡單摘要**：為每類新聞生成簡短摘要（不進行深度分析）
3. **簡單快照**：生成今日世界觀快照（僅記錄事實，不進行推理）

請返回 JSON 格式的快照結果，包含：
- news_summary: 按類別整理的新聞摘要
- macro_summary: 宏觀數據摘要
- worldview_snapshot: 今日世界觀快照（僅記錄事實，不進行推理分析）
- snapshot_date: 快照日期

**重要**：
- 不要進行深度分析或推理
- 不要分析與歷史新聞的關聯性（這是 Weekly 的工作）
- 只做簡單的整理和摘要
- 快照應該只記錄事實，不包含預測或結論

請返回 JSON 格式的結果。
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
      
      // 保存簡單快照
      const worldviewSnapshot = parsedResult.worldview_snapshot || {};
      const newsSummary = parsedResult.news_summary || {};
      const macroSummary = parsedResult.macro_summary || {};
      
      saveDailyWorldviewSnapshotToSheet(dateStr, worldviewSnapshot, newsSummary, macroSummary);
      
      // 為每筆新聞添加簡單標記（不添加分析結果）
      return deduplicatedNews.map(news => ({
        ...news,
        snapshot_date: dateStr,
        snapshot_marked: true
      }));
    }
    
    return deduplicatedNews;
    
  } catch (error) {
    Logger.log(`P5 Daily：簡單快照留存失敗：${error.message}`);
    return deduplicatedNews;
  }
}

/**
 * 獲取歷史新聞原子數據
 * 
 * @param {number} days - 獲取最近多少天的新聞
 * @returns {Array} historicalNews - 歷史新聞列表
 */
function getHistoricalNewsAtoms(days) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const titleCol = headers.indexOf("title");
    const summaryCol = headers.indexOf("summary");
    const categoryCol = headers.indexOf("category");
    const macroContextCol = headers.indexOf("macro_context_json");
    
    if (dateCol === -1) {
      return [];
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const historicalNews = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= cutoffDate) {
        historicalNews.push({
          date: rows[i][dateCol],
          title: rows[i][titleCol] || "",
          summary: rows[i][summaryCol] || "",
          category: rows[i][categoryCol] || "",
          macro_context: rows[i][macroContextCol] ? JSON.parse(rows[i][macroContextCol]) : {}
        });
      }
    }
    
    return historicalNews;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取歷史新聞失敗：${error.message}`);
    return [];
  }
}

/**
 * 保存每日世界觀快照到表格
 * ⭐ V8.0 修正：只保存簡單快照，不進行推理分析
 * 
 * @param {string} dateStr - 日期字符串
 * @param {Object} worldviewSnapshot - 世界觀快照
 * @param {Object} newsSummary - 新聞摘要
 * @param {Object} macroSummary - 宏觀數據摘要
 */
function saveDailyWorldviewSnapshotToSheet(dateStr, worldviewSnapshot, newsSummary, macroSummary) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("WORLDVIEW_DAILY");
      sheet.appendRow(WORLDVIEW_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const today = new Date();
    
    const row = [
      dateStr,
      JSON.stringify(worldviewSnapshot || {}),
      JSON.stringify(newsSummary || {}),
      JSON.stringify(macroSummary || {}),
      today,
      "V8.0"  // ⭐ V8.0 修正：只做簡單快照留存，不進行推理分析
    ];
    
    sheet.appendRow(row);
    
    Logger.log(`P5 Daily：已保存每日世界觀快照（${dateStr}）`);
    
  } catch (error) {
    Logger.log(`P5 Daily：保存每日世界觀快照失敗：${error.message}`);
  }
}

/**
 * 獲取最新的每日世界觀快照
 * 
 * @returns {Object|null} 最新的快照或 null
 */
function getLatestDailyWorldviewSnapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    return {
      date: row[getColIndex("date")] || null,
      worldview_snapshot: row[getColIndex("worldview_snapshot_json")] ? 
        JSON.parse(row[getColIndex("worldview_snapshot_json")]) : {},
      news_summary: row[getColIndex("news_summary_json")] ? 
        JSON.parse(row[getColIndex("news_summary_json")]) : {},
      macro_summary: row[getColIndex("macro_summary_json")] ? 
        JSON.parse(row[getColIndex("macro_summary_json")]) : {}
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取最新每日世界觀快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存世界觀更新（已廢棄，保留以備向後兼容）
 * ⭐ V8.0 修正：此函數已廢棄，改為使用 saveDailyWorldviewSnapshotToSheet
 * 
 * @param {Object} worldviewUpdate - 世界觀更新
 * @param {Array} conclusions - 關鍵結論
 */
function saveWorldviewUpdate(worldviewUpdate, conclusions) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("WORLDVIEW_DAILY");
      sheet.appendRow(WORLDVIEW_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 提取相關新聞原子 ID（從 worldviewUpdate 中）
    const relatedNewsAtoms = [];
    if (worldviewUpdate && typeof worldviewUpdate === 'object') {
      // 嘗試從 worldviewUpdate 中提取相關的新聞原子 ID
      // 這取決於 GPT-5.2 的輸出格式
      for (const key in worldviewUpdate) {
        if (worldviewUpdate[key] && typeof worldviewUpdate[key] === 'object') {
          if (worldviewUpdate[key].related_atom_ids) {
            relatedNewsAtoms.push(...worldviewUpdate[key].related_atom_ids);
          }
        }
      }
    }
    
    // 生成宏觀數據上下文摘要
    const macroContextSummary = {};
    if (worldviewUpdate && typeof worldviewUpdate === 'object') {
      // 提取宏觀數據相關的更新點
      for (const key in worldviewUpdate) {
        if (key.includes('macro') || key.includes('經濟') || key.includes('市場')) {
          macroContextSummary[key] = worldviewUpdate[key];
        }
      }
    }
    
    const row = [
      dateStr,
      JSON.stringify(worldviewUpdate || {}),
      JSON.stringify(conclusions || []),
      Object.keys(worldviewUpdate || {}).length,
      (conclusions || []).length,
      JSON.stringify(relatedNewsAtoms),
      JSON.stringify(macroContextSummary),
      today
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 Daily：已保存世界觀更新（${Object.keys(worldviewUpdate || {}).length} 個更新點，${(conclusions || []).length} 個結論）`);
    
  } catch (error) {
    Logger.log(`P5 Daily：保存世界觀更新失敗：${error.message}`);
  }
}

/**
 * 從 URL 提取來源
 * 
 * @param {string} url - URL
 * @returns {string} source - 來源名稱
 */
function extractSourceFromUrl(url) {
  try {
    if (!url) return "未知";
    
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 提取主要域名
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2] + '.' + parts[parts.length - 1];
    }
    
    return hostname;
  } catch (error) {
    return "未知";
  }
}

/**
 * 檢測語言（簡單實現）
 * 
 * @param {string} text - 文本
 * @returns {string} language - 語言代碼（zh, en, ja 等）
 */
function detectLanguage(text) {
  if (!text) return "unknown";
  
  // 簡單的語言檢測（可以後續改進）
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return "zh";
  } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return "ja";
  } else {
    return "en";
  }
}

/**
 * 建立個股新聞索引（反向索引）⭐ V8.12 新增
 * 聚合當日熱點表，讓 Weekly 可以用「股票代碼」反查所有相關新聞
 * 主要功能：上標籤，讓weekly做"個股當周策略"時，能夠快速引入做為決策因子之一
 * 
 * @param {Object} newsAtoms - 新聞原子化數據（key: atom_id, value: news object）
 * @param {string} dateStr - 日期字串（YYYY-MM-DD）
 * @returns {Object} tickerIndex - 個股新聞索引（key: ticker, value: index object）
 */
function buildTickerNewsIndex(newsAtoms, dateStr) {
  const tickerIndex = {};
  const today = new Date();
  
  try {
    // 遍歷所有新聞，按ticker聚合
    for (const atomId in newsAtoms) {
      const news = newsAtoms[atomId];
      
      // 從related_tickers_json中提取關聯股票代碼
      let relatedTickers = [];
      try {
        if (news.related_tickers_json) {
          relatedTickers = JSON.parse(news.related_tickers_json);
        }
      } catch (e) {
        Logger.log(`解析related_tickers_json失敗：${e.message}`);
      }
      
      // 如果沒有related_tickers，嘗試從ticker欄位獲取（兼容性）
      if (relatedTickers.length === 0 && news.ticker) {
        relatedTickers = [news.ticker];
      }
      
      // 為每個ticker建立索引
      for (const ticker of relatedTickers) {
        if (!ticker || ticker.trim() === "") continue;
        
        const tickerUpper = ticker.toUpperCase().trim();
        
        if (!tickerIndex[tickerUpper]) {
          tickerIndex[tickerUpper] = {
            date: dateStr,
            ticker: tickerUpper,
            news_count: 0,
            bullish_count: 0,
            bearish_count: 0,
            neutral_count: 0,
            news_ids: []
          };
        }
        
        // 統計新聞數量和情緒分布
        tickerIndex[tickerUpper].news_count++;
        tickerIndex[tickerUpper].news_ids.push(atomId);
        
        // 根據sentiment_polarity統計情緒
        const sentiment = news.sentiment_polarity || "NEUTRAL";
        if (sentiment === "VERY_BULLISH" || sentiment === "SLIGHTLY_BULLISH") {
          tickerIndex[tickerUpper].bullish_count++;
        } else if (sentiment === "VERY_BEARISH" || sentiment === "SLIGHTLY_BEARISH") {
          tickerIndex[tickerUpper].bearish_count++;
        } else {
          tickerIndex[tickerUpper].neutral_count++;
        }
      }
    }
    
    // 為每個ticker生成情緒摘要
    for (const ticker in tickerIndex) {
      const index = tickerIndex[ticker];
      const sentimentSummary = {
        total: index.news_count,
        bullish: index.bullish_count,
        bearish: index.bearish_count,
        neutral: index.neutral_count,
        bullish_ratio: index.news_count > 0 ? (index.bullish_count / index.news_count).toFixed(2) : "0.00",
        bearish_ratio: index.news_count > 0 ? (index.bearish_count / index.news_count).toFixed(2) : "0.00",
        net_sentiment: index.bullish_count - index.bearish_count  // 淨情緒（利多 - 利空）
      };
      
      index.sentiment_summary_json = JSON.stringify(sentimentSummary);
    }
    
    Logger.log(`P5 Daily V8.12：建立個股新聞索引完成，共 ${Object.keys(tickerIndex).length} 個ticker`);
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：建立個股新聞索引失敗：${error.message}`);
  }
  
  return tickerIndex;
}

/**
 * 保存個股新聞索引到 STOCK_NEWS_INDEX_DAILY 表格 ⭐ V8.12 新增
 * 
 * @param {Object} tickerIndex - 個股新聞索引（key: ticker, value: index object）
 * @param {string} dateStr - 日期字串（YYYY-MM-DD）
 */
function saveTickerNewsIndexToSheet(tickerIndex, dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(STOCK_NEWS_INDEX_DAILY_SCHEMA.sheetName);
    
    // 如果表格不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet(STOCK_NEWS_INDEX_DAILY_SCHEMA.sheetName);
      sheet.appendRow(STOCK_NEWS_INDEX_DAILY_SCHEMA.headers);
    }
    
    // 確保表頭正確
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length !== STOCK_NEWS_INDEX_DAILY_SCHEMA.headers.length) {
      // 表頭不匹配，重新設置
      sheet.clear();
      sheet.appendRow(STOCK_NEWS_INDEX_DAILY_SCHEMA.headers);
    }
    
    // 刪除當天的舊數據（如果存在）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const dateColIndex = headers.indexOf("date");
      if (dateColIndex >= 0) {
        const dateRange = sheet.getRange(2, dateColIndex + 1, lastRow - 1, 1);
        const dateValues = dateRange.getValues();
        
        for (let i = dateValues.length - 1; i >= 0; i--) {
          if (dateValues[i][0] === dateStr) {
            sheet.deleteRow(i + 2);  // +2 因為從第2行開始，且索引從0開始
          }
        }
      }
    }
    
    // 保存新的索引數據
    const today = new Date();
    const rows = [];
    
    for (const ticker in tickerIndex) {
      const index = tickerIndex[ticker];
      rows.push([
        index.date,
        index.ticker,
        index.news_count,
        index.bullish_count,
        index.bearish_count,
        index.neutral_count,
        JSON.stringify(index.news_ids),
        index.sentiment_summary_json,
        today
      ]);
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily V8.12：保存個股新聞索引完成，共 ${rows.length} 筆`);
    }
    
  } catch (error) {
    Logger.log(`P5 Daily V8.12：保存個股新聞索引失敗：${error.message}`);
  }
}
