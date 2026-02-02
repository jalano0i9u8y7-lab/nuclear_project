/**
 * 📊 P2: 基本面分析（Fundamental Analysis）
 * 
 * 基於 P1 的公司池，進行基本面安全性 Gate 檢查和分層決策
 * - Gate 檢查（安全性檢查）
 * - 分層決策（Tier Assignment）：CORE, STABLE_SWING, AGGRESSIVE, OPPORTUNISTIC
 * - 財務指標分析
 * - 同業比較
 * 
 * 執行頻率：
 * - P2_MONTHLY：每月執行（針對所有 Master_Candidates）
 * - P2_QUARTERLY：每季執行（更深入的分析）
 * 
 * @version SSOT V8.17.1
 * @date 2025-01-11
 * @changes V8.17.1: 三軸評級分數增強（Safety_Score 硬風控 Caps、共用函數抽取、Growth_Quality_Score Validator、Future_Potential_Score Evidence Validation）
 */

// ==========================================
// P2 配置參數
// ==========================================

const P2_CONFIG = {
  // ⭐ V8.0 新增：批次處理配置
  BATCH_SIZE: 6,  // 批次大小（6 家/批，符合成本估算假設）
  BATCH_DELAY_MS: 2000,  // 批次間延遲（毫秒，避免 API 限流）
  
  // 執行頻率
  frequency_monthly: "MONTHLY",  // 每月執行
  frequency_quarterly: "QUARTERLY",  // 每季執行
  
  // Gate 檢查閾值
  gate_thresholds: {
    revenue_yoy_min: 0.05,        // 營收年增率最低 5%
    gross_margin_min: 0.20,       // 毛利率最低 20%
    operating_margin_min: 0.10,   // 營業利益率最低 10%
    net_margin_min: 0.05,         // 淨利率最低 5%
    cfo_positive: true,           // CFO 必須為正
    fcf_positive: true,           // FCF 必須為正（成長股可放寬）
    net_debt_ebitda_max: 3.0,     // Net Debt/EBITDA 最高 3.0
    roic_min: 0.10,               // ROIC 最低 10%
    current_ratio_min: 1.0        // 流動比率最低 1.0
  },
  
  // 分層決策標準
  tier_criteria: {
    CORE: {
      gate_result: "PASS",
      confidence_min: 0.80,
      financial_strength: "STRONG",
      moat_type: ["WIDE", "NARROW"],
      rerate_state: ["ACCELERATING", "PEAK"]
    },
    STABLE_SWING: {
      gate_result: "PASS",
      confidence_min: 0.65,
      financial_strength: ["STRONG", "MODERATE"],
      moat_type: ["WIDE", "NARROW", "NONE"],
      rerate_state: ["ACCELERATING", "PEAK", "EARLY"]
    },
    AGGRESSIVE: {
      gate_result: "PASS",
      confidence_min: 0.50,
      financial_strength: ["STRONG", "MODERATE", "WEAK"],
      moat_type: ["NARROW", "NONE"],
      rerate_state: ["EARLY", "ACCELERATING"]
    },
    OPPORTUNISTIC: {
      gate_result: ["PASS", "PARTIAL"],
      confidence_min: 0.40,
      financial_strength: ["MODERATE", "WEAK"],
      moat_type: ["NONE"],
      rerate_state: ["EARLY"]
    }
  }
};

// ==========================================
// P2 核心函數
// ==========================================

/**
 * P2 主執行函數（月度）
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P1_UPDATE / MONTHLY / MANUAL）
 * @param {Object} params.user_input - 用戶輸入（來自執行前確認）
 * @param {string} params.p1_snapshot_id - P1 快照 ID（可選）
 * @return {Object} P2 分析結果
 */
function P2_Monthly_Execute(params) {
  return P2_Execute({
    ...params,
    frequency: "MONTHLY",
    project_id: "P2_MONTHLY"
  });
}

/**
 * P2 主執行函數（季度）
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P1_UPDATE / QUARTERLY / MANUAL）
 * @param {Object} params.user_input - 用戶輸入（來自執行前確認）
 * @param {string} params.p1_snapshot_id - P1 快照 ID（可選）
 * @return {Object} P2 分析結果
 */
function P2_Quarterly_Execute(params) {
  return P2_Execute({
    ...params,
    frequency: "QUARTERLY",
    project_id: "P2_QUARTERLY"
  });
}

/**
 * P2 主執行函數（通用）
 * @param {Object} params - 參數
 * @param {string} params.frequency - 頻率（MONTHLY / QUARTERLY）
 * @param {string} params.project_id - 專案 ID（P2_MONTHLY / P2_QUARTERLY）
 * @param {string} params.trigger - 觸發來源
 * @param {Object} params.user_input - 用戶輸入
 * @param {string} params.p1_snapshot_id - P1 快照 ID
 * @return {Object} P2 分析結果
 */
function P2_Execute(params) {
  const startTime = Date.now();
  
  // ⭐ 立即記錄日誌，確保函數被調用時有輸出
  Logger.log("=".repeat(60));
  Logger.log(`🚀 P2_Execute 函數被調用`);
  Logger.log(`P2 參數：frequency=${params.frequency || "未設置"}, trigger=${params.trigger || "未設置"}, project_id=${params.project_id || "未設置"}`);
  Logger.log("=".repeat(60));
  
  try {
    Logger.log(`P2 ${params.frequency} 執行開始：trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 檢查執行前確認
    // ========================================
    
    const jobId = params.job_id || `P2_${params.frequency}_${Date.now()}`;
    
    // ⭐ 修正：傳遞 context 參數給 checkPreExecutionConfirmation，讓它檢查 skip_confirmation
    const confirmation = checkPreExecutionConfirmation(jobId, params.project_id, params.context || {});
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions(params.project_id, params.context);
        const confirmationId = savePreExecutionQuestions(jobId, params.project_id, questions);
        
        return {
          status: "REQUIRES_CONFIRMATION",
          confirmation_id: confirmationId,
          questions: questions,
          message: "請在 M0__JOB_CONFIRMATION 表格中填寫答案並確認"
        };
      } else {
        return {
          status: "PENDING_CONFIRMATION",
          confirmation_id: confirmation.confirmation_id,
          message: "等待用戶確認"
        };
      }
    }
    
    const userInput = confirmation.answers || params.user_input || {};
    
    // ========================================
    // Step 2: 讀取 P1 Master_Candidates
    // ========================================
    
    let masterCandidates = [];
    
    Logger.log(`P2 調試：開始讀取 P1 Master_Candidates，params.p1_snapshot_id=${params.p1_snapshot_id || "無"}`);
    
    if (params.p1_snapshot_id) {
      Logger.log(`P2 調試：嘗試從 P1 快照讀取：${params.p1_snapshot_id}`);
      const p1Snapshot = getP1SnapshotById(params.p1_snapshot_id);
      if (p1Snapshot && p1Snapshot.p1_output_json) {
        try {
          const p1Output = typeof p1Snapshot.p1_output_json === 'string' ?
            JSON.parse(p1Snapshot.p1_output_json) : p1Snapshot.p1_output_json;
          masterCandidates = p1Output.master_candidates || [];
          Logger.log(`P2 調試：從快照讀取到 ${masterCandidates.length} 個 Master_Candidates`);
        } catch (e) {
          Logger.log(`P2 調試：快照 JSON 解析失敗：${e.message}`);
        }
      } else {
        Logger.log(`P2 調試：快照不存在或沒有 p1_output_json`);
      }
    }
    
    // 如果沒有從快照獲取，直接從表格讀取
    if (masterCandidates.length === 0) {
      Logger.log(`P2 調試：從快照讀取失敗，嘗試從表格讀取`);
      masterCandidates = getMasterCandidatesFromSheet();
      Logger.log(`P2 調試：從表格讀取到 ${masterCandidates.length} 個 Master_Candidates`);
    }
    
    if (masterCandidates.length === 0) {
      Logger.log(`P2 調試：無法讀取到任何 Master_Candidates，拋出錯誤`);
      throw new Error("P1 Master_Candidates 不存在，請先執行 P1");
    }
    
    Logger.log(`P2 讀取到 ${masterCandidates.length} 個 Master_Candidates`);
    
    // ========================================
    // Step 3: 收集外部財務數據（優先使用權威數據源）
    // ========================================
    
    Logger.log(`P2 開始收集外部財務數據（${masterCandidates.length} 個公司）`);
    Logger.log(`P2 調試：財務數據收集函數開始執行...`);
    
    // ⭐ 收集目標公司的財務數據（同業數據將在 Stage 2 收集）
    let financialData = {};
    try {
      financialData = collectFinancialDataFromExternalSources(masterCandidates, params.frequency);
      Logger.log(`P2 財務數據收集完成：${Object.keys(financialData).length} 個公司有數據`);
    } catch (error) {
      Logger.log(`P2 警告：財務數據收集失敗（${error.message}），使用空數據繼續執行`);
      financialData = {};
    }
    
    // ⚠️ 注意：同業公司的財務數據將在 Stage 2 根據 AI 識別的同業清單收集
    
    // ⭐ V8.14 新增：載入 P1 提取的財報資料作為輔助和對照
    let p1FinancialReportData = {};
    try {
      // 使用 P1 的 loadFinancialReportExtractions 函數（如果可用）
      if (typeof loadFinancialReportExtractions === 'function') {
        p1FinancialReportData = loadFinancialReportExtractions(masterCandidates);
        Logger.log(`P2 載入 P1 財報提取資料完成：${Object.keys(p1FinancialReportData).length} 個公司有資料`);
      } else {
        Logger.log(`P2 警告：loadFinancialReportExtractions 函數不可用，跳過 P1 財報資料載入`);
      }
    } catch (error) {
      Logger.log(`P2 警告：載入 P1 財報提取資料失敗（${error.message}），繼續執行`);
      p1FinancialReportData = {};
    }
    
    Logger.log(`P2 調試：財務數據收集完成，準備提交到 M0`);
    
    // ========================================
    // Step 4: ⭐ V8.17 新增：Batch API 處理邏輯
    // ========================================
    
    // ⭐ V8.17 新增：判斷是否使用 Batch API
    const useBatch = shouldUseBatch(params.project_id);
    const executorModel = TASK_TO_EXECUTOR[params.project_id] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const canUseBatch = useBatch && executorConfig && executorConfig.supportsBatch;
    
    if (canUseBatch) {
      Logger.log(`P2：使用 Batch API（Provider: ${executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai"}, Model: ${executorConfig.model}）`);
      
      // ⭐ V8.17 新增：使用 Batch API 處理所有公司
      return P2_ExecuteWithBatch(masterCandidates, financialData, p1FinancialReportData, params, userInput);
    } else {
      Logger.log(`P2：使用同步 API（不適用 Batch 或模型不支援）`);
      
      // ⭐ V8.17 保留：同步 API 處理（作為備用）
      // ⭐ V8.17 修正：測試模式輪詢邏輯已移到 P2_ExecuteWithSyncAPI 內部
      return P2_ExecuteWithSyncAPI(masterCandidates, financialData, p1FinancialReportData, params, userInput);
    }
    
    // ⚠️ Dead Code 已移除：測試模式輪詢邏輯已移到 P2_ExecuteWithSyncAPI 函數內部
    
  } catch (error) {
    Logger.log(`P2 ${params.frequency} 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P2 使用 Batch API 執行
 */
function P2_ExecuteWithBatch(masterCandidates, financialData, p1FinancialReportData, params, userInput) {
  try {
    Logger.log(`P2：開始 Batch API 處理（共 ${masterCandidates.length} 個公司）`);
    
    // 為每個公司準備數據
    const allCompanyData = [];
    for (const candidate of masterCandidates) {
      const ticker = candidate.Company_Code || candidate.ticker || candidate.company_code;
      const market = candidate.Market || candidate.market || "";
      const companyFinancialData = financialData[ticker] || {};
      const companyP1FinancialReportData = p1FinancialReportData[`${ticker}_${market}`] || {};
      
      allCompanyData.push({
        candidate: candidate,
        ticker: ticker,
        market: market,
        financial_data: companyFinancialData,
        p1_financial_report_data: companyP1FinancialReportData
      });
    }
    
    // 使用通用 Batch 執行函數
    const batchResult = executeBatchJob({
      project_id: params.project_id,
      frequency: params.frequency,
      items: allCompanyData,
      buildSystemBlocks: (ctx) => buildP2SystemBlocks(ctx, params),
      buildUserPayload: (item, ctx) => buildP2UserPayloadForBatch(item, ctx, params, userInput),
      context: {
        previous_snapshot: getLatestP2Snapshot(),
        gate_thresholds: P2_CONFIG.gate_thresholds,
        tier_criteria: P2_CONFIG.tier_criteria,
        ...params.context
      }
    });
    
    Logger.log(`P2：Batch Job 已提交，batch_id=${batchResult.batch_id}`);
    
    // 返回 Batch Job ID，需要後續調用 processBatchJobResults 處理結果
    return {
      status: "SUBMITTED_BATCH",
      batch_id: batchResult.batch_id,
      provider_batch_id: batchResult.provider_batch_id,
      request_count: batchResult.request_count,
      frequency: params.frequency,
      message: `P2 ${params.frequency} Batch Job 已提交（${batchResult.request_count} 個請求），請等待完成後執行 P2_ProcessBatchResults() 處理結果`
    };
    
  } catch (error) {
    Logger.log(`P2 Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P2 使用同步 API 執行（備用）
 */
function P2_ExecuteWithSyncAPI(masterCandidates, financialData, p1FinancialReportData, params, userInput) {
  // 保留原有的分批提交到 M0 Job Queue 邏輯
  const BATCH_SIZE = P2_CONFIG.BATCH_SIZE || 6;
  const totalBatches = Math.ceil(masterCandidates.length / BATCH_SIZE);
  
  Logger.log(`P2：開始同步 API 分批處理（共 ${masterCandidates.length} 個公司，分成 ${totalBatches} 批，每批 ${BATCH_SIZE} 家）`);
  
  const requestedFlow = [
    "EXECUTOR",
    "AUDITOR"
  ];
  
  const allBatchJobIds = [];
  
  for (let i = 0; i < masterCandidates.length; i += BATCH_SIZE) {
    const batch = masterCandidates.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      const batchFinancialData = {};
      batch.forEach(candidate => {
        const ticker = candidate.Company_Code || candidate.ticker || candidate.company_code;
        if (ticker && financialData[ticker]) {
          batchFinancialData[ticker] = financialData[ticker];
        }
      });
      
      const batchP1FinancialReportData = {};
      batch.forEach(candidate => {
        const ticker = candidate.Company_Code || candidate.ticker || candidate.company_code;
        const market = candidate.Market || candidate.market || "";
        if (ticker && p1FinancialReportData[`${ticker}_${market}`]) {
          batchP1FinancialReportData[`${ticker}_${market}`] = p1FinancialReportData[`${ticker}_${market}`];
        }
      });
      
      const batchM0InputPayload = {
        phase: params.project_id,
        frequency: params.frequency,
        trigger: params.trigger,
        user_input: userInput,
        master_candidates: batch,
        financial_data: batchFinancialData,
        p1_financial_report_data: batchP1FinancialReportData,
        previous_snapshot: getLatestP2Snapshot(),
        gate_thresholds: P2_CONFIG.gate_thresholds,
        tier_criteria: P2_CONFIG.tier_criteria,
        context: params.context || {},
        batch_number: batchNumber,
        total_batches: totalBatches,
        is_batch_processing: true
      };
      
      batchM0InputPayload.p2_prompt = buildP2BatchPrompt(
        params.frequency,
        userInput,
        batch,
        batchFinancialData,
        batchP1FinancialReportData,
        batchM0InputPayload.previous_snapshot,
        batchNumber,
        totalBatches
      );
      
      const batchJobId = submitToM0JobQueue(params.project_id, requestedFlow, batchM0InputPayload);
      allBatchJobIds.push(batchJobId);
      
      if (i + BATCH_SIZE < masterCandidates.length) {
        Utilities.sleep(P2_CONFIG.BATCH_DELAY_MS || 2000);
      }
    } catch (error) {
      Logger.log(`P2：批次 ${batchNumber} 處理失敗：${error.message}`);
    }
  }
  
  // ⭐ V8.17 修正：測試模式輪詢邏輯（從 P2_Execute 移入）
  if (params.context && params.context.test_mode === true && allBatchJobIds.length > 0) {
    Logger.log(`P2：測試模式檢測到，開始自動輪詢 M0 結果（共 ${allBatchJobIds.length} 個任務）...`);
    
    try {
      // 輪詢 M0 結果（最多等待 180 秒）
      const maxWaitTime = 180000;  // 180 秒
      const pollInterval = 2000;  // 2 秒
      const m0ExecuteInterval = 2000;  // 每 2 秒調用一次 M0_Execute()
      const startTime = Date.now();
      let lastM0ExecuteTime = 0;
      
      // 簡化處理：只輪詢第一個任務（測試模式通常量少）
      const jobId_final = allBatchJobIds[0];
      
      while (Date.now() - startTime < maxWaitTime) {
        // 優先檢查 M0__RESULT 中是否有本次任務的結果
        const m0Result = getM0JobResult(jobId_final);
        
        if (m0Result && m0Result.output) {
          Logger.log(`P2：M0 任務 ${jobId_final} 執行完成`);
          
          // 解析 M0 結果結構
          const finalOutput = m0Result.output || {};
          let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || {};
          let auditorOutput = finalOutput.auditor_output || finalOutput.auditor || finalOutput.audit_output || {};
          
          if (!executorOutput || Object.keys(executorOutput).length === 0) {
            executorOutput = finalOutput;
          }
          
          const m0ResultPayload = {
            executor_output: executorOutput,
            auditor_output: auditorOutput,
            master_candidates: masterCandidates,
            financial_data: financialData,
            frequency: params.frequency,
            trigger: params.trigger || "LIGHT_TEST"
          };
          
          // 調用處理函數
          const p2Result = P2_ProcessM0Result(jobId_final, m0ResultPayload);
          
          return {
            status: p2Result.status || "COMPLETED",
            job_id: jobId_final,
            job_ids: allBatchJobIds,
            snapshot_id: p2Result.snapshot_id,
            frequency: params.frequency,
            p2_result: p2Result
          };
        }
        
        // 定期調用 M0_Execute() 處理隊列中的任務
        if (Date.now() - lastM0ExecuteTime >= m0ExecuteInterval) {
          try {
            M0_Execute();
            lastM0ExecuteTime = Date.now();
            Logger.log(`P2：已調用 M0_Execute() 處理隊列中的任務`);
          } catch (m0Error) {
            Logger.log(`P2：調用 M0_Execute() 失敗：${m0Error.message}`);
          }
        }
        
        // 檢查本次任務的狀態
        const jobStatus = checkM0JobStatus(jobId_final);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        if (jobStatus === "NEW") {
          Logger.log(`P2：輪詢中，job_id=${jobId_final}, status=${jobStatus}, 已等待=${elapsed}秒（隊列中可能有其他任務在處理，繼續等待）`);
        } else {
          Logger.log(`P2：輪詢中，job_id=${jobId_final}, status=${jobStatus}, 已等待=${elapsed}秒`);
        }
        
        if (jobStatus === "DONE") {
          // 任務已完成，但結果可能還沒寫入 M0__RESULT，多次重試
          Logger.log(`P2：任務狀態為 DONE，多次重試檢查結果...`);
          let retryCount = 0;
          const maxRetries = 10;
          const retryDelay = 1000;
          
          while (retryCount < maxRetries) {
            Utilities.sleep(retryDelay);
            retryCount++;
            
            const m0ResultRetry = getM0JobResult(jobId_final);
            if (m0ResultRetry && m0ResultRetry.output) {
              Logger.log(`P2：M0 任務 ${jobId_final} 執行完成（從 DONE 狀態檢測到結果，重試 ${retryCount} 次）`);
              
              const finalOutput = m0ResultRetry.output || {};
              let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || {};
              let auditorOutput = finalOutput.auditor_output || finalOutput.auditor || finalOutput.audit_output || {};
              
              if (!executorOutput || Object.keys(executorOutput).length === 0) {
                executorOutput = finalOutput;
              }
              
              const m0ResultPayload = {
                executor_output: executorOutput,
                auditor_output: auditorOutput,
                master_candidates: masterCandidates,
                financial_data: financialData,
                frequency: params.frequency,
                trigger: params.trigger || "LIGHT_TEST"
              };
              
              const p2Result = P2_ProcessM0Result(jobId_final, m0ResultPayload);
              
              return {
                status: p2Result.status || "COMPLETED",
                job_id: jobId_final,
                job_ids: allBatchJobIds,
                snapshot_id: p2Result.snapshot_id,
                frequency: params.frequency,
                p2_result: p2Result
              };
            }
            Logger.log(`P2：重試 ${retryCount}/${maxRetries}：結果尚未寫入 M0__RESULT，繼續等待...`);
          }
          Logger.log(`P2：任務狀態為 DONE 但重試 ${maxRetries} 次仍未找到結果，繼續輪詢...`);
          continue;
        }
        
        // 等待一段時間後再次檢查
        Utilities.sleep(pollInterval);
      }
      
      // 超時
      Logger.log(`P2：M0 執行超時，請稍後手動檢查結果`);
      return {
        status: "SUBMITTED",
        job_ids: allBatchJobIds,
        total_batches: totalBatches,
        frequency: params.frequency,
        message: `P2 ${params.frequency} 任務已提交到 M0，但執行超時，請手動執行 M0_Execute() 後再查看結果`
      };
      
    } catch (error) {
      Logger.log(`P2：M0 執行失敗：${error.message}`);
      return {
        status: "SUBMITTED",
        job_ids: allBatchJobIds,
        total_batches: totalBatches,
        frequency: params.frequency,
        message: `P2 ${params.frequency} 任務已提交到 M0，但執行時發生錯誤：${error.message}，請手動執行 M0_Execute() 重試`
      };
    }
  }
  
  // 非測試模式：直接返回 SUBMITTED 狀態
  return {
    status: "SUBMITTED",
    job_ids: allBatchJobIds,
    total_batches: totalBatches,
    frequency: params.frequency,
    message: `P2 ${params.frequency} 任務已分批提交到 M0 Job Queue（${totalBatches} 批），請等待執行完成`
  };
}

// ==========================================
// ⭐ V8.17.1 新增：三軸評級分數計算共用函數
// ==========================================

/**
 * 計算 Safety_Score（基於 Safety_Grade + Hard Caps + Evidence Delta）
 * @param {Object} gateResult - Gate 結果
 * @param {Object} financialMetrics - 財務指標
 * @param {string} ticker - 股票代碼（用於日誌）
 * @return {number|null} Safety_Score (0-100) 或 null
 */
function computeSafetyScore(gateResult, financialMetrics, ticker) {
  // ⭐ V8.17.1 更新：採用建議版本（固定分數映射，不允許 AI 調整）
  const safetyGrade = (gateResult.safety_grade || "X").toUpperCase();
  if (!safetyGrade) {
    return null;
  }
  
  // Step 1: Grade → Base Score mapping（固定，不允許調整）
  let safetyScore = 40;  // 預設 X
  switch (safetyGrade) {
    case "S": safetyScore = 95; break;
    case "A": safetyScore = 80; break;
    case "B": safetyScore = 60; break;
    case "X": safetyScore = 40; break;
    default: safetyScore = 40; break;
  }
  
  // Step 2: Hint 機制（AI 輸出，不影響分數，供下游使用）
  const adjustmentHint = gateResult.safety_score_adjustment_hint || "MID";
  gateResult.safety_score_adjustment_hint = adjustmentHint;  // "UPPER" | "MID" | "LOWER"
  
  // Step 3: Hard Guardrail（程式寫死）
  const capsApplied = [];
  
  // CFO < 0 → cap 到 59
  const cfo = financialMetrics?.cfo_ttm || financialMetrics?.cash_flow_from_operations || financialMetrics?.cfo;
  if (typeof cfo === "number" && cfo < 0) {
    safetyScore = Math.min(safetyScore, 59);
    capsApplied.push("CFO_NEGATIVE_CAP");
    Logger.log(`P2 Safety Guardrail: ${ticker} CFO<0 (${cfo}) => cap Safety_Score to ${safetyScore}`);
  }
  
  // Interest Coverage < 1.5 → cap 到 49（保留現有功能）
  const interestCoverage = financialMetrics?.interest_coverage;
  if (interestCoverage !== undefined && interestCoverage !== null && interestCoverage < 1.5) {
    safetyScore = Math.min(safetyScore, 49);
    capsApplied.push("INTEREST_COVERAGE_LOW_CAP");
  }
  
  // FRONTIER runway < 4 → cap 到 55（保留現有功能）
  const trackType = gateResult.track_type || "";
  const runwayQuarters = financialMetrics?.runway_quarters;
  if (trackType === "FRONTIER" && runwayQuarters !== undefined && runwayQuarters !== null && runwayQuarters < 4) {
    safetyScore = Math.min(safetyScore, 55);
    capsApplied.push("FRONTIER_RUNWAY_LOW_CAP");
  }
  
  // 記錄 caps 應用
  if (capsApplied.length > 0) {
    gateResult.safety_caps_applied = capsApplied;
  }
  
  // Step 4: Write back（always overwrite to enforce SSOT）
  gateResult.safety_score = safetyScore;
  Logger.log(`P2: ${ticker} Safety_Score=${safetyScore} (grade=${safetyGrade}, hint=${adjustmentHint})`);
  return safetyScore;
}

/**
 * 計算 Growth_Quality_Score（帶 Validator 和缺資料處理）
 * @param {Object} growthAnalysis - 成長性分析結果
 * @param {string} ticker - 股票代碼（用於日誌）
 * @return {Object} { score: number|null, validation_errors: string[] }
 */
function computeGrowthQualityScore(growthAnalysis, ticker) {
  const validationErrors = [];
  const scores = {};
  const weights = {
    growth_rate_score: 0.30,
    growth_consistency_score: 0.25,
    operating_leverage_score: 0.20,
    cash_conversion_score: 0.25
  };
  
  // Step 1: 驗證每個分項
  for (const [key, weight] of Object.entries(weights)) {
    const value = growthAnalysis[key];
    if (value === undefined || value === null) {
      continue;  // 缺資料，跳過
    }
    
    // 類型檢查
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) {
      validationErrors.push(`${key}: 非數字值 "${value}"`);
      continue;
    }
    
    // 範圍檢查
    if (numValue < 0 || numValue > 100) {
      validationErrors.push(`${key}: 超出範圍 [0-100]: ${numValue}`);
      // Clamp 到範圍
      scores[key] = Math.max(0, Math.min(100, numValue));
    } else {
      scores[key] = numValue;
    }
  }
  
  // Step 2: 檢查可用分項數量
  const availableScores = Object.keys(scores);
  if (availableScores.length < 2) {
    Logger.log(`P2：${ticker} Growth_Quality_Score 計算失敗：可用分項不足（${availableScores.length} 個，至少需要 2 個）`);
    return {
      score: null,
      validation_errors: [...validationErrors, "可用分項不足（至少需要 2 個）"]
    };
  }
  
  // Step 3: 動態重分配權重
  const totalWeight = availableScores.reduce((sum, key) => sum + weights[key], 0);
  if (totalWeight === 0) {
    Logger.log(`P2：${ticker} Growth_Quality_Score 計算失敗：權重總和為 0`);
    return {
      score: null,
      validation_errors: [...validationErrors, "權重總和為 0"]
    };
  }
  
  // 正規化權重
  const normalizedWeights = {};
  for (const key of availableScores) {
    normalizedWeights[key] = weights[key] / totalWeight;
  }
  
  // Step 4: 計算加權總分
  let totalScore = 0;
  for (const [key, value] of Object.entries(scores)) {
    totalScore += value * normalizedWeights[key];
  }
  
  const finalScore = Math.round(totalScore);
  Logger.log(`P2：計算 ${ticker} Growth_Quality_Score = ${finalScore} (使用 ${availableScores.length} 個分項，權重已正規化)`);
  if (validationErrors.length > 0) {
    Logger.log(`P2：${ticker} Growth_Quality_Score 驗證警告: ${validationErrors.join("; ")}`);
  }
  
  // ⭐ V8.17.1 新增：硬標記（GROWTH_LOW_QUALITY）
  // cash_conversion_score 很低但 growth_rate_score 很高 → 標 GROWTH_LOW_QUALITY
  if (growthAnalysis.cash_conversion_score !== undefined && growthAnalysis.cash_conversion_score !== null &&
      growthAnalysis.growth_rate_score !== undefined && growthAnalysis.growth_rate_score !== null) {
    if (growthAnalysis.cash_conversion_score < 40 && growthAnalysis.growth_rate_score > 70) {
      growthAnalysis.growth_quality_flags = growthAnalysis.growth_quality_flags || [];
      growthAnalysis.growth_quality_flags.push("GROWTH_LOW_QUALITY");
      Logger.log(`P2：${ticker} Growth_Quality_Score 標記 GROWTH_LOW_QUALITY（現金轉換率低但成長率高）`);
    }
  }
  
  return {
    score: finalScore,
    validation_errors: validationErrors
  };
}

/**
 * 驗證 Inevitability Evidence
 * @param {Object} futurePotentialAnalysis - 未來潛力分析
 * @return {Object} { valid: boolean, errors: string[] }
 */
function validateInevitabilityEvidence(futurePotentialAnalysis) {
  const errors = [];
  const evidence = futurePotentialAnalysis.inevitability_evidence || [];
  
  if (evidence.length < 2) {
    errors.push("Inevitability evidence 不足（至少需要 2 條）");
  }
  
  const validPhases = ["P0", "P0.5", "P0_5", "P0.7", "P0_7", "P1"];
  for (let i = 0; i < evidence.length; i++) {
    const ev = evidence[i];
    if (!ev.source || !validPhases.includes(ev.source)) {
      errors.push(`Evidence[${i}]: 無效的 source "${ev.source}"（必須是 P0/P0.5/P0.7/P1）`);
    }
    if (!ev.evidence && !ev.pointer && !ev.id) {
      errors.push(`Evidence[${i}]: 缺少證據內容（必須有 evidence、pointer 或 id）`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 計算 Future_Potential_Score（帶 Evidence Validation 和 Coverage 檢查）
 * @param {Object} futurePotentialAnalysis - 未來潛力分析
 * @param {Object} financialMetrics - 財務指標（用於計算 coverage）
 * @param {string} trackType - Track Type（FRONTIER/CORE）
 * @param {number} runwayQuarters - Runway（季度數）
 * @param {string} ticker - 股票代碼（用於日誌）
 * @return {Object} { score: number|null, validation_errors: string[], caps_applied: string[] }
 */
function computeFuturePotentialScore(futurePotentialAnalysis, financialMetrics, trackType, runwayQuarters, ticker) {
  const validationErrors = [];
  const capsApplied = [];
  
  // Step 1: 驗證 Inevitability Evidence
  const inevitabilityValidation = validateInevitabilityEvidence(futurePotentialAnalysis);
  if (!inevitabilityValidation.valid) {
    validationErrors.push(...inevitabilityValidation.errors);
    // 如果 evidence 不足，降低 inevitability_score
    if (futurePotentialAnalysis.inevitability_score > 70) {
      futurePotentialAnalysis.inevitability_score = 70;
      validationErrors.push("Inevitability evidence 不足，分數已降級到 70");
    }
  }
  
  // Step 2: 計算 Executability Coverage
  const executabilityProxies = [
    "rnd_intensity", "capex_intensity", "inventory_turnover",
    "contract_liabilities", "rpo", "deferred_revenue", "guidance_evidence"
  ];
  
  let availableProxies = 0;
  for (const proxy of executabilityProxies) {
    if (financialMetrics && financialMetrics[proxy] !== undefined && financialMetrics[proxy] !== null) {
      availableProxies++;
    }
  }
  
  const executabilityCoverage = availableProxies / executabilityProxies.length;
  futurePotentialAnalysis.executability_coverage = executabilityCoverage;
  
  // Step 3: Coverage 太低時 cap 分數
  let executabilityScore = futurePotentialAnalysis.executability_score || 0;
  if (executabilityCoverage < 0.4) {
    executabilityScore = Math.min(executabilityScore, 65);
    capsApplied.push("EXECUTABILITY_LOW_COVERAGE_CAP");
    validationErrors.push(`Executability coverage 過低 (${executabilityCoverage.toFixed(2)})，分數已 cap 到 65`);
  }
  
  // Step 4: 驗證分數範圍
  const inevitabilityScore = futurePotentialAnalysis.inevitability_score || 0;
  if (inevitabilityScore < 0 || inevitabilityScore > 100) {
    validationErrors.push(`Inevitability score 超出範圍: ${inevitabilityScore}`);
  }
  if (executabilityScore < 0 || executabilityScore > 100) {
    validationErrors.push(`Executability score 超出範圍: ${executabilityScore}`);
  }
  
  // Step 5: 計算總分
  const futurePotentialScore = (inevitabilityScore * 0.5) + (executabilityScore * 0.5);
  let finalScore = Math.round(futurePotentialScore);
  
  // Step 6: Frontier 安全鎖
  if (trackType === "FRONTIER" && runwayQuarters !== undefined && runwayQuarters !== null && runwayQuarters < 4) {
    finalScore = Math.min(finalScore, 70);
    capsApplied.push("FRONTIER_RUNWAY_LOW_CAP");
    Logger.log(`P2：${ticker} Future_Potential_Score 應用 Frontier 安全鎖（Runway < 4），cap 到 70`);
  }
  
  // ⭐ V8.17.1 新增：防泡沫硬規則（NARRATIVE_HEAVY）
  // inevitability_score >= 80 && executability_score <= 40 → 標 NARRATIVE_HEAVY
  if (inevitabilityScore >= 80 && executabilityScore <= 40) {
    futurePotentialAnalysis.future_potential_flags = futurePotentialAnalysis.future_potential_flags || [];
    futurePotentialAnalysis.future_potential_flags.push("NARRATIVE_HEAVY");
    Logger.log(`P2：${ticker} Future_Potential_Score 標記 NARRATIVE_HEAVY（必然性高但可實現性低）`);
    // 可選：直接 cap 分數（建議先不打，只標記，保留 option value）
    // finalScore = Math.min(finalScore, 60);
    // capsApplied.push("NARRATIVE_HEAVY_CAP");
  }
  
  if (validationErrors.length > 0) {
    Logger.log(`P2：${ticker} Future_Potential_Score 驗證警告: ${validationErrors.join("; ")}`);
  }
  if (capsApplied.length > 0) {
    Logger.log(`P2：${ticker} Future_Potential_Score 應用 Caps: ${capsApplied.join(", ")}`);
  }
  Logger.log(`P2：計算 ${ticker} Future_Potential_Score = ${finalScore} (Inevitability: ${inevitabilityScore}, Executability: ${executabilityScore}, Coverage: ${executabilityCoverage.toFixed(2)})`);
  
  return {
    score: finalScore,
    validation_errors: validationErrors,
    caps_applied: capsApplied
  };
}

/**
 * ⭐ V8.17 新增：構建 P2 System Blocks（可 cache 的內容）
 */
function buildP2SystemBlocks(context, params) {
  const frequency = params.frequency || "MONTHLY";
  const isQuarterly = frequency === "QUARTERLY";
  
  return [
    {
      type: "text",
      text: `你是 P2（基本面分析）專家。

## 核心職責

1. **財務安全性 Gate**：判斷公司是否「財務上撐得住」整個必然性兌現的時間窗（3-10 年）
2. **分層決策**：基於 P0.7 槓桿角色 + 財務安全性，將公司分配到四個層級（CORE/STABLE_SWING/AGGRESSIVE/OPPORTUNISTIC）

## 分析深度

本次分析為 ${isQuarterly ? "深入" : "標準"}分析（${frequency}）。

## 輸出格式要求

必須以 JSON 格式輸出，包含以下欄位：
- gate_results: { ticker: { gate_result, safety_grade, growth_analysis, future_potential_analysis } }
- tier_assignments: { ticker: { tier, reason } }
- financial_metrics: { ticker: { ... } }`,
      cache_control: { type: "ephemeral" }
    }
  ];
}

/**
 * ⭐ V8.17 新增：構建 P2 User Payload（動態內容）
 */
function buildP2UserPayloadForBatch(item, context, params, userInput) {
  const candidate = item.candidate;
  const ticker = item.ticker;
  const market = item.market;
  const companyFinancialData = item.financial_data;
  const companyP1FinancialReportData = item.p1_financial_report_data;
  
  // 構建單一公司的 Prompt
  const singleCompanyPrompt = buildP2Prompt(
    params.frequency,
    userInput,
    [candidate],  // 單一公司
    { [ticker]: companyFinancialData },  // 單一公司的財務數據
    { [`${ticker}_${market}`]: companyP1FinancialReportData },  // 單一公司的 P1 財報資料
    context.previous_snapshot
  );
  
  return singleCompanyPrompt;
}

/**
 * ⭐ V8.17 新增：處理 P2 Batch 結果
 */
function P2_ProcessBatchResults(batchId, params) {
  try {
    Logger.log(`P2：開始處理 Batch 結果：${batchId}`);
    
    // 使用通用 Batch 結果處理函數
    const processResult = (executorOutput, item, ctx) => {
      const ticker = item.ticker;
      const candidate = item.candidate;
      
      // 解析執行者輸出
      let p2Result = executorOutput;
      if (typeof p2Result === 'string') {
        try {
          let jsonString = p2Result.trim();
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          p2Result = JSON.parse(jsonString);
        } catch (e) {
          Logger.log(`P2：解析執行者輸出失敗（${ticker}）：${e.message}`);
          throw e;
        }
      }
      
      // 提取該公司的分析結果
      const gateResults = p2Result.gate_results || {};
      const tierAssignments = p2Result.tier_assignments || {};
      const financialMetrics = p2Result.financial_metrics || {};
      
      const tickerResult = {
        ticker: ticker,
        candidate: candidate,
        gate_result: gateResults[ticker] || {},
        tier_assignment: tierAssignments[ticker] || {},
        financial_metrics: financialMetrics[ticker] || {}
      };
      
      // ⭐ V8.17 新增：程式計算公式（AI 只輸出分項分數）
      const gateResult = tickerResult.gate_result || {};
      const growthAnalysis = gateResult.growth_analysis || {};
      const futurePotentialAnalysis = gateResult.future_potential_analysis || {};
      const financialMetric = tickerResult.financial_metrics || {};
      
      // 計算 Safety_Score（基於 Safety_Grade）
      const safetyGrade = gateResult.safety_grade || "";
      if (safetyGrade && !gateResult.safety_score) {
        // 根據 Safety_Grade 計算預設分數（可根據 evidence 調整）
        let safetyScore = null;
        if (safetyGrade === "S") {
          safetyScore = 85;  // 預設 85，可根據 evidence 調整到 80-100
        } else if (safetyGrade === "A") {
          safetyScore = 70;  // 預設 70，可根據 evidence 調整到 60-79
        } else if (safetyGrade === "B") {
          safetyScore = 50;  // 預設 50，可根據 evidence 調整到 40-59
        } else if (safetyGrade === "X") {
          safetyScore = 20;  // 預設 20，可根據 evidence 調整到 0-39
        }
        gateResult.safety_score = safetyScore;
        Logger.log(`P2：計算 ${ticker} Safety_Score = ${safetyScore} (基於 Safety_Grade: ${safetyGrade})`);
      }
      
      // 計算 Growth_Quality_Score
      if (growthAnalysis.growth_rate_score !== undefined &&
          growthAnalysis.growth_consistency_score !== undefined &&
          growthAnalysis.operating_leverage_score !== undefined &&
          growthAnalysis.cash_conversion_score !== undefined) {
        const growthQualityScore = 
          (growthAnalysis.growth_rate_score * 0.30) +
          (growthAnalysis.growth_consistency_score * 0.25) +
          (growthAnalysis.operating_leverage_score * 0.20) +
          (growthAnalysis.cash_conversion_score * 0.25);
        
        tickerResult.gate_result.growth_analysis.growth_quality_score = Math.round(growthQualityScore);
        Logger.log(`P2：計算 ${ticker} Growth_Quality_Score = ${Math.round(growthQualityScore)}`);
      }
      
      // 計算 Future_Potential_Score
      if (futurePotentialAnalysis.inevitability_score !== undefined &&
          futurePotentialAnalysis.executability_score !== undefined) {
        const futurePotentialScore = 
          (futurePotentialAnalysis.inevitability_score * 0.5) +
          (futurePotentialAnalysis.executability_score * 0.5);
        
        tickerResult.gate_result.future_potential_analysis.future_potential_score = Math.round(futurePotentialScore);
        Logger.log(`P2：計算 ${ticker} Future_Potential_Score = ${Math.round(futurePotentialScore)}`);
      }
      
      // 計算 FPE_A（如果提供了 Forward EPS 和當前股價）
      if (financialMetric.forward_eps !== undefined && financialMetric.forward_eps !== null &&
          financialMetric.current_price !== undefined && financialMetric.current_price !== null &&
          financialMetric.forward_eps > 0) {
        const fpeA = financialMetric.current_price / financialMetric.forward_eps;
        tickerResult.financial_metrics.fpe_a = fpeA;
        Logger.log(`P2：計算 ${ticker} FPE_A = ${fpeA.toFixed(2)} (Price: ${financialMetric.current_price}, Forward EPS: ${financialMetric.forward_eps})`);
      }
      
      return tickerResult;
    };
    
    // 從 Batch Job 中提取 items（需要從 context 或 Batch Job 記錄中獲取）
    const items = params.items || [];
    
    const results = processBatchJobResults(batchId, {
      project_id: params.project_id || "P2_MONTHLY",
      processResult: processResult,
      items: items,
      context: {
        previous_snapshot: params.previous_snapshot || getLatestP2Snapshot(),
        gate_thresholds: params.gate_thresholds || P2_CONFIG.gate_thresholds,
        tier_criteria: params.tier_criteria || P2_CONFIG.tier_criteria,
        ...params.context
      }
    });
    
    Logger.log(`P2：Batch 結果處理完成，成功：${results.succeeded}，失敗：${results.failed}`);
    
    // 合併所有結果
    const allGateResults = {};
    const allTierAssignments = {};
    const allFinancialMetrics = {};
    
    for (const result of results.results || []) {
      if (result && result.ticker) {
        allGateResults[result.ticker] = result.gate_result;
        allTierAssignments[result.ticker] = result.tier_assignment;
        allFinancialMetrics[result.ticker] = result.financial_metrics;
      }
    }
    
    // 構建完整的 P2 輸出
    const p2Output = {
      gate_results: allGateResults,
      tier_assignments: allTierAssignments,
      financial_metrics: allFinancialMetrics,
      batch_processing: true,
      batch_id: batchId
    };
    
    // 調用 P2_ProcessM0Result 進行後續處理（保存快照等）
    const jobId = `P2_BATCH_${batchId}`;
    const p2ProcessResult = P2_ProcessM0Result(jobId, {
      executor_output: p2Output,
      auditor_output: {},  // Batch 模式下審查者單獨處理
      master_candidates: items.map(item => item.candidate),
      financial_data: items.reduce((acc, item) => {
        acc[item.ticker] = item.financial_data;
        return acc;
      }, {}),
      frequency: params.frequency || "MONTHLY",
      trigger: params.trigger || "BATCH"
    });
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      snapshot_id: p2ProcessResult.snapshot_id,
      p2_result: p2ProcessResult,
      summary: {
        total: results.total_items,
        succeeded: results.succeeded,
        failed: results.failed
      }
    };
    
  } catch (error) {
    Logger.log(`P2 Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P2 M0 執行結果（由 M0 調用）
 * @param {string} jobId - 任務 ID
 * @param {Object} m0Result - M0 執行結果
 * @return {Object} P2 處理結果
 */
function P2_ProcessM0Result(jobId, m0Result) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P2 處理 M0 結果：jobId=${jobId}`);
    
    // ========================================
    // Step 1: 解析 M0 結果
    // ========================================
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    const masterCandidates = m0Result.master_candidates || [];
    const frequency = m0Result.frequency || "MONTHLY";
    
    // ========================================
    // ⭐ 機構級數據已移至 P2.5 模組，P2 專注於基本面分析
    
    // ========================================
    // Step 2: 提取同業公司清單（Stage 1 輸出）
    // ========================================
    
    const peerComparisonRequests = executorOutput.peer_comparison_requests || {};
    const financialMetrics = executorOutput.financial_metrics || {};
    
    // ========================================
    // Step 3: 收集同業財務數據並計算相對位置（Stage 2：程式執行）
    // ========================================
    
    Logger.log(`P2 開始 Stage 2：收集同業數據並計算相對位置`);
    
    const peerComparisonResults = {};
    
    for (const [ticker, peerRequest] of Object.entries(peerComparisonRequests)) {
      try {
        Logger.log(`P2 處理 ${ticker} 的同業比較：${peerRequest.peer_companies.length} 家同業`);
        
        // Step 3.1: 收集同業財務數據
        const peerFinancialData = collectPeerFinancialData(
          ticker,
          peerRequest.peer_companies,
          peerRequest.data_source,
          m0Result.financial_data || {}
        );
        
        // Step 3.2: 提取同業財務指標（從 Stage 1 的 AI 輸出中獲取）
        // ⚠️ 注意：如果 AI 在 Stage 1 已經提取了同業的財務指標，應該在 financial_metrics 中
        // 如果沒有，需要從 peerFinancialData 的 search_results 中提取（這部分可能需要額外處理）
        const targetFinancialData = financialMetrics[ticker] || {};
        
        // 嘗試從 financialMetrics 中獲取同業的財務指標
        const peerFinancialMetrics = {};
        for (const peerTicker of peerRequest.peer_companies) {
          if (financialMetrics[peerTicker]) {
            peerFinancialMetrics[peerTicker] = financialMetrics[peerTicker];
          }
        }
        
        // Step 3.3: 計算相對位置
        const relativePositions = calculateRelativePositions(
          ticker,
          targetFinancialData,
          peerFinancialMetrics,  // 使用已提取的財務指標
          peerFinancialData       // 備用：如果指標未提取，可以從 search_results 中解析
        );
        
        // Step 3.3: 判斷結構性優勢/弱勢
        const structuralAdvantage = judgeStructuralAdvantage(relativePositions);
        
        // Step 3.4: 判斷異質性風險
        const heterogeneityRisk = judgeHeterogeneityRisk(
          ticker,
          targetFinancialData,
          peerFinancialMetrics,  // 使用已提取的財務指標
          peerFinancialData       // 備用
        );
        
        peerComparisonResults[ticker] = {
          peer_companies: peerRequest.peer_companies,
          target_company_scale: peerRequest.target_company_scale,
          relative_positions: relativePositions,
          overall_position: calculateOverallPosition(relativePositions),
          structural_advantage: structuralAdvantage,
          heterogeneity_risk: heterogeneityRisk,
          data_source: peerRequest.data_source
        };
        
        Logger.log(`P2 ${ticker} 同業比較完成：整體位置=${peerComparisonResults[ticker].overall_position}`);
      } catch (error) {
        Logger.log(`P2 ${ticker} 同業比較失敗：${error.message}`);
        peerComparisonResults[ticker] = {
          error: error.message
        };
      }
    }
    
    // ========================================
    // Step 4: 生成 P2 輸出結構（包含同業比較結果）
    // ========================================
    
    const p2Output = generateP2Output(executorOutput, auditorOutput, frequency, peerComparisonResults);
    
    // ========================================
    // Step 4: 保存到 Phase2_Output 表格
    // ========================================
    
    const savedCount = saveToPhase2Output(p2Output.phase2_output);
    
    // ========================================
    // Step 5: 保存快照
    // ========================================
    
    const snapshot = saveP2Snapshot({
      job_id: jobId,
      trigger: m0Result.trigger || frequency,
      frequency: frequency,
      tier_assignments: p2Output.tier_assignments,
      tier_summary: p2Output.tier_summary,
      changes: compareWithPreviousSnapshotP2(p2Output),
      auto_trigger: checkAutoTriggerConditions(p2Output)
    });
    
    // ========================================
    // Step 6: 檢查是否需要觸發下游
    // ========================================
    
    if (snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P3
      triggerDownstreamPhasesP2("P2", snapshot);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P2 處理完成：snapshot_id=${snapshot.snapshot_id}, 耗時=${duration}ms`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      frequency: frequency,
      p2_output: p2Output,
      saved_count: savedCount,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P2 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 機構級視角整合
// ==========================================

// ⭐ 機構級數據分析已移至 P2.5 模組
// P2 專注於基本面分析（財務指標、Gate 檢查、分層決策）

// ==========================================
// P2 輸出生成
// ==========================================

/**
 * 生成 P2 輸出結構
 * @param {Object} fundamentalAnalysis - 基本面分析結果
 * @param {Object} auditorOutput - 審查者輸出
 * @param {string} frequency - 執行頻率
 * @param {Object} peerComparisonResults - 同業比較結果（Stage 2 計算）
 */
function generateP2Output(fundamentalAnalysis, auditorOutput, frequency, peerComparisonResults = {}) {
  const gateResults = fundamentalAnalysis.gate_results || {};
  const tierAssignments = fundamentalAnalysis.tier_assignments || {};
  const financialMetrics = fundamentalAnalysis.financial_metrics || {};
  
  // 整合同業比較結果到財務指標
  for (const [ticker, peerResult] of Object.entries(peerComparisonResults)) {
    if (financialMetrics[ticker]) {
      financialMetrics[ticker].peer_comparison = peerResult;
    }
  }
  
  // 生成 Phase2_Output 表格數據
  const phase2Output = [];
  
  for (const [ticker, gateResult] of Object.entries(gateResults)) {
    const tierAssignment = tierAssignments[ticker] || {};
    const financialMetric = financialMetrics[ticker] || {};
    
    // ⭐ V8.15 新增：從 gateResult 和 tierAssignment 中提取 V8.15 新欄位
    const growthAnalysis = gateResult.growth_analysis || {};
    const futurePotentialAnalysis = gateResult.future_potential_analysis || {};
    const frontierRisksJson = gateResult.frontier_risks_json || {};
    
    // ⭐ V8.17.1 新增：使用共用函數計算三軸評級分數
    
    // 計算 Safety_Score（使用共用函數）
    if (!gateResult.safety_score) {
      const safetyScore = computeSafetyScore(gateResult, financialMetric, ticker);
      if (safetyScore !== null) {
        gateResult.safety_score = safetyScore;
      }
    }
    
    // 計算 Growth_Quality_Score（使用共用函數）
    const growthQualityResult = computeGrowthQualityScore(growthAnalysis, ticker);
    if (growthQualityResult.score !== null) {
      growthAnalysis.growth_quality_score = growthQualityResult.score;
      if (growthQualityResult.validation_errors.length > 0) {
        growthAnalysis.validation_errors = growthQualityResult.validation_errors;
      }
    }
    
    // 計算 Future_Potential_Score（使用共用函數）
    const trackType = gateResult.track_type || "";
    const runwayQuarters = financialMetric.runway_quarters;
    const futurePotentialResult = computeFuturePotentialScore(
      futurePotentialAnalysis,
      financialMetric,
      trackType,
      runwayQuarters,
      ticker
    );
    if (futurePotentialResult.score !== null) {
      futurePotentialAnalysis.future_potential_score = futurePotentialResult.score;
      if (futurePotentialResult.validation_errors.length > 0) {
        futurePotentialAnalysis.validation_errors = futurePotentialResult.validation_errors;
      }
      if (futurePotentialResult.caps_applied.length > 0) {
        futurePotentialAnalysis.caps_applied = futurePotentialResult.caps_applied;
      }
    }
    
    // 計算 FPE_A（如果提供了 Forward EPS 和當前股價）
    if (financialMetric.forward_eps !== undefined && financialMetric.forward_eps !== null &&
        financialMetric.current_price !== undefined && financialMetric.current_price !== null &&
        financialMetric.forward_eps > 0) {
      const fpeA = financialMetric.current_price / financialMetric.forward_eps;
      financialMetric.fpe_a = fpeA;
      Logger.log(`P2：計算 ${ticker} FPE_A = ${fpeA.toFixed(2)} (Price: ${financialMetric.current_price}, Forward EPS: ${financialMetric.forward_eps})`);
    }
    
    phase2Output.push({
      // Phase 1 繼承（需要從 Master_Candidates 獲取）
      theme_track: gateResult.theme_track || "",
      theme_id: gateResult.theme_id || "",
      subtheme_id: gateResult.subtheme_id || "",
      primary_technology_or_node: gateResult.primary_technology_or_node || "",
      company_code: ticker,
      company_name: gateResult.company_name || "",
      market: gateResult.market || "",
      moat_type: gateResult.moat_type || "",
      rerate_state: gateResult.rerate_state || "",
      role_in_theme: gateResult.role_in_theme || "",
      p0_7_time_position: gateResult.p0_7_time_position || "",
      p0_7_leveraged_role_type: gateResult.p0_7_leveraged_role_type || "",
      phase1_version: gateResult.phase1_version || "V7.1",
      
      // Phase 2 核心輸出
      gate_result: gateResult.gate_result || "UNKNOWN",
      tier: tierAssignment.tier || "UNKNOWN",
      tier_reason: tierAssignment.reason || tierAssignment.tier_reason || "",
      
      // ⭐ V8.15 新增：三軸評級系統
      safety_grade: gateResult.safety_grade || "",
      safety_score: gateResult.safety_score || null,
      safety_evidence_json: JSON.stringify(gateResult.safety_evidence || []),
      growth_momentum_grade: growthAnalysis.growth_momentum_grade || "",
      growth_quality_score: growthAnalysis.growth_quality_score || null,
      growth_momentum_evidence_json: JSON.stringify(growthAnalysis.growth_momentum_evidence || []),
      future_breakout_grade: futurePotentialAnalysis.future_breakout_grade || "",
      future_potential_score: futurePotentialAnalysis.future_potential_score || null,
      future_breakout_evidence_json: JSON.stringify({
        inevitability_evidence: futurePotentialAnalysis.inevitability_evidence || [],
        executability_evidence: futurePotentialAnalysis.executability_evidence || []
      }),
      
      // ⭐ V8.15 新增：Position Role 和 Track Type
      position_role: gateResult.position_role || tierAssignment.position_role || "",
      position_role_reasoning: gateResult.position_role_reasoning || tierAssignment.position_role_reasoning || "",
      track_type: gateResult.track_type || tierAssignment.track_type || "",
      max_position_cap_suggestion: tierAssignment.max_position_cap_suggestion || null,
      
      // ⭐ V8.15 新增：驗證里程碑
      milestones_to_verify_json: JSON.stringify(futurePotentialAnalysis.milestones_to_verify || []),
      
      // ⭐ V8.15 新增：Frontier 特殊欄位
      runway_quarters: frontierRisksJson.runway_quarters || null,
      runway_calculation_json: JSON.stringify(frontierRisksJson.runway_calculation || {}),
      frontier_risks_json: JSON.stringify(frontierRisksJson || {}),
      frontier_conditions_json: JSON.stringify(gateResult.frontier_conditions || []),
      gate_result_for_frontier: gateResult.gate_result_for_frontier || null,
      
      // ⭐ V8.15 新增：Time Window Penalty
      time_window_penalty_json: JSON.stringify(futurePotentialAnalysis.time_window_penalty || {}),
      
      // ⭐ V8.15 新增：P1 財報段落對照
      narrative_consistency_check: gateResult.narrative_consistency_check || "",
      narrative_consistency_evidence_json: JSON.stringify(gateResult.narrative_consistency_evidence || []),
      
      // 財務指標
      revenue_yoy: financialMetric.revenue_yoy || null,
      gross_margin: financialMetric.gross_margin || null,
      operating_margin: financialMetric.operating_margin || null,
      net_margin: financialMetric.net_margin || null,
      cfo: financialMetric.cfo || null,
      fcf: financialMetric.fcf || null,
      net_debt_ebitda: financialMetric.net_debt_ebitda || null,
      roic: financialMetric.roic || null,
      current_ratio: financialMetric.current_ratio || null,
      
      // 同業比較（Stage 2 計算結果，優先使用程式計算的結果）
      peer_comparison: peerComparisonResults[ticker] || financialMetric.peer_comparison || null,
      
      // 其他
      fpe_a: financialMetric.fpe_a || null,
      fpe_b: financialMetric.fpe_b || null,
      phase2_version: "V8.15",  // ⭐ V8.15 更新版本號
      last_updated: new Date(),
      notes: gateResult.notes || ""
    });
  }
  
  // 生成 Tier 摘要
  const tierSummary = generateTierSummary(tierAssignments);
  
  return {
    gate_results: gateResults,
    tier_assignments: tierAssignments,
    tier_summary: tierSummary,
    financial_metrics: financialMetrics,
    phase2_output: phase2Output,
    auditor_review: auditorOutput.audit_review || null,
    confidence_level: auditorOutput.confidence || 0.7,
    frequency: frequency,
    timestamp: new Date().toISOString()
  };
}

/**
 * 生成 Tier 摘要
 */
function generateTierSummary(tierAssignments) {
  const summary = {
    CORE: [],
    STABLE_SWING: [],
    AGGRESSIVE: [],
    OPPORTUNISTIC: []
  };
  
  for (const [ticker, assignment] of Object.entries(tierAssignments)) {
    const tier = assignment.tier || "UNKNOWN";
    if (summary[tier]) {
      summary[tier].push(ticker);
    }
  }
  
  return {
    CORE: { count: summary.CORE.length, tickers: summary.CORE },
    STABLE_SWING: { count: summary.STABLE_SWING.length, tickers: summary.STABLE_SWING },
    AGGRESSIVE: { count: summary.AGGRESSIVE.length, tickers: summary.AGGRESSIVE },
    OPPORTUNISTIC: { count: summary.OPPORTUNISTIC.length, tickers: summary.OPPORTUNISTIC }
  };
}

// ==========================================
// 保存到表格
// ==========================================

/**
 * 保存到 Phase2_Output 表格
 */
function saveToPhase2Output(phase2Output) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Phase2_Output");
  
  if (!sheet) {
    sheet = ss.insertSheet("Phase2_Output");
    sheet.appendRow(PHASE2_OUTPUT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  let savedCount = 0;
  const headers = PHASE2_OUTPUT_SCHEMA.headers;
  const now = new Date();
  
  for (const output of phase2Output) {
    try {
      // 檢查是否已存在（根據 Company_Code）
      const existingRow = findExistingRowPhase2(sheet, output.company_code);
      
      if (existingRow > 0) {
        // 更新現有記錄
        updatePhase2OutputRow(sheet, existingRow, output, headers, now);
      } else {
        // 新增記錄
        appendPhase2OutputRow(sheet, output, headers, now);
        savedCount++;
      }
    } catch (error) {
      Logger.log(`保存 Phase2_Output 失敗：${error.message}`);
    }
  }
  
  Logger.log(`P2 Phase2_Output 已保存 ${savedCount} 筆新記錄`);
  return savedCount;
}

/**
 * 查找現有行（根據 Company_Code）
 */
function findExistingRowPhase2(sheet, companyCode) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const companyCodeCol = headers.indexOf("Company_Code");
  if (companyCodeCol === -1) {
    return -1;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][companyCodeCol] === companyCode) {
      return i + 1;  // 返回行號（1-based）
    }
  }
  
  return -1;
}

/**
 * 新增 Phase2_Output 行
 */
function appendPhase2OutputRow(sheet, output, headers, now) {
  const row = [];
  
  for (const header of headers) {
    const key = header.toLowerCase().replace(/_/g, "_");
    if (header === "Last_Updated") {
      row.push(now);
    } else {
      row.push(output[key] || output[header] || "");
    }
  }
  
  sheet.appendRow(row);
}

/**
 * 更新 Phase2_Output 行
 */
function updatePhase2OutputRow(sheet, rowNum, output, headers, now) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const key = header.toLowerCase().replace(/_/g, "_");
    
    if (header === "Last_Updated") {
      sheet.getRange(rowNum, i + 1).setValue(now);
    } else if (header !== "Theme_Track" && header !== "Theme_ID" && 
               header !== "Company_Code" && header !== "Company_Name") {
      // 不更新 Phase 1 繼承的欄位（只讀）
      const value = output[key] || output[header] || "";
      sheet.getRange(rowNum, i + 1).setValue(value);
    }
  }
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建 P2 基本面分析 Prompt
 */
/**
 * ⭐ V8.0 新增：構建 P2 批次處理 Prompt
 * @param {string} frequency - 執行頻率
 * @param {Object} userInput - 用戶輸入
 * @param {Array} batchCandidates - 批次候選公司列表（6 家）
 * @param {Object} batchFinancialData - 批次財務數據
 * @param {Object} previousSnapshot - 上次快照
 * @param {number} batchNumber - 批次編號
 * @param {number} totalBatches - 總批數
 * @returns {string} 批次 Prompt
 */
function buildP2BatchPrompt(frequency, userInput, batchCandidates, batchFinancialData, previousSnapshot, batchNumber, totalBatches) {
  const isQuarterly = frequency === "QUARTERLY";
  const analysisDepth = isQuarterly ? "深入" : "標準";
  
  const batchHeader = "**⭐ V8.0 批次處理說明（重要）**\n\n" +
    "本次分析為**批次處理模式**，批次 " + batchNumber + "/" + totalBatches + "。\n\n" +
    "**批次隔離規則**：\n" +
    "- 使用 `<<<COMPANY: TICKER>>>` 分隔符分隔每家公司\n" +
    "- 每家公司必須獨立分析，不得混線或交叉污染\n" +
    "- 輸出時必須為每家公司分別輸出結果，不得合併或簡化\n" +
    "- 必須確保每家公司分析的完整性和獨立性\n\n" +
    "---\n\n";
  
  const replacementText = "## Master_Candidates 列表（批次 " + batchNumber + "/" + totalBatches + "）\n\n" +
    "**重要**：這是批次處理模式，請使用 `<<<COMPANY: TICKER>>>` 分隔符分隔每家公司，確保獨立分析。\n\n";
  
  return batchHeader + buildP2Prompt(frequency, userInput, batchCandidates, batchFinancialData, previousSnapshot).replace(
    /## Master_Candidates 列表/,
    replacementText
  );
}

/**
 * 構建 P2 基本面分析 Prompt（單批次或非批次模式）
 */
function buildP2Prompt(frequency, userInput, masterCandidates, financialData, p1FinancialReportData = {}, previousSnapshot) {
  const isQuarterly = frequency === "QUARTERLY";
  const analysisDepth = isQuarterly ? "深入" : "標準";
  
  return `
你是一位資深的財務分析師，負責進行 Nuclear Project 的 Phase 2 分析。

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## ⭐⭐⭐ P2-0 Phase 2 定位（雙重職責）

**Phase 2 的角色（雙重職責）：**

1️⃣ **財務安全性 Gate（舊版保留）**
   判斷這家公司是否「財務上撐得住」整個必然性兌現的時間窗（3-10 年）
   
2️⃣ **分層決策（V6.2 新增）**⭐⭐⭐⭐⭐
   基於 P0.7 槓桿角色 + 財務安全性，將公司分配到四個層級：
   - **CORE（S Pool）**：核心槓桿點，最高配置
   - **STABLE_SWING（A Pool）**：穩健波段，次高配置
   - **AGGRESSIVE（B Pool）**：積極波段，中等配置
   - **OPPORTUNISTIC（C Pool）**：機會主義，最低配置

**Phase 2 回答三個核心問題（寫死）：**
✅ 這家公司，能不能活著等到世界真的非它不可？（財務安全性）
✅ 這家公司的成長是「吹泡泡」還是「真的有必然性」？（成長性與未來成長潛力）
✅ 這家公司，應該放在哪一層？（S/A/B/C）

## 分析深度

本次分析為 **${analysisDepth}分析**（${frequency}）。

${isQuarterly ? `
季度分析要求：
- 更深入的財務指標分析
- 更詳細的同業比較
- 更全面的風險評估
` : `
月度分析要求：
- 標準的財務指標分析
- 基本的同業比較
- 重點關注變化趨勢
`}

---

## ⭐⭐⭐ P2-1 明確禁止事項（寫死）

**⚠️ 重要：以下事項明確禁止，必須嚴格遵守。**

### 禁止事項

❌ **不選股**：Phase 2 不負責選股，只負責判斷財務安全性和分層決策

❌ **不預測成長率**：Phase 2 不預測具體的成長率數字，但必須分析成長的必然性和可實現性

❌ **不推估股價**：Phase 2 不推估股價，只判斷財務安全性

❌ **不做技術分析**：Phase 2 不做技術分析，技術分析由 Phase 3 負責

❌ **不因市場情緒改 Gate**：Gate 檢查必須基於財務數據和同業比較，不能因市場情緒改變

### 嚴禁回寫或重判以下任何封存欄位（寫死）

**⚠️ 重要：以下欄位由前段 Phase 封存，Phase 2 嚴禁回寫或重判：**

- ❌ **Theme / Subtheme**（由 P0 封存）
- ❌ **Moat_Type（M1-M6）**（由 P1 封存）
- ❌ **Rerate_State（R0-R3）**（由 P1 封存）
- ❌ **三池歸屬（Master / Tracking / Rejection）**（由 P1 封存）
- ❌ **P0.7_Time_Position**（由 P0.7 封存）
- ❌ **P0.7_Leveraged_Role_Type**（由 P0.7 封存）

**Phase 2 只能：**
- ✅ 讀取這些封存欄位
- ✅ 基於這些封存欄位進行財務安全性 Gate 檢查和分層決策
- ❌ **不能修改、重判或回寫這些欄位**

---

## Master_Candidates 列表

**⭐ 批次處理格式要求**：如果有多家公司，請使用以下格式分隔：

\`\`\`
<<<COMPANY: TICKER1>>>
[公司 1 的完整數據和分析]

<<<COMPANY: TICKER2>>>
[公司 2 的完整數據和分析]

...（依此類推）
\`\`\`

${JSON.stringify(masterCandidates, null, 2)}

## 外部財務數據（已收集）⭐ **所有數據都由程式從白名單數據源獲取**

**所有數據類的資料一律不由 AI 模型自己搜尋，全部由程式從白名單數據源獲取**

以下財務數據已由程式從外部權威數據源（白名單）收集，請直接使用這些數據，不要重新計算，也不要讓 AI 自己去找數據：

**數據來源**：
- ⭐⭐⭐ **V8.0 SSOT 定案：統一數據源設計**
- ✅ **美股和台股**：P2_US_TAIWAN CSE（財報狗網站）- 統一數據源防止計算偏移
- ✅ **日股**：P2_JAPAN CSE（buffet code 網站）- 統一數據源防止計算偏移

**重要**：
- ❌ **禁止讓 AI 模型自己去找數據**
- ✅ **所有數據都由程式從白名單數據源獲取**
- ✅ **直接使用已提供的財務數據，不要重新計算**
- ⭐⭐⭐ **統一數據源設計**：持股清單與同業財報數據來自同一網站，確保計算基準一致

${JSON.stringify(financialData, null, 2)}

## ⭐⭐⭐ V8.14 新增：P1 提取的財報資料（輔助對照）⭐⭐⭐

**重要**：以下資料是 P1 階段由 Gemini Flash 3.0 從各公司最新三季財報中提取的原文段落，已按 P1/P2/P3 分類。你必須使用這些資料作為輔助對照，驗證外部財務數據的準確性，並深入分析成長性與未來成長潛力。

**使用方式**：
1. **對照驗證**：將外部財務數據與財報原文對照，確保數據一致性
2. **成長性分析**：從財報原文中提取成長相關的證據（營收成長、訂單能見度、產能擴張等）
3. **未來成長潛力分析**：從財報原文中提取管理層指引、未來規劃、結構性支撐等證據

**資料結構**：
- **P2_Financial_Evidence**：包含 Profitability、Growth、Balance Sheet、Cash Flow、Guidance、Risk Factors 等段落
- 每段都包含：原文內容、頁數、財報年份/季度、上下文

${Object.keys(p1FinancialReportData).length > 0 ? 
  Object.entries(p1FinancialReportData).map(([key, data]) => {
    const [ticker, market] = key.split('_');
    return `### **${ticker} (${market})**

**P2_Financial_Evidence**（財務證據，用於成長性與未來成長潛力分析）：
${JSON.stringify(data.p2_financial_evidence || [], null, 2)}
`;
  }).join('\n\n') : 
  '**注意**：部分公司可能尚未完成財報提取，請根據可用的資料進行分析。'}

---

## ⭐⭐⭐⭐⭐ 核心原則：同業比較與相對位置 ⭐⭐⭐⭐⭐

**重要：P2 的重點不是指標的絕對數值，而是跟同業比較**

### 為什麼同業比較比絕對數值重要？

每個產業、每個板塊都有自己獨特的毛利率、成本結構、週期性特徵等。**絕對數值（例如 ROE ≥ 15%、FCF margin ≥ 15%）不能正確反映公司在該產業中的競爭力。**

**P2 的核心任務**：
1. ✅ **判斷公司在同業中的相對位置**（前段、中段、還是後段？）
2. ✅ **判斷在同一板塊裡，它是結構性優勢者，還是結構性弱者？**
3. ✅ **判斷財務特徵是否「不像這個板塊的正常公司」？**

### 同業比較要求

**必須執行以下步驟**：
1. **找出同業或同板塊公司**（3-5 家）
   - ✅ **同業數據也必須從同一個白名單來源抓取**（確保比較基準一致，偏移可以被抵消）
   - ⭐⭐⭐ **V8.0 SSOT 定案**：使用與目標公司相同的數據來源
     - 美股和台股：P2_US_TAIWAN CSE（財報狗）
     - 日股：P2_JAPAN CSE（buffet code）
   
2. **計算相對位置**：
   - ✅ 對於每個財務指標，計算目標公司在同業中的排名
   - ✅ 判斷是**前段（Top 25%）**、**中段（25%-75%）**、還是**後段（Bottom 25%）**
   
3. **結構性優勢判斷**：
   - ✅ **結構性優勢者**：多數指標在前段，具有持續競爭優勢
   - ✅ **結構性弱者**：多數指標在後段，缺乏競爭優勢
   - ✅ **異質性判斷**：財務特徵是否「不像這個板塊的正常公司」？（例如：毛利率異常高/低、週期性異常、現金流結構異常等）

4. **Gate 檢查標準調整**：
   - ⚠️ **Gate 檢查不應只看絕對數值**
   - ✅ **Gate 檢查應基於同業比較結果**：
     - 如果目標公司多數指標在**前段**，且無重大異質性風險 → **PASS**
     - 如果目標公司多數指標在**中段**，但核心指標（現金流、債務）良好 → **PARTIAL**
     - 如果目標公司多數指標在**後段**，或存在重大異質性風險 → **FAIL**

---

## ⭐ V8.17.1 新增：三軸獨立評估約束（輸出約束）

**⚠️ 重要：Safety、Growth Quality、Future Potential 必須獨立評估。**

**核心原則**：
- ✅ **Safety_Score、Growth_Quality_Score、Future_Potential_Score 必須分別獨立計算**
- ✅ **不要用一維的強項補償另一維的弱項**
- ❌ **禁止因為 Safety 高就自動提升 Growth Quality 或 Future Potential**
- ❌ **禁止因為 Future Potential 高就自動放寬 Safety 標準**
- ❌ **禁止將三個維度混成一句敘事**

**輸出要求**：
- 每個維度必須有獨立的證據和理由
- 每個維度的評分必須基於該維度專屬的指標和證據
- 如果某個維度證據不足，明確標註「證據不足」，不要用其他維度補償

---

## ⭐⭐⭐ P2-4 核心安全性模組（寫死）

**⚠️ 重要：必須按照以下三層結構分析財務指標，不得跳步。**

### 🔴 第一層｜盈利品質

**必須分析以下指標：**
- **單季毛利率**：單季毛利率（Gross Margin）
- **單季營業利益率**：單季營業利益率（Operating Margin）
- **單季淨利率**：單季淨利率（Net Margin）
- **單季 EPS（GAAP）**：單季每股盈餘（必須是 GAAP，不是 Non-GAAP）
- **營收成長（YoY / QoQ）**：營收年增率（YoY）和季增率（QoQ）

**輸出要求**：必須提取並分析以上指標，判斷盈利品質是否穩定且成長。

### 🔴 第二層｜現金流與抗壓性（最高權重）

**⚠️ 重要：這是最高權重的層級，必須重點分析。**

**必須分析以下指標：**
- **CFO**：營運現金流（Cash Flow from Operations）
- **FCF（穩定度）**：自由現金流（Free Cash Flow），並評估其穩定度
- **CAPEX / Revenue**：資本支出佔營收比例
- **Net Debt / EBITDA**：淨債務除以 EBITDA

**輸出要求**：必須重點分析現金流健康度和抗壓性，這是 Gate 檢查的核心指標。

### 🔴 第三層｜資本效率

**必須分析以下指標：**
- **ROIC**：投入資本回報率（Return on Invested Capital）
- **存貨週轉天數**：存貨週轉天數（Inventory Turnover Days）
- **流動比率**：流動比率（Current Ratio）

**輸出要求**：必須分析資本效率，判斷公司是否有效運用資本。

### 🟡 輔助層（不可單獨否決）

**以下指標可以作為輔助參考，但不可單獨否決：**
- **ROE / ROA**：股東權益報酬率 / 資產報酬率
- **EBITDA Margin**：EBITDA 利潤率
- **Interest Coverage**：利息覆蓋率
- **Cash / ST Investments**：現金及短期投資
- **Total Debt**：總債務

**輸出要求**：這些指標可以作為輔助參考，但不能單獨作為 Gate 否決的依據。

---

## ⭐⭐⭐ P2-4.5 成長性分析模組（Growth Quality）⭐⭐⭐ V8.15 完整架構

**⚠️ 重要：這是 P2 的核心任務之一，必須深入分析。**

**目標**：判斷「現在的成長是不是健康的、可延續的？」

**核心思想**：
- 不是單點數字（例如「營收 YoY 很高」）
- 而是成長品質（可持續性、可複製性、可擴張性）
- 必須可計算、可驗證（避免嘴炮）

### 🔴 分析維度（基於同業比較與相對位置，程式可算）

**必須分析以下維度，並與同業比較**：

1. **Growth Rate（成長率趨勢）**：
   - 營收/毛利/營業利益/自由現金流（TTM + 最近三季趨勢）
   - 與同業比較：成長速度是否優於同業？
   - 程式可算：同業百分位排名

2. **Growth Consistency（成長一致性）**：
   - 最近 8–12 季中，正成長季度比例
   - 或斜率穩定度（成長是否波動）
   - 程式可算：正成長季度數 / 總季度數

3. **Operating Leverage Proxy（營運槓桿代理）**：
   - 營收成長時，營業利益率是否同步改善
   - 用趨勢方向/相關性判斷（不用主觀判斷）
   - 程式可算：營收成長率與營業利益率變化的相關性

3.5. **營運槓桿拐點觀測（Operating Leverage Inflection Scan）⭐ V8.18 新增**：

**⚠️ 重要：這是觀測標籤，不是分數調整**

**核心原則**：
- 股價漲幅最兇猛的時刻，不是營收創新高，而是「利潤率（Margin）突然跳升」的時刻
- 這通常發生在：固定成本已經攤提完畢，但營收還在成長
- 這時候，每多賺 1 塊錢營收，可能有 0.8 塊變成淨利

**觀測任務**：
1. **檢查最近 2-4 季**：
   - ✅ **營收是否持續成長？**（必須是持續成長，不是單季）
   - ✅ **同時 R&D / SG&A / Opex Ratio 是否趨於持平或下降？**（費用率不再吃掉成長）

2. **若成立，標記為**：
   - \`OPERATING_LEVERAGE_INFLECTION = TRUE\`
   - 請說明：
     * 是因為固定成本攤提完成？
     * 還是因為短期砍費用？
   - ❌ **不允許直接上調 Safety 或 Growth 分數**（分數交給程式與 P5，AI 只負責識別「拐點是否出現」）

3. **輸出格式**：
   \\\`\\\`\\\`json
   "operating_leverage_inflection": {
     "present": true/false,  // 是否出現拐點
     "evidence": {
       "revenue_growth_trend": "最近 2-4 季營收成長趨勢（持續成長/波動/放緩）",
       "expense_ratio_trend": "R&D/SG&A/Opex Ratio 趨勢（持平/下降/上升）",
       "inflection_quarter": "拐點出現的季度（例如：2024Q3）",
       "reasoning": "拐點原因（固定成本攤提完成/短期砍費用/其他）"
     },
     "confidence": "HIGH | MEDIUM | LOW"  // 信心等級
   }
   \\\`\\\`\\\`

4. **重要原則**：
   - ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
   - ✅ **不要為了輸出而輸出，不要填補空白**
   - ❌ **禁止為了完整性而創造不存在的資訊**

4. **Cash Conversion（現金轉換率）**：
   - FCF / Net Income 或 CFO / Net Income
   - 避免「會計成長」但沒有現金
   - 程式可算：現金轉換率

5. **成長質量綜合判斷**：
   - AI 基於以上數據判斷：
     - 成長的**持續性**（持續成長/波動成長/放緩）
     - 成長的**質量**（健康成長/靠借債成長/靠稀釋股權成長）
     - 與同業比較：成長的**相對優勢**

**輸出要求**：
- ⭐ V8.17 修正：AI 只輸出分項分數，不計算公式
- 必須輸出以下分項分數（0-100）：
  - growth_rate_score: 成長率分數（基於同業百分位）
  - growth_consistency_score: 成長一致性分數（基於同業百分位）
  - operating_leverage_score: 營運槓桿分數（基於同業百分位）
  - cash_conversion_score: 現金轉換分數（基於同業百分位）
- ⚠️ **重要**：不要計算 Growth_Quality_Score，程式會根據以下公式自動計算：
  - Growth_Quality_Score = Growth_Rate_Score × 0.30 + Growth_Consistency_Score × 0.25 + Operating_Leverage_Score × 0.20 + Cash_Conversion_Score × 0.25
- 必須判斷 Growth_Momentum_Grade (S/A/B/X)（基於程式計算的 Growth_Quality_Score）：
  - S: Growth Quality Score ≥ 80 且 Growth Quality vs Peers = 前段
  - A: Growth Quality Score ≥ 60 且 Growth Quality vs Peers ≥ 中段
  - B: Growth Quality Score ≥ 40
  - X: Growth Quality Score < 40 或成長質量 = "靠借債成長/靠稀釋股權成長"
- 必須附上**最低必要證據**：每個維度的具體數值、vs_peers、source

---

## ⭐⭐⭐ P2-4.6 未來成長潛力分析模組（Future Potential / Optionality）⭐⭐⭐ V8.15 完整架構

**⚠️ 重要：這是 P2 的核心任務之一，必須深入分析。**

**目標**：判斷「未來飆升是『吹的泡泡』還是『高機率必然』？」

**核心思想**：
- 證據型前瞻（Evidence-backed forward view），不是預測股價
- 拆成兩個分數：必然性（Inevitability）+ 可實現性（Executability）
- 避免變成敘事嘴炮

### 🔴 必然性分析（Inevitability Score, 0-100）

**問題**：如果產業大趨勢成立，這家公司吃到紅利的「結構必然」有多高？

**證據來源（必須引用 P0/P0.5/P0.7/P1 結論，禁止自行想像）**：

1. **P0 必然性支撐**：
   - 該公司所處的產業是否在 P0 中被判定為「結構性必然」？
   - 必須引用 P0 的具體結論（例如：「AI 算力成長 → 能源需求在物理上不可避免」）

2. **P0.5 產業鏈位置**：
   - 該公司在產業鏈中的位置是否具有結構性優勢（瓶頸節點、定價權）？
   - 必須引用 P0.5 的具體結論（例如：「該公司位於產業鏈瓶頸節點 X」）

3. **P0.7 時間窗口**：
   - 當前時間位置是否有利於該公司的成長（Early/Mid/Late）？
   - 必須引用 P0.7 的具體結論（例如：「當前時間位置 = Early，有利於成長」）

4. **P1 Tier 分級**：
   - 該公司是否被 P1 判定為 Tier S/A（結構性受益者）？
   - 必須引用 P1 的具體結論（例如：「Tier S，結構性受益者」）

**AI 任務**：
- 基於以上證據判斷必然性（0-100）
- 必須附上證據來源（每個證據必須包含 source 和 evidence）
- **禁止自行想像或創造新證據**

### 🔴 可實現性分析（Executability Score, 0-100）

**問題**：它有沒有能力把故事做成現金流？（不是嘴巴講）

**證據來源（程式可算的 Proxy + P1 財報段落）**：

**⚠️ 重要：必須先判斷公司類型（硬體/製造 vs 軟體/平台/前沿），套用不同的模板**

**硬體/製造模板**：
- **R&D 強度（R&D / Revenue）**：同業百分位（代表「做得到的投入」）
- **Capex 強度（Capex / Revenue）**：與折舊、擴產節奏（用趨勢）
- **存貨週轉**：存貨週轉天數 vs 同業
- **合約負債**：合約負債趨勢（代表訂單能見度）

**軟體/平台/前沿模板**：
- **RPO / Remaining performance obligations**：或 backlog 的軟體版本（如果有就用）
- **Deferred revenue（遞延收入）**：遞延收入趨勢（如果有就用）
- **客戶數、ARPU、留存**：如果公開（如果有就用）
- **毛利率趨勢**：毛利率是否能在擴張中維持/提升（同業相對 + 趨勢）
- **S&M/R&D 的效率**：營收增長對應費用增長的斜率（例如：營收增長/費用增長斜率 = 1.5）

**指引與可驗證承諾**（從 P1 提取的財報 Business / Outlook 段落）：
- 抓「產品/量產/時程/客戶類型」句子（只存引用，不做結論）
- 必須附上頁數、財報年份/季度

**需求可見度 proxy**：
- Backlog / RPO（如果該產業常見且數據源抓得到就算；抓不到就留空，不硬做）

**⚠️ 重要：沒數據的處理方式**：
- 沒數據時不計入權重，權重重新分配（不要用平均分）
- 例如：如果 Backlog/RPO 沒數據，則 R&D 強度、Capex 強度、指引證據的權重會自動增加

**AI 任務**：
- 基於以上數據判斷可實現性（0-100）
- 必須附上證據指針（最多 5 條，可追溯到 P1 段落或數據表欄位）
- **禁止沒有證據就判斷**

### 🔴 Future_Potential_Score 計算

⭐ V8.17 修正：AI 只輸出分項分數，不計算公式

**AI 輸出要求**：
- 必須輸出以下分項分數（0-100）：
  - inevitability_score: 必然性分數（0-100）
  - executability_score: 可實現性分數（0-100）

⚠️ **重要**：不要計算 Future_Potential_Score，程式會根據以下公式自動計算：
Future_Potential_Score = 0.5 × Inevitability_Score + 0.5 × Executability_Score

### 🔴 Time Window Penalty（P0.7 窗口懲罰）

**⚠️ 重要：P0.7 不是只是分數的一部分，它應該能對「追高風險」直接施壓。**

**Capping 規則**：
- P0.7 Time Position = Late → Future Breakout Grade 最高為 A（不允許 S）
- P0.7 Turning Point Risk = HIGH → Future Breakout Grade 最高為 A
- P0.7 Time Position = Late 且 Turning Point Risk = HIGH → Future Breakout Grade 最高為 B

**這是輸出標記與分數 cap，不是交易決策。**

### 🔴 驗證里程碑（Milestones to Verify）

**⚠️ 重要：Future Breakout = S/S+ 時，強制輸出「驗證里程碑」（最多 5 個）**

**里程碑類型**：
1. **量產時程**：目標時程（例如：2025-Q3）、驗證來源（財報指引）、驗證方法（P5 Weekly 監控財報日曆）
2. **客戶類型**：目標（例如：Tier-1 Design win）、驗證來源（財報/新聞）、驗證方法（P5 Daily 新聞監控）
3. **指標**：目標（例如：RPO > 10B）、驗證來源（財報）、驗證方法（P2 季度更新時檢查）
4. **競品狀態**：目標（例如：替代技術未成熟）、驗證來源（P0.5 產業鏈分析）、驗證方法（P0.5 季度更新時檢查）
5. **P0.7 的窗口**：目標（例如：Early/Mid，不進入 Late）、驗證來源（P0.7 系統動力學）、驗證方法（P0.7 季度更新時檢查）

**每個里程碑必須包含**：
- milestone_id、milestone_type、target、verification_source、verification_method

### 🔴 Future Breakout Grade 判定

**必須對每家公司進行評級**：

**S（高爆發潛力）**：
- Future Potential Score ≥ 80
- 且 Inevitability ≥ 70
- 且 Executability ≥ 70
- 且 P0.7 Time Position ≠ Late（Time Window Penalty 檢查）
- **必須有 milestones_to_verify（最多 5 個）**

**A（中等爆發潛力）**：
- Future Potential Score ≥ 60
- 且 (Inevitability ≥ 60 或 Executability ≥ 60)
- 且 P0.7 Time Position ≠ Late（或 Turning Point Risk ≠ HIGH）

**B（低爆發潛力）**：
- Future Potential Score ≥ 40

**X（吹泡泡或無潛力）**：
- Future Potential Score < 40
- 或 Future Potential Grade = "BUBBLE_NARRATIVE"
- 或缺乏結構性支撐（與 P0/P0.5/P0.7/P1 結論不一致）

**⚠️ 重要**：
- 如果判定為「吹泡泡」，必須明確說明理由（缺乏結構性支撐、指引空泛、財務結構不足等）
- Future Breakout = S/S+ 時，必須強制輸出 milestones_to_verify

---

## ⭐⭐⭐ P2-5 安全性 Gate（三級制）+ V8.15 調整（Safety 硬門檴 + Growth/Future 決定上限）

**⚠️ 重要：Gate 檢查必須基於同業比較結果，而非絕對數值。**

**⭐ V8.15 核心原則**：
- **Safety 是硬門檴**：Safety_FAIL → 直接 FAIL（避免爆雷股）
- **Safety_PASS 之後，才看**：
  - Growth_Quality_Score（當下動能品質）
  - Future_Potential_Score（未來上限與必然性）
- **簡化決策**：
  - PASS：Safety 前段 +（Growth 或 Future 其中一個在前段）+ 無重大異質性風險
  - PARTIAL：Safety OK，但 Growth/Future 都中段或證據不足
  - FAIL：Safety 後段或異質性風險高

### Gate 檢查流程

1. **執行同業比較**（必須先執行，這是 Gate 檢查的基礎）
   - 找出 3-5 家同業公司（必須與目標公司屬於相同規模分類）
   - 從相同白名單數據源收集同業財務數據
   - 計算每個指標在同業中的相對位置（前段/中段/後段）

2. **相對位置評估**
   - 評估目標公司在各指標的相對位置（前段/中段/後段）
   - 評估是否為結構性優勢者或結構性弱者
   - 評估是否存在異質性風險

3. **Safety Grade 判定**（基於相對位置，而非絕對數值）
   - **S**: 多數指標在同業前段（Top 25%）且 CFO 必須為正
   - **A**: 多數指標在同業中段（25%-75%）且核心指標良好
   - **B**: 多數指標在中段或後段，但尚可維持營運
   - **X**: 多數指標在後段或存在重大異質性風險

4. **Track Type 判定**（在 Gate 判定前先判斷）
   - 如果公司規模 = "龍頭" 或 "中大型" → track_type = "CORE"
   - 如果公司規模 = "小型新創" 且 R&D_Intensity > 同業前段 且 Future_Potential_Score ≥ 70 且 Safety_PARTIAL 或以上 → track_type = "FRONTIER"
   - 否則 → track_type = "CORE"

5. **Gate 結果分類**（基於 Safety + Growth + Future，並考慮 Track Type）

### 🟢 通過（PASS）

**條件（必須全部滿足）：**
- ✅ **Safety Grade**: S/A（多數指標在同業前段或中段，且 CFO 必須為正）
- ✅ **Growth 或 Future 其中一個在前段**：
  - Growth Momentum Grade = S/A（Growth Quality Score ≥ 60 且 vs Peers ≥ 中段）
  - 或 Future Breakout Grade = S/A（Future Potential Score ≥ 60）
- ✅ **無重大異質性風險**：財務特徵符合該板塊的正常公司特徵

**結果**：→ 進 Phase 3

### 🟡 警戒（PARTIAL）

**條件（以下任一成立）：**
- ⚠️ **Safety OK，但 Growth/Future 都中段或證據不足**：
  - Safety Grade = A/B
  - 但 Growth Momentum Grade = B 且 Future Breakout Grade = B
  - 或證據不足（無法判斷）
- ⚠️ **盈利波動但可承受**：盈利品質指標在同業中表現中等（中段），但波動在可承受範圍內
- ⚠️ **現金流尚可**：CFO 和 FCF 在同業中表現中等（中段），但尚可維持營運

**結果**：→ 進 Phase 3（後段控倉）

### 🔴 不通過（FAIL）

**條件（以下任一成立）：**
- ❌ **Safety Grade = X**：多數指標在同業後段或存在重大異質性風險
- ❌ **虧損且無轉機跡象**：持續虧損，且無明確轉機跡象
- ❌ **現金流惡化**：CFO 或 FCF 持續惡化，且在同業中表現極差（後段）
- ❌ **債務壓力大**：Net Debt/EBITDA 在同業中表現極差（後段），債務壓力大
- ❌ **是結構性弱者**：在同業中屬於結構性弱者

**結果**：
- 如果 track_type = "CORE" → 停止於 Phase 2（直接 FAIL）
- 如果 track_type = "FRONTIER" → 改為 OPTIONALITY_ONLY（見下方 Frontier 特殊處理）

### ⭐ V8.15 新增：Frontier 特殊處理（Track B）

**⚠️ 重要：Safety Gate FAIL 不應終止 Frontier（OPTIONALITY），改為自動標記 OPTIONALITY_ONLY**

**Frontier Gate 判定邏輯**：
- 如果 track_type = "FRONTIER"：
  - Safety Grade = X 且 Runway < 4 季 → FAIL（Runway 不足，硬門檴）
  - Safety Grade = X 且 Execution Risk = HIGH → FAIL（Execution Risk 太高）
  - Safety Grade = X 且 Future Breakout Grade < S → PARTIAL（Future Potential 不夠高）
  - Safety Grade = X 且 Runway ≥ 4 季 且 Future Breakout Grade = S → OPTIONALITY_ONLY（允許進入，但標記為 OPTIONALITY_ONLY）

**Frontier 輸出**：
- gate_result_for_frontier = "OPTIONALITY_ONLY"（當 Safety = X 但符合 Frontier 條件時）
- max_position_cap_suggestion = 0.03（建議單檔上限 3%，比 CORE 的 15% 低很多）
- frontier_conditions = ["必須看到 P3 主力行為才允許加碼", "必須看到機構籌碼轉強才允許重倉", "必須看到驗證里程碑達成才允許擴大倉位"]

### ⚠️ 絕對數值僅作為初步篩選參考

以下絕對數值可以作為初步篩選參考，但**不是最終 Gate 判斷標準**（最終判斷必須基於同業比較）：

1. **營收年增率（Revenue YoY）**：參考 ≥ 5%（但需與同業比較）
2. **毛利率（Gross Margin）**：參考 ≥ 20%（但需與同業比較，不同產業差異很大）
3. **營業利益率（Operating Margin）**：參考 ≥ 10%（但需與同業比較）
4. **淨利率（Net Margin）**：參考 ≥ 5%（但需與同業比較）
5. **營運現金流（CFO）**：必須為正
6. **自由現金流（FCF）**：必須為正（成長股可放寬）
7. **Net Debt/EBITDA**：參考 ≤ 3.0（但需與同業比較）
8. **ROIC**：參考 ≥ 10%（但需與同業比較）
9. **流動比率（Current Ratio）**：參考 ≥ 1.0（但需與同業比較）

---

## ⭐⭐⭐ P2-6 分層決策標準（基於三軸評級 + Position Role + Track Type）⭐⭐⭐ V8.15 完整架構

**⚠️ 重要：分層決策必須基於 P0.7 槓桿角色 + Safety + Growth Momentum + Future Breakout + Track Type，不能只看財務指標。**

**⭐ V8.15 新增：交互矩陣（6類公司分類）**

## ⭐ V8.27 新增：基於 P0 必然性等級設定 Position_Role

**⚠️ 重要：Position_Role 必須考慮 P0 必然性等級**

**映射邏輯**：

1. **如果 P0 conviction_level = ULTRA_HIGH**：
   - 且 P2 Safety >= A 且 Growth_Quality_Score >= 70
   - → Position_Role = MOMENTUM_COMPOUNDER（核心倉）
   - → reasoning: "P0 必然性極強 + P2 基本面優秀 → 核心倉"

2. **如果 P0 conviction_level = HIGH**：
   - 且 P2 Safety >= B
   - → Position_Role = MOMENTUM_COMPOUNDER（核心倉）
   - → reasoning: "P0 必然性強 + P2 基本面健康 → 核心倉"

3. **如果 P0 conviction_level = MEDIUM**：
   - 且 P2 Growth_Quality_Score >= 80
   - → Position_Role = EARLY_DIAMOND（激進倉）
   - → reasoning: "P0 必然性中等 + P2 成長性極高 → 激進倉"

4. **其他情況**：
   - → Position_Role = FRONTIER_OPTIONALITY（機會倉）
   - → reasoning: "P0 必然性一般或 P2 基本面普通 → 機會倉"

**輸出要求**：
- 必須在 \`position_role_reasoning\` 中明確說明 P0 conviction_level 的影響

---

**A 類：動能成長股（MOMENTUM_COMPOUNDER）**
- Safety: S/A + Growth Momentum: S/A + Future Breakout: A/S
- Position Role: MOMENTUM
- Track Type: CORE
- Tier: CORE 或 STABLE_SWING
- 定位：短中期就會跑，市場已開始認，賺錢的主力引擎

**B 類：鑽石早期（EARLY_DIAMOND / UNDERFOLLOWED）**
- Safety: A/B + Growth Momentum: B + Future Breakout: S/A
- Position Role: DIAMOND
- Track Type: CORE
- Tier: CORE 或 AGGRESSIVE（取決於 P0.7 Time Position）
- 定位：市場還沒認，但「結構必然性」高，在市場發現前建底倉
- 必須有 milestones_to_verify

**C 類：前沿噴發倉（FRONTIER_OPTIONALITY / 10X_BETS）**
- Safety: X/B + Growth Momentum: X/B + Future Breakout: S
- Position Role: OPTIONALITY
- Track Type: FRONTIER
- Tier: AGGRESSIVE 或 OPPORTUNISTIC（取決於風險）
- 定位：追 5-10 倍的來源，但失敗率高
- 必須標記：OPTIONALITY_ONLY + max_position_cap_suggestion + milestones_to_verify + Runway ≥ 4 季

**D 類：成熟牛皮股（SAFE_BUT_STAGNANT / VALUE_TRAP）**
- Safety: S/A + Growth Momentum: B/X + Future Breakout: B/X
- Position Role: DEFENSIVE
- Track Type: CORE
- Tier: OPPORTUNISTIC 或降級
- 定位：不會死，但通常跑不動，不能佔用攻擊資本

**E 類：高風險動能（HOT_BUT_FRAGILE / HYPE_BUBBLE）**
- Safety: X/B + Growth Momentum: S/A + Future Breakout: X/B
- Position Role: REJECT 或標記風險
- Track Type: CORE
- Tier: 禁止進 CORE，需強制要求證據型催化或 P3 主力行為證明
- 定位：最容易變成追高踩雷

**F 類：淘汰/觀察（REJECT / WATCHLIST）**
- Growth Momentum: X 且 Future Breakout: X
- Position Role: REJECT
- 動作：不進入 Tier，標記為 WATCHLIST 或 REJECT
- 定位：故事股、純敘事、沒有實現性

### CORE（核心持倉｜S Pool）

**條件（必須全部滿足）：**
- ✅ **Gate 結果**：PASS
- ✅ **Safety Grade**: S/A
- ✅ **Growth Momentum**: S/A 或 Future Breakout: A/S（至少一個在前段）
- ✅ **P0.7 Leveraged_Role_Type**：屬於 P0.7 指定的槓桿點角色類型（平台核心層/合規入口層/設備承載層/流程OS/供給側約束）
- ✅ **Position Role**: MOMENTUM 或 DIAMOND
- ✅ **Track Type**: CORE
- ✅ **P0.7 Time_Position**：在當前 Time_Position 下，該角色是最優受益角色

**結果**：最高配置

### STABLE_SWING（穩健波段｜A Pool）

**條件（以下任一成立）：**
- ✅ **Gate 結果**：PASS
- ✅ **Safety Grade**: S/A
- ✅ **Growth Momentum**: A/B 或 Future Breakout: A（至少一個在中段以上）
- ✅ **P0.7 Leveraged_Role_Type**：屬於 P0.7 指定的槓桿點角色類型，但財務安全性略低於 CORE
- ✅ **Position Role**: MOMENTUM
- ✅ **Track Type**: CORE
- ✅ **P0.7 Time_Position**：在當前 Time_Position 下，該角色是受益角色，但非最優

**結果**：次高配置

### AGGRESSIVE（積極波段｜B Pool）

**條件（以下任一成立）：**
- ✅ **Gate 結果**：PASS 或 PARTIAL
- ✅ **Safety Grade**: B 或以上
- ✅ **Future Breakout**: S/A（但 Growth Momentum 可能 B）
- ✅ **或 Track Type**: FRONTIER 且 Future Breakout = S
- ✅ **Position Role**: DIAMOND 或 OPTIONALITY
- ✅ **P0.7 Leveraged_Role_Type**：不屬於 P0.7 指定的槓桿點角色類型，但屬於「最先承壓層」或「成熟收斂層」
- ✅ **P0.7 Time_Position**：在當前 Time_Position 下，該角色受益有限

**結果**：中等配置

### OPPORTUNISTIC（機會主義｜C Pool）

**條件（以下任一成立）：**
- ✅ **Gate 結果**：PASS 或 PARTIAL
- ✅ **Safety Grade**: B/X
- ✅ **Future Breakout**: B/X
- ✅ **或 Position Role**: DEFENSIVE（成熟牛皮股）
- ✅ **或 Position Role**: REJECT（故事股）
- ✅ **或 Track Type**: FRONTIER 但 Future Breakout < S 或 Execution Risk = HIGH
- ✅ **P0.7 Leveraged_Role_Type**：不屬於 P0.7 指定的槓桿點角色類型
- ✅ **P0.7 Time_Position**：在當前 Time_Position 下，該角色受益有限或存在時間錯位

**結果**：最低配置

**⚠️ 重要**：
- 如果 Position Role = REJECT，不進入任何 Tier，標記為 WATCHLIST
- 如果 Track Type = FRONTIER 且 gate_result_for_frontier = "OPTIONALITY_ONLY"，仍可進入 AGGRESSIVE 或 OPPORTUNISTIC，但必須附上 max_position_cap_suggestion 和 frontier_conditions

## 財務指標提取（從外部權威數據源）

**重要原則**：優先使用外部權威數據源的數據，不自己計算。

### 外部財務數據（已提供）

${JSON.stringify(financialData, null, 2)}

### 數據來源優先級

1. **美股和台股**（⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計）：
   - P2_US_TAIWAN CSE：財報狗網站
   - ⭐⭐⭐ **統一數據源設計**：防止財報計算方式偏移，持股清單與同業財報數據都要來自財報狗

2. **日股**（⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計）：
   - P2_JAPAN CSE：buffet code 網站
   - ⭐⭐⭐ **統一數據源設計**：防止財報計算方式偏移，持股清單與同業財報數據都要來自 buffet code

### 財務指標提取

針對**目標公司和同業公司**，從提供的財務數據中**提取**以下指標（不要計算）：

**重要**：你必須同時提取目標公司和同業公司的財務指標，因為 Stage 2 的程式計算需要這些指標值。

1. **Revenue_YoY**：營收年增率（%）- 從數據中提取
2. **Gross_Margin**：毛利率（%）- 從數據中提取
3. **Operating_Margin**：營業利益率（%）- 從數據中提取
4. **Net_Margin**：淨利率（%）- 從數據中提取
5. **CFO**：營運現金流（絕對值）- 從數據中提取
6. **FCF**：自由現金流（絕對值）- 從數據中提取
7. **Net_Debt_EBITDA**：Net Debt / EBITDA（倍數）- 從數據中提取
8. **ROIC**：投入資本回報率（%）- 從數據中提取
9. **Current_Ratio**：流動比率（倍數）- 從數據中提取

**注意**：
- 如果外部數據源有該指標，直接使用，不要重新計算
- 只有在外部數據源**完全沒有**該指標時，才考慮計算（但必須標註數據來源為"計算"）
- 優先使用最新季度的數據
- ⭐ **必須同時提取目標公司和同業公司的財務指標**，因為 Stage 2 的程式計算需要這些指標值

---

### ⭐ FPE_A 提取要求（重要）

**FPE_A（公司官方財報公布的 FPE）**必須從提供的財務數據中提取：

1. **提取來源**：
   - 美股/台股：從財報狗（P2_US_TAIWAN CSE）的搜尋結果中提取
   - 日股：從 buffet code（P2_JAPAN CSE）的搜尋結果中提取

2. **提取方式**：
   - 仔細檢查 financial_data[ticker].search_results 中的內容
   - 尋找財報狗/buffet code 搜尋結果中的 **Forward P/E**（不是 EPS）
   - 如果搜尋結果中明確包含 Forward P/E，直接提取
   - ⚠️ **重要**：FPE_A 是 Forward P/E，不是 EPS，不需要自己計算

3. **輸出要求**：
   - 如果成功提取，在 financial_metrics[ticker].fpe_a 中輸出數值
   - 如果無法提取，必須標註為 null
   - **不要憑空猜測或使用不確定的數據**

4. **重要**：
   - FPE_A 是安全性判斷的唯一依據
   - 必須確保數據來源可靠（來自財報狗/buffet code）
   - 如果無法獲取 FPE_A，Gate 檢查仍應繼續（基於其他財務指標）

---

## ⭐⭐⭐ P2-7 雙 FPE 制度（V6.0 原始設計）⭐⭐⭐

### FPE_A（基於公司財測/來期業績推導的 Forward P/E）

**定義**：用「公司財報指引中自己給的財測/來期業績」去推 forward EPS → forward P/E

**推導方式**：
FPE_A = 當前股價 / 公司財測/來期業績的 Forward EPS

**特性**：
- ✅ **偏公司端/可驗證**：來自公司官方財測/來期業績
- ⚠️ **在 P2 安全性分析中權重不高**：FPE 雖然僅是預測，在基本面安全性分析權重不高
- ⚠️ **FPE_A 公布時就已經股價反應，沒有未來增幅的效用**

**數據來源**：
- 美股和台股：從財報狗網站（P2_US_TAIWAN CSE）搜尋結果中提取「公司財測/來期業績」
- 日股：從 buffet code 網站（P2_JAPAN CSE）搜尋結果中提取「公司財測/來期業績」

**提取要求**：
- **必須從提供的財務數據（CSE 搜尋結果）中提取公司財測/來期業績**
- 仔細檢查 financial_data[ticker].search_results 中的內容
- 尋找財報狗/buffet code 搜尋結果中的「財測」、「來期業績」、「Forward EPS 預測」等資訊
- ⭐ V8.17 修正：AI 只提取以下數據，不進行計算：
  - forward_eps: 從財測/來期業績中提取的 Forward EPS（數值）
  - current_price: 當前股價（數值，如果數據中有）
- ⚠️ **重要**：不要計算 FPE_A，程式會根據以下公式自動計算：
  - FPE_A = Current_Price / Forward_EPS（如果兩者都有）
- 如果數據中沒有 Forward EPS 或當前股價，標註為 null
- **⚠️ 重要**：如果無法提取 FPE_A，Gate 檢查仍應繼續（基於其他財務指標），因為 FPE 在 P2 安全性分析中權重不高

**使用定位**：
- ⚠️ **FPE 在 P2 的安全性分析權重不高**
- ✅ **FPE 更像是 P3 的因子**：P3 判斷現在股價是否便宜/合理/昂貴的因子之一
- ✅ **數據繼承**：FPE A/B 都要繼承給 P3 作為綜合判斷調整 cat 使用
- ⚠️ **禁止使用 FPE 單一項來決定**：FPE A/B 僅是眾多決策因子的一環

---

### FPE_B（市場分析師共識的 Forward P/E）

**定義**：市場上分析師的大致共識（分析師預估的 Forward P/E）

**特性**：
- ⚠️ **不準確數據**：各分析師預期差異很大
- ⚠️ **偏向市場氣氛**：反映市場對該公司的普遍看法
- ⚠️ **來源無法驗證**：可能人為操縱
- ✅ **真正對股價有推動力**：後來不斷更新的 FPE_B 才是真正對股價有推動力的
- ⚠️ **外來資訊僅做為參考與輔助**：我們的系統才是真正能全方位算出最接近未來 FPE 的工具

**用途**：**判斷市場溫度計**
- 判斷市場對該公司是普遍樂觀/中性/悲觀
- **必須要跟同業的數據做比較**
- **判斷出是整個板塊市場情緒都是樂觀/中性/悲觀，還是只有該公司被市場特別的樂觀/中性/悲觀**

**使用方式**：
1. **與同業比較**：
   - 收集同業公司的 FPE_B 數據（如果可用）
   - 比較目標公司與同業的 FPE_B
   - 判斷是整個板塊的情緒，還是只有該公司被特別看待

2. **作為 FPE_A 的輔助/驗證資料**：
   - 比較 FPE_B 與 FPE_A 是否相符/背離
   - 如果 FPE_B 與 FPE_A 背離，需要分析原因
   - 輔助判斷 FPE_A 的合理性
   - **其結論作為 FPE_A 的輔助資料或驗證資料**（是否與公司官方相符/背離）使用

**數據來源**（可選方案，需評估）：
- **方案 1**：Yahoo Finance Analysis 頁面（爬蟲，非 CSE）
  - 優先：直接提取分析師共識的 Forward P/E（如果 Yahoo Finance 有提供）
  - 備用：如果只提供 EPS 預估，則計算 FPE_B = Current Price / Next Year Avg. Estimate EPS
  
- **方案 2**：財報狗網站（P2_US_TAIWAN CSE）
  - 財報狗的 Forward P/E 實際上是分析師預估（FPE_B）
  - 可以作為 FPE_B 的數據來源之一
  - ⚠️ 需要與 Yahoo Finance 比較哪個更合適

**提取要求**：
- 如果無法獲取，標註為 null
- **不應影響 Gate 檢查和分層決策**（FPE 在 P2 安全性分析中權重不高）
- FPE_B 僅作為輔助/驗證資料使用

**使用定位**：
- ⚠️ **FPE 在 P2 的安全性分析權重不高**
- ✅ **FPE 更像是 P3 的因子**：P3 判斷現在股價是否便宜/合理/昂貴的因子之一
- ✅ **數據繼承**：FPE A/B 都要繼承給 P3 作為綜合判斷調整 cat 使用
- ⚠️ **禁止使用 FPE 單一項來決定**：FPE A/B 僅是眾多決策因子的一環

**重要**：
- ✅ **FPE 在基本面安全性分析權重不高**
- ✅ **FPE 在股價漲幅潛力面卻是非常重要的因素**
- ✅ **FPE_B 真正對股價有推動力**（不斷更新），但外來資訊僅做為參考與輔助
- ✅ **我們的系統才是真正能全方位算出最接近未來 FPE 的工具**

## 同業比較 ⭐⭐⭐⭐⭐ **核心重點**

### ⚠️ 重要：同業比較是 P2 的核心任務，不是輔助功能

**每個公司都必須執行完整的同業比較分析，這是 Gate 檢查和分層決策的基礎。**

### ⭐⭐⭐⭐⭐ 同業定義與分類要求 ⭐⭐⭐⭐⭐

**重要：同業不是「同板塊」（板塊太大，不適合）**

#### 同業定義

**同業公司必須由 AI 模型交叉判定，基於以下標準**：
- ✅ **相同產業**：處於相同的細分產業（例如：半導體設備、雲端軟體、電動車電池等）
- ✅ **相似業務模式**：具有相似的業務模式和商業邏輯
- ✅ **相似市場定位**：面向相似的客戶群體和市場
- ⚠️ **不是「同板塊」**：板塊太大（例如：整個科技板塊），不適合作為比較基準

#### 同業分類要求 ⭐ **關鍵：必須分開比較**

**絕對不能拿產業龍頭跟新創公司比！必須按照公司規模分類比較：**

1. **龍頭公司（Market Leader）**：
   - 產業中市值最大、市占率最高的公司
   - 通常是產業的標竿企業
   - 例如：台積電（半導體代工）、蘋果（消費電子）

2. **中大型公司（Mid-to-Large Cap）**：
   - 市值和規模中等偏大的公司
   - 通常是產業中的主要參與者
   - 例如：聯發科（半導體設計）、微軟（軟體）

3. **小型新創公司（Small Cap / Startup）**：
   - 市值較小或新創公司
   - 通常是產業中的新進者或成長型公司
   - 例如：小型 AI 新創、早期階段的科技公司

**分類比較要求**：
- ✅ **目標公司是龍頭** → 與其他龍頭公司比較
- ✅ **目標公司是中大型** → 與其他中大型公司比較
- ✅ **目標公司是小型新創** → 與其他小型新創公司比較
- ❌ **禁止跨分類比較**（例如：龍頭 vs 小型新創）

**這需要強大的推理能力和邏輯判斷，必須精心設計 Prompt。**

### 同業比較執行流程（兩階段）

#### ⭐ Stage 1：AI 識別同業公司清單（本階段任務）

**你的任務**：
1. **識別目標公司的規模分類**：
   - 判斷目標公司是「龍頭」、「中大型」還是「小型新創」
   - 基於市值、市占率、產業地位等綜合判斷

2. **找出同業公司**（3-5 家，不需要太多）：
   - 找出與目標公司處於**相同細分產業**的公司（不是同板塊）
   - **必須與目標公司屬於相同規模分類**（龍頭 vs 龍頭、中大型 vs 中大型、小型新創 vs 小型新創）
   - 使用你的推理能力和邏輯判斷，交叉判定哪些公司是真正的同業

3. **輸出同業公司清單**：
   - 必須在輸出中明確列出同業公司清單
   - 必須標註每個同業公司的規模分類
   - 必須說明選擇這些同業公司的理由

**重要**：
- ✅ **同業數據將由程式從白名單數據源搜尋**（你不需要自己搜尋）
- ✅ **相對位置計算將由程式執行**（避免兩次 AI 模型無法承接上下文）
- ✅ **你只需要識別同業公司清單，並說明選擇理由**

#### Stage 2：程式收集數據並計算相對位置（後續由程式執行）

**程式將執行以下步驟**：
1. 根據你提供的同業公司清單，從相同白名單數據源收集同業財務數據
2. 計算目標公司在每個指標的相對位置（前段/中段/後段）
3. 判斷結構性優勢/弱勢
4. 判斷異質性風險

**你不需要執行 Stage 2，只需要完成 Stage 1（識別同業公司清單）。**

### ⚠️ 注意：相對位置計算將由程式執行

**為了避免兩次 AI 模型無法承接上下文的問題，相對位置計算將由程式執行。**

**你只需要完成 Stage 1（識別同業公司清單），不需要計算相對位置。**

---

## 輸出格式（必須是 JSON，符合 P2-10 Mandatory Schema）

**⚠️ 重要：輸出必須完全符合以下格式，欄位不可增刪。**

**⭐ 批次處理輸出要求**：
- 每家公司必須獨立輸出，使用 ticker 作為 key
- 必須使用 \`<<<COMPANY: TICKER>>>\` 分隔符在輸出中標記每家公司
- 不得混線或交叉污染不同公司的數據

{
  "gate_results": {
    "AAPL": {
      "ticker": "AAPL",
      "gate_result": "PASS/PARTIAL/FAIL",  // ⭐ V8.15 三級制（PASS/PARTIAL/FAIL，WATCH 改為 PARTIAL）
      "gate_details": {
        // P2-4 第一層｜盈利品質
        "revenue_yoy": 0.15,  // 營收年增率（YoY）
        "revenue_qoq": 0.05,  // 營收季增率（QoQ）
        "gross_margin": 0.38,  // 單季毛利率
        "operating_margin": 0.25,  // 單季營業利益率
        "net_margin": 0.20,  // 單季淨利率
        "eps_gaap": 1.25,  // 單季 EPS（GAAP）
        
        // P2-4 第二層｜現金流與抗壓性（最高權重）
        "cfo": 1000000000,  // 營運現金流（CFO）
        "fcf": 800000000,  // 自由現金流（FCF）
        "fcf_stability": "STABLE/VOLATILE",  // FCF 穩定度
        "capex_revenue": 0.15,  // CAPEX / Revenue
        "net_debt_ebitda": 0.5,  // Net Debt / EBITDA
        
        // P2-4 第三層｜資本效率
        "roic": 0.25,  // ROIC
        "inventory_turnover_days": 45,  // 存貨週轉天數
        "current_ratio": 1.5,  // 流動比率
        
        // P2-4 輔助層（不可單獨否決）
        "roe": 0.30,  // ROE
        "roa": 0.15,  // ROA
        "ebitda_margin": 0.28,  // EBITDA Margin
        "interest_coverage": 12.5,  // Interest Coverage
        "cash_st_investments": 500000000,  // Cash / ST Investments
        "total_debt": 100000000  // Total Debt
      },
      "gate_reasoning": "Gate 檢查的詳細理由（必須基於同業比較結果）",
      "peer_comparison_based": true,  // 是否基於同業比較
      "safety_grade": "S/A/B/X",  // ⭐ V8.15 新增：Safety Grade
      "safety_score": 0-100,  // ⭐ V8.15 新增：Safety Score（程式計算）
      "safety_evidence": [  // ⭐ V8.15 新增：最低必要證據
        {"indicator": "CFO", "value": 1000000000, "vs_peers": "前段", "source": "財報狗"},
        {"indicator": "FCF", "value": 800000000, "vs_peers": "前段", "source": "財報狗"}
      ],
      "growth_analysis": {  // ⭐ V8.15 重構：成長性分析
        "growth_quality_score": 0-100,  // 程式計算（基於同業百分位）
        "growth_momentum_grade": "S/A/B/X",  // ⭐ V8.15 新增
        "growth_quality_vs_peers": "前段/中段/後段",  // 程式計算
        "growth_trend": "持續成長/波動成長/放緩",
        "growth_quality": "健康成長/靠借債成長/靠稀釋股權成長",
        "growth_momentum_evidence": [  // ⭐ V8.15 新增：最低必要證據
          {"indicator": "Revenue_YoY_Trend", "value": "持續成長", "vs_peers": "中段", "source": "財報狗"},
          {"indicator": "Growth_Consistency", "value": "8/12 季正成長", "source": "程式計算"}
        ],
        "growth_reasoning": "1 句原因（AI 生成，但只能引用數據表）"
      },
      "future_potential_analysis": {  // ⭐ V8.15 重構：未來成長潛力分析
        "inevitability_score": 0-100,
        "inevitability_reasoning": "理由（必須引用 P0/P0.5/P0.7/P1）",
        "inevitability_evidence": [  // ⭐ V8.15 新增：最低必要證據
          {"source": "P0", "evidence": "AI 算力成長 → 能源需求在物理上不可避免"},
          {"source": "P0.5", "evidence": "該公司位於產業鏈瓶頸節點"},
          {"source": "P0.7", "evidence": "當前時間位置 = Early，有利於成長"},
          {"source": "P1", "evidence": "Tier S，結構性受益者"}
        ],
        "executability_score": 0-100,
        "executability_reasoning": "理由（必須引用數據或 P1 財報段落）",
        "executability_evidence": [  // ⭐ V8.15 新增：最低必要證據
          {"type": "R&D_Intensity", "value": "15%", "vs_peers": "前段", "source": "財報狗"},
          {"type": "Capex_Intensity", "value": "12%", "trend": "提升", "source": "財報狗"},
          {"type": "Guidance", "quote": "預計 2025-Q3 量產...", "page": 15, "filing_period": "2025-Q1", "source": "P1 財報段落"}
        ],
        "future_potential_score": 0-100,  // 0.5 × Inevitability + 0.5 × Executability
        "future_breakout_grade": "S/A/B/X",  // ⭐ V8.15 新增
        "time_window_penalty": {  // ⭐ V8.15 新增：Time Window Penalty
          "p0_7_time_position": "Late",
          "p0_7_turning_point_risk": "HIGH",
          "penalty_applied": true,
          "penalty_reasoning": "P0.7 判定為 Late 階段，Future Breakout Grade 上限被 cap 為 A",
          "risk_flag": "LATE_CYCLE"
        },
        "milestones_to_verify": [  // ⭐ V8.15 新增：驗證里程碑（僅當 Future Breakout = S/S+ 時）
          {
            "milestone_id": "M1",
            "milestone_type": "量產時程",
            "target": "2025-Q3",
            "verification_source": "財報指引（2025-Q1 財報，Page 15）",
            "verification_method": "P5 Weekly 監控財報日曆"
          }
        ]
      },
      "track_type": "CORE" 或 "FRONTIER",  // ⭐ V8.15 新增
      "position_role": "MOMENTUM/DIAMOND/OPTIONALITY/DEFENSIVE/REJECT",  // ⭐ V8.15 新增
      "position_role_reasoning": "理由（基於三軸評級）",  // ⭐ V8.15 新增
      "future_validation": "CONFIRMED/PARTIAL/UNCONFIRMED",  // ⭐ V8.15 新增
      "frontier_risks_json": {  // ⭐ V8.15 新增：僅當 track_type = FRONTIER 時
        "runway_quarters": 8,
        "runway_calculation": {
          "cash_and_equivalents": 500000000,
          "quarterly_burn_rate": 62500000,
          "runway_quarters": 8
        },
        "execution_risk": "HIGH/MED/LOW",
        "dilution_risk": "HIGH/MED/LOW",
        "window_fit": "HIGH/MED/LOW",
        "window_fit_reasoning": "理由（引用 P0.7）"
      },
      "frontier_conditions": [  // ⭐ V8.15 新增：僅當 track_type = FRONTIER 時
        "必須看到 P3 主力行為才允許加碼",
        "必須看到機構籌碼轉強才允許重倉",
        "必須看到驗證里程碑達成才允許擴大倉位"
      ],
      "gate_result_for_frontier": "OPTIONALITY_ONLY",  // ⭐ V8.15 新增：僅當 track_type = FRONTIER 且 Safety = X 時
      "narrative_consistency_check": "一致/不一致/需特別審",  // ⭐ V8.15 新增：P1 財報段落對照
      "narrative_consistency_evidence": []  // ⭐ V8.15 新增：引用 P1 段落
    }
  },
  "tier_assignments": {
    "AAPL": {
      "ticker": "AAPL",
      "tier": "CORE/STABLE_SWING/AGGRESSIVE/OPPORTUNISTIC",
      "tier_reason": "分層決策的理由（必須說明基於 P0.7 槓桿角色 + Safety + Growth Momentum + Future Breakout + Track Type）",
      "p0_7_leveraged_role_type": "平台核心層/合規入口層/設備承載層/流程OS/供給側約束（來自 P1）",
      "p0_7_time_position": "Early/Mid/Late/Transition（來自 P1）",
      "safety_grade": "S/A/B/X",  // ⭐ V8.15 新增
      "growth_momentum_grade": "S/A/B/X",  // ⭐ V8.15 新增
      "future_breakout_grade": "S/A/B/X",  // ⭐ V8.15 新增
      "track_type": "CORE" 或 "FRONTIER",  // ⭐ V8.15 新增
      "position_role": "MOMENTUM/DIAMOND/OPTIONALITY/DEFENSIVE/REJECT",  // ⭐ V8.15 新增
      "position_role_reasoning": "理由（基於三軸評級）",  // ⭐ V8.15 新增
      "max_position_cap_suggestion": 0.15,  // ⭐ V8.15 新增：僅當 position_role = OPTIONALITY 時降低（例如 0.03）
      "confidence": 0.0-1.0
    }
  },
  "financial_metrics": {
    "AAPL": {
      "ticker": "AAPL",
      "revenue_yoy": 0.15,
      "gross_margin": 0.38,
      "operating_margin": 0.25,
      "net_margin": 0.20,
      "cfo": 1000000000,
      "fcf": 800000000,
      "net_debt_ebitda": 0.5,
      "roic": 0.25,
      "current_ratio": 1.5,
      "peer_identification": {
        "target_company_scale": "龍頭",
        "peer_companies": [
          {
            "ticker": "MSFT",
            "name": "Microsoft",
            "scale": "龍頭",
            "selection_reason": "選擇理由"
          },
          {
            "ticker": "GOOGL",
            "name": "Alphabet",
            "scale": "龍頭",
            "selection_reason": "選擇理由"
          }
        ],
        "industry_definition": "同業定義說明（為什麼這些公司是同業，不是同板塊）",
        "data_source": "P2_US_TAIWAN_CSE"  // ⭐ V8.0 修正：美股和台股統一使用財報狗
      },
      "fpe_a": 25.0,  // ⭐ 從公司財測/來期業績推導（FPE_A = 當前股價 / 公司財測 Forward EPS）
      "fpe_b": 28.0   // ⭐ 已由程式從 Yahoo Finance/財報狗 獲取（分析師共識 Forward P/E）
    },
    "MSFT": {
      "ticker": "MSFT",
      "revenue_yoy": 0.12,
      "gross_margin": 0.35,
      "operating_margin": 0.22,
      "net_margin": 0.18,
      "roic": 0.23,
      "current_ratio": 1.8
    },
    "GOOGL": {
      "ticker": "GOOGL",
      "revenue_yoy": 0.10,
      "gross_margin": 0.40,
      "operating_margin": 0.20,
      "net_margin": 0.15,
      "roic": 0.20,
      "current_ratio": 1.6
    }
  },
  
  "peer_comparison_requests": {
    "AAPL": {
      "ticker": "AAPL",
      "peer_companies": ["MSFT", "GOOGL"],
      "target_company_scale": "龍頭/中大型/小型新創",
      "data_source": "INSTITUTIONAL_DATA CSE (SEC EDGAR)",
      "industry_definition": "同業定義說明（為什麼這些公司是同業，不是同板塊）",
      "selection_reason": "選擇這些同業公司的理由"
    }
  },
  "confidence_level": 0.0-1.0,
  "analysis_date": "${new Date().toISOString().split('T')[0]}",
  "phase_version": "V8.0"
}

---

## ⭐ P2-10 Phase 2 輸出表格（Mandatory Schema）

**⚠️ 重要：以下欄位是 Phase 2 的唯一合法輸出，後段 Phase 只能新增自己的欄位，不得回寫這些欄位。**

### Phase 1 繼承（只讀）

以下欄位來自 Phase 1，Phase 2 只能讀取，不能修改：
- Theme_Track（ENG / STRUCT / BOTH）
- Theme_ID
- Subtheme_ID
- Primary_Technology_or_Node
- Company_Code
- Company_Name
- Market
- Moat_Type（M1-M6；主/次可用「M4> M5」格式）
- Rerate_State（R0-R3）
- Role_in_Theme
- P0.7_Time_Position（Early/Mid/Late/Transition）
- P0.7_Leveraged_Role_Type
- Phase1_Version

### Phase 2 核心輸出 ⭐⭐⭐⭐⭐

以下欄位是 Phase 2 的核心輸出，必須完整填寫：
- **Gate_Result**：PASS/WATCH/FAIL（三級制）
- **Tier**：CORE/STABLE_SWING/AGGRESSIVE/OPPORTUNISTIC ⭐ 新增
- **Tier_Reason**：分層理由（必須說明基於 P0.7 槓桿角色 + 財務安全性）⭐ 新增

### 財務指標

以下財務指標必須填寫（從外部權威數據源提取）：
- Revenue_YoY（營收年增率）
- Gross_Margin（毛利率）
- Operating_Margin（營業利益率）
- Net_Margin（淨利率）
- CFO（營運現金流）
- FCF（自由現金流）
- Net_Debt_EBITDA（Net Debt / EBITDA）
- ROIC（投入資本回報率）
- Current_Ratio（流動比率）

### 同業比較

- **Peer_Comparison**：同業比較結果（JSON 格式）
  - 必須包含：同業公司清單、目標公司規模分類、相對位置分析（由程式計算後填入）

### 其他

- FPE_A
- FPE_B
- Phase2_Version（V8.0）
- Last_Updated
- Notes

---

## ⭐⭐⭐ P2-7 雙軌制判定（Track A: CORE vs Track B: FRONTIER）⭐⭐⭐ V8.15 新增

**⚠️ 重要：必須先判定 Track Type，這會影響 Gate 判定標準和分層決策。**

### Track Type 判定邏輯

**Track A: CORE / Quality（主倉候選）**
- **判斷標準**：
  - 公司規模 = "龍頭" 或 "中大型" → track_type = "CORE"
  - 或公司規模 = "小型新創" 但不符合 Frontier 條件 → track_type = "CORE"
- **特徵**：成熟/大型公司、安全 + 成長都強、適合重倉（CORE/STABLE_SWING）
- **Gate 標準**：嚴格執行 Safety Gate（Safety = X → FAIL）

**Track B: FRONTIER / Optionality（前沿噴發倉候選）**
- **判斷標準**：
  - 公司規模 = "小型新創"
  - 且 R&D_Intensity > 同業前段
  - 且 Future_Potential_Score ≥ 70
  - 且 Safety_PARTIAL 或以上
  - → track_type = "FRONTIER"
- **特徵**：新創/小型/研發前沿/敘事型、安全可能不足，但成長潛力極高
- **Gate 標準**：放寬 Safety Gate，但必須 Runway ≥ 4 季（硬門檴）

### Frontier 特殊驗證（僅當 track_type = "FRONTIER" 時）

**1. Runway（生存跑道）** ⭐ V8.17 補丁：Runway = 風險，不是死刑

## ⛽ 流動性風險處理原則（Runway as Risk, Not Verdict）⭐ V8.17 補丁

### 1. Runway 的角色
- Runway 是「風險強度指標」，不是公司價值判決。
- **禁止** 因 Runway < 4 季度直接判定 FAIL。

### 2. 風險標記機制
- 若 Cash / Burn Rate < 4 季度：
  - 標記 [RISK: LOW_RUNWAY]
  - 將 Track_Type 設為 [FRONTIER]
  - 明確說明：「為何此公司仍可能值得小倉位下注」

### 3. 潛在續命因子評估（不要求確定性）
請評估（不是搜尋）以下是否**合理存在**：
- 產業是否存在持續資金流入（VC / Strategic / Government）
- 該公司是否位於可能被收購、合作、或政策扶持的位置
- 商業模式是否具有「一旦驗證即放大」的非線性特性

> 注意：你不需要證明「一定會融資」，你只需要判斷「是否具備合理的續命敘事空間」。

### 4. FAIL 的唯一條件
- 僅在同時滿足以下兩點時，才可標記 FAIL：
  1. 現金即將耗盡
  2. 商業模式或技術路線已被證實不可行

🎯 關鍵點

AI 可以保留想像力

但要把不確定性講清楚

生死仍然交給後段

---

**Runway 計算與風險標記**：
- 現金與等價物 / 現金消耗（每季 burn）→ 估算 runway（季度數）
- 融資與稀釋風險 proxy：股本變動、可轉債、SBC（股權薪酬）趨勢（如果抓得到）
- **風險標記**：Runway < 4 季 → 標記 [RISK: LOW_RUNWAY]，但不直接 FAIL
- Runway ≥ 4 季 → 允許進入 OPTIONALITY

**2. 真成長 vs 假成長（測謊機）**
- **對軟體/AI 產品型公司**：
  - Demand Evidence：RPO / Remaining performance obligations、Deferred revenue（遞延收入）、客戶數/ARPU/留存（如果公開）
  - 指引（Guidance）與下一季/全年上修頻率（只做「存在性+方向」，不做股價推論）
  - Unit Economics Proxy：毛利率趨勢、S&M/R&D 的效率（營收增長對應費用增長的斜率）
- **對硬體/製造型公司**：
  - CapEx/存貨/合約負債
  - 產能擴張計劃的具體性

**3. 必然性來自 P0.7 系統動力學**
- Window Fit: HIGH/MED/LOW + 理由（引用 P0.7）
- 這家公司是否踩在拐點前（Early/Mid）？或已經是派對尾聲（Late）？

---

## 注意事項

1. **必須基於 P1 的 Master_Candidates 進行分析**：不能偏離前段的結論，不能修改封存欄位。

2. **P2-1 明確禁止事項必須嚴格遵守**：
   - ❌ 不選股、不預測成長率、不推估股價、不做技術分析、不因市場情緒改 Gate
   - ❌ 嚴禁回寫或重判封存欄位（Theme/Subtheme、Moat_Type、Rerate_State、三池歸屬、P0.7_Time_Position、P0.7_Leveraged_Role_Type）

3. **P2-4 核心安全性模組必須按照三層結構分析**：
   - 🔴 第一層｜盈利品質（單季毛利率、單季營業利益率、單季淨利率、單季 EPS、營收成長）
   - 🔴 第二層｜現金流與抗壓性（最高權重）（CFO、FCF、CAPEX/Revenue、Net Debt/EBITDA）
   - 🔴 第三層｜資本效率（ROIC、存貨週轉天數、流動比率）
   - 🟡 輔助層（不可單獨否決）

4. **⭐ V8.15 新增：P2-4.5 成長性分析模組必須按照四個維度分析**：
   - Growth Rate（成長率趨勢）：營收/毛利/營業利益/自由現金流（TTM + 最近三季趨勢）
   - Growth Consistency（成長一致性）：最近 8–12 季中，正成長季度比例
   - Operating Leverage Proxy（營運槓桿代理）：營收成長時，營業利益率是否同步改善
   - Cash Conversion（現金轉換率）：FCF / Net Income 或 CFO / Net Income
   - 必須計算 Growth_Quality_Score (0-100) 和 Growth_Momentum_Grade (S/A/B/X)
   - 必須附上最低必要證據

5. **⭐ V8.15 新增：P2-4.6 未來成長潛力分析模組必須拆成兩個分數**：
   - 必然性（Inevitability Score, 0-100）：必須引用 P0/P0.5/P0.7/P1 結論，禁止自行想像
   - 可實現性（Executability Score, 0-100）：必須先判斷公司類型（硬體/製造 vs 軟體/平台），套用不同模板
   - Future_Potential_Score = 0.5 × Inevitability + 0.5 × Executability
   - 必須應用 Time Window Penalty（P0.7 = Late → Future Breakout Grade 最高為 A）
   - Future Breakout = S/S+ 時，必須強制輸出 milestones_to_verify（最多 5 個）

6. **⭐ V8.15 新增：必須先判定 Track Type（CORE vs FRONTIER）**：
   - 這會影響 Gate 判定標準（Frontier 允許 Safety = X，但必須 Runway ≥ 4 季）
   - 這會影響分層決策（Frontier 有較寬鬆的 Safety 要求）

7. **P2-5 安全性 Gate 必須基於同業比較結果**：
   - ⭐ **Gate 檢查必須基於同業比較結果，而非絕對數值**
   - ⭐ **每個公司都必須識別同業公司清單（Stage 1），這是 Gate 檢查和分層決策的基礎**
   - ⭐ **同業定義：不是「同板塊」，而是「相同細分產業」，必須由 AI 交叉判定**
   - ⭐ **同業分類：必須分開龍頭/中大型/小型新創來比較，絕對不能跨分類比較**
   - ⭐ **同業數據將由程式從相同白名單數據源抓取，確保比較基準一致**
   - ⭐ **相對位置計算將由程式執行（避免兩次 AI 模型無法承接上下文）**
   - ⭐ **你只需要識別同業公司清單，並說明選擇理由，不需要計算相對位置**
   - ⭐ **V8.15 新增：Gate 判定必須考慮 Safety + Growth + Future，且考慮 Track Type**

8. **⭐ V8.15 新增：分層決策必須基於三軸評級 + Position Role + Track Type**：
   - ✅ 必須考慮 Safety Grade (S/A/B/X)、Growth Momentum Grade (S/A/B/X)、Future Breakout Grade (S/A/B/X)
   - ✅ 必須判定 Position Role (MOMENTUM/DIAMOND/OPTIONALITY/DEFENSIVE/REJECT)
   - ✅ 必須判定 Track Type (CORE/FRONTIER)
   - ✅ 必須考慮 P0.7 的 Leveraged_Role_Type 和 Time_Position
   - ✅ 不能只看財務指標，必須結合三軸評級和 Position Role

9. **財務指標必須從外部權威數據源提取**：
   - ✅ 不要自己計算（除非數據源完全沒有該指標）
   - ✅ 所有數據都由程式從白名單數據源獲取

10. **⭐ V8.15 新增：P1 財報段落使用方式**：
    - P2 仍以權威數據源（財報狗/buffet code）為主
    - P1 財報段落只做「佐證/對照」，不改變數據源權威性
    - 一致性檢查：若數據顯示成長很強，但 Business 段落完全看不出主力產品/需求來源 → 標記「敘事與數據不一致」
    - 證據指針：Future Potential 結論必須附 1–3 句引用（P1 抽取的原文段落片段）

11. **輸出必須完全符合 P2-10 Mandatory Schema**：
    - ✅ 欄位不可增刪
    - ✅ 格式必須正確
    - ✅ ⭐ V8.15 新增：必須包含所有新欄位（safety_grade、growth_momentum_grade、future_breakout_grade、track_type、position_role、milestones_to_verify 等）

12. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確，可以被程式解析。

13. **⚠️ 重要：輸出格式要求（節省 Token 成本）**：
    - ❌ **禁止任何客套話、開場白、結尾語**（例如：「你問得非常好...」、「如果你需要的話，我可以幫你...」等）
    - ❌ **禁止任何與工作無關的說明文字**
    - ✅ **只輸出純 JSON 格式**，直接開始 JSON 對象，不要有任何前綴或後綴
    - ✅ **API 版本必須嚴格遵守此要求**，與網頁版不同，API 版本不應包含任何額外的禮貌性文字
    - ✅ **節省 Token = 節省成本**，每多一個無用的 token 都會增加成本

14. **每個公司都必須有完整的分析**：不能遺漏任何公司。
`;
}

// ==========================================
// 快照管理
// ==========================================

/**
 * 獲取最新 P2 快照
 */
function getLatestP2Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 8).getValues()[0];
    
    return {
      snapshot_id: row[0],
      created_at: row[1],
      trigger: row[2],
      tier_assignments_json: row[3] ? JSON.parse(row[3]) : {},
      tier_summary_json: row[4] ? JSON.parse(row[4]) : {},
      changes_json: row[5] ? JSON.parse(row[5]) : null,
      auto_trigger_json: row[6] ? JSON.parse(row[6]) : null,
      version: row[7] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P2 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P2 快照
 */
function saveP2Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P2__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P2__SNAPSHOT");
    sheet.appendRow([
      "snapshot_id",
      "created_at",
      "trigger",
      "tier_assignments_json",
      "tier_summary_json",
      "changes_json",
      "auto_trigger_json",
      "version"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP2SnapshotId(snapshotData.frequency);
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(snapshotData.tier_assignments),
    JSON.stringify(snapshotData.tier_summary),
    JSON.stringify(snapshotData.changes),
    JSON.stringify(snapshotData.auto_trigger),
    "V7.1"
  ]);
  
  Logger.log(`P2 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * 生成 P2 快照 ID
 */
function generateP2SnapshotId(frequency) {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  
  if (frequency === "QUARTERLY") {
    return `P2_Q${year}Q${quarter}_${Date.now()}`;
  } else {
    return `P2_M${year}M${month}_${Date.now()}`;
  }
}

/**
 * 比對與上一版快照的變動
 */
function compareWithPreviousSnapshotP2(currentOutput) {
  const previousSnapshot = getLatestP2Snapshot();
  
  if (!previousSnapshot) {
    return {
      has_changes: true,
      is_first_run: true,
      changes: []
    };
  }
  
  const previousTierAssignments = previousSnapshot.tier_assignments_json || {};
  const currentTierAssignments = currentOutput.tier_assignments || {};
  const changes = [];
  
  // 比對 Tier 變動
  const tierChanges = [];
  for (const [ticker, currentTier] of Object.entries(currentTierAssignments)) {
    const previousTier = previousTierAssignments[ticker];
    
    if (!previousTier || previousTier.tier !== currentTier.tier) {
      tierChanges.push({
        ticker: ticker,
        from: previousTier ? previousTier.tier : "NEW",
        to: currentTier.tier
      });
    }
  }
  
  // 檢查是否有公司被移除
  for (const [ticker, previousTier] of Object.entries(previousTierAssignments)) {
    if (!currentTierAssignments[ticker]) {
      tierChanges.push({
        ticker: ticker,
        from: previousTier.tier,
        to: "REMOVED"
      });
    }
  }
  
  if (tierChanges.length > 0) {
    changes.push({
      type: "TIER_CHANGES",
      changes: tierChanges
    });
  }
  
  return {
    has_changes: changes.length > 0 || tierChanges.length > 0,
    is_first_run: false,
    changes: changes
  };
}

/**
 * 檢查自動觸發條件
 */
function checkAutoTriggerConditions(p2Output) {
  const autoTriggers = [];
  
  // 檢查是否有 Tier 變動
  if (p2Output.tier_summary) {
    const tierCounts = {
      CORE: p2Output.tier_summary.CORE?.count || 0,
      STABLE_SWING: p2Output.tier_summary.STABLE_SWING?.count || 0,
      AGGRESSIVE: p2Output.tier_summary.AGGRESSIVE?.count || 0,
      OPPORTUNISTIC: p2Output.tier_summary.OPPORTUNISTIC?.count || 0
    };
    
    // 如果 CORE 數量變化超過 20%，觸發 P3
    const previousSnapshot = getLatestP2Snapshot();
    if (previousSnapshot && previousSnapshot.tier_summary_json) {
      const previousCoreCount = previousSnapshot.tier_summary_json.CORE?.count || 0;
      const currentCoreCount = tierCounts.CORE;
      
      if (previousCoreCount > 0) {
        const coreChangeRatio = Math.abs(currentCoreCount - previousCoreCount) / previousCoreCount;
        if (coreChangeRatio > 0.20) {
          autoTriggers.push({
            type: "CORE_TIER_CHANGE",
            threshold: 0.20,
            actual_change: coreChangeRatio,
            trigger_phase: "P3"
          });
        }
      }
    }
  }
  
  return {
    triggers: autoTriggers,
    should_trigger_p3: autoTriggers.length > 0
  };
}

// ==========================================
// 下游觸發
// ==========================================

/**
 * 觸發下游 Phase（P3）
 */
function triggerDownstreamPhasesP2(sourcePhase, snapshot) {
  if (snapshot.changes && snapshot.changes.has_changes) {
    // 觸發 P3（技術分析）
    Logger.log("P2 變動檢測，觸發 P3");
    try {
      // 觸發 P3 週度分析
      P3_Weekly_Execute({
        trigger: "P2_UPDATE",
        context: {
          source_phase: "P2",
          source_snapshot_id: snapshot.snapshot_id
        }
      });
    } catch (error) {
      Logger.log(`P2 觸發 P3 失敗：${error.message}`);
    }
  }
}

// ==========================================
// M0 Job Queue 整合
// ==========================================

/**
 * 提交任務到 M0 Job Queue
 */
function submitToM0JobQueue(projectId, requestedFlow, inputPayload) {
  Logger.log(`P2 調試：submitToM0JobQueue 被調用，projectId=${projectId}`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在");
  }
  
  const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  jobQueueSheet.appendRow([
    jobId,
    projectId,
    "NEW",
    JSON.stringify(requestedFlow),
    JSON.stringify(inputPayload),
    null,  // started_at
    null,  // finished_at
    null,  // error_code
    null,  // error_message
    0,     // retry_count
    new Date()  // created_at
  ]);
  
  Logger.log(`P2 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 從表格讀取 Master_Candidates
 */
function getMasterCandidatesFromSheet() {
  try {
    Logger.log(`P2 調試：getMasterCandidatesFromSheet 開始執行`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Master_Candidates");
    
    if (!sheet) {
      Logger.log(`P2 調試：Phase1_Master_Candidates 表格不存在`);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    Logger.log(`P2 調試：Phase1_Master_Candidates 表格最後一行：${lastRow}`);
    
    if (lastRow <= 1) {
      Logger.log(`P2 調試：Phase1_Master_Candidates 表格為空（只有標題行或沒有數據）`);
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    Logger.log(`P2 調試：讀取到 ${rows.length - 1} 行數據，標題：${headers.slice(0, 5).join(", ")}...`);
    
    const candidates = [];
    for (let i = 1; i < rows.length; i++) {
      const candidate = {};
      headers.forEach((header, colIndex) => {
        // 保持原始欄位名稱大小寫
        candidate[header] = rows[i][colIndex];
        // 同時添加小寫版本以保持向後兼容
        candidate[header.toLowerCase().replace(/\s+/g, "_")] = rows[i][colIndex];
      });
      candidates.push(candidate);
    }
    
    Logger.log(`P2 調試：成功讀取 ${candidates.length} 個候選公司`);
    
    return candidates;
  } catch (error) {
    Logger.log(`讀取 Master_Candidates 失敗：${error.message}`);
    return [];
  }
}

/**
 * 根據快照 ID 獲取 P1 快照
 */
function getP1SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P1__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const snapshotIdCol = headers.indexOf("snapshot_id");
    if (snapshotIdCol === -1) {
      return null;
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][snapshotIdCol] === snapshotId) {
        const snapshot = {};
        headers.forEach((header, colIndex) => {
          snapshot[header.toLowerCase()] = rows[i][colIndex];
        });
        return snapshot;
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`獲取 P1 快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// 財務數據收集（外部數據源優先）
// ==========================================

/**
 * 從外部權威數據源收集財務數據（優先使用，沒有才 fallback）
 * ⭐ 測試模式下也正常抓取數據，以測試數據管線是否暢通
 * @param {Array} masterCandidates - Master Candidates 列表
 * @param {string} frequency - 頻率（MONTHLY / QUARTERLY）
 * @return {Object} 財務數據（以 ticker 為 key）
 */
function collectFinancialDataFromExternalSources(masterCandidates, frequency) {
  const financialData = {};
  
  Logger.log(`P2 開始收集財務數據：${masterCandidates.length} 個公司（測試模式也正常抓取，以測試數據管線）`);
  
  for (const candidate of masterCandidates) {
    const ticker = candidate.company_code || candidate.Company_Code;
    const market = candidate.market || candidate.Market;
    
    if (!ticker || !market) {
      Logger.log(`跳過無效的候選公司：ticker=${ticker}, market=${market}`);
      continue;
    }
    
    try {
      let data = null;
      
      // 根據市場選擇對應的數據收集函數
      // ⭐ 測試模式下也正常抓取，以測試數據管線是否暢通
      if (market === "TW" || market === "Taiwan") {
        data = collectTaiwanStockFinancialData(ticker, frequency);
      } else if (market === "US" || market === "United States") {
        data = collectUSStockFinancialData(ticker, frequency);
      } else if (market === "JP" || market === "Japan") {
        data = collectJapanStockFinancialData(ticker, frequency);
      } else {
        Logger.log(`不支援的市場：${market}，跳過 ${ticker}`);
        continue;
      }
      
      if (data) {
        // ⚠️ V8.0 修正：FPE_B 已移至 P5 Weekly，不再在 P2 中收集
        // FPE_B 現在由 P5 Weekly 的市場情緒指標監控模組收集（24_P5_WEEKLY_SENTIMENT.js）
        
        financialData[ticker] = data;
        Logger.log(`P2 成功收集 ${ticker} 財務數據`);
      } else {
        Logger.log(`P2 無法收集 ${ticker} 財務數據（所有數據源都失敗）`);
        // ⚠️ 如果數據收集失敗，記錄但繼續執行（符合 missing_data_policy: IGNORE_CONTINUE）
        financialData[ticker] = {
          ticker: ticker,
          market: market,
          data_source: "FAILED",
          search_results: [],
          extracted: false,
          note: "數據收集失敗，但繼續執行（符合 missing_data_policy: IGNORE_CONTINUE）"
        };
      }
    } catch (error) {
      Logger.log(`P2 收集 ${ticker} 財務數據失敗：${error.message}，繼續執行（符合 missing_data_policy: IGNORE_CONTINUE）`);
      // ⚠️ 如果發生錯誤，記錄但繼續執行（符合 missing_data_policy: IGNORE_CONTINUE）
      financialData[ticker] = {
        ticker: ticker,
        market: market,
        data_source: "ERROR",
        search_results: [],
        extracted: false,
        error: error.message,
        note: "數據收集發生錯誤，但繼續執行（符合 missing_data_policy: IGNORE_CONTINUE）"
      };
    }
  }
  
  Logger.log(`P2 財務數據收集完成：${Object.keys(financialData).length} 個公司有數據（包括失敗記錄）`);
  return financialData;
}

// ==========================================
// FPE_B 數據收集（已移至 P5 Weekly）
// ==========================================

// ⚠️ V8.0 修正：FPE_B 收集邏輯已移至 P5 Weekly 的市場情緒指標監控模組
// 請參考：src/24_P5_WEEKLY_SENTIMENT.js
// - collectMarketSentimentIndicators() - 主函數
// - getFPE_B_FromYahooFinance() - Yahoo Finance 爬蟲
// - parseYahooForwardPE() - 解析 Forward P/E
// - parseYahooAnalysisPage() - 解析分析師共識 EPS
// - getCurrentPriceFromYahoo() - 獲取當前股價

/**
 * 收集台股財務數據（優先使用官方數據源，沒有才 fallback）
 * @param {string} ticker - 股票代碼（例如：2330）
 * @param {string} frequency - 頻率
 * @return {Object|null} 財務數據
 */
function collectTaiwanStockFinancialData(ticker, frequency) {
  Logger.log(`P2 開始收集台股 ${ticker} 財務數據`);
  
  // ⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計
  // 美股和台股統一使用財報狗網站，防止財報計算方式偏移
  // 優先來源：P2_US_TAIWAN CSE（財報狗網站）
  // Fallback：無（必須統一數據源）
  
  try {
    // 使用 M0 的 CSE_SEARCH 功能搜尋財務數據
    const searchQuery = `${ticker} 財務報表 營收 毛利率 營業利益率 淨利率 現金流`;
    const cseType = "P2_US_TAIWAN";  // ⭐ V8.0 SSOT 定案：美股和台股統一使用財報狗
    
    const jobId = `P2_FINANCIAL_${ticker}_${Date.now()}`;
    const m0Payload = {
      search_query: searchQuery,
      cse_type: cseType,
      max_results: 10,
      ticker: ticker,
      market: "TW",
      frequency: frequency
    };
    
    // ⭐ 測試模式下也正常執行 CSE 搜尋，以測試數據管線是否暢通
    Logger.log(`P2 開始執行 CSE 搜尋：ticker=${ticker}, cseType=${cseType}, query="${searchQuery}"`);
    
    const cseResult = executeCSESearch(jobId, "CSE_SEARCH", m0Payload);
    
    if (cseResult && cseResult.output && cseResult.output.search_results) {
      const results = cseResult.output.search_results;
      Logger.log(`P2 CSE 搜尋成功：ticker=${ticker}, 找到 ${results.length} 筆結果`);
      
      // ⚠️ 注意：財務指標需要由 AI 從 search_results 中提取（在 Stage 1 完成）
      return {
        ticker: ticker,
        market: "TW",
        data_source: "P2_US_TAIWAN_CSE",  // ⭐ V8.0 SSOT 定案：統一使用財報狗
        search_results: results,
        // 財務指標將由 AI 從搜尋結果中提取（在 Stage 1 完成）
        extracted: false  // 標記為未提取，由 AI 在 Stage 1 處理
      };
    } else {
      Logger.log(`P2 CSE 搜尋未返回結果：ticker=${ticker}, cseResult=${cseResult ? "存在但無 output" : "null"}`);
      return null;
    }
  } catch (error) {
    Logger.log(`P2 收集台股 ${ticker} 財務數據失敗：${error.message}，堆疊：${error.stack}`);
    return null;
  }
}

/**
 * 收集美股財務數據（優先使用 SEC EDGAR，沒有才 fallback）
 * @param {string} ticker - 股票代碼（例如：AAPL）
 * @param {string} frequency - 頻率
 * @return {Object|null} 財務數據
 */
function collectUSStockFinancialData(ticker, frequency) {
  Logger.log(`P2 開始收集美股 ${ticker} 財務數據`);
  
  // ⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計
  // 美股和台股統一使用財報狗網站，防止財報計算方式偏移
  // 優先來源：P2_US_TAIWAN CSE（財報狗網站）
  // Fallback：無（必須統一數據源）
  
  try {
    // ⭐ 通用查詢格式：適用於所有美股公司
    const searchQuery = `${ticker} 10-Q 10-K form financial statements`;
    const cseType = "P2_US_TAIWAN";  // ⭐ V8.0 SSOT 定案：美股和台股統一使用財報狗
    
    const jobId = `P2_FINANCIAL_${ticker}_${Date.now()}`;
    const m0Payload = {
      search_query: searchQuery,
      cse_type: cseType,
      max_results: 10,
      ticker: ticker,
      market: "US",
      frequency: frequency
    };
    
    // ⭐ 測試模式下也正常執行 CSE 搜尋，以測試數據管線是否暢通
    Logger.log(`P2 開始執行 CSE 搜尋：ticker=${ticker}, cseType=${cseType}, query="${searchQuery}"`);
    
    const cseResult = executeCSESearch(jobId, "CSE_SEARCH", m0Payload);
    
    if (cseResult && cseResult.output && cseResult.output.search_results) {
      const results = cseResult.output.search_results;
      Logger.log(`P2 CSE 搜尋成功：ticker=${ticker}, 找到 ${results.length} 筆結果`);
      
      // ⚠️ 注意：財務指標需要由 AI 從 search_results 中提取（在 Stage 1 完成）
      return {
        ticker: ticker,
        market: "US",
        data_source: "P2_US_TAIWAN_CSE",  // ⭐ V8.0 SSOT 定案：統一使用財報狗
        search_results: results,
        extracted: false  // 標記為未提取，由 AI 在 Stage 1 處理
      };
    } else {
      Logger.log(`P2 CSE 搜尋未返回結果：ticker=${ticker}, cseResult=${cseResult ? "存在但無 output" : "null"}`);
      return null;
    }
  } catch (error) {
    Logger.log(`P2 收集美股 ${ticker} 財務數據失敗：${error.message}，堆疊：${error.stack}`);
    return null;
  }
}

/**
 * 收集日股財務數據（優先使用官方數據源，沒有才 fallback）
 * @param {string} ticker - 股票代碼（例如：7203）
 * @param {string} frequency - 頻率
 * @return {Object|null} 財務數據
 */
function collectJapanStockFinancialData(ticker, frequency) {
  Logger.log(`P2 開始收集日股 ${ticker} 財務數據`);
  
  // ⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計
  // 日股統一使用 buffet code 網站，防止財報計算方式偏移
  // 優先來源：P2_JAPAN CSE（buffet code 網站）
  // Fallback：無（必須統一數據源）
  
  try {
    const searchQuery = `${ticker} 財務報表 売上高 営業利益率 純利益率 キャッシュフロー`;
    const cseType = "P2_JAPAN";  // ⭐ V8.0 SSOT 定案：日股統一使用 buffet code
    
    const jobId = `P2_FINANCIAL_${ticker}_${Date.now()}`;
    const m0Payload = {
      search_query: searchQuery,
      cse_type: cseType,
      max_results: 10,
      ticker: ticker,
      market: "JP",
      frequency: frequency
    };
    
    // ⭐ 測試模式下也正常執行 CSE 搜尋，以測試數據管線是否暢通
    Logger.log(`P2 開始執行 CSE 搜尋：ticker=${ticker}, cseType=${cseType}, query="${searchQuery}"`);
    
    const cseResult = executeCSESearch(jobId, "CSE_SEARCH", m0Payload);
    
    if (cseResult && cseResult.output && cseResult.output.search_results) {
      const results = cseResult.output.search_results;
      Logger.log(`P2 CSE 搜尋成功：ticker=${ticker}, 找到 ${results.length} 筆結果`);
      
      // ⚠️ 注意：財務指標需要由 AI 從 search_results 中提取（在 Stage 1 完成）
      return {
        ticker: ticker,
        market: "JP",
        data_source: "P2_JAPAN_CSE",  // ⭐ V8.0 SSOT 定案：統一使用 buffet code
        search_results: results,
        extracted: false  // 標記為未提取，由 AI 在 Stage 1 處理
      };
    } else {
      Logger.log(`P2 CSE 搜尋未返回結果：ticker=${ticker}, cseResult=${cseResult ? "存在但無 output" : "null"}`);
      return null;
    }
  } catch (error) {
    Logger.log(`P2 收集日股 ${ticker} 財務數據失敗：${error.message}，堆疊：${error.stack}`);
    return null;
  }
}

// ==========================================
// M0 輔助函數（測試模式用）
// ==========================================

/**
 * 檢查 M0 Job 狀態
 * @param {string} jobId - 任務 ID
 * @return {string|null} 任務狀態
 */
function checkM0JobStatus(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__JOB_QUEUE");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const statusCol = headers.indexOf("status");
    
    if (jobIdCol === -1 || statusCol === -1) {
      return null;
    }
    
    // 查找對應的 job_id（從最後一行開始，找最新的）
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][jobIdCol] === jobId) {
        return rows[i][statusCol] || null;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`檢查 M0 Job 狀態失敗：${error.message}`);
    return null;
  }
}

/**
 * 讀取 M0 Job 結果（輔助函數）
 * @param {string} jobId - 任務 ID
 * @return {Object|null} M0 執行結果，如果不存在則返回 null
 */
function getM0JobResult(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__RESULT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const outputCol = headers.indexOf("final_output");
    
    if (jobIdCol === -1 || outputCol === -1) {
      return null;
    }
    
    // 查找對應的 job_id（從最後一行開始，找最新的結果）
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][jobIdCol] === jobId) {
        const output = rows[i][outputCol];
        return {
          job_id: jobId,
          output: typeof output === 'string' ? JSON.parse(output) : output
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`獲取 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ V8.0 新增：等待 P2 批次 M0 Job 結果
 * @param {string} jobId - Job ID
 * @param {Object} params - 執行參數
 * @returns {Object|null} 批次結果
 */
function waitForM0JobResultP2(jobId, params) {
  try {
    const maxWaitTime = 180000;  // 180 秒
    const pollInterval = 2000;  // 2 秒
    const m0ExecuteInterval = 2000;  // 每 2 秒調用一次 M0_Execute()
    const startTime = Date.now();
    let lastM0ExecuteTime = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      const m0Result = getM0JobResult(jobId);
      
      if (m0Result && m0Result.output) {
        Logger.log(`P2 批次：M0 任務 ${jobId} 執行完成`);
        
        const finalOutput = m0Result.output || {};
        let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || {};
        let auditorOutput = finalOutput.auditor_output || finalOutput.auditor || finalOutput.audit_output || {};
        
        if (!executorOutput || Object.keys(executorOutput).length === 0) {
          executorOutput = finalOutput;
        }
        
        return {
          job_id: jobId,
          executor_output: executorOutput,
          auditor_output: auditorOutput,
          m0_result: m0Result
        };
      }
      
      // 定期調用 M0_Execute()
      if (Date.now() - lastM0ExecuteTime >= m0ExecuteInterval) {
        try {
          M0_Execute();
          lastM0ExecuteTime = Date.now();
        } catch (m0Error) {
          Logger.log(`P2 批次：調用 M0_Execute() 失敗：${m0Error.message}`);
        }
      }
      
      Utilities.sleep(pollInterval);
    }
    
    Logger.log(`P2 批次：M0 任務 ${jobId} 執行超時`);
    return null;
    
  } catch (error) {
    Logger.log(`P2 批次：等待 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ V8.0 新增：合併 P2 批次結果
 * @param {Array} batchResults - 所有批次結果
 * @param {Array} masterCandidates - 所有候選公司
 * @param {Object} financialData - 所有財務數據
 * @param {Object} params - 執行參數
 * @returns {Object} 合併後的結果
 */
function mergeP2BatchResults(batchResults, masterCandidates, financialData, params) {
  try {
    Logger.log(`P2：開始合併 ${batchResults.length} 個批次結果`);
    
    // 合併所有批次的執行者輸出和審查者輸出
    const mergedExecutorOutput = {
      financial_metrics: {},
      tier_assignments: {},
      peer_comparison_requests: {},
      gate_results: {}
    };
    
    const mergedAuditorOutput = {
      audit_notes: {},
      approved_assignments: {}
    };
    
    // 處理每個批次的結果
    for (const batchResult of batchResults) {
      if (batchResult.status === "ERROR") {
        Logger.log(`P2：批次 ${batchResult.batch_number} 處理失敗，跳過合併`);
        continue;
      }
      
      const executorOutput = batchResult.executor_output || {};
      const auditorOutput = batchResult.auditor_output || {};
      
      // 合併財務指標
      if (executorOutput.financial_metrics) {
        Object.assign(mergedExecutorOutput.financial_metrics, executorOutput.financial_metrics);
      }
      
      // 合併分層決策
      if (executorOutput.tier_assignments) {
        Object.assign(mergedExecutorOutput.tier_assignments, executorOutput.tier_assignments);
      }
      
      // 合併同業比較請求
      if (executorOutput.peer_comparison_requests) {
        Object.assign(mergedExecutorOutput.peer_comparison_requests, executorOutput.peer_comparison_requests);
      }
      
      // 合併 Gate 結果
      if (executorOutput.gate_results) {
        Object.assign(mergedExecutorOutput.gate_results, executorOutput.gate_results);
      }
      
      // 合併審查者輸出
      if (auditorOutput.audit_notes) {
        Object.assign(mergedAuditorOutput.audit_notes, auditorOutput.audit_notes);
      }
      
      if (auditorOutput.approved_assignments) {
        Object.assign(mergedAuditorOutput.approved_assignments, auditorOutput.approved_assignments);
      }
    }
    
    Logger.log(`P2：批次結果合併完成（${Object.keys(mergedExecutorOutput.tier_assignments).length} 家公司）`);
    
    // 構建合併後的 M0 Result Payload
    const mergedM0ResultPayload = {
      executor_output: mergedExecutorOutput,
      auditor_output: mergedAuditorOutput,
      master_candidates: masterCandidates,
      financial_data: financialData,
      frequency: params.frequency,
      trigger: params.trigger || "BATCH_PROCESSING"
    };
    
    // 使用主 job ID（第一個批次）
    const mainJobId = batchResults.length > 0 && batchResults[0].job_id ? 
      batchResults[0].job_id : 
      `P2_${params.frequency}_${Date.now()}`;
    
    // 調用 P2_ProcessM0Result 處理合併後的結果
    const p2Result = P2_ProcessM0Result(mainJobId, mergedM0ResultPayload);
    
    return {
      status: p2Result.status || "COMPLETED",
      job_id: mainJobId,
      snapshot_id: p2Result.snapshot_id,
      frequency: params.frequency,
      p2_result: p2Result,
      batch_count: batchResults.length
    };
    
  } catch (error) {
    Logger.log(`P2：合併批次結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 同業比較輔助函數（Stage 2）
// ==========================================

/**
 * 收集同業財務數據
 * @param {string} targetTicker - 目標公司代碼
 * @param {Array} peerCompanies - 同業公司列表
 * @param {string} dataSource - 數據來源
 * @param {Object} existingFinancialData - 已存在的財務數據
 * @return {Object} 同業財務數據
 */
function collectPeerFinancialData(targetTicker, peerCompanies, dataSource, existingFinancialData) {
  Logger.log(`P2 開始收集同業財務數據：目標=${targetTicker}, 同業=${peerCompanies.join(", ")}, 數據源=${dataSource}`);
  
  // ⭐⭐⭐ V8.0 修正：實現實際的 CSE 搜尋功能
  // 確保同業財務數據與目標公司來自同一數據源（符合 SSOT 統一數據源設計）
  const peerData = {};
  
  // 解析 dataSource 確定使用的 CSE 和市場
  // dataSource 格式可能是 "P2_US_TAIWAN_CSE" 或 "P2_JAPAN_CSE"
  let cseType;
  let market;
  
  if (dataSource && dataSource.includes("P2_US_TAIWAN")) {
    cseType = "P2_US_TAIWAN";
    // 無法從 dataSource 直接判斷市場，需要從其他來源判斷
    // 預設為 US，如果有 TW 的 ticker，需要額外判斷
    market = "US";  // 預設為 US，實際使用時會根據 ticker 判斷
  } else if (dataSource && dataSource.includes("P2_JAPAN")) {
    cseType = "P2_JAPAN";
    market = "JP";
  } else {
    // Fallback：嘗試從 dataSource 推斷
    cseType = "P2_US_TAIWAN";  // 預設使用 P2_US_TAIWAN
    market = "US";
  }
  
  for (const peerTicker of peerCompanies) {
    // 優先使用已存在的財務數據
    if (existingFinancialData[peerTicker]) {
      peerData[peerTicker] = existingFinancialData[peerTicker];
      Logger.log(`P2 同業 ${peerTicker}：使用已存在的財務數據`);
    } else {
      // ⭐⭐⭐ 實現實際的 CSE 搜尋
      try {
        // 判斷同業公司的市場
        let peerMarket = market;  // 預設使用目標公司的市場
        
        // 嘗試從 ticker 格式判斷市場（簡單判斷，可能需要改進）
        if (/^\d{4}$/.test(peerTicker) || peerTicker.toLowerCase().includes('.tw')) {
          // 可能是台股
          if (cseType === "P2_US_TAIWAN") {
            peerMarket = "TW";  // 使用台股收集函數
          }
        } else if (/^\d{4}$/.test(peerTicker) && !peerTicker.toLowerCase().includes('.tw')) {
          // 可能是日股
          if (cseType === "P2_JAPAN") {
            peerMarket = "JP";
          }
        } else {
          // 可能是美股
          peerMarket = "US";
        }
        
        // 根據市場和 CSE 類型選擇對應的收集函數
        let peerData_result = null;
        if (cseType === "P2_US_TAIWAN") {
          if (peerMarket === "TW") {
            peerData_result = collectTaiwanStockFinancialData(peerTicker, "MONTHLY");
          } else {
            peerData_result = collectUSStockFinancialData(peerTicker, "MONTHLY");
          }
        } else if (cseType === "P2_JAPAN") {
          peerData_result = collectJapanStockFinancialData(peerTicker, "MONTHLY");
        }
        
        if (peerData_result) {
          peerData[peerTicker] = peerData_result;
          Logger.log(`P2 同業 ${peerTicker}：成功從 CSE 收集財務數據（${cseType}）`);
        } else {
          // 如果收集失敗，返回空結構
          peerData[peerTicker] = {
            ticker: peerTicker,
            market: peerMarket,
            data_source: cseType + "_CSE",
            search_results: [],
            extracted: false,
            note: "CSE 搜尋未返回結果"
          };
          Logger.log(`P2 同業 ${peerTicker}：CSE 搜尋未返回結果`);
        }
      } catch (error) {
        Logger.log(`P2 同業 ${peerTicker}：CSE 搜尋失敗（${error.message}），返回空結構`);
        peerData[peerTicker] = {
          ticker: peerTicker,
          market: market,
          data_source: cseType + "_CSE",
          search_results: [],
          extracted: false,
          error: error.message,
          note: "CSE 搜尋失敗"
        };
      }
    }
  }
  
  Logger.log(`P2 同業財務數據收集完成：${Object.keys(peerData).length} 個同業`);
  return peerData;
}

/**
 * 計算相對位置
 * @param {string} targetTicker - 目標公司代碼
 * @param {Object} targetFinancialData - 目標公司財務數據
 * @param {Object} peerFinancialMetrics - 同業財務指標
 * @param {Object} peerFinancialData - 同業財務數據（備用）
 * @return {Object} 相對位置分析
 */
function calculateRelativePositions(targetTicker, targetFinancialData, peerFinancialMetrics, peerFinancialData) {
  Logger.log(`P2 計算 ${targetTicker} 的相對位置`);
  
  // ⭐ 測試模式：如果沒有真實數據，返回簡化結構
  const relativePositions = {
    revenue_yoy: "UNKNOWN",
    gross_margin: "UNKNOWN",
    operating_margin: "UNKNOWN",
    net_margin: "UNKNOWN",
    cfo: "UNKNOWN",
    fcf: "UNKNOWN",
    net_debt_ebitda: "UNKNOWN",
    roic: "UNKNOWN",
    current_ratio: "UNKNOWN"
  };
  
  // 在正式環境中，這裡應該：
  // 1. 提取目標公司和同業的財務指標
  // 2. 計算每個指標的排名（前段/中段/後段）
  // 3. 返回相對位置分析
  
  Logger.log(`P2 ${targetTicker} 相對位置計算完成（測試模式：簡化結構）`);
  return relativePositions;
}

/**
 * 判斷結構性優勢/弱勢
 * @param {Object} relativePositions - 相對位置分析
 * @return {Object} 結構性優勢判斷
 */
function judgeStructuralAdvantage(relativePositions) {
  // ⭐ 測試模式：返回簡化結構
  return {
    is_structural_leader: false,
    is_structural_laggard: false,
    reasoning: "測試模式：結構性優勢判斷未實現"
  };
}

/**
 * 判斷異質性風險
 * @param {string} targetTicker - 目標公司代碼
 * @param {Object} targetFinancialData - 目標公司財務數據
 * @param {Object} peerFinancialMetrics - 同業財務指標
 * @param {Object} peerFinancialData - 同業財務數據
 * @return {Object} 異質性風險判斷
 */
function judgeHeterogeneityRisk(targetTicker, targetFinancialData, peerFinancialMetrics, peerFinancialData) {
  // ⭐ 測試模式：返回簡化結構
  return {
    has_heterogeneity_risk: false,
    risk_type: null,
    reasoning: "測試模式：異質性風險判斷未實現"
  };
}

/**
 * 計算整體位置
 * @param {Object} relativePositions - 相對位置分析
 * @return {string} 整體位置（前段/中段/後段）
 */
function calculateOverallPosition(relativePositions) {
  // ⭐ 測試模式：返回中段
  // 在正式環境中，這裡應該基於多數指標的相對位置來判斷整體位置
  return "中段";
}
