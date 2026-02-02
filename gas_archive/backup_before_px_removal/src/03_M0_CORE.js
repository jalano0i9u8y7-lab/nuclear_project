/**
 * 🔧 M0 工具機核心執行邏輯
 * 
 * M0 Job Queue 處理器、執行流程控制、錯誤處理、重試機制
 * 
 * @version SSOT V6.3
 * @date 2025-01-11
 */

// ==========================================
// M0 Job Queue 處理器
// ==========================================

/**
 * M0 主執行函數（處理 Job Queue）
 * 此函數會被 Trigger 自動調用或手動調用
 */
function M0_Execute() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在，請先執行 initializeSheets()");
  }
  
  // 查找狀態為 "NEW" 的任務
  const dataRange = jobQueueSheet.getDataRange();
  const rows = dataRange.getValues();
  
  if (rows.length <= 1) {
    Logger.log("M0 Job Queue 中沒有待處理任務");
    return;
  }
  
  // 跳過標題行，查找第一個 "NEW" 狀態的任務
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const jobId = row[0];  // job_id
    const status = row[2];  // status
    
    if (status === "NEW") {
      Logger.log(`開始處理任務：${jobId}`);
      
      try {
        // 更新狀態為 "RUNNING"
        jobQueueSheet.getRange(i + 1, 3).setValue("RUNNING");  // status
        jobQueueSheet.getRange(i + 1, 6).setValue(new Date());  // started_at
        
        // 執行任務
        const result = executeJob(jobId, row);
        
        // 更新狀態為 "DONE"
        jobQueueSheet.getRange(i + 1, 3).setValue("DONE");  // status
        jobQueueSheet.getRange(i + 1, 7).setValue(new Date());  // finished_at
        
        Logger.log(`任務 ${jobId} 執行完成`);
        
        // 只處理一個任務，避免超時
        break;
      } catch (error) {
        Logger.log(`任務 ${jobId} 執行失敗：${error.message}`);
        
        // 處理錯誤
        handleJobError(jobId, row, error, jobQueueSheet, i + 1);
      }
    }
  }
}

/**
 * 執行單個任務
 * @param {string} jobId - 任務 ID
 * @param {Array} jobRow - 任務行數據
 * @return {Object} 執行結果
 */
function executeJob(jobId, jobRow) {
  const startTime = Date.now();
  
  try {
    // 解析任務參數
    const projectId = jobRow[1];  // project_id
    const requestedFlow = JSON.parse(jobRow[3]);  // requested_flow
    const inputPayload = JSON.parse(jobRow[4]);  // input_payload
    const retryCount = jobRow[9] || 0;  // retry_count
    
    // 驗證 requested_flow
    if (!Array.isArray(requestedFlow) || requestedFlow.length === 0) {
      throw new Error("requested_flow 必須是非空陣列");
    }
    
    // 驗證步驟名稱
    for (const step of requestedFlow) {
      if (ALLOWED_STEPS.indexOf(step) === -1) {
        throw new Error(`非法的步驟名稱：${step}，不在 Allowlist 中`);
      }
    }
    
    // 執行流程
    const executionResult = executeFlow(jobId, projectId, requestedFlow, inputPayload);
    
    // 計算執行時間
    const executionTime = Date.now() - startTime;
    
    // 保存結果到 M0__RESULT
    saveJobResult(jobId, projectId, executionResult, executionTime);
    
    // 記錄到審計鏈
    logCrossCheck(jobId, executionResult.crosscheckLog);
    
    // 監控執行時間
    monitorExecutionTime(projectId, executionTime);
    
    return executionResult;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    // 記錄錯誤
    logError({
      job_id: jobId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
      execution_time: executionTime
    });
    
    throw error;
  }
}

/**
 * 執行流程（按步驟調用 Capabilities）
 * @param {string} jobId - 任務 ID
 * @param {string} projectId - 項目 ID
 * @param {Array} requestedFlow - 請求的流程步驟
 * @param {Object} inputPayload - 輸入負載
 * @return {Object} 執行結果
 */
function executeFlow(jobId, projectId, requestedFlow, inputPayload) {
  const crosscheckLog = [];
  let currentPayload = inputPayload;
  let usedModels = [];
  
  // ⭐ V8.0 新增：Token 使用量追蹤
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const tokenUsageByModel = {};  // { modelName: { inputTokens, outputTokens, cost } }
  
  // 根據 projectId 決定執行者（如果流程中沒有明確指定）
  // ⭐ V8.0 測試模式：使用 getExecutor 函數（會自動處理測試模式）
  const executor = getExecutor(projectId) || "SONNET";
  const auditor = getAuditor(projectId);
  
  Logger.log(`執行流程：projectId=${projectId}, executor=${executor}, auditor=${auditor || "無（純提取資料）"}`);
  
  // ⭐ V8.17.1 新增：保存 EXECUTOR 的輸出（用於 P0 等特殊處理）
  let executorOutput = null;
  
  // 遍歷流程步驟
  for (let i = 0; i < requestedFlow.length; i++) {
    const step = requestedFlow[i];
    Logger.log(`執行步驟 ${i + 1}/${requestedFlow.length}：${step}`);
    
    try {
      let stepResult;
      
      // 根據步驟類型執行
      if (step === "GEMINI_SEARCH") {
        // 條件觸發：檢查是否有 FACT_CHECK 類型的 audit_questions
        const hasFactCheck = checkForFactCheck(currentPayload);
        
        if (!hasFactCheck) {
          Logger.log("GEMINI_SEARCH：沒有 FACT_CHECK，跳過此步驟");
          continue;
        }
        
        stepResult = executeGeminiSearch(jobId, step, currentPayload);
      } else if (step === "CSE_SEARCH") {
        // ⭐ 機構級數據收集已移至 P2.5 和 P5 Daily
        stepResult = executeCSESearch(jobId, step, currentPayload);
      } else if (step === "CSE_SEARCH_UNRESTRICTED") {
        // ⭐ V6.3 無白名單限制的 CSE 搜尋（用於自我質疑機制）
        // 如果 payload 中沒有 search_query，嘗試從 executor_questions 中提取
        if (!currentPayload.search_query && currentPayload.executor_questions) {
          const factCheckQuestions = currentPayload.executor_questions.filter(
            q => (q.type || "").toUpperCase() === "FACT_CHECK"
          );
          if (factCheckQuestions.length > 0) {
            // 使用第一個 FACT_CHECK 問題作為搜尋查詢
            currentPayload.search_query = factCheckQuestions[0].question || factCheckQuestions[0];
          }
        }
        stepResult = executeCSESearchUnrestricted(jobId, step, currentPayload);
      } else if (step === "EXECUTOR") {
        // 自動選擇執行者
        // ⭐ V6.3 自我質疑機制：執行者提出需要確認的問題
        stepResult = executeCapability(jobId, executor, currentPayload);
        
        // ⭐ V8.17.1 修正：無論是否有 audit_questions，都應該保存 EXECUTOR 的輸出
        // 這樣後續步驟（如 P0_ProcessM0Result）才能正確獲取 executor_output
        if (stepResult.output) {
          executorOutput = stepResult.output;  // ⭐ V8.17.1 修正：保存 EXECUTOR 的輸出
          currentPayload.previous_result = stepResult.output;
          
          // 檢查執行者是否提出問題
          if (stepResult.output.audit_questions) {
            Logger.log(`執行者提出 ${stepResult.output.audit_questions.length} 個需要確認的問題`);
            // 將問題記錄到 payload 中，供審查者回答
            currentPayload.executor_questions = stepResult.output.audit_questions;
          }
        }
      } else if (step === "AUDITOR") {
        // 自動選擇審查者
        // ⭐ V8.16 新增：檢查是否有審查者（P1_STEP1 等純提取資料的 Phase 不需要審查者）
        if (!auditor || auditor === null) {
          Logger.log(`Phase ${projectId} 不需要審查者（純提取資料，無分析），跳過 AUDITOR 步驟`);
          continue;  // 跳過審查步驟
        }
        
        // ⭐ V8.14 新增：P1_STEP2 特殊處理 - 審查者也需要看到 Flash 提取的財報資料
        if (projectId === "P1_STEP2") {
          // 從 payload 中讀取 Flash 提取的財報資料
          const financialReportData = currentPayload.financial_report_data || {};
          
          // 構建包含財報資料的審查者 Prompt
          const auditorPrompt = buildP1Step2AuditorPrompt(
            currentPayload.previous_result || {},
            financialReportData,
            currentPayload.executor_questions || []
          );
          
          const enhancedPayload = {
            ...currentPayload,
            task_prompt: auditorPrompt,  // 使用 task_prompt 傳遞審查者 Prompt
            auditor_prompt: auditorPrompt  // 同時設置 auditor_prompt（兼容性）
          };
          
          stepResult = executeCapability(jobId, auditor, enhancedPayload);
        } else if (currentPayload.executor_questions && currentPayload.executor_questions.length > 0) {
          // 檢查是否有 FACT_CHECK 類型的問題，如果有，先執行無限制 CSE 搜尋
          const hasFactCheck = currentPayload.executor_questions.some(
            q => (q.type || "").toUpperCase() === "FACT_CHECK"
          );
          
          // ⭐ V7.1 架構調整：GPT 審查，有需要查核事實時才觸發 Gemini
          // ⭐ V8.17 新增：審查者必須看到原始資料
          // 先讓 AUDITOR（GPT）進行邏輯審查，判斷是否需要事實查證
          const originalDataForAuditor = {
            financial_data: currentPayload.financial_data,
            master_candidates: currentPayload.master_candidates,
            p1_financial_report_data: currentPayload.p1_financial_report_data,
            peer_comparison_data: currentPayload.peer_comparison_data,
            p2_evidence: currentPayload.p2_evidence,
            p2_5_data: currentPayload.p2_5_data,
            technical_indicators: currentPayload.technical_indicators,
            snapshot_diff: currentPayload.snapshot_diff,
            raw_data: currentPayload.raw_data || currentPayload.original_data
          };
          
          const enhancedPayload = {
            ...currentPayload,
            auditor_prompt: buildAuditorPromptWithQuestions(
              currentPayload.executor_questions,
              currentPayload.previous_result,
              originalDataForAuditor,
              projectId
            ),
            // 提示 AUDITOR 判斷是否需要事實查證
            fact_check_instruction: "請審查執行者提出的問題。如果發現需要查核事實的問題（FACT_CHECK），請在輸出中標記 'needs_fact_check: true' 並列出需要查證的問題。"
          };
          
          // 先執行 AUDITOR（GPT）邏輯審查
          stepResult = executeCapability(jobId, auditor, enhancedPayload);
          
          // 檢查 AUDITOR 是否判斷需要事實查證
          const needsFactCheck = stepResult.output?.needs_fact_check === true || 
                                 stepResult.output?.fact_check_required === true;
          
          if (needsFactCheck && hasFactCheck && !currentPayload.gemini_search_results) {
            Logger.log(`審查者（${auditor}）判斷需要事實查證，觸發 GEMINI_SEARCH`);
            
            // 觸發 GEMINI_SEARCH 進行事實查證
            try {
              const geminiSearchResult = executeGeminiSearch(jobId, "GEMINI_SEARCH", {
                previous_result: currentPayload.previous_result,
                executor_questions: currentPayload.executor_questions,
                auditor_initial_review: stepResult.output
              });
              
              // 將 GEMINI_SEARCH 結果添加到 payload 中
              currentPayload.gemini_search_results = geminiSearchResult.output;
              
              // 記錄到審計鏈
              crosscheckLog.push({
                step: "GEMINI_SEARCH",
                model_id: "GEMINI_SEARCH",
                conversation_id: null,
                input_snapshot: JSON.stringify({ 
                  fact_check_questions: factCheckQuestions,
                  auditor_initial_review: stepResult.output
                }),
                output_snapshot: JSON.stringify({ gemini_search_result: geminiSearchResult.output }),
                note: `審查者（${auditor}）判斷需要事實查證，執行 GEMINI_SEARCH`,
                created_at: new Date()
              });
              
              // ⭐ V7.1 架構調整：GPT 融合 GEMINI_SEARCH 查核結果後回覆 AUDITOR
              // 使用 GPT（而非 AUDITOR）來融合事實查證結果
              const fusionPayload = {
                ...currentPayload,
                gemini_search_results: geminiSearchResult.output,
                auditor_initial_review: stepResult.output,
                fusion_instruction: "請融合 AUDITOR 的初始審查結果和 GEMINI_SEARCH 的事實查證結果，提供融合後的審查報告。"
              };
              
              // 使用 GPT 融合結果（GPT 是審查者，負責融合）
              const fusionResult = executeCapability(jobId, auditor, {
                ...fusionPayload,
                auditor_prompt: buildAuditorPromptWithFactCheck(
                  currentPayload.executor_questions,
                  currentPayload.previous_result,
                  stepResult.output,
                  geminiSearchResult.output
                )
              });
              
              // 最終決策由 AUDITOR 做出（使用融合後的結果）
              stepResult = fusionResult;
              
            } catch (error) {
              Logger.log(`GEMINI_SEARCH 執行失敗：${error.message}，繼續使用 AUDITOR 初始審查結果`);
              // 如果 GEMINI_SEARCH 失敗，繼續使用 AUDITOR 的初始審查結果
            }
          } else if (hasFactCheck && !currentPayload.unrestricted_cse_results) {
            // 如果 AUDITOR 沒有明確判斷，但執行者提出了 FACT_CHECK 問題
            // 執行無限制 CSE 搜尋作為備用（保持向後兼容）
            const factCheckQuestions = currentPayload.executor_questions.filter(
              q => (q.type || "").toUpperCase() === "FACT_CHECK"
            );
            
            Logger.log(`審查者流程：檢測到 ${factCheckQuestions.length} 個 FACT_CHECK 問題，執行無限制 CSE 搜尋（備用機制）`);
            
            const cseResults = [];
            for (const question of factCheckQuestions) {
              try {
                const cseResult = executeCSESearchUnrestricted(jobId, "CSE_SEARCH_UNRESTRICTED", {
                  search_query: question.question || question,
                  max_results: 10
                });
                cseResults.push({
                  question: question.question || question,
                  search_results: cseResult.output?.search_results || []
                });
              } catch (error) {
                Logger.log(`無限制 CSE 搜尋失敗：${error.message}`);
              }
            }
            
            // 將 CSE 搜尋結果添加到 payload 中，供審查者使用
            currentPayload.unrestricted_cse_results = cseResults;
            
            // 記錄到審計鏈
            crosscheckLog.push({
              step: "CSE_SEARCH_UNRESTRICTED",
              model_id: "CSE_SEARCH_UNRESTRICTED",
              conversation_id: null,
              input_snapshot: JSON.stringify({ fact_check_questions: factCheckQuestions }),
              output_snapshot: JSON.stringify({ cse_results: cseResults }),
              note: `為 ${factCheckQuestions.length} 個 FACT_CHECK 問題執行無限制 CSE 搜尋（備用機制）`,
              created_at: new Date()
            });
          }
        } else {
          stepResult = executeCapability(jobId, auditor, currentPayload);
        }
      } else {
        // 直接執行指定模型
        // ⭐ 特殊處理：如果 payload 中有 p0_prompt，將其作為 task_prompt
        if (currentPayload.p0_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p0_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p0_5_prompt，將其作為 task_prompt ⭐ V8.14 新增
        if (currentPayload.p0_5_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p0_5_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p0_7_prompt，將其作為 task_prompt
        if (currentPayload.p0_7_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p0_7_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p1_prompt，將其作為 task_prompt
        if (currentPayload.p1_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p1_prompt;
        }
        // ⭐ V8.14 新增：P1 兩階段執行特殊處理
        if (currentPayload.p1_step1_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p1_step1_prompt;
        }
        if (currentPayload.p1_step2_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p1_step2_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p2_prompt，將其作為 task_prompt
        if (currentPayload.p2_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p2_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p2_5_prompt，將其作為 task_prompt
        if (currentPayload.p2_5_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p2_5_prompt;
        }
        // ⭐ 特殊處理：如果 payload 中有 p3_prompt，將其作為 task_prompt
        if (currentPayload.p3_prompt && !currentPayload.task_prompt) {
          currentPayload.task_prompt = currentPayload.p3_prompt;
        }
        
        stepResult = executeCapability(jobId, step, currentPayload);
      }
      
      // ⭐ V8.0 新增：累計 Token 使用量
      const stepInputTokens = stepResult.inputTokens || 0;
      const stepOutputTokens = stepResult.outputTokens || 0;
      totalInputTokens += stepInputTokens;
      totalOutputTokens += stepOutputTokens;
      
      // 按模型記錄 Token 使用量（用於未來成本分析和批次優化）
      const modelName = stepResult.modelId || step;
      if (!tokenUsageByModel[modelName]) {
        tokenUsageByModel[modelName] = {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        };
      }
      tokenUsageByModel[modelName].inputTokens += stepInputTokens;
      tokenUsageByModel[modelName].outputTokens += stepOutputTokens;
      
      // 計算成本
      const modelConfig = M0_MODEL_CONFIG[modelName];
      if (modelConfig) {
        const inputCost = (stepInputTokens / 1000) * (modelConfig.costPer1KTokens || 0);
        let outputCost = (stepOutputTokens / 1000) * (modelConfig.costPer1KOutputTokens || (modelConfig.costPer1KTokens * 1.5));
        
        // Gemini 3.0 Pro 超過 200K 時使用不同價格
        if (modelName === "GEMINI_PRO" && modelConfig.costPer1KTokensOver200K && stepInputTokens > 200000) {
          outputCost = (stepOutputTokens / 1000) * (modelConfig.costPer1KOutputTokensOver200K || (modelConfig.costPer1KTokensOver200K * 1.5));
        }
        
        tokenUsageByModel[modelName].cost += inputCost + outputCost;
      }
      
      Logger.log(`步驟 ${step} Token 使用量：Input=${stepInputTokens}, Output=${stepOutputTokens}, Model=${modelName}`);
      
      // 記錄到審計鏈
      crosscheckLog.push({
        step: step,
        model_id: stepResult.modelId,
        conversation_id: stepResult.conversationId || null,
        input_snapshot: JSON.stringify(currentPayload),
        output_snapshot: JSON.stringify(stepResult.output),
        input_tokens: stepInputTokens,  // ⭐ V8.0 新增：記錄輸入 tokens
        output_tokens: stepOutputTokens,  // ⭐ V8.0 新增：記錄輸出 tokens
        note: stepResult.note || null,
        created_at: new Date()
      });
      
      // 更新使用的模型列表（包含 Token 使用量）
      if (stepResult.modelId && usedModels.indexOf(stepResult.modelId) === -1) {
        usedModels.push(stepResult.modelId);
      }
      
      // 更新當前負載（下一步使用上一步的輸出）
      currentPayload = {
        ...currentPayload,
        previous_step: step,
        previous_result: stepResult.output
      };
      
      // 如果是最後一步，返回最終結果
      if (i === requestedFlow.length - 1) {
        // ⭐ V8.17.1 修正：對於需要區分 executor_output 和 auditor_output 的 Phase（如 P0, P0.5, P0.7, P1_STEP1），
        // final_output 應該包含完整的結構，而不只是最後一步的輸出
        let finalOutputContent;
        if ((projectId === "P0" || projectId === "P0.5" || projectId === "P0_5" || projectId === "P0.7" || projectId === "P0_7") && executorOutput !== null) {
          // P0、P0.5 和 P0.7 需要包含 executor_output 和 auditor_output
          finalOutputContent = {
            executor_output: executorOutput,
            auditor_output: stepResult.output,
            input_payload: JSON.stringify(inputPayload)  // ⭐ V8.17.1 新增：保存 input_payload 供後續處理使用
          };
        } else if (projectId === "P1_STEP1") {
          // ⭐ V8.17.4 新增：P1_STEP1 只有 EXECUTOR，沒有 AUDITOR，但需要統一格式
          // ⭐ V8.17.4 修正：如果 executorOutput 為 null，使用 stepResult.output（向後兼容）
          finalOutputContent = {
            executor_output: executorOutput !== null ? executorOutput : stepResult.output,
            input_payload: JSON.stringify(inputPayload)
          };
        } else {
          // 其他 Phase 使用最後一步的輸出（保持原有邏輯，不破壞向後兼容性）
          finalOutputContent = stepResult.output;
        }
        
        const finalResult = {
          final_output: JSON.stringify(finalOutputContent),
          used_models: usedModels.join(", "),
          crosscheckLog: crosscheckLog,
          execution_steps: requestedFlow.length
        };
        
        // P0 特殊處理：調用 P0_ProcessM0Result
        // ⭐ V8.0 修正：P0_ProcessM0Result 會保存快照，這裡只記錄結果，不重複保存
        // 實際的快照保存和下游觸發應該在 P0_Execute 中完成
        if (projectId === "P0") {
          try {
            // ⭐ V8.17.1 修正：executor_output 應該是 EXECUTOR 的輸出（使用保存的 executorOutput）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            // ⭐ 增強：添加調試日誌
            Logger.log(`P0 M0_CORE：準備調用 P0_ProcessM0Result`);
            Logger.log(`P0 M0_CORE：executorOutput 類型=${typeof executorOutput}, 鍵=${executorOutput ? Object.keys(executorOutput).slice(0, 10).join(", ") : "null"}`);
            Logger.log(`P0 M0_CORE：stepResult.output 類型=${typeof stepResult.output}, 鍵=${stepResult.output ? Object.keys(stepResult.output).slice(0, 10).join(", ") : "null"}`);
            
            const m0Result = {
              executor_output: executorOutput || {},  // ⭐ V8.17.1 修正：使用保存的 EXECUTOR 輸出
              auditor_output: stepResult.output || {},  // AUDITOR 的輸出
              institutional_data: currentPayload.institutional_data || {},
              trigger: currentPayload.trigger || "QUARTERLY"
            };
            
            // ⭐ V8.0 修正：傳遞 params 以便保存 context 信息
            const params = {
              trigger: currentPayload.trigger || inputPayload.trigger || "QUARTERLY",
              context: currentPayload.context || inputPayload.context || {}
            };
            
            // ⭐ V8.0 修正：M0_CORE 中不保存快照，只處理結果（避免重複保存）
            // 快照保存應該在 P0_Execute 中完成
            const p0Result = P0_ProcessM0Result(jobId, m0Result, params);
            finalResult.p0_result = p0Result;
            // 注意：這裡的 p0Result 會保存快照，但 P0_Execute 中會再次調用
            // 為了避免重複，我們需要標記已經處理過
            finalResult.p0_processed = true;
          } catch (error) {
            Logger.log(`P0_ProcessM0Result 調用失敗：${error.message}`);
            Logger.log(`P0_ProcessM0Result 錯誤堆疊：${error.stack}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P0_7 特殊處理：調用 P0_7_ProcessM0Result
        // ⭐ V8.0 修正：P0_7_ProcessM0Result 會保存快照，這裡只記錄結果，不重複保存
        // ⭐ V8.17.1 修正：支持 "P0.7" 和 "P0_7" 兩種格式
        if (projectId === "P0.7" || projectId === "P0_7") {
          try {
            // ⭐ V8.17.1 修正：executor_output 應該是 EXECUTOR 的輸出（使用保存的 executorOutput）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            Logger.log(`P0.7 M0_CORE：準備調用 P0_7_ProcessM0Result`);
            Logger.log(`P0.7 M0_CORE：executorOutput 類型=${typeof executorOutput}, 鍵=${executorOutput ? Object.keys(executorOutput).slice(0, 10).join(", ") : "null"}`);
            Logger.log(`P0.7 M0_CORE：stepResult.output 類型=${typeof stepResult.output}, 鍵=${stepResult.output ? Object.keys(stepResult.output).slice(0, 10).join(", ") : "null"}`);
            
            const p0_7Result = P0_7_ProcessM0Result(jobId, {
              executor_output: executorOutput || currentPayload.previous_result || {},  // ⭐ V8.17.1 修正：優先使用保存的 executorOutput
              auditor_output: stepResult.output || {},
              input_payload: JSON.stringify(inputPayload),  // ⭐ V8.17.1 新增：保存 input_payload
              p0_output: currentPayload.p0_output || {},
              institutional_data: currentPayload.institutional_data || {},
              p0_snapshot_id: currentPayload.p0_snapshot_id || inputPayload.p0_snapshot_id || null,
              trigger: currentPayload.trigger || inputPayload.trigger || "QUARTERLY"
            }, {
              trigger: currentPayload.trigger || inputPayload.trigger || "QUARTERLY",
              context: currentPayload.context || inputPayload.context || {}
            });
            finalResult.p0_7_result = p0_7Result;
            finalResult.p0_7_processed = true;  // ⭐ V8.17.1 新增：標記已處理，避免重複處理
          } catch (error) {
            Logger.log(`P0_7_ProcessM0Result 調用失敗：${error.message}`);
            Logger.log(`P0_7_ProcessM0Result 錯誤堆疊：${error.stack}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P1 特殊處理：調用 P1_ProcessM0Result（舊版本，保留向後兼容）
        if (projectId === "P1") {
          try {
            const p1Result = P1_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},
              auditor_output: stepResult.output,
              p0_output: currentPayload.p0_output || {},
              p0_7_output: currentPayload.p0_7_output || {},
              institutional_data: currentPayload.institutional_data || {},
              p0_snapshot_id: currentPayload.p0_snapshot_id || null,
              p0_7_snapshot_id: currentPayload.p0_7_snapshot_id || null,
              trigger: currentPayload.trigger || "QUARTERLY"
            });
            finalResult.p1_result = p1Result;
          } catch (error) {
            Logger.log(`P1_ProcessM0Result 調用失敗：${error.message}`);
          }
        }
        
        // ⭐ V8.14 新增：P1 Step 1 特殊處理（只執行，不保存快照）
        if (projectId === "P1_STEP1") {
          try {
            // Step 1 只執行，結果由 P1_ProcessStep1Result 處理
            finalResult.p1_step1_result = {
              executor_output: currentPayload.previous_result || {},
              status: "COMPLETED"
            };
          } catch (error) {
            Logger.log(`P1 Step 1 處理失敗：${error.message}`);
          }
        }
        
        // ⭐ V8.14 新增：P1 Step 2 特殊處理（調用 P1_ProcessStep2Result）
        if (projectId === "P1_STEP2") {
          try {
            const step1Result = currentPayload.step1_result || {};
            const params = {
              trigger: currentPayload.trigger || "QUARTERLY",
              p0_snapshot_id: currentPayload.p0_snapshot_id || null,
              p0_5_snapshot_id: currentPayload.p0_5_snapshot_id || null,
              p0_7_snapshot_id: currentPayload.p0_7_snapshot_id || null,
              context: currentPayload.context || {}
            };
            
            const p1Step2Result = P1_ProcessStep2Result(jobId, {
              executor_output: currentPayload.previous_result || {},
              auditor_output: stepResult.output
            }, step1Result, params);
            
            finalResult.p1_step2_result = p1Step2Result;
          } catch (error) {
            Logger.log(`P1 Step 2 處理失敗：${error.message}`);
          }
        }
        
        // ⭐ V8.14 新增：P0.5 特殊處理
        // ⭐ V8.17.1 修正：支持 "P0.5" 和 "P0_5" 兩種格式
        if (projectId === "P0.5" || projectId === "P0_5") {
          try {
            // ⭐ V8.17.1 修正：executor_output 應該是 EXECUTOR 的輸出（使用保存的 executorOutput）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            Logger.log(`P0.5 M0_CORE：準備調用 P0_5_ProcessM0Result`);
            Logger.log(`P0.5 M0_CORE：executorOutput 類型=${typeof executorOutput}, 鍵=${executorOutput ? Object.keys(executorOutput).slice(0, 10).join(", ") : "null"}`);
            Logger.log(`P0.5 M0_CORE：stepResult.output 類型=${typeof stepResult.output}, 鍵=${stepResult.output ? Object.keys(stepResult.output).slice(0, 10).join(", ") : "null"}`);
            
            const p0_5Result = P0_5_ProcessM0Result(jobId, {
              executor_output: executorOutput || currentPayload.previous_result || {},  // ⭐ V8.17.1 修正：優先使用保存的 executorOutput
              auditor_output: stepResult.output || {},
              input_payload: JSON.stringify(inputPayload),  // ⭐ V8.17.1 新增：保存 input_payload
              p0_output: currentPayload.p0_output || {},
              p0_snapshot_id: currentPayload.p0_snapshot_id || inputPayload.p0_snapshot_id || null,
              trigger: currentPayload.trigger || inputPayload.trigger || "QUARTERLY"
            });
            finalResult.p0_5_result = p0_5Result;
            finalResult.p0_5_processed = true;  // ⭐ V8.17.1 新增：標記已處理，避免重複處理
          } catch (error) {
            Logger.log(`P0_5_ProcessM0Result 調用失敗：${error.message}`);
            Logger.log(`P0_5_ProcessM0Result 錯誤堆疊：${error.stack}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P2 特殊處理：調用 P2_ProcessM0Result
        if (projectId === "P2_MONTHLY" || projectId === "P2_QUARTERLY") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p2Result = P2_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              master_candidates: currentPayload.master_candidates || [],
              financial_data: currentPayload.financial_data || {},
              institutional_data: currentPayload.institutional_data || {},
              frequency: currentPayload.frequency || "MONTHLY",
              trigger: currentPayload.trigger || "MONTHLY"
            });
            finalResult.p2_result = p2Result;
          } catch (error) {
            Logger.log(`P2_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P2.5 特殊處理：調用 P2_5_ProcessM0Result
        if (projectId === "P2_5_MONTHLY" || projectId === "P2_5_QUARTERLY") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p2_5Result = P2_5_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              tickers: currentPayload.tickers || [],
              smart_money_data: currentPayload.smart_money_data || {},
              p2_snapshot_id: currentPayload.p2_snapshot_id || null,
              frequency: currentPayload.frequency || "MONTHLY",
              trigger: currentPayload.trigger || "MONTHLY"
            });
            finalResult.p2_5_result = p2_5Result;
          } catch (error) {
            Logger.log(`P2_5_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P3 特殊處理：調用 P3_ProcessM0Result
        if (projectId === "P3") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p3Result = P3_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              phase2_output: currentPayload.phase2_output || [],
              technical_data: currentPayload.technical_data || {},
              smart_money_data: currentPayload.smart_money_data || {},  // ⭐ P2.5 機構級數據
              frequency: currentPayload.frequency || "WEEKLY",
              trigger: currentPayload.trigger || "WEEKLY"
            });
            finalResult.p3_result = p3Result;
          } catch (error) {
            Logger.log(`P3_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P5 Weekly 特殊處理：調用 P5_Weekly_ProcessM0Result
        if (projectId === "P5_WEEKLY") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p5WeeklyResult = P5_Weekly_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              p2_snapshot: currentPayload.p2_snapshot || null,
              p3_snapshot: currentPayload.p3_snapshot || null,
              p4_snapshot: currentPayload.p4_snapshot || null,
              weekly_market_data: currentPayload.weekly_market_data || {},
              institutional_data: currentPayload.institutional_data || {},
              frequency: currentPayload.frequency || "WEEKLY",
              trigger: currentPayload.trigger || "WEEKLY"
            });
            finalResult.p5_weekly_result = p5WeeklyResult;
          } catch (error) {
            Logger.log(`P5_Weekly_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P5 Monthly 特殊處理：調用 P5_Monthly_ProcessM0Result
        if (projectId === "P5_MONTHLY") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p5MonthlyResult = P5_Monthly_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              monthly_market_data: currentPayload.monthly_market_data || {},
              institutional_data: currentPayload.institutional_data || {},
              frequency: currentPayload.frequency || "MONTHLY",
              trigger: currentPayload.trigger || "MONTHLY"
            });
            finalResult.p5_monthly_result = p5MonthlyResult;
          } catch (error) {
            Logger.log(`P5_Monthly_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // P5 Quarterly 特殊處理：調用 P5_Quarterly_ProcessM0Result
        if (projectId === "P5_QUARTERLY") {
          try {
            // ⭐ 修正：executor_output 應該是 EXECUTOR 的輸出（previous_result）
            // auditor_output 應該是 AUDITOR 的輸出（stepResult.output）
            const p5QuarterlyResult = P5_Quarterly_ProcessM0Result(jobId, {
              executor_output: currentPayload.previous_result || {},  // EXECUTOR 的輸出
              auditor_output: stepResult.output,  // AUDITOR 的輸出
              quarterly_market_data: currentPayload.quarterly_market_data || {},
              institutional_data: currentPayload.institutional_data || {},
              frequency: currentPayload.frequency || "QUARTERLY",
              trigger: currentPayload.trigger || "QUARTERLY"
            });
            finalResult.p5_quarterly_result = p5QuarterlyResult;
          } catch (error) {
            Logger.log(`P5_Quarterly_ProcessM0Result 調用失敗：${error.message}`);
            // 不中斷流程，只記錄錯誤
          }
        }
        
        // ⭐ V8.0 新增：在最終結果中包含 Token 使用量
        finalResult.token_usage = {
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          total_tokens: totalInputTokens + totalOutputTokens,
          by_model: tokenUsageByModel,
          estimated_cost: Object.values(tokenUsageByModel).reduce((sum, usage) => sum + usage.cost, 0)
        };
        
        Logger.log(`流程 Token 使用量總計：Input=${totalInputTokens}, Output=${totalOutputTokens}, 估算成本=$${finalResult.token_usage.estimated_cost.toFixed(4)}`);
        
        return finalResult;
      }
    } catch (error) {
      Logger.log(`步驟 ${step} 執行失敗：${error.message}`);
      throw new Error(`步驟 ${step} 執行失敗：${error.message}`);
    }
  }
  
  throw new Error("流程執行完成但沒有返回結果");
}

/**
 * 執行 Capability（調用 AI 模型）
 * @param {string} jobId - 任務 ID
 * @param {string} capabilityName - Capability 名稱
 * @param {Object} payload - 輸入負載
 * @return {Object} 執行結果
 */
function executeCapability(jobId, capabilityName, payload) {
  const config = M0_MODEL_CONFIG[capabilityName];
  
  if (!config) {
    throw new Error(`Capability ${capabilityName} 未配置`);
  }
  
  // 根據 Adapter 調用對應的 API
  let result;
  
  if (config.adapter === "M0_Adapter_OpenAI") {
    result = callOpenAI(config.model, payload, config);
  } else if (config.adapter === "M0_Adapter_Claude") {
    result = callClaude(config.model, payload, config);
  } else if (config.adapter === "M0_Adapter_Gemini") {
    result = callGemini(config.model, payload, config);
  } else {
    throw new Error(`Adapter ${config.adapter} 未實現`);
  }
  
  return {
    modelId: capabilityName,
    output: result.output,
    conversationId: result.conversationId || null,
    note: result.note || null,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0
  };
}

// ==========================================
// 錯誤處理與重試機制
// ==========================================

/**
 * 處理任務錯誤
 * @param {string} jobId - 任務 ID
 * @param {Array} jobRow - 任務行數據
 * @param {Error} error - 錯誤對象
 * @param {Sheet} jobQueueSheet - Job Queue 表格
 * @param {number} rowIndex - 行索引
 */
function handleJobError(jobId, jobRow, error, jobQueueSheet, rowIndex) {
  const retryCount = jobRow[9] || 0;  // retry_count
  
  // 更新錯誤信息
  jobQueueSheet.getRange(rowIndex, 8).setValue(error.code || "UNKNOWN");  // error_code
  jobQueueSheet.getRange(rowIndex, 9).setValue(error.message.substring(0, 500));  // error_message（限制長度）
  jobQueueSheet.getRange(rowIndex, 7).setValue(new Date());  // finished_at
  
  // 檢查是否需要重試
  if (retryCount < RETRY_CONFIG.maxRetries) {
    // 設置狀態為 "RETRY"
    jobQueueSheet.getRange(rowIndex, 3).setValue("RETRY");  // status
    
    // 增加重試次數
    jobQueueSheet.getRange(rowIndex, 10).setValue(retryCount + 1);  // retry_count
    
    // 安排重試（使用 Trigger 延遲執行）
    const delayMs = calculateRetryDelay(retryCount + 1);
    scheduleRetry(jobId, delayMs);
    
    Logger.log(`任務 ${jobId} 將在 ${delayMs}ms 後重試（第 ${retryCount + 1} 次）`);
  } else {
    // 超過最大重試次數，設置狀態為 "ERROR"
    jobQueueSheet.getRange(rowIndex, 3).setValue("ERROR");  // status
    
    Logger.log(`任務 ${jobId} 執行失敗，已達到最大重試次數（${RETRY_CONFIG.maxRetries}）`);
    
    // 發送告警（可選）
    sendAlert({
      type: "M0_ERROR",
      job_id: jobId,
      error: error.message,
      retry_count: retryCount
    });
  }
}

/**
 * 安排重試（使用 ScriptApp.newTrigger）
 * @param {string} jobId - 任務 ID
 * @param {number} delayMs - 延遲時間（毫秒）
 */
function scheduleRetry(jobId, delayMs) {
  // 注意：Google Apps Script 的 Trigger 最小間隔是 1 分鐘
  // 如果 delayMs < 60000，需要等待至少 1 分鐘
  const delayMinutes = Math.max(1, Math.ceil(delayMs / 60000));
  
  // 創建一次性觸發器
  ScriptApp.newTrigger("M0_Execute")
    .timeBased()
    .after(delayMinutes * 60 * 1000)
    .create();
  
  Logger.log(`已安排任務 ${jobId} 在 ${delayMinutes} 分鐘後重試`);
}

// ==========================================
// 結果保存與審計鏈記錄
// ==========================================

/**
 * 保存任務結果到 M0__RESULT
 * @param {string} jobId - 任務 ID
 * @param {string} projectId - 項目 ID
 * @param {Object} executionResult - 執行結果
 * @param {number} executionTime - 執行時間（毫秒）
 */
function saveJobResult(jobId, projectId, executionResult, executionTime) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let resultSheet = ss.getSheetByName("M0__RESULT");
  
  if (!resultSheet) {
    throw new Error("M0__RESULT 表格不存在，請先執行 initializeSheets()");
  }
  
  // ⭐ V8.0 新增：提取 Token 使用量
  const tokenUsage = executionResult.token_usage || {};
  const inputTokens = tokenUsage.total_input_tokens || 0;
  const outputTokens = tokenUsage.total_output_tokens || 0;
  const estimatedCost = tokenUsage.estimated_cost || 0;
  const tokenUsageJson = JSON.stringify(tokenUsage.by_model || {});
  
  // 檢查表格是否有新欄位（如果沒有，需要先添加）
  const headers = resultSheet.getRange(1, 1, 1, resultSheet.getLastColumn()).getValues()[0];
  const hasTokenFields = headers.includes("input_tokens");
  
  if (!hasTokenFields && resultSheet.getLastRow() > 0) {
    // 如果表格已有數據但沒有新欄位，需要添加（但這會破壞現有數據結構，所以只在表格為空時添加）
    Logger.log("警告：M0__RESULT 表格缺少 Token 追蹤欄位，但表格已有數據，無法自動添加。請手動更新表格結構。");
  }
  
  // ⭐ V8.0 更新：保存包含 Token 使用量的結果
  const row = [
    jobId,
    projectId,
    typeof executionResult.final_output === 'string' ? executionResult.final_output : JSON.stringify(executionResult.final_output),
    executionResult.used_models || "",
    new Date(),
    "DONE",
    executionTime,
    inputTokens,  // ⭐ V8.0 新增：總輸入 tokens
    outputTokens,  // ⭐ V8.0 新增：總輸出 tokens
    estimatedCost,  // ⭐ V8.0 新增：估算成本（USD）
    tokenUsageJson  // ⭐ V8.0 新增：詳細 Token 使用量（JSON）
  ];
  
  // 如果表格沒有新欄位，只保存原有欄位（向後兼容）
  if (!hasTokenFields) {
    row.splice(7);  // 只保留前 7 個欄位
    Logger.log(`警告：M0__RESULT 表格缺少 Token 追蹤欄位，無法保存 Token 使用量。請更新表格結構。`);
  }
  
  // ⭐ V8.17.4 新增：詳細日誌，診斷保存問題
  const outputColIndex = headers.indexOf("final_output");
  Logger.log(`saveJobResult：準備保存，jobId=${jobId}, final_output 類型=${typeof row[2]}, 長度=${row[2] ? (typeof row[2] === 'string' ? row[2].length : JSON.stringify(row[2]).length) : 0}`);
  Logger.log(`saveJobResult：row 長度=${row.length}, 表格欄位數=${headers.length}, final_output 欄位索引=${outputColIndex}`);
  
  resultSheet.appendRow(row);
  
  // ⭐ V8.17.5 修正：強制刷新 Spreadsheet 以確保數據寫入
  SpreadsheetApp.flush();
  
  // ⭐ V8.17.4 新增：驗證保存是否成功（延遲讀取，確保數據已寫入）
  Utilities.sleep(500);  // 等待 500ms 確保數據寫入
  const lastRow = resultSheet.getLastRow();
  if (outputColIndex !== -1) {
    const savedRow = resultSheet.getRange(lastRow, 1, 1, resultSheet.getLastColumn()).getValues()[0];
    const savedOutput = savedRow[outputColIndex];
    Logger.log(`saveJobResult：驗證保存，最後一行=${lastRow}, final_output 值=${savedOutput ? (typeof savedOutput === 'string' ? savedOutput.substring(0, 50) + "..." : "對象") : "空"}`);
  } else {
    Logger.log(`saveJobResult：警告：找不到 final_output 欄位，無法驗證保存`);
  }
  
  if (hasTokenFields) {
    Logger.log(`M0 Job 結果已保存：jobId=${jobId}, Input=${inputTokens}, Output=${outputTokens}, Cost=$${estimatedCost.toFixed(4)}`);
  } else {
    Logger.log(`M0 Job 結果已保存：jobId=${jobId}（Token 追蹤未保存，需更新表格結構）`);
  }
}

/**
 * 記錄審計鏈到 M0__CROSSCHECK_LOG
 * @param {string} jobId - 任務 ID
 * @param {Array} crosscheckLog - 審計鏈記錄
 */
function logCrossCheck(jobId, crosscheckLog) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("M0__CROSSCHECK_LOG");
  
  if (!logSheet) {
    throw new Error("M0__CROSSCHECK_LOG 表格不存在，請先執行 initializeSheets()");
  }
  
  // 批量寫入（提高性能）
  const rows = crosscheckLog.map(log => [
    jobId,
    log.step,
    log.model_id,
    log.conversation_id || "",
    log.input_snapshot.substring(0, 50000),  // 限制長度
    log.output_snapshot.substring(0, 50000),  // 限制長度
    log.note || "",
    log.created_at
  ]);
  
  if (rows.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 構建審查者 Prompt（包含執行者提出的問題）
 * ⭐ V6.3 自我質疑機制：審查者需要回答執行者的問題，並可使用無限制 CSE 進行事實查證
 * 
 * @param {Array} executorQuestions - 執行者提出的問題列表
 * @param {Object} previousResult - 執行者的輸出結果
 * @returns {string} auditorPrompt - 審查者 Prompt
 */
/**
 * 構建審查者 Prompt（包含事實查證結果）
 * ⭐ V7.1 架構調整：GPT 審查，融合 GEMINI_SEARCH 事實查證結果
 * 
 * @param {Array} executorQuestions - 執行者提出的問題列表
 * @param {Object} previousResult - 執行者的輸出結果
 * @param {Object} auditorInitialReview - AUDITOR 的初始審查結果
 * @param {Object} geminiSearchResult - GEMINI_SEARCH 的事實查證結果
 * @returns {string} auditorPrompt - 審查者 Prompt
 */
function buildAuditorPromptWithFactCheck(executorQuestions, previousResult, auditorInitialReview, geminiSearchResult) {
  let prompt = `你是一位資深的審查者，負責審查執行者的輸出並融合事實查證結果做出最終決策。

## 執行者的輸出結果

${JSON.stringify(previousResult, null, 2)}

## 執行者提出的問題（需要你回答）

${executorQuestions.map((q, i) => `${i + 1}. ${q.question || q.text || q}`).join('\n')}

## 你的初始審查結果

${JSON.stringify(auditorInitialReview, null, 2)}

## Gemini 事實查證結果

${JSON.stringify(geminiSearchResult, null, 2)}

## 任務

請融合以上所有資訊，包括：
1. 執行者的輸出結果
2. 執行者提出的問題
3. 你的初始審查結果
4. Gemini 事實查證結果（包括可靠來源、衝突標註等）

做出最終的審查決策，並在輸出中包含：
- final_review: 最終審查結論
- fact_check_summary: 事實查證摘要
- reliable_sources_used: 使用的可靠來源
- conflicts_resolved: 解決的衝突
- final_decision: 最終決策

請以 JSON 格式回答。`;

  return prompt;
}

/**
 * 構建 P1 Step 2 的審查者 Prompt（包含 Flash 提取的財報資料）
 * ⭐ V8.14 新增
 * 
 * @param {Object} executorOutput - 執行者（Gemini Pro）的輸出
 * @param {Object} financialReportData - Flash 提取的財報資料
 * @param {Array} executorQuestions - 執行者提出的問題（可選）
 * @return {string} 審查者 Prompt
 */
function buildP1Step2AuditorPrompt(executorOutput, financialReportData, executorQuestions = []) {
  let prompt = `你是一位資深的審查者，負責審查 P1 Step 2 的結構分級結果。

## ⚠️ 重要：你必須使用 Flash 提取的財報資料進行對照審查

**Flash 提取的財報資料**是從各公司最新三季財報中提取的原文段落，已按 P1/P2/P3 分類。你必須對照這些資料來驗證執行者的分析是否正確。

---

## Flash 提取的財報資料（對照基準）

${Object.keys(financialReportData).length > 0 ? 
  Object.entries(financialReportData).map(([key, data]) => {
    const [ticker, market] = key.split('_');
    return `### **${ticker} (${market})**

**P1_Industry_Evidence**（產業定位證據）：
${JSON.stringify(data.p1_industry_evidence || [], null, 2)}

**P2_Financial_Evidence**（財務證據）：
${JSON.stringify(data.p2_financial_evidence || [], null, 2)}

**P3_Technical_Evidence**（股權結構證據）：
${JSON.stringify(data.p3_technical_evidence || [], null, 2)}
`;
  }).join('\n\n') : 
  '**注意**：部分公司可能尚未完成財報提取，請根據可用的資料進行審查。'}

---

## 執行者的輸出結果

${JSON.stringify(executorOutput, null, 2)}
`;
  
  if (executorQuestions && executorQuestions.length > 0) {
    prompt += `
## 執行者提出的問題（需要你回答）

`;
    executorQuestions.forEach((question, index) => {
      prompt += `${index + 1}. 【${question.type || "GENERAL"}】${question.question || question}\n`;
      if (question.context) {
        prompt += `   上下文：${question.context}\n`;
      }
      if (question.importance) {
        prompt += `   重要性：${question.importance}\n`;
      }
      prompt += `\n`;
    });
  }
  
  prompt += `
---

## 你的審查任務

1. **對照財報資料驗證執行者的分析**：
   - 執行者的「產業鏈位置定位」是否符合 Flash 提取的 P1_Industry_Evidence？
   - 執行者的「Tier 分級理由」是否能從財報資料中找到支持證據？
   - 執行者的「受益/受害機制」是否與財報資料一致？

2. **檢查執行者是否違反禁止事項**：
   - ❌ 是否使用了財務績效數據（EPS/成長率/毛利率數字）作為分級依據？
   - ❌ 是否使用了估值（P/E、FPE、PEG）作為證據？
   - ❌ 是否使用了技術分析或股價作為證據？
   - ❌ 是否改寫了 P0 主敘事或加入新宏觀論述？

3. **驗證 Tier 分級的合理性**：
   - Tier S/A/B/X 的分級理由是否基於結構性特徵？
   - 是否正確識別和獵殺了舊技術龍頭（Tier X）？
   - 是否正確剔除了無關公司並說明理由？

4. **檢查產業鏈位置定位的準確性**：
   - 公司是否被正確排入上中下游/互補/替代位置？
   - 是否正確對應到 P0.5 產業鏈地圖的節點？

5. **驗證受益/受害機制**：
   - 機制描述是否與財報資料一致？
   - 是否有足夠的證據支持？

${executorQuestions && executorQuestions.length > 0 ? `
6. **回答執行者提出的問題**（如果有）
` : ''}

---

## 輸出格式（必須是 JSON）

{
  "review_summary": "整體審查摘要（必須明確說明是否對照了財報資料）",
  "validation_results": {
    "chain_position_accuracy": "HIGH / MEDIUM / LOW（基於財報資料對照）",
    "tier_reasoning_accuracy": "HIGH / MEDIUM / LOW（基於財報資料對照）",
    "violations_found": [
      {
        "company_ticker": "AAPL",
        "violation_type": "使用了財務績效數據 / 使用了估值 / 改寫P0敘事",
        "evidence": "具體證據"
      }
    ]
  },
${executorQuestions && executorQuestions.length > 0 ? `
  "answers": [
    {
      "question_id": 1,
      "question": "問題內容",
      "answer": "你的回答",
      "confidence": 0.0-1.0
    }
  ],
` : ''}
  "issues_found": [
    {
      "issue": "發現的問題",
      "severity": "LOW/MEDIUM/HIGH/CRITICAL",
      "suggestion": "改進建議",
      "financial_report_evidence": "從 Flash 提取的財報資料中找到的相關證據"
    }
  ],
  "confidence_level": 0.0-1.0,
  "final_decision": "APPROVED / REJECTED / NEEDS_REVISION",
  "revision_notes": "如果需要修訂，請說明具體要求"
}

---

## ⚠️ 審查要求

1. **必須對照財報資料**：你的審查必須基於 Flash 提取的財報資料，不能僅憑執行者的輸出進行審查
2. **驗證證據來源**：檢查執行者的論述是否能從財報資料中找到支持
3. **嚴格的禁止事項檢查**：必須檢查執行者是否違反了禁止事項
4. **結構性特徵驗證**：確認 Tier 分級是否基於結構性特徵而非財務數據
`;
  
  return prompt;
}

/**
 * 構建審查者 Prompt（包含執行者提出的問題）
 * ⭐ V6.3 自我質疑機制：審查者需要回答執行者的問題，並可使用無限制 CSE 進行事實查證
 * ⭐ V8.17 新增：審查者必須看到原始資料（traceable key original fragments 和 verifiable numerical values）
 * 
 * @param {Array} executorQuestions - 執行者提出的問題列表
 * @param {Object} previousResult - 執行者的輸出結果
 * @param {Object} originalData - 原始資料（可選，包含 financialData, masterCandidates, p1FinancialReportData 等）
 * @param {string} projectId - 項目 ID（用於判斷需要包含哪些原始資料）
 * @returns {string} auditorPrompt - 審查者 Prompt
 */
function buildAuditorPromptWithQuestions(executorQuestions, previousResult, originalData = {}, projectId = "") {
  let prompt = `你是一位資深的審查者，負責審查執行者的輸出並回答執行者提出的問題。

## ⭐⭐⭐ 重要：審查者必須看到原始資料 ⭐⭐⭐

**審查原則**：
- 你必須基於**原始資料**（traceable key original fragments 和 verifiable numerical values）進行審查
- 不能僅依賴執行者的總結或結論
- 必須驗證執行者引用的數據是否與原始資料一致
- 必須檢查執行者是否有「隱性省略」或「過度解讀」的情況

## 執行者的輸出結果

${JSON.stringify(previousResult, null, 2)}

## 執行者提出的問題（需要你回答）

`;

  executorQuestions.forEach((question, index) => {
    prompt += `${index + 1}. 【${question.type || "GENERAL"}】${question.question || question}\n`;
    if (question.context) {
      prompt += `   上下文：${question.context}\n`;
    }
    if (question.importance) {
      prompt += `   重要性：${question.importance}\n`;
    }
    prompt += `\n`;
  });

  // ⭐ V8.17 新增：根據 projectId 包含相應的原始資料
  if (originalData && Object.keys(originalData).length > 0) {
    prompt += `\n## ⭐⭐⭐ 原始資料（必須用於驗證執行者的結論）⭐⭐⭐\n\n`;
    
    // P2 相關的原始資料
    if (projectId.includes("P2") || originalData.financial_data) {
      prompt += `### 財務數據（Financial Data）\n`;
      prompt += `以下是由程式從權威數據源（白名單）收集的財務數據，你必須用這些原始數值驗證執行者的結論：\n\n`;
      prompt += `${JSON.stringify(originalData.financial_data || {}, null, 2)}\n\n`;
    }
    
    if (projectId.includes("P2") || originalData.master_candidates) {
      prompt += `### 候選公司列表（Master Candidates）\n`;
      prompt += `以下是要分析的公司列表，你必須驗證執行者是否正確處理了所有公司：\n\n`;
      prompt += `${JSON.stringify(originalData.master_candidates || [], null, 2)}\n\n`;
    }
    
    if (projectId.includes("P2") || originalData.p1_financial_report_data) {
      prompt += `### P1 提取的財報資料（Financial Report Extractions）\n`;
      prompt += `以下是 P1 階段從財報原文中提取的證據段落，你必須用這些原始段落驗證執行者的分析：\n\n`;
      prompt += `${JSON.stringify(originalData.p1_financial_report_data || {}, null, 2)}\n\n`;
    }
    
    if (projectId.includes("P2") || originalData.peer_comparison_data) {
      prompt += `### 同業比較數據（Peer Comparison Data）\n`;
      prompt += `以下是同業公司的財務數據，你必須用這些原始數值驗證執行者的同業比較結論：\n\n`;
      prompt += `${JSON.stringify(originalData.peer_comparison_data || {}, null, 2)}\n\n`;
    }
    
    // P3 相關的原始資料
    if (projectId.includes("P3") || originalData.p2_evidence) {
      prompt += `### P2 證據（P2 Evidence）\n`;
      prompt += `以下是 P2 階段的分析證據，你必須用這些原始證據驗證執行者的技術分析：\n\n`;
      prompt += `${JSON.stringify(originalData.p2_evidence || {}, null, 2)}\n\n`;
    }
    
    if (projectId.includes("P3") || originalData.p2_5_data) {
      prompt += `### P2.5 籌碼數據（P2.5 Chip Data）\n`;
      prompt += `以下是 P2.5 階段的籌碼分析數據，你必須用這些原始數據驗證執行者的籌碼分析：\n\n`;
      prompt += `${JSON.stringify(originalData.p2_5_data || {}, null, 2)}\n\n`;
    }
    
    if (projectId.includes("P3") || originalData.technical_indicators) {
      prompt += `### 技術指標（Technical Indicators）\n`;
      prompt += `以下是技術指標的原始數值，你必須用這些原始數值驗證執行者的技術分析：\n\n`;
      prompt += `${JSON.stringify(originalData.technical_indicators || {}, null, 2)}\n\n`;
    }
    
    if (projectId.includes("P3") || originalData.snapshot_diff) {
      prompt += `### 快照差異（Snapshot Diff）\n`;
      prompt += `以下是與上一版快照的差異，你必須用這些原始差異驗證執行者的變化分析：\n\n`;
      prompt += `${JSON.stringify(originalData.snapshot_diff || {}, null, 2)}\n\n`;
    }
    
    // 其他原始資料
    if (originalData.raw_data) {
      prompt += `### 其他原始資料（Raw Data）\n`;
      prompt += `${JSON.stringify(originalData.raw_data, null, 2)}\n\n`;
    }
  }

  prompt += `
## 你的任務

1. **審查執行者的輸出**：檢查邏輯、數據、結論是否合理
   - ⭐ **必須基於原始資料驗證**：檢查執行者引用的數據是否與原始資料一致
   - ⭐ **檢查隱性省略**：確認執行者沒有遺漏重要的原始資料片段
   - ⭐ **檢查過度解讀**：確認執行者的結論有原始資料支撐
2. **回答執行者的問題**：針對每個問題提供明確、可靠的答案
   - ⭐ **必須引用原始資料**：在回答中明確指出使用的原始資料片段或數值
3. **事實查證**：如果問題涉及事實查證（FACT_CHECK），你可以使用無限制 CSE 搜尋來驗證
4. **提供建議**：如果發現問題或需要改進的地方，提供具體建議

## 輸出格式（必須是 JSON）

{
  "review_summary": "整體審查摘要（必須說明是否基於原始資料驗證）",
  "data_verification": {
    "verified_fragments": ["驗證過的原始資料片段"],
    "missing_fragments": ["執行者遺漏的原始資料片段"],
    "inconsistencies": ["執行者結論與原始資料不一致的地方"]
  },
  "answers": [
    {
      "question_id": 1,
      "question": "問題內容",
      "answer": "你的回答（必須引用原始資料）",
      "confidence": 0.0-1.0,
      "sources": ["如果使用了 CSE 搜尋，列出來源"],
      "original_data_references": ["引用的原始資料片段或數值"],
      "needs_verification": true/false
    }
  ],
  "issues_found": [
    {
      "issue": "發現的問題",
      "severity": "LOW/MEDIUM/HIGH/CRITICAL",
      "suggestion": "改進建議",
      "original_data_evidence": "相關的原始資料證據"
    }
  ],
  "overall_assessment": "PASS/NEEDS_REVISION/FAIL",
  "recommendations": ["具體建議"]
}

## 注意事項

- ⭐ **必須基於原始資料審查**：不能僅依賴執行者的總結
- ⭐ **必須驗證數值一致性**：檢查執行者引用的數值是否與原始資料一致
- ⭐ **必須檢查隱性省略**：確認執行者沒有遺漏重要的原始資料
- 如果問題類型是 FACT_CHECK，你應該在回答中明確說明是否使用了 CSE 搜尋驗證
- 對於需要事實查證的問題，優先使用無限制 CSE 搜尋獲取可靠來源
- 如果發現執行者的輸出有重大問題，必須明確標記為 CRITICAL
`;

  return prompt;
}

/**
 * 檢查是否有 FACT_CHECK 類型的 audit_questions
 * @param {Object} payload - 輸入負載
 * @return {boolean} 是否有 FACT_CHECK
 */
function checkForFactCheck(payload) {
  if (!payload.previous_result || !payload.previous_result.audit_questions) {
    return false;
  }
  
  const auditQuestions = payload.previous_result.audit_questions;
  
  return Array.isArray(auditQuestions) && 
         auditQuestions.some(q => q.type === "FACT_CHECK");
}

/**
 * 執行 GEMINI_SEARCH（事實查證）
 * @param {string} jobId - 任務 ID
 * @param {string} step - 步驟名稱
 * @param {Object} payload - 輸入負載
 * @return {Object} 執行結果
 */
function executeGeminiSearch(jobId, step, payload) {
  try {
    Logger.log(`GEMINI_SEARCH 執行：jobId=${jobId}, step=${step}`);
    
    // 1. 提取 FACT_CHECK 類型的 audit_questions
    const auditQuestions = payload.previous_result?.audit_questions || [];
    const factCheckQuestions = auditQuestions.filter(q => q.type === "FACT_CHECK");
    
    if (factCheckQuestions.length === 0) {
      Logger.log("GEMINI_SEARCH：沒有 FACT_CHECK 類型的問題，返回空結果");
      return {
        modelId: "GEMINI_SEARCH",
        output: {
          fact_check_results: [],
          reliable_sources: [],
          conflicts: []
        },
        note: "沒有 FACT_CHECK 問題"
      };
    }
    
    Logger.log(`GEMINI_SEARCH：找到 ${factCheckQuestions.length} 個 FACT_CHECK 問題`);
    
    const factCheckResults = [];
    const allReliableSources = [];
    const allConflicts = [];
    
    // 2. 對每個 FACT_CHECK 問題進行搜尋和驗證
    for (const question of factCheckQuestions) {
      const questionText = question.question || question.text || "";
      if (!questionText) {
        continue;
      }
      
      Logger.log(`GEMINI_SEARCH：處理問題「${questionText}」`);
      
      // 2.1 使用 Google CSE 搜尋
      const cseResult = executeCSESearch(jobId, "CSE_SEARCH", {
        search_query: questionText,
        cse_type: "P5_NEWS",  // 使用新聞搜尋
        max_results: 10
      });
      
      const searchResults = cseResult.output?.search_results || [];
      
      if (searchResults.length === 0) {
        Logger.log(`GEMINI_SEARCH：問題「${questionText}」沒有找到搜尋結果`);
        factCheckResults.push({
          question: questionText,
          question_id: question.id || null,
          sources: [],
          reliability_tiers: [],
          conflicts: [],
          status: "NO_SOURCES"
        });
        continue;
      }
      
      // 2.2 使用 Gemini Pro 判斷來源可靠性（5 Tiers）
      const reliabilityResults = [];
      
      for (const source of searchResults) {
        try {
          // 構建 Gemini Pro 的提示詞
          const reliabilityPrompt = `請評估以下資訊來源的可信度，並將其分類到 5 個等級之一：

來源標題：${source.title}
來源網址：${source.link}
來源摘要：${source.snippet}

需要驗證的問題：${questionText}

請根據以下標準評估：
- Tier 1（最高可信度）：官方機構、知名媒體（如 Reuters、Bloomberg、WSJ、Nikkei）
- Tier 2（高可信度）：專業財經媒體、知名金融機構
- Tier 3（中等可信度）：一般新聞媒體、專業網站
- Tier 4（低可信度）：個人部落格、論壇、社交媒體
- Tier 5（不可信）：明顯的假資訊、惡意網站

請以 JSON 格式回答：
{
  "tier": 1-5,
  "reason": "評估理由",
  "is_reliable": true/false,
  "confidence": 0.0-1.0
}`;

          // 通過 M0 executeCapability 統一調用（符合 M0 統一調配原則）
          const geminiResult = executeCapability(jobId, "GEMINI_PRO", {
            task_prompt: reliabilityPrompt
          });
          
          let reliabilityAssessment;
          try {
            reliabilityAssessment = typeof geminiResult.output === 'string' 
              ? JSON.parse(geminiResult.output) 
              : geminiResult.output;
          } catch (e) {
            // 如果解析失敗，嘗試從文字中提取
            const outputText = typeof geminiResult.output === 'string' 
              ? geminiResult.output 
              : JSON.stringify(geminiResult.output);
            
            // 簡單的解析邏輯（如果 JSON 解析失敗）
            const tierMatch = outputText.match(/["']tier["']\s*:\s*(\d)/);
            const tier = tierMatch ? parseInt(tierMatch[1]) : 3;  // 預設 Tier 3
            
            reliabilityAssessment = {
              tier: tier,
              reason: outputText.substring(0, 200),
              is_reliable: tier <= 2,
              confidence: tier <= 2 ? 0.7 : 0.5
            };
          }
          
          reliabilityResults.push({
            source: source,
            tier: reliabilityAssessment.tier || 3,
            reason: reliabilityAssessment.reason || "未提供理由",
            is_reliable: reliabilityAssessment.is_reliable !== false && reliabilityAssessment.tier <= 2,
            confidence: reliabilityAssessment.confidence || 0.5
          });
          
          // 收集所有可靠來源（Tier 1-2）
          if (reliabilityAssessment.tier <= 2) {
            allReliableSources.push({
              question: questionText,
              source: source,
              tier: reliabilityAssessment.tier,
              reason: reliabilityAssessment.reason
            });
          }
          
        } catch (error) {
          Logger.log(`GEMINI_SEARCH：評估來源可靠性失敗：${error.message}`);
          // 如果評估失敗，預設為 Tier 3
          reliabilityResults.push({
            source: source,
            tier: 3,
            reason: "評估失敗",
            is_reliable: false,
            confidence: 0.3
          });
        }
      }
      
      // 2.3 篩選可信來源（Tier 1-2）
      const reliableSources = reliabilityResults.filter(r => r.is_reliable);
      
      // 2.4 標註衝突（如果有多個來源但答案不一致）
      const conflicts = [];
      if (reliableSources.length >= 2) {
        // 簡單的衝突檢測：如果有多個可靠來源，檢查它們的摘要是否一致
        // 這裡可以進一步使用 AI 來判斷內容是否衝突
        // 目前先標記為需要人工檢查
        conflicts.push({
          question: questionText,
          sources_count: reliableSources.length,
          note: "多個可靠來源，需要進一步驗證一致性"
        });
        allConflicts.push(...conflicts);
      }
      
      factCheckResults.push({
        question: questionText,
        question_id: question.id || null,
        sources: searchResults,
        reliability_tiers: reliabilityResults,
        reliable_sources: reliableSources,
        conflicts: conflicts,
        status: reliableSources.length > 0 ? "VERIFIED" : "UNVERIFIED"
      });
    }
    
    Logger.log(`GEMINI_SEARCH 執行完成：處理 ${factCheckResults.length} 個問題，找到 ${allReliableSources.length} 個可靠來源，${allConflicts.length} 個衝突`);
    
    return {
      modelId: "GEMINI_SEARCH",
      output: {
        fact_check_results: factCheckResults,
        reliable_sources: allReliableSources,
        conflicts: allConflicts,
        total_questions: factCheckQuestions.length,
        verified_questions: factCheckResults.filter(r => r.status === "VERIFIED").length
      },
      note: `GEMINI_SEARCH 完成：${factCheckResults.length} 個問題，${allReliableSources.length} 個可靠來源`
    };
  } catch (error) {
    Logger.log(`GEMINI_SEARCH 執行失敗：${error.message}`);
    
    // 返回錯誤結果，但不會中斷整個流程
    return {
      modelId: "GEMINI_SEARCH",
      output: {
        fact_check_results: [],
        reliable_sources: [],
        conflicts: [],
        error: error.message
      },
      note: `GEMINI_SEARCH 失敗：${error.message}`
    };
  }
}

/**
 * 執行 CSE_SEARCH（Google Custom Search）
 * @param {string} jobId - 任務 ID
 * @param {string} step - 步驟名稱
 * @param {Object} payload - 輸入負載
 * @return {Object} 執行結果
 */
function executeCSESearch(jobId, step, payload) {
  try {
    Logger.log(`CSE_SEARCH 執行：jobId=${jobId}, step=${step}`);
    
    // 1. 解析搜尋參數
    const searchQuery = payload.search_query || payload.query || "";
    const cseType = payload.cse_type || "P5_NEWS";  // 預設使用新聞搜尋
    const maxResults = payload.max_results || 10;
    
    if (!searchQuery) {
      throw new Error("CSE_SEARCH 需要 search_query 參數");
    }
    
    Logger.log(`CSE_SEARCH：query="${searchQuery}", cseType=${cseType}, maxResults=${maxResults}`);
    
    // 2. 獲取 CSE 配置
    const cseConfig = GOOGLE_CSE_CONFIG[cseType];
    if (!cseConfig) {
      throw new Error(`CSE 類型未配置：${cseType}`);
    }
    
    // 3. 獲取 API Key 和 CX ID
    // ⭐ V8.0 修正：優先使用專門的 GOOGLE_CSE_API_KEY
    const properties = PropertiesService.getScriptProperties();
    let apiKey;
    
    // 優先使用專門的 CSE API Key（直接從 PropertiesService 讀取，不加前綴）
    apiKey = properties.getProperty("GOOGLE_CSE_API_KEY");
    
    if (!apiKey) {
      // Fallback：嘗試使用其他 API Key
      try {
        apiKey = getAPIKey("GEMINI");  // Fallback：嘗試使用 Gemini API Key
      } catch (e) {
        try {
          apiKey = getAPIKey("GOOGLE");  // Fallback：或使用專門的 Google API Key
        } catch (e2) {
          throw new Error("Google CSE API Key 未配置，請設置 GOOGLE_CSE_API_KEY、API_KEY_GEMINI 或 API_KEY_GOOGLE");
        }
      }
    }
    
    const cxId = getGoogleCSE_CX(cseType);
    
    // 4. 構建搜尋 URL（支持分頁以獲取更多結果）
    // ⭐ V8.13 修正：Google CSE API 單次最多返回 10 筆，需要分頁獲取更多結果
    // 如果 maxResults > 10，需要進行多次搜尋（每次最多 10 筆）
    const allItems = [];
    const resultsPerPage = 10;  // Google CSE API 限制：每頁最多 10 筆
    const totalPages = Math.ceil(maxResults / resultsPerPage);
    let totalResults = "0";
    let searchTime = 0;
    
    Logger.log(`CSE_SEARCH：需要獲取 ${maxResults} 筆結果，將進行 ${totalPages} 次搜尋（每頁最多 ${resultsPerPage} 筆）`);
    
    for (let page = 0; page < totalPages && allItems.length < maxResults; page++) {
      const startIndex = page * resultsPerPage + 1;  // Google CSE API 使用 1-based index
      const numForThisPage = Math.min(resultsPerPage, maxResults - allItems.length);
      
      // 構建搜尋 URL
      const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&num=${numForThisPage}&start=${startIndex}`;
      
      Logger.log(`CSE_SEARCH API URL（第 ${page + 1}/${totalPages} 頁）：${apiUrl.replace(apiKey, "***")}`);
      
      // 5. 發送搜尋請求
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const options = {
            method: "GET",
            muteHttpExceptions: true
          };
          
          response = UrlFetchApp.fetch(apiUrl, options);
          
          if (response.getResponseCode() === 200) {
            break;  // 成功，退出重試循環
          } else if (response.getResponseCode() === 429) {
            // Rate limit，等待後重試
            retryCount++;
            if (retryCount < maxRetries) {
              const delay = calculateRetryDelay(retryCount);
              Logger.log(`Google CSE API Rate Limit，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
              Utilities.sleep(delay);
              continue;
            }
          } else {
            // 其他錯誤，拋出異常
            const errorBody = JSON.parse(response.getContentText());
            throw new Error(`Google CSE API 錯誤：${errorBody.error?.message || response.getResponseCode()}`);
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Google CSE API 調用失敗：${error.message}`);
          }
          
          const delay = calculateRetryDelay(retryCount);
          Logger.log(`Google CSE API 調用失敗，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
          Utilities.sleep(delay);
        }
      }
      
      // 6. 解析搜尋結果
      const responseBody = JSON.parse(response.getContentText());
      const items = responseBody.items || [];
      
      // 保存總結果數和搜尋時間（只保存第一頁的）
      if (page === 0) {
        totalResults = responseBody.searchInformation?.totalResults || "0";
        searchTime = responseBody.searchInformation?.searchTime || 0;
      }
      
      Logger.log(`CSE_SEARCH（第 ${page + 1}/${totalPages} 頁）：找到 ${items.length} 筆結果`);
      
      // 添加到總結果列表
      allItems.push(...items);
      
      // 如果這一頁返回的結果少於請求的數量，說明已經沒有更多結果了
      if (items.length < numForThisPage) {
        Logger.log(`CSE_SEARCH：已獲取所有可用結果（共 ${allItems.length} 筆）`);
        break;
      }
      
      // 避免請求過快（分頁之間稍作延遲）
      if (page < totalPages - 1) {
        Utilities.sleep(500);  // 延遲 0.5 秒
      }
    }
    
    const items = allItems.slice(0, maxResults);  // 確保不超過請求的數量
    
    Logger.log(`CSE_SEARCH：總共找到 ${items.length} 筆結果`);
    
    // ⭐⭐⭐ V8.0 定案：所有白名單都由 CSE 後台設定，程式碼中不需要任何白名單過濾機制
    // 完全信任 CSE 後台的白名單設定，直接使用所有返回的結果
    const filteredItems = items;  // 不再過濾，直接使用所有結果
    
    // 8. 格式化結果
    const searchResults = filteredItems.map(item => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
      displayLink: item.displayLink || "",
      formattedUrl: item.formattedUrl || ""
    }));
    
    Logger.log(`CSE_SEARCH 執行完成：返回 ${searchResults.length} 筆結果`);
    
    return {
      modelId: "CSE_SEARCH",
      output: {
        search_query: searchQuery,
        cse_type: cseType,
        total_results: totalResults,
        search_time: searchTime,
        search_results: searchResults,
        raw_items_count: items.length,
        filtered_items_count: items.length  // ⭐ V8.0：不再過濾，數量等於原始數量
      },
      note: `CSE_SEARCH 完成：${searchResults.length} 筆結果`
    };
  } catch (error) {
    Logger.log(`CSE_SEARCH 執行失敗：${error.message}`);
    
    // 返回錯誤結果，但不會中斷整個流程
    return {
      modelId: "CSE_SEARCH",
      output: {
        search_results: [],
        error: error.message
      },
      note: `CSE_SEARCH 失敗：${error.message}`
    };
  }
}

/**
 * 執行 CSE_SEARCH_UNRESTRICTED（無白名單限制的 CSE 搜尋）
 * ⭐ V6.3 自我質疑機制：審查者使用無限制 CSE 進行事實查證
 * 
 * @param {string} jobId - 任務 ID
 * @param {string} step - 步驟名稱
 * @param {Object} payload - 輸入負載
 * @return {Object} 執行結果
 */
function executeCSESearchUnrestricted(jobId, step, payload) {
  try {
    Logger.log(`CSE_SEARCH_UNRESTRICTED 執行：jobId=${jobId}, step=${step}`);
    
    // 1. 解析搜尋參數
    const searchQuery = payload.search_query || payload.query || "";
    const maxResults = payload.max_results || 10;
    
    if (!searchQuery) {
      throw new Error("CSE_SEARCH_UNRESTRICTED 需要 search_query 參數");
    }
    
    Logger.log(`CSE_SEARCH_UNRESTRICTED：query="${searchQuery}", maxResults=${maxResults}`);
    
    // 2. 獲取無限制 CSE 的 CX ID（使用 GOOGLE_CSE_ALL）
    const properties = PropertiesService.getScriptProperties();
    const cxId = properties.getProperty("GOOGLE_CSE_ALL");
    
    if (!cxId) {
      throw new Error("無限制 CSE CX ID 未配置：GOOGLE_CSE_ALL，請在 PropertiesService 中設置");
    }
    
    // 3. 獲取 Google API Key
    let apiKey;
    try {
      apiKey = getAPIKey("GOOGLE_CSE_API_KEY");  // 優先使用專門的 CSE API Key
    } catch (e) {
      try {
        apiKey = getAPIKey("GEMINI");  // 備用：使用 Gemini API Key
      } catch (e2) {
        try {
          apiKey = getAPIKey("GOOGLE");  // 備用：使用 Google API Key
        } catch (e3) {
          throw new Error("Google API Key 未配置，請設置 GOOGLE_CSE_API_KEY、API_KEY_GEMINI 或 API_KEY_GOOGLE");
        }
      }
    }
    
    // 4. 構建搜尋 URL（無白名單限制）
    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(searchQuery)}&num=${Math.min(maxResults, 10)}`;
    
    Logger.log(`CSE_SEARCH_UNRESTRICTED API URL：${apiUrl.replace(apiKey, "***")}`);
    
    // 5. 發送搜尋請求（帶重試機制）
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const options = {
          method: "GET",
          muteHttpExceptions: true
        };
        
        response = UrlFetchApp.fetch(apiUrl, options);
        
        if (response.getResponseCode() === 200) {
          break;  // 成功，退出重試循環
        } else if (response.getResponseCode() === 429) {
          // Rate limit，等待後重試
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = calculateRetryDelay(retryCount);
            Logger.log(`Google CSE API Rate Limit，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
            Utilities.sleep(delay);
            continue;
          }
        } else {
          // 其他錯誤，拋出異常
          const errorBody = JSON.parse(response.getContentText());
          throw new Error(`Google CSE API 錯誤：${errorBody.error?.message || response.getResponseCode()}`);
        }
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`Google CSE API 調用失敗：${error.message}`);
        }
        
        const delay = calculateRetryDelay(retryCount);
        Logger.log(`Google CSE API 調用失敗，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
        Utilities.sleep(delay);
      }
    }
    
    // 6. 解析搜尋結果（不進行白名單過濾）
    const responseBody = JSON.parse(response.getContentText());
    const items = responseBody.items || [];
    
    Logger.log(`CSE_SEARCH_UNRESTRICTED：找到 ${items.length} 筆結果（無白名單限制）`);
    
    // 7. 格式化結果（不過濾，保留所有結果）
    const searchResults = items.map(item => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
      displayLink: item.displayLink || "",
      formattedUrl: item.formattedUrl || ""
    }));
    
    Logger.log(`CSE_SEARCH_UNRESTRICTED 執行完成：返回 ${searchResults.length} 筆結果`);
    
    return {
      modelId: "CSE_SEARCH_UNRESTRICTED",
      output: {
        search_query: searchQuery,
        cse_type: "UNRESTRICTED",
        total_results: responseBody.searchInformation?.totalResults || "0",
        search_time: responseBody.searchInformation?.searchTime || 0,
        search_results: searchResults,
        raw_items_count: items.length,
        note: "無白名單限制，返回所有搜尋結果"
      },
      note: `CSE_SEARCH_UNRESTRICTED 完成：${searchResults.length} 筆結果（無限制）`
    };
  } catch (error) {
    Logger.log(`CSE_SEARCH_UNRESTRICTED 執行失敗：${error.message}`);
    
    // 返回錯誤結果，但不會中斷整個流程
    return {
      modelId: "CSE_SEARCH_UNRESTRICTED",
      output: {
        search_results: [],
        error: error.message
      },
      note: `CSE_SEARCH_UNRESTRICTED 失敗：${error.message}`
    };
  }
}

/**
 * 執行 P0 機構級數據收集（特殊處理）
 * @param {string} jobId - 任務 ID
 * @param {string} step - 步驟名稱
 * @param {Object} payload - 輸入負載
 * @return {Object} 執行結果
 */
// ⭐ 機構級數據收集已移至 P2.5 和 P5 Daily 模組
// P0 專注於純學術硬底子分析（物理學、產業供應鏈學）

/**
 * 解析 Options Flow 數據（簡化版）
 */
function parseOptionsFlowData(searchResults) {
  const optionsFlow = {};
  
  // TODO: 實際解析邏輯
  return optionsFlow;
}
