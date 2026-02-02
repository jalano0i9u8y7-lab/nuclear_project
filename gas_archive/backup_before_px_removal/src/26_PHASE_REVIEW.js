/**
 * 📋 Phase 結果審查系統
 * 
 * 實現每個 Phase（P0-P4）完成後的結果審查功能：
 * 1. 展現結果給使用者看
 * 2. 讓使用者審查是否 OK
 * 3. 讓使用者提出意見
 * 4. 確認 OK 才往下走
 * 5. 展現結果的同時可以詢問使用者選項或意見
 * 
 * @version V1.0
 * @date 2025-01-14
 */

// ==========================================
// Phase Review 核心函數
// ==========================================

/**
 * 保存 Phase 結果和審查問題
 * @param {string} phase - Phase 名稱（P0, P1, P2, P3, P4）
 * @param {string} snapshotId - 快照 ID
 * @param {Object} result - Phase 結果
 * @param {Array} questions - 審查問題列表
 * @return {string} reviewId - 審查 ID
 */
function savePhaseReview(phase, snapshotId, result, questions) {
  try {
    Logger.log(`保存 Phase Review：phase=${phase}, snapshotId=${snapshotId}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("PHASE_REVIEW");
    
    if (!sheet) {
      // 如果表格不存在，先初始化
      initializeSheets();
      sheet = ss.getSheetByName("PHASE_REVIEW");
      if (!sheet) {
        throw new Error("PHASE_REVIEW 表格初始化失敗");
      }
    }
    
    // 生成 review_id
    const reviewId = `REVIEW_${phase}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 準備數據行
    const row = [
      reviewId,
      phase,
      snapshotId,
      JSON.stringify(result),
      JSON.stringify(questions),
      JSON.stringify({}),  // answers_json（初始為空）
      "PENDING",           // status
      "",                  // user_feedback
      "",                  // action_taken
      new Date(),          // created_at
      new Date()           // updated_at
    ];
    
    // 追加到表格
    sheet.appendRow(row);
    
    Logger.log(`✓ Phase Review 已保存：reviewId=${reviewId}`);
    
    return reviewId;
    
  } catch (error) {
    Logger.log(`保存 Phase Review 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 Phase Review 記錄
 * @param {string} reviewId - 審查 ID
 * @return {Object|null} review - 審查記錄
 */
function getPhaseReview(reviewId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PHASE_REVIEW");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const reviewIdCol = headers.indexOf("review_id");
    
    if (reviewIdCol === -1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][reviewIdCol] === reviewId) {
        const review = {};
        headers.forEach((header, colIndex) => {
          const value = rows[i][colIndex];
          
          // 解析 JSON 欄位
          if (header.includes("_json")) {
            try {
              review[header] = value ? JSON.parse(value) : {};
            } catch (e) {
              review[header] = {};
            }
          } else {
            review[header] = value;
          }
        });
        
        return review;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`獲取 Phase Review 失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取待審查的 Phase Review（最新的 PENDING 狀態）
 * @param {string} phase - Phase 名稱（可選）
 * @return {Object|null} review - 審查記錄
 */
function getPendingPhaseReview(phase = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PHASE_REVIEW");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const reviewIdCol = headers.indexOf("review_id");
    const phaseCol = headers.indexOf("phase");
    const statusCol = headers.indexOf("status");
    const createdCol = headers.indexOf("created_at");
    
    if (reviewIdCol === -1 || statusCol === -1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 從最新開始查找
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowPhase = phaseCol !== -1 ? rows[i][phaseCol] : null;
      const status = rows[i][statusCol];
      
      // 檢查是否符合條件
      if (status === "PENDING" && (!phase || rowPhase === phase)) {
        const review = {};
        headers.forEach((header, colIndex) => {
          const value = rows[i][colIndex];
          
          if (header.includes("_json")) {
            try {
              review[header] = value ? JSON.parse(value) : {};
            } catch (e) {
              review[header] = {};
            }
          } else {
            review[header] = value;
          }
        });
        
        return review;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`獲取待審查 Phase Review 失敗：${error.message}`);
    return null;
  }
}

/**
 * 提交使用者答案
 * @param {string} reviewId - 審查 ID
 * @param {Object} answers - 使用者答案
 * @param {string} action - 動作（CONTINUE, MODIFY, RERUN, SKIP）
 * @param {string} feedback - 使用者意見（可選）
 * @return {boolean} 是否成功
 */
function submitPhaseReview(reviewId, answers, action, feedback = "") {
  try {
    Logger.log(`提交 Phase Review：reviewId=${reviewId}, action=${action}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PHASE_REVIEW");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      throw new Error("PHASE_REVIEW 表格不存在或沒有數據");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const reviewIdCol = headers.indexOf("review_id");
    const answersCol = headers.indexOf("answers_json");
    const statusCol = headers.indexOf("status");
    const feedbackCol = headers.indexOf("user_feedback");
    const actionCol = headers.indexOf("action_taken");
    const updatedCol = headers.indexOf("updated_at");
    
    if (reviewIdCol === -1) {
      throw new Error("PHASE_REVIEW 表格缺少必要欄位");
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][reviewIdCol] === reviewId) {
        const rowNum = i + 1;
        
        // 更新答案
        if (answersCol !== -1) {
          sheet.getRange(rowNum, answersCol + 1).setValue(JSON.stringify(answers));
        }
        
        // 更新狀態
        if (statusCol !== -1) {
          const newStatus = action === "SKIP" ? "SKIPPED" : 
                           action === "RERUN" ? "REJECTED" : "APPROVED";
          sheet.getRange(rowNum, statusCol + 1).setValue(newStatus);
        }
        
        // 更新意見
        if (feedbackCol !== -1) {
          sheet.getRange(rowNum, feedbackCol + 1).setValue(feedback);
        }
        
        // 更新動作
        if (actionCol !== -1) {
          sheet.getRange(rowNum, actionCol + 1).setValue(action);
        }
        
        // 更新時間
        if (updatedCol !== -1) {
          sheet.getRange(rowNum, updatedCol + 1).setValue(new Date());
        }
        
        Logger.log(`✓ Phase Review 已更新：reviewId=${reviewId}, action=${action}`);
        return true;
      }
    }
    
    Logger.log(`⚠ Phase Review 不存在：reviewId=${reviewId}`);
    return false;
    
  } catch (error) {
    Logger.log(`提交 Phase Review 失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 問題生成函數
// ==========================================

/**
 * 根據 Phase 類型生成審查問題
 * @param {string} phase - Phase 名稱
 * @param {Object} result - Phase 結果
 * @return {Array} questions - 問題列表
 */
function generatePhaseReviewQuestions(phase, result) {
  const questions = [];
  
  switch (phase) {
    case "P0":
      questions.push({
        id: "p0_industry_count",
        type: "number",
        label: "決定分析出幾個產業面向",
        description: "請輸入要分析的產業面向數量（預設：根據 AI 分析結果）",
        default: result.themes ? result.themes.length : 8,
        min: 5,
        max: 15
      });
      questions.push({
        id: "p0_industry_preference",
        type: "multiselect",
        label: "產業面向是否有偏好",
        description: "可以選擇特定產業（留空表示無偏好）",
        options: result.themes ? result.themes.map(t => t.theme_name) : [],
        default: []
      });
      questions.push({
        id: "p0_result_ok",
        type: "select",
        label: "P0 分析結果是否 OK",
        description: "請審查 P0 分析結果",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
      break;
      
    case "P1":
      questions.push({
        id: "p1_company_selection_criteria",
        type: "textarea",
        label: "每個產業面的公司選擇標準",
        description: "請說明公司選擇的標準（可選）",
        default: ""
      });
      questions.push({
        id: "p1_market_ratio",
        type: "text",
        label: "美/日/台公司的比例",
        description: "請輸入比例（例如：US:50%, JP:30%, TW:20%）",
        default: "US:50%, JP:30%, TW:20%"
      });
      questions.push({
        id: "p1_companies_per_industry",
        type: "number",
        label: "每個產業面最後需要篩選出幾間",
        description: "請輸入每個產業面的公司數量",
        default: 5,
        min: 3,
        max: 20
      });
      questions.push({
        id: "p1_result_ok",
        type: "select",
        label: "P1 篩選結果是否 OK",
        description: "請審查 P1 篩選結果（Master_Candidates, Tracking_Pool, Rejection_Pool）",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
      break;
      
    case "P2":
      questions.push({
        id: "p2_tier_reasonable",
        type: "select",
        label: "Tier 分層是否合理",
        description: "請審查 Tier 分層結果，可以手動調整",
        options: ["合理", "需要調整", "重新執行"],
        default: "合理"
      });
      questions.push({
        id: "p2_result_ok",
        type: "select",
        label: "P2 分析結果是否 OK",
        description: "請審查 Gate 檢查和 Tier 分層結果",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
      break;
      
    case "P3":
      questions.push({
        id: "p3_result_ok",
        type: "select",
        label: "P3 技術分析結果是否 OK",
        description: "請審查技術分析結果、Cat 分類和 Buy 價格建議",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
      break;
      
    case "P4":
      questions.push({
        id: "p4_allocation_reasonable",
        type: "select",
        label: "資金配置是否合理",
        description: "請審查資金配置結果，可以手動調整",
        options: ["合理", "需要調整", "重新執行"],
        default: "合理"
      });
      questions.push({
        id: "p4_result_ok",
        type: "select",
        label: "P4 資金配置結果是否 OK",
        description: "請審查資金配置百分比",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
      break;
      
    default:
      questions.push({
        id: "general_result_ok",
        type: "select",
        label: "結果是否 OK",
        description: "請審查結果",
        options: ["繼續", "修改", "重新執行"],
        default: "繼續"
      });
  }
  
  return questions;
}

// ==========================================
// UI 輔助函數
// ==========================================

/**
 * 格式化 Phase 結果用於 UI 顯示
 * @param {string} phase - Phase 名稱
 * @param {Object} result - Phase 結果
 * @return {Object} formattedResult - 格式化後的結果
 */
function formatPhaseResultForUI(phase, result) {
  const formatted = {
    phase: phase,
    summary: "",
    details: {},
    statistics: {}
  };
  
  switch (phase) {
    case "P0":
      formatted.summary = `分析出 ${result.themes ? result.themes.length : 0} 個產業面向`;
      formatted.details = {
        themes: result.themes || [],
        subthemes: result.subthemes || [],
        key_nodes: result.key_nodes || []
      };
      formatted.statistics = {
        theme_count: result.themes ? result.themes.length : 0,
        subtheme_count: result.subthemes ? result.subthemes.length : 0
      };
      break;
      
    case "P1":
      formatted.summary = `篩選出 ${result.master_candidates ? result.master_candidates.length : 0} 檔候選股票`;
      formatted.details = {
        master_candidates: result.master_candidates || [],
        tracking_pool: result.tracking_pool || [],
        rejection_pool: result.rejection_pool || []
      };
      formatted.statistics = {
        master_count: result.master_candidates ? result.master_candidates.length : 0,
        tracking_count: result.tracking_pool ? result.tracking_pool.length : 0,
        rejection_count: result.rejection_pool ? result.rejection_pool.length : 0
      };
      break;
      
    case "P2":
      formatted.summary = `完成 ${result.tier_assignments ? result.tier_assignments.length : 0} 檔股票的 Gate 檢查和 Tier 分層`;
      formatted.details = {
        tier_assignments: result.tier_assignments || [],
        tier_summary: result.tier_summary || {}
      };
      formatted.statistics = {
        total_count: result.tier_assignments ? result.tier_assignments.length : 0,
        pass_count: result.tier_assignments ? result.tier_assignments.filter(t => t.gate_result === "PASS").length : 0,
        tier_breakdown: result.tier_summary || {}
      };
      break;
      
    case "P3":
      formatted.summary = `完成 ${result.technical_results ? result.technical_results.length : 0} 檔股票的技術分析`;
      formatted.details = {
        technical_results: result.technical_results || []
      };
      formatted.statistics = {
        total_count: result.technical_results ? result.technical_results.length : 0,
        cat_breakdown: {}
      };
      break;
      
    case "P4":
      formatted.summary = `完成資金配置計算`;
      formatted.details = {
        allocations: result.allocations || [],
        summary: result.summary || {}
      };
      formatted.statistics = {
        total_allocation: result.summary ? result.summary.total_allocation_pct : 0,
        allocation_count: result.allocations ? result.allocations.length : 0
      };
      break;
  }
  
  return formatted;
}
