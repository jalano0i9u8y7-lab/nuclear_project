/**
 * ⚙️ 執行前確認機制（Pre-Execution Confirmation）
 * 
 * 在 P0-P5 執行前，像 AI 網頁版一樣提出問題讓用戶確認或補充需求
 * 例如：公司池的美/日/台股比例、風險偏好、特殊要求等
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 各 Phase 的確認問題配置
// ==========================================

const PRE_EXECUTION_QUESTIONS = {
  "P0": {
    questions: [],  // ⭐ V8.0 修正：P0 不需要問使用者問題，因為 P0 就是要用來找面向的工具
    auto_confirm: true  // ⭐ 自動確認，不需要使用者輸入
  },
  
  "P0_7": {
    questions: [
      {
        id: "analysis_focus",
        question: "本次系統動力學分析的重點是什麼？（例如：特定主題、循環分析等）",
        type: "TEXT",
        required: false,
        default: ""
      },
      {
        id: "time_window",
        question: "時間窗口？（短期 < 6個月 / 中期 6-18個月 / 長期 > 18個月）",
        type: "SELECT",
        options: ["SHORT", "MEDIUM", "LONG"],
        required: false,
        default: "MEDIUM"
      }
    ],
    auto_confirm: false  // 需要手動確認
  },
  
  "P1": {
    questions: [
      {
        id: "market_distribution",
        question: "公司池的市場分布比例？格式：US:50, JP:30, TW:20（總和應為 100）",
        type: "TEXT",
        required: true,
        default: "US:50, JP:30, TW:20",
        validator: function(value) {
          const parts = value.split(',').map(s => s.trim());
          let total = 0;
          for (const part of parts) {
            const [market, pct] = part.split(':');
            const num = parseFloat(pct);
            if (isNaN(num) || num < 0 || num > 100) {
              return { valid: false, error: `無效的百分比：${pct}` };
            }
            total += num;
          }
          if (Math.abs(total - 100) > 1) {
            return { valid: false, error: `總和應為 100，目前為 ${total}` };
          }
          return { valid: true };
        }
      },
      {
        id: "min_market_cap",
        question: "最小市值要求？（單位：百萬美元）",
        type: "NUMBER",
        required: false,
        default: "1000",
        validator: function(value) {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0) {
            return { valid: false, error: "必須是大於 0 的數字" };
          }
          return { valid: true };
        }
      },
      {
        id: "sector_preferences",
        question: "是否有特定產業偏好或排除？（用逗號分隔，例如：偏好=AI,半導體 排除=傳統能源）",
        type: "TEXT",
        required: false,
        default: ""
      }
    ],
    auto_confirm: false
  },
  
  "P2": {
    questions: [
      {
        id: "risk_tolerance",
        question: "風險承受度？（LOW / MEDIUM / HIGH）",
        type: "SELECT",
        options: ["LOW", "MEDIUM", "HIGH"],
        required: false,
        default: "MEDIUM"
      },
      {
        id: "financial_criteria",
        question: "財務指標門檻調整？（格式：revenue_growth:>10, debt_ratio:<0.5，留空使用預設值）",
        type: "TEXT",
        required: false,
        default: ""
      }
    ],
    auto_confirm: true  // P2 可以自動確認（使用預設值）
  },
  
  "P3": {
    questions: [
      {
        id: "technical_focus",
        question: "技術分析重點？（TREND / MOMENTUM / VOLATILITY / ALL）",
        type: "SELECT",
        options: ["TREND", "MOMENTUM", "VOLATILITY", "ALL"],
        required: false,
        default: "ALL"
      },
      {
        id: "timeframe",
        question: "技術分析時間框架？（DAILY / WEEKLY / MONTHLY / ALL）",
        type: "SELECT",
        options: ["DAILY", "WEEKLY", "MONTHLY", "ALL"],
        required: false,
        default: "ALL"
      }
    ],
    auto_confirm: true
  },
  
  "P4": {
    questions: [
      {
        id: "target_utilization",
        question: "目標資金利用率？（建議範圍：60-80%，留空使用預設 65%）",
        type: "NUMBER",
        required: false,
        default: "65",
        validator: function(value) {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0 || num > 100) {
            return { valid: false, error: "必須是 0-100 之間的數字" };
          }
          if (num < 50 || num > 90) {
            return { valid: false, error: "建議範圍：50-90%" };
          }
          return { valid: true };
        }
      },
      {
        id: "hedging_preference",
        question: "對沖偏好？（NONE / LIGHT / MEDIUM / HEAVY）",
        type: "SELECT",
        options: ["NONE", "LIGHT", "MEDIUM", "HEAVY"],
        required: false,
        default: "MEDIUM"
      }
    ],
    auto_confirm: true
  },
  
  "P5": {
    questions: [
      {
        id: "monitoring_frequency",
        question: "監控頻率調整？（DAILY / WEEKLY / MONTHLY，留空使用預設）",
        type: "SELECT",
        options: ["DAILY", "WEEKLY", "MONTHLY"],
        required: false,
        default: ""
      },
      {
        id: "alert_preferences",
        question: "告警偏好？（ALL / CRITICAL_ONLY / NONE）",
        type: "SELECT",
        options: ["ALL", "CRITICAL_ONLY", "NONE"],
        required: false,
        default: "CRITICAL_ONLY"
      }
    ],
    auto_confirm: true
  },
  
  "P5_WEEKLY": {
    questions: [
      {
        id: "analysis_focus",
        question: "本週分析重點？（例如：特定事件、板塊輪動、風險評估等）",
        type: "TEXT",
        required: false,
        default: ""
      },
      {
        id: "risk_tolerance",
        question: "本週風險容忍度？（CONSERVATIVE / MODERATE / AGGRESSIVE）",
        type: "SELECT",
        options: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"],
        required: false,
        default: "MODERATE"
      }
    ],
    auto_confirm: false
  },
  
  "P5_MONTHLY": {
    questions: [
      {
        id: "monthly_focus",
        question: "本月分析重點？（例如：持倉檢討、策略調整等）",
        type: "TEXT",
        required: false,
        default: ""
      }
    ],
    auto_confirm: false
  },
  
  "P5_QUARTERLY": {
    questions: [
      {
        id: "quarterly_focus",
        question: "本季分析重點？（例如：策略檢討、下季度展望等）",
        type: "TEXT",
        required: false,
        default: ""
      }
    ],
    auto_confirm: false
  }
};

// ==========================================
// 核心函數
// ==========================================

/**
 * 生成執行前確認問題
 * @param {string} phase - Phase 名稱（P0, P1, P2, P3, P4, P5）
 * @param {Object} context - 上下文資訊（可選）
 * @return {Object} 確認問題列表
 */
function generatePreExecutionQuestions(phase, context) {
  const config = PRE_EXECUTION_QUESTIONS[phase];
  
  if (!config) {
    Logger.log(`警告：Phase ${phase} 沒有配置確認問題，返回空問題列表`);
    return {
      phase: phase,
      questions: [],
      auto_confirm: true
    };
  }
  
  return {
    phase: phase,
    questions: config.questions,
    auto_confirm: config.auto_confirm,
    context: context || {}
  };
}

/**
 * 驗證用戶回答
 * @param {string} phase - Phase 名稱
 * @param {Object} answers - 用戶回答（key-value 格式）
 * @return {Object} 驗證結果
 */
function validatePreExecutionAnswers(phase, answers) {
  const config = PRE_EXECUTION_QUESTIONS[phase];
  
  if (!config) {
    return {
      valid: true,
      errors: []
    };
  }
  
  const errors = [];
  
  for (const question of config.questions) {
    const answer = answers[question.id];
    
    // 檢查必填問題
    if (question.required && (!answer || answer.trim() === "")) {
      errors.push({
        question_id: question.id,
        question: question.question,
        error: "此問題為必填"
      });
      continue;
    }
    
    // 使用預設值（如果答案為空）
    if (!answer || answer.trim() === "") {
      answers[question.id] = question.default || "";
      continue;
    }
    
    // 驗證格式（如果有驗證器）
    if (question.validator && typeof question.validator === 'function') {
      const validation = question.validator(answer);
      if (!validation.valid) {
        errors.push({
          question_id: question.id,
          question: question.question,
          error: validation.error
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    normalized_answers: answers
  };
}

/**
 * 保存確認問題到表格
 * @param {string} jobId - 任務 ID
 * @param {string} phase - Phase 名稱
 * @param {Object} questions - 問題列表
 * @return {string} 確認 ID
 */
function savePreExecutionQuestions(jobId, phase, questions) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("M0__JOB_CONFIRMATION");
  
  if (!sheet) {
    // 創建表格
    sheet = ss.insertSheet("M0__JOB_CONFIRMATION");
    sheet.appendRow([
      "confirmation_id",
      "job_id",
      "phase",
      "questions_json",
      "answers_json",
      "status",
      "created_at",
      "confirmed_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const confirmationId = `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  sheet.appendRow([
    confirmationId,
    jobId,
    phase,
    JSON.stringify(questions),
    JSON.stringify({}),  // 答案初始為空
    "PENDING",
    new Date(),
    null
  ]);
  
  Logger.log(`執行前確認問題已保存：confirmation_id=${confirmationId}, job_id=${jobId}, phase=${phase}`);
  
  return confirmationId;
}

/**
 * 更新確認答案
 * @param {string} confirmationId - 確認 ID
 * @param {Object} answers - 用戶回答
 * @param {boolean} confirmed - 是否確認執行
 * @return {boolean} 是否成功
 */
function updatePreExecutionAnswers(confirmationId, answers, confirmed) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("M0__JOB_CONFIRMATION");
  
  if (!sheet) {
    throw new Error("M0__JOB_CONFIRMATION 表格不存在");
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  
  // 查找對應的行
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === confirmationId) {
      // 更新答案和狀態
      sheet.getRange(i + 1, 5).setValue(JSON.stringify(answers));  // answers_json
      sheet.getRange(i + 1, 6).setValue(confirmed ? "CONFIRMED" : "REJECTED");  // status
      sheet.getRange(i + 1, 8).setValue(confirmed ? new Date() : null);  // confirmed_at
      
      Logger.log(`確認答案已更新：confirmation_id=${confirmationId}, confirmed=${confirmed}`);
      return true;
    }
  }
  
  throw new Error(`找不到確認 ID：${confirmationId}`);
}

/**
 * 檢查任務是否需要確認
 * @param {string} jobId - 任務 ID
 * @param {string} phase - Phase 名稱
 * @param {Object} context - 上下文（可選，包含 skip_confirmation）
 * @return {Object} 確認狀態
 */
function checkPreExecutionConfirmation(jobId, phase, context) {
  // ⭐ 如果 context.skip_confirmation 為 true，直接返回不需要確認
  if (context && context.skip_confirmation === true) {
    Logger.log(`執行前確認：Phase ${phase} 跳過確認（skip_confirmation=true）`);
    return {
      requires_confirmation: false,
      confirmation_id: null,
      status: "SKIPPED",
      answers: {}
    };
  }
  
  // ⭐ V8.0 新增：測試模式也跳過確認，使用預設值
  if (context && context.test_mode === true) {
    Logger.log(`執行前確認：Phase ${phase} 跳過確認（test_mode=true）`);
    
    // 生成預設答案
    const config = PRE_EXECUTION_QUESTIONS[phase];
    const defaultAnswers = {};
    
    if (config && config.questions) {
      for (const question of config.questions) {
        defaultAnswers[question.id] = question.default || "";
      }
    }
    
    return {
      requires_confirmation: false,
      confirmation_id: null,
      status: "SKIPPED",
      answers: defaultAnswers
    };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("M0__JOB_CONFIRMATION");
  
  if (!sheet) {
    // 如果表格不存在，返回不需要確認
    const config = PRE_EXECUTION_QUESTIONS[phase];
    return {
      requires_confirmation: !(config && config.auto_confirm),
      confirmation_id: null,
      status: "NOT_REQUIRED",
      answers: {}
    };
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  
  // 查找對應的確認記錄
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[1] === jobId && row[2] === phase) {
      return {
        requires_confirmation: true,
        confirmation_id: row[0],
        status: row[6],  // status
        questions: JSON.parse(row[3] || "{}"),  // questions_json
        answers: JSON.parse(row[4] || "{}")  // answers_json
      };
    }
  }
  
  // 如果沒有找到記錄，檢查是否需要確認
  const config = PRE_EXECUTION_QUESTIONS[phase];
  const requiresConfirmation = !(config && config.auto_confirm);
  
  return {
    requires_confirmation: requiresConfirmation,
    confirmation_id: null,
    status: requiresConfirmation ? "NOT_CREATED" : "NOT_REQUIRED"
  };
}
