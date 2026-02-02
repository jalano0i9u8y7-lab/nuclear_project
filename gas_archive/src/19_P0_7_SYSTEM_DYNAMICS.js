/**
 * 🔄 P0.7: 系統動力學分析（System Dynamics Analysis）
 * 
 * 基於 P0 的產業工程學輸出，進行系統動力學分析
 * - 敘事狀態（Narrative State）
 * - 循環主導（Loop Dominance）
 * - 時間定位（Time Position）
 * - 槓桿角色類型（Leveraged Role Type）
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P0.7 配置參數
// ==========================================

const P0_7_CONFIG = {
  // 執行頻率
  frequency: "QUARTERLY",  // 每季執行一次（與 P0 同步）
  
  // 系統動力學分析維度
  analysis_dimensions: {
    narrative_state: true,      // 敘事狀態分析
    loop_dominance: true,       // 循環主導分析
    time_position: true,        // 時間定位分析
    leveraged_role: true        // 槓桿角色類型分析
  }
};

// ==========================================
// P0.7 核心函數
// ==========================================

/**
 * P0.7 主執行函數
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P0_UPDATE / QUARTERLY / MANUAL）
 * @param {Object} params.user_input - 用戶輸入（來自執行前確認）
 * @param {string} params.p0_snapshot_id - P0 快照 ID（可選，如果不提供則使用最新）
 * @return {Object} P0.7 分析結果
 */
function P0_7_Execute(params) {
  const startTime = Date.now();
  
  try {
    // ⭐ V8.17.1 修正：確保 trigger 有默認值
    const trigger = params.trigger || "QUARTERLY";
    Logger.log(`P0.7 執行開始：trigger=${trigger}`);
    
    // ========================================
    // Step 1: 檢查執行前確認
    // ========================================
    
    const jobId = params.job_id || `P0_7_${Date.now()}`;
    const confirmation = checkPreExecutionConfirmation(jobId, "P0_7", params.context || {});
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions("P0_7", params.context);
        const confirmationId = savePreExecutionQuestions(jobId, "P0_7", questions);
        
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
    // Step 2: 讀取 P0 快照
    // ========================================
    
    let p0Snapshot;
    if (params.p0_snapshot_id) {
      p0Snapshot = getP0SnapshotById(params.p0_snapshot_id);
    } else {
      p0Snapshot = getLatestP0Snapshot();
    }
    
    if (!p0Snapshot || !p0Snapshot.p0_output_json) {
      throw new Error("P0 快照不存在或缺少數據，請先執行 P0");
    }
    
    const p0Output = typeof p0Snapshot.p0_output_json === 'string' ?
      JSON.parse(p0Snapshot.p0_output_json) : p0Snapshot.p0_output_json;
    
    // ========================================
    // Step 3: 準備 M0 Job 輸入
    // ========================================
    
    const m0InputPayload = {
      phase: "P0_7",
      trigger: trigger,  // ⭐ V8.17.1 修正：使用已處理的 trigger 變量
      user_input: userInput,
      p0_output: p0Output,
      p0_snapshot_id: p0Snapshot.snapshot_id,
      // ⭐ 機構級數據已移至 P2.5 模組，P0.7 專注於純學術分析
      previous_snapshot: getLatestP0_7Snapshot(),
      context: params.context || {}
    };
    
    // ========================================
    // Step 4: 構建 M0 流程
    // ========================================
    
    const requestedFlow = [
      "EXECUTOR",  // Step 1: 執行者（自動選擇：o3）
      "AUDITOR"    // Step 2: 審查者（自動選擇：Claude Opus 4.5，避免同家盲點）
    ];
    
    // 構建 P0.7 專用的 Prompt
    m0InputPayload.p0_7_prompt = buildP0_7Prompt(userInput, p0Output);
    
    // ========================================
    // Step 5: 提交到 M0 Job Queue
    // ========================================
    
    const jobId_final = submitToM0JobQueue("P0_7", requestedFlow, m0InputPayload);
    
    // ⭐ V8.0 修正：自動執行 M0 並等待結果（與 P0 保持一致）
    Logger.log(`P0.7：自動執行 M0 處理任務 ${jobId_final}`);
    M0_Execute();
    
    // 輪詢等待 M0 執行完成（最多等待 60 秒）
    const maxWaitTime = 60000;  // 60 秒
    const pollInterval = 1000;  // 每 1 秒檢查一次
    const startWaitTime = Date.now();
    
    let m0Result = null;
    while (Date.now() - startWaitTime < maxWaitTime) {
      Utilities.sleep(pollInterval);
      m0Result = getM0JobResult(jobId_final);
      
      if (m0Result) {
        Logger.log(`P0.7：M0 任務 ${jobId_final} 執行完成`);
        break;
      }
    }
    
    if (!m0Result) {
      // 超時，返回 SUBMITTED 狀態
      Logger.log(`P0.7：M0 執行超時，請稍後手動檢查結果`);
      return {
        status: "SUBMITTED",
        job_id: jobId_final,
        message: `P0.7 任務已提交到 M0，但執行超時（等待 ${maxWaitTime/1000} 秒），請稍後手動執行 M0_Execute() 或檢查 M0__RESULT`
      };
    }
    
    // ⭐ V8.0 修正：解析 M0 結果並處理
    Logger.log(`P0.7：解析 M0 結果，output 類型=${typeof m0Result.output}`);
    
    // ⭐ V8.0 修正：解析 M0 結果結構
    // m0Result 的結構應該是 { job_id, output }
    // output 是 executionResult.final_output，其中包含 executor_output 和 auditor_output
    const finalOutput = m0Result.output || {};
    
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
      input_payload: finalOutput.input_payload || JSON.stringify(m0InputPayload),  // ⭐ V8.17.1 新增：保存 input_payload
      trigger: params.trigger || "QUARTERLY"
    };
    
    Logger.log(`P0.7：解析 M0 結果，executor_output 類型=${typeof executorOutput}, auditor_output 類型=${typeof auditorOutput}`);
    
    // ⭐ V8.0 修正：調用處理函數，傳遞完整的 params（包括 trigger 和 context）
    const p0_7Result = P0_7_ProcessM0Result(jobId_final, m0ResultPayload, {
      trigger: params.trigger || "QUARTERLY",  // ⭐ V8.17.1 修正：確保有默認值
      context: params.context || {}
    });
    
    return p0_7Result;
    
  } catch (error) {
    Logger.log(`P0.7 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 M0 Job 結果（從 M0__RESULT 表格讀取）
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
 * 處理 P0.7 M0 執行結果（由 M0 調用或 P0_7_Execute 調用）
 * @param {string} jobId - 任務 ID
 * @param {Object} m0Result - M0 執行結果
 * @param {Object} params - 額外參數（可選，包含 trigger 和 context）
 * @return {Object} P0.7 處理結果
 */
function P0_7_ProcessM0Result(jobId, m0Result, params) {
  const startTime = Date.now();
  
  try {
    // ⭐ V8.0 修正：安全獲取 trigger 和 context（支持從 params 或 m0Result 中獲取）
    const trigger = (params && params.trigger) || m0Result.trigger || "QUARTERLY";
    const context = (params && params.context) || {};
    Logger.log(`P0.7 處理 M0 結果：jobId=${jobId}`);
    
    // ========================================
    // Step 1: 解析 M0 結果
    // ========================================
    
    let executorOutput = m0Result.executor_output || {};
    let auditorOutput = m0Result.auditor_output || {};
    let p0Output = m0Result.p0_output || {};
    // ⭐ 機構級數據已移至 P2.5 模組
    
    // ⭐ 修正：如果 executorOutput 是字符串，嘗試從 markdown 中提取 JSON
    if (typeof executorOutput === 'string') {
      try {
        let jsonString = executorOutput.trim();
        
        // 方法 1：嘗試提取 ```json ... ``` 代碼塊
        const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/i);
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[1].trim();
        } else {
          // 方法 2：嘗試提取 ``` ... ``` 代碼塊（無 json 標記）
          const codeBlockMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
          } else {
            // 方法 3：嘗試找到第一個 { 到最後一個 } 之間的內容
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }
          }
        }
        
        executorOutput = JSON.parse(jsonString);
        Logger.log(`P0.7 調試：成功從 markdown 中提取並解析 executorOutput 為 JSON 對象`);
      } catch (e) {
        Logger.log(`P0.7 調試：無法解析 executorOutput 字符串：${e.message}`);
        Logger.log(`P0.7 調試：executorOutput 前 200 字符：${executorOutput.substring(0, 200)}`);
      }
    }
    
    // ⭐ 修正：如果 auditorOutput 是字符串，嘗試從 markdown 中提取 JSON
    if (typeof auditorOutput === 'string') {
      try {
        let jsonString = auditorOutput.trim();
        
        // 方法 1：嘗試提取 ```json ... ``` 代碼塊
        const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/i);
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[1].trim();
        } else {
          // 方法 2：嘗試提取 ``` ... ``` 代碼塊（無 json 標記）
          const codeBlockMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
          } else {
            // 方法 3：嘗試找到第一個 { 到最後一個 } 之間的內容
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }
          }
        }
        
        auditorOutput = JSON.parse(jsonString);
        Logger.log(`P0.7 調試：成功從 markdown 中提取並解析 auditorOutput 為 JSON 對象`);
      } catch (e) {
        Logger.log(`P0.7 調試：無法解析 auditorOutput 字符串：${e.message}`);
      }
    }
    
    // ⭐ 修正：如果 p0Output 是字符串，嘗試解析為 JSON
    if (typeof p0Output === 'string') {
      try {
        let jsonString = p0Output.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        p0Output = JSON.parse(jsonString);
        Logger.log(`P0.7 調試：成功解析 p0Output 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P0.7 調試：無法解析 p0Output 字符串：${e.message}`);
      }
    }
    
    // ⭐ 調試日誌：檢查 P0 輸出
    Logger.log(`P0.7 調試：p0Output.themes 數量=${(p0Output.themes || []).length}`);
    Logger.log(`P0.7 調試：p0Output.subthemes 數量=${(p0Output.subthemes || []).length}`);
    Logger.log(`P0.7 調試：p0Output.key_nodes 數量=${(p0Output.key_nodes || []).length}`);
    
    // ⭐ 調試日誌：檢查 executorOutput
    Logger.log(`P0.7 調試：executorOutput 類型=${typeof executorOutput}, 是否有 themes=${!!executorOutput.themes}`);
    if (executorOutput.themes) {
      Logger.log(`P0.7 調試：executorOutput.themes 數量=${executorOutput.themes.length}`);
      if (executorOutput.themes.length > 0) {
        const firstTheme = executorOutput.themes[0];
        Logger.log(`P0.7 調試：第一個 theme 包含 dynamic_problem_oneliner=${!!firstTheme.dynamic_problem_oneliner}, loop_dominance=${!!firstTheme.loop_dominance}, time_position=${!!firstTheme.time_position}`);
      }
    }
    
    // ========================================
    // Step 2: 生成 P0.7 輸出結構（純學術分析，不包含機構級數據）
    // ========================================
    
    const p0_7Output = generateP0_7Output(executorOutput, auditorOutput, p0Output);
    
    // ⭐ 調試日誌：檢查生成的 p0_7Output
    Logger.log(`P0.7 調試：p0_7Output.themes 數量=${(p0_7Output.themes || []).length}`);
    Logger.log(`P0.7 調試：p0_7Output.subthemes 數量=${(p0_7Output.subthemes || []).length}`);
    
    // ========================================
    // Step 4: 保存快照
    // ========================================
    
    const snapshot = saveP0_7Snapshot({
      job_id: jobId,
      trigger: trigger,  // ⭐ V8.0 修正：使用從 params 獲取的 trigger
      p0_7_output: p0_7Output,
      p0_snapshot_id: m0Result.p0_snapshot_id,
      changes: compareWithPreviousSnapshotP0_7(p0_7Output)
    });
    
    // ========================================
    // Step 5: 檢查是否需要觸發下游
    // ========================================
    
    if (snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P1
      triggerDownstreamPhasesP0_7("P0_7", snapshot);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P0.7 處理完成：snapshot_id=${snapshot.snapshot_id}, 耗時=${duration}ms`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p0_7_output: p0_7Output,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P0.7 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 機構級視角整合
// ==========================================

// ⭐ 機構級數據分析已移至 P2.5 模組
// P0.7 專注於純學術硬底子分析（系統動力學）

// ==========================================
// P0.7 輸出生成
// ==========================================

/**
 * 生成 P0.7 輸出結構
 * ⭐ V8.0 修正：從 executorOutput.themes 陣列中提取系統動力學分析結果
 * AI 回應結構：{ themes: [{ theme_id, dynamic_problem_oneliner, loop_dominance, time_position, ... }], subthemes: [...] }
 */
function generateP0_7Output(executorOutput, auditorOutput, p0Output) {
  // ⭐ V8.0 修正：AI 回應結構是 themes 陣列，每個 theme 包含系統動力學分析欄位
  const themes = executorOutput.themes || [];
  const subthemes = executorOutput.subthemes || [];
  
  Logger.log(`P0.7 generateP0_7Output：從 themes 陣列提取，themes 數量=${themes.length}, subthemes 數量=${subthemes.length}`);
  
  // 驗證 themes 是否包含必要的系統動力學分析欄位
  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const hasRequired = theme.dynamic_problem_oneliner && 
                       theme.loop_dominance && 
                       theme.time_position && 
                       theme.leveraged_role_type;
    if (!hasRequired) {
      Logger.log(`⚠️ P0.7 警告：THEME_${i + 1} 缺少必要的系統動力學分析欄位`);
    }
  }
  
  return {
    // ⭐ V8.0 修正：直接使用 executorOutput 的 themes 和 subthemes（已包含系統動力學分析結果）
    themes: themes,
    subthemes: subthemes,
    // 保留 p0Output 的原始主題信息（如果需要對比）
    p0_themes: p0Output.themes || [],
    // AUDITOR 審查結果
    auditor_review: auditorOutput.audit_review || auditorOutput.review || null,
    confidence_level: executorOutput.confidence_level || auditorOutput.confidence_level || 0.7,
    analysis_date: executorOutput.analysis_date || new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建 P0.7 系統動力學分析 Prompt
 */
function buildP0_7Prompt(userInput, p0Output) {
  return `
你是一位資深的系統動力學分析師，負責進行 Nuclear Project 的 Phase 0.7 分析。

## ⭐⭐⭐ 核心任務定位

**Phase 0.7 的目的**：在 Phase 0 已確認「必然性」後，Phase 0.7 用系統動力學方式裁決：
- 該主題目前在系統演化的**時間序位置**
- 主導系統的是 **增強迴路（R）** 還是 **調節迴路（B）**
- 「最該押的槓桿點」是哪一種**公司角色類型**（不是公司名）

## P0 輸入（已確認必然性的主題）

### 主題列表
${JSON.stringify(p0Output.themes || [], null, 2)}

### 子主題列表
${JSON.stringify(p0Output.subthemes || [], null, 2)}

---

## P0.7-2 核心概念定義（必讀）

### 1) Reinforcing Loop（R｜增強迴路）

系統「自我強化」：
- 產生正回饋
- 越做越強
- 越滲透越加速

**範例**：網路效應、學習曲線、規模經濟等

### 2) Balancing Loop（B｜調節迴路）

系統「自我抑制」：
- 成本/瓶頸/飽和帶來回饋
- 越做越難
- 斜率下滑或收斂

**範例**：市場飽和、資源耗盡、競爭加劇等

---

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## P0.7-3 分析模組（固定順序，不得跳步）

**⚠️ 重要：必須按照以下順序完成分析，不得跳步。**

---

### A) 動態性問題定義

**必須用「隨時間變化」的句子定義，而非靜態描述。**

✅ **正確範例**：
- 「在商業化過程中，算力成本與效益是否仍形成可持續正回饋？」
- 「隨著滲透率提升，網路效應是否會加速增強？」
- 「在量產過程中，成本下降速度是否會快於價格下降速度？」

❌ **錯誤範例**：
- 「這個產業會不會成長？」（靜態描述）
- 「這個技術是否重要？」（靜態描述）
- 「這個市場有多大？」（靜態描述）

**輸出要求**：為每個 Theme/Subtheme 寫出一個動態性問題定義。

---

### B) 關鍵存量（Stocks）與流量（Flows）辨識

**必須辨識：**

#### Stocks（會累積的東西）
- 能力（技術能力、生產能力、市場能力等）
- 滲透率（市場滲透率、技術滲透率等）
- 風險（技術風險、市場風險、政策風險等）
- 成本壓力（生產成本、研發成本、合規成本等）

#### Flows（讓 Stocks 增減的速度）
- 導入速度（技術導入速度、產品導入速度等）
- 擴產速度（產能擴張速度、市場擴張速度等）
- 認證速度（合規認證速度、標準認證速度等）
- 學習速度（技術學習速度、市場學習速度等）

**輸出要求**：為每個 Theme/Subtheme 列出至少 2 個關鍵 Stocks 和 2 個關鍵 Flows。

---

### C) CLD 因果迴路裁決

**必須至少辨識：**
- **1 個主要 R 迴路（引擎）**：推動系統增強的因果鏈
- **1 個主要 B 迴路（抑制器）**：抑制系統增強的因果鏈

**並寫出其因果鏈**（例如：A → B → C → A）

**輸出要求**：
- 畫出至少 1 個 R 迴路的因果鏈
- 畫出至少 1 個 B 迴路的因果鏈
- 說明每個迴路中的關鍵變量

---

### D) 時間序位置裁決（四分法）

**必須判斷每個 Theme/Subtheme 的時間序位置：**

- **Early（早期）**：結構成形中，滲透率低，R 開始增強
  - 特徵：技術剛成熟、市場剛起步、滲透率 < 10%、R 迴路剛啟動

- **Mid（中期）**：R 主導，擴散加速，複利期
  - 特徵：技術已成熟、市場快速擴張、滲透率 10-50%、R 迴路強勢主導

- **Late（晚期）**：B 抬頭，成長收斂，市場已高度共識
  - 特徵：技術已普及、市場接近飽和、滲透率 > 50%、B 迴路開始主導

- **Transition（轉換）**：R→B 或 B→R 的轉折帶（高不確定、高波動）
  - 特徵：系統處於轉折點、R 和 B 迴路力量相當、高不確定性、高波動

**輸出要求**：為每個 Theme/Subtheme 判斷時間序位置，並說明判斷理由。

---

### E) 槓桿點角色類型裁決（只寫類型，不寫公司）

**⚠️ 重要：輸出必須是「公司類型」，不是公司名稱。**

**必須從以下角色類型中選擇（或定義新的角色類型）：**
- **平台核心層（Platform core）**：提供核心平台能力的公司
- **合規入口層（Compliance gateway）**：控制合規入口的公司
- **設備承載層（Hardware enablement layer）**：提供設備承載能力的公司
- **流程 OS（Workflow OS）**：提供工作流作業系統的公司
- **供給側約束（Supply bottleneck）**：控制供給側瓶頸的公司

**並說明為何它是槓桿點**（牽一髮動全身的原因）

**輸出要求**：
- 為每個 Theme/Subtheme 識別至少 1 個槓桿點角色類型
- 說明為何該角色類型是槓桿點
- **禁止寫出公司名稱，只寫角色類型**

---

### F) 敘事與結構錯位檢查

**⚠️ ⭐ V8.17.1 新增：時間漂移防護（重要）**

**所有周期判斷必須相對於 P0 定義的結構性必然性，而不是短期宏觀噪音。**

**核心原則**：
- ✅ **所有 Early / Mid / Late 判斷必須基於 P0 定義的結構性必然性**
- ✅ **不要被短期宏觀數據、市場情緒或新聞噪音影響**
- ✅ **時間定位必須相對於 P0 的「必然性兌現時間窗」（3-10 年）**
- ❌ **不要過度相信最新數據而忘記「這是相對於 P0 的時間位置」**

**必須判斷是否存在：**

1. **敘事 > 結構（炒過頭）**
   - 市場敘事過度樂觀，但結構性支撐不足
   - 範例：AI 概念股被過度炒作，但實際應用落地不足

2. **結構 > 敘事（被低估）**
   - 結構性支撐強，但市場敘事尚未跟上
   - 範例：關鍵技術已成熟，但市場認知度低

3. **時間錯位（太早/太晚）**
   - 結構和敘事都對，但時間點不對
   - 範例：技術太早（市場未準備好）或太晚（競爭已飽和）

**並寫出「錯位會造成的投資誤判」**

**輸出要求**：
- 為每個 Theme/Subtheme 判斷是否存在錯位
- 如果存在錯位，說明錯位類型（敘事>結構 / 結構>敘事 / 時間錯位）
- 寫出錯位會造成的投資誤判

---

## P0.7-4 強制輸出（五項缺一不可）

**⚠️ 重要：每一個 Theme/Subtheme 必須輸出以下五項，缺一不可。**

1. **Dynamic_Problem_OneLiner**（動態性問題一句話）
   - 必須用「隨時間變化」的句子定義

2. **Loop_Dominance**（R/B/Mixed）
   - R：增強迴路主導
   - B：調節迴路主導
   - Mixed：R 和 B 迴路力量相當

3. **Time_Position**（Early/Mid/Late/Transition）
   - 必須是四分法中的一個

4. **Leveraged_Role_Type**（角色類型＋理由）
   - 必須是角色類型（不是公司名）
   - 必須說明為何是槓桿點

5. **Risk_Note**（若跳過 P0.7 最可能犯的錯）
   - 說明如果跳過 P0.7 分析，最可能犯的投資誤判

---

## 輸出格式（必須是 JSON）

{
  "themes": [
    {
      "theme_id": "THEME_001",
      
      // ⭐ P0.7-4 強制輸出（五項缺一不可）
      "dynamic_problem_oneliner": "動態性問題一句話（必須用『隨時間變化』的句子）",
      "loop_dominance": "R/B/Mixed",
      "time_position": "Early/Mid/Late/Transition",
      "leveraged_role_type": {
        "role_type": "平台核心層/合規入口層/設備承載層/流程OS/供給側約束",
        "reason": "為何它是槓桿點（牽一髮動全身的原因）"
      },
      "risk_note": "若跳過 P0.7 最可能犯的錯",
      
      // P0.7-3 分析模組結果
      "dynamic_problem_definition": "動態性問題定義（詳細版）",
      "stocks_and_flows": {
        "stocks": [
          {
            "name": "能力/滲透率/風險/成本壓力",
            "description": "說明"
          }
        ],
        "flows": [
          {
            "name": "導入速度/擴產速度/認證速度/學習速度",
            "description": "說明"
          }
        ]
      },
      "cld_loops": {
        "reinforcing_loops": [
          {
            "loop_id": "R_LOOP_001",
            "causal_chain": "A → B → C → A",
            "key_variables": ["變量1", "變量2"],
            "description": "迴路描述"
          }
        ],
        "balancing_loops": [
          {
            "loop_id": "B_LOOP_001",
            "causal_chain": "X → Y → Z → X",
            "key_variables": ["變量1", "變量2"],
            "description": "迴路描述"
          }
        ]
      },
      "time_position_detail": {
        "position": "Early/Mid/Late/Transition",
        "reasoning": "判斷理由",
        "key_indicators": ["指標1", "指標2"]
      },
      "leveraged_roles": [
        {
          "role_type": "平台核心層/合規入口層/設備承載層/流程OS/供給側約束",
          "leverage_reason": "為何是槓桿點（牽一髮動全身）",
          "impact_description": "影響描述"
        }
      ],
      "narrative_structure_mismatch": {
        "has_mismatch": true/false,
        "mismatch_type": "敘事>結構/結構>敘事/時間錯位/null",
        "mismatch_description": "錯位描述",
        "investment_misjudgment": "錯位會造成的投資誤判"
      }
    }
  ],
  "subthemes": [
    {
      "subtheme_id": "SUBTHEME_001",
      "theme_id": "THEME_001",
      
      // ⭐ P0.7-4 強制輸出（五項缺一不可，格式同 themes）
      "dynamic_problem_oneliner": "動態性問題一句話",
      "loop_dominance": "R/B/Mixed",
      "time_position": "Early/Mid/Late/Transition",
      "leveraged_role_type": { /* 同 themes */ },
      "risk_note": "若跳過 P0.7 最可能犯的錯",
      
      // P0.7-3 分析模組結果（格式同 themes）
      "dynamic_problem_definition": { /* 同 themes */ },
      "stocks_and_flows": { /* 同 themes */ },
      "cld_loops": { /* 同 themes */ },
      "time_position_detail": { /* 同 themes */ },
      "leveraged_roles": { /* 同 themes */ },
      "narrative_structure_mismatch": { /* 同 themes */ }
    }
  ],
  "confidence_level": 0.0-1.0,
  "analysis_date": "${new Date().toISOString().split('T')[0]}"
}

---

## 注意事項

1. **必須按照固定順序完成分析**：A → B → C → D → E → F，不得跳步。

2. **P0.7-4 強制輸出缺一不可**：每一個 Theme/Subtheme 必須輸出五項（Dynamic_Problem_OneLiner、Loop_Dominance、Time_Position、Leveraged_Role_Type、Risk_Note），缺一不可。

3. **動態性問題定義必須用「隨時間變化」的句子**：禁止使用靜態描述。

4. **槓桿點角色類型只寫類型，不寫公司名**：禁止寫出公司名稱，只寫角色類型（平台核心層、合規入口層等）。

5. **必須基於 P0 的輸出進行分析**：不能偏離 P0 已確認的「必然性」結論。

6. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確，可以被程式解析。

7. **每個主題、子主題都必須有完整的分析**：不能遺漏任何 Theme/Subtheme。
`;
}

// ==========================================
// 快照管理
// ==========================================

/**
 * 獲取最新 P0.7 快照
 */
function getLatestP0_7Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 8).getValues()[0];
    
    return {
      snapshot_id: row[0],
      created_at: row[1],
      trigger: row[2],
      p0_7_output_json: row[3] ? JSON.parse(row[3]) : {},
      p0_snapshot_id: row[4],
      changes_json: row[5] ? JSON.parse(row[5]) : null,
      version: row[6] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P0.7 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P0.7 快照
 */
function saveP0_7Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P0_7__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P0_7__SNAPSHOT");
    sheet.appendRow([
      "snapshot_id",
      "created_at",
      "trigger",
      "p0_7_output_json",
      "p0_snapshot_id",
      "changes_json",
      "version"
    ]);
    sheet.setFrozenRows(1);
  }
  
  // ⭐ V8.17.4 新增：檢查是否已存在相同內容的快照（避免重複保存）
  // 由於 P0.7 Schema 沒有 job_id 欄位，使用 p0_snapshot_id 和輸出內容來檢查
  if (snapshotData.job_id && sheet.getLastRow() > 1) {
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const p0SnapshotIdCol = headers.indexOf("p0_snapshot_id");
    const outputCol = headers.indexOf("p0_7_output_json");
    
    if (p0SnapshotIdCol !== -1 && outputCol !== -1) {
      const currentOutputStr = JSON.stringify(snapshotData.p0_7_output);
      const currentP0SnapshotId = snapshotData.p0_snapshot_id;
      
      // 從最後一行開始檢查（最新的快照）
      for (let i = rows.length - 1; i >= 1; i--) {
        const rowP0SnapshotId = rows[i][p0SnapshotIdCol];
        const rowOutput = rows[i][outputCol];
        
        // 如果 p0_snapshot_id 相同，且輸出內容相同（或非常相似），可能是重複保存
        if (rowP0SnapshotId === currentP0SnapshotId) {
          const rowOutputStr = typeof rowOutput === 'string' ? rowOutput : JSON.stringify(rowOutput);
          // 簡單比較：如果輸出字符串長度相近（差異 < 100 字符），可能是重複
          if (Math.abs(rowOutputStr.length - currentOutputStr.length) < 100) {
            Logger.log(`P0.7：檢測到可能的重複快照（p0_snapshot_id=${currentP0SnapshotId}），跳過保存`);
            const snapshotIdCol = headers.indexOf("snapshot_id");
            return {
              snapshot_id: rows[i][snapshotIdCol] || generateP0_7SnapshotId(),
              changes: snapshotData.changes || {}
            };
          }
        }
      }
    }
  }
  
  const snapshotId = generateP0_7SnapshotId();
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(snapshotData.p0_7_output),
    snapshotData.p0_snapshot_id,
    JSON.stringify(snapshotData.changes),
    "V7.1"
  ]);
  
  Logger.log(`P0.7 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * 生成 P0.7 快照 ID
 */
function generateP0_7SnapshotId() {
  const date = new Date();
  const year = date.getFullYear();
  const quarter = Math.floor((date.getMonth() + 3) / 3);
  return `P0_7_${year}Q${quarter}_${Date.now()}`;
}

/**
 * 比對與上一版快照的變動
 */
function compareWithPreviousSnapshotP0_7(currentOutput) {
  const previousSnapshot = getLatestP0_7Snapshot();
  
  if (!previousSnapshot) {
    return {
      has_changes: true,
      is_first_run: true,
      changes: []
    };
  }
  
  const previousOutput = previousSnapshot.p0_7_output_json || {};
  const changes = [];
  
  // 比對敘事狀態變動
  const currentNarrativeIds = (currentOutput.narrative_states || []).map(n => `${n.theme_id}_${n.state}`);
  const previousNarrativeIds = (previousOutput.narrative_states || []).map(n => `${n.theme_id}_${n.state}`);
  
  const newNarratives = currentNarrativeIds.filter(id => previousNarrativeIds.indexOf(id) === -1);
  const changedNarratives = [];
  
  for (const currentNarrative of currentOutput.narrative_states || []) {
    const previousNarrative = (previousOutput.narrative_states || []).find(
      n => n.theme_id === currentNarrative.theme_id
    );
    
    if (previousNarrative && previousNarrative.state !== currentNarrative.state) {
      changedNarratives.push({
        theme_id: currentNarrative.theme_id,
        from: previousNarrative.state,
        to: currentNarrative.state
      });
    }
  }
  
  if (newNarratives.length > 0 || changedNarratives.length > 0) {
    changes.push({
      type: "NARRATIVE_STATE_CHANGES",
      new: newNarratives,
      changed: changedNarratives
    });
  }
  
  // 比對時間定位變動
  const changedTimePositions = [];
  for (const currentTimePos of currentOutput.time_positions || []) {
    const previousTimePos = (previousOutput.time_positions || []).find(
      t => t.theme_id === currentTimePos.theme_id
    );
    
    if (previousTimePos && previousTimePos.position !== currentTimePos.position) {
      changedTimePositions.push({
        theme_id: currentTimePos.theme_id,
        from: previousTimePos.position,
        to: currentTimePos.position
      });
    }
  }
  
  if (changedTimePositions.length > 0) {
    changes.push({
      type: "TIME_POSITION_CHANGES",
      changed: changedTimePositions
    });
  }
  
  return {
    has_changes: changes.length > 0 || newNarratives.length > 0 || changedNarratives.length > 0 || changedTimePositions.length > 0,
    is_first_run: false,
    changes: changes
  };
}

// ==========================================
// 下游觸發
// ==========================================

/**
 * 觸發下游 Phase（P1）
 */
function triggerDownstreamPhasesP0_7(sourcePhase, snapshot) {
  if (snapshot.changes && snapshot.changes.has_changes) {
    // 觸發 P1（公司池建立）
    Logger.log("P0.7 變動檢測，觸發 P1");
    try {
      P1_Execute({
        trigger: "P0_7_UPDATE",
        p0_7_snapshot_id: snapshot.snapshot_id,
        context: {
          source_phase: "P0_7",
          source_snapshot_id: snapshot.snapshot_id
        }
      });
    } catch (error) {
      Logger.log(`P0.7 觸發 P1 失敗：${error.message}`);
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
  
  Logger.log(`P0.7 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 根據快照 ID 獲取 P0 快照
 */
function getP0SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
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
    Logger.log(`獲取 P0 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取循環相關的公司（輔助函數）
 */
function getLoopRelatedCompanies(loop) {
  try {
    // 根據循環的主題 ID，從主題相關的公司中獲取
    if (loop.theme_id) {
      const theme = { theme_id: loop.theme_id };
      return getThemeCompanies(theme);
    }
    
    // 如果循環有 node_id，從節點相關的公司中獲取
    if (loop.node_id) {
      const node = { node_id: loop.node_id };
      return getNodeCompanies(node);
    }
    
    return [];
  } catch (error) {
    Logger.log(`獲取循環相關公司失敗：${error.message}`);
    return [];
  }
}

/**
 * 獲取時間定位相關的公司（輔助函數）
 * 
 * @param {Object} timePosition - 時間定位分析結果
 * @returns {Array} companies - 相關公司列表
 */
function getTimePositionRelatedCompanies(timePosition) {
  try {
    // 根據時間定位分析結果，找出相關公司
    // 可以從主題相關的公司中獲取
    if (!timePosition || !timePosition.theme_id) {
      Logger.log("P0.7：時間定位缺少 theme_id，無法獲取相關公司");
      return [];
    }
    
    const theme = { theme_id: timePosition.theme_id };
    const companies = getThemeCompanies(theme);
    
    Logger.log(`P0.7：時間定位 ${timePosition.theme_id} 找到 ${companies.length} 家相關公司`);
    return companies;
  } catch (error) {
    Logger.log(`P0.7：獲取時間定位相關公司失敗：${error.message}`);
    return [];
  }
}
