/**
 * 📊 持股財報行事曆新聞更新器 ⭐ V8.0 新增
 * 
 * 功能：
 * 1. 從 P5 Daily 新聞中檢測財報公布相關新聞
 * 2. 更新持股財報行事曆的預估日期
 * 3. 建立索引
 * 
 * @version SSOT V8.0
 * @date 2026-01-19
 */

// ==========================================
// 財報新聞檢測與更新
// ==========================================

/**
 * 從新聞中檢測財報公布相關信息並更新行事曆
 * @param {Array} newsAtoms - 新聞原子化數據列表
 * @returns {Object} 更新結果
 */
function updateHoldingsEarningsCalendarFromNews(newsAtoms) {
  try {
    Logger.log(`開始從新聞中檢測財報公布信息：共 ${newsAtoms.length} 筆新聞`);
    
    const results = {
      detected: 0,
      updated: 0,
      failed: 0,
      updates: []
    };
    
    // 檢測財報相關新聞
    const earningsNews = detectEarningsAnnouncementNews(newsAtoms);
    
    Logger.log(`檢測到 ${earningsNews.length} 筆財報相關新聞`);
    results.detected = earningsNews.length;
    
    // 處理每筆財報新聞
    for (const news of earningsNews) {
      try {
        const updateResult = processEarningsNews(news);
        if (updateResult.success) {
          results.updated++;
          results.updates.push(updateResult);
        } else {
          results.failed++;
        }
      } catch (error) {
        Logger.log(`處理財報新聞失敗：${error.message}`);
        results.failed++;
      }
    }
    
    Logger.log(`✅ 財報行事曆更新完成：檢測 ${results.detected}，更新 ${results.updated}，失敗 ${results.failed}`);
    
    return results;
    
  } catch (error) {
    Logger.log(`從新聞更新財報行事曆失敗：${error.message}`);
    throw error;
  }
}

/**
 * 檢測財報公布相關新聞（使用 AI 分類結果）
 * ⭐ V8.0 更新：不再使用關鍵字檢測，而是使用 AI 分類結果
 * @param {Array} newsAtoms - 新聞原子化數據列表（已由 Flash 清洗和分類）
 * @returns {Array} 財報相關新聞列表
 */
function detectEarningsAnnouncementNews(newsAtoms) {
  const earningsNews = [];
  
  // ⭐ V8.0 更新：使用 AI 分類結果，而不是關鍵字
  // Flash 清洗時已經將財報相關新聞分類為 Earnings_Result 或 Earnings_Date_Announcement
  for (const news of newsAtoms) {
    // 檢查事件類型（AI 分類結果）
    const eventType = news.event_type || {};
    const primaryType = eventType.primary;
    const secondaryTypes = Array.isArray(eventType.secondary) ? eventType.secondary : [];
    
    // 檢測財報相關事件類型
    const isEarningsResult = primaryType === "Earnings_Result" || 
                             secondaryTypes.includes("Earnings_Result");
    const isEarningsDateAnnouncement = primaryType === "Earnings_Date_Announcement" || 
                                       secondaryTypes.includes("Earnings_Date_Announcement");
    
    if (isEarningsResult || isEarningsDateAnnouncement) {
      earningsNews.push(news);
    }
  }
  
  Logger.log(`使用 AI 分類檢測到 ${earningsNews.length} 筆財報相關新聞（Earnings_Result: ${earningsNews.filter(n => (n.event_type?.primary === "Earnings_Result" || n.event_type?.secondary?.includes("Earnings_Result"))).length}, Earnings_Date_Announcement: ${earningsNews.filter(n => (n.event_type?.primary === "Earnings_Date_Announcement" || n.event_type?.secondary?.includes("Earnings_Date_Announcement"))).length}）`);
  
  return earningsNews;
}

/**
 * 處理單筆財報新聞
 * @param {Object} news - 新聞數據
 * @returns {Object} 處理結果
 */
function processEarningsNews(news) {
  try {
    // 從新聞中提取財報信息
    const earningsInfo = extractEarningsInfoFromNews(news);
    
    if (!earningsInfo || !earningsInfo.ticker) {
      return {
        success: false,
        reason: "無法提取財報信息"
      };
    }
    
    // 更新財報行事曆
    const updateResult = updateEarningsDateFromNews(
      earningsInfo.ticker,
      earningsInfo.quarter,
      earningsInfo.earnings_date,
      earningsInfo.announcement_date,
      news
    );
    
    return {
      success: true,
      ticker: earningsInfo.ticker,
      quarter: earningsInfo.quarter,
      earnings_date: earningsInfo.earnings_date,
      announcement_date: earningsInfo.announcement_date,
      news_link: news.link,
      update_result: updateResult
    };
    
  } catch (error) {
    Logger.log(`處理財報新聞失敗：${error.message}`);
    return {
      success: false,
      reason: error.message
    };
  }
}

/**
 * 從新聞中提取財報信息（強制使用 AI 提取的 earnings_date_info）
 * ⭐ V8.17 修正：移除 Regex fallback，強制使用 AI 提供的 earnings_date_info
 * @param {Object} news - 新聞數據（已由 Flash 清洗，必須包含 earnings_date_info）
 * @returns {Object|null} 財報信息（如果 AI 沒有提供，返回 null）
 */
function extractEarningsInfoFromNews(news) {
  // ⭐ V8.17 修正：強制使用 AI 提取的 earnings_date_info，不進行 Regex fallback
  if (news.earnings_date_info) {
    Logger.log(`使用 AI 提取的 earnings_date_info：${JSON.stringify(news.earnings_date_info)}`);
    return {
      ticker: news.earnings_date_info.ticker,
      quarter: news.earnings_date_info.quarter,
      earnings_date: news.earnings_date_info.earnings_date ? new Date(news.earnings_date_info.earnings_date) : null,
      announcement_date: news.earnings_date_info.announcement_date ? new Date(news.earnings_date_info.announcement_date) : null,
      fiscal_year: news.earnings_date_info.fiscal_year,
      confidence: news.earnings_date_info.confidence || 0.8  // AI 提取的置信度通常更高
    };
  }
  
  // ⭐ V8.17 修正：如果 AI 沒有提供 earnings_date_info，直接返回 null
  // 不再使用 Regex 作為 fallback，因為這違反了「AI 已看過並結構化，Code 只要搬運」的原則
  Logger.log(`⚠️ 新聞缺少 AI 提取的 earnings_date_info，跳過處理：${news.title || news.link}`);
  return null;
}

/**
 * 從新聞內容中提取日期信息
 * @param {string} content - 新聞內容
 * @returns {Object} 日期信息
 */
function extractDateFromNews(content) {
  // 日期格式：YYYY-MM-DD, MM/DD/YYYY, Month DD, YYYY 等
  const datePatterns = [
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,  // YYYY-MM-DD
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,  // MM/DD/YYYY
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,  // Month DD, YYYY
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i  // Mon. DD, YYYY
  ];
  
  let earningsDate = null;
  let announcementDate = null;
  let fiscalYear = null;
  
  // 嘗試提取日期
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      try {
        let dateStr;
        if (pattern === datePatterns[0]) {
          // YYYY-MM-DD
          dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else if (pattern === datePatterns[1]) {
          // MM/DD/YYYY
          dateStr = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        } else {
          // Month DD, YYYY 或 Mon. DD, YYYY
          const monthMap = {
            "january": "01", "jan": "01",
            "february": "02", "feb": "02",
            "march": "03", "mar": "03",
            "april": "04", "apr": "04",
            "may": "05",
            "june": "06", "jun": "06",
            "july": "07", "jul": "07",
            "august": "08", "aug": "08",
            "september": "09", "sep": "09",
            "october": "10", "oct": "10",
            "november": "11", "nov": "11",
            "december": "12", "dec": "12"
          };
          const month = monthMap[match[1].toLowerCase()];
          if (month) {
            dateStr = `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
          }
        }
        
        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            earningsDate = date;
            fiscalYear = date.getFullYear();
            
            // 公告日期通常是財報日期前 10-20 天
            announcementDate = new Date(date);
            announcementDate.setDate(announcementDate.getDate() - 15);  // 預設 15 天前
            
            break;
          }
        }
      } catch (e) {
        // 解析失敗，繼續嘗試下一個模式
      }
    }
  }
  
  return {
    earnings_date: earningsDate,
    announcement_date: announcementDate,
    fiscal_year: fiscalYear
  };
}

/**
 * 從新聞更新財報日期
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度
 * @param {Date} earningsDate - 財報日期
 * @param {Date} announcementDate - 公告日期
 * @param {Object} news - 新聞數據
 * @returns {Object} 更新結果
 */
function updateEarningsDateFromNews(ticker, quarter, earningsDate, announcementDate, news) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`⚠ EARNINGS_CALENDAR 表格不存在或為空，無法更新 ${ticker}`);
      return {
        success: false,
        reason: "EARNINGS_CALENDAR 表格不存在"
      };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const quarterCol = headers.indexOf("quarter");
    const dateCol = headers.indexOf("earnings_date");
    const statusCol = headers.indexOf("status");
    const updatedAtCol = headers.indexOf("updated_at");
    const dataSourceCol = headers.indexOf("data_source");
    const newsLinkCol = headers.indexOf("news_link");
    
    if (tickerCol === -1 || dateCol === -1) {
      return {
        success: false,
        reason: "EARNINGS_CALENDAR 表格缺少必要欄位"
      };
    }
    
    // 查找對應的記錄
    let updated = false;
    for (let i = 1; i < rows.length; i++) {
      const rowTicker = rows[i][tickerCol];
      const rowQuarter = quarterCol !== -1 ? rows[i][quarterCol] : null;
      
      // 匹配股票代碼和季度（如果提供）
      if (rowTicker === ticker && (!quarter || rowQuarter === quarter)) {
        // 更新日期
        if (earningsDate) {
          sheet.getRange(i + 1, dateCol + 1).setValue(earningsDate);
        }
        
        // 更新狀態為 CONFIRMED
        if (statusCol !== -1) {
          sheet.getRange(i + 1, statusCol + 1).setValue("CONFIRMED");
        }
        
        // 更新數據來源
        if (dataSourceCol !== -1) {
          sheet.getRange(i + 1, dataSourceCol + 1).setValue("NEWS_EXTRACTED");
        }
        
        // 更新新聞鏈接
        if (newsLinkCol !== -1 && news.link) {
          sheet.getRange(i + 1, newsLinkCol + 1).setValue(news.link);
        }
        
        // 更新時間戳
        if (updatedAtCol !== -1) {
          sheet.getRange(i + 1, updatedAtCol + 1).setValue(new Date());
        }
        
        updated = true;
        Logger.log(`✅ 更新財報日期：${ticker} ${quarter || ""} -> ${earningsDate ? Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : "N/A"}`);
        
        // 如果提供了季度，只更新第一筆匹配的記錄
        if (quarter) {
          break;
        }
      }
    }
    
    // 如果沒有找到現有記錄，創建新記錄
    if (!updated && earningsDate) {
      const newRow = [];
      headers.forEach(header => {
        switch (header) {
          case "ticker":
            newRow.push(ticker);
            break;
          case "quarter":
            newRow.push(quarter || "");
            break;
          case "earnings_date":
            newRow.push(earningsDate);
            break;
          case "status":
            newRow.push("CONFIRMED");
            break;
          case "data_source":
            newRow.push("NEWS_EXTRACTED");
            break;
          case "news_link":
            newRow.push(news.link || "");
            break;
          case "created_at":
            newRow.push(new Date());
            break;
          case "updated_at":
            newRow.push(new Date());
            break;
          default:
            newRow.push("");
        }
      });
      sheet.appendRow(newRow);
      Logger.log(`✅ 新增財報日期：${ticker} ${quarter || ""} -> ${Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd")}`);
      updated = true;
    }
    
    // 更新索引
    if (updated) {
      updateHoldingsEarningsIndex(ticker);
    }
    
    return {
      success: updated,
      ticker: ticker,
      quarter: quarter,
      earnings_date: earningsDate
    };
    
  } catch (error) {
    Logger.log(`更新財報日期失敗：${error.message}`);
    return {
      success: false,
      reason: error.message
    };
  }
}

/**
 * 更新持股財報索引
 * @param {string} ticker - 股票代碼
 */
function updateHoldingsEarningsIndex(ticker) {
  // 調用 27_HOLDINGS_EARNINGS_GENERATOR.js 中的 createTickerEarningsIndex
  // 或實現簡化版本
  Logger.log(`更新 ${ticker} 財報索引`);
}
