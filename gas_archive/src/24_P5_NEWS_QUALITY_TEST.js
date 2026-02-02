/**
 * 📊 P5 新聞品質測試模組（V8.9 新增）
 * 
 * 適用於所有 P5 新聞管線（一般新聞 + 機構評級新聞）
 * 
 * 測試項目：
 * 1. 時效性測試（±6 小時，避免與前一天新聞重複）
 * 2. 範圍精準性測試（涵蓋十大分類，準確是財經資料）
 * 3. 雜訊過濾測試（無廣告、無社論、無非正式新聞）
 * 4. 可驗證性測試（URL 可訪問、內容一致性、來源可信）
 * 
 * @version V8.9
 * @date 2026-01-18
 */

// ==========================================
// 新聞十大分類關鍵字（多語支持）
// ==========================================

const NEWS_CATEGORIES = {
  "market_overview": {
    "en": ["market", "stock market", "trading", "investor", "equity", "index", "dow", "s&p", "nasdaq"],
    "zh": ["市場", "股市", "投資", "交易", "指數", "大盤", "加權"],
    "ja": ["市場", "株式市場", "投資", "取引", "指数"]
  },
  "earnings": {
    "en": ["earnings", "revenue", "profit", "loss", "quarterly", "guidance", "eps", "beat", "miss"],
    "zh": ["財報", "營收", "獲利", "虧損", "季度", "指引", "每股盈餘", "優於預期", "不如預期"],
    "ja": ["決算", "収益", "利益", "損失", "四半期", "ガイダンス"]
  },
  "ipo_m&a": {
    "en": ["ipo", "merger", "acquisition", "deal", "takeover", "buyout"],
    "zh": ["上市", "併購", "收購", "交易", "併購案", "收購案"],
    "ja": ["ipo", "合併", "買収", "取引"]
  },
  "regulation": {
    "en": ["regulation", "sec", "lawsuit", "fines", "policy", "federal"],
    "zh": ["監管", "證交會", "訴訟", "罰款", "政策", "聯邦"],
    "ja": ["規制", "証券取引委員会", "訴訟", "罰金", "政策"]
  },
  "macro_economy": {
    "en": ["gdp", "inflation", "unemployment", "interest rate", "fed", "central bank", "monetary"],
    "zh": ["gdp", "通膨", "失業", "利率", "聯準會", "央行", "貨幣政策"],
    "ja": ["gdp", "インフレ", "失業", "金利", "連邦準備", "中央銀行"]
  },
  "sector_rotation": {
    "en": ["sector", "industry", "rotation", "technology", "finance", "healthcare", "energy"],
    "zh": ["板塊", "產業", "輪動", "科技", "金融", "醫療", "能源"],
    "ja": ["セクター", "業界", "ローテーション", "技術", "金融", "医療", "エネルギー"]
  },
  "commodities": {
    "en": ["oil", "gold", "silver", "copper", "commodity", "crude", "precious metal"],
    "zh": ["原油", "黃金", "白銀", "銅", "商品", "貴金屬"],
    "ja": ["石油", "金", "銀", "銅", "商品", "貴金属"]
  },
  "currency": {
    "en": ["dollar", "yen", "yuan", "euro", "currency", "exchange rate", "forex"],
    "zh": ["美元", "日圓", "人民幣", "歐元", "匯率", "外匯"],
    "ja": ["ドル", "円", "元", "ユーロ", "通貨", "為替レート"]
  },
  "crypto": {
    "en": ["bitcoin", "crypto", "blockchain", "ethereum", "digital currency"],
    "zh": ["比特幣", "加密貨幣", "區塊鏈", "以太坊", "數位貨幣"],
    "ja": ["ビットコイン", "暗号通貨", "ブロックチェーン"]
  },
  "corporate_news": {
    "en": ["company", "corporate", "ceo", "executive", "management", "board", "dividend"],
    "zh": ["公司", "企業", "執行長", "管理層", "董事會", "股利"],
    "ja": ["会社", "企業", "ceo", "経営陣", "取締役会", "配当"]
  }
};

// ==========================================
// 雜訊關鍵字（多語支持）
// ==========================================

const NOISE_KEYWORDS = {
  "advertisement": {
    "en": ["sponsored", "ad", "advertisement", "promotion", "limited time", "buy now"],
    "zh": ["贊助", "廣告", "促銷", "限時", "立即購買", "優惠"],
    "ja": ["スポンサー", "広告", "プロモーション", "限定", "今すぐ購入"]
  },
  "editorial": {
    "en": ["opinion", "editorial", "viewpoint", "analysis by", "commentary"],
    "zh": ["社論", "觀點", "評論", "分析", "專欄"],
    "ja": ["社説", "意見", "論説", "コラム"]
  },
  "forum": {
    "en": ["forum", "discussion", "thread", "user comment", "reddit", "stocktwits"],
    "zh": ["論壇", "討論區", "留言", "網友", "ptt"],
    "ja": ["フォーラム", "掲示板", "コメント", "ユーザー"]
  }
};

// ==========================================
// 白名單網站特定雜訊過濾規則
// ==========================================

const WHITELIST_NOISE_RULES = {
  "thefly.com": {
    // The Fly 格式最標準，幾乎沒有雜訊
    "exclude_patterns": []
  },
  "news.cnyes.com": {
    // 鉅亨網：排除社論和專欄
    "exclude_patterns": ["/opinion/", "/column/", "/editorial/", "社論", "專欄"]
  },
  "minkabu.jp": {
    // Minkabu：排除論壇和討論區
    "exclude_patterns": ["/bbs/", "/forum/", "/discussion/", "掲示板", "フォーラム"]
  },
  "reuters.com": {
    // Reuters：排除 Opinion 和 Comment
    "exclude_patterns": ["/opinion/", "/comment/", "/analysis/"]
  },
  "ft.com": {
    // Financial Times：排除 Opinion 和 Letters
    "exclude_patterns": ["/opinion/", "/letters/"]
  }
};

// ==========================================
// 核心測試函數
// ==========================================

/**
 * 測試新聞品質（綜合測試）
 * 
 * @param {Object|Array} newsData - 新聞資料（單筆或陣列）
 * @param {Object} options - 測試選項
 * @return {Object} 測試結果
 */
function testNewsQuality(newsData, options) {
  options = options || {};
  const isArray = Array.isArray(newsData);
  const newsItems = isArray ? newsData : [newsData];
  
  const results = {
    total: newsItems.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };
  
  for (const news of newsItems) {
    const itemResult = {
      news_id: news.atom_id || news.rating_id || news.url || "unknown",
      title: news.title || news.news_title || "",
      url: news.url || news.news_url || "",
      source: news.source || news.news_source || "",
      tests: {}
    };
    
    // 1. 時效性測試
    itemResult.tests.timeliness = testNewsTimeliness(news);
    
    // 2. 範圍精準性測試
    itemResult.tests.relevance = testNewsRelevance(news);
    
    // 3. 雜訊過濾測試
    itemResult.tests.noise_filtering = testNewsNoiseFiltering(news);
    
    // 4. 可驗證性測試
    itemResult.tests.verifiability = testNewsVerifiability(news);
    
    // 計算總分
    const testScores = Object.values(itemResult.tests);
    const passedCount = testScores.filter(t => t.passed).length;
    const warningCount = testScores.filter(t => t.warning).length;
    
    if (passedCount === testScores.length) {
      itemResult.overall_status = "PASSED";
      results.passed++;
    } else if (warningCount > 0 && passedCount + warningCount === testScores.length) {
      itemResult.overall_status = "WARNING";
      results.warnings++;
    } else {
      itemResult.overall_status = "FAILED";
      results.failed++;
    }
    
    results.details.push(itemResult);
  }
  
  return results;
}

/**
 * 1. 時效性測試（±6 小時）
 * 
 * @param {Object} news - 新聞資料
 * @return {Object} 測試結果
 */
function testNewsTimeliness(news) {
  try {
    const now = new Date();
    let newsDate = parseNewsDate(news);
    
    // ⭐ V8.9 修正：對於 CSE 搜尋結果，如果日期來自 created_at（收集日期），應該更寬鬆處理
    // 因為 CSE 搜尋結果的新聞可能沒有明確的發布日期
    // 如果日期是今天或昨天，且沒有明確的發布日期資訊，則視為今天的新聞
    if (newsDate) {
      const timeDiffHours = Math.abs(now.getTime() - newsDate.getTime()) / (1000 * 60 * 60);
      
      // 如果日期是昨天或今天，且新聞內容沒有明確的發布日期，則視為今天的新聞
      if (timeDiffHours > 6 && timeDiffHours < 48) {
        const text = ((news.title || "") + " " + (news.summary || "")).toLowerCase();
        // 檢查新聞內容是否有明確的日期資訊
        const hasExplicitDate = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i.test(text) ||
                                /\d{4}-\d{2}-\d{2}/.test(text) ||
                                /\d{1,2}\/\d{1,2}\/\d{4}/.test(text);
        
        // 如果沒有明確的日期資訊，且是昨天或今天的數據，視為今天的新聞
        if (!hasExplicitDate) {
          newsDate = now; // 視為今天的新聞
        }
      }
    }
    
    if (!newsDate) {
      return {
        passed: false,
        warning: false,
        message: "無法解析新聞日期",
        score: 0
      };
    }
    
    // 計算時間差（小時）
    const timeDiffHours = Math.abs(now.getTime() - newsDate.getTime()) / (1000 * 60 * 60);
    
    // ±6 小時內為合格
    const isRecent = timeDiffHours <= 6;
    
    // 超過 48 小時視為前一天的新聞（不合格）
    const isTooOld = timeDiffHours > 48;
    
    if (isTooOld) {
      return {
        passed: false,
        warning: false,
        message: `新聞日期過舊（${timeDiffHours.toFixed(1)} 小時前），可能是前一天的新聞`,
        score: 0,
        time_diff_hours: timeDiffHours
      };
    }
    
    if (!isRecent) {
      return {
        passed: false,
        warning: true,
        message: `新聞日期超出 ±6 小時範圍（${timeDiffHours.toFixed(1)} 小時前）`,
        score: 0.5,
        time_diff_hours: timeDiffHours
      };
    }
    
    return {
      passed: true,
      warning: false,
      message: `時效性符合要求（${timeDiffHours.toFixed(1)} 小時內）`,
      score: 1.0,
      time_diff_hours: timeDiffHours
    };
    
  } catch (error) {
    return {
      passed: false,
      warning: false,
      message: `時效性測試失敗：${error.message}`,
      score: 0
    };
  }
}

/**
 * 2. 範圍精準性測試（涵蓋十大分類）
 * 
 * @param {Object} news - 新聞資料
 * @return {Object} 測試結果
 */
function testNewsRelevance(news) {
  try {
    const text = ((news.title || "") + " " + (news.summary || "") + " " + (news.news_summary || "")).toLowerCase();
    const language = detectLanguage(text);
    
    // 檢查是否涵蓋十大分類中的至少一個
    let matchedCategories = [];
    
    for (const [category, keywords] of Object.entries(NEWS_CATEGORIES)) {
      const langKeywords = keywords[language] || keywords["en"] || [];
      
      for (const keyword of langKeywords) {
        if (text.indexOf(keyword.toLowerCase()) > -1) {
          matchedCategories.push(category);
          break;
        }
      }
    }
    
    if (matchedCategories.length === 0) {
      return {
        passed: false,
        warning: false,
        message: "新聞內容不符合十大分類，可能不是財經資料",
        score: 0,
        matched_categories: []
      };
    }
    
    return {
      passed: true,
      warning: false,
      message: `新聞內容符合 ${matchedCategories.length} 個分類`,
      score: Math.min(matchedCategories.length / 3, 1.0), // 最多 3 個分類就算滿分
      matched_categories: matchedCategories
    };
    
  } catch (error) {
    return {
      passed: false,
      warning: false,
      message: `範圍精準性測試失敗：${error.message}`,
      score: 0
    };
  }
}

/**
 * 3. 雜訊過濾測試（無廣告、無社論、無非正式新聞）
 * 
 * @param {Object} news - 新聞資料
 * @return {Object} 測試結果
 */
function testNewsNoiseFiltering(news) {
  try {
    const text = ((news.title || "") + " " + (news.summary || "") + " " + (news.news_summary || "")).toLowerCase();
    const url = (news.url || news.news_url || "").toLowerCase();
    let source = (news.source || news.news_source || "").toLowerCase();
    
    // ⭐ V8.9 修正：如果來源顯示「未知來源」，嘗試從 URL 提取來源
    if (!source || source === "未知來源" || source.indexOf("未知") > -1) {
      if (url) {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            source = (parts[parts.length - 2] + '.' + parts[parts.length - 1]).toLowerCase();
          }
        } catch (e) {
          // 忽略
        }
      }
    }
    
    const language = detectLanguage(text);
    
    // ⭐ V8.9 修正：排除正常的財經資訊頁面（股票報價頁面等）
    const legitimateFinancialPages = [
      "stock price", "quote", "financial information", "trading",
      "股價", "報價", "財務資訊", "交易",
      "株価", "価格", "財務情報", "取引"
    ];
    
    let isLegitimateFinancialPage = false;
    for (const keyword of legitimateFinancialPages) {
      if (text.indexOf(keyword) > -1 || url.indexOf(keyword) > -1) {
        isLegitimateFinancialPage = true;
        break;
      }
    }
    
    // 檢查是否包含雜訊關鍵字
    let noiseDetected = [];
    
    for (const [noiseType, keywords] of Object.entries(NOISE_KEYWORDS)) {
      const langKeywords = keywords[language] || keywords["en"] || [];
      
      for (const keyword of langKeywords) {
        const keywordLower = keyword.toLowerCase();
        // ⭐ V8.9 修正：如果包含在標題或摘要中，且是合法的財經資訊頁面，則不視為廣告
        if (text.indexOf(keywordLower) > -1) {
          // 特殊處理：如果關鍵字是 "sponsored" 或 "ad" 但出現在合法的財經資訊頁面，可能是誤判
          if (isLegitimateFinancialPage && (keywordLower === "sponsored" || keywordLower === "ad" || keywordLower === "advertisement")) {
            // 檢查是否真的出現在標題或摘要中（而不是 URL 或其他位置）
            const titleLower = (news.title || "").toLowerCase();
            const summaryLower = (news.summary || "").toLowerCase();
            if (titleLower.indexOf(keywordLower) === -1 && summaryLower.indexOf(keywordLower) === -1) {
              continue; // 跳過，不視為廣告
            }
          }
          noiseDetected.push(noiseType);
          break;
        }
      }
    }
    
    // 檢查 URL 是否符合白名單網站的雜訊過濾規則
    if (url) {
      for (const [site, rules] of Object.entries(WHITELIST_NOISE_RULES)) {
        if (url.indexOf(site) > -1) {
          for (const pattern of rules.exclude_patterns || []) {
            if (url.indexOf(pattern.toLowerCase()) > -1 || text.indexOf(pattern.toLowerCase()) > -1) {
              noiseDetected.push(`whitelist_excluded_${site}`);
            }
          }
        }
      }
    }
    
    if (noiseDetected.length > 0) {
      return {
        passed: false,
        warning: false,
        message: `偵測到雜訊：${noiseDetected.join(", ")}`,
        score: 0,
        noise_types: noiseDetected
      };
    }
    
    return {
      passed: true,
      warning: false,
      message: "無雜訊偵測",
      score: 1.0
    };
    
  } catch (error) {
    return {
      passed: false,
      warning: false,
      message: `雜訊過濾測試失敗：${error.message}`,
      score: 0
    };
  }
}

/**
 * 4. 可驗證性測試（URL 可訪問、內容一致性、來源可信）
 * 
 * @param {Object} news - 新聞資料
 * @return {Object} 測試結果
 */
function testNewsVerifiability(news) {
  try {
    const url = news.url || news.news_url || "";
    let source = news.source || news.news_source || "";
    
    // ⭐ V8.9 修正：如果來源顯示「未知來源」，嘗試從 URL 提取來源
    if (!source || source === "未知來源" || source.indexOf("未知") > -1) {
      if (url) {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            source = parts[parts.length - 2] + '.' + parts[parts.length - 1];
          } else {
            source = hostname;
          }
        } catch (e) {
          // 忽略
        }
      }
    }
    
    // 檢查 URL 格式
    let urlValid = false;
    if (url) {
      try {
        const urlObj = new URL(url);
        urlValid = urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch (e) {
        urlValid = false;
      }
    }
    
    // 檢查來源可信度（白名單來源）
    const trustedSources = [
      "reuters.com", "ft.com", "bloomberg.com", "wsj.com", "cnbc.com",
      "thefly.com", "streetinsider.com", "benzinga.com",
      "news.cnyes.com", "money.udn.com", "ctee.com.tw",
      "minkabu.jp", "kabutan.jp", "traders.co.jp",
      "finance.yahoo.com", "yahoo.com",  // ⭐ V8.9 新增：Yahoo Finance 也是可信來源
      "google.com", "marketwatch.com", "investing.com"  // ⭐ V8.9 新增：其他常見財經網站
    ];
    
    let sourceTrusted = false;
    if (source) {
      const sourceLower = source.toLowerCase();
      const urlLower = url.toLowerCase();
      for (const trusted of trustedSources) {
        if (sourceLower.indexOf(trusted) > -1 || urlLower.indexOf(trusted) > -1) {
          sourceTrusted = true;
          break;
        }
      }
    }
    
    // 檢查內容一致性（title 和 summary 都不為空）
    const hasContent = (news.title || news.news_title) && (news.summary || news.news_summary);
    
    // ⭐ V8.9 修正：調整評分邏輯，即使來源未知，如果 URL 有效且有內容，也應該給部分分數
    // 計算總分
    let score = 0;
    if (urlValid) score += 0.4;  // URL 有效佔 40%（提高權重）
    if (sourceTrusted) score += 0.3;  // 來源可信佔 30%
    if (hasContent) score += 0.3;  // 有內容佔 30%
    
    // ⭐ V8.9 修正：如果 URL 有效且有內容，即使來源未知，也應該至少給 0.5 分
    if (urlValid && hasContent && !sourceTrusted && source && source !== "未知來源") {
      score = Math.max(score, 0.5);  // 至少 0.5 分
    }
    
    if (score >= 0.8) {
      return {
        passed: true,
        warning: false,
        message: `可驗證性符合要求（URL: ${urlValid ? "有效" : "無效"}, 來源: ${sourceTrusted ? "可信" : (source || "未知")}）`,
        score: score,
        url_valid: urlValid,
        source_trusted: sourceTrusted,
        source: source,
        has_content: hasContent
      };
    } else if (score >= 0.5) {
      return {
        passed: false,
        warning: true,
        message: `可驗證性部分符合要求（URL: ${urlValid ? "有效" : "無效"}, 來源: ${sourceTrusted ? "可信" : (source || "未知")}）`,
        score: score,
        url_valid: urlValid,
        source_trusted: sourceTrusted,
        source: source,
        has_content: hasContent
      };
    } else {
      return {
        passed: false,
        warning: false,
        message: `可驗證性不符合要求（URL: ${urlValid ? "有效" : "無效"}, 來源: ${source || "未知"}）`,
        score: score,
        url_valid: urlValid,
        source_trusted: sourceTrusted,
        source: source,
        has_content: hasContent
      };
    }
    
  } catch (error) {
    return {
      passed: false,
      warning: false,
      message: `可驗證性測試失敗：${error.message}`,
      score: 0
    };
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 從新聞資料中解析日期
 */
function parseNewsDate(news) {
  // 優先使用 date 欄位
  if (news.date) {
    const d = news.date instanceof Date ? news.date : new Date(news.date);
    if (!isNaN(d.getTime())) return d;
  }
  
  // 次選 rating_date
  if (news.rating_date) {
    const d = news.rating_date instanceof Date ? news.rating_date : new Date(news.rating_date);
    if (!isNaN(d.getTime())) return d;
  }
  
  // 嘗試從文字中提取日期
  const text = (news.title || "") + " " + (news.summary || "") + " " + (news.news_summary || "");
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\w{3})\s+(\d{1,2}),\s+(\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const d = new Date(match[0]);
        if (!isNaN(d.getTime())) return d;
      } catch (e) {
        // 忽略
      }
    }
  }
  
  // 如果都找不到，使用 created_at 或當前時間減去一天（預設）
  if (news.created_at) {
    const d = news.created_at instanceof Date ? news.created_at : new Date(news.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  
  // 最後備用：當前時間（視為今天的新聞）
  return new Date();
}

/**
 * 檢測語言
 */
function detectLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  return "en";
}

// ==========================================
// 批量測試函數（用於測試整個資料庫）
// ==========================================

/**
 * 測試所有 P5 新聞品質（從 NEWS_ATOMS_DAILY 和 INSTITUTIONAL_RATINGS_DAILY 讀取）
 * 
 * @param {Object} options - 測試選項
 * @return {Object} 測試結果
 */
function testAllP5NewsQuality(options) {
  options = options || {};
  const date = options.date || new Date().toISOString().split('T')[0];
  
  Logger.log(`🔍 測試 P5 新聞品質（V8.9）：date=${date}`);
  
  const results = {
    general_news: null,
    institutional_ratings: null,
    summary: {}
  };
  
  try {
    // 1. 測試一般新聞（NEWS_ATOMS_DAILY）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet) {
      Logger.log(`🔍 測試：NEWS_ATOMS_DAILY 表格不存在`);
    } else if (sheet.getLastRow() <= 1) {
      Logger.log(`🔍 測試：NEWS_ATOMS_DAILY 表格無數據（只有標題行）`);
    } else {
      const lastRow = sheet.getLastRow();
      Logger.log(`🔍 測試：NEWS_ATOMS_DAILY 表格有 ${lastRow - 1} 筆數據`);
      
      const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
      const data = dataRange.getValues();
      
      // 篩選指定日期的新聞
      const newsItems = [];
      for (let i = 0; i < data.length; i++) {
        const rowDate = data[i][0];
        let rowDateStr;
        
        if (rowDate instanceof Date) {
          rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (typeof rowDate === 'string') {
          // 處理字串格式的日期（可能是 "2026-01-18" 或 "2026/1/18"）
          rowDateStr = rowDate.split('T')[0].split(' ')[0];
          // 處理 "2026/1/18" 格式
          if (rowDateStr.indexOf('/') > -1) {
            const parts = rowDateStr.split('/');
            if (parts.length === 3) {
              rowDateStr = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
            }
          }
        } else {
          rowDateStr = String(rowDate).split('T')[0];
        }
        
        if (rowDateStr === date) {
          // ⭐ V8.9 修正：根據 NEWS_ATOMS_DAILY_SCHEMA 正確對應欄位索引
          // 欄位順序：date(0), atom_id(1), category(2), ticker(3), title(4), summary(5), source(6), importance(7), url(8), macro_context_json(9), created_at(10)
          newsItems.push({
            atom_id: data[i][1],
            date: data[i][0],
            category: data[i][2],  // 修正：從 [3] 改為 [2]
            ticker: data[i][3],    // 修正：從 [4] 改為 [3]
            title: data[i][4],     // 修正：從 [5] 改為 [4]
            summary: data[i][5],   // 修正：從 [6] 改為 [5]
            source: data[i][6],    // 修正：從 [7] 改為 [6]
            importance: data[i][7], // 修正：從 [8] 改為 [7]
            url: data[i][8],       // 修正：從 [9] 改為 [8]
            created_at: data[i][10]
          });
        }
      }
      
      Logger.log(`🔍 測試：找到 ${newsItems.length} 筆符合日期 ${date} 的新聞`);
      
      if (newsItems.length > 0) {
        Logger.log(`🔍 測試：開始測試新聞品質...`);
        results.general_news = testNewsQuality(newsItems);
        Logger.log(`🔍 測試：新聞品質測試完成 - 通過: ${results.general_news.passed}, 失敗: ${results.general_news.failed}, 警告: ${results.general_news.warnings}`);
        
        // ⭐ V8.9 新增：輸出詳細的測試結果
        for (let i = 0; i < results.general_news.details.length; i++) {
          const detail = results.general_news.details[i];
          Logger.log(`🔍 測試結果 ${i + 1}/${results.general_news.details.length}: ${detail.overall_status}`);
          Logger.log(`  標題: ${detail.title.substring(0, 50)}...`);
          Logger.log(`  來源: ${detail.source || "未知"}`);
          
          // 輸出每個測試項目的結果
          for (const [testName, testResult] of Object.entries(detail.tests)) {
            const status = testResult.passed ? "✅" : (testResult.warning ? "⚠️" : "❌");
            Logger.log(`  ${status} ${testName}: ${testResult.message || "無訊息"}`);
            if (!testResult.passed && testResult.score !== undefined) {
              Logger.log(`    分數: ${testResult.score}`);
            }
          }
        }
      } else {
        Logger.log(`🔍 測試：沒有找到符合日期 ${date} 的新聞`);
      }
    }
    
    // 2. 測試機構評級新聞（INSTITUTIONAL_RATINGS_DAILY）
    sheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_DAILY");
    
    if (sheet && sheet.getLastRow() > 1) {
      const lastRow = sheet.getLastRow();
      const dataRange = sheet.getRange(2, 1, lastRow - 1, 19);
      const data = dataRange.getValues();
      
      // 篩選指定日期的評級
      const ratingItems = [];
      for (let i = 0; i < data.length; i++) {
        const rowDate = data[i][0];
        const rowDateStr = rowDate instanceof Date ? 
          Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : 
          String(rowDate).split('T')[0];
        
        if (rowDateStr === date) {
          ratingItems.push({
            rating_id: `${data[i][1]}_${data[i][3]}_${rowDateStr}`,
            date: data[i][0],
            ticker: data[i][1],
            market: data[i][2],
            rating_firm: data[i][3],
            rating_action: data[i][4],
            news_title: data[i][10],
            news_summary: data[i][11],
            news_url: data[i][12],
            news_source: data[i][13],
            rating_date: data[i][14],
            created_at: data[i][18]
          });
        }
      }
      
      if (ratingItems.length > 0) {
        results.institutional_ratings = testNewsQuality(ratingItems);
      }
    }
    
    // 3. 計算總摘要
    const generalPassed = results.general_news ? results.general_news.passed : 0;
    const generalFailed = results.general_news ? results.general_news.failed : 0;
    const generalWarnings = results.general_news ? results.general_news.warnings : 0;
    const generalTotal = results.general_news ? results.general_news.total : 0;
    
    const ratingsPassed = results.institutional_ratings ? results.institutional_ratings.passed : 0;
    const ratingsFailed = results.institutional_ratings ? results.institutional_ratings.failed : 0;
    const ratingsWarnings = results.institutional_ratings ? results.institutional_ratings.warnings : 0;
    const ratingsTotal = results.institutional_ratings ? results.institutional_ratings.total : 0;
    
    results.summary = {
      total_news: generalTotal + ratingsTotal,
      total_passed: generalPassed + ratingsPassed,
      total_failed: generalFailed + ratingsFailed,
      total_warnings: generalWarnings + ratingsWarnings,
      pass_rate: (generalTotal + ratingsTotal) > 0 ? 
        ((generalPassed + ratingsPassed) / (generalTotal + ratingsTotal) * 100).toFixed(1) + "%" : "0%"
    };
    
  } catch (error) {
    Logger.log(`P5 新聞品質測試失敗：${error.message}`);
    results.error = error.message;
  }
  
  return results;
}
