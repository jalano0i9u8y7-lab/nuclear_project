/**
 * 🏢 P1: 產業鏈公司定位與結構分級（Industry Chain Tiering）
 * 
 * ⭐ V8.14 更新：兩階段執行 + Tier S/A/B/X 分級系統
 * 
 * 基於 P0、P0.5 和 P0.7 的輸出，建立公司池並進行結構分級
 * - Step 1：股票池生成（Gemini Flash 3.0）
 * - Step 2：結構分級（Gemini Pro 3.0）
 * 
 * Tier 分級系統（取代舊的三池分類）：
 * - Tier S：核心瓶頸/不可取代（Kingmaker）
 * - Tier A：高連動受益/次核心（Contender）
 * - Tier B：順風受益/邊緣紅利（Beneficiary）
 * - Tier X：結構性受害者（Victim/Squeezed）
 * 
 * @version V8.14
 * @date 2026-01-19
 */

// ==========================================
// P1 配置參數
// ==========================================

const P1_CONFIG = {
  // 執行頻率
  frequency: "QUARTERLY",  // 每季執行一次（與 P0、P0.7 同步）
  
  // 適配檢查權重
  fit_weights: {
    ENG_FIT: 0.40,        // 工程適配權重 40%
    STRUCT_FIT: 0.35,     // 結構適配權重 35%
    TIME_ROLE_FIT: 0.25   // 時間角色適配權重 25%
  },
  
  // 信心度閾值
  confidence_thresholds: {
    MASTER_CANDIDATES: 0.70,  // 正式候選池信心度閾值 70%
    TRACKING_POOL: 0.50,      // 追蹤池信心度閾值 50%
    REJECTION_POOL: 0.30      // 排除池信心度閾值 < 30%
  }
};

// ==========================================
// P1 核心函數
// ==========================================

/**
 * P1 主執行函數
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P0_7_UPDATE / QUARTERLY / MANUAL）
 * @param {Object} params.user_input - 用戶輸入（來自執行前確認）
 * @param {string} params.p0_7_snapshot_id - P0.7 快照 ID（可選，如果不提供則使用最新）
 * @param {string} params.p0_snapshot_id - P0 快照 ID（可選）
 * @return {Object} P1 分析結果
 */
function P1_Execute(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P1 執行開始：trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 檢查執行前確認
    // ========================================
    
    const jobId = params.job_id || `P1_${Date.now()}`;
    const confirmation = checkPreExecutionConfirmation(jobId, "P1", params.context || {});
    
    // ⭐ V8.17.1 新增：詳細日誌輸出
    Logger.log(`P1 執行前確認：requires_confirmation=${confirmation.requires_confirmation}, status=${confirmation.status}`);
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions("P1", params.context);
        const confirmationId = savePreExecutionQuestions(jobId, "P1", questions);
        
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
    // Step 2: 讀取 P0、P0.5 和 P0.7 快照 ⭐ V8.14 新增：加入 P0.5 繼承
    // ========================================
    
    let p0Snapshot, p0_5Snapshot, p0_7Snapshot;
    
    // 讀取 P0.7 快照
    if (params.p0_7_snapshot_id) {
      p0_7Snapshot = getP0_7SnapshotById(params.p0_7_snapshot_id);
    } else {
      p0_7Snapshot = getLatestP0_7Snapshot();
    }
    
    if (!p0_7Snapshot || !p0_7Snapshot.p0_7_output_json) {
      throw new Error("P0.7 快照不存在或缺少數據，請先執行 P0.7");
    }
    
    // 讀取 P0 快照
    if (params.p0_snapshot_id) {
      p0Snapshot = getP0SnapshotById(params.p0_snapshot_id);
    } else if (p0_7Snapshot.p0_snapshot_id) {
      p0Snapshot = getP0SnapshotById(p0_7Snapshot.p0_snapshot_id);
    } else {
      p0Snapshot = getLatestP0Snapshot();
    }
    
    if (!p0Snapshot || !p0Snapshot.p0_output_json) {
      throw new Error("P0 快照不存在或缺少數據，請先執行 P0");
    }
    
    // ⭐ V8.14 新增：讀取 P0.5 快照（產業鏈地圖）
    if (params.p0_5_snapshot_id) {
      p0_5Snapshot = getP0_5SnapshotById(params.p0_5_snapshot_id);
    } else {
      p0_5Snapshot = getLatestP0_5Snapshot();
    }
    
    if (!p0_5Snapshot || !p0_5Snapshot.p0_5_output_json) {
      throw new Error("P0.5 快照不存在或缺少數據，請先執行 P0.5");
    }
    
    const p0Output = typeof p0Snapshot.p0_output_json === 'string' ?
      JSON.parse(p0Snapshot.p0_output_json) : p0Snapshot.p0_output_json;
    const p0_5Output = typeof p0_5Snapshot.p0_5_output_json === 'string' ?
      JSON.parse(p0_5Snapshot.p0_5_output_json) : p0_5Snapshot.p0_5_output_json;
    const p0_7Output = typeof p0_7Snapshot.p0_7_output_json === 'string' ?
      JSON.parse(p0_7Snapshot.p0_7_output_json) : p0_7Snapshot.p0_7_output_json;
    
    // ========================================
    // Step 3: 準備 M0 Job 輸入
    // ========================================
    
    // ========================================
    // Step 3: 準備 M0 Job 輸入（兩階段執行）⭐ V8.14 更新
    // ========================================
    
    // ⭐ V8.14 更新：P1 改為兩階段執行
    // Step 1: 股票池生成（Gemini Flash 3.0）
    // Step 2: 結構分級（Gemini Pro 3.0）
    
    const m0InputPayload_Step1 = {
      phase: "P1_STEP1",
      trigger: params.trigger,
      user_input: userInput,
      p0_output: p0Output,
      p0_5_output: p0_5Output,  // ⭐ V8.14 新增：P0.5 產業鏈地圖
      p0_7_output: p0_7Output,
      p0_snapshot_id: p0Snapshot.snapshot_id,
      p0_5_snapshot_id: p0_5Snapshot.snapshot_id,  // ⭐ V8.14 新增
      p0_7_snapshot_id: p0_7Snapshot.snapshot_id,
      previous_snapshot: getLatestP1Snapshot(),
      context: params.context || {}
    };
    
    // 構建 P1 Step 1 專用的 Prompt（股票池生成）
    m0InputPayload_Step1.p1_step1_prompt = buildP1Step1Prompt(userInput, p0Output, p0_5Output, p0_7Output);
    
    // ========================================
    // Step 4: 提交 Step 1 到 M0 Job Queue
    // ========================================
    
    const requestedFlow_Step1 = [
      "EXECUTOR"  // Gemini Flash 3.0（股票池生成）
    ];
    
    const jobId_Step1 = submitToM0JobQueue("P1_STEP1", requestedFlow_Step1, m0InputPayload_Step1);
    Logger.log(`P1 V8.14：已提交 Step 1（股票池生成）到 M0 Job Queue，jobId=${jobId_Step1}`);
    
    // ⭐ V8.14 新增：等待 Step 1 完成（測試模式下自動執行）
    if (params.context && params.context.test_mode === true) {
      Logger.log(`P1 V8.14：測試模式，自動執行 Step 1，jobId=${jobId_Step1}`);
      
      // ⭐ V8.17.1 新增：立即調用 M0_Execute() 開始處理任務
      try {
        M0_Execute();
        Logger.log(`P1 V8.14：已調用 M0_Execute() 處理 Step 1 任務`);
      } catch (e) {
        Logger.log(`P1 V8.14：調用 M0_Execute() 時發生錯誤：${e.message}`);
      }
      
      // 輪詢 Step 1 結果
      const maxWaitTime = 120000;  // 120 秒
      const pollInterval = 2000;  // 2 秒
      const m0ExecuteInterval = 3000;  // 每 3 秒調用一次 M0_Execute()
      const startTime = Date.now();
      let lastM0ExecuteTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        // ⭐ V8.17.1 新增：定期調用 M0_Execute() 處理任務
        if (Date.now() - lastM0ExecuteTime >= m0ExecuteInterval) {
          try {
            M0_Execute();
            lastM0ExecuteTime = Date.now();
            Logger.log(`P1 V8.14：定期調用 M0_Execute() 處理任務（已等待 ${Math.floor((Date.now() - startTime) / 1000)} 秒）`);
          } catch (e) {
            Logger.log(`P1 V8.14：調用 M0_Execute() 時發生錯誤：${e.message}`);
          }
        }
        
        const m0Result_Step1 = getM0JobResult(jobId_Step1);
        
        // ⭐ V8.17.4 修正：檢查結果，但不要因為 output 為 null 就失敗
        if (m0Result_Step1) {
          Logger.log(`P1 V8.17.4：getM0JobResult 返回結果，output 存在=${!!m0Result_Step1.output}, output 類型=${typeof m0Result_Step1.output}`);
          if (m0Result_Step1.output && typeof m0Result_Step1.output === 'object') {
            Logger.log(`P1 V8.17.4：output 鍵=${Object.keys(m0Result_Step1.output).slice(0, 10).join(", ")}`);
          } else if (!m0Result_Step1.output) {
            Logger.log(`P1 V8.17.4：警告：getM0JobResult 返回的 output 為空，可能是表格欄位問題`);
          }
        } else {
          Logger.log(`P1 V8.17.4：getM0JobResult 返回 null（未找到記錄）`);
        }
        
        // ⭐ V8.17.4 修正：必須有 output 且不為 null/undefined
        if (m0Result_Step1 && m0Result_Step1.output !== null && m0Result_Step1.output !== undefined) {
          Logger.log(`P1 V8.14：Step 1 執行完成，開始處理結果`);
          Logger.log(`P1 V8.14：m0Result_Step1.output 類型=${typeof m0Result_Step1.output}, 鍵=${m0Result_Step1.output ? Object.keys(m0Result_Step1.output).slice(0, 10).join(", ") : "null"}`);
          
          // 處理 Step 1 結果（包含財報下載和提取）
          const step1Result = P1_ProcessStep1Result(jobId_Step1, m0Result_Step1, params);
          
          Logger.log(`P1 V8.14：Step 1 結果處理完成，step1Result.status=${step1Result.status || "未知"}`);
          Logger.log(`P1 V8.14：Step 1 生成 ${(step1Result.company_pool || []).length} 檔公司`);
          
          // ⭐ 新增：檢查是否需要等待台股/日股人工下載
          const hasPendingReports = step1Result.financial_report_status && 
            (step1Result.financial_report_status.tw_companies.pending > 0 || 
             step1Result.financial_report_status.jp_companies.pending > 0);
          
          if (hasPendingReports) {
            Logger.log(`P1 V8.14：有 ${step1Result.financial_report_status.tw_companies.pending + step1Result.financial_report_status.jp_companies.pending} 檔台股/日股待人工下載`);
            return {
              status: "WAITING_FOR_MANUAL_DOWNLOAD",
              step1_result: step1Result,
              message: "請完成台股/日股 PDF 下載後，執行 P1_ScanAndExtractDrivePDFs() 進行提取"
            };
          }
          
          // ⭐ V8.17.4 新增：檢查是否只執行 Step 1
          if (params.step === 1) {
            Logger.log(`P1 V8.17.4：只執行 Step 1，跳過 Step 2`);
            return step1Result;
          }
          
          // 繼續執行 Step 2
          Logger.log(`P1 V8.14：開始執行 Step 2（結構分級）`);
          return P1_ExecuteStep2(step1Result, {
            ...params,
            p0_snapshot_id: p0Snapshot.snapshot_id,
            p0_5_snapshot_id: p0_5Snapshot.snapshot_id,
            p0_7_snapshot_id: p0_7Snapshot.snapshot_id
          });
        }
        
        // 檢查任務狀態
        const jobStatus = checkM0JobStatus(jobId_Step1);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        // ⭐ V8.17.4 新增：如果任務狀態是 DONE 但結果還沒讀到，添加重試邏輯
        if (jobStatus === "DONE" && (!m0Result_Step1 || !m0Result_Step1.output)) {
          Logger.log(`P1 V8.17.4：任務狀態為 DONE，但結果尚未讀取，開始重試...`);
          let retryCount = 0;
          const maxRetries = 10;  // 最多重試 10 次
          const retryDelay = 1000;  // 每次重試間隔 1 秒
          
          while (retryCount < maxRetries) {
            Utilities.sleep(retryDelay);
            retryCount++;
            
            const m0ResultRetry = getM0JobResult(jobId_Step1);
            if (m0ResultRetry && m0ResultRetry.output) {
              Logger.log(`P1 V8.17.4：Step 1 執行完成（從 DONE 狀態檢測到結果，重試 ${retryCount} 次）`);
              Logger.log(`P1 V8.17.4：m0ResultRetry.output 類型=${typeof m0ResultRetry.output}, 鍵=${m0ResultRetry.output ? Object.keys(m0ResultRetry.output).slice(0, 10).join(", ") : "null"}`);
              
              // 處理 Step 1 結果
              const step1Result = P1_ProcessStep1Result(jobId_Step1, m0ResultRetry, params);
              
              Logger.log(`P1 V8.14：Step 1 結果處理完成，step1Result.status=${step1Result.status || "未知"}`);
              Logger.log(`P1 V8.14：Step 1 生成 ${(step1Result.company_pool || []).length} 檔公司`);
              
              // ⭐ V8.17.4 新增：檢查是否只執行 Step 1
              if (params.step === 1) {
                Logger.log(`P1 V8.17.4：只執行 Step 1，跳過 Step 2`);
                return step1Result;
              }
              
              // 繼續執行 Step 2
              Logger.log(`P1 V8.14：開始執行 Step 2（結構分級）`);
              return P1_ExecuteStep2(step1Result, {
                ...params,
                p0_snapshot_id: p0Snapshot.snapshot_id,
                p0_5_snapshot_id: p0_5Snapshot.snapshot_id,
                p0_7_snapshot_id: p0_7Snapshot.snapshot_id
              });
            }
            
            Logger.log(`P1 V8.17.4：重試 ${retryCount}/${maxRetries}：結果尚未寫入 M0__RESULT，繼續等待...`);
          }
          
          // 如果重試多次還是沒有結果，記錄錯誤但繼續正常輪詢流程
          Logger.log(`P1 V8.17.4：任務狀態為 DONE 但重試 ${maxRetries} 次仍未找到結果，繼續輪詢...`);
        }
        
        Logger.log(`P1 V8.14：輪詢中，job_id=${jobId_Step1}, status=${jobStatus}, 已等待=${elapsed}秒, m0Result=${m0Result_Step1 ? "存在" : "null"}`);
        
        Utilities.sleep(pollInterval);
      }
      
      throw new Error(`P1 Step 1 執行超時（已等待 ${Math.floor(maxWaitTime / 1000)} 秒）`);
    }
    
    // 非測試模式：返回 SUBMITTED 狀態
    return {
      status: "SUBMITTED",
      job_id_step1: jobId_Step1,
      message: "P1 Step 1（股票池生成）已提交到 M0，請執行 M0_Execute() 處理，完成後再執行 P1_ExecuteStep2()"
    };
    
    // ========================================
    // Step 5: 提交到 M0 Job Queue
    // ========================================
    
    const jobId_final = submitToM0JobQueue("P1", requestedFlow, m0InputPayload);
    
    // ⭐ V8.0 新增：測試模式下自動執行 M0 並輪詢結果
    // ⚠️ 測試階段邏輯：只處理本次提交的任務，不管隊列中的舊任務
    // 前一個任務確定跑通才會進到下一個，所以確保能讀到上一個階段的結果就好
    if (params.context && params.context.test_mode === true) {
      Logger.log(`P1：自動執行 M0 處理任務 ${jobId_final}`);
      
      try {
        // ⚠️ 測試模式：直接調用 M0_Execute()，但只處理本次提交的任務
        // 因為 M0_Execute() 會處理第一個 "NEW" 任務，所以需要確保本次任務是第一個
        // 但測試階段可能有舊任務殘留，所以我們採用輪詢方式，持續調用 M0_Execute()
        // 直到本次任務完成
        
        // 輪詢 M0 結果（最多等待 120 秒）
        const maxWaitTime = 120000;  // 120 秒
        const pollInterval = 2000;  // 2 秒
        const m0ExecuteInterval = 3000;  // 每 3 秒調用一次 M0_Execute()（測試階段頻繁調用以處理本次任務）
        const startTime = Date.now();
        let lastM0ExecuteTime = 0;
        
        while (Date.now() - startTime < maxWaitTime) {
          // 優先檢查 M0__RESULT 中是否有本次任務的結果
          const m0Result = getM0JobResult(jobId_final);
          
          if (m0Result && m0Result.output) {
            Logger.log(`P1：M0 任務 ${jobId_final} 執行完成`);
            Logger.log(`P1：解析 M0 結果，output 類型=${typeof m0Result.output}`);
            
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
              p0_output: p0Output,
              p0_7_output: p0_7Output,
              p0_snapshot_id: p0Snapshot.snapshot_id,
              p0_7_snapshot_id: p0_7Snapshot.snapshot_id,
              trigger: params.trigger || "LIGHT_TEST"
            };
            
            // 調用處理函數
            const p1Result = P1_ProcessM0Result(jobId_final, m0ResultPayload);
            
            return {
              status: p1Result.status || "COMPLETED",
              job_id: jobId_final,
              snapshot_id: p1Result.snapshot_id,
              p1_result: p1Result
            };
          }
          
          // 檢查本次任務的狀態
          const jobStatus = checkM0JobStatus(jobId_final);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          Logger.log(`P1：輪詢中，job_id=${jobId_final}, status=${jobStatus}, 已等待=${elapsed}秒`);
          
          if (jobStatus === "DONE") {
            // 任務已完成，但結果可能還沒寫入 M0__RESULT，多次重試
            Logger.log(`P1：任務狀態為 DONE，多次重試檢查結果...`);
            let retryCount = 0;
            const maxRetries = 10;  // 最多重試 10 次
            const retryDelay = 1000;  // 每次重試間隔 1 秒
            
            while (retryCount < maxRetries) {
              Utilities.sleep(retryDelay);
              retryCount++;
              
              const m0ResultRetry = getM0JobResult(jobId_final);
              // ⭐ V8.17.4 修正：必須有 output 且不為 null/undefined
              if (m0ResultRetry && m0ResultRetry.output !== null && m0ResultRetry.output !== undefined) {
                Logger.log(`P1：M0 任務 ${jobId_final} 執行完成（從 DONE 狀態檢測到結果，重試 ${retryCount} 次）`);
                Logger.log(`P1：解析 M0 結果，output 類型=${typeof m0ResultRetry.output}`);
                
                const finalOutput = m0ResultRetry.output || {};
                let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || {};
                let auditorOutput = finalOutput.auditor_output || finalOutput.auditor || finalOutput.audit_output || {};
                
                if (!executorOutput || Object.keys(executorOutput).length === 0) {
                  executorOutput = finalOutput;
                }
                
                const m0ResultPayload = {
                  executor_output: executorOutput,
                  auditor_output: auditorOutput,
                  p0_output: p0Output,
                  p0_7_output: p0_7Output,
                  p0_snapshot_id: p0Snapshot.snapshot_id,
                  p0_7_snapshot_id: p0_7Snapshot.snapshot_id,
                  trigger: params.trigger || "LIGHT_TEST"
                };
                
                // 調用處理函數
                const p1Result = P1_ProcessM0Result(jobId_final, m0ResultPayload);
                
                return {
                  status: p1Result.status || "COMPLETED",
                  job_id: jobId_final,
                  snapshot_id: p1Result.snapshot_id,
                  p1_result: p1Result
                };
              }
              
              if (m0ResultRetry && (m0ResultRetry.output === null || m0ResultRetry.output === undefined)) {
                Logger.log(`P1 V8.17.4：重試 ${retryCount}/${maxRetries}：找到記錄但 output 為空，可能是表格欄位問題，繼續等待...`);
              } else {
                Logger.log(`P1 V8.17.4：重試 ${retryCount}/${maxRetries}：結果尚未寫入 M0__RESULT，繼續等待...`);
              }
            }
            
            // 如果重試多次還是沒有結果，繼續正常輪詢流程
            Logger.log(`P1 V8.17.4：任務狀態為 DONE 但重試 ${maxRetries} 次仍未找到有效結果，繼續輪詢...`);
            continue;
          } else if (jobStatus === "ERROR") {
            throw new Error("M0 任務執行失敗，請檢查 M0__JOB_QUEUE");
          } else if (jobStatus === null) {
            // 任務不存在於隊列中，可能是已經完成並從隊列中移除
            // 這種情況下，結果應該已經在 M0__RESULT 中，如果沒有可能是任務還沒開始
            Logger.log(`P1：任務 ${jobId_final} 不在 M0__JOB_QUEUE 中，可能已完成或尚未提交`);
            // 繼續等待並檢查結果
          } else if (jobStatus === "RUNNING") {
            Logger.log(`P1：任務正在執行中，繼續等待...`);
          } else if (jobStatus === "NEW") {
            Logger.log(`P1：任務仍在隊列中等待處理，繼續調用 M0_Execute()...`);
          }
          
          // 持續調用 M0_Execute() 處理隊列中的任務（包括本次任務和可能殘留的舊任務）
          // ⚠️ 測試階段：可能有舊任務殘留，但我們持續調用 M0_Execute()，它會按順序處理
          // 只要本次任務最終完成就行
          const now = Date.now();
          if (now - lastM0ExecuteTime >= m0ExecuteInterval) {
            try {
              M0_Execute();  // 處理隊列中的任務（可能包括舊任務，但最終會處理到本次任務）
              lastM0ExecuteTime = now;
              Logger.log(`P1：已調用 M0_Execute() 處理隊列中的任務`);
            } catch (e) {
              Logger.log(`P1：調用 M0_Execute() 時發生錯誤：${e.message}，繼續輪詢...`);
            }
          }
          
          Utilities.sleep(pollInterval);
        }
        
        // 超時，返回 SUBMITTED 狀態
        Logger.log(`P1：M0 執行超時，請稍後手動檢查結果`);
        return {
          status: "SUBMITTED",
          job_id: jobId_final,
          message: `P1 任務已提交到 M0，但執行超時（等待 ${maxWaitTime/1000} 秒），請稍後手動執行 M0_Execute() 或檢查 M0__RESULT`
        };
      } catch (error) {
        Logger.log(`P1：M0 執行失敗：${error.message}`);
        return {
          status: "SUBMITTED",
          job_id: jobId_final,
          message: `P1 任務已提交到 M0，但執行時發生錯誤：${error.message}，請手動執行 M0_Execute() 重試`
        };
      }
    }
    
    return {
      status: "SUBMITTED",
      job_id: jobId_final,
      message: "P1 任務已提交到 M0 Job Queue，請等待執行完成"
    };
    
  } catch (error) {
    Logger.log(`P1 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P1 M0 執行結果（由 M0 調用）
 * @param {string} jobId - 任務 ID
 * @param {Object} m0Result - M0 執行結果
 * @return {Object} P1 處理結果
 */
function P1_ProcessM0Result(jobId, m0Result) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P1 處理 M0 結果：jobId=${jobId}`);
    
    // ========================================
    // Step 1: 解析 M0 結果
    // ========================================
    
    let executorOutput = m0Result.executor_output || {};
    let auditorOutput = m0Result.auditor_output || {};
    let p0Output = m0Result.p0_output || {};
    let p0_7Output = m0Result.p0_7_output || {};
    // ⭐ 機構級數據已移至 P2.5 模組
    
    // ⭐ 修正：如果 executorOutput 是字符串，嘗試解析為 JSON
    if (typeof executorOutput === 'string') {
      try {
        let jsonString = executorOutput.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        executorOutput = JSON.parse(jsonString);
        Logger.log(`P1 調試：成功解析 executorOutput 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P1 調試：無法解析 executorOutput 字符串：${e.message}`);
      }
    }
    
    // ⭐ 修正：如果 auditorOutput 是字符串，嘗試解析為 JSON
    if (typeof auditorOutput === 'string') {
      try {
        let jsonString = auditorOutput.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        auditorOutput = JSON.parse(jsonString);
        Logger.log(`P1 調試：成功解析 auditorOutput 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P1 調試：無法解析 auditorOutput 字符串：${e.message}`);
      }
    }
    
    // ⭐ 調試日誌：檢查 AI 輸出格式
    Logger.log(`P1 調試：executorOutput 類型=${typeof executorOutput}, 是否有 master_candidates=${!!executorOutput.master_candidates}`);
    if (executorOutput.master_candidates) {
      Logger.log(`P1 調試：executorOutput.master_candidates 數量=${executorOutput.master_candidates.length || 0}`);
    } else {
      Logger.log(`P1 調試：executorOutput 鍵=${Object.keys(executorOutput).join(", ")}`);
      // 嘗試從其他可能的鍵提取
      if (executorOutput.company_pool_analysis) {
        Logger.log(`P1 調試：找到 company_pool_analysis`);
      }
      if (executorOutput.company_analysis) {
        Logger.log(`P1 調試：找到 company_analysis`);
      }
    }
    
    // ========================================
    // Step 2: 生成 P1 輸出結構（純學術分析，不包含機構級數據）
    // ========================================
    
    const p1Output = generateP1Output(executorOutput, auditorOutput);
    
    // ⭐ 調試日誌：檢查生成的 p1Output
    Logger.log(`P1 調試：p1Output.master_candidates 數量=${(p1Output.master_candidates || []).length}`);
    Logger.log(`P1 調試：p1Output.tracking_pool 數量=${(p1Output.tracking_pool || []).length}`);
    Logger.log(`P1 調試：p1Output.rejection_pool 數量=${(p1Output.rejection_pool || []).length}`);
    
    // ========================================
    // Step 4: 保存到三個池（Master_Candidates, Tracking_Pool, Rejection_Pool）
    // ========================================
    
    const poolResults = saveToPools(p1Output);
    
    // ⭐ 調試日誌：檢查保存結果
    Logger.log(`P1 調試：poolResults=${JSON.stringify(poolResults)}`);
    
    // ========================================
    // Step 5: 保存快照
    // ========================================
    
    const snapshot = saveP1Snapshot({
      job_id: jobId,
      trigger: m0Result.trigger || "QUARTERLY",
      p1_output: p1Output,
      pool_results: poolResults,
      p0_snapshot_id: m0Result.p0_snapshot_id,
      p0_7_snapshot_id: m0Result.p0_7_snapshot_id,
      changes: compareWithPreviousSnapshotP1(p1Output)
    });
    
    // ========================================
    // Step 6: 檢查是否需要觸發下游
    // ========================================
    
    if (snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P2
      triggerDownstreamPhasesP1("P1", snapshot);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P1 處理完成：snapshot_id=${snapshot.snapshot_id}, 耗時=${duration}ms`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p1_output: p1Output,
      pool_results: poolResults,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P1 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 機構級視角整合
// ==========================================

// ⭐ 機構級數據分析已移至 P2.5 模組
// P1 專注於挑選符合 P0 結論的公司（純學術分析）

// ==========================================
// P1 輸出生成
// ==========================================

/**
 * 生成 P1 輸出結構
 * ⭐ 修正：從 executorOutput 中正確提取數據
 */
function generateP1Output(executorOutput, auditorOutput) {
  // ⭐ 修正：executorOutput 可能直接包含 master_candidates，或者包含在嵌套對象中
  let masterCandidates = [];
  let trackingPool = [];
  let rejectionPool = [];
  
  // 嘗試多種可能的數據結構
  if (executorOutput.master_candidates) {
    masterCandidates = Array.isArray(executorOutput.master_candidates) ? executorOutput.master_candidates : [];
  } else if (executorOutput.company_pool_analysis && executorOutput.company_pool_analysis.master_candidates) {
    masterCandidates = Array.isArray(executorOutput.company_pool_analysis.master_candidates) ? 
      executorOutput.company_pool_analysis.master_candidates : [];
  } else if (executorOutput.company_analysis && executorOutput.company_analysis.master_candidates) {
    masterCandidates = Array.isArray(executorOutput.company_analysis.master_candidates) ? 
      executorOutput.company_analysis.master_candidates : [];
  }
  
  if (executorOutput.tracking_pool) {
    trackingPool = Array.isArray(executorOutput.tracking_pool) ? executorOutput.tracking_pool : [];
  } else if (executorOutput.company_pool_analysis && executorOutput.company_pool_analysis.tracking_pool) {
    trackingPool = Array.isArray(executorOutput.company_pool_analysis.tracking_pool) ? 
      executorOutput.company_pool_analysis.tracking_pool : [];
  } else if (executorOutput.company_analysis && executorOutput.company_analysis.tracking_pool) {
    trackingPool = Array.isArray(executorOutput.company_analysis.tracking_pool) ? 
      executorOutput.company_analysis.tracking_pool : [];
  }
  
  if (executorOutput.rejection_pool) {
    rejectionPool = Array.isArray(executorOutput.rejection_pool) ? executorOutput.rejection_pool : [];
  } else if (executorOutput.company_pool_analysis && executorOutput.company_pool_analysis.rejection_pool) {
    rejectionPool = Array.isArray(executorOutput.company_pool_analysis.rejection_pool) ? 
      executorOutput.company_pool_analysis.rejection_pool : [];
  } else if (executorOutput.company_analysis && executorOutput.company_analysis.rejection_pool) {
    rejectionPool = Array.isArray(executorOutput.company_analysis.rejection_pool) ? 
      executorOutput.company_analysis.rejection_pool : [];
  }
  
  Logger.log(`P1 generateP1Output：提取到 master_candidates=${masterCandidates.length}, tracking_pool=${trackingPool.length}, rejection_pool=${rejectionPool.length}`);
  
  return {
    master_candidates: masterCandidates,
    tracking_pool: trackingPool,
    rejection_pool: rejectionPool,
    auditor_review: auditorOutput.audit_review || auditorOutput.review || null,
    confidence_level: auditorOutput.confidence || auditorOutput.confidence_level || 0.7,
    summary: {
      master_candidates_count: masterCandidates.length,
      tracking_pool_count: trackingPool.length,
      rejection_pool_count: rejectionPool.length
    },
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// 保存到池
// ==========================================

/**
 * 保存到三個池（Master_Candidates, Tracking_Pool, Rejection_Pool）
 */
function saveToPools(p1Output) {
  const results = {
    master_candidates_saved: 0,
    tracking_pool_saved: 0,
    rejection_pool_saved: 0,
    errors: []
  };
  
  try {
    Logger.log(`P1 saveToPools：開始保存，master_candidates=${(p1Output.master_candidates || []).length}, tracking_pool=${(p1Output.tracking_pool || []).length}, rejection_pool=${(p1Output.rejection_pool || []).length}`);
    
    // 保存到 Master_Candidates
    if (p1Output.master_candidates && p1Output.master_candidates.length > 0) {
      Logger.log(`P1 saveToPools：準備保存 ${p1Output.master_candidates.length} 筆 Master_Candidates`);
      results.master_candidates_saved = saveMasterCandidates(p1Output.master_candidates);
      Logger.log(`P1 saveToPools：已保存 ${results.master_candidates_saved} 筆 Master_Candidates`);
    } else {
      Logger.log(`P1 saveToPools：跳過 Master_Candidates（數量為 0 或不存在）`);
    }
    
    // 保存到 Tracking_Pool
    if (p1Output.tracking_pool && p1Output.tracking_pool.length > 0) {
      Logger.log(`P1 saveToPools：準備保存 ${p1Output.tracking_pool.length} 筆 Tracking_Pool`);
      results.tracking_pool_saved = saveTrackingPool(p1Output.tracking_pool);
      Logger.log(`P1 saveToPools：已保存 ${results.tracking_pool_saved} 筆 Tracking_Pool`);
    } else {
      Logger.log(`P1 saveToPools：跳過 Tracking_Pool（數量為 0 或不存在）`);
    }
    
    // 保存到 Rejection_Pool
    if (p1Output.rejection_pool && p1Output.rejection_pool.length > 0) {
      Logger.log(`P1 saveToPools：準備保存 ${p1Output.rejection_pool.length} 筆 Rejection_Pool`);
      results.rejection_pool_saved = saveRejectionPool(p1Output.rejection_pool);
      Logger.log(`P1 saveToPools：已保存 ${results.rejection_pool_saved} 筆 Rejection_Pool`);
    } else {
      Logger.log(`P1 saveToPools：跳過 Rejection_Pool（數量為 0 或不存在）`);
    }
    
  } catch (error) {
    Logger.log(`保存到池失敗：${error.message}`);
    Logger.log(`保存到池失敗堆疊：${error.stack || "無"}`);
    results.errors.push(error.message);
  }
  
  return results;
}

/**
 * 保存到 Master_Candidates
 */
function saveMasterCandidates(candidates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Phase1_Master_Candidates");
  
  if (!sheet) {
    sheet = ss.insertSheet("Phase1_Master_Candidates");
    sheet.appendRow(PHASE1_MASTER_CANDIDATES_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  let savedCount = 0;
  const headers = PHASE1_MASTER_CANDIDATES_SCHEMA.headers;
  const now = new Date();
  
  for (const candidate of candidates) {
    try {
      // 檢查是否已存在（根據 Theme_ID + Company_Code）
      const existingRow = findExistingRow(sheet, candidate.theme_id, candidate.company_code);
      
      if (existingRow > 0) {
        // 更新現有記錄
        updateMasterCandidateRow(sheet, existingRow, candidate, headers, now);
      } else {
        // 新增記錄
        appendMasterCandidateRow(sheet, candidate, headers, now);
        savedCount++;
      }
    } catch (error) {
      Logger.log(`保存 Master Candidate 失敗：${error.message}`);
    }
  }
  
  Logger.log(`P1 Master_Candidates 已保存 ${savedCount} 筆新記錄`);
  return savedCount;
}

/**
 * 保存到 Tracking_Pool
 */
function saveTrackingPool(trackingList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Phase1_Tracking_Pool");
  
  if (!sheet) {
    sheet = ss.insertSheet("Phase1_Tracking_Pool");
    sheet.appendRow(PHASE1_TRACKING_POOL_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  let savedCount = 0;
  const headers = PHASE1_TRACKING_POOL_SCHEMA.headers;
  const now = new Date();
  
  for (const tracking of trackingList) {
    try {
      const existingRow = findExistingRow(sheet, tracking.theme_id, tracking.company_code);
      
      if (existingRow > 0) {
        updateTrackingPoolRow(sheet, existingRow, tracking, headers, now);
      } else {
        appendTrackingPoolRow(sheet, tracking, headers, now);
        savedCount++;
      }
    } catch (error) {
      Logger.log(`保存 Tracking Pool 記錄失敗：${error.message}`);
    }
  }
  
  Logger.log(`P1 Tracking_Pool 已保存 ${savedCount} 筆新記錄`);
  return savedCount;
}

/**
 * 保存到 Rejection_Pool
 */
function saveRejectionPool(rejections) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Phase1_Rejection_Pool");
  
  if (!sheet) {
    sheet = ss.insertSheet("Phase1_Rejection_Pool");
    sheet.appendRow(PHASE1_REJECTION_POOL_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  let savedCount = 0;
  const headers = PHASE1_REJECTION_POOL_SCHEMA.headers;
  const now = new Date();
  
  for (const rejection of rejections) {
    try {
      // Rejection_Pool 通常是新增（Append-only），不會更新
      appendRejectionPoolRow(sheet, rejection, headers, now);
      savedCount++;
    } catch (error) {
      Logger.log(`保存 Rejection Pool 記錄失敗：${error.message}`);
    }
  }
  
  Logger.log(`P1 Rejection_Pool 已保存 ${savedCount} 筆新記錄`);
  return savedCount;
}

// ==========================================
// 輔助函數：行操作
// ==========================================

/**
 * 查找現有行（根據 Theme_ID + Company_Code）
 */
function findExistingRow(sheet, themeId, companyCode) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const themeIdCol = headers.indexOf("Theme_ID");
  const companyCodeCol = headers.indexOf("Company_Code");
  
  if (themeIdCol === -1 || companyCodeCol === -1) {
    return -1;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][themeIdCol] === themeId && rows[i][companyCodeCol] === companyCode) {
      return i + 1;  // 返回行號（1-based）
    }
  }
  
  return -1;
}

/**
 * 新增 Master Candidate 行
 */
function appendMasterCandidateRow(sheet, candidate, headers, now) {
  const row = [];
  
  for (const header of headers) {
    const key = header.toLowerCase().replace(/_/g, "_");
    if (header === "created_at" || header === "updated_at") {
      row.push(now);
    } else {
      row.push(candidate[key] || candidate[header] || "");
    }
  }
  
  sheet.appendRow(row);
}

/**
 * 更新 Master Candidate 行
 */
function updateMasterCandidateRow(sheet, rowNum, candidate, headers, now) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const key = header.toLowerCase().replace(/_/g, "_");
    
    if (header === "updated_at") {
      sheet.getRange(rowNum, i + 1).setValue(now);
    } else if (header !== "created_at") {
      // 不更新 created_at
      const value = candidate[key] || candidate[header] || "";
      sheet.getRange(rowNum, i + 1).setValue(value);
    }
  }
}

/**
 * 新增 Tracking Pool 行
 */
function appendTrackingPoolRow(sheet, tracking, headers, now) {
  const row = [];
  
  for (const header of headers) {
    const key = header.toLowerCase().replace(/_/g, "_");
    if (header === "created_at" || header === "updated_at") {
      row.push(now);
    } else {
      row.push(tracking[key] || tracking[header] || "");
    }
  }
  
  sheet.appendRow(row);
}

/**
 * 更新 Tracking Pool 行
 */
function updateTrackingPoolRow(sheet, rowNum, tracking, headers, now) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const key = header.toLowerCase().replace(/_/g, "_");
    
    if (header === "updated_at") {
      sheet.getRange(rowNum, i + 1).setValue(now);
    } else if (header !== "created_at") {
      const value = tracking[key] || tracking[header] || "";
      sheet.getRange(rowNum, i + 1).setValue(value);
    }
  }
}

/**
 * 新增 Rejection Pool 行
 */
function appendRejectionPoolRow(sheet, rejection, headers, now) {
  const row = [];
  
  for (const header of headers) {
    const key = header.toLowerCase().replace(/_/g, "_");
    if (header === "created_at") {
      row.push(now);
    } else {
      row.push(rejection[key] || rejection[header] || "");
    }
  }
  
  sheet.appendRow(row);
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建 P1 公司池建立 Prompt
 */
function buildP1Prompt(userInput, p0Output, p0_7Output) {
  // ⭐ 測試模式：限制公司數量 ⭐ V8.0 新增
  const isTestMode = (userInput && userInput.test_mode === true) || 
                     (userInput && userInput.context && userInput.context.test_mode === true);
  const companiesPerTheme = (userInput && userInput.companies_per_theme) ||
                           (userInput && userInput.context && userInput.context.companies_per_theme) ||
                           10;  // 測試模式預設每個主題 10 間公司（兩個產業面各 10 間，總共 20 間）
  
  const testModeSection = isTestMode ? `
## ⭐⭐⭐ 測試模式限制 ⭐⭐⭐

**⚠️ 重要：這是測試模式，必須嚴格遵守以下限制：**

- **每個 Theme/Subtheme 最多產出 ${companiesPerTheme} 間公司到 Master_Candidates**
- 必須選擇**最符合三層對位檢查**的公司（優先選擇三層全部 Pass 的公司）
- 如果符合條件的公司超過 ${companiesPerTheme} 間，只選擇最符合條件的 ${companiesPerTheme} 間
- 其他符合條件的公司可以放入 Tracking_Pool（但測試模式下 Tracking_Pool 也應限制數量）

**測試目的**：驗證 prompt 有效程度，不需要產出所有符合條件的公司。

---` : '';
  
  return `
你是一位資深的投資分析師，負責進行 Nuclear Project 的 Phase 1 分析。

## ⭐⭐⭐ 核心任務定位

**Phase 1 的任務是建立「公司池」，不是選股。**

在 P0（必然性）＋P0.7（時間與槓桿角色）的裁決下，**只把「角色對位正確」的公司放進正式候選池。**
${testModeSection}

## P0 輸入（必然位置表）

### 主題列表
${JSON.stringify(p0Output.themes || [], null, 2)}

### 子主題列表
${JSON.stringify(p0Output.subthemes || [], null, 2)}

**⚠️ 重要：P0 已確認這些 Theme/Subtheme 的「必然性」，包含：**
- Problem_OneLiner（工程/結構問題一句話）
- Failure_Mode（不用會怎樣）
- No_Alternative_Reason（為何不可替代）
- Convergence_Evidence（工程/制度/行為收斂證據）
- Long_Term_Time_Window（3-10 年窗口）

## P0.7 輸入（系統動力學分析）

### 主題系統動力學分析
${JSON.stringify(p0_7Output.themes || [], null, 2)}

**⚠️ 重要：P0.7 已裁決每個 Theme/Subtheme 的：**
- Dynamic_Problem_OneLiner（動態性問題一句話）
- Loop_Dominance（R/B/Mixed）
- Time_Position（Early/Mid/Late/Transition）
- Leveraged_Role_Type（槓桿點角色類型，不是公司名）
- Risk_Note（若跳過 P0.7 最可能犯的錯）

---

## P1-2 三層對位檢查（操作級，逐條寫死）

**⚠️ 重要：必須按照以下順序完成三層對位檢查，逐條回答並輸出，不得跳步。**

---

### 第一層：工程對位檢查（ENG Fit）

**必須回答並輸出以下 5 個問題，缺一不可：**

#### 問題 1：公司提供的產品/技術/材料/製程是否直接對應 Subtheme？
- 必須明確說明：公司的核心產品/技術/材料/製程是否直接對應 P0 中該 Subtheme 的 Problem_OneLiner？
- 輸出要求：是/否 + 具體說明

#### 問題 2：若不用該公司產品，工程上是否有可 scale 替代？
- 必須明確說明：如果不用該公司的產品/技術/材料/製程，是否存在可 scale（可擴展）的替代方案？
- 輸出要求：是/否 + 替代方案說明（如果存在）

#### 問題 3：是否符合 P0-ENG 的失效模式？
- 必須明確說明：該公司的產品/技術是否符合 P0-ENG 中該 Subtheme 的 Failure_Mode（物理失效模式）？
- 輸出要求：是/否 + 符合哪些失效模式

#### 問題 4：是否符合工程收斂方向（標準/Roadmap）？
- 必須明確說明：該公司的技術路線是否符合 P0-ENG 中該 Subtheme 的 Convergence_Evidence（工程收斂證據，如標準/Roadmap）？
- 輸出要求：是/否 + 收斂證據說明

#### 問題 5：是否存在不可逆 lock-in（客戶換供應商代價高）？
- 必須明確說明：客戶如果換掉該供應商，代價是否極高（不可逆 lock-in）？
- 輸出要求：是/否 + lock-in 原因說明

**不通過條件（任一成立即不得進正式候選池）：**
- ❌ 只是「沾邊」：產品可有可無
- ❌ 可降規避開：可以透過降低規格來避開該公司的產品
- ❌ 可平替且多供應商已成熟：存在可平替的替代方案，且多個供應商已成熟

**輸出要求**：ENG_Fit_Result = "Pass" 或 "Fail" + 一句話說明

---

### 第二層：結構對位檢查（STRUCT Fit）

**必須回答並輸出以下 5 個問題，缺一不可：**

#### 問題 1：公司是否位於「必經節點/合規入口/流程 OS/樞紐」？
- 必須明確說明：該公司在系統中是否扮演以下角色之一：
  - 必經節點（必走通道）
  - 合規入口（認證/稽核/合規必經）
  - 流程 OS（工作流作業系統/預設路徑）
  - 樞紐/通道控制（Hub / routing / distribution）
- 輸出要求：是/否 + 具體角色說明

#### 問題 2：不用會怎樣？（交易/合規/責任/流程失效）
- 必須明確說明：如果不用該公司，會發生哪些失效：
  - 交易失效（交易不能完成）
  - 合規不通（無法合規/無法交付）
  - 責任不可承擔（風險責任無法承擔）
  - 流程崩潰（營運/供應鏈/治理流程斷裂）
- 輸出要求：列出具體失效類型 + 說明

#### 問題 3：替代者要重建哪些門檻？（法規/網路效應/資料/控制權/切換成本）
- 必須明確說明：替代者要重建哪些門檻：
  - 法規門檻
  - 網路效應門檻
  - 資料門檻
  - 系統控制權門檻
  - 切換成本門檻
- 輸出要求：列出門檻類型 + 時間成本估計

#### 問題 4：是否有制度/標準/行為收斂證據支持「逃不掉」？
- 必須明確說明：是否有以下收斂證據支持「客戶逃不掉」：
  - 監管/政策/法規文件
  - 標準文件（含驗證制度）
  - 產業慣例/採用證據
  - 用戶習慣/行為收斂
- 輸出要求：是/否 + 具體證據說明

#### 問題 5：是否存在再定價觸發器（新層疊加造成質變）？
- 必須明確說明：是否存在「新技術層」疊加導致舊護城河放大或質變：
  - AI / Agent
  - 新介面（UI/UX、API、平台）
  - 新制度/新標準落地
- 輸出要求：是/否 + 觸發器說明

**不通過條件（任一成立即不得進正式候選池）：**
- ❌ 只有市占/品牌，無失效模式
- ❌ 替代路徑合理時間可完成（可平替、可多供應商）
- ❌ 只是一個產品紅利，無通道/制度控制權

**輸出要求**：STRUCT_Fit_Result = "Pass" 或 "Fail" + 一句話說明

---

### 第三層：時間角色對位檢查（Time & Role Fit｜P0.7）

**必須回答並輸出以下 5 個問題，缺一不可：**

#### 問題 1：公司屬於 P0.7 指定的 Leveraged_Role_Type 嗎？
- 必須明確說明：該公司是否屬於 P0.7 中該 Theme/Subtheme 指定的 Leveraged_Role_Type（平台核心層/合規入口層/設備承載層/流程 OS/供給側約束）？
- 輸出要求：是/否 + 如果不屬於，說明它屬於哪一層

#### 問題 2：若不是，它屬於哪一層？（例如：最先承壓層/成熟收斂層）
- 如果問題 1 的答案是「否」，必須明確說明該公司屬於哪一層：
  - 最先承壓層（在系統演化中會最先承受壓力）
  - 成熟收斂層（已經成熟，無再定價空間）
  - 其他層級
- 輸出要求：層級說明

#### 問題 3：在當前 Time_Position（Early/Mid/Late/Transition）下，它是否是最優受益角色？
- 必須明確說明：在 P0.7 裁決的當前 Time_Position（Early/Mid/Late/Transition）下，該公司角色是否是最優受益角色？
- 輸出要求：是/否 + 說明

#### 問題 4：若主導迴路從 R 轉 B（或 B 轉 R），該公司角色會變強或變弱？
- 必須明確說明：如果系統的主導迴路從 R（增強迴路）轉 B（調節迴路），或從 B 轉 R，該公司角色會變強還是變弱？
- 輸出要求：變強/變弱 + 說明

#### 問題 5：是否存在「工程對但時間錯」的錯位？
- 必須明確說明：是否存在「工程對位正確，但時間錯位」的情況？
- 輸出要求：是/否 + 錯位說明

**不通過條件：**
- ❌ 工程/結構對，但在當前時間位置是「最先承壓」或「已成熟無再定價」角色
- → 必須進 Tracking 或 Rejection，不得進正式候選池

**輸出要求**：TIME_ROLE_Fit_Result = "Pass" 或 "Fail" + 一句話說明

---

## P1-3 Moat_Type（M1-M6）定義（完整寫死）

**⚠️ 重要：Moat_Type 唯一合法分類（必選其一，可多選但需主/次標註）。**

### M1｜工程/物理硬牆

來自物理極限、製程 know-how、可靠度、材料/光學/熱等硬門檻，替代者短期無法複製。

**判斷標準**：
- 是否涉及物理極限（功耗、熱密度、頻率、電流密度、互連延遲等）？
- 是否涉及製程 know-how（難以複製的製程技術）？
- 是否涉及可靠度（高可靠度要求，替代者難以達到）？
- 是否涉及材料/光學/熱等硬門檻？

### M2｜法規/認證硬牆

來自合規、認證、標準驗證制度，沒有認證就無法進入供應鏈/市場。

**判斷標準**：
- 是否必須通過特定法規認證才能進入市場？
- 是否必須通過標準驗證制度才能進入供應鏈？
- 沒有認證是否就無法完成交易/交付？

### M3｜通道/樞紐硬牆

控制關鍵 distribution / routing / 通路入口，沒走它就到不了客戶/交易完成不了。

**判斷標準**：
- 是否控制關鍵 distribution（分發通道）？
- 是否控制關鍵 routing（路由通道）？
- 是否控制關鍵通路入口？
- 沒走它是否就到不了客戶/交易完成不了？

### M4｜生態/系統控制硬牆

控制系統層級的預設路徑或平台，具有不可拆的模組依賴與網路效應。

**判斷標準**：
- 是否控制系統層級的預設路徑或平台？
- 是否具有不可拆的模組依賴？
- 是否具有網路效應？

**⚠️ M4 生態系防呆條款（寫死，任一不滿足不得標 M4）：**

以下三條 **必須全部成立**：

1. **不可拆模組 ≥ 3**  
   產品/服務至少三個模組互相依賴，拆掉就失效或價值大幅下降

2. **系統控制權或預設路徑至少 1**  
   OS/入口/分發/身份/路由/預設協議/預設工作流

3. **資料飛輪或行為收斂至少 1**  
   越用越好、越多人用越難離開（或形成產業習慣/標準）

**如果以上三條不全部成立，不得標 M4。**

### M5｜流程/切換成本硬牆

深度嵌入客戶流程、工作流、資料與習慣，更換成本高（停機、重訓練、重整合、責任風險）。

**判斷標準**：
- 是否深度嵌入客戶流程？
- 是否深度嵌入工作流？
- 是否深度嵌入資料與習慣？
- 更換成本是否極高（停機、重訓練、重整合、責任風險）？

### M6｜供給側約束硬牆

上游產能/良率/原料/設備被鎖定，市場需求增加但供給短期跟不上，形成稀缺。

**判斷標準**：
- 上游產能是否被鎖定？
- 上游良率是否被鎖定？
- 上游原料是否被鎖定？
- 上游設備是否被鎖定？
- 市場需求增加但供給短期是否跟不上？

**輸出要求**：
- 必須從 M1-M6 中選擇（可多選）
- 如果多選，必須標註主/次（例如：「M4> M5」表示 M4 為主，M5 為次）
- 如果標 M4，必須確認三條防呆條款全部成立

---

## P1-4 Rerate_State（R0-R3）定義＋防呆（完整寫死）

**⚠️ 重要：Rerate_State 唯一合法分類。**

### R0｜敘事已完成（Mature Moat）

护城河共识化多年，偏防守/複利型，難期待估值再擴張（除非新層疊加）。

**判斷標準**：
- 護城河是否已共識化多年？
- 是否偏防守/複利型？
- 是否難期待估值再擴張（除非新層疊加）？

### R1｜部分定價（Under-appreciated）

护城河存在，市場理解不完整、仍有再認知空間。

**判斷標準**：
- 護城河是否存在？
- 市場理解是否不完整？
- 是否仍有再認知空間？

### R2｜未定價（Pre-narrative）

护城河正在形成或剛跨臨界點，尚未成為主敘事（共識尚未建立）。

**判斷標準**：
- 護城河是否正在形成或剛跨臨界點？
- 是否尚未成為主敘事？
- 共識是否尚未建立？

### R3｜再定價引擎（Old Moat + New Layer）

舊護城河可能成熟，但新技術層/制度變更使定價權來源「質變放大」。

**判斷標準**：
- 舊護城河是否可能成熟？
- 是否存在新技術層/制度變更？
- 新層是否使定價權來源「質變放大」？

**⚠️ 防呆（寫死）：**
- ❌ **不得用 Phase 3 技術面波動改判 R 狀態**
- ✅ **R 狀態只能由 Phase 0/0.7/1 的「主題級證據＋結構推理」裁決**
- ✅ **後段只能降權/剔除，不得回寫**

**輸出要求**：必須是 R0/R1/R2/R3 其中之一

---

## P1-5 Universe 三池規則（寫死）

**⚠️ 重要：三池硬性規則，必須嚴格遵守。**

### 三池定義

1. **正式候選池（Master Candidates）**  
   - 允許進 Phase 2
   - 是 Phase 2 唯一合法輸入
   - **條件**：三層對位檢查全部 Pass（ENG_Fit = Pass, STRUCT_Fit = Pass, TIME_ROLE_Fit = Pass）

2. **追蹤池（Tracking Pool）**  
   - 「找不到 ≠ 不存在」
   - 因證據不足/時間錯位/需等待觸發條件而暫不進 Phase 2
   - **條件**：三層對位檢查部分 Pass，但存在以下情況：
     - 證據不足（Why_Still_Unproven）
     - 時間錯位（工程對但時間錯）
     - 需等待觸發條件（Tracking_Trigger）

3. **排除池（Rejection Pool）**  
   - 工程錯位或結構錯位，永久否決
   - **條件**：三層對位檢查任一 Fail（ENG_Fit = Fail 或 STRUCT_Fit = Fail 或 TIME_ROLE_Fit = Fail）

### 三池硬性規則

**⚠️ 必須嚴格遵守：**

1. **一家公司只能存在於三池之一**
   - 不能同時存在於多個池
   - 如果公司從一個池移到另一個池，必須從原池移除

2. **任何調整必須 Append-only（新增版本），不得覆寫歷史**
   - 不能直接修改歷史記錄
   - 必須新增版本記錄
   - 保留完整的歷史軌跡

---

## 輸出格式（必須是 JSON，符合 P1-7 Mandatory Schema）

**⚠️ 重要：輸出必須完全符合以下格式，欄位不可增刪。**

{
  "master_candidates": [
    {
      "Theme_Track": "ENG/STRUCT/BOTH",
      "Theme_ID": "THEME_001",
      "Subtheme_ID": "SUBTHEME_001",
      "Company_Code": "AAPL",
      "Company_Name": "Apple Inc.",
      "Market": "US/JP/TW",
      "Primary_Technology_or_Node": "關鍵技術節點",
      "Moat_Type": "M4> M5",  // ⭐ 主/次標註格式（如果多選）
      "Rerate_State": "R0/R1/R2/R3",
      "Problem_OneLiner": "工程/結構問題一句話（來自 P0）",
      "Failure_Mode": "不用會怎樣（來自 P0）",
      "No_Alternative_Reason": "為何不可替代（來自 P0）",
      "Convergence_Evidence": "工程/制度/行為收斂證據（來自 P0）",
      "Long_Term_Time_Window": "3-10 年窗口（來自 P0）",
      "P0.7_Loop_Dominance": "R/B/Mixed（來自 P0.7）",
      "P0.7_Time_Position": "Early/Mid/Late/Transition（來自 P0.7）",
      "P0.7_Leveraged_Role_Type": "平台核心層/合規入口層/設備承載層/流程OS/供給側約束（來自 P0.7）",
      "Role_in_Theme": "核心/關鍵供應/必經節點/流程OS/合規入口/供給約束…",
      "ENG_Fit_Result": "Pass/Fail + 一句話",
      "STRUCT_Fit_Result": "Pass/Fail + 一句話",
      "TIME_ROLE_Fit_Result": "Pass/Fail + 一句話",
      "Confidence_Level": 0.0-1.0,
      "Source_Type": "標準/roadmap/監管/協會/官方公告…",
      "Phase_Version": "V8.0",
      "Notes": "備註"
    }
  ],
  "tracking_pool": [
    {
      "Theme_Track": "ENG/STRUCT/BOTH",
      "Theme_ID": "THEME_001",
      "Subtheme_ID": "SUBTHEME_001",
      "Company_Code": "TSLA",
      "Company_Name": "Tesla Inc.",
      "Market": "US/JP/TW",
      "Primary_Technology_or_Node": "關鍵技術節點",
      "Moat_Type": "M4> M5 或 —（若未知填「—」）",
      "Rerate_State": "R0/R1/R2/R3 或 —（若未知填「—」）",
      "Problem_OneLiner": "工程/結構問題一句話",
      "Why_Still_Unproven": "缺：失效模式/收斂證據/替代路徑/時間錯位…",
      "Tracking_Trigger": "何時升格：取得某標準/某採用/某制度落地…",
      "P0.7_Time_Position": "Early/Mid/Late/Transition（來自 P0.7）",
      "P0.7_Leveraged_Role_Type": "平台核心層/合規入口層/設備承載層/流程OS/供給側約束（來自 P0.7）",
      "Confidence_Level": 0.0-1.0,
      "Phase_Version": "V8.0",
      "Notes": "備註"
    }
  ],
  "rejection_pool": [
    {
      "Theme_Track": "ENG/STRUCT/BOTH",
      "Theme_ID": "THEME_001",
      "Subtheme_ID": "SUBTHEME_001",
      "Company_Code": "XXX",
      "Company_Name": "公司名稱",
      "Market": "US/JP/TW",
      "Primary_Technology_or_Node": "關鍵技術節點",
      "Moat_Type": "—（若不適用填「—」）",
      "Rejection_Reason": "排除理由（詳細說明）",
      "Rejection_Type": "工程錯位/結構錯位/可替代/敘事型/無失效模式/可降規/時間錯位",
      "Phase_Version": "V8.0",
      "Notes": "備註"
    }
  ],
  "confidence_level": 0.0-1.0,
  "analysis_date": "${new Date().toISOString().split('T')[0]}"
}

---

## 注意事項

1. **必須按照固定順序完成三層對位檢查**：ENG Fit → STRUCT Fit → TIME_ROLE Fit，不得跳步。

2. **三層對位檢查必須逐條回答並輸出**：每個問題都必須明確回答，不能省略。

3. **不通過條件必須嚴格執行**：如果任一不通過條件成立，該公司必須進入 Rejection Pool，不得進入 Master Candidates。

4. **Moat_Type 必須從 M1-M6 中選擇**：如果標 M4，必須確認三條防呆條款全部成立。

5. **Rerate_State 只能由 Phase 0/0.7/1 裁決**：不得用 Phase 3 技術面波動改判 R 狀態。

6. **三池硬性規則必須嚴格遵守**：一家公司只能存在於三池之一，任何調整必須 Append-only。

7. **輸出必須完全符合 Mandatory Schema**：欄位不可增刪，格式必須正確。

8. **必須基於 P0 和 P0.7 的輸出進行分析**：不能偏離前段的結論。

9. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確，可以被程式解析。

10. **每個公司都必須有唯一標識**：Theme_ID + Company_Code 必須唯一。
${isTestMode ? `
11. **測試模式限制（嚴格遵守）**：每個 Theme/Subtheme 最多產出 ${companiesPerTheme} 間公司到 Master_Candidates。如果符合條件的公司超過 ${companiesPerTheme} 間，只選擇最符合條件的 ${companiesPerTheme} 間（優先選擇三層對位檢查全部 Pass 的公司）。
` : ''}
`;
}

// ==========================================
// 快照管理
// ==========================================

/**
 * 獲取最新 P1 快照
 */
function getLatestP1Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P1__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P1__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    return {
      snapshot_id: row[getColIndex("snapshot_id")] || null,
      created_at: row[getColIndex("created_at")] || null,
      trigger: row[getColIndex("trigger")] || null,
      p1_output_json: (() => {
        const colIndex = getColIndex("p1_output_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            Logger.log(`P1 快照 p1_output_json 解析失敗：${e.message}`);
            return {};
          }
        }
        return {};
      })(),
      pool_results_json: (() => {
        const colIndex = getColIndex("pool_results_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return {};
          }
        }
        return {};
      })(),
      p0_snapshot_id: row[getColIndex("p0_snapshot_id")] || null,
      p0_5_snapshot_id: row[getColIndex("p0_5_snapshot_id")] || null,  // ⭐ V8.14 新增：P0.5 快照 ID
      p0_7_snapshot_id: row[getColIndex("p0_7_snapshot_id")] || null,
      // ⭐ 機構級數據已移至 P2.5 模組
      changes_json: (() => {
        const colIndex = getColIndex("changes_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      version: row[getColIndex("version")] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P1 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P1 快照
 */
function saveP1Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P1__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P1__SNAPSHOT");
    sheet.appendRow([
      "snapshot_id",
      "created_at",
      "trigger",
      "p1_output_json",
      "pool_results_json",
      "p0_snapshot_id",
      "p0_5_snapshot_id",  // ⭐ V8.14 新增：P0.5 快照 ID
      "p0_7_snapshot_id",
      "changes_json",
      "version"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP1SnapshotId();
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(snapshotData.p1_output),
    JSON.stringify(snapshotData.pool_results),
    snapshotData.p0_snapshot_id,
    snapshotData.p0_5_snapshot_id || "",  // ⭐ V8.14 新增：P0.5 快照 ID
    snapshotData.p0_7_snapshot_id,
    JSON.stringify(snapshotData.changes),
    "V8.14"  // ⭐ V8.14 更新版本號
  ]);
  
  Logger.log(`P1 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * 生成 P1 快照 ID
 */
function generateP1SnapshotId() {
  const date = new Date();
  const year = date.getFullYear();
  const quarter = Math.floor((date.getMonth() + 3) / 3);
  return `P1_${year}Q${quarter}_${Date.now()}`;
}

/**
 * 比對與上一版快照的變動
 */
function compareWithPreviousSnapshotP1(currentOutput) {
  const previousSnapshot = getLatestP1Snapshot();
  
  if (!previousSnapshot) {
    return {
      has_changes: true,
      is_first_run: true,
      changes: []
    };
  }
  
  const previousOutput = previousSnapshot.p1_output_json || {};
  const changes = [];
  
    // ⭐ V8.14 更新：使用 Tier 系統比對變動（取代舊的三池分類）
    const currentTieredIds = (currentOutput.tiered_companies || []).map(c => 
      `${c.theme_id}_${c.ticker}`
    );
    const previousTieredIds = (previousOutput.tiered_companies || []).map(c => 
      `${c.theme_id}_${c.ticker}`
    );
    
    const newCompanies = currentTieredIds.filter(id => previousTieredIds.indexOf(id) === -1);
    const removedCompanies = previousTieredIds.filter(id => currentTieredIds.indexOf(id) === -1);
    
    // 比對 Tier 變動
    const tierChanges = [];
    for (const currentCompany of currentOutput.tiered_companies || []) {
      const companyId = `${currentCompany.theme_id}_${currentCompany.ticker}`;
      if (previousTieredIds.includes(companyId)) {
        const previousCompany = (previousOutput.tiered_companies || []).find(c => 
          `${c.theme_id}_${c.ticker}` === companyId
        );
        if (previousCompany && previousCompany.tier !== currentCompany.tier) {
          tierChanges.push({
            company_id: companyId,
            old_tier: previousCompany.tier,
            new_tier: currentCompany.tier
          });
        }
      }
    }
    
    if (newCompanies.length > 0 || removedCompanies.length > 0 || tierChanges.length > 0) {
      changes.push({
        type: "TIERED_COMPANIES_CHANGES",
        new: newCompanies,
        removed: removedCompanies,
        tier_changes: tierChanges
      });
    }
    
    return {
      has_changes: changes.length > 0 || newCompanies.length > 0 || 
                  removedCompanies.length > 0 || tierChanges.length > 0,
      is_first_run: false,
      changes: changes
    };
}

// ==========================================
// 下游觸發
// ==========================================

/**
 * 觸發下游 Phase（P2）
 */
function triggerDownstreamPhasesP1(sourcePhase, snapshot) {
  if (snapshot.changes && snapshot.changes.has_changes) {
    // 觸發 P2（基本面分析）
    Logger.log("P1 變動檢測，觸發 P2");
    try {
      // 觸發 P2 季度分析（因為 P1 是季度執行）
      P2_Quarterly_Execute({
        trigger: "P1_UPDATE",
        p1_snapshot_id: snapshot.snapshot_id,
        context: {
          source_phase: "P1",
          source_snapshot_id: snapshot.snapshot_id
        }
      });
    } catch (error) {
      Logger.log(`P1 觸發 P2 失敗：${error.message}`);
    }
  }
}

// ==========================================
// M0 Job Queue 整合
// ==========================================

/**
 * 檢查 M0 Job 狀態（從 M0__JOB_QUEUE 表格讀取）
 * ⭐ V8.0 新增：用於測試模式下檢查任務狀態
 * @param {string} jobId - 任務 ID
 * @return {string|null} 任務狀態（"NEW" / "RUNNING" / "DONE" / "ERROR"），如果不存在則返回 null
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
 * 獲取 M0 Job 結果（從 M0__RESULT 表格讀取）
 * ⭐ V8.0 新增：用於測試模式下自動輪詢結果
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
    
    // ⭐ V8.17.6 修正：強制刷新以獲取最新數據
    SpreadsheetApp.flush();
    Utilities.sleep(500);  // 等待 500ms 確保數據同步
    
    // ⭐ V8.17.6 修正：先讀取標題行，然後直接讀取最後幾行（更可靠）
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const jobIdCol = headers.indexOf("job_id");
    const outputCol = headers.indexOf("final_output");
    
    if (jobIdCol === -1 || outputCol === -1) {
      Logger.log(`getM0JobResult：錯誤：找不到必要欄位（job_id=${jobIdCol}, final_output=${outputCol}）`);
      return null;
    }
    
    // ⭐ V8.17.6 修正：從最後一行開始，向上查找最多 10 行（通常最新結果在最後）
    const lastRow = sheet.getLastRow();
    const searchStart = Math.max(2, lastRow - 9);  // 從倒數第 10 行開始（至少從第 2 行開始）
    const searchRows = sheet.getRange(searchStart, 1, lastRow - searchStart + 1, sheet.getLastColumn()).getValues();
    
    // 從最後一行開始查找（searchRows 是從 searchStart 開始的，所以最後一行是 searchRows[searchRows.length - 1]）
    for (let i = searchRows.length - 1; i >= 0; i--) {
      const row = searchRows[i];
      const actualRowNum = searchStart + i;
      
      if (row[jobIdCol] === jobId) {
        const output = row[outputCol];
        
        Logger.log(`getM0JobResult：找到 job_id=${jobId}，實際行號=${actualRowNum}, outputCol=${outputCol}, output 類型=${typeof output}`);
        
        // ⭐ V8.17.6 修正：如果 output 為空，直接重新讀取該行（使用 getRange 更可靠）
        if (output === undefined || output === null || output === "") {
          Logger.log(`getM0JobResult：警告：output 為空，直接重新讀取該行...`);
          
          // 強制刷新並重新讀取該行
          SpreadsheetApp.flush();
          Utilities.sleep(1000);  // 等待 1 秒
          
          // 直接讀取該行（使用 getRange 更可靠）
          const retryRow = sheet.getRange(actualRowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
          const retryOutput = retryRow[outputCol];
          
          Logger.log(`getM0JobResult：重試讀取行 ${actualRowNum}，output 類型=${typeof retryOutput}, 值=${retryOutput ? (typeof retryOutput === 'string' ? retryOutput.substring(0, 50) + "..." : "對象") : "null/undefined"}`);
          
          if (retryOutput === undefined || retryOutput === null || retryOutput === "") {
            Logger.log(`getM0JobResult：重試後 output 仍為空，返回 null`);
            return null;  // 返回 null，讓調用者知道結果還沒準備好
          }
          
          // 使用重試讀取的 output
          try {
            const parsedOutput = typeof retryOutput === 'string' ? JSON.parse(retryOutput) : retryOutput;
            Logger.log(`getM0JobResult：重試後成功解析，parsedOutput 類型=${typeof parsedOutput}, 鍵=${typeof parsedOutput === 'object' ? Object.keys(parsedOutput).slice(0, 5).join(", ") : "N/A"}`);
            return {
              job_id: jobId,
              output: parsedOutput
            };
          } catch (e) {
            Logger.log(`getM0JobResult：重試後解析失敗：${e.message}，使用原始值`);
            return {
              job_id: jobId,
              output: retryOutput
            };
          }
        }
        
        // output 不為空，直接解析
        try {
          const parsedOutput = typeof output === 'string' ? JSON.parse(output) : output;
          Logger.log(`getM0JobResult：成功解析，parsedOutput 類型=${typeof parsedOutput}, 鍵=${typeof parsedOutput === 'object' ? Object.keys(parsedOutput).slice(0, 5).join(", ") : "N/A"}`);
          return {
            job_id: jobId,
            output: parsedOutput
          };
        } catch (e) {
          Logger.log(`getM0JobResult：解析失敗：${e.message}，使用原始值`);
          return {
            job_id: jobId,
            output: output
          };
        }
      }
    }
    
    Logger.log(`getM0JobResult：未找到 job_id=${jobId}（已搜索最後 ${searchRows.length} 行）`);
    return null;
    
  } catch (error) {
    Logger.log(`獲取 M0 Job 結果失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    return null;
  }
}

/**
 * 提交任務到 M0 Job Queue
 */
function submitToM0JobQueue(projectId, requestedFlow, inputPayload) {
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
  
  Logger.log(`P1 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 根據快照 ID 獲取 P0.7 快照
 */
function getP0_7SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
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
    Logger.log(`獲取 P0.7 快照失敗：${error.message}`);
    return null;
  }
}
