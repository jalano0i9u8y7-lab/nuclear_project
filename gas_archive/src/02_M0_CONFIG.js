/**
 * 🔧 M0 工具機配置與常量定義
 * 
 * 定義 M0 工具機的所有配置、模型映射、Capabilities、Adapters
 * 
 * @version SSOT V6.3
 * @date 2025-01-11
 */

// ==========================================
// M0 模型配置表（定案 V3.0）
// ==========================================

const M0_MODEL_CONFIG = {
  // Capabilities
  GPT: {
    model: "gpt-5.2",  // ⭐ GPT-5.2（最新穩定版，已確認可用）
    adapter: "M0_Adapter_OpenAI",
    costPer1KTokens: 0.00175,  // ⭐ V8.0 更新：Input 1.75（基於用戶提供的價格表）
    costPer1KOutputTokens: 0.014,  // ⭐ V8.0 更新：Output 14.0（基於用戶提供的價格表）
    // ⭐ V8.17 新增：Batch API 價格（50% 折扣）
    batchCostPer1KTokens: 0.000875,  // Batch Input 0.875（50% 折扣）
    batchCostPer1KOutputTokens: 0.007,  // Batch Output 7.0（50% 折扣）
    maxTokens: 400000,  // ⭐ V8.0 升級：400K context window（唯一超過 200K 的強推理模型）
    maxOutputTokens: 8000,  // 輸出限制
    temperature: 0.7,
    useMaxCompletionTokens: true,  // ⭐ GPT-5.2 需要使用 max_completion_tokens
    supportsBatch: true  // ⭐ V8.17 新增：支援 Batch API
  },
  
  SONNET: {
    model: "claude-sonnet-4-5-20250929",  // ⭐ Claude Sonnet 4.5（最新版本）
    adapter: "M0_Adapter_Claude",
    costPer1KTokens: 0.003,  // ⭐ V8.0 更新：Input 3.0（基於用戶提供的價格表）
    costPer1KOutputTokens: 0.015,  // ⭐ V8.0 更新：Output 15.0（基於用戶提供的價格表）
    // ⭐ V8.17 新增：Batch API 價格（50% 折扣）
    batchCostPer1KTokens: 0.0015,  // Batch Input 1.5（50% 折扣）
    batchCostPer1KOutputTokens: 0.0075,  // Batch Output 7.5（50% 折扣）
    maxTokens: 200000,  // ⭐ V8.0 升級：200K context window
    maxOutputTokens: 8000,  // 輸出限制
    temperature: 0.7,
    supportsBatch: true  // ⭐ V8.17 新增：支援 Batch API
  },
  
  OPUS: {
    model: "claude-opus-4-5-20251101",  // ⭐ Claude Opus 4.5（最新版本）
    adapter: "M0_Adapter_Claude",
    costPer1KTokens: 0.005,  // ⭐ V8.0 更新：Input 5.0（基於用戶提供的價格表）
    costPer1KOutputTokens: 0.025,  // ⭐ V8.0 更新：Output 25.0（基於用戶提供的價格表）
    // ⭐ V8.17 新增：Batch API 價格（50% 折扣）
    batchCostPer1KTokens: 0.0025,  // Batch Input 2.5（50% 折扣）
    batchCostPer1KOutputTokens: 0.0125,  // Batch Output 12.5（50% 折扣）
    maxTokens: 200000,  // ⭐ V8.0 升級：200K context window
    maxOutputTokens: 8000,  // 輸出限制
    temperature: 0.7,
    supportsBatch: true  // ⭐ V8.17 新增：支援 Batch API
  },
  
  O3: {
    model: "o3",
    adapter: "M0_Adapter_OpenAI",
    costPer1KTokens: 0.002,  // ⭐ V8.0 更新：Input 2.0（基於用戶提供的價格表）
    costPer1KOutputTokens: 0.008,  // ⭐ V8.0 更新：Output 8.0（基於用戶提供的價格表）
    // ⭐ V8.17 新增：Batch API 價格（50% 折扣）
    batchCostPer1KTokens: 0.001,  // Batch Input 1.0（50% 折扣）
    batchCostPer1KOutputTokens: 0.004,  // Batch Output 4.0（50% 折扣）
    maxTokens: 200000,  // ⭐ V8.0 升級：200K context window
    maxOutputTokens: 8000,  // 輸出限制
    temperature: 0.0,  // o3 不使用 temperature
    useMaxCompletionTokens: true,  // ⭐ o3 模型也需要 max_completion_tokens
    supportsBatch: true  // ⭐ V8.17 新增：支援 Batch API
  },
  
  GEMINI_PRO: {
    model: "gemini-3-pro-preview",  // ⭐ Gemini 3.0 Pro（已確認可用）
    adapter: "M0_Adapter_Gemini",
    costPer1KTokens: 0.002,  // ⭐ V8.0 更新：Input 2.0（≤200K，基於用戶提供的價格表）
    costPer1KOutputTokens: 0.012,  // ⭐ V8.0 更新：Output 12.0（≤200K，基於用戶提供的價格表）
    costPer1KTokensOver200K: 0.004,  // ⭐ V8.0 新增：Input 4.0（>200K，基於用戶提供的價格表）
    costPer1KOutputTokensOver200K: 0.018,  // ⭐ V8.0 新增：Output 18.0（>200K，基於用戶提供的價格表）
    maxTokens: 1000000,  // ⭐ V8.0 升級：1M context window（用於原始文件去雜訊）
    maxOutputTokens: 64000,  // 輸出限制
    temperature: 0.7
  },
  
  GEMINI_FLASH: {
    model: "gemini-3-flash-preview",  // ⭐ V8.14 修正：Gemini 3.0 Flash 正式名稱（2M 長窗口）
    adapter: "M0_Adapter_Gemini",
    costPer1KTokens: 0.0001,  // ⭐ V8.0 更新：Input 0.1（基於用戶提供的價格表）
    costPer1KOutputTokens: 0.0004,  // ⭐ V8.0 更新：Output 0.4（基於用戶提供的價格表）
    maxTokens: 2000000,  // ⭐ V8.14 升級：2M context window（用於批次處理大量新聞）
    maxOutputTokens: 8000,  // 輸出限制
    temperature: 0.7
  },
  
  GEMINI_SEARCH: {
    model: "gemini-3-flash-preview",  // ⭐ V8.14 修正：改用 Gemini 3.0 Flash（成本更低，適合搜尋場景）
    adapter: "M0_Adapter_Gemini",
    cseAdapter: "M0_Adapter_CSE",
    costPer1KTokens: 0.0001,  // ⭐ V8.14 修正：使用 GEMINI_FLASH 的價格（成本更低）
    costPer1KOutputTokens: 0.0004,  // ⭐ V8.14 修正：使用 GEMINI_FLASH 的價格
    maxTokens: 2000000,  // ⭐ V8.14 升級：2M context window（利用長窗口特性）
    maxOutputTokens: 8000,
    temperature: 0.7
  },
  
  // ⭐ V8.17 新增：Gemini 2.5 Lite（測試模式使用）
  GEMINI_FLASH_LITE: {
    model: "gemini-2.5-flash-lite",  // ⭐ V8.17 修正：正式 API 名稱
    adapter: "M0_Adapter_Gemini",
    costPer1KTokens: 0.00005,  // ⭐ V8.17 新增：測試模式成本更低
    costPer1KOutputTokens: 0.0002,  // ⭐ V8.17 新增：測試模式成本更低
    maxTokens: 1000000,  // 1M context window
    maxOutputTokens: 8000,
    temperature: 0.7,
    forceJsonMode: true  // ⭐ 強制 JSON 模式
  },
  
  // ⭐ V8.17 新增：GPT-5 Nano（測試模式審查者使用）
  GPT_NANO: {
    model: "gpt-5-nano",  // ⭐ V8.17 新增：GPT-5 Nano（測試模式）
    adapter: "M0_Adapter_OpenAI",
    costPer1KTokens: 0.0001,  // ⭐ V8.17 新增：測試模式成本更低
    costPer1KOutputTokens: 0.0004,  // ⭐ V8.17 新增：測試模式成本更低
    maxTokens: 128000,  // 128k context window
    maxOutputTokens: 8000,
    temperature: 0.7,
    useMaxCompletionTokens: true,
    supportsBatch: false,  // 測試模式不使用 Batch
    forceJsonMode: true  // ⭐ 強制 JSON 模式
  }
};

// ==========================================
// 任務到執行者模型映射（SSOT V6.3）
// ==========================================

const TASK_TO_EXECUTOR = {
  "P0": "OPUS",  // ⭐ V8.17 注意：不適用 Batch（單一巨上下文）
  "P0_5": "OPUS",  // ⭐ V8.14 新增：P0.5 產業鏈地圖分析 + ⭐ V8.17 更新：Mode-2 適用 Batch
  "P0_7": "O3",  // ⭐ 避免同家盲點（o3 執行，Opus 審查）+ ⭐ V8.17 注意：不適用 Batch（因果循環）
  "P1": "SONNET",  // ⭐ V8.14 注意：P1 改為兩階段，此處保留舊配置（實際使用 P1_STEP1 和 P1_STEP2）
  "P1_STEP1": "GEMINI_FLASH",  // ⭐ V8.14 新增：P1 Step 1（股票池生成，純提取資料，無分析）+ ⭐ V8.17 更新：適用 Batch
  "P1_STEP2": "GEMINI_PRO",  // ⭐ V8.14 新增：P1 Step 2（結構分級）+ ⭐ V8.17 注意：不使用 Batch（會與 P1_STEP1 衝突）
  "P2_QUARTERLY": "SONNET",  // ⭐ V8.17 更新：適用 Batch
  "P2_MONTHLY": "SONNET",  // ⭐ V8.17 更新：適用 Batch
  "P2_5_MONTHLY": "SONNET",  // ⭐ V8.16 新增：P2.5 月度執行 + ⭐ V8.17 更新：適用 Batch
  "P2_5_QUARTERLY": "SONNET",  // ⭐ V8.16 新增：P2.5 季度執行 + ⭐ V8.17 更新：適用 Batch
  "P3": "SONNET",  // ⭐ V8.17 更新：適用 Batch
  "P5_DAILY": "GPT",  // ⭐ 多語去重場景 + ⭐ V8.17 注意：不適用 Batch（即時性）
  "P5_WEEKLY": "SONNET",  // ⭐ V8.16 注意：P5 Weekly 改為雙層架構（P5-B 和 P5-A）+ ⭐ V8.17 更新：P5-B 適用 Batch
  "P5_B_WEEKLY_STATE_EVALUATOR": "SONNET",  // ⭐ V8.17 新增：P5-B Weekly State Evaluator（適用 Batch）
  "P5_A_WEEKLY_DEEP_RE_EVALUATION": "OPUS",  // ⭐ V8.17 新增：P5-A Weekly Deep Re-evaluation（適用 Batch，一律使用 Opus）
  "P5_WEEKLY_WORLDVIEW": "OPUS",  // ⭐ V8.17 新增：P5 Weekly 世界觀分析使用 Opus（宏觀世界觀分析需要深度推理）
  "P5_MONTHLY": "SONNET",  // ⭐ V8.17 更新：適用 Batch
  "P5_QUARTERLY": "SONNET",  // ⭐ V8.17 更新：適用 Batch
  "P5_CALENDAR_INTENSIVE_ANALYSIS": "SONNET",  // ⭐ V8.17 新增：重大財經事件強化分析（正式模式：Sonnet 4.5，測試模式：Gemini 2.5 Lite）
  "EARNINGS_HISTORICAL_EXPERIENCE": "SONNET",  // ⭐ V8.17 新增：板塊龍頭財報歷史經驗生成（正式模式：Sonnet 4.5，測試模式：Gemini 2.5 Lite）
  "CALENDAR_HISTORICAL_EXPERIENCE": "SONNET"  // ⭐ V8.17 新增：重大財經事件歷史經驗生成（正式模式：Sonnet 4.5，測試模式：Gemini 2.5 Lite）
};

// ==========================================
// 測試模式配置 ⭐ V8.0 測試模式
// ==========================================

/**
 * ⭐ V8.0 測試模式開關
 * 
 * 用途：
 * - 測試階段：設為 true，使用最便宜的模型（Flash-Lite + Nano）
 * - 生產階段：設為 false，使用正式模型（Sonnet/Opus + GPT-5.2）
 * 
 * 測試模式配置：
 * - 分析者：gemini-2.5-flash-lite（正式 API 名稱）
 * - 審查者：gpt-5-nano（正式 API 名稱）
 * - 裁決者：gemini-2.5-flash-lite（正式 API 名稱）
 * - Batch API：全部禁用（GLOBAL_USE_BATCH_API = false）
 */
const SYSTEM_TEST_MODE = true;  // ⭐ 測試階段：true，生產階段：false

/**
 * ⭐ 測試模式模型映射
 * 
 * 當 SYSTEM_TEST_MODE = true 時，使用以下模型映射
 */
const TEST_MODELS = {
  // 分析者：Gemini 2.5 Flash Lite（吃原本給 Sonnet/Opus 的長 Prompt）
  "EXECUTOR": "GEMINI_FLASH_LITE",
  
  // 審查者：GPT-5 Nano（吃原本給 GPT-5.2 的審查 Prompt）
  "AUDITOR": "GPT_NANO",  // ⭐ V8.17 修正：使用 GPT-5 Nano
  
  // 裁決者：Gemini 2.5 Flash Lite（如果有）
  "ARBITER": "GEMINI_FLASH_LITE"
};

// ==========================================
// Batch 適用性配置 ⭐ V8.17 新增
// ==========================================

/**
 * ⭐ V8.17 新增：全局 Batch API 開關
 * 
 * 用途：
 * - 測試階段：設為 false，使用同步 API 版本進行測試
 * - 生產階段：設為 true，使用 Batch API 版本節省成本
 * 
 * 注意：即使設為 true，仍需要項目在 batchEligibleTasks 列表中才會使用 Batch
 */
const GLOBAL_USE_BATCH_API = false;  // ⭐ 測試階段：false（使用同步版本），生產階段：true（使用 Batch 版本）

/**
 * 獲取執行者模型（根據 projectId）
 * ⭐ V8.0 測試模式：如果 SYSTEM_TEST_MODE = true，返回測試模型
 * @param {string} projectId - 項目 ID
 * @return {string} 執行者模型名稱
 */
function getExecutor(projectId) {
  // ⭐ 測試模式：使用測試模型
  if (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE) {
    return TEST_MODELS.EXECUTOR;  // GEMINI_FLASH_LITE
  }
  
  // 正式模式：使用原有邏輯
  return TASK_TO_EXECUTOR[projectId] || "SONNET";
}

/**
 * 判斷任務是否適用 Batch API
 * 
 * ⚠️ 重要限制：
 * - P1_STEP2 不使用 Batch，因為會與 P1_STEP1 的 Batch 衝突
 *   （P1 Step1 和 Step2 需要順序執行，不能同時 Batch）
 * 
 * @param {string} projectId - 項目 ID
 * @returns {boolean} 是否適用 Batch
 */
function shouldUseBatch(projectId) {
  // ⭐ 測試模式：全部禁用 Batch
  if (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE) {
    return false;
  }
  
  // 全局開關：如果設為 false，所有項目都不使用 Batch
  if (!GLOBAL_USE_BATCH_API) {
    return false;
  }
  
  const batchEligibleTasks = [
    "P1_STEP1",  // 股票池生成
    // ⚠️ P1_STEP2 不使用 Batch（會與 P1_STEP1 的 Batch 衝突）
    "P2_QUARTERLY",  // P2 季度
    "P2_MONTHLY",  // P2 月度
    "P2_5_MONTHLY",  // P2.5 月度
    "P2_5_QUARTERLY",  // P2.5 季度
    "P3",  // 技術面
    "P5_B_WEEKLY_STATE_EVALUATOR",  // P5-B
    "P5_A_WEEKLY_DEEP_RE_EVALUATION",  // P5-A
    "P5_MONTHLY",  // P5 月度
    "P5_QUARTERLY",  // P5 季度
    "P0_5_MODE2"  // P0.5 Mode-2（Chain Dynamics Monitor）
  ];
  
  return batchEligibleTasks.includes(projectId);
}

// ==========================================
// 審查者路由（極簡版）⭐ V8.14 更新
// ==========================================

/**
 * 獲取審查者模型（根據 projectId）
 * ⭐ V8.0 測試模式：如果 SYSTEM_TEST_MODE = true，返回測試模型
 * @param {string} projectId - 項目 ID
 * @return {string|null} 審查者模型名稱
 */
function getAuditor(projectId) {
  // ⭐ V8.16 更新：P1_STEP1 純提取資料，無分析，不需要審查者
  if (projectId === "P1_STEP1") {
    return null;  // 無審查者（純提取資料，無分析）
  }
  
  // ⭐ 測試模式：使用測試模型
  if (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE) {
    // ⚠️ 注意：P5_DAILY 在測試模式下仍使用 GEMINI_PRO（多語去重需要）
    if (projectId === "P5_DAILY") {
      return "GEMINI_PRO";  // 測試模式下仍使用 GEMINI_PRO
    }
    return TEST_MODELS.AUDITOR;  // GPT（測試模式下使用 GPT，實際應為 gpt-5-nano，需確認）
  }
  
  // ⭐ V8.14 更新：P1_STEP2 使用 GPT-5.2 審查
  if (projectId === "P1_STEP2") {
    return "GPT";  // GPT-5.2
  }
  
  // 其他 Phase 的審查者（保持原有邏輯）
  const auditorMap = {
    "P0": "GPT",  // GPT-5.2
    "P0_5": "GPT",  // ⭐ V8.14 新增：GPT-5.2
    "P0_7": "OPUS",  // Claude Opus 4.5
    "P1": "GPT",  // GPT-5.2
    "P2_QUARTERLY": "GPT",  // GPT-5.2
    "P2_MONTHLY": "GPT",  // GPT-5.2
    "P2_5_MONTHLY": "GPT",  // ⭐ V8.16 新增：GPT-5.2
    "P2_5_QUARTERLY": "GPT",  // ⭐ V8.16 新增：GPT-5.2
    "P3": "GPT",  // GPT-5.2（觸發式審查，只審 15-25%）
    "P5_DAILY": "GEMINI_PRO",  // Gemini 3.0 Pro
    "P5_WEEKLY": "GPT",  // GPT-5.2
    "P5_MONTHLY": "GPT",  // GPT-5.2
    "P5_QUARTERLY": "GPT"  // GPT-5.2
  };
  
  return auditorMap[projectId] || "GPT";  // 預設 GPT-5.2
}

// ⭐ V8.17.1 修正：刪除重複的 getAuditor 函數定義（舊版本，已由上面的函數取代）

// ==========================================
// Step Allowlist（唯一合法步驟名稱）
// ==========================================

const ALLOWED_STEPS = [
  // 執行者
  "GPT",
  "SONNET",
  "OPUS",
  "O3",
  
  // 快速清洗
  "GEMINI_FLASH",
  
  // 審查者
  "GEMINI_PRO",  // P5 Daily 專用
  
  // 事實查證
  "GEMINI_SEARCH",  // 條件觸發
  
  // 搜尋
  "CSE_SEARCH",
  "CSE_SEARCH_UNRESTRICTED",  // ⭐ V6.3 無白名單限制的 CSE 搜尋
  
  // 流程控制（自動選擇執行者/審查者）
  "EXECUTOR",  // 自動選擇執行者模型
  "AUDITOR"    // 自動選擇審查者模型
];

// ==========================================
// API Keys 配置（需要從 PropertiesService 讀取）
// ==========================================

/**
 * 獲取 API Key（從 PropertiesService 讀取）
 * @param {string} serviceName - 服務名稱（OPENAI、ANTHROPIC、GEMINI、GOOGLE_CSE）
 * @return {string} API Key
 */
function getAPIKey(serviceName) {
  const properties = PropertiesService.getScriptProperties();
  const keyName = `API_KEY_${serviceName}`;
  const apiKey = properties.getProperty(keyName);
  
  if (!apiKey) {
    throw new Error(`API Key 未配置：${keyName}，請在 PropertiesService 中設置`);
  }
  
  return apiKey;
}

/**
 * 設置 API Key（供初始化使用）
 * @param {string} serviceName - 服務名稱
 * @param {string} apiKey - API Key
 */
function setAPIKey(serviceName, apiKey) {
  const properties = PropertiesService.getScriptProperties();
  const keyName = `API_KEY_${serviceName}`;
  properties.setProperty(keyName, apiKey);
  Logger.log(`API Key 已設置：${keyName}`);
}

// ==========================================
// Google CSE 配置
// ==========================================

const GOOGLE_CSE_CONFIG = {
  // V6.3 原有配置（已修正為機構級數據源）
  "P5_OHLCV": {
    cx: "GOOGLE_CSE_CX_P5_OHLCV",  // 需要在 PropertiesService 中配置
    sites: [
      // ⭐⭐⭐ V8.0 修正：stooq.com 只適用於美股和日股 OHLCV
      // ⚠️ 重要：台股 OHLCV 必須使用 TAIWAN_STOCK CSE（stooq.com 無法抓取台股）
      // 固定準確的官方數據（每天 OHLCV）應該用來自同一個網站的資料，以免格式衝突問題
      "stooq.com"  // ⭐ 獨立行情供應商（有 CSV），提供機器可抓 CSV
      // 適用市場：美股（.us）、日股（.jp）
      // 不適用：台股（必須用 TAIWAN_STOCK CSE）
      // 移除：nasdaq.com, nyse.com（格式不同，避免格式衝突）
      // 注意：stooq.com/q/d/l/ 是 CSV 歷史資料端點
      // 例如：stooq.com/q/d/l/?s=^spx&i=d (S&P 500)
      //      stooq.com/q/d/l/?s=^ndq&i=d (NASDAQ)
      //      stooq.com/q/d/l/?s=^nikkei&i=d (日經指數)
      //      ⚠️ 台股不能用 stooq.com，必須用 TAIWAN_STOCK CSE
    ],
    daily_limit: 100,
    estimated_usage: 1,
    priority: "HIGH",
    note: "V8.0 修正：stooq.com 只適用於美股和日股 OHLCV，台股必須用 TAIWAN_STOCK CSE"
  },
  "P5_SECTOR_ETF": {
    cx: "GOOGLE_CSE_CX_P5_SECTOR_ETF",
    sites: [
      "ishares.com",         // ⭐ BlackRock 官方（全球最大 ETF 發行商）- ETF NAV、Holdings、Rebalance 日期、Tracking Error
      "ssga.com",            // ⭐ SPDR 官方（State Street）- ETF NAV、Holdings、Rebalance 日期、Tracking Error
      "spdrs.com",           // ⭐ SPDR 官方網站（State Street SPDR 系列）
      "vanguard.com",        // ⭐ Vanguard 官方 - ETF NAV、Holdings、Rebalance 日期、Tracking Error
      "etfdb.com"            // ⚠️ 前端資料庫（保留作為補充，但非主要數據源）
      // 移除：finance.yahoo.com, etf.com（前端層，不可稽核）
    ],
    daily_limit: 100,
    estimated_usage: 1,
    priority: "MEDIUM",
    note: "V7.2：ETF 發行人原始資料（NAV、Holdings、Rebalance、Tracking Error）- 全球所有 ETF 機構級分析師都用這三個官網"
  },
  // ⭐⭐⭐ V8.0 修正：按市場分開衍生品 CSE，避免格式衝突
  // 固定準確的官方數據（OI 分布、IV、Greeks）應該用來自同一個網站的資料，以免格式衝突問題
  
  "P5_DERIVATIVES_US": {
    cx: "GOOGLE_CSE_CX_P5_DERIVATIVES_US",
    sites: [
      // 美股衍生品（主要使用 theocc.com，補充 cboe.com 用於特殊指數）
      "theocc.com",  // ⭐ Options Clearing Corporation 官方（全美選擇權 OI 唯一權威）
      "cboe.com"     // ⭐ CBOE 官方（SPX、SPY、QQQ、VIX、0DTE options 等特殊指數選擇權）
      // ⚠️ 重要：stooq.com 不提供衍生品數據（OI、IV、Greeks）
      // 必須使用交易所官方來源，不能用 stooq.com
      // 備註：
      // - theocc.com：全美選擇權 OI 唯一權威，涵蓋大部分美股選擇權
      // - cboe.com：提供 VIX、SPX 等特殊指數的選擇權（這些可能不在 theocc.com 中）
      // - 不包含：cmegroup.com（期貨數據，不是選擇權，應該分開處理）
      // - 不包含：nasdaq.com（Nasdaq Options Market，與 theocc.com 重疊，避免格式衝突）
    ],
    daily_limit: 100,
    estimated_usage: 1,
    priority: "HIGH",
    note: "V8.0 修正：美股衍生品數據（theocc.com + cboe.com，stooq.com 不提供衍生品數據）"
  },
  
  "P5_DERIVATIVES_TAIWAN": {
    cx: "GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN",
    sites: [
      // 台股衍生品（統一使用 taifex.com.tw）
      "taifex.com.tw"  // ⭐ 台灣期交所官方（台指期、電子期、金融期、選擇權、Put/Call、IV、Greeks）
      // ⚠️ 重要：stooq.com 不提供衍生品數據（OI、IV、Greeks）
      // 必須使用交易所官方來源，不能用 stooq.com
    ],
    daily_limit: 100,
    estimated_usage: 1,
    priority: "HIGH",
    note: "V8.0 修正：台股衍生品數據（統一使用 taifex.com.tw，stooq.com 不提供衍生品數據）"
  },
  
  "P5_DERIVATIVES_JAPAN": {
    cx: "GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN",
    sites: [
      // 日股衍生品（統一使用 jpx.co.jp）
      "jpx.co.jp"  // ⭐ JPX 大阪交易所官方（日經225期貨/選擇權、TOPIX期貨、個股選擇權）
      // ⚠️ 重要：stooq.com 不提供衍生品數據（OI、IV、Greeks）
      // 必須使用交易所官方來源，不能用 stooq.com
    ],
    daily_limit: 100,
    estimated_usage: 1,
    priority: "HIGH",
    note: "V8.0 修正：日股衍生品數據（統一使用 jpx.co.jp，stooq.com 不提供衍生品數據）"
  },
  "P5_NEWS": {
    cx: "GOOGLE_CSE_CX_P5_NEWS",
    sites: [
      // 權威新聞媒體
      "reuters.com",         // ✅ 路透社
      "ft.com",             // ✅ 金融時報（全文部分鎖，但標題與快訊可抓）
      "wsj.com",             // ✅ 華爾街日報（標題/摘要可抓）
      "nikkei.com",          // ✅ 日經新聞（新聞可抓）
      // 官方敘事源（V7.2 新增）
      "federalreserve.gov",  // ⭐ 聯準會官方（Fed 講話、政策聲明）
      "bis.org",             // ⭐ 國際清算銀行（BIS）
      "imf.org",             // ⭐ 國際貨幣基金組織（IMF）
      "ecb.europa.eu",       // ⭐ 歐洲央行（ECB）
      "boj.or.jp",           // ⭐ 日本央行（BOJ）
      "treasury.gov",        // ⭐ 美國財政部
      "whitehouse.gov",      // ⭐ 白宮（政策聲明）
      // 亞洲官方敘事層（V7.2 補丁：避免亞洲 shock 晚 3-7 天進系統）
      "pbc.gov.cn",          // ⭐ 中國央行（PBoC）
      "ndrc.gov.cn",         // ⭐ 中國發改委（NDRC）
      "mof.gov.cn",          // ⭐ 中國財政部（MOF）
      "meti.go.jp",          // ⭐ 日本經產省（METI）
      "cbc.gov.tw",          // ⭐ 台灣央行
      "ndc.gov.tw"           // ⭐ 台灣國發會
    ],
    daily_limit: 100,
    estimated_usage: 5,  // 每日多語新聞搜尋
    priority: "HIGH",
    note: "V7.2：權威新聞 + 官方敘事源（全球 + 亞洲）- 避免亞洲 shock 晚 3-7 天進系統"
  },
  "P5_WORLD": {
    cx: "GOOGLE_CSE_CX_P5_WORLD",
    sites: [
      "fred.stlouisfed.org", // ✅ FRED 官方（宏觀經濟數據）
      "bea.gov",             // ⭐ Bureau of Economic Analysis 官方
      "bls.gov",             // ⭐ Bureau of Labor Statistics 官方（就業數據）
      "treasury.gov",        // ⭐ US Treasury 官方（國債數據）
      "worldbank.org",       // ⭐ 世界銀行（全球資金流、Emerging Markets）
      "finance.yahoo.com"    // ⭐ V8.0 新增：Yahoo Finance（商品價格、匯率、指數） - 透過 CSE 搜尋確保當天數據
      // 移除：investing.com（前端層）
    ],
    daily_limit: 100,
    estimated_usage: 2,
    priority: "HIGH",
    note: "V8.0：世界宏觀資訊 - 官方宏觀經濟數據源 + Yahoo Finance（商品價格、匯率、指數）"
  },
  
  // ⭐ V8.0 修正：P5_MACRO 使用現有的 P5_WORLD CSE（CX ID: 519d1500d22b24e31）
  // 不需要新增 P5_MACRO CSE，直接使用 P5_WORLD
  // P5_WORLD 已包含 fred.stlouisfed.org，Yahoo Finance JSON API 不需要 CSE（直接 API 調用）
  
  // V7.1 新增配置
  "INSTITUTIONAL_DATA": {
    cx: "GOOGLE_CSE_CX_INSTITUTIONAL",
    sites: [
      "sec.gov",           // 13F 文件
      "finra.org",         // Dark Pool 數據（FINRA ATS）
      "nasdaq.com",        // Options Flow
      "cboe.com",          // 期權數據
      "dtcc.com"           // ⭐ DTCC（全球股票交割與清算）- Fails to Deliver、Settlement stress
    ],
    daily_limit: 100,
    estimated_usage: 10,  // 每週 1 次，約 10 次/週（分攤到每天約 1-2 次）
    priority: "HIGH",
    note: "V7.2：機構級數據搜尋：13F、Dark Pool、Options Flow、交割清算數據"
  },
  
  // ⭐ V8.9 新增：機構評級新聞碎片重構（Tier 2 快訊聚合網站）
  "P5_INSTITUTIONAL_RATINGS": {
    cx: "GOOGLE_CSE_CX_P5_INSTITUTIONAL_RATINGS",  // 需要在 PropertiesService 中配置
    sites: [
      // 美股（US Markets）- Tier 2 洩漏節點（格式最標準化）
      "thefly.com",        // ⭐⭐⭐ 絕對王者：華爾街公認的「免費快訊王」（格式：Nvidia target raised to $180 from $150 at Goldman Sachs）
      "streetinsider.com", // 備選：StreetInsider（格式類似）
      "benzinga.com",      // 備選：Benzinga（格式類似）
      // 台股（Taiwan Markets）- 權威轉譯
      "anue.com.tw",       // ⭐⭐⭐ 鉅亨網：外資報告發布後迅速編譯成中文快訊（關鍵字：外資、大摩、小摩）
      "money.udn.com",     // 備選：經濟日報（用於交叉驗證）
      // 日股（Japan Markets）- 本土最強
      "minkabu.jp",        // ⭐⭐⭐ Minkabu（みんかぶ）：日本散戶和機構最常用資訊站（レーティング、目標株価更新最快）
      "kabutan.jp",        // 備選：Kabutan（株探）：格式類似
      // 通用備選（全球覆蓋）
      "reuters.com",       // 路透社（可能有部分評級新聞）
      "bloomberg.com"      // 彭博（可能有部分評級新聞，但通常較慢）
    ],
    daily_limit: 100,
    estimated_usage: 20,  // 每週 P5 Weekly 執行時，每個 ticker 約 2-3 次搜尋（美股/台股/日股）
    priority: "HIGH",
    note: "V8.9：機構評級新聞碎片重構 - 鎖定 Tier 2 快訊聚合網站（The Fly、鉅亨網、Minkabu），從標準化新聞標題重構歷史評級事件"
  },
  
  "P2_US_TAIWAN": {
    cx: "GOOGLE_CSE_CX_P2_US_TAIWAN",
    sites: [
      // ⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計
      // 防止財報計算方式偏移：P2 的持股清單與同業財報數據都要來自同一個權威財報網站
      // 美股和台股統一使用財報狗網站
      // 注意：需要確保 Google CSE 後台設定只搜尋財報狗網站
      "statementdog.com"  // ⭐ 財報狗網站（用於白名單測試驗證）
    ],
    daily_limit: 100,
    estimated_usage: 5,  // P2 美股和台股財務數據搜尋（合併計算）
    priority: "HIGH",
    note: "V8.0 SSOT 定案：P2 統一數據源設計 - 美股和台股統一使用財報狗網站，防止財報計算方式偏移"
  },
  
  "P2_JAPAN": {
    cx: "GOOGLE_CSE_CX_P2_JAPAN",
    sites: [
      // ⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計
      // 防止財報計算方式偏移：P2 的持股清單與同業財報數據都要來自同一個權威財報網站
      // 日股統一使用 buffet code 網站
      // 注意：需要確保 Google CSE 後台設定只搜尋 buffet code 網站
      "buffett-code.com"  // ⭐ buffet code 網站（用於白名單測試驗證）
    ],
    daily_limit: 100,
    estimated_usage: 2,  // P2 日股財務數據搜尋
    priority: "HIGH",
    note: "V8.0 SSOT 定案：P2 統一數據源設計 - 日股統一使用 buffet code 網站，防止財報計算方式偏移"
  },
  
  "TAIWAN_STOCK": {
    cx: "GOOGLE_CSE_CX_TAIWAN_STOCK",
    sites: [
      // ⚠️ 注意：此 CSE 專門用於台股股價資料數據，不是財務報表數據
      // P2 財務數據不應使用此 CSE
      // 需要確保 Google CSE 後台設定只搜尋對應的台股股價資料網站
      // 常見的台股股價資料網站：twse.com.tw, tpex.org.tw, yahoo.com.tw, etc.
      "twse.com.tw",  // ⭐ 台灣證券交易所（用於白名單測試驗證）
      "tpex.org.tw"   // ⭐ 櫃買中心（用於白名單測試驗證）
    ],
    daily_limit: 100,
    estimated_usage: 2,
    priority: "MEDIUM",
    note: "V8.0：台股股價資料數據 - 不用於 P2 財務數據，專門用於股價資料收集"
  },
  
  "SUPPLY_CHAIN": {
    cx: "GOOGLE_CSE_CX_SUPPLY_CHAIN",
    sites: [
      // 財報數據
      "sec.gov",           // 供應商財報（美國）
      "mops.twse.com.tw",  // 供應商財報（台灣）
      // 新聞
      "bloomberg.com",     // 供應鏈新聞
      "reuters.com",       // 供應鏈新聞
      // 供應鏈原始資料（V7.2 新增）
      "importyeti.com",    // ⭐ 實際報關單數據（有免費查詢額度）- 非常強（美國視角）
      "panjiva.com",       // ⭐ 實際報關單數據（有免費查詢額度）- 非常強（美國視角）
      "marinetraffic.com"  // ⭐ V7.2 補丁：全球 AIS 船舶追蹤（世界級海運實物流）- 中國→東南亞、日韓→中國、歐洲→美國
    ],
    daily_limit: 100,
    estimated_usage: 2,  // 每月 1 次，約 2 次/月（分攤到每天）
    priority: "MEDIUM",
    note: "V7.2：供應鏈原始資料（報關單 + 全球海運實物流）+ 財報 + 新聞 - hedge fund 追 commodity shock 的第一層"
  },
  
  "EARNINGS_CALENDAR": {
    cx: "GOOGLE_CSE_CX_EARNINGS",
    sites: [
      // 美股
      "sec.gov",             // ⭐ SEC 官方（10-Q, 10-K 財報日期）
      "edgar.sec.gov",       // ⭐ EDGAR 官方數據庫（財報文件）
      "ir.stockpr.com",      // ⭐ 公司自己 IR 的發布源
      // 日股
      "edinet-fsa.go.jp",    // ⭐ 金融廳 EDINET 官方（財報數據，法律層級）
      "tdnet.info",          // ⭐ TDnet 官方（即時公告）
      // 台股
      "mops.twse.com.tw"     // ✅ 台灣公開資訊觀測站官方（台灣財報日曆）
      // 移除：zacks.com, investing.com, nasdaq.com（前端層，不可稽核）
    ],
    daily_limit: 100,
    estimated_usage: 5,  // 財報前風險評估（觸發式）
    priority: "MEDIUM",
    note: "V7.2：法律層級的財報真實來源（SEC + EDINET + 台灣公開資訊觀測站）+ 公司 IR 發布源"
  },
  
  // V7.2 新增：人類雷達 CSE（不進 M0、不進 BELIEF_LOG、不進 STATE）
  "HUMAN_SIGNAL": {
    cx: "GOOGLE_CSE_CX_HUMAN_SIGNAL",
    sites: [
      // 衍生品訊號的前端敘事層 + 即時警報層（人類用，不進系統）
      "unusualwhales.com",   // ⚠️ 衍生品訊號的前端敘事層 + 即時警報層（人類用，不進系統）
      "spotgamma.com",       // ⚠️ Options Flow 分析（人類用，不進系統）
      "menthorq.com",        // ⚠️ Options Flow 分析（人類用，不進系統）
      // 從其他 CSE 移入的前端敘事層（人類用，不進系統）
      "statementdog.com",    // ⚠️ 財報狗（前端敘事層，人類用，不進系統）
      "moneydj.com",         // ⚠️ 前端敘事層（人類用，不進系統）
      "cmoney.tw",           // ⚠️ 前端敘事層（人類用，不進系統）
      "buffett-code.com"     // ⚠️ UI/快篩層（人類用，不進系統）
    ],
    daily_limit: 100,
    estimated_usage: 0,  // 人類手動使用，不自動觸發
    priority: "LOW",
    note: "⚠️ 人類雷達：用於人工看盤和警報，不進 M0、不進 BELIEF_LOG、不進 STATE。正確用法：用它找異常，然後回官方數據源查證"
  }
};

/**
 * 獲取 Google CSE CX ID
 * @param {string} cseType - CSE 類型
 * @return {string} CSE CX ID
 */
function getGoogleCSE_CX(cseType) {
  const properties = PropertiesService.getScriptProperties();
  const cxName = GOOGLE_CSE_CONFIG[cseType]?.cx;
  
  if (!cxName) {
    throw new Error(`CSE 類型未配置：${cseType}`);
  }
  
  const cxId = properties.getProperty(cxName);
  
  if (!cxId) {
    throw new Error(`CSE CX ID 未配置：${cxName}，請在 PropertiesService 中設置`);
  }
  
  return cxId;
}

// ==========================================
// 成本估算配置
// ==========================================

/**
 * 估算任務成本（基於 Token 數量）
 * @param {string} modelName - 模型名稱
 * @param {number} inputTokens - 輸入 Token 數
 * @param {number} outputTokens - 輸出 Token 數
 * @return {number} 估算成本（美元）
 */
function estimateCost(modelName, inputTokens, outputTokens) {
  const config = M0_MODEL_CONFIG[modelName];
  
  if (!config) {
    Logger.log(`警告：模型 ${modelName} 未配置，無法估算成本`);
    return 0;
  }
  
  // ⭐ V8.0 更新：支援分開的 Input 和 Output 價格
  const inputPrice = config.costPer1KTokens || 0;
  const outputPrice = config.costPer1KOutputTokens || (config.costPer1KTokens * 1.5);  // 如果沒有分開價格，使用 1.5 倍估算
  
  // Gemini 3.0 Pro 超過 200K 時使用不同價格
  let actualInputPrice = inputPrice;
  let actualOutputPrice = outputPrice;
  if (config.costPer1KTokensOver200K && inputTokens > 200000) {
    actualInputPrice = config.costPer1KTokensOver200K;
    actualOutputPrice = config.costPer1KOutputTokensOver200K || (config.costPer1KTokensOver200K * 1.5);
  }
  
  const inputCost = (inputTokens / 1000) * actualInputPrice;
  const outputCost = (outputTokens / 1000) * actualOutputPrice;
  
  return inputCost + outputCost;
}

// ==========================================
// 重試配置
// ==========================================

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,  // 1 秒
  maxDelay: 30000,  // 30 秒
  backoffMultiplier: 2
};

/**
 * 計算重試延遲時間（指數退避）
 * @param {number} retryCount - 重試次數（從 1 開始）
 * @return {number} 延遲時間（毫秒）
 */
function calculateRetryDelay(retryCount) {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount - 1),
    RETRY_CONFIG.maxDelay
  );
  return delay;
}

// ==========================================
// 執行時間閾值配置（用於監控）
// ==========================================

const EXECUTION_TIME_THRESHOLDS = {
  "P0": 10 * 60 * 1000,  // 10 分鐘
  "P0_7": 10 * 60 * 1000,  // 10 分鐘
  "P1": 30 * 60 * 1000,  // 30 分鐘（15 批次）
  "P2_QUARTERLY": 15 * 60 * 1000,  // 15 分鐘
  "P2_MONTHLY": 10 * 60 * 1000,  // 10 分鐘
  "P3": 20 * 60 * 1000,  // 20 分鐘（60 檔）
  "P4": 5 * 60 * 1000,  // 5 分鐘（純計算）
  "P5_DAILY": 10 * 60 * 1000,  // 10 分鐘
  "P5_WEEKLY": 15 * 60 * 1000,  // 15 分鐘
  "P5_MONTHLY": 10 * 60 * 1000,  // 10 分鐘
  "P5_QUARTERLY": 20 * 60 * 1000  // 20 分鐘
};

/**
 * 獲取任務的執行時間閾值
 * @param {string} projectId - 項目 ID
 * @return {number} 執行時間閾值（毫秒）
 */
function getExecutionTimeThreshold(projectId) {
  return EXECUTION_TIME_THRESHOLDS[projectId] || 10 * 60 * 1000;  // 預設 10 分鐘
}
