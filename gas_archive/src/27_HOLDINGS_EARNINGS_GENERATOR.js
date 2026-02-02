/**
 * 📊 持股財報自動生成系統 ⭐ V8.0 新增
 * 
 * 功能：
 * 1. P0-P4 完成後，自動生成全部股票一年內的歷史財報預估日期
 * 2. 隨著正式公布後更新日期
 * 3. 納入行事曆監控制度
 * 4. 建立個股索引與學習機制
 * 
 * @version SSOT V8.0
 * @date 2026-01-19
 */

// ==========================================
// 自動生成財報預估日期
// ==========================================

/**
 * 自動生成全部股票一年內的歷史財報預估日期（P0-P4 完成後調用）
 * @param {Array} tickers - 股票列表（從 P4 或 HOLDINGS 讀取）
 * @returns {Object} 生成結果
 */
function generateHoldingsEarningsCalendar(tickers) {
  try {
    Logger.log(`開始生成持股財報預估日期：共 ${tickers.length} 檔股票`);
    
    const results = {
      success: 0,
      failed: 0,
      total_earnings_dates: 0
    };
    
    // 分批處理（避免超時）
    const BATCH_SIZE = 10;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      Logger.log(`處理批次 ${Math.floor(i / BATCH_SIZE) + 1}：${batch.length} 檔股票`);
      
      for (const ticker of batch) {
        try {
          const earningsDates = generateTickerEarningsDates(ticker);
          if (earningsDates && earningsDates.length > 0) {
            saveEarningsDatesToCalendar(ticker, earningsDates);
            results.success++;
            results.total_earnings_dates += earningsDates.length;
          } else {
            results.failed++;
          }
        } catch (error) {
          Logger.log(`生成 ${ticker} 財報日期失敗：${error.message}`);
          results.failed++;
        }
      }
      
      // 批次間延遲
      if (i + BATCH_SIZE < tickers.length) {
        Utilities.sleep(1000);
      }
    }
    
    Logger.log(`✅ 持股財報預估日期生成完成：成功 ${results.success}，失敗 ${results.failed}，總計 ${results.total_earnings_dates} 個財報日期`);
    
    return results;
    
  } catch (error) {
    Logger.log(`生成持股財報預估日期失敗：${error.message}`);
    throw error;
  }
}

/**
 * 生成單一股票的財報預估日期（使用 AI 模型）
 * @param {string} ticker - 股票代碼
 * @returns {Array} 財報日期列表
 */
function generateTickerEarningsDates(ticker) {
  try {
    Logger.log(`生成 ${ticker} 財報預估日期`);
    
    // 構建 Prompt
    const prompt = buildEarningsDatesPrompt(ticker);
    
    // 提交到 M0 Job Queue（使用 submitP5ToM0JobQueue，定義在 24_P5_SHARED.js）
    const jobId = submitP5ToM0JobQueue(
      "HOLDINGS_EARNINGS_GENERATOR",
      ["GEMINI_FLASH", "GPT"],  // 使用 Gemini Flash 執行，GPT 審查
      {
        ticker: ticker,
        task_prompt: prompt,
        model: "GEMINI_FLASH"  // 使用 Gemini Flash 3.0
      }
    );
    
    // 等待結果（使用 waitForM0JobResult，定義在 24_P5_WEEKLY_STOCK_STRATEGY.js）
    const result = waitForM0JobResult(jobId);
    
    if (result && result.final_output) {
      // 解析 AI 輸出（M0 結果格式）
      let executorOutput = result.final_output;
      if (typeof executorOutput === 'string') {
        try {
          executorOutput = JSON.parse(executorOutput);
        } catch (e) {
          // 如果解析失敗，直接使用字符串
        }
      }
      const earningsDates = parseAIEarningsDates(
        typeof executorOutput === 'string' ? executorOutput : JSON.stringify(executorOutput),
        ticker
      );
      return earningsDates;
    } else {
      throw new Error("AI 生成財報日期失敗");
    }
    
  } catch (error) {
    Logger.log(`生成 ${ticker} 財報預估日期失敗：${error.message}`);
    throw error;
  }
}

/**
 * 構建 AI Prompt（用於生成財報預估日期）
 * @param {string} ticker - 股票代碼
 * @returns {string} Prompt
 */
function buildEarningsDatesPrompt(ticker) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  return `你是財報日期預估專家。請基於你的內建知識或搜尋，為 ${ticker} 生成未來一年內（${currentYear} 和 ${nextYear}）的財報預估日期。

## 任務

請為 ${ticker} 生成以下資訊：

1. **財年結束日期**：該公司的財年結束日期（例如：1月31日、12月31日等）

2. **未來一年內的財報日期**：
   - Q1 財報預估日期
   - Q2 財報預估日期
   - Q3 財報預估日期
   - Q4 財報預估日期

3. **財報公布時間**：通常是盤前（BEFORE_MARKET）或盤後（AFTER_HOURS）

4. **數據來源**：如果使用搜尋，請註明來源；如果使用內建知識，請標記為 "AI_INFERRED"

## 輸出格式

請以 JSON 格式輸出，包含以下欄位：

\`\`\`json
{
  "ticker": "${ticker}",
  "fiscal_year_end": "2024-01-31",
  "earnings_dates": [
    {
      "quarter": "Q1",
      "fiscal_year": 2024,
      "estimated_date": "2024-05-23",
      "time": "AFTER_HOURS",
      "status": "ESTIMATED",
      "data_source": "AI_INFERRED",
      "confidence": 0.8
    },
    {
      "quarter": "Q2",
      "fiscal_year": 2024,
      "estimated_date": "2024-08-22",
      "time": "AFTER_HOURS",
      "status": "ESTIMATED",
      "data_source": "AI_INFERRED",
      "confidence": 0.8
    },
    {
      "quarter": "Q3",
      "fiscal_year": 2024,
      "estimated_date": "2024-11-21",
      "time": "AFTER_HOURS",
      "status": "ESTIMATED",
      "data_source": "AI_INFERRED",
      "confidence": 0.8
    },
    {
      "quarter": "Q4",
      "fiscal_year": 2024,
      "estimated_date": "2025-02-26",
      "time": "AFTER_HOURS",
      "status": "ESTIMATED",
      "data_source": "AI_INFERRED",
      "confidence": 0.8
    }
  ],
  "generated_at": "${new Date().toISOString()}"
}
\`\`\`

**注意**：
- 如果無法確定具體日期，請提供合理的預估日期（通常是財季結束後 30-45 天）
- 如果使用搜尋獲取實際日期，請標記 status 為 "CONFIRMED" 並提高 confidence
- 如果使用內建知識，請標記 status 為 "ESTIMATED" 並適當降低 confidence`;
}

/**
 * 解析 AI 輸出的財報日期
 * @param {string} aiOutput - AI 輸出
 * @param {string} ticker - 股票代碼
 * @returns {Array} 財報日期列表
 */
function parseAIEarningsDates(aiOutput, ticker) {
  try {
    let jsonString = aiOutput.trim();
    
    // 移除可能的 markdown 代碼塊
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const data = JSON.parse(jsonString);
    
    // 驗證必要欄位
    if (!data.ticker || !data.earnings_dates || !Array.isArray(data.earnings_dates)) {
      throw new Error("AI 輸出格式不正確");
    }
    
    // 轉換為標準格式
    const earningsDates = data.earnings_dates.map(ed => ({
      ticker: ticker,
      company_name: null,  // 可以從其他地方獲取
      earnings_date: new Date(ed.estimated_date),
      quarter: ed.quarter,
      fiscal_year: ed.fiscal_year,
      market: "US",  // 預設為美股
      status: ed.status || "ESTIMATED",
      time: ed.time || "AFTER_HOURS",
      data_source: ed.data_source || "AI_INFERRED",
      confidence: ed.confidence || 0.5,
      created_at: new Date()
    }));
    
    return earningsDates;
    
  } catch (error) {
    Logger.log(`解析 AI 財報日期失敗：${error.message}`);
    throw error;
  }
}

/**
 * 保存財報日期到行事曆
 * @param {string} ticker - 股票代碼
 * @param {Array} earningsDates - 財報日期列表
 */
function saveEarningsDatesToCalendar(ticker, earningsDates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
  
  if (!sheet) {
    // 如果表格不存在，創建它
    sheet = ss.insertSheet("EARNINGS_CALENDAR");
    sheet.appendRow([
      "ticker",
      "company_name",
      "earnings_date",
      "quarter",
      "fiscal_year",
      "market",
      "status",
      "time",
      "data_source",
      "confidence",
      "created_at",
      "updated_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (const ed of earningsDates) {
    // 檢查是否已存在（根據 ticker 和 earnings_date）
    const existingRow = findEarningsDateRow(sheet, ticker, ed.earnings_date);
    
    if (existingRow) {
      // 更新現有記錄
      updateEarningsDateRow(sheet, existingRow, {
        quarter: ed.quarter,
        fiscal_year: ed.fiscal_year,
        status: ed.status,
        time: ed.time,
        data_source: ed.data_source,
        confidence: ed.confidence,
        updated_at: new Date()
      });
    } else {
      // 新增記錄
      const row = [];
      headers.forEach(header => {
        switch (header) {
          case "ticker":
            row.push(ed.ticker);
            break;
          case "company_name":
            row.push(ed.company_name || "");
            break;
          case "earnings_date":
            row.push(ed.earnings_date);
            break;
          case "quarter":
            row.push(ed.quarter);
            break;
          case "fiscal_year":
            row.push(ed.fiscal_year);
            break;
          case "market":
            row.push(ed.market || "US");
            break;
          case "status":
            row.push(ed.status || "ESTIMATED");
            break;
          case "time":
            row.push(ed.time || "AFTER_HOURS");
            break;
          case "data_source":
            row.push(ed.data_source || "AI_INFERRED");
            break;
          case "confidence":
            row.push(ed.confidence || 0.5);
            break;
          case "created_at":
            row.push(new Date());
            break;
          case "updated_at":
            row.push(new Date());
            break;
          default:
            row.push("");
        }
      });
      sheet.appendRow(row);
    }
  }
}

/**
 * 更新財報日期（當正式公布後）
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度
 * @param {Date} confirmedDate - 確認日期
 */
function updateEarningsDate(ticker, quarter, confirmedDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("EARNINGS_CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const quarterCol = headers.indexOf("quarter");
  const dateCol = headers.indexOf("earnings_date");
  const statusCol = headers.indexOf("status");
  const updatedAtCol = headers.indexOf("updated_at");
  
  if (tickerCol === -1 || quarterCol === -1 || dateCol === -1) {
    return;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker && rows[i][quarterCol] === quarter) {
      // 更新日期和狀態
      sheet.getRange(i + 1, dateCol + 1).setValue(confirmedDate);
      if (statusCol !== -1) {
        sheet.getRange(i + 1, statusCol + 1).setValue("CONFIRMED");
      }
      if (updatedAtCol !== -1) {
        sheet.getRange(i + 1, updatedAtCol + 1).setValue(new Date());
      }
      
      Logger.log(`✅ 更新財報日期：${ticker} ${quarter} -> ${confirmedDate}`);
      return;
    }
  }
}

/**
 * 建立個股索引
 * @param {string} ticker - 股票代碼
 * @param {Array} earningsDates - 財報日期列表
 */
function createTickerEarningsIndex(ticker, earningsDates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("HOLDINGS_EARNINGS_INDEX");
  
  if (!sheet) {
    sheet = ss.insertSheet("HOLDINGS_EARNINGS_INDEX");
    sheet.appendRow([
      "index_id",
      "ticker",
      "total_earnings_dates",
      "next_earnings_date",
      "next_earnings_quarter",
      "last_updated"
    ]);
    sheet.setFrozenRows(1);
  }
  
  // 找到下一個財報日期
  const today = new Date();
  const upcomingDates = earningsDates
    .filter(ed => new Date(ed.earnings_date) >= today)
    .sort((a, b) => new Date(a.earnings_date) - new Date(b.earnings_date));
  
  const nextEarnings = upcomingDates.length > 0 ? upcomingDates[0] : null;
  
  // 檢查是否已存在索引
  const existingRow = findTickerIndexRow(sheet, ticker);
  
  if (existingRow) {
    // 更新現有索引
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const totalCol = headers.indexOf("total_earnings_dates");
    const nextDateCol = headers.indexOf("next_earnings_date");
    const nextQuarterCol = headers.indexOf("next_earnings_quarter");
    const updatedCol = headers.indexOf("last_updated");
    
    if (totalCol !== -1) {
      sheet.getRange(existingRow, totalCol + 1).setValue(earningsDates.length);
    }
    if (nextDateCol !== -1 && nextEarnings) {
      sheet.getRange(existingRow, nextDateCol + 1).setValue(nextEarnings.earnings_date);
    }
    if (nextQuarterCol !== -1 && nextEarnings) {
      sheet.getRange(existingRow, nextQuarterCol + 1).setValue(nextEarnings.quarter);
    }
    if (updatedCol !== -1) {
      sheet.getRange(existingRow, updatedCol + 1).setValue(new Date());
    }
  } else {
    // 新增索引
    sheet.appendRow([
      `IDX_${ticker}_${Date.now()}`,
      ticker,
      earningsDates.length,
      nextEarnings ? nextEarnings.earnings_date : null,
      nextEarnings ? nextEarnings.quarter : null,
      new Date()
    ]);
  }
}

/**
 * 查找個股索引行
 * @param {Sheet} sheet - 表格
 * @param {string} ticker - 股票代碼
 * @returns {number|null} 行號（1-based）
 */
function findTickerIndexRow(sheet, ticker) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  
  if (tickerCol === -1) {
    return null;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker) {
      return i + 1;
    }
  }
  
  return null;
}

/**
 * 查找財報日期行（從 EARNINGS_CALENDAR）
 * @param {Sheet} sheet - 表格
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @returns {number|null} 行號（1-based）
 */
function findEarningsDateRow(sheet, ticker, earningsDate) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const dateCol = headers.indexOf("earnings_date");
  
  if (tickerCol === -1 || dateCol === -1) {
    return null;
  }
  
  const targetDateStr = Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  for (let i = 1; i < rows.length; i++) {
    const rowTicker = rows[i][tickerCol];
    const rowDate = rows[i][dateCol];
    
    if (rowTicker === ticker && rowDate) {
      const rowDateStr = Utilities.formatDate(new Date(rowDate), Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (rowDateStr === targetDateStr) {
        return i + 1;
      }
    }
  }
  
  return null;
}

/**
 * 更新財報日期行
 * @param {Sheet} sheet - 表格
 * @param {number} rowIndex - 行號（1-based）
 * @param {Object} data - 更新數據
 */
function updateEarningsDateRow(sheet, rowIndex, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (const [key, value] of Object.entries(data)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(value);
    }
  }
}

// ==========================================
// 整合到行事曆監控制度
// ==========================================

/**
 * 將持股財報納入行事曆監控制度
 * @param {Array} tickers - 股票列表
 */
function integrateHoldingsEarningsToCalendar(tickers) {
  try {
    Logger.log(`將持股財報納入行事曆監控制度：共 ${tickers.length} 檔股票`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const earningsSheet = ss.getSheetByName("EARNINGS_CALENDAR");
    
    if (!earningsSheet || earningsSheet.getLastRow() <= 1) {
      Logger.log("⚠ EARNINGS_CALENDAR 表格不存在或為空");
      return;
    }
    
    // 讀取持股財報日期
    const dataRange = earningsSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("earnings_date");
    const quarterCol = headers.indexOf("quarter");
    const statusCol = headers.indexOf("status");
    
    if (tickerCol === -1 || dateCol === -1) {
      Logger.log("⚠ EARNINGS_CALENDAR 表格缺少必要欄位");
      return;
    }
    
    const holdingsSet = new Set(tickers);
    const holdingsEarnings = [];
    
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      if (holdingsSet.has(ticker)) {
        holdingsEarnings.push({
          ticker: ticker,
          earnings_date: new Date(rows[i][dateCol]),
          quarter: rows[i][quarterCol] || null,
          status: rows[i][statusCol] || "ESTIMATED"
        });
      }
    }
    
    Logger.log(`找到 ${holdingsEarnings.length} 個持股財報日期`);
    
    // 這些財報日期已經在 EARNINGS_CALENDAR 中，會自動被 scanEarningsAndRevenueDates() 掃描
    // 不需要額外處理，因為系統已經會監控 EARNINGS_CALENDAR 中的所有財報
    
    return {
      success: true,
      holdings_count: tickers.length,
      earnings_count: holdingsEarnings.length
    };
    
  } catch (error) {
    Logger.log(`整合持股財報到行事曆失敗：${error.message}`);
    throw error;
  }
}
