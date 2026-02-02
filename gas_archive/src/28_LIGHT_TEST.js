/**
 * 🧪 V8.0 輕測試系統
 * 
 * 測試所有 Phase 的完整流程和 Prompt 有效程度
 * 
 * ⭐ 輕測試的「輕」定義：
 * - P0：僅選兩個產業面（工程瓶頸類 1 個、服務壟斷類 1 個）
 * - P1：每個產業面僅選 10 間公司
 * - 其他 Phase（P2、P2.5、P3、P4、P5 Daily、P5 Weekly）都跟正式一樣
 * 
 * ⚠️ 重要原則：
 * - 所有輕測試都要正式蒐集數據，藉此測試數據線是否暢通
 * - 不再設置 test_mode 和 missing_data_policy
 * - 所有 Phase 都正式從外部數據源收集數據
 * 
 * @version SSOT V8.0
 * @date 2025-01-15
 * @updated 2026-01-16 - 移除所有 test_mode 和 missing_data_policy，所有測試都正式蒐集數據
 */

// ==========================================
// 測試配置
// ==========================================

const LIGHT_TEST_CONFIG = {
  // P0 測試配置
  p0: {
    theme_focus: "AI/半導體/新能源",
    eng_count: 1,  // 工程瓶頸類 1 個
    struct_count: 1  // 服務壟斷類 1 個
  },
  
  // P1 測試配置
  p1: {
    companies_per_theme: 10  // 每個主題 10 間公司（兩個產業面各 10 間，總共 20 間）
  },
  
  // P2-P4 測試配置
  p2_p4: {
    use_p1_results: true  // 使用 P1 結果（約 10 間公司）
  },
  
  // P5 Daily 測試配置
  p5_daily: {
    ohlcv_tickers: "P4_RESULT",  // 使用 P4 結果的 10 間公司
    news_date: "TODAY",  // 抓今天的新聞
    other_data: "NORMAL"  // 其他數據正常抓
  },
  
  // P5 Weekly 測試配置
  p5_weekly: {
    earnings_simulation: {
      enabled: true,
      tickers: 2,  // 模擬 2 間公司
      days_until: 3  // 三天後財報
    }
  }
  
  // ⚠️ 注意：輕測試的「輕」只體現在 P0 和 P1 的數量限制
  // 其他 Phase（P2、P2.5、P3、P4、P5 Daily、P5 Weekly）都跟正式一樣，包括正式蒐集數據
  // 不再設置 missing_data.policy，所有測試都正式蒐集數據，藉此測試數據線是否暢通
};

// ==========================================
// 測試主函數
// ==========================================

/**
 * 執行輕測試（完整流程）
 * 
 * @param {Object} params - 測試參數
 * @param {string} params.phase - 要測試的 Phase（P0/P0_5/P0_7/P1/P2/P2_5/P3/P4/P5_DAILY/P5_WEEKLY）
 * @param {boolean} params.use_previous_results - 是否使用前段結果（預設 true）
 * @returns {Object} 測試結果
 */
function LightTest_Execute(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`🧪 輕測試開始：phase=${params.phase}`);
    
    const phase = params.phase || "P0";
    const usePrevious = params.use_previous_results !== false;
    
    // 根據 Phase 執行對應測試
    let result;
    
    switch (phase) {
      case "P0":
        result = testP0();
        break;
      case "P0_5":
        result = testP0_5(usePrevious);
        break;
      case "P0_7":
        result = testP0_7(usePrevious);
        break;
      case "P1":
        result = testP1(usePrevious);
        break;
      case "P2":
        result = testP2(usePrevious);
        break;
      case "P2_5":
        result = testP2_5(usePrevious);
        break;
      case "P3":
        result = testP3(usePrevious);
        break;
      case "P4":
        result = testP4(usePrevious);
        break;
      case "P5_DAILY":
        result = testP5Daily(usePrevious);
        break;
      case "P5_WEEKLY":
        result = testP5Weekly(usePrevious);
        break;
      default:
        throw new Error(`未知的 Phase：${phase}`);
    }
    
    const duration = Date.now() - startTime;
    
    Logger.log(`🧪 輕測試完成：phase=${phase}, 耗時=${duration}ms`);
    
    // ⭐ V8.0 修正：保留原始狀態（如果是 SUBMITTED，表示需要執行 M0）
    const finalStatus = result.status || "COMPLETED";
    
    return {
      status: finalStatus,  // 保留原始狀態（SUBMITTED/COMPLETED/ERROR）
      phase: phase,
      duration: duration,
      result: result,
      ai_output_fields: result.ai_output_fields || [],  // AI 回應的欄位
      prompt_evaluation: result.prompt_evaluation || {},  // Prompt 有效程度評估
      message: result.message || null  // 如果有訊息（例如：需要執行 M0），也傳遞
    };
    
  } catch (error) {
    Logger.log(`🧪 輕測試失敗：${error.message}`);
    return {
      status: "FAILED",
      phase: params.phase,
      error: error.message,
      stack: error.stack
    };
  }
}

// ==========================================
// P0 測試
// ==========================================

/**
 * 測試 P0：產業工程學分析
 * 
 * 要求：產出工程瓶頸類 1 個、服務壟斷類 1 個
 */
function testP0() {
  try {
    Logger.log("🧪 P0 測試開始");
    
    // ⭐ V8.0 修正：P0 不需要使用者輸入，自動找出面向
    // P0 本身就是用來找面向的工具，不需要問使用者問題
    const userInput = {
      theme_focus: LIGHT_TEST_CONFIG.p0.theme_focus || "AI/半導體/新能源",  // 僅作為分析範圍參考
      geographic_focus: "ALL",
      time_horizon: "MEDIUM"
    };
    
    const context = {
      // ⭐ 輕測試的「輕」：僅選兩個產業面（工程瓶頸類 1 個、服務壟斷類 1 個）
      eng_count: LIGHT_TEST_CONFIG.p0.eng_count || 1,  // 至少 1 個工程瓶頸類
      struct_count: LIGHT_TEST_CONFIG.p0.struct_count || 1  // 至少 1 個定價權獨佔類
      // ⚠️ 注意：不設置 test_mode，所有數據都正式蒐集
    };
    
    // 執行 P0
    const p0Result = P0_Execute({
      trigger: "LIGHT_TEST",
      user_input: userInput,
      context: context
    });
    
    // 如果返回 SUBMITTED，提示用戶執行 M0
    if (p0Result.status === "SUBMITTED") {
      Logger.log("🧪 P0 測試：任務已提交到 M0，請手動執行 M0_Execute() 或等待自動觸發器執行");
      return {
        status: "SUBMITTED",
        job_id: p0Result.job_id,
        message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
        ai_output_fields: [],
        prompt_evaluation: {}
      };
    }
    
    // ⭐ V8.0 修正：如果返回 COMPLETED，從快照中讀取完整的 AI 輸出
    if (p0Result.status === "COMPLETED" && p0Result.snapshot_id) {
      // 讀取快照以獲取完整的 AI 輸出
      const snapshot = getLatestP0Snapshot();
      if (snapshot && snapshot.p0_output) {
        // 從快照中提取 AI 輸出欄位
        const aiFields = extractAIFields(snapshot.p0_output);
        const evaluation = evaluateP0Output(snapshot.p0_output);
        
        // ⭐ V8.0 新增：自動從 M0__CROSSCHECK_LOG 讀取 AI 原始回應（僅用於資料讀取）
        // ⚠️ 重要原則：AI 回應的檢查人必須是這個對話框的 AI 助手（我），不能是程式自動檢查
        // 只有對整個計畫完全了解的 AI 才能正確評估 AI 回應是否符合設計精神
        // 此處的「評估」只是初步的欄位檢查，最終評估必須由 AI 助手進行
        let deepEvaluation = null;
        if (p0Result.job_id) {
          Logger.log(`🧪 P0 測試：自動讀取 AI 原始回應（僅供資料讀取），job_id=${p0Result.job_id}`);
          Logger.log(`⚠️ 重要：最終評估必須由 AI 助手（這個對話框的我）進行，不能依賴程式自動檢查`);
          const aiResponses = getAIResponsesFromCrosscheckLog(p0Result.job_id);
          deepEvaluation = deepEvaluateAIResponses(aiResponses.executor_output, aiResponses.auditor_output, "P0");
          
          // 合併初步評估結果到現有評估中（僅作為參考）
          // 注意：這些只是初步的欄位檢查，不是真正的 AI 回應評估
          if (evaluation.core_assessment) {
            // 如果初步評估的結果更詳細，使用初步評估的結果（但仍需 AI 助手最終確認）
            if (deepEvaluation.core_assessment.task_alignment.assessment !== "PENDING") {
              evaluation.core_assessment.task_alignment = deepEvaluation.core_assessment.task_alignment;
              evaluation.core_assessment.task_alignment.note = "⚠️ 此為初步欄位檢查，最終評估需由 AI 助手（我）進行";
            }
            if (deepEvaluation.core_assessment.emphasis_check.assessment !== "PENDING") {
              evaluation.core_assessment.emphasis_check = deepEvaluation.core_assessment.emphasis_check;
              evaluation.core_assessment.emphasis_check.note = "⚠️ 此為初步欄位檢查，最終評估需由 AI 助手（我）進行";
            }
          } else {
            evaluation.core_assessment = deepEvaluation.core_assessment;
          }
          
          // 添加原始回應信息
          evaluation.ai_raw_responses = {
            executor_available: deepEvaluation.executor_available,
            auditor_available: deepEvaluation.auditor_available,
            job_id: p0Result.job_id,
            note: "⚠️ 最終評估必須由 AI 助手（這個對話框的我）進行，請提供原始回應讓我檢查"
          };
        }
        
        Logger.log(`🧪 P0 測試：已提取 ${aiFields.length} 個 AI 輸出欄位`);
        Logger.log(`🧪 P0 測試：themes 數量=${(snapshot.p0_output.themes || []).length}, subthemes 數量=${(snapshot.p0_output.subthemes || []).length}`);
        
        return {
      status: "COMPLETED",
          p0_result: p0Result,
          snapshot: snapshot,
          ai_output_fields: aiFields,
          prompt_evaluation: evaluation,
          deep_evaluation: deepEvaluation
        };
      }
    }
    
    // 如果已經有結果，直接評估
    const evaluation = evaluateP0Output(p0Result);
    
    return {
      p0_result: p0Result,
      ai_output_fields: extractAIFields(p0Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P0 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P0 輸出
 */
function evaluateP0Output(p0Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  // ⭐ V8.0 修正：支持從不同結構中提取 themes
  // p0Result 可能是快照對象（包含 p0_output），也可能是直接的輸出對象
  const p0Output = p0Result.p0_output || p0Result.p0_output_json || p0Result;
  const themes = p0Output.themes || [];
  const subthemes = p0Output.subthemes || [];
  
  // 檢查是否產出兩大類各一個（測試模式要求）
  const engThemes = themes.filter(t => {
    const analysisType = t.analysis_type || t.type || "";
    return analysisType === "ENG" || analysisType === "BOTH";
  });
  const structThemes = themes.filter(t => {
    const analysisType = t.analysis_type || t.type || "";
    return analysisType === "STRUCT" || analysisType === "BOTH";
  });
  
  evaluation.completeness.has_eng = engThemes.length >= 1;
  evaluation.completeness.has_struct = structThemes.length >= 1;
  evaluation.completeness.theme_count = themes.length;
  evaluation.completeness.subtheme_count = subthemes.length;
  
  // 檢查測試模式要求：應有 2 個 themes（1 個工程瓶頸類 + 1 個定價權獨佔類）
  if (themes.length !== 2) {
    evaluation.issues.push({
      severity: "HIGH",
      issue: `測試模式要求 2 個 themes，實際產出 ${themes.length} 個`,
      suggestion: "檢查 Prompt 是否正確要求只產出 2 個 themes"
    });
  }
  
  if (engThemes.length !== 1) {
    evaluation.issues.push({
      severity: "HIGH",
      issue: `測試模式要求 1 個工程瓶頸類（ENG），實際產出 ${engThemes.length} 個`,
      suggestion: "檢查 Prompt 是否正確要求只產出 1 個工程瓶頸類"
    });
  }
  
  if (structThemes.length !== 1) {
    evaluation.issues.push({
      severity: "HIGH",
      issue: `測試模式要求 1 個定價權獨佔類（STRUCT），實際產出 ${structThemes.length} 個`,
      suggestion: "檢查 Prompt 是否正確要求只產出 1 個定價權獨佔類"
    });
  }
  
  // 檢查 P0-3 強制輸出（五項缺一不可）
  for (const theme of themes) {
    const requiredFields = [
      "problem_oneliner",
      "failure_mode",
      "no_alternative_reason",
      "convergence_evidence",
      "long_term_time_window"
    ];
    
    const missingFields = requiredFields.filter(field => !theme[field]);
    
    if (missingFields.length > 0) {
      evaluation.issues.push({
        theme: theme.theme_id || theme.theme_name || "未知",
        issue: `缺少 P0-3 強制輸出欄位：${missingFields.join(", ")}`,
        severity: "HIGH",
        suggestion: "檢查 Prompt 是否明確要求這五項強制輸出"
      });
    }
    
    // 檢查 analysis_type 是否正確
    const analysisType = theme.analysis_type || theme.type;
    if (!analysisType || !["ENG", "STRUCT", "BOTH"].includes(analysisType)) {
      evaluation.issues.push({
        theme: theme.theme_id || theme.theme_name || "未知",
        issue: `analysis_type 格式錯誤或缺失：${analysisType}`,
        severity: "MEDIUM"
      });
    }
  }
  
  // 檢查 subthemes
  for (const subtheme of subthemes) {
    if (!subtheme.theme_id) {
      evaluation.issues.push({
        severity: "MEDIUM",
        issue: `subtheme 缺少 theme_id 關聯：${subtheme.subtheme_id || subtheme.subtheme_name || "未知"}`,
        suggestion: "檢查 Prompt 是否要求 subtheme 必須關聯到 theme"
      });
    }
  }
  
  // 品質評估
  evaluation.quality.json_valid = true;  // 如果能解析到這裡，JSON 應該是有效的
  evaluation.quality.logic_consistent = (engThemes.length + structThemes.length >= themes.length);
  evaluation.quality.content_quality = (evaluation.issues.length === 0) ? "GOOD" : 
                                       (evaluation.issues.filter(i => i.severity === "HIGH").length === 0) ? "FAIR" : "POOR";
  
  // ⭐ V8.0 新增：三個核心評估重點
  evaluation.core_assessment = {
    // 重點 1：是否符合主要任務與設計精神
    task_alignment: {
      assessment: "PENDING",  // "ALIGNED" / "PARTIAL" / "MISALIGNED" / "PENDING"
      description: "評估 AI 回應是否符合 P0 的核心任務（產業工程學分析：工程必然 vs 結構性定價權）",
      issues: [],
      suggestions: []
    },
    
    // 重點 2：是否強調出重視的部分
    emphasis_check: {
      assessment: "PENDING",  // "STRONG" / "MODERATE" / "WEAK" / "OFF_TOPIC" / "PENDING"
      description: "評估 AI 是否正確強調 P0-3 五項強制輸出等重要部分",
      issues: [],
      suggestions: []
    },
    
    // 重點 3：回答偏離度（一致性檢查）
    // ⚠️ 重要：一致性指的是「同一分析者（EXECUTOR），相同輸入資料，多次執行是否產生一致結論」
    // 例如：這次說 BUY，下次說 SELL（相同資料卻不同結論）→ 表示 Prompt 語意模糊，容易被 AI 誤解
    // 這不是指 EXECUTOR 和 AUDITOR 的一致性（兩者應該有不同的視角，用不同模型就是為了交叉驗證）
    consistency: {
      assessment: "PENDING",  // "HIGH" / "MEDIUM" / "LOW" / "PENDING"
      description: "評估同一分析者（EXECUTOR）對相同輸入多次執行的結果一致性。需要多次執行相同輸入才能評估。如果相同資料卻產生不同結論（例如：這次 BUY，下次 SELL），表示 Prompt 語意模糊，容易被 AI 誤解。",
      note: "⚠️ 注意：這是指同一分析者的多次執行一致性，不是指 EXECUTOR 和 AUDITOR 的一致性（兩者用不同模型，應該有不同的視角來交叉驗證）"
    }
  };
  
  // 自動評估重點 1：是否符合主要任務與設計精神
  if (themes.length === 2 && engThemes.length === 1 && structThemes.length === 1) {
    evaluation.core_assessment.task_alignment.assessment = "ALIGNED";
    evaluation.core_assessment.task_alignment.description = "✅ AI 正確理解了 P0 的核心任務：產出 1 個工程瓶頸類 + 1 個定價權獨佔類";
  } else {
    evaluation.core_assessment.task_alignment.assessment = "MISALIGNED";
    evaluation.core_assessment.task_alignment.issues.push({
      issue: `測試模式要求 2 個 themes（1 ENG + 1 STRUCT），實際產出 ${themes.length} 個（ENG: ${engThemes.length}, STRUCT: ${structThemes.length}）`,
      severity: "HIGH"
    });
    evaluation.core_assessment.task_alignment.suggestions.push("檢查 Prompt 是否明確要求「只找 1 個」而不是「至少 1 個」");
  }
  
  // 自動評估重點 2：是否強調出重視的部分（P0-3 五項強制輸出）
  let missingRequiredFieldsCount = 0;
  for (const theme of themes) {
    const requiredFields = ["problem_oneliner", "failure_mode", "no_alternative_reason", "convergence_evidence", "long_term_time_window"];
    const missing = requiredFields.filter(field => !theme[field]);
    if (missing.length > 0) {
      missingRequiredFieldsCount++;
    }
  }
  
  if (missingRequiredFieldsCount === 0) {
    evaluation.core_assessment.emphasis_check.assessment = "STRONG";
    evaluation.core_assessment.emphasis_check.description = "✅ AI 正確強調了 P0-3 五項強制輸出，所有 themes 都包含完整欄位";
  } else if (missingRequiredFieldsCount < themes.length) {
    evaluation.core_assessment.emphasis_check.assessment = "MODERATE";
    evaluation.core_assessment.emphasis_check.description = `⚠️ 部分 themes 缺少 P0-3 強制輸出，共 ${missingRequiredFieldsCount}/${themes.length} 個 themes 有缺失`;
    evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中更強烈地要求「P0-3 五項強制輸出缺一不可」");
  } else {
    evaluation.core_assessment.emphasis_check.assessment = "WEAK";
    evaluation.core_assessment.emphasis_check.description = "❌ 所有 themes 都缺少 P0-3 強制輸出，表示 Prompt 強調不足";
    evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中使用更強烈的語言（例如：「必須包含」、「不可省略」、「缺一不可」）");
  }
  
  // 重點 3（一致性）需要多次執行才能評估，這裡只標記為 PENDING
  
  return evaluation;
}

// ==========================================
// P0.5 測試
// ==========================================

/**
 * 測試 P0.5：產業鏈地圖
 */
function testP0_5(usePrevious) {
  try {
    Logger.log("🧪 P0.5 測試開始");
    
    // 讀取 P0 結果
    const p0Snapshot = usePrevious ? getLatestP0Snapshot() : null;
    
    if (!p0Snapshot && usePrevious) {
      throw new Error("P0.5 測試需要 P0 結果，請先執行 P0 測試");
    }
    
    // 執行 P0.5（需要檢查實際函數名稱）
    // 注意：P0.5 可能沒有獨立的執行函數，需要檢查實際實現
    Logger.log("🧪 P0.5 測試：P0.5 功能可能已整合到 P0，或需要單獨實現");
    
    // 暫時返回模擬結果
    const p0_5Result = {
      status: "SKIPPED",
      message: "P0.5 測試待實現（需要確認實際執行函數）"
    };
    
    // 評估 AI 回應
    const evaluation = evaluateP0_5Output(p0_5Result);
    
    return {
      p0_5_result: p0_5Result,
      ai_output_fields: extractAIFields(p0_5Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P0.5 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P0.5 輸出
 */
function evaluateP0_5Output(p0_5Result) {
  return {
    completeness: {
      has_chain_map: !!p0_5Result.chain_map,
      has_key_nodes: !!p0_5Result.key_nodes
    },
    quality: {},
    issues: []
  };
}

// ==========================================
// P0.7 測試
// ==========================================

/**
 * 測試 P0.7：系統動力學分析
 */
function testP0_7(usePrevious) {
  try {
    Logger.log("🧪 P0.7 測試開始");
    
    // 讀取 P0 結果
    const p0Snapshot = usePrevious ? getLatestP0Snapshot() : null;
    
    if (!p0Snapshot && usePrevious) {
      throw new Error("P0.7 測試需要 P0 結果，請先執行 P0 測試");
    }
    
    const userInput = {};
    
    // 執行 P0.7
    const p0_7Result = P0_7_Execute({
      trigger: "LIGHT_TEST",
      user_input: userInput,
      p0_snapshot_id: p0Snapshot?.snapshot_id || null
      // ⚠️ 注意：不設置 test_mode，所有數據都正式蒐集
    });
    
      // 如果返回 SUBMITTED，提示用戶執行 M0
      if (p0_7Result.status === "SUBMITTED") {
        Logger.log("🧪 P0.7 測試：任務已提交到 M0，請手動執行 M0_Execute()");
        return {
          status: "SUBMITTED",
          job_id: p0_7Result.job_id,
          message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
          ai_output_fields: [],
          prompt_evaluation: {}
        };
      }
    
    // 評估 AI 回應
    const evaluation = evaluateP0_7Output(p0_7Result);
    
    // ⭐ V8.0 新增：自動從 M0__CROSSCHECK_LOG 讀取 AI 原始回應（僅用於資料讀取）
    // ⚠️ 重要原則：AI 回應的檢查人必須是這個對話框的 AI 助手（我），不能是程式自動檢查
    // 只有對整個計畫完全了解的 AI 才能正確評估 AI 回應是否符合設計精神
    // 此處的「評估」只是初步的欄位檢查，最終評估必須由 AI 助手進行
    let deepEvaluation = null;
    if (p0_7Result.job_id) {
      Logger.log(`🧪 P0.7 測試：自動讀取 AI 原始回應（僅供資料讀取），job_id=${p0_7Result.job_id}`);
      Logger.log(`⚠️ 重要：最終評估必須由 AI 助手（這個對話框的我）進行，不能依賴程式自動檢查`);
      const aiResponses = getAIResponsesFromCrosscheckLog(p0_7Result.job_id);
      deepEvaluation = deepEvaluateAIResponses(aiResponses.executor_output, aiResponses.auditor_output, "P0_7");
      
      // 合併初步評估結果（僅作為參考）
      // 注意：這些只是初步的欄位檢查，不是真正的 AI 回應評估
      if (evaluation.core_assessment) {
        if (deepEvaluation.core_assessment.task_alignment.assessment !== "PENDING") {
          evaluation.core_assessment.task_alignment = deepEvaluation.core_assessment.task_alignment;
          evaluation.core_assessment.task_alignment.note = "⚠️ 此為初步欄位檢查，最終評估需由 AI 助手（我）進行";
        }
        if (deepEvaluation.core_assessment.emphasis_check.assessment !== "PENDING") {
          evaluation.core_assessment.emphasis_check = deepEvaluation.core_assessment.emphasis_check;
          evaluation.core_assessment.emphasis_check.note = "⚠️ 此為初步欄位檢查，最終評估需由 AI 助手（我）進行";
        }
      } else {
        evaluation.core_assessment = deepEvaluation.core_assessment;
      }
      
      evaluation.ai_raw_responses = {
        executor_available: deepEvaluation.executor_available,
        auditor_available: deepEvaluation.auditor_available,
        job_id: p0_7Result.job_id,
        note: "⚠️ 最終評估必須由 AI 助手（這個對話框的我）進行，請提供原始回應讓我檢查"
      };
    }
    
    return {
      p0_7_result: p0_7Result,
      ai_output_fields: extractAIFields(p0_7Result),
      prompt_evaluation: evaluation,
      deep_evaluation: deepEvaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P0.7 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P0.7 輸出
 */
function evaluateP0_7Output(p0_7Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  // ⭐ V8.0 修正：支持從不同結構中提取 themes
  const p0_7Output = p0_7Result.themes || p0_7Result.p0_7_output?.themes || p0_7Result.system_dynamics?.themes || [];
  const themes = Array.isArray(p0_7Output) ? p0_7Output : [];
  
  // 檢查是否按照固定順序完成
  for (const theme of themes) {
    const requiredSteps = [
      "dynamic_problem_oneliner",
      "stocks_and_flows",
      "causal_loops",
      "time_position",
      "leveraged_role_type"
    ];
    
    const missingSteps = requiredSteps.filter(step => !theme[step]);
    
    if (missingSteps.length > 0) {
      evaluation.issues.push({
        theme: theme.theme_id || theme.theme_name || "未知",
        issue: `缺少分析步驟：${missingSteps.join(", ")}`,
        severity: "HIGH"
      });
    }
    
    // 檢查 Loop_Dominance
    if (!theme.loop_dominance || !["R", "B", "Mixed"].includes(theme.loop_dominance)) {
      evaluation.issues.push({
        theme: theme.theme_id || theme.theme_name || "未知",
        issue: "Loop_Dominance 格式錯誤或缺失",
        severity: "MEDIUM"
      });
    }
    
    // 檢查 Time_Position
    if (!theme.time_position || !["Early", "Mid", "Late", "Transition"].includes(theme.time_position)) {
      evaluation.issues.push({
        theme: theme.theme_id || theme.theme_name || "未知",
        issue: "Time_Position 格式錯誤或缺失",
        severity: "MEDIUM"
      });
    }
  }
  
  evaluation.completeness.theme_count = themes.length;
  
  // ⭐ V8.0 新增：三個核心評估重點
  evaluation.core_assessment = {
    // 重點 1：是否符合主要任務與設計精神（系統動力學分析）
    task_alignment: {
      assessment: "PENDING",
      description: "評估 AI 回應是否符合 P0.7 的核心任務（系統動力學分析：存量流量、因果循環、時間定位）",
      issues: [],
      suggestions: []
    },
    
    // 重點 2：是否強調出重視的部分（固定順序分析步驟）
    emphasis_check: {
      assessment: "PENDING",
      description: "評估 AI 是否按照固定順序完成系統動力學分析步驟",
      issues: [],
      suggestions: []
    },
    
    // 重點 3：回答偏離度（一致性檢查）
    // ⚠️ 重要：一致性指的是「同一分析者（EXECUTOR），相同輸入資料，多次執行是否產生一致結論」
    // 例如：這次說 BUY，下次說 SELL（相同資料卻不同結論）→ 表示 Prompt 語意模糊，容易被 AI 誤解
    // 這不是指 EXECUTOR 和 AUDITOR 的一致性（兩者應該有不同的視角，用不同模型就是為了交叉驗證）
    consistency: {
      assessment: "PENDING",
      description: "評估同一分析者（EXECUTOR）對相同輸入多次執行的結果一致性。需要多次執行相同輸入才能評估。如果相同資料卻產生不同結論（例如：這次 BUY，下次 SELL），表示 Prompt 語意模糊，容易被 AI 誤解。",
      note: "⚠️ 注意：這是指同一分析者的多次執行一致性，不是指 EXECUTOR 和 AUDITOR 的一致性（兩者用不同模型，應該有不同的視角來交叉驗證）"
    }
  };
  
  // 評估重點 1：是否符合主要任務與設計精神
  if (themes.length === 0) {
    evaluation.core_assessment.task_alignment.assessment = "MISALIGNED";
    evaluation.core_assessment.task_alignment.issues.push({
      issue: "AI 未產出任何 themes，不符合 P0.7 的核心任務",
      severity: "CRITICAL"
    });
    evaluation.core_assessment.task_alignment.suggestions.push("檢查 Prompt 是否明確要求進行系統動力學分析");
  } else {
    // 檢查是否包含系統動力學的核心元素
    const hasSystemDynamics = themes.some(theme => 
      theme.stocks_and_flows || theme.causal_loops || theme.dynamic_problem_oneliner
    );
    if (hasSystemDynamics) {
      evaluation.core_assessment.task_alignment.assessment = "ALIGNED";
      evaluation.core_assessment.task_alignment.description = "✅ AI 正確理解了 P0.7 的核心任務：系統動力學分析";
    } else {
      evaluation.core_assessment.task_alignment.assessment = "MISALIGNED";
      evaluation.core_assessment.task_alignment.issues.push({
        issue: "AI 回應缺少系統動力學核心元素（存量流量、因果循環）",
        severity: "HIGH"
      });
      evaluation.core_assessment.task_alignment.suggestions.push("檢查 Prompt 是否明確要求分析「存量與流量」和「因果循環」");
    }
  }
  
  // 評估重點 2：是否強調出重視的部分（固定順序分析步驟）
  const requiredSteps = ["dynamic_problem_oneliner", "stocks_and_flows", "causal_loops", "time_position", "leveraged_role_type"];
  const allStepsPresent = themes.length > 0 && themes.every(theme => {
    return requiredSteps.every(step => theme[step]);
  });
  
  if (allStepsPresent) {
    evaluation.core_assessment.emphasis_check.assessment = "STRONG";
    evaluation.core_assessment.emphasis_check.description = "✅ AI 正確按照固定順序完成所有分析步驟";
  } else if (themes.length > 0) {
    const missingStepsCount = themes.reduce((count, theme) => {
      const missing = requiredSteps.filter(step => !theme[step]);
      return count + missing.length;
    }, 0);
    evaluation.core_assessment.emphasis_check.assessment = "MODERATE";
    evaluation.core_assessment.emphasis_check.description = `⚠️ 部分 themes 缺少必要的分析步驟（共缺少 ${missingStepsCount} 個步驟）`;
    evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中更明確地要求「必須按照固定順序完成」所有步驟");
    evaluation.core_assessment.emphasis_check.suggestions.push("使用更強烈的語言（例如：「必須包含」、「缺一不可」）強調每個步驟的重要性");
  } else {
    evaluation.core_assessment.emphasis_check.assessment = "WEAK";
    evaluation.core_assessment.emphasis_check.description = "❌ 無法評估，因為未產出 themes";
  }
  
  // 重點 3（一致性）需要多次執行才能評估，這裡只標記為 PENDING
  
  return evaluation;
}

// ==========================================
// P1 測試
// ==========================================

/**
 * 測試 P1：公司池篩選
 * 
 * 要求：每個主題 5 間公司
 */
function testP1(usePrevious) {
  try {
    Logger.log("🧪 P1 測試開始");
    
    // 讀取 P0 和 P0.7 結果
    const p0Snapshot = usePrevious ? getLatestP0Snapshot() : null;
    const p0_7Snapshot = usePrevious ? getLatestP0_7Snapshot() : null;
    
    if ((!p0Snapshot || !p0_7Snapshot) && usePrevious) {
      throw new Error("P1 測試需要 P0 和 P0.7 結果，請先執行 P0 和 P0.7 測試");
    }
    
    const userInput = {
      // ⭐ 輕測試的「輕」：每個產業面僅選 10 間公司
      companies_per_theme: LIGHT_TEST_CONFIG.p1.companies_per_theme
    };
    
    // 執行 P1
    const p1Result = P1_Execute({
      trigger: "LIGHT_TEST",
      user_input: userInput,
      p0_snapshot_id: p0Snapshot?.snapshot_id || null,
      p0_7_snapshot_id: p0_7Snapshot?.snapshot_id || null
      // ⚠️ 注意：不設置 test_mode，所有數據都正式蒐集
    });
    
      // 如果返回 SUBMITTED，提示用戶執行 M0
      if (p1Result.status === "SUBMITTED") {
        Logger.log("🧪 P1 測試：任務已提交到 M0，請手動執行 M0_Execute()");
        return {
          status: "SUBMITTED",
          job_id: p1Result.job_id,
          message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
          ai_output_fields: [],
          prompt_evaluation: {}
        };
      }
    
    // 評估 AI 回應
    const evaluation = evaluateP1Output(p1Result);
    
    return {
      p1_result: p1Result,
      ai_output_fields: extractAIFields(p1Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P1 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P1 輸出
 */
function evaluateP1Output(p1Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  const masterCandidates = p1Result.master_candidates || [];
  
  // 檢查三層對位檢查是否完成
  for (const company of masterCandidates) {
    const requiredChecks = [
      "ENG_Fit_Result",
      "STRUCT_Fit_Result",
      "Time_Role_Fit_Result"
    ];
    
    const missingChecks = requiredChecks.filter(check => !company[check]);
    
    if (missingChecks.length > 0) {
      evaluation.issues.push({
        company: company.Company_Code || company.Company_Name,
        issue: `缺少對位檢查結果：${missingChecks.join(", ")}`,
        severity: "HIGH"
      });
    }
    
    // 檢查 Moat_Type 和 Rerate_State
    if (!company.Moat_Type || !company.Rerate_State) {
      evaluation.issues.push({
        company: company.Company_Code || company.Company_Name,
        issue: "缺少 Moat_Type 或 Rerate_State",
        severity: "MEDIUM"
      });
    }
  }
  
  evaluation.completeness.master_count = masterCandidates.length;
  evaluation.completeness.tracking_count = (p1Result.tracking_pool || []).length;
  evaluation.completeness.rejection_count = (p1Result.rejection_pool || []).length;
  
  return evaluation;
}

// ==========================================
// P2 測試
// ==========================================

/**
 * 測試 P2：基本面財務分析
 */
function testP2(usePrevious) {
  try {
    Logger.log("🧪 P2 測試開始");
    
    // 讀取 P1 結果
    const p1Snapshot = usePrevious ? getLatestP1Snapshot() : null;
    
    if (!p1Snapshot && usePrevious) {
      throw new Error("P2 測試需要 P1 結果，請先執行 P1 測試");
    }
    
    // 執行 P2（月度）
    const p2Result = P2_Monthly_Execute({
      trigger: "LIGHT_TEST",
      p1_snapshot_id: p1Snapshot ? p1Snapshot.snapshot_id : null,
      context: {
        skip_confirmation: true,  // ⭐ 輕測試時跳過執行前確認
        test_mode: true  // ⭐ 輕測試時自動執行 M0 並輪詢結果
      }
      // ⚠️ 注意：不設置 missing_data_policy，所有數據都正式蒐集
      // ⚠️ 注意：test_mode: true 僅用於自動執行 M0，不影響數據收集
      // 輕測試的「輕」只體現在 P0 和 P1 的數量限制，P2 及之後都跟正式一樣
    });
    
    // 如果返回 SUBMITTED，提示用戶執行 M0（類似 P0 和 P1）
    if (p2Result.status === "SUBMITTED") {
      Logger.log("🧪 P2 測試：任務已提交到 M0，請手動執行 M0_Execute() 或等待自動觸發器執行");
      return {
        status: "SUBMITTED",
        job_id: p2Result.job_id,
        message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
        ai_output_fields: [],
        prompt_evaluation: {}
      };
    }
    
    // 評估 AI 回應
    const evaluation = evaluateP2Output(p2Result);
    
    return {
      status: p2Result.status || "COMPLETED",
      p2_result: p2Result,
      ai_output_fields: extractAIFields(p2Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P2 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P2 輸出
 */
function evaluateP2Output(p2Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  const tierAssignments = p2Result.tier_assignments || {};
  
  // 檢查是否回寫前段封存欄位（禁止）
  const forbiddenFields = [
    "Theme", "Subtheme", "Moat_Type", "Rerate_State",
    "P0.7_Time_Position", "P0.7_Leveraged_Role_Type"
  ];
  
  for (const [ticker, data] of Object.entries(tierAssignments)) {
    for (const field of forbiddenFields) {
      if (data[field] !== undefined) {
        evaluation.issues.push({
          ticker: ticker,
          issue: `違反 One Way Lock：回寫了前段封存欄位 ${field}`,
          severity: "CRITICAL"
        });
      }
    }
    
    // 檢查必要欄位
    if (!data.tier || !data.gate_result) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 tier 或 gate_result",
        severity: "HIGH"
      });
    }
  }
  
  evaluation.completeness.tier_count = Object.keys(tierAssignments).length;
  
  return evaluation;
}

// ==========================================
// P2.5 測試
// ==========================================

/**
 * 測試 P2.5：機構級籌碼面分析
 */
function testP2_5(usePrevious) {
  try {
    Logger.log("🧪 P2.5 測試開始");
    
    // 讀取 P2 結果
    const p2Snapshot = usePrevious ? getLatestP2Snapshot() : null;
    
    if (!p2Snapshot && usePrevious) {
      throw new Error("P2.5 測試需要 P2 結果，請先執行 P2 測試");
    }
    
    // 獲取要分析的股票列表
    const tickers = Object.keys(p2Snapshot?.tier_assignments || {});
    
    if (tickers.length === 0) {
      throw new Error("P2.5 測試需要 P2 結果中的股票列表");
    }
    
    // 執行 P2.5（月度）
    const p2_5Result = P2_5_Monthly_Execute({
      trigger: "LIGHT_TEST",
      p2_snapshot_id: p2Snapshot?.snapshot_id || null
      // ⚠️ 注意：不設置 test_mode 和 missing_data_policy，所有數據都正式蒐集
    });
    
      // 如果返回 SUBMITTED，提示用戶執行 M0
      if (p2_5Result.status === "SUBMITTED") {
        Logger.log("🧪 P2.5 測試：任務已提交到 M0，請手動執行 M0_Execute()");
        return {
          status: "SUBMITTED",
          job_id: p2_5Result.job_id,
          message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
          ai_output_fields: [],
          prompt_evaluation: {}
        };
      }
    
    // 評估 AI 回應
    const evaluation = evaluateP2_5Output(p2_5Result);
    
    return {
      p2_5_result: p2_5Result,
      ai_output_fields: extractAIFields(p2_5Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P2.5 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P2.5 輸出
 */
function evaluateP2_5Output(p2_5Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  const smartMoneyAnalysis = p2_5Result.smart_money_analysis || {};
  
  for (const [ticker, analysis] of Object.entries(smartMoneyAnalysis)) {
    // 檢查必要欄位
    const requiredFields = [
      "institutional_holdings",
      "insider_trading",
      "options_flow",
      "dark_pool_activity",
      "hedge_fund_clone",
      "smart_money_score"
    ];
    
    const missingFields = requiredFields.filter(field => !analysis[field]);
    
    if (missingFields.length > 0) {
      evaluation.issues.push({
        ticker: ticker,
        issue: `缺少必要欄位：${missingFields.join(", ")}`,
        severity: "MEDIUM"
      });
    }
    
    // 檢查 Clone 評分邏輯
    if (analysis.hedge_fund_clone) {
      if (analysis.hedge_fund_clone.clone_score === undefined) {
        evaluation.issues.push({
          ticker: ticker,
          issue: "hedge_fund_clone.clone_score 缺失",
          severity: "MEDIUM"
        });
      }
    }
  }
  
  evaluation.completeness.analyzed_count = Object.keys(smartMoneyAnalysis).length;
  
  return evaluation;
}

// ==========================================
// P3 測試
// ==========================================

/**
 * 測試 P3：技術分析（機構級預測）
 */
function testP3(usePrevious) {
  try {
    Logger.log("🧪 P3 測試開始");
    
    // 讀取 P2 和 P2.5 結果
    const p2Snapshot = usePrevious ? getLatestP2Snapshot() : null;
    const p2_5Snapshot = usePrevious ? getLatestP2_5Snapshot() : null;
    
    if (!p2Snapshot && usePrevious) {
      throw new Error("P3 測試需要 P2 結果，請先執行 P2 測試");
    }
    
    // 執行 P3（週度）
    const p3Result = P3_Weekly_Execute({
      trigger: "LIGHT_TEST"
      // ⚠️ 注意：不設置 test_mode 和 missing_data_policy，所有數據都正式蒐集
    });
    
    // 如果返回 SUBMITTED，提示用戶執行 M0
    if (p3Result.status === "SUBMITTED") {
      Logger.log("🧪 P3 測試：任務已提交到 M0，請手動執行 M0_Execute()");
      return {
        status: "SUBMITTED",
        job_id: p3Result.job_id,
        message: "任務已提交到 M0，請執行 M0_Execute() 後再查看結果",
        ai_output_fields: [],
        prompt_evaluation: {}
      };
    }
    
    // 評估 AI 回應
    const evaluation = evaluateP3Output(p3Result);
    
    return {
      p3_result: p3Result,
      ai_output_fields: extractAIFields(p3Result),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P3 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P3 輸出
 */
function evaluateP3Output(p3Result) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  const technicalResults = p3Result.technical_results || {};
  
  for (const [ticker, result] of Object.entries(technicalResults)) {
    // 檢查機構級預測視角
    if (!result.institutional_perspective) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 institutional_perspective（機構級預測視角）",
        severity: "HIGH"
      });
    }
    
    // 檢查 Cat 分類
    if (!result.cat || !["Cat1", "Cat2", "Cat3", "Cat4-A", "Cat4-B", "Cat5"].includes(result.cat)) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "Cat 分類格式錯誤或缺失",
        severity: "HIGH"
      });
    }
    
    // 檢查主力行為解釋
    if (!result.main_force_behavior) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 main_force_behavior（主力行為解釋）",
        severity: "MEDIUM"
      });
    }
    
    // 檢查 Buy Orders
    if (!result.buy_orders || !Array.isArray(result.buy_orders)) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 buy_orders 或格式錯誤",
        severity: "MEDIUM"
      });
    }
  }
  
  evaluation.completeness.analyzed_count = Object.keys(technicalResults).length;
  
  return evaluation;
}

// ==========================================
// P4 測試
// ==========================================

/**
 * 測試 P4：資金配置計算
 * 
 * 注意：P4 是純計算模組，無 AI
 */
function testP4(usePrevious) {
  try {
    Logger.log("🧪 P4 測試開始");
    
    // 讀取 P2 和 P3 結果
    const p2Snapshot = usePrevious ? getLatestP2Snapshot() : null;
    const p3Snapshot = usePrevious ? getLatestP3Snapshot() : null;
    
    if ((!p2Snapshot || !p3Snapshot) && usePrevious) {
      throw new Error("P4 測試需要 P2 和 P3 結果，請先執行 P2 和 P3 測試");
    }
    
    // 執行 P4
    const p4Result = P4_Calculate({
      trigger: "LIGHT_TEST",
      reason: "輕測試"
    });
    
    return {
      p4_result: p4Result,
      ai_output_fields: [],  // P4 無 AI
      prompt_evaluation: {
        completeness: {
          has_allocations: !!p4Result.allocations,
          allocation_count: (p4Result.allocations || []).length
        }
      }
    };
    
  } catch (error) {
    Logger.log(`🧪 P4 測試失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// P5 Daily 測試
// ==========================================

/**
 * 測試 P5 Daily：數據收集
 */
function testP5Daily(usePrevious) {
  try {
    Logger.log("🧪 P5 Daily 測試開始");
    
    // 讀取 P4 結果（獲取要收集的股票列表）
    let tickers = [];
    
    if (usePrevious) {
      const p4Snapshot = getLatestP4Snapshot();
      if (p4Snapshot && p4Snapshot.allocations) {
        tickers = p4Snapshot.allocations.map(a => a.ticker);
      }
    }
    
    // 如果沒有 P4 結果，使用測試數據
    if (tickers.length === 0) {
      tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "TSM", "ASML", "AMD"];
      Logger.log("🧪 P5 Daily 測試：使用測試股票列表");
    }
    
    // 執行 P5 Daily
    const p5DailyResult = P5_Daily_Execute({
      trigger: "LIGHT_TEST",
      tickers: tickers
      // ⚠️ 注意：不設置 test_mode 和 missing_data_policy，所有數據都正式蒐集
    });
    
    return {
      p5_daily_result: p5DailyResult,
      ai_output_fields: [],  // P5 Daily 主要是數據收集，AI 用於新聞原子化
      prompt_evaluation: {
        completeness: {
          ohlcv_collected: Object.keys(p5DailyResult.collection_result?.ohlcv || {}).length,
          news_collected: Object.keys(p5DailyResult.collection_result?.news_atoms || {}).length,
          other_data_collected: !!p5DailyResult.collection_result
        }
      }
    };
    
  } catch (error) {
    Logger.log(`🧪 P5 Daily 測試失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// P5 Weekly 測試
// ==========================================

/**
 * 測試 P5 Weekly：策略制定
 * 
 * 模擬 2 間公司三天後財報
 */
function testP5Weekly(usePrevious) {
  try {
    Logger.log("🧪 P5 Weekly 測試開始");
    
    // 讀取 P4 結果（獲取持倉列表）
    let holdings = [];
    
    if (usePrevious) {
      const p4Snapshot = getLatestP4Snapshot();
      if (p4Snapshot && p4Snapshot.allocations) {
        holdings = p4Snapshot.allocations.map(a => a.ticker);
      }
    }
    
    // 如果沒有 P4 結果，使用測試數據
    if (holdings.length === 0) {
      holdings = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];
      Logger.log("🧪 P5 Weekly 測試：使用測試持倉列表");
    }
    
    // 模擬財報事件（2 間公司，三天後財報）
    const earningsSimulation = LIGHT_TEST_CONFIG.p5_weekly.earnings_simulation;
    if (earningsSimulation.enabled) {
      const simulatedTickers = holdings.slice(0, earningsSimulation.tickers);
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + earningsSimulation.days_until);
      
      // 在 EARNINGS_CALENDAR 中添加模擬財報事件
      addSimulatedEarningsEvents(simulatedTickers, threeDaysLater);
      
      Logger.log(`🧪 P5 Weekly 測試：已模擬 ${simulatedTickers.length} 間公司於 ${threeDaysLater.toISOString().split('T')[0]} 財報`);
    }
    
    // 執行 P5 Weekly
    const p5WeeklyResult = P5_Weekly_Execute({
      trigger: "LIGHT_TEST"
      // ⚠️ 注意：不設置 test_mode 和 missing_data_policy，所有數據都正式蒐集
    });
    
    // 評估 AI 回應
    const evaluation = evaluateP5WeeklyOutput(p5WeeklyResult);
    
    return {
      p5_weekly_result: p5WeeklyResult,
      ai_output_fields: extractAIFields(p5WeeklyResult),
      prompt_evaluation: evaluation
    };
    
  } catch (error) {
    Logger.log(`🧪 P5 Weekly 測試失敗：${error.message}`);
    throw error;
  }
}

/**
 * 評估 P5 Weekly 輸出
 */
function evaluateP5WeeklyOutput(p5WeeklyResult) {
  const evaluation = {
    completeness: {},
    quality: {},
    issues: []
  };
  
  // 檢查世界觀分析
  const worldview = p5WeeklyResult.worldview || {};
  if (!worldview.weekly_worldview || !worldview.weekly_worldview.market_regime) {
    evaluation.issues.push({
      issue: "缺少 market_regime",
      severity: "HIGH"
    });
  }
  
  // 檢查 Mag 7 分析
  if (!worldview.mag7_analysis) {
    evaluation.issues.push({
      issue: "缺少 mag7_analysis",
      severity: "MEDIUM"
    });
  }
  
  // 檢查個股策略
  const stockStrategies = p5WeeklyResult.stock_strategies || {};
  for (const [ticker, strategy] of Object.entries(stockStrategies)) {
    // 檢查是否動態決定因子權重
    if (!strategy.factor_weights) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 factor_weights（AI 動態權重）",
        severity: "HIGH"
      });
    }
    
    // 檢查權重決定理由
    if (!strategy.weight_reasoning) {
      evaluation.issues.push({
        ticker: ticker,
        issue: "缺少 weight_reasoning（權重決定理由）",
        severity: "MEDIUM"
      });
    }
    
    // 檢查財報日個股籌碼權重加強（如果有財報事件）
    // 這裡需要檢查是否正確加強了籌碼權重
    const hasEarnings = checkEarningsEvent(ticker, p5WeeklyResult.events || {});
    if (hasEarnings) {
      const smartMoneyWeight = strategy.factor_weights?.smart_money || 0;
      const institutionalWeight = strategy.factor_weights?.institutional || 0;
      
      if (smartMoneyWeight < 0.25 || smartMoneyWeight > 0.35) {
        evaluation.issues.push({
          ticker: ticker,
          issue: `財報日個股籌碼權重加強失敗：smart_money 權重=${smartMoneyWeight}，應在 0.25-0.35 之間`,
          severity: "HIGH"
        });
      }
      
      if (institutionalWeight < 0.15 || institutionalWeight > 0.20) {
        evaluation.issues.push({
          ticker: ticker,
          issue: `財報日個股籌碼權重加強失敗：institutional 權重=${institutionalWeight}，應在 0.15-0.20 之間`,
          severity: "HIGH"
        });
      }
    }
  }
  
  evaluation.completeness.stock_strategies_count = Object.keys(stockStrategies).length;
  
  return evaluation;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 提取 AI 回應的欄位
 */
function extractAIFields(result) {
  const fields = [];
  
  // 遞歸提取所有欄位
  function extract(obj, prefix = "") {
    if (obj === null || obj === undefined) {
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        extract(item, `${prefix}[${index}]`);
      });
    } else if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          extract(value, fullKey);
        } else {
          fields.push({
            field: fullKey,
            value: value,
            type: typeof value
          });
        }
      }
    } else {
      fields.push({
        field: prefix,
        value: obj,
        type: typeof obj
      });
    }
  }
  
  extract(result);
  
  return fields;
}

/**
 * 添加模擬財報事件
 */
function addSimulatedEarningsEvents(tickers, earningsDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
    
    if (!sheet) {
      sheet = ss.insertSheet("EARNINGS_CALENDAR");
      sheet.appendRow([
        "ticker",
        "earnings_date",
        "fiscal_quarter",
        "fiscal_year",
        "estimated_eps",
        "estimated_revenue",
        "created_at"
      ]);
    }
    
    const today = new Date();
    const daysUntil = Math.ceil((earningsDate - today) / (1000 * 60 * 60 * 24));
    
    for (const ticker of tickers) {
      const row = [
        ticker,
        Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        "Q1",  // 簡化
        2025,  // 簡化
        null,
        null,
        new Date()
      ];
      
      sheet.appendRow(row);
    }
    
    Logger.log(`🧪 已添加 ${tickers.length} 個模擬財報事件到 EARNINGS_CALENDAR`);
    
  } catch (error) {
    Logger.log(`🧪 添加模擬財報事件失敗：${error.message}`);
  }
}

/**
 * 檢查股票是否有財報事件（從測試結果中）
 */
function checkEarningsEvent(ticker, events) {
  if (!events || !Array.isArray(events.upcoming_events)) {
    return null;
  }
  
  const earningsEvent = events.upcoming_events.find(event => 
    event.tickers && event.tickers.includes(ticker) &&
    event.event_type === "EARNINGS" &&
    event.days_until_event !== undefined &&
    event.days_until_event <= 14
  );
  
  return earningsEvent ? {
    days_until: earningsEvent.days_until_event,
    earnings_date: earningsEvent.event_date || earningsEvent.date
  } : null;
}

/**
 * 獲取 M0 Job 結果 ⭐ V8.0 新增
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
    
    // 查找對應的 job_id
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
 * ⭐ V8.0 新增：從 M0__CROSSCHECK_LOG 自動讀取 AI 原始回應
 * @param {string} jobId - 任務 ID
 * @returns {Object} { executor_output: {}, auditor_output: {} }
 */
function getAIResponsesFromCrosscheckLog(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName("M0__CROSSCHECK_LOG");
    
    if (!logSheet || logSheet.getLastRow() <= 1) {
      Logger.log(`M0__CROSSCHECK_LOG 表格不存在或沒有數據`);
      return { executor_output: null, auditor_output: null };
    }
    
    const dataRange = logSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 找到對應的欄位索引
    const jobIdCol = headers.indexOf("job_id");
    const stepCol = headers.indexOf("step");
    const outputSnapshotCol = headers.indexOf("output_snapshot");
    
    if (jobIdCol === -1 || stepCol === -1 || outputSnapshotCol === -1) {
      Logger.log(`M0__CROSSCHECK_LOG 表格結構不正確，缺少必要欄位`);
      return { executor_output: null, auditor_output: null };
    }
    
    let executorOutput = null;
    let auditorOutput = null;
    
    // 查找該 job_id 的所有記錄
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][jobIdCol] === jobId) {
        const step = rows[i][stepCol];
        const outputSnapshot = rows[i][outputSnapshotCol];
        
        if (step === "EXECUTOR" && outputSnapshot) {
          try {
            executorOutput = typeof outputSnapshot === 'string' ? 
              JSON.parse(outputSnapshot) : outputSnapshot;
            Logger.log(`✅ 讀取到 EXECUTOR 回應：job_id=${jobId}`);
          } catch (e) {
            Logger.log(`⚠️ 解析 EXECUTOR output_snapshot 失敗：${e.message}`);
          }
        } else if (step === "AUDITOR" && outputSnapshot) {
          try {
            auditorOutput = typeof outputSnapshot === 'string' ? 
              JSON.parse(outputSnapshot) : outputSnapshot;
            Logger.log(`✅ 讀取到 AUDITOR 回應：job_id=${jobId}`);
          } catch (e) {
            Logger.log(`⚠️ 解析 AUDITOR output_snapshot 失敗：${e.message}`);
          }
        }
      }
    }
    
    return { executor_output: executorOutput, auditor_output: auditorOutput };
    
  } catch (error) {
    Logger.log(`讀取 M0__CROSSCHECK_LOG 失敗：${error.message}`);
    return { executor_output: null, auditor_output: null };
  }
}

/**
 * ⭐ V8.0 新增：深度評估 AI 原始回應（三個核心重點）
 * @param {Object} executorOutput - EXECUTOR 的原始回應
 * @param {Object} auditorOutput - AUDITOR 的原始回應
 * @param {string} phase - Phase 名稱（例如："P0", "P0_7"）
 * @returns {Object} 深度評估結果
 */
function deepEvaluateAIResponses(executorOutput, auditorOutput, phase) {
  const evaluation = {
    executor_available: !!executorOutput,
    auditor_available: !!auditorOutput,
    core_assessment: {
      task_alignment: {
        assessment: "PENDING",
        description: "",
        issues: [],
        suggestions: []
      },
      emphasis_check: {
        assessment: "PENDING",
        description: "",
        issues: [],
        suggestions: []
      },
      consistency: {
        assessment: "PENDING",
        description: "評估同一分析者（EXECUTOR）對相同輸入多次執行的結果一致性。需要多次執行相同輸入才能評估。如果相同資料卻產生不同結論（例如：這次 BUY，下次 SELL），表示 Prompt 語意模糊，容易被 AI 誤解。",
        note: "⚠️ 注意：這是指同一分析者的多次執行一致性，不是指 EXECUTOR 和 AUDITOR 的一致性（兩者用不同模型，應該有不同的視角來交叉驗證）"
      }
    },
    raw_responses: {
      executor: executorOutput ? JSON.stringify(executorOutput).substring(0, 500) : null,
      auditor: auditorOutput ? JSON.stringify(auditorOutput).substring(0, 500) : null
    }
  };
  
  // 根據不同 Phase 進行特定評估
  if (phase === "P0") {
    // 重點 1：是否符合主要任務與設計精神
    if (executorOutput && executorOutput.themes) {
      const themes = executorOutput.themes || [];
      const engThemes = themes.filter(t => (t.analysis_type || t.type || "") === "ENG" || (t.analysis_type || t.type || "") === "BOTH");
      const structThemes = themes.filter(t => (t.analysis_type || t.type || "") === "STRUCT" || (t.analysis_type || t.type || "") === "BOTH");
      
      if (themes.length === 2 && engThemes.length === 1 && structThemes.length === 1) {
        evaluation.core_assessment.task_alignment.assessment = "ALIGNED";
        evaluation.core_assessment.task_alignment.description = "✅ AI 正確理解了 P0 的核心任務：產出 1 個工程瓶頸類 + 1 個定價權獨佔類";
      } else {
        evaluation.core_assessment.task_alignment.assessment = "MISALIGNED";
        evaluation.core_assessment.task_alignment.issues.push({
          issue: `測試模式要求 2 個 themes（1 ENG + 1 STRUCT），實際產出 ${themes.length} 個（ENG: ${engThemes.length}, STRUCT: ${structThemes.length}）`,
          severity: "HIGH"
        });
        evaluation.core_assessment.task_alignment.suggestions.push("檢查 Prompt 是否明確要求「只找 1 個」而不是「至少 1 個」");
      }
    }
    
    // 重點 2：是否強調出重視的部分（P0-3 五項強制輸出）
    if (executorOutput && executorOutput.themes) {
      const themes = executorOutput.themes || [];
      const requiredFields = ["problem_oneliner", "failure_mode", "no_alternative_reason", "convergence_evidence", "long_term_time_window"];
      let missingCount = 0;
      
      for (const theme of themes) {
        const missing = requiredFields.filter(field => !theme[field]);
        if (missing.length > 0) {
          missingCount++;
        }
      }
      
      if (missingCount === 0 && themes.length > 0) {
        evaluation.core_assessment.emphasis_check.assessment = "STRONG";
        evaluation.core_assessment.emphasis_check.description = "✅ AI 正確強調了 P0-3 五項強制輸出，所有 themes 都包含完整欄位";
      } else if (missingCount < themes.length) {
        evaluation.core_assessment.emphasis_check.assessment = "MODERATE";
        evaluation.core_assessment.emphasis_check.description = `⚠️ 部分 themes 缺少 P0-3 強制輸出，共 ${missingCount}/${themes.length} 個 themes 有缺失`;
        evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中更強烈地要求「P0-3 五項強制輸出缺一不可」");
      } else if (themes.length > 0) {
        evaluation.core_assessment.emphasis_check.assessment = "WEAK";
        evaluation.core_assessment.emphasis_check.description = "❌ 所有 themes 都缺少 P0-3 強制輸出，表示 Prompt 強調不足";
        evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中使用更強烈的語言（例如：「必須包含」、「不可省略」、「缺一不可」）");
      }
    }
  } else if (phase === "P0_7" || phase === "P0.7") {
    // P0.7 的特定評估
    if (executorOutput && executorOutput.themes) {
      const themes = executorOutput.themes || [];
      const requiredSteps = ["dynamic_problem_oneliner", "stocks_and_flows", "causal_loops", "time_position", "leveraged_role_type"];
      
      // 重點 1
      if (themes.length > 0) {
        const hasSystemDynamics = themes.some(theme => 
          theme.stocks_and_flows || theme.causal_loops || theme.dynamic_problem_oneliner
        );
        if (hasSystemDynamics) {
          evaluation.core_assessment.task_alignment.assessment = "ALIGNED";
          evaluation.core_assessment.task_alignment.description = "✅ AI 正確理解了 P0.7 的核心任務：系統動力學分析";
        } else {
          evaluation.core_assessment.task_alignment.assessment = "MISALIGNED";
          evaluation.core_assessment.task_alignment.issues.push({
            issue: "AI 回應缺少系統動力學核心元素（存量流量、因果循環）",
            severity: "HIGH"
          });
        }
      }
      
      // 重點 2
      const allStepsPresent = themes.length > 0 && themes.every(theme => {
        return requiredSteps.every(step => theme[step]);
      });
      
      if (allStepsPresent) {
        evaluation.core_assessment.emphasis_check.assessment = "STRONG";
        evaluation.core_assessment.emphasis_check.description = "✅ AI 正確按照固定順序完成所有分析步驟";
      } else if (themes.length > 0) {
        evaluation.core_assessment.emphasis_check.assessment = "MODERATE";
        evaluation.core_assessment.emphasis_check.description = "⚠️ 部分 themes 缺少必要的分析步驟";
        evaluation.core_assessment.emphasis_check.suggestions.push("在 Prompt 中更明確地要求「必須按照固定順序完成」所有步驟");
      }
    }
  }
  
  // ⚠️ 注意：一致性檢查不是檢查 AUDITOR 是否提供審查意見
  // 一致性指的是「同一 EXECUTOR 對相同輸入多次執行的結果一致性」
  // AUDITOR 和 EXECUTOR 應該有不同的視角（用不同模型就是為了交叉驗證）
  if (auditorOutput) {
    // AUDITOR 提供審查意見是正常的，但這不影響一致性評估
    if (auditorOutput.review || auditorOutput.audit_notes || auditorOutput.issues) {
      Logger.log(`✅ AUDITOR 提供了審查意見`);
    }
  }
  
  return evaluation;
}

/**
 * 獲取最新 P0 快照
 * ⭐ V8.0 修正：使用正確的欄位索引
 * P0__SNAPSHOT 表格結構：
 * [0] snapshot_id
 * [1] created_at
 * [2] trigger
 * [3] p0_output_json
 * [4] changes_json
 * [5] context_json
 * [6] version
 */
function getLatestP0Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const numCols = sheet.getLastColumn();
    const row = sheet.getRange(lastRow, 1, 1, numCols).getValues()[0];
    
    // ⭐ V8.0 修正：安全解析 JSON，避免解析非 JSON 字符串
    let p0Output = {};
    if (row[3]) {  // p0_output_json 在索引 3
      try {
        const value = row[3];
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          p0Output = JSON.parse(value);
        } else if (typeof value === 'object') {
          p0Output = value;
        }
      } catch (e) {
        Logger.log(`P0 快照 p0_output_json 解析失敗：${e.message}`);
        p0Output = {};
      }
    }
    
    return {
      snapshot_id: String(row[0] || ""),
      created_at: row[1] || null,
      trigger: String(row[2] || ""),  // trigger 在索引 2
      p0_output: p0Output,
      p0_output_json: p0Output  // 保持兼容性
    };
    
  } catch (error) {
    Logger.log(`獲取最新 P0 快照失敗：${error.message}`);
    if (error.stack) {
      Logger.log(`錯誤堆疊：${error.stack}`);
    }
    return null;
  }
}

/**
 * 獲取最新 P0.7 快照
 * ⭐ V8.0 修正：使用正確的欄位索引（需要確認 P0_7__SNAPSHOT 表格結構）
 */
function getLatestP0_7Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0_7__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const numCols = sheet.getLastColumn();
    const row = sheet.getRange(lastRow, 1, 1, numCols).getValues()[0];
    
    // ⭐ V8.0 修正：需要確認 P0_7__SNAPSHOT 表格結構
    // 暫時假設結構類似 P0__SNAPSHOT
    let p0_7Output = {};
    if (row[3]) {  // 假設 p0_7_output_json 在索引 3
      try {
        const value = row[3];
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          p0_7Output = JSON.parse(value);
        } else if (typeof value === 'object') {
          p0_7Output = value;
        }
      } catch (e) {
        Logger.log(`P0.7 快照 p0_7_output_json 解析失敗：${e.message}`);
        p0_7Output = {};
      }
    }
    
    return {
      snapshot_id: String(row[0] || ""),
      created_at: row[1] || null,
      trigger: String(row[2] || ""),  // trigger 在索引 2
      p0_7_output: p0_7Output,
      p0_7_output_json: p0_7Output  // 保持兼容性
    };
    
  } catch (error) {
    Logger.log(`獲取最新 P0.7 快照失敗：${error.message}`);
    if (error.stack) {
      Logger.log(`錯誤堆疊：${error.stack}`);
    }
    return null;
  }
}

/**
 * 獲取最新 P1 快照
 */
function getLatestP1Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P1__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];
    
    return {
      snapshot_id: row[0],
      created_at: row[1],
      p1_output: row[3] ? (typeof row[3] === 'string' ? JSON.parse(row[3]) : row[3]) : {}
    };
    
  } catch (error) {
    Logger.log(`獲取最新 P1 快照失敗：${error.message}`);
    return null;
  }
}
