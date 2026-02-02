/**
 * 🧪 測試模式工具函數（V8.0 測試模式）
 * 
 * 包含：
 * - 行事曆和財報數據檢查
 * - Token 累加計數器
 * - 測試結果檢查提示生成
 * 
 * @version V8.0 測試模式
 * @date 2026-01-19
 */

// ==========================================
// 行事曆和財報數據檢查
// ==========================================

/**
 * 檢查 2026 年行事曆和財報數據
 * @returns {Object} 檢查結果
 */
function check2026CalendarAndEarnings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calendarSheet = ss.getSheetByName("P5__CALENDAR");
  const earningsSheet = ss.getSheetByName("EARNINGS_CALENDAR");
  
  const result = {
    calendar_2026: {
      exists: false,
      count: 0,
      sample_dates: [],
      missing_events: []
    },
    earnings_2026: {
      exists: false,
      count: 0,
      sample_dates: [],
      missing_tickers: []
    }
  };
  
  // 檢查行事曆
  if (calendarSheet && calendarSheet.getLastRow() > 1) {
    const dataRange = calendarSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const dateCol = headers.indexOf("date_start");
    const eventNameCol = headers.indexOf("event_name");
    const statusCol = headers.indexOf("status");
    
    if (dateCol !== -1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const date = row[dateCol];
        const eventName = row[eventNameCol] || "";
        const status = row[statusCol] || "ACTIVE";
        
        if (date && date instanceof Date && status === "ACTIVE") {
          const year = date.getFullYear();
          if (year === 2026) {
            result.calendar_2026.exists = true;
            result.calendar_2026.count++;
            if (result.calendar_2026.sample_dates.length < 5) {
              result.calendar_2026.sample_dates.push({
                date: date,
                name: eventName
              });
            }
          }
        }
      }
    }
  }
  
  // 檢查財報
  if (earningsSheet && earningsSheet.getLastRow() > 1) {
    const dataRange = earningsSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const dateCol = headers.indexOf("earnings_date") || headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker") || headers.indexOf("Company_Code");
    
    if (dateCol !== -1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const date = row[dateCol];
        const ticker = row[tickerCol] || "";
        
        if (date && date instanceof Date) {
          const year = date.getFullYear();
          if (year === 2026) {
            result.earnings_2026.exists = true;
            result.earnings_2026.count++;
            if (result.earnings_2026.sample_dates.length < 5) {
              result.earnings_2026.sample_dates.push({
                date: date,
                ticker: ticker
              });
            }
          }
        }
      }
    }
  }
  
  // 檢查關鍵事件是否存在
  const keyEvents = [
    { name: "FOMC", months: [1, 3, 5, 6, 7, 9, 11, 12] },  // FOMC 通常在這些月份
    { name: "CPI", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },  // CPI 每月
    { name: "非農", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }  // 非農每月
  ];
  
  // 檢查關鍵財報（Mag 7）
  const keyTickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];
  
  if (calendarSheet && calendarSheet.getLastRow() > 1) {
    const dataRange = calendarSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const dateCol = headers.indexOf("date_start");
    const eventNameCol = headers.indexOf("event_name");
    const statusCol = headers.indexOf("status");
    
    for (const keyEvent of keyEvents) {
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const date = row[dateCol];
        const eventName = row[eventNameCol] || "";
        const status = row[statusCol] || "ACTIVE";
        
        if (date && date instanceof Date && status === "ACTIVE") {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          if (year === 2026 && 
              keyEvent.months.includes(month) && 
              eventName.toUpperCase().includes(keyEvent.name.toUpperCase())) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        result.calendar_2026.missing_events.push(keyEvent.name);
      }
    }
  }
  
  if (earningsSheet && earningsSheet.getLastRow() > 1) {
    const dataRange = earningsSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const dateCol = headers.indexOf("earnings_date") || headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker") || headers.indexOf("Company_Code");
    
    for (const ticker of keyTickers) {
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const date = row[dateCol];
        const tickerValue = row[tickerCol] || "";
        
        if (date && date instanceof Date && tickerValue === ticker) {
          const year = date.getFullYear();
          if (year === 2026) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        result.earnings_2026.missing_tickers.push(ticker);
      }
    }
  }
  
  return result;
}

/**
 * 格式化檢查結果為可讀字符串
 * @param {Object} checkResult - 檢查結果
 * @returns {string} 格式化後的字符串
 */
function formatCalendarCheckResult(checkResult) {
  let output = "=".repeat(60) + "\n";
  output += "📅 2026 年行事曆和財報數據檢查結果\n";
  output += "=".repeat(60) + "\n\n";
  
  // 行事曆檢查結果
  output += "📆 重大財經行事曆（P5__CALENDAR）：\n";
  if (checkResult.calendar_2026.exists) {
    output += `  ✅ 找到 ${checkResult.calendar_2026.count} 個 2026 年事件\n`;
    if (checkResult.calendar_2026.sample_dates.length > 0) {
      output += "  範例事件：\n";
      checkResult.calendar_2026.sample_dates.forEach(sample => {
        const dateStr = Utilities.formatDate(sample.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
        output += `    - ${dateStr}: ${sample.name}\n`;
      });
    }
    if (checkResult.calendar_2026.missing_events.length > 0) {
      output += `  ⚠️ 缺少關鍵事件：${checkResult.calendar_2026.missing_events.join(", ")}\n`;
    }
  } else {
    output += "  ❌ 未找到 2026 年事件\n";
    output += "  ⚠️ 請執行 importP5Calendar2026() 導入數據\n";
  }
  
  output += "\n";
  
  // 財報檢查結果
  output += "💰 板塊龍頭財報（EARNINGS_CALENDAR）：\n";
  if (checkResult.earnings_2026.exists) {
    output += `  ✅ 找到 ${checkResult.earnings_2026.count} 個 2026 年財報\n`;
    if (checkResult.earnings_2026.sample_dates.length > 0) {
      output += "  範例財報：\n";
      checkResult.earnings_2026.sample_dates.forEach(sample => {
        const dateStr = Utilities.formatDate(sample.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
        output += `    - ${dateStr}: ${sample.ticker}\n`;
      });
    }
    if (checkResult.earnings_2026.missing_tickers.length > 0) {
      output += `  ⚠️ 缺少關鍵財報：${checkResult.earnings_2026.missing_tickers.join(", ")}\n`;
    }
  } else {
    output += "  ❌ 未找到 2026 年財報\n";
    output += "  ⚠️ 請檢查 EARNINGS_CALENDAR 表格並導入數據\n";
  }
  
  output += "\n" + "=".repeat(60) + "\n";
  
  return output;
}

// ==========================================
// Token 累加計數器（Global Token Accumulator）
// ==========================================

/**
 * ⭐ V8.0 測試模式：Token 累加計數器
 * 
 * 使用 Google Sheet 儲存格存儲累加 Token 使用量
 * 表格：TEST_MODE_TOKEN_COUNTER
 * 儲存格：A1 = 總輸入 tokens, B1 = 總輸出 tokens, C1 = 總成本（USD）
 */

const TEST_TOKEN_COUNTER_SHEET = "TEST_MODE_TOKEN_COUNTER";
const TEST_TOKEN_COUNTER_CELL_INPUT = "A1";
const TEST_TOKEN_COUNTER_CELL_OUTPUT = "B1";
const TEST_TOKEN_COUNTER_CELL_COST = "C1";

/**
 * 初始化 Token 計數器表格
 */
function initTestTokenCounter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TEST_TOKEN_COUNTER_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(TEST_TOKEN_COUNTER_SHEET);
    // 設置標題行
    sheet.getRange(1, 1, 1, 3).setValues([["總輸入 Tokens", "總輸出 Tokens", "總成本 (USD)"]]);
    // 初始化計數器
    sheet.getRange(2, 1).setValue(0);  // A2 = 總輸入 tokens
    sheet.getRange(2, 2).setValue(0);  // B2 = 總輸出 tokens
    sheet.getRange(2, 3).setValue(0);  // C2 = 總成本
    // 設置格式
    sheet.getRange(2, 3).setNumberFormat("$#,##0.0000");  // 成本格式
    Logger.log("✅ Token 計數器表格已初始化");
  }
  
  return sheet;
}

/**
 * 累加 Token 使用量
 * @param {number} inputTokens - 輸入 tokens
 * @param {number} outputTokens - 輸出 tokens
 * @param {number} cost - 成本（USD）
 */
function accumulateTestTokens(inputTokens, outputTokens, cost) {
  if (!SYSTEM_TEST_MODE) {
    return;  // 非測試模式不記錄
  }
  
  try {
    const sheet = initTestTokenCounter();
    
    // 讀取當前值
    const currentInput = sheet.getRange(2, 1).getValue() || 0;
    const currentOutput = sheet.getRange(2, 2).getValue() || 0;
    const currentCost = sheet.getRange(2, 3).getValue() || 0;
    
    // 累加
    const newInput = currentInput + inputTokens;
    const newOutput = currentOutput + outputTokens;
    const newCost = currentCost + cost;
    
    // 寫回
    sheet.getRange(2, 1).setValue(newInput);
    sheet.getRange(2, 2).setValue(newOutput);
    sheet.getRange(2, 3).setValue(newCost);
    
    Logger.log(`Token 累加：Input=${inputTokens}, Output=${outputTokens}, Cost=$${cost.toFixed(4)}`);
    Logger.log(`累計總計：Input=${newInput}, Output=${newOutput}, Cost=$${newCost.toFixed(4)}`);
  } catch (error) {
    Logger.log(`Token 累加失敗：${error.message}`);
  }
}

/**
 * 獲取當前 Token 使用量
 * @returns {Object} Token 使用量
 */
function getTestTokenUsage() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TEST_TOKEN_COUNTER_SHEET);
    
    if (!sheet) {
      return {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost: 0
      };
    }
    
    const inputTokens = sheet.getRange(2, 1).getValue() || 0;
    const outputTokens = sheet.getRange(2, 2).getValue() || 0;
    const cost = sheet.getRange(2, 3).getValue() || 0;
    
    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost: cost
    };
  } catch (error) {
    Logger.log(`獲取 Token 使用量失敗：${error.message}`);
    return {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost: 0
    };
  }
}

/**
 * 重置 Token 計數器
 */
function resetTestTokenCounter() {
  try {
    const sheet = initTestTokenCounter();
    sheet.getRange(2, 1).setValue(0);
    sheet.getRange(2, 2).setValue(0);
    sheet.getRange(2, 3).setValue(0);
    Logger.log("✅ Token 計數器已重置");
  } catch (error) {
    Logger.log(`重置 Token 計數器失敗：${error.message}`);
  }
}

/**
 * 格式化 Token 使用量報告
 * @returns {string} 格式化後的報告
 */
function formatTestTokenReport() {
  const usage = getTestTokenUsage();
  let output = "=".repeat(60) + "\n";
  output += "📊 測試模式 Token 使用量報告\n";
  output += "=".repeat(60) + "\n";
  output += `總輸入 Tokens: ${usage.input_tokens.toLocaleString()}\n`;
  output += `總輸出 Tokens: ${usage.output_tokens.toLocaleString()}\n`;
  output += `總 Tokens: ${usage.total_tokens.toLocaleString()}\n`;
  output += `總成本: $${usage.cost.toFixed(4)}\n`;
  output += "\n";
  output += `查看詳細數據：表格 "${TEST_TOKEN_COUNTER_SHEET}" 的 A2, B2, C2 儲存格\n`;
  output += "=".repeat(60) + "\n";
  return output;
}

// ==========================================
// 測試結果檢查提示生成
// ==========================================

/**
 * 生成測試結果檢查提示
 * @param {string} phase - Phase 名稱（例如：P0, P1, P2）
 * @param {Object} result - 執行結果
 * @returns {string} 檢查提示
 */
function generateTestCheckPrompt(phase, result) {
  let prompt = "\n" + "=".repeat(60) + "\n";
  prompt += `✅ ${phase} 測試完成\n`;
  prompt += "=".repeat(60) + "\n\n";
  prompt += "📋 請檢查以下欄位是否正確填寫：\n\n";
  
  // 根據 Phase 生成不同的檢查提示
  switch (phase) {
    case "P0":
      prompt += "表格：P0__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 p0_output_json 欄位應該包含 JSON 數據\n";
      prompt += "  - 最新一行的 created_at 欄位應該是今天的日期\n";
      break;
      
    case "P0.5":
      prompt += "表格：P0_5__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 p0_5_output_json 欄位應該包含 JSON 數據\n";
      prompt += "  - 最新一行的 p0_snapshot_id 欄位應該對應 P0 的快照 ID\n";
      break;
      
    case "P0.7":
      prompt += "表格：P0_7__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 p0_7_output_json 欄位應該包含 JSON 數據\n";
      prompt += "  - 最新一行的 p0_snapshot_id 欄位應該對應 P0 的快照 ID\n";
      break;
      
    case "P1 Step1":
      prompt += "表格：Phase1_Company_Pool\n";
      prompt += "  - 應該有新增的股票數據\n";
      prompt += "  - Company_Code 欄位應該有值\n";
      prompt += "  - P1_Industry_Evidence_JSON 欄位應該包含 JSON 數據\n";
      break;
      
    case "P1 Step2":
      prompt += "表格：Phase1_Company_Pool\n";
      prompt += "  - Tier 欄位應該有值（S/A/B/X）\n";
      prompt += "  - Tier_Reason 欄位應該有說明\n";
      prompt += "  - Supply_Chain_Position 欄位應該有值\n";
      prompt += "表格：P1__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 pool_results_json 欄位應該包含 JSON 數據\n";
      break;
      
    case "P2":
      prompt += "表格：Phase2_Output\n";
      prompt += "  - Safety_Grade 欄位應該有值（S/A/B/X）\n";
      prompt += "  - Growth_Momentum_Grade 欄位應該有值（S/A/B/X）\n";
      prompt += "  - Future_Breakout_Grade 欄位應該有值（S/A/B/X）\n";
      prompt += "  - Position_Role 欄位應該有值\n";
      prompt += "  - Track_Type 欄位應該有值（CORE/FRONTIER）\n";
      prompt += "表格：P2__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 tier_assignments_json 欄位應該包含 JSON 數據\n";
      break;
      
    case "P2.5":
      prompt += "表格：Phase2.5_Output\n";
      prompt += "  - Smart_Money_Score 欄位應該有值（0-100）\n";
      prompt += "  - Insider_Trading_Signal 欄位應該有值\n";
      prompt += "  - Options_Flow_Sentiment 欄位應該有值\n";
      prompt += "表格：P2_5__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 p2_5_output_json 欄位應該包含 JSON 數據\n";
      break;
      
    case "P3":
      prompt += "表格：P3__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 technical_results_json 欄位應該包含 JSON 數據\n";
      prompt += "  - 最新一行的 data_freshness_json 欄位應該包含 JSON 數據\n";
      break;
      
    case "P4":
      prompt += "表格：P4__SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 allocation_results_json 欄位應該包含 JSON 數據\n";
      prompt += "  - 最新一行的 tier_allocations_json 欄位應該包含 JSON 數據\n";
      break;
      
    case "P5 Daily":
      prompt += "表格：MARKET_OHLCV_DAILY\n";
      prompt += "  - 最新一行的 date 欄位應該是今天的日期\n";
      prompt += "  - 最新一行的 ticker 欄位應該有值\n";
      prompt += "  - 最新一行的 close 欄位應該有值\n";
      prompt += "表格：MARKET_INDICATORS_DAILY\n";
      prompt += "  - 最新一行的 date 欄位應該是今天的日期\n";
      prompt += "  - 最新一行的 ticker 欄位應該有值\n";
      prompt += "表格：P5_DAILY__NEWS\n";
      prompt += "  - 最新一行的 date 欄位應該是今天的日期\n";
      prompt += "  - 最新一行的 event_type 欄位應該包含 JSON 數據（AI 分類結果）\n";
      prompt += "  - 最新一行的 earnings_date_info 欄位應該包含 JSON 數據（如果檢測到財報新聞）\n";
      prompt += "表格：EARNINGS_CALENDAR\n";
      prompt += "  - 檢查是否有從新聞更新的財報日期（updated_at 欄位應該是今天的日期）\n";
      break;
      
    case "P5 Weekly":
      prompt += "表格：P5__WEEKLY_SNAPSHOT\n";
      prompt += "  - 最新一行的 snapshot_id 欄位應該有值\n";
      prompt += "  - 最新一行的 weekly_trade_actions 欄位應該包含 JSON 數據（批次掛單策略）\n";
      prompt += "  - 最新一行的 market_analysis_json 欄位應該包含 JSON 數據\n";
      prompt += "表格：P5__STRATEGY_SNAPSHOT\n";
      prompt += "  - 應該有新增的策略快照記錄\n";
      prompt += "  - executive_summary 欄位應該有值\n";
      prompt += "  - market_tags_json 欄位應該包含 JSON 數據\n";
      prompt += "表格：P5__OUTCOME_SNAPSHOT\n";
      prompt += "  - 應該有新增的結果快照記錄\n";
      prompt += "  - scorecard_json 欄位應該包含 JSON 數據\n";
      prompt += "  - reflection_json 欄位應該包含 JSON 數據\n";
      prompt += "表格：P5__CALENDAR\n";
      prompt += "  - 檢查是否有未來兩週的事件（date_start 欄位在未來 14 天內）\n";
      prompt += "  - 檢查 historical_performance_json 欄位是否有數據（AI 生成的歷史經驗）\n";
      prompt += "  - 檢查 risk_warnings_json 欄位是否有數據\n";
      prompt += "表格：EARNINGS_CALENDAR\n";
      prompt += "  - 檢查是否有未來兩週的財報（earnings_date 欄位在未來 14 天內）\n";
      prompt += "  - 檢查 historical_experience_json 欄位是否有數據（AI 生成的歷史經驗）\n";
      prompt += "表格：HOLDINGS_EARNINGS_CALENDAR\n";
      prompt += "  - 檢查是否有持股的財報日期（earnings_date 欄位）\n";
      prompt += "  - 檢查是否有 AI 生成的預估日期（data_source 欄位 = 'AI_GENERATED'）\n";
      break;
      
    default:
      prompt += "  - 請檢查相關快照表格是否有新增記錄\n";
      prompt += "  - 請檢查相關輸出表格是否有更新\n";
  }
  
  prompt += "\n";
  prompt += "💡 提示：\n";
  prompt += "  - 如果欄位為空或格式錯誤，請複製該欄位的內容給我\n";
  prompt += "  - 如果 JSON 欄位無法解析，請複製 JSON 內容給我\n";
  prompt += "  - 如果發現錯誤，請描述具體問題\n";
  prompt += "\n";
  prompt += "=".repeat(60) + "\n";
  
  return prompt;
}
