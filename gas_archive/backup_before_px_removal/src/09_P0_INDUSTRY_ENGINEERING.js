/**
 * 🏭 P0: 產業工程學分析（Industry Engineering Analysis）
 * 
 * 產業工程學 + 機構級視角融合
 * 識別主題、子主題、關鍵技術節點
 * 分析產業鏈結構與資金流
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P0 配置參數
// ==========================================

const P0_CONFIG = {
  // 執行頻率
  frequency: "QUARTERLY",  // 每季執行一次
  
  // 輸出格式
  output_format: {
    themes: true,           // 主題列表
    subthemes: true,        // 子主題列表
    key_nodes: true,        // 關鍵技術節點
    industry_chain: true,   // 產業鏈結構
    capital_flow: true      // 資金流分析（純學術分析，不含籌碼面）
  }
};

// ==========================================
// P0 核心函數
// ==========================================

/**
 * P0 主執行函數
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（QUARTERLY / MANUAL / P0_5_UPDATE）
 * @param {Object} params.user_input - 用戶輸入（來自執行前確認）
 * @param {Object} params.context - 上下文資訊（可選）
 * @return {Object} P0 分析結果
 */
function P0_Execute(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P0 執行開始：trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 檢查執行前確認
    // ========================================
    
    const jobId = params.job_id || `P0_${Date.now()}`;
    const confirmation = checkPreExecutionConfirmation(jobId, "P0", params.context || {});
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      // 如果需要確認但尚未確認，生成確認問題
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions("P0", params.context);
        const confirmationId = savePreExecutionQuestions(jobId, "P0", questions);
        
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
    
    // ⭐ V8.0 修正：P0 不需要使用者輸入，使用預設值或從參數獲取
    // P0 本身就是用來找面向的工具，不需要問使用者問題
    const userInput = params.user_input || {
      theme_focus: "",  // 空值表示不限，全面分析
      geographic_focus: "ALL",
      time_horizon: "MEDIUM"
    };
    
    const context = params.context || {};
    if (params.trigger === "UI_FULL_PIPELINE") {
      context.test_mode = true;  // UI 執行時使用測試模式
      Logger.log("P0：UI 執行模式，啟用 test_mode");
    }
    
    // ========================================
    // Step 2: 準備 M0 Job 輸入
    // ========================================
    
    const m0InputPayload = {
      phase: "P0",
      trigger: params.trigger,
      user_input: userInput,
      context: context,
      previous_snapshot: getLatestP0Snapshot(),
      // ⭐ 機構級數據已移至 P2.5 模組，P0 專注於純學術分析
    };
    
    // ========================================
    // Step 3: 構建 M0 流程
    // ========================================
    
    // P0 純學術硬底子分析（物理學、產業供應鏈學），不包含籌碼面分析
    const requestedFlow = [
      "EXECUTOR",        // Step 1: 執行者（自動選擇：Claude Opus 4.5）
      "AUDITOR"          // Step 2: 審查者（自動選擇：GPT-5.2）
    ];
    
    // 構建 P0 專用的 Prompt
    m0InputPayload.p0_prompt = buildP0Prompt(userInput, context);
    
    // ========================================
    // Step 4: 提交到 M0 Job Queue
    // ========================================
    
    const jobId_final = submitToM0JobQueue("P0", requestedFlow, m0InputPayload);
    
    // ========================================
    // Step 5: 自動執行 M0（⭐ V8.0 修正：P0 應該自動執行 M0）
    // ========================================
    
    // ⭐ V8.0 修正：P0 應該自動執行 M0，不需要用戶手動執行
    Logger.log(`P0：自動執行 M0 處理任務 ${jobId_final}`);
    
    try {
      // 執行 M0
      M0_Execute();
      
      // ========================================
      // Step 6: 讀取 M0 執行結果（輪詢等待）
      // ========================================
      
      // 輪詢等待 M0 執行完成（最多等待 60 秒）
      let m0Result = null;
      const maxWaitTime = 60000; // 60 秒
      const pollInterval = 2000; // 每 2 秒檢查一次
      const startWaitTime = Date.now();
      
      while (Date.now() - startWaitTime < maxWaitTime) {
        Utilities.sleep(pollInterval);
        m0Result = getM0JobResult(jobId_final);
        
        if (m0Result) {
          Logger.log(`P0：M0 任務 ${jobId_final} 執行完成`);
          break;
        }
        
        // 檢查任務狀態（如果失敗，提前退出）
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
        if (jobQueueSheet) {
          const dataRange = jobQueueSheet.getDataRange();
          const rows = dataRange.getValues();
          for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === jobId_final) {
              const status = rows[i][2]; // status
              if (status === "ERROR") {
                throw new Error(`M0 任務執行失敗：${rows[i][8] || "未知錯誤"}`);
              }
              break;
            }
          }
        }
      }
      
      if (!m0Result) {
        Logger.log(`P0：M0 任務 ${jobId_final} 執行超時，返回 SUBMITTED 狀態`);
        return {
          status: "SUBMITTED",
          job_id: jobId_final,
          message: "P0 任務已提交到 M0 並執行，但執行時間較長，請稍後再查看結果"
        };
      }
      
      // ========================================
      // Step 7: 處理 M0 執行結果
      // ========================================
      
      // ⭐ 修正：m0Result 的結構應該是 { job_id, output }
      // output 是 executionResult.final_output，其中包含 executor_output 和 auditor_output
      // 根據 executeFlow 的返回結構，final_output 應該包含完整的執行結果
      const finalOutput = m0Result.output || {};
      
      // ⭐ V8.0 修正：檢查 M0 是否已經處理過（M0_CORE 中的 executeFlow 會調用 P0_ProcessM0Result）
      // 注意：M0_CORE 中的 finalResult.p0_result 不會保存到 M0__RESULT，所以這裡需要重新處理
      // 但我們可以檢查 finalOutput 的結構，如果已經是處理過的格式，可以直接使用
      // 目前設計：M0_CORE 中的 P0_ProcessM0Result 只是為了記錄到 finalResult，不會保存快照
      // 實際的快照保存應該在 P0_Execute 中完成
      
      // 檢查是否已經是處理過的結果（包含 snapshot_id）
      if (finalOutput.snapshot_id && finalOutput.status === "COMPLETED") {
        Logger.log(`P0：M0 結果已包含處理結果，直接返回（避免重複處理）`);
        return finalOutput;
      }
      
      // 嘗試從不同可能的結構中提取 executor_output 和 auditor_output
      let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || {};
      let auditorOutput = finalOutput.auditor_output || finalOutput.auditor || finalOutput.audit_output || {};
      
      // 如果 finalOutput 本身就是結果（可能是舊格式），直接使用
      if (!executorOutput || Object.keys(executorOutput).length === 0) {
        executorOutput = finalOutput;
      }
      
      const m0ResultPayload = {
        executor_output: executorOutput,
        auditor_output: auditorOutput,
        trigger: params.trigger || "QUARTERLY"
      };
      
      Logger.log(`P0：解析 M0 結果，executor_output 類型=${typeof executorOutput}, auditor_output 類型=${typeof auditorOutput}`);
      
      // ⭐ V8.0 修正：傳遞完整的 params，包括 trigger 和 context
      return P0_ProcessM0Result(jobId_final, m0ResultPayload, {
        trigger: params.trigger,
        context: context
      });
      
    } catch (error) {
      Logger.log(`P0：M0 執行失敗：${error.message}`);
      // 如果 M0 執行失敗，返回 SUBMITTED 狀態，讓用戶可以手動重試
      return {
        status: "SUBMITTED",
        job_id: jobId_final,
        message: `P0 任務已提交到 M0，但執行時發生錯誤：${error.message}，請手動執行 M0_Execute() 重試`
      };
    }
    
  } catch (error) {
    Logger.log(`P0 執行失敗：${error.message}`);
    throw error;
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
 * 處理 P0 M0 執行結果（由 M0 調用）
 * @param {string} jobId - 任務 ID
 * @param {Object} m0Result - M0 執行結果
 * @param {Object} params - 原始執行參數（可選，包含 trigger 和 context）
 * @return {Object} P0 處理結果
 */
function P0_ProcessM0Result(jobId, m0Result, params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P0 處理 M0 結果：jobId=${jobId}`);
    
    // ========================================
    // Step 1: 解析 M0 結果
    // ========================================
    
    let executorOutput = m0Result.executor_output || {};
    let auditorOutput = m0Result.auditor_output || {};
    // ⭐ 機構級數據已移至 P2.5 模組
    
    // ⭐ 修正：如果 executorOutput 是字符串，嘗試解析為 JSON
    if (typeof executorOutput === 'string') {
      try {
        // 嘗試移除 markdown 代碼塊標記（如果有的話）
        let jsonString = executorOutput.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        executorOutput = JSON.parse(jsonString);
        Logger.log(`P0 調試：成功解析 executorOutput 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P0 調試：無法解析 executorOutput 字符串：${e.message}`);
        // 如果解析失敗，保持為字符串，後續處理會嘗試其他方式
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
        Logger.log(`P0 調試：成功解析 auditorOutput 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P0 調試：無法解析 auditorOutput 字符串：${e.message}`);
      }
    }
    
    // ⭐ 調試日誌：檢查 AI 輸出格式
    Logger.log(`P0 調試：executorOutput 類型=${typeof executorOutput}, 是否有 themes=${!!executorOutput.themes}`);
    if (executorOutput.themes) {
      Logger.log(`P0 調試：executorOutput.themes 數量=${executorOutput.themes.length || 0}`);
    } else {
      Logger.log(`P0 調試：executorOutput 鍵=${Object.keys(executorOutput).slice(0, 10).join(", ")}...（最多顯示前10個）`);
      // ⭐ V8.17.1 增強：輸出完整的 executorOutput 結構（用於調試）
      try {
        Logger.log(`P0 調試：executorOutput 完整結構（前500字符）：${JSON.stringify(executorOutput).substring(0, 500)}`);
      } catch (e) {
        Logger.log(`P0 調試：無法序列化 executorOutput：${e.message}`);
      }
      // 嘗試從其他可能的鍵提取
      if (executorOutput.industry_analysis) {
        Logger.log(`P0 調試：找到 industry_analysis`);
      }
      if (executorOutput.analysis) {
        Logger.log(`P0 調試：找到 analysis`);
      }
    }
    
    // ========================================
    // Step 2: 生成 P0 輸出結構（純學術分析，不包含機構級數據）
    // ========================================
    
    const p0Output = generateP0Output(executorOutput, auditorOutput);
    
    // ⭐ 調試日誌：檢查生成的 p0Output
    Logger.log(`P0 調試：p0Output.themes 數量=${(p0Output.themes || []).length}`);
    Logger.log(`P0 調試：p0Output.subthemes 數量=${(p0Output.subthemes || []).length}`);
    Logger.log(`P0 調試：p0Output.key_nodes 數量=${(p0Output.key_nodes || []).length}`);
    
    // ⭐ V8.14 新增：提取驗證問題並保存第一次分析結果
    const validationQuestions = extractValidationQuestions(executorOutput);
    
    // ⭐ V8.0 修正：保存 trigger 信息（從原始 params 獲取，如果沒有則從 m0Result 獲取）
    const trigger = (params && params.trigger) || m0Result.trigger || "QUARTERLY";
    const context = (params && params.context) || {};
    
    // ========================================
    // Step 3: 保存快照（包含第一次分析結果和驗證問題）
    // ========================================
    
    // ⭐ V8.0 修正：檢查是否已經保存過快照（通過 job_id 查找，避免重複保存）
    // 注意：M0_CORE 中的 P0_ProcessM0Result 也會保存快照，所以這裡需要檢查
    const existingSnapshot = checkP0SnapshotByJobId(jobId);
    let snapshot;
    
    if (existingSnapshot) {
      Logger.log(`P0：快照已存在（snapshot_id=${existingSnapshot.snapshot_id}），跳過保存（避免重複）`);
      snapshot = existingSnapshot;
    } else {
      snapshot = saveP0Snapshot({
        job_id: jobId,
        trigger: trigger,
        p0_output: p0Output,
        changes: compareWithPreviousSnapshot(p0Output),
        original_context: context  // ⭐ V8.0 新增：保存 context
      });
      
      // ⭐ V8.14 新增：保存第一次分析結果和驗證問題
      if (validationQuestions && validationQuestions.length > 0) {
        saveP0InitialAnalysis(snapshot.snapshot_id, executorOutput, validationQuestions);
        Logger.log(`P0 V8.14：已保存 ${validationQuestions.length} 個驗證問題，等待人工下載 PDF`);
      } else {
        Logger.log(`P0 V8.14：沒有驗證問題，直接進入 GPT 審查階段`);
      }
    }
    
    // ========================================
    // Step 4: 檢查是否需要觸發下游（僅在首次保存時觸發）
    // ========================================
    
    if (!existingSnapshot && snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P0.7 或 P1（僅在首次保存時觸發，避免重複觸發）
      triggerDownstreamPhases("P0", snapshot);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P0 處理完成：snapshot_id=${snapshot.snapshot_id}, 耗時=${duration}ms`);
    
    // ⭐ V8.14 新增：如果有驗證問題，返回特殊狀態
    if (validationQuestions && validationQuestions.length > 0 && !existingSnapshot) {
      return {
        status: "REQUIRES_VALIDATION",
        snapshot_id: snapshot.snapshot_id,
        p0_output: p0Output,
        changes: snapshot.changes,
        validation_questions: validationQuestions,
        message: "請下載 PDF 並放入 Google Drive，然後觸發驗證流程"
      };
    }
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p0_output: p0Output,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P0 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 機構級視角整合
// ==========================================

// ⭐ 機構級數據分析已移至 P2.5 模組
// P0 專注於純學術硬底子分析（物理學、產業供應鏈學）

// ==========================================
// P0 輸出生成
// ==========================================

/**
 * 生成 P0 輸出結構
 * ⭐ 修正：從 executorOutput 中正確提取數據
 */
function generateP0Output(executorOutput, auditorOutput) {
  // ⭐ 修正：executorOutput 可能直接包含 themes，或者包含在嵌套對象中
  let themes = [];
  let subthemes = [];
  let keyNodes = [];
  let industryChain = {};
  let capitalFlow = {};
  
  // ⭐ V8.17.1 增強：更詳細的調試日誌
  Logger.log(`P0 generateP0Output：開始解析，executorOutput 類型=${typeof executorOutput}`);
  if (typeof executorOutput === 'object' && executorOutput !== null) {
    Logger.log(`P0 generateP0Output：executorOutput 鍵=${Object.keys(executorOutput).slice(0, 20).join(", ")}`);
  }
  
  // 嘗試多種可能的數據結構
  if (executorOutput.themes) {
    themes = Array.isArray(executorOutput.themes) ? executorOutput.themes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.themes 提取到 ${themes.length} 個主題`);
    // ⭐ V8.17.1 新增：如果 themes 為空陣列，記錄警告
    if (themes.length === 0) {
      Logger.log(`⚠️ P0 警告：themes 陣列為空！這可能表示 AI 模型無法完成分析任務，或 Prompt 過於複雜。`);
      Logger.log(`⚠️ P0 調試：executorOutput 完整內容（前1000字符）：${JSON.stringify(executorOutput).substring(0, 1000)}`);
    }
  } else if (executorOutput.industry_analysis && executorOutput.industry_analysis.themes) {
    themes = Array.isArray(executorOutput.industry_analysis.themes) ? 
      executorOutput.industry_analysis.themes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.industry_analysis.themes 提取到 ${themes.length} 個主題`);
    if (themes.length === 0) {
      Logger.log(`⚠️ P0 警告：themes 陣列為空！`);
    }
  } else if (executorOutput.analysis && executorOutput.analysis.themes) {
    themes = Array.isArray(executorOutput.analysis.themes) ? 
      executorOutput.analysis.themes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.analysis.themes 提取到 ${themes.length} 個主題`);
    if (themes.length === 0) {
      Logger.log(`⚠️ P0 警告：themes 陣列為空！`);
    }
  } else {
    // ⭐ V8.17.1 新增：嘗試從其他可能的鍵提取
    Logger.log(`P0 generateP0Output：警告：未找到 themes，嘗試其他結構...`);
    // 如果 executorOutput 是字符串，嘗試解析
    if (typeof executorOutput === 'string') {
      try {
        const parsed = JSON.parse(executorOutput);
        if (parsed.themes) {
          themes = Array.isArray(parsed.themes) ? parsed.themes : [];
          Logger.log(`P0 generateP0Output：從解析後的字符串中提取到 ${themes.length} 個主題`);
          if (themes.length === 0) {
            Logger.log(`⚠️ P0 警告：themes 陣列為空！`);
          }
        }
      } catch (e) {
        Logger.log(`P0 generateP0Output：無法解析字符串：${e.message}`);
      }
    }
  }
  
  if (executorOutput.subthemes) {
    subthemes = Array.isArray(executorOutput.subthemes) ? executorOutput.subthemes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.subthemes 提取到 ${subthemes.length} 個子主題`);
    if (subthemes.length === 0 && themes.length === 0) {
      Logger.log(`⚠️ P0 警告：subthemes 陣列也為空！`);
    }
  } else if (executorOutput.industry_analysis && executorOutput.industry_analysis.subthemes) {
    subthemes = Array.isArray(executorOutput.industry_analysis.subthemes) ? 
      executorOutput.industry_analysis.subthemes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.industry_analysis.subthemes 提取到 ${subthemes.length} 個子主題`);
    if (subthemes.length === 0 && themes.length === 0) {
      Logger.log(`⚠️ P0 警告：subthemes 陣列也為空！`);
    }
  } else if (executorOutput.analysis && executorOutput.analysis.subthemes) {
    subthemes = Array.isArray(executorOutput.analysis.subthemes) ? 
      executorOutput.analysis.subthemes : [];
    Logger.log(`P0 generateP0Output：從 executorOutput.analysis.subthemes 提取到 ${subthemes.length} 個子主題`);
    if (subthemes.length === 0 && themes.length === 0) {
      Logger.log(`⚠️ P0 警告：subthemes 陣列也為空！`);
    }
  }
  
  if (executorOutput.key_nodes) {
    keyNodes = Array.isArray(executorOutput.key_nodes) ? executorOutput.key_nodes : [];
  } else if (executorOutput.industry_analysis && executorOutput.industry_analysis.key_nodes) {
    keyNodes = Array.isArray(executorOutput.industry_analysis.key_nodes) ? 
      executorOutput.industry_analysis.key_nodes : [];
  } else if (executorOutput.analysis && executorOutput.analysis.key_nodes) {
    keyNodes = Array.isArray(executorOutput.analysis.key_nodes) ? 
      executorOutput.analysis.key_nodes : [];
  }
  
  if (executorOutput.industry_chain) {
    industryChain = typeof executorOutput.industry_chain === 'object' ? executorOutput.industry_chain : {};
  } else if (executorOutput.industry_analysis && executorOutput.industry_analysis.industry_chain) {
    industryChain = typeof executorOutput.industry_analysis.industry_chain === 'object' ? 
      executorOutput.industry_analysis.industry_chain : {};
  } else if (executorOutput.analysis && executorOutput.analysis.industry_chain) {
    industryChain = typeof executorOutput.analysis.industry_chain === 'object' ? 
      executorOutput.analysis.industry_chain : {};
  }
  
  if (executorOutput.capital_flow) {
    capitalFlow = typeof executorOutput.capital_flow === 'object' ? executorOutput.capital_flow : {};
  } else if (executorOutput.industry_analysis && executorOutput.industry_analysis.capital_flow) {
    capitalFlow = typeof executorOutput.industry_analysis.capital_flow === 'object' ? 
      executorOutput.industry_analysis.capital_flow : {};
  } else if (executorOutput.analysis && executorOutput.analysis.capital_flow) {
    capitalFlow = typeof executorOutput.analysis.capital_flow === 'object' ? 
      executorOutput.analysis.capital_flow : {};
  }
  
  Logger.log(`P0 generateP0Output：提取到 themes=${themes.length}, subthemes=${subthemes.length}, key_nodes=${keyNodes.length}`);
  
  // ⭐ V8.17.1 新增：如果 themes 和 subthemes 都為空，記錄嚴重警告
  if (themes.length === 0 && subthemes.length === 0) {
    Logger.log(`🚨 P0 嚴重警告：themes 和 subthemes 都為空陣列！`);
    Logger.log(`🚨 P0 可能原因：`);
    Logger.log(`   1. 測試模型（gemini-2.5-flash-lite）能力不足，無法完成如此複雜的分析任務`);
    Logger.log(`   2. Prompt 過於複雜，測試模型無法理解`);
    Logger.log(`   3. JSON Mode 可能導致模型只輸出結構但沒有內容`);
    Logger.log(`🚨 P0 建議：`);
    Logger.log(`   1. 檢查 M0__CROSSCHECK_LOG 中的 EXECUTOR 輸出，確認 AI 是否真的輸出了 themes`);
    Logger.log(`   2. 考慮簡化測試模式的 Prompt，或使用更強的模型進行測試`);
    Logger.log(`   3. 檢查 validation_questions 是否有內容（如果有，表示 AI 至少理解了部分任務）`);
    if (executorOutput.validation_questions && executorOutput.validation_questions.length > 0) {
      Logger.log(`   ✅ 發現 ${executorOutput.validation_questions.length} 個 validation_questions，表示 AI 至少理解了部分任務`);
    }
  }
  
  return {
    themes: themes,
    subthemes: subthemes,
    key_nodes: keyNodes,
    industry_chain: industryChain,
    capital_flow: capitalFlow,  // 純學術分析，不含籌碼面
    auditor_review: auditorOutput.review || auditorOutput.audit_review || null,
    confidence_level: auditorOutput.confidence || auditorOutput.confidence_level || 0.7,
    timestamp: new Date().toISOString(),
    // ⭐ V8.17.1 新增：保留 validation_questions（如果有）
    validation_questions: executorOutput.validation_questions || []
  };
}

// ==========================================
// 快照管理
// ==========================================

/**
 * 獲取最新 P0 快照
 */
function getLatestP0Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const numCols = Math.max(sheet.getLastColumn(), 7);  // 確保至少有 7 個欄位
    const row = sheet.getRange(lastRow, 1, 1, numCols).getValues()[0];
    
    // ⭐ V8.0 修正：確保所有欄位都是正確的類型，避免誤解析
    // row[0] = snapshot_id (字符串)
    // row[1] = created_at (Date 對象)
    // row[2] = trigger (字符串，例如 "LIGHT_TEST") - ⚠️ 不要解析！
    // row[3] = p0_output_json (JSON 字符串)
    // row[4] = changes_json (JSON 字符串)
    // row[5] = context_json (JSON 字符串)
    // row[6] = version (字符串)
    
    // ⭐ V8.0 修正：先確保所有欄位都是正確的類型，避免任何誤解析
    // 特別注意：row[2] (trigger) 是字符串，絕對不要嘗試 JSON.parse
    
    // ⭐ V8.0 修正：安全解析 JSON，避免解析非 JSON 字符串
    let p0OutputJson = {};
    if (row[3]) {
      try {
        const value = row[3];
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          p0OutputJson = JSON.parse(value);
        } else if (typeof value === 'object') {
          p0OutputJson = value;
        }
      } catch (e) {
        Logger.log(`P0 快照 p0_output_json 解析失敗：${e.message}，值=${String(row[3]).substring(0, 50)}`);
        p0OutputJson = {};
      }
    }
    
    let changesJson = null;
    if (row[4]) {
      try {
        const value = row[4];
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          changesJson = JSON.parse(value);
        } else if (typeof value === 'object') {
          changesJson = value;
        }
      } catch (e) {
        Logger.log(`P0 快照 changes_json 解析失敗：${e.message}，值=${String(row[4]).substring(0, 50)}`);
        changesJson = null;
      }
    }
    
    // ⭐ V8.0 新增：讀取 context_json
    let originalContext = {};
    if (row[5]) {
      try {
        const value = row[5];
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          originalContext = JSON.parse(value);
        } else if (typeof value === 'object') {
          originalContext = value;
        }
      } catch (e) {
        Logger.log(`P0 快照 context_json 解析失敗：${e.message}`);
        originalContext = {};
      }
    }
    
    // ⭐ V8.0 修正：確保 trigger 欄位正確處理（字符串，不需要解析）
    const triggerValue = row[2];
    const trigger = (typeof triggerValue === 'string') ? triggerValue : String(triggerValue || "");
    
    return {
      snapshot_id: String(row[0] || ""),
      created_at: row[1] || null,
      trigger: trigger,  // trigger 是字符串，不需要解析
      p0_output_json: p0OutputJson,
      changes_json: changesJson,
      original_context: originalContext,  // ⭐ V8.0 新增：返回原始 context
      version: String(row[6] || row[numCols - 1] || "V7.1")  // version 可能在最後一列
    };
  } catch (error) {
    // ⭐ V8.0 修正：更詳細的錯誤訊息，避免誤導
    // 如果錯誤是因為 JSON 解析，記錄但不中斷執行
    if (error.message && error.message.includes("is not valid JSON")) {
      // 這個錯誤通常是因為表格中的某個欄位不是 JSON 格式（例如 trigger 欄位是字符串）
      // 這是正常情況，不應該中斷執行
      Logger.log(`獲取最新 P0 快照時遇到 JSON 解析錯誤（可能是正常情況）：${error.message}`);
      Logger.log(`提示：此錯誤可能是因為快照表格中的某個欄位不是 JSON 格式（例如 trigger 欄位是字符串 "LIGHT_TEST"）`);
      Logger.log(`這通常發生在第一次執行時，表格中還沒有快照數據，或者表格結構與預期不符`);
      // 返回 null，讓調用者知道沒有快照（這是正常情況，第一次執行時就是這樣）
      return null;
    } else {
      Logger.log(`獲取最新 P0 快照失敗：${error.message}`);
      if (error.stack) {
        Logger.log(`錯誤堆疊：${error.stack}`);
      }
      return null;
    }
  }
}

/**
 * 保存 P0 快照
 */
function saveP0Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P0__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P0__SNAPSHOT");
    sheet.appendRow([
      "snapshot_id",
      "created_at",
      "trigger",
      "p0_output_json",
      "changes_json",
      "context_json",  // ⭐ V8.0 新增：保存 context
      "version"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP0SnapshotId();
  
  // ⭐ V8.0 修正：保存 context 信息（用於下游 Phase 判斷是否為測試模式）
  const contextJson = snapshotData.original_context ? JSON.stringify(snapshotData.original_context) : null;
  
  // ⭐ V8.0 修正：在 p0_output 中添加 job_id 標記，以便後續檢查是否已保存
  const p0OutputWithJobId = {
    ...snapshotData.p0_output,
    _metadata: {
      job_id: snapshotData.job_id,
      snapshot_id: snapshotId,
      created_at: new Date().toISOString()
    }
  };
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(p0OutputWithJobId),
    JSON.stringify(snapshotData.changes),
    contextJson,  // 新增：保存 context
    "V7.1"
  ]);
  
  Logger.log(`P0 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * 生成 P0 快照 ID
 */
function generateP0SnapshotId() {
  const date = new Date();
  const year = date.getFullYear();
  const quarter = Math.floor((date.getMonth() + 3) / 3);
  return `P0_${year}Q${quarter}_${Date.now()}`;
}

/**
 * 比對與上一版快照的變動
 */
/**
 * 通過 job_id 檢查快照是否已存在
 * @param {string} jobId - 任務 ID
 * @return {Object|null} 快照對象，如果不存在則返回 null
 */
function checkP0SnapshotByJobId(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    // 查找包含該 job_id 的快照（job_id 可能在 p0_output_json 中）
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 從最後一行開始查找（最新的快照）
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const p0OutputJson = row[3];  // p0_output_json 欄位
      
      // 嘗試解析 JSON 並檢查是否包含該 job_id
      try {
        const output = typeof p0OutputJson === 'string' ? JSON.parse(p0OutputJson) : p0OutputJson;
        // 檢查快照的 metadata 或其他標識
        // 注意：如果快照表格沒有 job_id 欄位，我們需要通過其他方式識別
        // 暫時返回 null，讓它正常保存
      } catch (e) {
        // 解析失敗，繼續查找
      }
    }
    
    // ⭐ V8.0 修正：通過檢查 p0_output_json 中的 _metadata.job_id 來判斷
    // 從最後一行開始查找（最新的快照）
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const p0OutputJson = row[3];  // p0_output_json 欄位
      
      // 嘗試解析 JSON 並檢查是否包含該 job_id
      try {
        const output = typeof p0OutputJson === 'string' ? JSON.parse(p0OutputJson) : p0OutputJson;
        if (output._metadata && output._metadata.job_id === jobId) {
          // 找到對應的快照，返回
          const numCols = sheet.getLastColumn();
          return {
            snapshot_id: row[0],
            created_at: row[1],
            trigger: row[2],
            p0_output_json: output,
            changes_json: row[4] ? (typeof row[4] === 'string' ? JSON.parse(row[4]) : row[4]) : null,
            original_context: row[5] ? (typeof row[5] === 'string' ? JSON.parse(row[5]) : row[5]) : {},
            version: row[6] || row[numCols - 1] || "V7.1"
          };
        }
      } catch (e) {
        // 解析失敗，繼續查找
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`檢查 P0 快照失敗：${error.message}`);
    return null;
  }
}

function compareWithPreviousSnapshot(currentOutput) {
  const previousSnapshot = getLatestP0Snapshot();
  
  if (!previousSnapshot) {
    return {
      has_changes: true,
      is_first_run: true,
      changes: []
    };
  }
  
  const previousOutput = previousSnapshot.p0_output_json || {};
  const changes = [];
  
  // 比對主題變動
  const currentThemeIds = (currentOutput.themes || []).map(t => t.theme_id);
  const previousThemeIds = (previousOutput.themes || []).map(t => t.theme_id);
  
  const newThemes = currentThemeIds.filter(id => previousThemeIds.indexOf(id) === -1);
  const removedThemes = previousThemeIds.filter(id => currentThemeIds.indexOf(id) === -1);
  
  if (newThemes.length > 0) {
    changes.push({
      type: "NEW_THEMES",
      themes: newThemes
    });
  }
  
  if (removedThemes.length > 0) {
    changes.push({
      type: "REMOVED_THEMES",
      themes: removedThemes
    });
  }
  
  return {
    has_changes: changes.length > 0 || newThemes.length > 0 || removedThemes.length > 0,
    is_first_run: false,
    changes: changes
  };
}

// ==========================================
// 下游觸發
// ==========================================

/**
 * 觸發下游 Phase（P0.7 或 P1）
 */
function triggerDownstreamPhases(sourcePhase, snapshot) {
  if (snapshot.changes && snapshot.changes.has_changes) {
    // 觸發 P0.7（系統動力學分析）
    Logger.log("P0 變動檢測，觸發 P0.7");
    try {
      // ⭐ V8.0 修正：傳遞原始 context（包含 test_mode），確保測試模式時跳過確認
      const context = {
        source_phase: "P0",
        source_snapshot_id: snapshot.snapshot_id
      };
      
      // 如果 snapshot 中有原始 context（測試模式），傳遞給下游
      if (snapshot.original_context) {
        Object.assign(context, snapshot.original_context);
      }
      
      P0_7_Execute({
        trigger: "P0_UPDATE",
        p0_snapshot_id: snapshot.snapshot_id,
        context: context
      });
    } catch (error) {
      Logger.log(`P0 觸發 P0.7 失敗：${error.message}`);
    }
    
    // 注意：P1 會在 P0.7 完成後由 P0.7 觸發
  }
}

// ==========================================
// M0 Job Queue 整合
// ==========================================

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
  
  Logger.log(`P0 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建 P0 產業工程學分析 Prompt
 */
function buildP0Prompt(userInput, context) {
  // ⭐ 測試模式：使用簡化的 prompt（但核心精神必須對齊）⭐ V8.0 更新
  if (context && context.test_mode === true) {
    const themeFocus = userInput.theme_focus || "AI/半導體/新能源";
    
    return `
你是一位資深的產業工程學分析師，負責進行 Nuclear Project 的 Phase 0 分析。

## ⭐⭐⭐ 核心任務定位（測試模式）

**Phase 0 的目標是建立「必然位置表」**，不是選股清單。

你的任務是：找出未來 **3-10 年內**，在 **物理/工程** 與 **制度/通道/流程** 層面**不可或缺且難以被 scale 替代**的大主題（Theme）與細項（Subtheme）。

## ⭐⭐⭐ 核心任務（測試模式）

**P0 的任務是自動找出所有目前能夠找出的面向，不需要使用者指定。**

**⚠️ 測試模式要求（嚴格限制）：**
- **第一類（工程不可替代性）**：**只找 1 個** 工程瓶頸類的面向（不要多找）
- **第二類（定價權獨佔性）**：**只找 1 個** 定價權獨佔類的面向（不要多找）
- **總共只輸出 2 個面向**（1 個工程瓶頸類 + 1 個定價權獨佔類）

**分析範圍：**
- 產業方向：${themeFocus}（此為測試參考）
- 要求：具有清晰的工程必然性或結構性定價權

## 簡化分析要求（測試模式）

**⚠️ 注意：這是測試模式，但核心精神必須對齊。你仍然需要完成：**

1. **P0-ENG 工程必然分析（工程不可替代性 - 測試模式）**：
   - **只分析 1 個** 工程瓶頸類的面向（不要多找）
   - 分析一個系統參數失控（功耗/熱密度/頻率/電流密度/互連延遲）
   - 分析一個物理失效模式（熱失控/訊號衰減/應力崩潰/可靠度失效）
   - 簡要審查替代解法（是否已成熟、是否可 scale、是否可量產）

2. **P0-STRUCT 結構性定價權分析（定價權獨佔性 - 測試模式）**：
   - **只分析 1 個** 定價權獨佔類的面向（不要多找）
   - 判斷結構節點定位（必經節點/流程OS/合規入口/樞紐控制）
   - 分析一個失效模式（交易失效/合規不通/責任不可承擔/流程崩潰）
   - 簡要審查替代路徑（法規門檻/網路效應門檻/切換成本門檻）

3. **P0-3 強制輸出（五項缺一不可）**：
   - Problem_OneLiner（工程/結構問題一句話）
   - Failure_Mode（不用會怎樣）
   - No_Alternative_Reason（為何不可替代）
   - Convergence_Evidence（工程/制度/行為收斂證據）
   - Long_Term_Time_Window（3-10 年窗口）

4. **P0-4 否決檢查**：
   - 檢查是否符合否決條件
   - 如果符合，必須標註 rejection_check

## 輸出格式（必須是 JSON）：

{
  "themes": [
    {
      "theme_id": "THEME_001",
      "theme_name": "選擇的產業主題名稱（例如：AI 半導體、新能源車、雲計算等）",
      "description": "主題描述（2-3 句話）",
      "geographic_scope": "US/JP/TW/GLOBAL",
      "time_horizon": "3-10 年",
      "analysis_type": "ENG/STRUCT/BOTH",
      
      // ⭐ P0-3 強制輸出（五項缺一不可）
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": {
        "physical": "物理失效說明（如果適用）",
        "compliance": "合規失效說明（如果適用）",
        "process": "流程失效說明（如果適用）"
      },
      "no_alternative_reason": {
        "what_to_rebuild": "替代者要重建什麼",
        "why_impossible": "為何不可能在合理時間內完成"
      },
      "convergence_evidence": {
        "engineering": ["工程收斂證據1"],
        "institutional": ["制度收斂證據1"]
      },
      "long_term_time_window": {
        "mass_production": "量產時間點",
        "institutional_landing": "制度落地時間點",
        "penetration_milestones": ["滲透率關鍵節點1"]
      },
      
      // P0-ENG 分析結果（簡化版）
      "p0_eng": {
        "system_parameters": {
          "power": "功耗分析（簡化）"
        },
        "physical_failure_modes": {
          "thermal_runaway": "熱失控分析（簡化）"
        },
        "alternative_solutions": {
          "maturity": "成熟度評估",
          "scalability": "可擴張性評估"
        }
      },
      
      // P0-STRUCT 分析結果（簡化版）
      "p0_struct": {
        "structural_node_type": "必經節點/流程OS/合規入口/樞紐控制",
        "failure_modes": {
          "transaction": "交易失效說明（簡化）"
        },
        "alternative_paths": {
          "regulatory_barriers": "法規門檻",
          "switching_cost_barriers": "切換成本門檻",
          "time_cost_estimate": "時間成本估計"
        }
      },
      
      // 否決檢查結果
      "rejection_check": {
        "p0_eng_rejected": false,
        "p0_eng_rejection_reason": null,
        "p0_struct_rejected": false,
        "p0_struct_rejection_reason": null
      }
    }
  ],
  "subthemes": [
    {
      "subtheme_id": "SUBTHEME_001",
      "theme_id": "THEME_001",
      "subtheme_name": "子主題1",
      "description": "子主題描述",
      // ⭐ P0-3 強制輸出（格式同 themes，可簡化）
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 簡化版 */ },
      "no_alternative_reason": { /* 簡化版 */ },
      "convergence_evidence": { /* 簡化版 */ },
      "long_term_time_window": { /* 簡化版 */ },
      "p0_eng": { /* 簡化版 */ },
      "p0_struct": { /* 簡化版 */ },
      "rejection_check": { /* 同 themes */ }
    }
  ],
  "confidence_level": 0.8,
  "analysis_date": "${new Date().toISOString().split('T')[0]}"
}

## ⚠️ 測試模式嚴格限制

1. **數量限制**：**只輸出 2 個面向**（1 個工程瓶頸類 + 1 個定價權獨佔類），不要多找。

2. **核心精神必須對齊**：雖然是測試模式，但「必然位置表」的核心精神不能偏離。

## ⭐ V8.17.1 新增：排除指令（允許說「沒有」）

**⚠️ 重要：如果沒有不可逆的物理/經濟約束存在，你必須明確說明：**

**If no irreversible physical / economic constraint exists, explicitly state: "This is NOT a valid structural theme."**

**這不是限制 AI，而是允許它說「沒有」（很重要）**

- ✅ **如果找不到符合條件的結構性主題，明確輸出 "This is NOT a valid structural theme"**
- ✅ **不要為了輸出而硬湊主題**
- ✅ **寧可說「沒有」，也不要強行創造不符合條件的主題**

3. **P0-3 強制輸出缺一不可**：即使測試模式，五項強制輸出也必須完成。

4. **時間窗口必須是 3-10 年**：所有分析必須基於未來 3-10 年的時間窗口。

5. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確。

6. **這是測試模式，可以簡化分析深度，但結構必須完整**。

---

## ⭐ V8.14 新增：模型內建知識時效性防呆

請分析你篩選出的潛力產業。針對每一個產業，誠實地列出你「因為訓練數據截止而無法確定的 2025-2026 最新動態」（例如：具體的良率數據、最新通過驗證的供應商名單、剛發布的法規細節）。

並針對上述盲點，提出「由於你內建知識時效或廣度不足而必須查核的關鍵問題」。

**要求**：
- 這些問題必須是能透過查詢「學術論文」、「頂級投行研報 (IB Reports)」或「產業智庫白皮書」來回答的硬數據
- 你必須主動提供每個問題的硬數據報告應該要去哪裡下載或搜尋（給網址、網站、或是關鍵字與準確白名單）
- 資料來源必須能夠準確下載到能解決你的提問的文件檔案
- Gemini 會按照你提供的資料來源分析文件內容，並擷取相關的上下文給你看，讓你自己解決自己的提問

**審查標準**：
- **來源權威性**：資料是否來自 Tier 1 機構（如 Goldman, McKinsey, IEEE, Nature, 政府單位）？野雞報告一律不採信
- **時效性**：資料是否為近 12 個月內發布？過時資料不採信
- **引用精確度**：回答中是否提供了具體的頁數 (Page Number) 與原文引述？若含糊其辭，視為幻覺

**最終判決**：
基於你內建的深層邏輯，結合回覆的「合格證據」，完整評估該產業的潛力是否符合要求並給出最終分析結論。若證據顯示市場過熱或技術卡關，請果斷否決。

**輸出格式**（在原有 JSON 格式中新增 \`validation_questions\` 欄位）：
{
  "themes": [
    {
      "theme_id": "THEME_001",
      "theme_name": "主題名稱",
      "description": "主題描述",
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 格式同原有輸出 */ },
      "no_alternative_reason": { /* 格式同原有輸出 */ },
      "convergence_evidence": { /* 格式同原有輸出 */ },
      "long_term_time_window": { /* 格式同原有輸出 */ },
      "p0_eng": { /* 格式同原有輸出 */ },
      "p0_struct": { /* 格式同原有輸出 */ },
      "rejection_check": { /* 格式同原有輸出 */ },
      "validation_questions": [
        {
          "question_id": "Q001",
          "question_text": "問題內容",
          "data_source_url": "資料來源網址（可選）",
          "data_source_site": "資料來源網站（可選）",
          "data_source_keywords": "關鍵字（可選）",
          "expected_document_title": "預期文件標題（可選）"
        }
      ]
    }
  ],
  "subthemes": [
    {
      "subtheme_id": "SUBTHEME_001",
      "theme_id": "THEME_001",
      "subtheme_name": "子主題名稱",
      "description": "子主題描述",
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 格式同原有輸出 */ },
      "no_alternative_reason": { /* 格式同原有輸出 */ },
      "convergence_evidence": { /* 格式同原有輸出 */ },
      "long_term_time_window": { /* 格式同原有輸出 */ },
      "p0_eng": { /* 格式同原有輸出 */ },
      "p0_struct": { /* 格式同原有輸出 */ },
      "rejection_check": { /* 格式同原有輸出 */ },
      "validation_questions": [
        {
          "question_id": "Q001",
          "question_text": "問題內容",
          "data_source_url": "資料來源網址（可選）",
          "data_source_site": "資料來源網站（可選）",
          "data_source_keywords": "關鍵字（可選）",
          "expected_document_title": "預期文件標題（可選）"
        }
      ]
    }
  ],
  "confidence_level": 0.8,
  "analysis_date": "YYYY-MM-DD"
}

**注意**：不限定問題數目，沒有也沒關係。只提出「由於你內建知識時效或廣度不足而必須查核的關鍵問題」。
`;
  }
  
  // 正式模式：使用完整的 prompt ⭐ V8.0 完全重寫，對齊任務精神
  const themeFocus = userInput.theme_focus || "";
  const geographicFocus = userInput.geographic_focus || "ALL";
  const timeHorizon = userInput.time_horizon || "MEDIUM";
  
  return `
你是一位資深的產業工程學分析師，負責進行 Nuclear Project 的 Phase 0 分析。

## ⭐⭐⭐ 核心任務定位

**Phase 0 的目標是建立「必然位置表」**，不是選股清單。

**P0 的任務是自動找出所有目前能夠找出的面向，不需要使用者指定面向。**

你的任務是：**主動分析並找出**未來 **3-10 年內**，在 **物理/工程** 與 **制度/通道/流程** 層面**不可或缺且難以被 scale 替代**的大主題（Theme）與細項（Subtheme）。

**必須找出兩大類的所有面向：**

1. **第一類：工程不可替代性（工程瓶頸類）**
   - 分析所有具有工程瓶頸特徵的面向
   - 找出所有在物理/工程層面不可或缺的 Theme/Subtheme

2. **第二類：定價權獨佔性（服務壟斷類）**
   - 分析所有具有定價權獨佔特徵的面向
   - 找出所有在制度/通道/流程層面具有結構性定價權的 Theme/Subtheme

**輸出定位**：「工程世界 + 制度世界 已經幫你選好的必然位置表」

## 分析範圍

- **主題範圍**：${themeFocus || "不限（全面分析）"}
- **地理區域**：${geographicFocus}
- **時間維度**：${timeHorizon}

**⚠️ 重要：你必須主動分析並找出所有符合條件的面向，而不是等待使用者指定。**

---

## P0-2 分析模組（固定順序，不得跳步）

### ⚠️ 重要：必須按照以下順序完成分析，不得跳步

---

### P0-ENG｜工程必然分析模組（A-E，固定順序）

**必須完成 A-E 五個步驟，缺一不可：**

#### A. 系統參數失控分析

針對每個 Theme/Subtheme，必須分析以下系統參數是否會失控：
- **功耗（Power）**：是否達到物理極限？
- **熱密度（Thermal density）**：散熱是否成為瓶頸？
- **頻率/時脈（Frequency）**：時脈提升是否遇到物理限制？
- **電流密度（Current density）**：電流密度是否達到材料極限？
- **互連延遲（Interconnect latency）**：互連延遲是否成為系統瓶頸？

**輸出要求**：列出哪些參數會失控，以及失控的具體表現。

#### B. 物理失效模式分析

必須分析如果不用該技術/方案，會發生哪些物理失效：
- **熱失控（Thermal runaway）**：是否會導致系統過熱失效？
- **訊號衰減（Signal attenuation）**：訊號是否會衰減到無法使用？
- **應力崩潰（Stress fracture / warpage）**：是否會導致結構失效？
- **可靠度失效（Reliability / lifetime failure）**：是否會導致系統壽命不足？

**輸出要求**：明確說明「不用會怎樣」的物理後果。

#### C. 替代解法審查

必須審查是否存在替代解法，並評估：
- **是否已成熟（成熟度）**：替代解法是否已經成熟可用？
- **是否可 scale（可擴張性）**：替代解法是否可以擴展到所需規模？
- **是否可量產（量產性）**：替代解法是否可以大規模量產？
- **成本曲線是否可行（成本下降路徑）**：替代解法的成本是否會下降？

**輸出要求**：如果存在成熟可 scale 的替代解法，該 Theme/Subtheme 應被否決。

#### D. 工程收斂證據

必須尋找以下收斂證據：
- **標準/組織收斂**：JEDEC / OCP / SEMI / IEEE 等標準組織是否已收斂到該方案？
- **Foundry/CSP/Vendor 路線一致性**：多方 Roadmap 是否同向（例如：台積電、三星、英特爾的路線圖是否一致）？

**輸出要求**：列出具體的收斂證據（標準文件、Roadmap 文件等）。

#### E. 不可逆性（Lock-in）分析

必須分析是否存在不可逆性：
- **回頭代價高**：重新設計、改製程、換平台的成本是否極高？
- **路線鎖定**：是否存在 Ecosystem lock-in / toolchain lock-in？

**輸出要求**：明確說明為何一旦選擇該路線就難以回頭。

---

### P0-STRUCT｜結構性定價權分析模組（A-E，固定順序）

**必須完成 A-E 五個步驟，缺一不可：**

#### A. 結構節點定位

必須判斷此能力/服務在系統中扮演哪一種角色（至少命中一項）：
- **必經節點（必走通道）**：是否為系統中必須經過的節點？
- **流程 OS（工作流作業系統/預設路徑）**：是否為工作流的預設路徑？
- **合規入口（認證/稽核/合規必經）**：是否為合規流程的必經入口？
- **樞紐/通道控制（Hub / routing / distribution）**：是否控制系統的樞紐或通道？

**輸出要求**：明確說明該 Theme/Subtheme 在系統中的結構性角色。

#### B. 失效模式分析（不用會怎樣）

必須分析如果不用該方案，會發生哪些失效：
- **交易失效**：交易是否不能完成？
- **合規不通**：是否無法合規/無法交付？
- **責任不可承擔**：風險責任是否無法承擔？
- **流程崩潰**：營運/供應鏈/治理流程是否會斷裂？

**輸出要求**：明確說明「不用會怎樣」的具體後果。

#### C. 替代路徑審查

必須審查替代路徑，並列出替代者必須跨過哪些門檻：
- **法規門檻**：是否需要通過特定法規認證？
- **網路效應門檻**：是否需要建立網路效應？
- **資料門檻**：是否需要累積特定資料？
- **系統控制權門檻**：是否需要獲得系統控制權？
- **切換成本門檻**：切換成本是否極高？

**並估計其「時間成本」**：替代路徑是否可能在合理時間內完成？

**輸出要求**：如果替代路徑可在合理時間完成，該 Theme/Subtheme 應被否決。

#### D. 收斂證據

必須尋找以下收斂證據（至少一項）：
- **監管/政策/法規文件**：是否有明確的法規要求？
- **標準文件（含驗證制度）**：是否有標準文件支持？
- **產業慣例/採用證據**：是否有廣泛的產業採用？
- **用戶習慣/行為收斂**：用戶行為是否已收斂？

**輸出要求**：列出具體的收斂證據。

#### E. 再定價觸發器

必須分析是否存在「新技術層」疊加導致舊護城河放大或質變：
- **AI / Agent**：AI 技術是否會放大該護城河？
- **新介面（UI/UX、API、平台）**：新介面是否會強化該位置？
- **新制度/新標準落地**：新制度是否會強化該位置？

**輸出要求**：說明再定價觸發器如何強化該 Theme/Subtheme 的必然性。

---

## P0-3 強制輸出（五項缺一不可｜未完成不得進 P0.7）

**⚠️ 重要：每一個 Theme/Subtheme 必須輸出以下五項，缺一不可。未完成不得進入 P0.7。**

1. **Problem_OneLiner**（工程/結構問題一句話）
   - 必須用一句話概括該 Theme/Subtheme 要解決的核心工程或結構問題

2. **Failure_Mode**（不用會怎樣：物理/合規/流程/交易/責任）
   - 必須明確說明如果不用該方案，會發生哪些失效（物理失效、合規失效、流程失效、交易失效、責任失效）

3. **No_Alternative_Reason**（為何不可替代：替代者要重建什麼、為何不可能在合理時間完成）
   - 必須明確說明為何不可替代
   - 必須說明替代者要重建什麼（法規、網路效應、資料、系統控制權、切換成本等）
   - 必須說明為何不可能在合理時間內完成

4. **Convergence_Evidence**（工程/制度/行為收斂證據）
   - 必須列出具體的收斂證據（標準文件、Roadmap、法規文件、產業慣例、用戶行為等）

5. **Long_Term_Time_Window**（3-10 年窗口：量產/制度落地/滲透率節點）
   - 必須明確說明該 Theme/Subtheme 在未來 3-10 年內的關鍵時間節點
   - 必須說明量產時間點、制度落地時間點、滲透率關鍵節點

## ⭐ V8.27 新增：必然性等級評估（Conviction Level）

**任務**：評估每個 Theme/Subtheme 的必然性等級

**必然性等級定義**：
- **ULTRA_HIGH**：
  * 產業需求結構性增長（CAGR >= 40%，3 年以上）
  * 公司是絕對龍頭（市佔率 > 60%）
  * 護城河極寬（技術領先 2 代以上 或 生態系統鎖定）
  * 信心度 >= 0.90

- **HIGH**：
  * 產業需求明確增長（CAGR >= 25%，2 年以上）
  * 公司是龍頭（市佔率 > 40%）
  * 護城河寬（技術領先 1 代 或 品牌優勢）
  * 信心度 >= 0.75

- **MEDIUM**：
  * 產業趨勢明確（CAGR >= 15%）
  * 公司有優勢（市佔率 > 20%）
  * 信心度 >= 0.60

- **LOW**：
  * 一般機會
  * 信心度 < 0.60

**輸出要求**：
- 每個 Theme/Subtheme 必須輸出 \`conviction_level\`、\`conviction_reasoning\`、\`conviction_confidence\`

---

## P0-4 失敗條件（任一成立即否決該 Theme/Subtheme）

**⚠️ 重要：如果以下任一條件成立，該 Theme/Subtheme 必須被否決。**

### P0-ENG 否決條件：

- ❌ **僅來自敘事/政策炒作，無工程失效模式**：如果該 Theme/Subtheme 僅來自市場敘事或政策炒作，但沒有明確的工程失效模式，必須否決。

- ❌ **已存在成熟可 scale 替代解法**：如果已存在成熟且可擴展的替代解法，必須否決。

- ❌ **可透過降規格解決（代表非必然）**：如果可以透過降低規格來解決問題，代表該方案非必然，必須否決。

- ❌ **無法清楚說明「不用會怎樣」**：如果無法清楚說明「不用會怎樣」的具體後果，必須否決。

### P0-STRUCT 否決條件：

- ❌ **僅市占高/品牌強，但無失效模式**：如果僅因為市占率高或品牌強，但沒有明確的失效模式，必須否決。

- ❌ **替代路徑可在合理時間完成（可平替、可多供應商）**：如果替代路徑可在合理時間內完成（可平替、可多供應商），必須否決。

- ❌ **只是單一產品成功，缺乏制度/通道/流程/控制權**：如果只是單一產品成功，但缺乏制度、通道、流程或控制權的支撐，必須否決。

- ❌ **只靠補貼/價格戰形成黏著**：如果只靠補貼或價格戰形成黏著，但沒有結構性必然性，必須否決。

- ❌ **無法清楚回答「客戶為何逃不掉」**：如果無法清楚回答「客戶為何逃不掉」，必須否決。

---

## 輸出格式（必須是 JSON）

**⚠️ 重要：輸出必須是有效的 JSON 格式，且必須包含 P0-3 強制輸出的五項。**

{
  "themes": [
    {
      "theme_id": "THEME_001",
      "theme_name": "主題名稱",
      "description": "主題描述",
      "geographic_scope": "US/JP/TW/GLOBAL",
      "time_horizon": "3-10 年",
      "analysis_type": "ENG/STRUCT/BOTH",  // 工程必然 / 結構性定價權 / 兩者皆有
      
      // ⭐ P0-3 強制輸出（五項缺一不可）
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": {
        "physical": "物理失效說明（如果適用）",
        "compliance": "合規失效說明（如果適用）",
        "process": "流程失效說明（如果適用）",
        "transaction": "交易失效說明（如果適用）",
        "liability": "責任失效說明（如果適用）"
      },
      "no_alternative_reason": {
        "what_to_rebuild": "替代者要重建什麼（法規、網路效應、資料、系統控制權、切換成本等）",
        "why_impossible": "為何不可能在合理時間內完成"
      },
      "convergence_evidence": {
        "engineering": ["工程收斂證據1", "工程收斂證據2"],
        "institutional": ["制度收斂證據1", "制度收斂證據2"],
        "behavioral": ["行為收斂證據1", "行為收斂證據2"]
      },
      "long_term_time_window": {
        "mass_production": "量產時間點（例如：2026 Q2）",
        "institutional_landing": "制度落地時間點（例如：2027）",
        "penetration_milestones": ["滲透率關鍵節點1", "滲透率關鍵節點2"]
      },
      
      // P0-ENG 分析結果（如果適用）
      "p0_eng": {
        "system_parameters": {
          "power": "功耗分析",
          "thermal_density": "熱密度分析",
          "frequency": "頻率/時脈分析",
          "current_density": "電流密度分析",
          "interconnect_latency": "互連延遲分析"
        },
        "physical_failure_modes": {
          "thermal_runaway": "熱失控分析",
          "signal_attenuation": "訊號衰減分析",
          "stress_fracture": "應力崩潰分析",
          "reliability_failure": "可靠度失效分析"
        },
        "alternative_solutions": {
          "maturity": "成熟度評估",
          "scalability": "可擴張性評估",
          "mass_production": "量產性評估",
          "cost_curve": "成本曲線評估"
        },
        "convergence_evidence": {
          "standards_organizations": ["JEDEC", "OCP", "SEMI", "IEEE"],
          "roadmap_alignment": "Foundry/CSP/Vendor 路線一致性說明"
        },
        "irreversibility": {
          "switching_cost": "回頭代價說明",
          "lock_in": "路線鎖定說明"
        }
      },
      
      // P0-STRUCT 分析結果（如果適用）
      "p0_struct": {
        "structural_node_type": "必經節點/流程OS/合規入口/樞紐控制",
        "failure_modes": {
          "transaction": "交易失效說明",
          "compliance": "合規不通說明",
          "liability": "責任不可承擔說明",
          "process": "流程崩潰說明"
        },
        "alternative_paths": {
          "regulatory_barriers": "法規門檻",
          "network_effect_barriers": "網路效應門檻",
          "data_barriers": "資料門檻",
          "control_barriers": "系統控制權門檻",
          "switching_cost_barriers": "切換成本門檻",
          "time_cost_estimate": "時間成本估計"
        },
        "convergence_evidence": {
          "regulatory": "監管/政策/法規文件",
          "standards": "標準文件（含驗證制度）",
          "industry_practices": "產業慣例/採用證據",
          "user_behavior": "用戶習慣/行為收斂"
        },
        "repricing_triggers": {
          "ai_agent": "AI/Agent 影響",
          "new_interfaces": "新介面影響",
          "new_institutions": "新制度/新標準影響"
        }
      },
      
      // 否決檢查結果
      "rejection_check": {
        "p0_eng_rejected": false,  // 如果 P0-ENG 否決條件成立，設為 true
        "p0_eng_rejection_reason": null,  // 否決原因
        "p0_struct_rejected": false,  // 如果 P0-STRUCT 否決條件成立，設為 true
        "p0_struct_rejection_reason": null  // 否決原因
      },
      // ⭐ V8.27 新增：必然性等級評估
      "conviction_level": "ULTRA_HIGH" | "HIGH" | "MEDIUM" | "LOW",
      "conviction_reasoning": [
        "AI 晶片需求 2024-2026 CAGR 50%+（結構性增長）",
        "NVIDIA 是絕對龍頭（市佔率 > 80%）",
        "護城河極寬（CUDA 生態系統 + 技術領先 2 代）"
      ],
      "conviction_confidence": 0.95  // 0.0-1.0
    }
  ],
  "subthemes": [
    {
      "subtheme_id": "SUBTHEME_001",
      "theme_id": "THEME_001",
      "subtheme_name": "子主題名稱",
      "description": "子主題描述",
      
      // ⭐ P0-3 強制輸出（五項缺一不可，格式同 themes）
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 同 themes */ },
      "no_alternative_reason": { /* 同 themes */ },
      "convergence_evidence": { /* 同 themes */ },
      "long_term_time_window": { /* 同 themes */ },
      
      // P0-ENG 和 P0-STRUCT 分析結果（格式同 themes）
      "p0_eng": { /* 同 themes */ },
      "p0_struct": { /* 同 themes */ },
      "rejection_check": { /* 同 themes */ },
      // ⭐ V8.27 新增：必然性等級評估（格式同 themes）
      "conviction_level": "ULTRA_HIGH" | "HIGH" | "MEDIUM" | "LOW",
      "conviction_reasoning": [ /* 同 themes */ ],
      "conviction_confidence": 0.0-1.0
    }
  ],
  "confidence_level": 0.0-1.0,
  "analysis_date": "${new Date().toISOString().split('T')[0]}"
}

---

## 注意事項

1. **必須按照固定順序完成分析**：P0-ENG A-E → P0-STRUCT A-E，不得跳步。

2. **P0-3 強制輸出缺一不可**：每一個 Theme/Subtheme 必須輸出五項（Problem_OneLiner、Failure_Mode、No_Alternative_Reason、Convergence_Evidence、Long_Term_Time_Window），未完成不得進入 P0.7。

3. **嚴格執行否決條件**：如果 P0-4 否決條件成立，該 Theme/Subtheme 必須被否決，並在 rejection_check 中標註。

4. **時間窗口必須是 3-10 年**：所有分析必須基於未來 3-10 年的時間窗口。

5. **必須基於事實和數據**：避免主觀臆測，所有分析必須基於事實和數據。

6. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確，可以被程式解析。

7. **每個主題、子主題都必須有唯一 ID**：theme_id 和 subtheme_id 必須唯一。

8. **明確區分工程必然和結構性定價權**：如果一個 Theme/Subtheme 同時涉及兩者，必須同時完成 P0-ENG 和 P0-STRUCT 分析。

---

## ⭐ V8.14 新增：模型內建知識時效性防呆

請分析你篩選出的潛力產業。針對每一個產業，誠實地列出你「因為訓練數據截止而無法確定的 2025-2026 最新動態」（例如：具體的良率數據、最新通過驗證的供應商名單、剛發布的法規細節）。

並針對上述盲點，提出「由於你內建知識時效或廣度不足而必須查核的關鍵問題」。

**要求**：
- 這些問題必須是能透過查詢「學術論文」、「頂級投行研報 (IB Reports)」或「產業智庫白皮書」來回答的硬數據
- 你必須主動提供每個問題的硬數據報告應該要去哪裡下載或搜尋（給網址、網站、或是關鍵字與準確白名單）
- 資料來源必須能夠準確下載到能解決你的提問的文件檔案
- Gemini 會按照你提供的資料來源分析文件內容，並擷取相關的上下文給你看，讓你自己解決自己的提問

**審查標準**：
- **來源權威性**：資料是否來自 Tier 1 機構（如 Goldman, McKinsey, IEEE, Nature, 政府單位）？野雞報告一律不採信
- **時效性**：資料是否為近 12 個月內發布？過時資料不採信
- **引用精確度**：回答中是否提供了具體的頁數 (Page Number) 與原文引述？若含糊其辭，視為幻覺

**最終判決**：
基於你內建的深層邏輯，結合回覆的「合格證據」，完整評估該產業的潛力是否符合要求並給出最終分析結論。若證據顯示市場過熱或技術卡關，請果斷否決。

**輸出格式**（在原有 JSON 格式中新增 \`validation_questions\` 欄位）：
{
  "themes": [
    {
      "theme_id": "THEME_001",
      "theme_name": "主題名稱",
      "description": "主題描述",
      "geographic_scope": "US/JP/TW/GLOBAL",
      "time_horizon": "3-10 年",
      "analysis_type": "ENG/STRUCT/BOTH",
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 格式同原有輸出 */ },
      "no_alternative_reason": { /* 格式同原有輸出 */ },
      "convergence_evidence": { /* 格式同原有輸出 */ },
      "long_term_time_window": { /* 格式同原有輸出 */ },
      "p0_eng": { /* 格式同原有輸出 */ },
      "p0_struct": { /* 格式同原有輸出 */ },
      "rejection_check": { /* 格式同原有輸出 */ },
      "validation_questions": [
        {
          "question_id": "Q001",
          "question_text": "問題內容",
          "data_source_url": "資料來源網址（可選）",
          "data_source_site": "資料來源網站（可選）",
          "data_source_keywords": "關鍵字（可選）",
          "expected_document_title": "預期文件標題（可選）"
        }
      ]
    }
  ],
  "subthemes": [
    {
      "subtheme_id": "SUBTHEME_001",
      "theme_id": "THEME_001",
      "subtheme_name": "子主題名稱",
      "description": "子主題描述",
      "problem_oneliner": "工程/結構問題一句話",
      "failure_mode": { /* 格式同原有輸出 */ },
      "no_alternative_reason": { /* 格式同原有輸出 */ },
      "convergence_evidence": { /* 格式同原有輸出 */ },
      "long_term_time_window": { /* 格式同原有輸出 */ },
      "p0_eng": { /* 格式同原有輸出 */ },
      "p0_struct": { /* 格式同原有輸出 */ },
      "rejection_check": { /* 格式同原有輸出 */ },
      "validation_questions": [
        {
          "question_id": "Q001",
          "question_text": "問題內容",
          "data_source_url": "資料來源網址（可選）",
          "data_source_site": "資料來源網站（可選）",
          "data_source_keywords": "關鍵字（可選）",
          "expected_document_title": "預期文件標題（可選）"
        }
      ]
    }
  ],
  "confidence_level": 0.0-1.0,
  "analysis_date": "YYYY-MM-DD"
}

**注意**：不限定問題數目，沒有也沒關係。只提出「由於你內建知識時效或廣度不足而必須查核的關鍵問題」。
`;
}

/**
 * 構建機構級數據搜尋查詢
 */
// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取主題相關的公司（輔助函數）
 * @param {Object} theme - 主題對象
 * @return {Array} 主題相關的公司列表
 */
function getThemeCompanies(theme) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Master_Candidates");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("Phase1_Master_Candidates 表格不存在或沒有數據，嘗試從 Tracking_Pool 讀取");
      return getThemeCompaniesFromTrackingPool(theme);
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 找到欄位索引
    const themeIdCol = headers.indexOf("Theme_ID");
    const companyCodeCol = headers.indexOf("Company_Code");
    const companyNameCol = headers.indexOf("Company_Name");
    const marketCol = headers.indexOf("Market");
    
    if (themeIdCol === -1) {
      Logger.log("Phase1_Master_Candidates 表格缺少 Theme_ID 欄位");
      return [];
    }
    
    const companies = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[themeIdCol] === theme.theme_id) {
        companies.push({
          ticker: companyCodeCol !== -1 ? row[companyCodeCol] : "",
          name: companyNameCol !== -1 ? row[companyNameCol] : "",
          market: marketCol !== -1 ? row[marketCol] : ""
        });
      }
    }
    
    Logger.log(`從 Phase1_Master_Candidates 找到 ${companies.length} 個主題相關公司：theme_id=${theme.theme_id}`);
    
    // 如果沒有找到，嘗試從 Tracking_Pool 讀取
    if (companies.length === 0) {
      return getThemeCompaniesFromTrackingPool(theme);
    }
    
    return companies;
  } catch (error) {
    Logger.log(`獲取主題相關公司失敗：${error.message}`);
    return [];
  }
}

/**
 * 從 Tracking_Pool 獲取主題相關的公司
 */
function getThemeCompaniesFromTrackingPool(theme) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Tracking_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const themeIdCol = headers.indexOf("Theme_ID");
    const companyCodeCol = headers.indexOf("Company_Code");
    const companyNameCol = headers.indexOf("Company_Name");
    const marketCol = headers.indexOf("Market");
    
    if (themeIdCol === -1) {
      return [];
    }
    
    const companies = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[themeIdCol] === theme.theme_id) {
        companies.push({
          ticker: companyCodeCol !== -1 ? row[companyCodeCol] : "",
          name: companyNameCol !== -1 ? row[companyNameCol] : "",
          market: marketCol !== -1 ? row[marketCol] : ""
        });
      }
    }
    
    Logger.log(`從 Phase1_Tracking_Pool 找到 ${companies.length} 個主題相關公司：theme_id=${theme.theme_id}`);
    
    return companies;
  } catch (error) {
    Logger.log(`從 Tracking_Pool 獲取主題相關公司失敗：${error.message}`);
    return [];
  }
}

/**
 * 獲取技術節點相關的公司（輔助函數）
 * @param {Object} node - 技術節點對象
 * @return {Array} 技術節點相關的公司列表
 */
function getNodeCompanies(node) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Master_Candidates");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("Phase1_Master_Candidates 表格不存在或沒有數據，嘗試從 Tracking_Pool 讀取");
      return getNodeCompaniesFromTrackingPool(node);
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 找到欄位索引
    const nodeCol = headers.indexOf("Primary_Technology_or_Node");
    const companyCodeCol = headers.indexOf("Company_Code");
    const companyNameCol = headers.indexOf("Company_Name");
    const marketCol = headers.indexOf("Market");
    
    if (nodeCol === -1) {
      Logger.log("Phase1_Master_Candidates 表格缺少 Primary_Technology_or_Node 欄位");
      return [];
    }
    
    const companies = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nodeValue = row[nodeCol];
      
      // 完全匹配或部分匹配
      if (nodeValue === node.node_name || 
          (nodeValue && typeof nodeValue === "string" && nodeValue.indexOf(node.node_name) !== -1)) {
        companies.push({
          ticker: companyCodeCol !== -1 ? row[companyCodeCol] : "",
          name: companyNameCol !== -1 ? row[companyNameCol] : "",
          market: marketCol !== -1 ? row[marketCol] : ""
        });
      }
    }
    
    Logger.log(`從 Phase1_Master_Candidates 找到 ${companies.length} 個技術節點相關公司：node_name=${node.node_name}`);
    
    // 如果沒有找到，嘗試從 Tracking_Pool 讀取
    if (companies.length === 0) {
      return getNodeCompaniesFromTrackingPool(node);
    }
    
    return companies;
  } catch (error) {
    Logger.log(`獲取技術節點相關公司失敗：${error.message}`);
    return [];
  }
}

/**
 * 從 Tracking_Pool 獲取技術節點相關的公司
 */
function getNodeCompaniesFromTrackingPool(node) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Tracking_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const nodeCol = headers.indexOf("Primary_Technology_or_Node");
    const companyCodeCol = headers.indexOf("Company_Code");
    const companyNameCol = headers.indexOf("Company_Name");
    const marketCol = headers.indexOf("Market");
    
    if (nodeCol === -1) {
      return [];
    }
    
    const companies = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nodeValue = row[nodeCol];
      
      if (nodeValue === node.node_name || 
          (nodeValue && typeof nodeValue === "string" && nodeValue.indexOf(node.node_name) !== -1)) {
        companies.push({
          ticker: companyCodeCol !== -1 ? row[companyCodeCol] : "",
          name: companyNameCol !== -1 ? row[companyNameCol] : "",
          market: marketCol !== -1 ? row[marketCol] : ""
        });
      }
    }
    
    Logger.log(`從 Phase1_Tracking_Pool 找到 ${companies.length} 個技術節點相關公司：node_name=${node.node_name}`);
    
    return companies;
  } catch (error) {
    Logger.log(`從 Tracking_Pool 獲取技術節點相關公司失敗：${error.message}`);
    return [];
  }
}
