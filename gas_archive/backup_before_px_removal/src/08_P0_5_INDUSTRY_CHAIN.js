/**
 * 🗺️ P0.5: 產業鏈地圖與供應鏈情報網（Industry Chain Map & Supply Chain Intelligence）
 * 
 * ⭐ V8.15 重大更新：雙模式設計 + 產業鏈動態監控
 * 
 * Mode 1: Baseline Builder（第一次跑）- 產業鏈地圖繪製
 * Mode 2: Chain Dynamics Monitor（後續監控）- 上中下游行為一致性監控
 * 
 * 視覺化產業關係
 * 識別供應鏈節點
 * 追蹤產業資金流
 * 監控上中下游行為一致性（⭐ V8.15 新增）
 * 
 * @version V8.15
 * @date 2026-01-19
 */

// ==========================================
// P0.5 主執行函數
// ==========================================

/**
 * P0.5 主執行函數 ⭐ V8.15 更新：雙模式設計
 * @param {Object} params - 執行參數
 * @return {Object} 執行結果
 */
function P0_5_Execute(params) {
  try {
    Logger.log(`P0.5：開始執行產業鏈地圖分析`);
    
    // 1. 讀取 P0 快照
    const p0Snapshot = getLatestP0Snapshot();
    if (!p0Snapshot) {
      throw new Error("找不到 P0 快照，請先執行 P0");
    }
    
    // ⭐ V8.17.1 修正：安全解析 JSON，避免對已經是對象的值使用 JSON.parse
    let p0Output = {};
    if (p0Snapshot.p0_output_json) {
      try {
        const value = p0Snapshot.p0_output_json;
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          p0Output = JSON.parse(value);
        } else if (typeof value === 'object') {
          p0Output = value;
        } else {
          Logger.log(`P0.5：p0_output_json 格式異常，類型=${typeof value}`);
          p0Output = {};
        }
      } catch (e) {
        Logger.log(`P0.5：解析 p0_output_json 失敗：${e.message}，值=${String(p0Snapshot.p0_output_json).substring(0, 50)}`);
        p0Output = {};
      }
    }
    
    // ⭐ V8.15 新增：判斷 Mode（檢查 P1 公司池是否存在）
    const mode = determineP0_5Mode();
    const cadence = determineCadence(mode);
    
    // ⭐ V8.15 新增：Mode 2 執行時間檢查
    if (mode === "CHAIN_DYNAMICS_MONITOR") {
      const shouldExecute = shouldExecuteMode2(cadence);
      if (!shouldExecute) {
        Logger.log(`P0.5 Mode 2：當前不是執行時機（cadence=${cadence}），跳過`);
        return {
          status: "SKIPPED",
          mode: mode,
          cadence: cadence,
          reason: "當前不是執行時機"
        };
      }
    }
    
    // 2. 根據 Mode 構建不同的 Prompt
    const context = params.context || {};
    let p0_5Prompt;
    let m0InputPayload;
    
    if (mode === "BASELINE_BUILDER") {
      // Mode 1: Baseline Builder
      Logger.log(`P0.5：執行 Mode 1（Baseline Builder）`);
      p0_5Prompt = buildP0_5Prompt(p0Output, context);
      m0InputPayload = {
        phase: "P0.5",
        mode: "BASELINE_BUILDER",
        trigger: params.trigger || "QUARTERLY",
        cadence: "QUARTERLY",
        p0_output: p0Output,
        p0_snapshot_id: p0Snapshot.snapshot_id,
        p0_5_prompt: p0_5Prompt
      };
    } else {
      // Mode 2: Chain Dynamics Monitor
      Logger.log(`P0.5：執行 Mode 2（Chain Dynamics Monitor，cadence=${cadence}）`);
      
      // 讀取 P1 公司池和 P2 財務數據
      const chainBehaviorData = collectChainBehaviorData();
      if (!chainBehaviorData || Object.keys(chainBehaviorData).length === 0) {
        throw new Error("P0.5 Mode 2：無法收集產業鏈行為數據，請確認 P1/P2 已完成");
      }
      
      // 讀取上次 P0.7 的時間窗口約束（如果存在）
      const p0_7TimeWindowConstraints = getP0_7TimeWindowConstraints();
      
      p0_5Prompt = buildChainDynamicsPrompt(p0Output, chainBehaviorData, p0_7TimeWindowConstraints, context);
      m0InputPayload = {
        phase: "P0.5",
        mode: "CHAIN_DYNAMICS_MONITOR",
        trigger: params.trigger || (cadence === "MONTHLY" ? "MONTHLY" : "QUARTERLY"),
        cadence: cadence,
        p0_output: p0Output,
        p0_snapshot_id: p0Snapshot.snapshot_id,
        chain_behavior_data: chainBehaviorData,
        p0_7_time_window_constraints: p0_7TimeWindowConstraints,
        p0_5_prompt: p0_5Prompt
      };
    }
    
    // 3. 提交到 M0 Job Queue
    const requestedFlow = [
      "EXECUTOR",  // OPUS 執行
      "AUDITOR"    // GPT 審查
    ];
    
    const jobId = submitToM0JobQueue("P0.5", requestedFlow, m0InputPayload);
    Logger.log(`P0.5：已提交到 M0 Job Queue，jobId=${jobId}，mode=${mode}，cadence=${cadence}`);
    
    // ⭐ V8.17.1 新增：測試模式下自動執行 M0 並等待結果
    if (params.test_mode === true) {
      Logger.log(`P0.5：測試模式檢測到，自動執行 M0 處理任務 ${jobId}`);
      
      try {
        // 執行 M0
        M0_Execute();
        
        // 輪詢等待 M0 執行完成（最多等待 60 秒）
        let m0Result = null;
        const maxWaitTime = 60000; // 60 秒
        const pollInterval = 2000; // 每 2 秒檢查一次
        const startWaitTime = Date.now();
        
        while (Date.now() - startWaitTime < maxWaitTime) {
          Utilities.sleep(pollInterval);
          m0Result = getM0JobResult(jobId);
          
          if (m0Result) {
            Logger.log(`P0.5：M0 任務 ${jobId} 執行完成`);
            break;
          }
          
          // 檢查任務狀態（如果失敗，提前退出）
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
          if (jobQueueSheet) {
            const dataRange = jobQueueSheet.getDataRange();
            const rows = dataRange.getValues();
            const headers = rows[0];
            const statusCol = headers.indexOf("status");
            
            for (let i = 1; i < rows.length; i++) {
              if (rows[i][0] === jobId) {
                const status = rows[i][statusCol];
                if (status === "FAILED" || status === "ERROR") {
                  throw new Error(`P0.5 M0 任務 ${jobId} 執行失敗`);
                }
                break;
              }
            }
          }
        }
        
        if (!m0Result) {
          Logger.log(`P0.5：M0 任務 ${jobId} 執行超時，返回 SUBMITTED 狀態`);
          return {
            status: "SUBMITTED",
            job_id: jobId,
            mode: mode,
            cadence: cadence,
            message: "P0.5 任務已提交到 M0，但執行超時"
          };
        }
        
        // 處理 M0 結果
        // ⭐ V8.17.1 修正：m0Result 的結構是 { job_id, output }，需要轉換為 P0_5_ProcessM0Result 需要的格式
        const finalOutput = m0Result.output || {};
        
        // ⭐ V8.17.1 修正：如果 finalOutput 是字符串，先解析
        let parsedOutput = finalOutput;
        if (typeof finalOutput === 'string') {
          try {
            parsedOutput = JSON.parse(finalOutput);
          } catch (e) {
            Logger.log(`P0.5：無法解析 finalOutput 字符串：${e.message}`);
            parsedOutput = {};
          }
        }
        
        // 嘗試從不同可能的結構中提取 executor_output 和 auditor_output
        let executorOutput = parsedOutput.executor_output || parsedOutput.executor || parsedOutput.previous_result || {};
        let auditorOutput = parsedOutput.auditor_output || parsedOutput.auditor || parsedOutput.final_output || {};
        
        // 如果 executorOutput 或 auditorOutput 是字符串，嘗試解析
        if (typeof executorOutput === 'string') {
          try {
            executorOutput = JSON.parse(executorOutput);
          } catch (e) {
            Logger.log(`P0.5：無法解析 executorOutput 字符串：${e.message}`);
            executorOutput = {};
          }
        }
        if (typeof auditorOutput === 'string') {
          try {
            auditorOutput = JSON.parse(auditorOutput);
          } catch (e) {
            Logger.log(`P0.5：無法解析 auditorOutput 字符串：${e.message}`);
            auditorOutput = {};
          }
        }
        
        // ⭐ V8.17.1 新增：如果 executorOutput 或 auditorOutput 是空對象，記錄警告
        if (!executorOutput || Object.keys(executorOutput).length === 0) {
          Logger.log(`P0.5：警告：executorOutput 為空，這可能表示 M0 執行失敗或結果格式不正確`);
        }
        if (!auditorOutput || Object.keys(auditorOutput).length === 0) {
          Logger.log(`P0.5：警告：auditorOutput 為空，這可能表示 AUDITOR 步驟失敗或輸出為空`);
        }
        
        const m0ResultPayload = {
          executor_output: executorOutput,
          auditor_output: auditorOutput,
          input_payload: parsedOutput.input_payload || JSON.stringify(m0InputPayload)
        };
        
        const p0_5Result = P0_5_ProcessM0Result(jobId, m0ResultPayload);
        
        return {
          status: "COMPLETED",
          job_id: jobId,
          mode: mode,
          cadence: cadence,
          snapshot_id: p0_5Result.snapshot_id,
          message: "P0.5 任務已完成"
        };
      } catch (error) {
        Logger.log(`P0.5：測試模式執行失敗：${error.message}`);
        return {
          status: "SUBMITTED",
          job_id: jobId,
          mode: mode,
          cadence: cadence,
          message: `P0.5 任務已提交到 M0，但執行失敗：${error.message}`
        };
      }
    }
    
    return {
      status: "SUBMITTED",
      job_id: jobId,
      mode: mode,
      cadence: cadence,
      message: "P0.5 任務已提交到 M0，請執行 M0_Execute() 處理"
    };
    
  } catch (error) {
    Logger.log(`P0.5 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P0.5 M0 結果 ⭐ V8.15 更新：支持雙模式
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @return {Object} P0.5 處理結果
 */
function P0_5_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P0.5 處理 M0 結果：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 解析輸出
    let p0_5Output = {};
    if (typeof executorOutput === 'string') {
      try {
        let jsonString = executorOutput.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        p0_5Output = JSON.parse(jsonString);
      } catch (e) {
        Logger.log(`P0.5：無法解析 executorOutput：${e.message}`);
        p0_5Output = executorOutput;
      }
    } else {
      p0_5Output = executorOutput;
    }
    
    // 從 input_payload 獲取參數
    const inputPayload = JSON.parse(m0Result.input_payload || "{}");
    const p0SnapshotId = inputPayload.p0_snapshot_id;
    const mode = inputPayload.mode || "BASELINE_BUILDER";
    const cadence = inputPayload.cadence || "QUARTERLY";
    const p0_7TimeWindowConstraints = inputPayload.p0_7_time_window_constraints || null;
    
    // 保存快照（⭐ V8.15 更新：支持新欄位）
    const snapshot = saveP0_5Snapshot({
      job_id: jobId,
      mode: mode,
      trigger: inputPayload.trigger || (cadence === "MONTHLY" ? "MONTHLY" : "QUARTERLY"),
      cadence: cadence,
      p0_snapshot_id: p0SnapshotId,
      p0_5_output: p0_5Output,
      auditor_output: auditorOutput,
      p0_7_time_window_constraints: p0_7TimeWindowConstraints
    });
    
    Logger.log(`P0.5 處理完成：snapshot_id=${snapshot.snapshot_id}，mode=${mode}，cadence=${cadence}`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      mode: mode,
      cadence: cadence,
      p0_5_output: p0_5Output
    };
    
  } catch (error) {
    Logger.log(`P0.5 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// P0.5 Prompt 構建
// ==========================================

/**
 * 構建 P0.5 產業鏈地圖分析的 Prompt
 * @param {Object} p0Output - P0 的輸出（themes, subthemes, key_nodes）
 * @param {Object} context - 上下文資訊（可選）
 * @return {string} Prompt 內容
 */
function buildP0_5Prompt(p0Output, context = {}) {
  return `
## 🗺️ P0.5：產業鏈地圖分析（Industry Chain Map）

**你的角色**：結構翻譯器

**你的任務**：把 P0 的抽象必然性，翻譯成「現實世界的結構圖」

---

## ⚠️ 重要：職權邊界

**✅ 你可以做**：
- 產業鏈節點拆解（上/中/下游）
- 關鍵瓶頸節點識別
- 單點失效（Single Point of Failure）識別
- 地緣政治/法規/供應鏈風險描述
- 資金流與訂單流向（描述性）
- 定價權來源分析

**❌ 絕對禁止**：
- ❌ 產業是否值得投資（這是 P0 的職責）
- ❌ 長期前瞻敘事（這是 P0 的職責）
- ❌ 現在是不是好時機（這是 P0.7 的職責）
- ❌ 選股或公司層級分析（這是 P1 以後的職責）

**P0.5 不下結論，P0.5 只畫地圖**

---

## 📥 輸入：P0 的分析結果

以下是 P0 選出的潛力產業面與關鍵節點：

${JSON.stringify(p0Output, null, 2)}

---

## 🎯 你的分析任務

### **任務 1：產業鏈節點拆解**

針對 P0 選出的每個 Theme/Subtheme，畫出完整的產業鏈結構：

1. **上游（Upstream）**：
   - 原材料供應商
   - 關鍵設備供應商
   - 基礎技術提供者
   - 識別每個上游節點的關鍵公司/地區/技術

2. **中游（Midstream）**：
   - 關鍵製程（Critical Processes）
   - 關鍵模組（Critical Modules）
   - 組裝/整合環節
   - 識別每個中游節點的關鍵公司/地區/技術

3. **下游（Downstream）**：
   - 終端應用場景
   - 終端客戶/市場
   - 分銷渠道
   - 識別每個下游節點的關鍵公司/地區/市場

### **任務 2：關鍵節點識別**

針對每個產業鏈節點，識別：

1. **Bottleneck（瓶頸）**：
   - 哪些節點是產能瓶頸？
   - 哪些節點是技術瓶頸？
   - 哪些節點是資源瓶頸？
   - 瓶頸的嚴重程度（高/中/低）
   - 瓶頸的替代性（可替代/難替代/不可替代）

### **任務 2.5：瓶頸轉移觀測（Bottleneck Migration Scan）⭐ V8.18 新增**

**⚠️ 重要：這是觀測任務，不是預測任務**

**核心原則**：
- 利潤永遠往瓶頸流動，而不是往「現在最紅的公司」流動
- 真實的超額報酬，來自：舊瓶頸「開始緩解」+ 新瓶頸「尚未被市場完全意識到」
- 不要寫成「下一個瓶頸一定是 XX」，而是基於工程邏輯推演

**觀測任務**：
1. **檢查目前產業鏈中哪些關鍵節點的產能、良率、交期、資本支出正在明顯改善？**
   - 識別「現有瓶頸」出現緩解跡象（例如：CapEx expansion、lead time shortening、良率提升）
   - 輸出 \`easing_signals\` 陣列，列出具體的緩解信號

2. **若「現有瓶頸」出現緩解跡象，推演下一個最可能限制整條鏈的環節**
   - 基於工程邏輯推演（物理限制、製程難度、能源/散熱/封裝/系統整合）
   - 以「可能性排序」輸出（High / Medium / Low），而非單一答案
   - ❌ **禁止引用股價、新聞熱度或市場情緒**

3. **輸出格式**：
   \\\`\\\`\\\`json
   "bottleneck_status": {
     "current_bottleneck": "當前瓶頸節點名稱（例如：HBM capacity）",
     "easing_signals": [
       "CapEx expansion",
       "lead time shortening",
       "良率提升"
     ],
     "next_bottleneck_candidates": [
       {
         "node": "Advanced Packaging (CoWoS)",
         "probability": "High",
         "reasoning": "基於工程邏輯的推演理由（例如：當 HBM 產能開出後，封裝環節會成為下一個限制）"
       },
       {
         "node": "Thermal Management",
         "probability": "Medium",
         "reasoning": "基於工程邏輯的推演理由"
       }
     ]
   }
   \\\`\\\`\\\`

2. **定價權（Pricing Power）**：
   - 誰掌握定價權？
   - 定價權的來源（技術壟斷/資源壟斷/市場壟斷/法規保護）
   - 定價權的強度（強/中/弱）
   - 定價權的可持續性（長期/中期/短期）

3. **單點失效（Single Point of Failure）**：
   - 哪些節點是單點失效？
   - 單點失效的影響範圍（整個產業鏈/部分產業鏈）
   - 單點失效的風險等級（高/中/低）
   - 是否有備援方案？

### **任務 3：強化 P0 選出的產業的關鍵不可替代性**

針對 P0 選出的每個 Theme/Subtheme，分析：

1. **在整個供應鏈中的位置**：
   - 該產業/節點在供應鏈中的位置（上游/中游/下游）
   - 該產業/節點的不可替代性（為什麼不可替代？）
   - 該產業/節點對整個供應鏈的影響（如果缺失會如何？）

2. **關鍵不可替代性分析**：
   - 技術不可替代性（是否有獨特技術？）
   - 資源不可替代性（是否有獨特資源？）
   - 市場不可替代性（是否有獨特市場地位？）
   - 法規不可替代性（是否有法規保護？）

3. **供應鏈依賴關係**：
   - 該產業/節點依賴哪些上游節點？
   - 哪些下游節點依賴該產業/節點？
   - 依賴關係的強度（強/中/弱）
   - 依賴關係的風險（高/中/低）

### **任務 4：風險識別**

針對每個產業鏈節點，識別：

1. **地緣政治風險**：
   - 哪些節點受地緣政治影響？
   - 地緣政治風險的嚴重程度（高/中/低）
   - 地緣政治風險的影響範圍

2. **法規風險**：
   - 哪些節點受法規影響？
   - 法規風險的嚴重程度（高/中/低）
   - 法規風險的影響範圍

3. **供應鏈風險**：
   - 哪些節點有供應鏈中斷風險？
   - 供應鏈風險的嚴重程度（高/中/低）
   - 供應鏈風險的影響範圍

4. **技術風險**：
   - 哪些節點有技術替代風險？
   - 技術風險的嚴重程度（高/中/低）
   - 技術風險的影響範圍

### **任務 5：資金流與訂單流向（描述性）**

針對每個產業鏈，描述：

1. **資金流向**：
   - 資金從哪裡流入？（終端市場/投資者/政府）
   - 資金流向哪裡？（上游/中游/下游）
   - 資金流的強度（強/中/弱）
   - 資金流的穩定性（穩定/波動/不穩定）

2. **訂單流向**：
   - 訂單從哪裡開始？（終端需求）
   - 訂單流向哪裡？（上游/中游/下游）
   - 訂單流的強度（強/中/弱）
   - 訂單流的穩定性（穩定/波動/不穩定）

**⚠️ 注意**：這是描述性分析，不要進行投資判斷或時機判斷。

### **任務 6：投資相關性標籤（⭐ V8.17.1 新增）**

針對每個產業鏈節點，必須標註投資相關性：

1. **INVESTABLE_CHOKEPOINT（可投資關鍵節點）**：
   - 具有結構性瓶頸、定價權或依賴錨點特徵
   - 是 P1 公司池應該直接投資的節點
   - 必須滿足：Bottleneck、Pricing Power 或 SPoF 中的至少一項

2. **SUPPORTING_NODE（支撐節點）**：
   - 對產業鏈有重要支撐作用，但不是直接投資目標
   - 可能作為間接投資或監控對象

3. **CONTEXT_ONLY（僅上下文）**：
   - 僅提供產業鏈上下文資訊
   - **不應直接投資**（P1 應排除）

**輸出要求**：為每個節點標註 investment_relevance 欄位。

---

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## 📤 輸出格式

請按照以下 JSON 格式輸出：

{
  "industry_chain_maps": [
    {
      "theme_id": "THEME_001",
      "theme_name": "主題名稱",
      "subthemes": [
        {
          "subtheme_id": "SUBTHEME_001",
          "subtheme_name": "子主題名稱",
          "industry_chain": {
            "upstream": [
              {
                "node_id": "UPSTREAM_001",
                "node_name": "節點名稱",
                "node_type": "原材料供應商 / 關鍵設備供應商 / 基礎技術提供者",
                "key_companies": ["公司1", "公司2"],
                "key_regions": ["地區1", "地區2"],
                "key_technologies": ["技術1", "技術2"],
                "is_bottleneck": true,
                "bottleneck_type": "產能瓶頸 / 技術瓶頸 / 資源瓶頸",
                "bottleneck_severity": "高 / 中 / 低",
                "bottleneck_substitutability": "可替代 / 難替代 / 不可替代",
                "pricing_power": {
                  "holder": "誰掌握定價權",
                  "source": "技術壟斷 / 資源壟斷 / 市場壟斷 / 法規保護",
                  "strength": "強 / 中 / 弱",
                  "sustainability": "長期 / 中期 / 短期"
                },
                "is_single_point_of_failure": true,
                "spof_impact_scope": "整個產業鏈 / 部分產業鏈",
                "spof_risk_level": "高 / 中 / 低",
                "has_backup": false,
                "backup_description": "備援方案描述（如果有）",
                "investment_relevance": "INVESTABLE_CHOKEPOINT / SUPPORTING_NODE / CONTEXT_ONLY"
              }
            ],
            "midstream": [ /* 格式同 upstream */ ],
            "downstream": [ /* 格式同 upstream，但包含 application_scenarios 和 key_markets */ ]
          },
          "p0_selected_node_analysis": {
            "node_id": "P0選出的節點ID",
            "node_name": "P0選出的節點名稱",
            "position_in_chain": "上游 / 中游 / 下游",
            "irreplaceability_analysis": {
              "technical_irreplaceability": {
                "is_irreplaceable": true,
                "reason": "是否有獨特技術？為什麼不可替代？",
                "unique_technologies": ["技術1", "技術2"]
              },
              "resource_irreplaceability": { /* 格式同 technical_irreplaceability */ },
              "market_irreplaceability": { /* 格式同 technical_irreplaceability */ },
              "regulatory_irreplaceability": { /* 格式同 technical_irreplaceability */ }
            },
            "supply_chain_impact": {
              "impact_if_missing": "如果該節點缺失，會對整個供應鏈造成什麼影響？",
              "impact_scope": "整個產業鏈 / 部分產業鏈",
              "impact_severity": "高 / 中 / 低"
            },
            "dependency_relationships": {
              "upstream_dependencies": [
                {
                  "node_id": "UPSTREAM_001",
                  "node_name": "依賴的上游節點",
                  "dependency_strength": "強 / 中 / 弱",
                  "dependency_risk": "高 / 中 / 低"
                }
              ],
              "downstream_dependencies": [ /* 格式同 upstream_dependencies */ ]
            }
          },
          "risk_analysis": {
            "geopolitical_risks": [
              {
                "node_id": "NODE_001",
                "node_name": "受影響的節點",
                "risk_description": "地緣政治風險描述",
                "risk_severity": "高 / 中 / 低",
                "impact_scope": "影響範圍"
              }
            ],
            "regulatory_risks": [ /* 格式同 geopolitical_risks */ ],
            "supply_chain_risks": [ /* 格式同 geopolitical_risks */ ],
            "technology_risks": [ /* 格式同 geopolitical_risks */ ]
          },
          "capital_flow_analysis": {
            "capital_flow": {
              "source": "資金從哪裡流入？（終端市場/投資者/政府）",
              "direction": "資金流向哪裡？（上游/中游/下游）",
              "strength": "強 / 中 / 弱",
              "stability": "穩定 / 波動 / 不穩定"
            },
            "order_flow": {
              "source": "訂單從哪裡開始？（終端需求）",
              "direction": "訂單流向哪裡？（上游/中游/下游）",
              "strength": "強 / 中 / 弱",
              "stability": "穩定 / 波動 / 不穩定"
            }
          }
        }
      ]
    }
  ],
  "summary": {
    "total_themes": 3,
    "total_subthemes": 10,
    "total_nodes": 50,
    "bottleneck_count": 5,
    "spof_count": 3,
    "high_risk_nodes": 8
  },
  "bottleneck_status": {  // ⭐ V8.18 新增：瓶頸轉移觀測結果
    "current_bottleneck": "當前瓶頸節點名稱（例如：HBM capacity）",
    "easing_signals": [
      "CapEx expansion",
      "lead time shortening",
      "良率提升"
    ],
    "next_bottleneck_candidates": [
      {
        "node": "Advanced Packaging (CoWoS)",
        "probability": "High",
        "reasoning": "基於工程邏輯的推演理由（例如：當 HBM 產能開出後，封裝環節會成為下一個限制）"
      },
      {
        "node": "Thermal Management",
        "probability": "Medium",
        "reasoning": "基於工程邏輯的推演理由"
      }
    ]
  }
}

---

## ⚠️ 輸出要求

1. **只畫地圖，不下結論**：
   - 不要判斷產業是否值得投資
   - 不要進行長期前瞻敘事
   - 不要判斷現在是不是好時機
   - 只描述現實世界的結構

2. **強化 P0 選出的產業的關鍵不可替代性**：
   - 重點分析 P0 選出的每個 Theme/Subtheme 在整個供應鏈中的位置
   - 說明為什麼這些節點不可替代
   - 說明這些節點對整個供應鏈的影響

3. **為未來監控提供基礎**：
   - 識別所有關鍵節點（Bottleneck、SPOF、定價權持有者）
   - 識別所有風險點（地緣政治、法規、供應鏈、技術）
   - 描述資金流和訂單流向
   - 這些資訊將用於未來的資金流追蹤和供應鏈風險監控

4. **保持客觀描述**：
   - 使用事實性描述，避免主觀判斷
   - 引用具體的公司、地區、技術名稱
   - 提供具體的風險等級和影響範圍
`;
}

// ==========================================
// ⭐ V8.15 新增：雙模式判斷與執行時間邏輯
// ==========================================

/**
 * 判斷 P0.5 Mode（檢查 P1 公司池是否存在）⭐ V8.15 新增
 * @return {string} "BASELINE_BUILDER" 或 "CHAIN_DYNAMICS_MONITOR"
 */
function determineP0_5Mode() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    // 如果 P1 公司池不存在或沒有數據，則使用 Mode 1
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0.5：P1 公司池不存在，使用 Mode 1（Baseline Builder）");
      return "BASELINE_BUILDER";
    }
    
    // P1 公司池存在，使用 Mode 2
    Logger.log("P0.5：P1 公司池存在，使用 Mode 2（Chain Dynamics Monitor）");
    return "CHAIN_DYNAMICS_MONITOR";
  } catch (error) {
    Logger.log(`P0.5 判斷 Mode 失敗：${error.message}，使用 Mode 1`);
    return "BASELINE_BUILDER";
  }
}

/**
 * 判斷執行頻率（cadence）⭐ V8.15 新增
 * @param {string} mode - P0.5 Mode
 * @return {string} "MONTHLY" 或 "QUARTERLY"
 */
function determineCadence(mode) {
  if (mode === "BASELINE_BUILDER") {
    // Mode 1：季度（與 P0 同步）
    return "QUARTERLY";
  } else {
    // Mode 2：需要檢查是否有台股公司
    // 如果有台股公司 → MONTHLY，否則 → QUARTERLY
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("Phase1_Company_Pool");
      
      if (!sheet || sheet.getLastRow() <= 1) {
        return "QUARTERLY";
      }
      
      // 檢查是否有台股公司（Market = "TW" 或 "TSE"）
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const marketCol = headers.indexOf("Market");
      
      if (marketCol === -1) {
        return "QUARTERLY";
      }
      
      const dataRange = sheet.getDataRange();
      const rows = dataRange.getValues();
      
      // 檢查是否有台股公司
      for (let i = 1; i < rows.length; i++) {
        const market = rows[i][marketCol];
        if (market && (market.toString().toUpperCase().includes("TW") || market.toString().toUpperCase().includes("TSE"))) {
          Logger.log("P0.5：發現台股公司，使用 MONTHLY cadence");
          return "MONTHLY";
        }
      }
      
      Logger.log("P0.5：未發現台股公司，使用 QUARTERLY cadence");
      return "QUARTERLY";
    } catch (error) {
      Logger.log(`P0.5 判斷 cadence 失敗：${error.message}，使用 QUARTERLY`);
      return "QUARTERLY";
    }
  }
}

/**
 * 判斷 Mode 2 是否應該執行 ⭐ V8.15 新增
 * @param {string} cadence - 執行頻率
 * @return {boolean} 是否應該執行
 */
function shouldExecuteMode2(cadence) {
  if (cadence === "QUARTERLY") {
    // 美日股：季度（季度財報後執行，這裡簡化為任何時候都可以執行，實際應該檢查季度財報日期）
    return true;
  } else {
    // 台股：每月 12 號執行（台股規定每月 10 日前必須公布上月營收）
    const now = new Date();
    const day = now.getDate();
    
    // 如果是每月 12 號或之後（預留財報狗的更新時間）
    if (day >= 12) {
      Logger.log(`P0.5 Mode 2：當前日期為 ${day} 號，符合執行時機（每月 12 號）`);
      return true;
    } else {
      Logger.log(`P0.5 Mode 2：當前日期為 ${day} 號，不符合執行時機（應在每月 12 號後）`);
      return false;
    }
  }
}

// ==========================================
// ⭐ V8.15 新增：數據收集機制
// ==========================================

/**
 * 收集產業鏈行為數據 ⭐ V8.15 新增
 * @return {Object} 產業鏈行為數據（按上中下游分類）
 */
function collectChainBehaviorData() {
  try {
    Logger.log("P0.5：開始收集產業鏈行為數據");
    
    // 1. 從 P1 讀取公司池（按上中下游分類）
    const companiesByPosition = classifyCompaniesByChainPosition();
    
    // 2. 從 P2 讀取財務數據
    const financialData = extractChainBehaviorIndicators(companiesByPosition);
    
    // 3. 組合成標準化數據結構
    const chainBehaviorData = {
      upstream_signals: {
        companies: companiesByPosition.upstream || [],
        revenue_trend: financialData.upstream?.revenue_trend || [],
        capex_trend: financialData.upstream?.capex_trend || [],
        narratives: financialData.upstream?.narratives || []
      },
      midstream_signals: {
        companies: companiesByPosition.midstream || [],
        revenue_trend: financialData.midstream?.revenue_trend || [],
        inventory_changes: financialData.midstream?.inventory_changes || [],
        margin_changes: financialData.midstream?.margin_changes || [],
        narratives: financialData.midstream?.narratives || []
      },
      downstream_signals: {
        companies: companiesByPosition.downstream || [],
        revenue_trend: financialData.downstream?.revenue_trend || [],
        order_visibility: financialData.downstream?.order_visibility || [],
        narratives: financialData.downstream?.narratives || []
      }
    };
    
    Logger.log(`P0.5：產業鏈行為數據收集完成（上游：${chainBehaviorData.upstream_signals.companies.length} 家，中游：${chainBehaviorData.midstream_signals.companies.length} 家，下游：${chainBehaviorData.downstream_signals.companies.length} 家）`);
    
    return chainBehaviorData;
  } catch (error) {
    Logger.log(`P0.5 收集產業鏈行為數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 按產業鏈位置分類公司 ⭐ V8.15 新增
 * @return {Object} 按上中下游分類的公司列表
 */
function classifyCompaniesByChainPosition() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0.5：Phase1_Company_Pool 表格不存在或沒有數據");
      return {
        upstream: [],
        midstream: [],
        downstream: []
      };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    const companyCodeCol = headers.indexOf("Company_Code");
    const companyNameCol = headers.indexOf("Company_Name");
    const marketCol = headers.indexOf("Market");
    const supplyChainPositionCol = headers.indexOf("Supply_Chain_Position");
    
    if (companyCodeCol === -1 || companyNameCol === -1) {
      Logger.log("P0.5：Phase1_Company_Pool 缺少必要欄位");
      return {
        upstream: [],
        midstream: [],
        downstream: []
      };
    }
    
    const companies = {
      upstream: [],
      midstream: [],
      downstream: []
    };
    
    // 遍歷所有行（跳過表頭）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const ticker = row[companyCodeCol];
      const companyName = row[companyNameCol];
      const market = marketCol !== -1 ? row[marketCol] : "";
      const position = supplyChainPositionCol !== -1 ? row[supplyChainPositionCol] : "";
      
      if (!ticker) continue;
      
      // 根據 Supply_Chain_Position 分類
      const positionKey = position ? position.toString().toLowerCase() : "";
      
      if (positionKey.includes("upstream")) {
        companies.upstream.push({
          ticker: ticker,
          company_name: companyName || ticker,
          market: market || "",
          position: position || ""
        });
      } else if (positionKey.includes("midstream")) {
        companies.midstream.push({
          ticker: ticker,
          company_name: companyName || ticker,
          market: market || "",
          position: position || ""
        });
      } else if (positionKey.includes("downstream")) {
        companies.downstream.push({
          ticker: ticker,
          company_name: companyName || ticker,
          market: market || "",
          position: position || ""
        });
      }
    }
    
    Logger.log(`P0.5：公司分類完成（上游：${companies.upstream.length} 家，中游：${companies.midstream.length} 家，下游：${companies.downstream.length} 家）`);
    
    return companies;
  } catch (error) {
    Logger.log(`P0.5 分類公司失敗：${error.message}`);
    return {
      upstream: [],
      midstream: [],
      downstream: []
    };
  }
}

/**
 * 提取產業鏈行為指標 ⭐ V8.15 新增
 * @param {Object} companiesByPosition - 按上中下游分類的公司列表
 * @return {Object} 產業鏈行為指標
 */
function extractChainBehaviorIndicators(companiesByPosition) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0.5：Phase2_Output 表格不存在或沒有數據");
      return {
        upstream: {},
        midstream: {},
        downstream: {}
      };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    const companyCodeCol = headers.indexOf("Company_Code");
    const revenueYoYCol = headers.indexOf("Revenue_YoY");
    const grossMarginCol = headers.indexOf("Gross_Margin");
    const operatingMarginCol = headers.indexOf("Operating_Margin");
    const netMarginCol = headers.indexOf("Net_Margin");
    const cfoCol = headers.indexOf("CFO");
    const fcfCol = headers.indexOf("FCF");
    const marketCol = headers.indexOf("Market");
    
    const indicators = {
      upstream: {
        revenue_trend: [],
        capex_trend: [],  // 使用 FCF 作為 CapEx proxy（如果有數據）
        narratives: []
      },
      midstream: {
        revenue_trend: [],
        inventory_changes: [],  // 暫時留空，未來可從其他數據源獲取
        margin_changes: [],
        narratives: []
      },
      downstream: {
        revenue_trend: [],
        order_visibility: [],  // 暫時留空，未來可從 RPO/Backlog 獲取
        narratives: []
      }
    };
    
    // 建立公司位置映射
    const companyPositionMap = {};
    for (const position of ["upstream", "midstream", "downstream"]) {
      for (const company of companiesByPosition[position] || []) {
        companyPositionMap[company.ticker] = position;
      }
    }
    
    // 遍歷 P2 輸出數據（跳過表頭）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const ticker = row[companyCodeCol];
      
      if (!ticker || !companyPositionMap[ticker]) continue;
      
      const position = companyPositionMap[ticker];
      const revenueYoY = revenueYoYCol !== -1 ? row[revenueYoYCol] : null;
      const grossMargin = grossMarginCol !== -1 ? row[grossMarginCol] : null;
      const operatingMargin = operatingMarginCol !== -1 ? row[operatingMarginCol] : null;
      const netMargin = netMarginCol !== -1 ? row[netMarginCol] : null;
      const fcf = fcfCol !== -1 ? row[fcfCol] : null;
      const market = marketCol !== -1 ? row[marketCol] : "";
      
      // 上游指標
      if (position === "upstream") {
        if (revenueYoY !== null && revenueYoY !== "") {
          indicators.upstream.revenue_trend.push({
            ticker: ticker,
            value: revenueYoY,
            direction: revenueYoY > 0 ? "UP" : (revenueYoY < 0 ? "DOWN" : "FLAT")
          });
        }
        if (fcf !== null && fcf !== "") {
          // 使用 FCF 作為 CapEx proxy（FCF 增加可能表示 CapEx 增加）
          indicators.upstream.capex_trend.push({
            ticker: ticker,
            value: fcf,
            direction: fcf > 0 ? "UP" : "FLAT"  // 簡化處理
          });
        }
        // 簡化處理：根據市場生成敘事
        if (market && market.toString().toUpperCase().includes("TW")) {
          indicators.upstream.narratives.push(`${ticker}：台股月營收${revenueYoY > 0 ? "成長" : "衰退"}`);
        }
      }
      
      // 中游指標
      if (position === "midstream") {
        if (revenueYoY !== null && revenueYoY !== "") {
          indicators.midstream.revenue_trend.push({
            ticker: ticker,
            value: revenueYoY,
            direction: revenueYoY > 0 ? "UP" : (revenueYoY < 0 ? "DOWN" : "FLAT")
          });
        }
        if (operatingMargin !== null && operatingMargin !== "") {
          indicators.midstream.margin_changes.push({
            ticker: ticker,
            value: operatingMargin,
            direction: "STABLE"  // 簡化處理
          });
        }
      }
      
      // 下游指標
      if (position === "downstream") {
        if (revenueYoY !== null && revenueYoY !== "") {
          indicators.downstream.revenue_trend.push({
            ticker: ticker,
            value: revenueYoY,
            direction: revenueYoY > 0 ? "UP" : (revenueYoY < 0 ? "DOWN" : "FLAT")
          });
        }
      }
    }
    
    Logger.log("P0.5：產業鏈行為指標提取完成");
    
    return indicators;
  } catch (error) {
    Logger.log(`P0.5 提取產業鏈行為指標失敗：${error.message}`);
    return {
      upstream: {},
      midstream: {},
      downstream: {}
    };
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取最新的 P0 快照
 * @return {Object|null} P0 快照
 */
function getLatestP0Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 返回最後一行（最新的快照）
    const lastRow = rows[rows.length - 1];
    
    // ⭐ V8.17.1 修正：直接返回原始值，讓調用者決定如何解析
    // 因為 Google Sheets 可能返回字符串或對象，取決於數據格式
    const p0OutputJsonValue = lastRow[headers.indexOf("p0_output_json")];
    
    return {
      snapshot_id: lastRow[headers.indexOf("snapshot_id")],
      p0_output_json: p0OutputJsonValue  // 可能是字符串或對象
    };
  } catch (error) {
    Logger.log(`獲取最新 P0 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取 P0.7 時間窗口約束 ⭐ V8.15 新增
 * @return {Object|null} P0.7 時間窗口約束
 */
function getP0_7TimeWindowConstraints() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0.5：P0_7__SNAPSHOT 不存在或沒有數據，沒有時間窗口約束");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 查找 time_window_constraints_json 欄位
    const timeWindowConstraintsCol = headers.indexOf("time_window_constraints_json");
    if (timeWindowConstraintsCol === -1 || !row[timeWindowConstraintsCol]) {
      Logger.log("P0.5：P0_7__SNAPSHOT 沒有 time_window_constraints_json 欄位");
      return null;
    }
    
    // 解析 JSON
    try {
      const constraints = typeof row[timeWindowConstraintsCol] === 'string' 
        ? JSON.parse(row[timeWindowConstraintsCol]) 
        : row[timeWindowConstraintsCol];
      
      Logger.log(`P0.5：讀取 P0.7 時間窗口約束：cycle_position=${constraints.cycle_position || "N/A"}`);
      return constraints;
    } catch (e) {
      Logger.log(`P0.5：解析 P0.7 時間窗口約束失敗：${e.message}`);
      return null;
    }
  } catch (error) {
    Logger.log(`P0.5 獲取 P0.7 時間窗口約束失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P0.5 快照 ⭐ V8.15 更新：支持雙模式和新增欄位
 * @param {Object} snapshotData - 快照數據
 * @return {Object} 保存的快照
 */
function saveP0_5Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P0_5__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P0_5__SNAPSHOT");
    sheet.appendRow(P0_5_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  // ⭐ V8.17.4 新增：檢查是否已存在相同 job_id 的快照（避免重複保存）
  if (snapshotData.job_id && sheet.getLastRow() > 1) {
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const jobIdCol = headers.indexOf("job_id");
    
    if (jobIdCol !== -1) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][jobIdCol] === snapshotData.job_id) {
          Logger.log(`P0.5：快照已存在（job_id=${snapshotData.job_id}），跳過重複保存`);
          const snapshotIdCol = headers.indexOf("snapshot_id");
          return {
            snapshot_id: rows[i][snapshotIdCol] || `P0_5_${Date.now()}`,
            changes: snapshotData.changes || {}
          };
        }
      }
    }
  }
  
  // 生成快照 ID
  const snapshotId = `P0_5_${Date.now()}`;
  const mode = snapshotData.mode || "BASELINE_BUILDER";
  const cadence = snapshotData.cadence || "QUARTERLY";
  
  // 根據 Mode 處理不同的輸出格式
  let industryChainMapJson = null;
  let chainDynamicsMonitorJson = null;
  
  if (mode === "BASELINE_BUILDER") {
    // Mode 1：輸出 industry_chain_map_json
    industryChainMapJson = snapshotData.p0_5_output && snapshotData.p0_5_output.industry_chain_maps ? 
      JSON.stringify(snapshotData.p0_5_output.industry_chain_maps) : null;
    chainDynamicsMonitorJson = null;  // Mode 1 不生成 Chain Dynamics Monitor
  } else {
    // Mode 2：輸出 chain_dynamics_monitor_json（4 區結構）
    chainDynamicsMonitorJson = snapshotData.p0_5_output ? 
      JSON.stringify(snapshotData.p0_5_output) : null;
    industryChainMapJson = null;  // Mode 2 不生成 Industry Chain Map
  }
  
  // ⭐ V8.17.1 修正：從所有 subthemes 中提取 risk_analysis
  const allRiskAnalysis = [];
  if (snapshotData.p0_5_output && snapshotData.p0_5_output.industry_chain_maps) {
    snapshotData.p0_5_output.industry_chain_maps.forEach(theme => {
      if (theme.subthemes && Array.isArray(theme.subthemes)) {
        theme.subthemes.forEach(subtheme => {
          if (subtheme.risk_analysis) {
            allRiskAnalysis.push({
              theme_id: theme.theme_id,
              theme_name: theme.theme_name,
              subtheme_id: subtheme.subtheme_id,
              subtheme_name: subtheme.subtheme_name,
              risk_analysis: subtheme.risk_analysis
            });
          }
        });
      }
    });
  }
  const supplyChainRiskJson = allRiskAnalysis.length > 0 ? JSON.stringify(allRiskAnalysis) : null;
  
  // 準備行數據（按照 Schema 順序）⭐ V8.15 更新
  // ⭐ V8.17.4 新增：檢查 Schema 是否有 job_id 欄位
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const hasJobIdCol = headers.includes("job_id");
  
  const rowData = [
    snapshotId,
    new Date(),
    snapshotData.trigger || (cadence === "MONTHLY" ? "MONTHLY" : "QUARTERLY"),
    mode,  // ⭐ V8.15 新增
    cadence,  // ⭐ V8.15 新增
    JSON.stringify(snapshotData.p0_5_output || {}),  // p0_5_output_json（保留兼容性）
    snapshotData.p0_snapshot_id || "",
    industryChainMapJson,  // industry_chain_map_json（Mode 1）
    chainDynamicsMonitorJson,  // ⭐ V8.15 新增：chain_dynamics_monitor_json（Mode 2）
    snapshotData.p0_7_time_window_constraints ? JSON.stringify(snapshotData.p0_7_time_window_constraints) : null,  // ⭐ V8.15 新增：p0_7_time_window_constraints_json
    supplyChainRiskJson,  // ⭐ V8.17.1 修正：supply_chain_risk_json（從所有 subthemes 中提取）
    null,  // ⭐ V8.17.1 修正：changes_json（改為 null，而不是空對象）
    "V8.15"  // ⭐ V8.15 更新版本號
  ];
  
  // ⭐ V8.17.4 新增：如果 Schema 有 job_id 欄位，添加到 rowData
  if (hasJobIdCol) {
    const jobIdColIndex = headers.indexOf("job_id");
    // 在適當位置插入 job_id（在 snapshot_id 之後）
    rowData.splice(1, 0, snapshotData.job_id || "");
  }
  
  // 追加行
  sheet.appendRow(rowData);
  
  Logger.log(`P0.5 V8.15：已保存快照 ${snapshotId}（mode=${mode}，cadence=${cadence}）`);
  
  return {
    snapshot_id: snapshotId,
    ...snapshotData
  };
}

// ==========================================
// ⭐ V8.15 新增：Mode 2 Prompt（Chain Dynamics Monitor）
// ==========================================

/**
 * 構建 P0.5 Mode 2 產業鏈動態監控的 Prompt ⭐ V8.15 新增
 * @param {Object} p0Output - P0 的輸出（themes, subthemes, key_nodes）
 * @param {Object} chainBehaviorData - 產業鏈行為數據（按上中下游分類）
 * @param {Object} p0_7TimeWindowConstraints - P0.7 時間窗口約束（可選）
 * @param {Object} context - 上下文資訊（可選）
 * @return {string} Prompt 內容
 */
function buildChainDynamicsPrompt(p0Output, chainBehaviorData, p0_7TimeWindowConstraints = null, context = {}) {
  const p0_7ConstraintsText = p0_7TimeWindowConstraints ? `
## ⚠️ P0.7 時間窗口約束（請關注以下重點）

P0.7 系統動力學分析結果：
- **Cycle Position**: ${p0_7TimeWindowConstraints.cycle_position || "N/A"}
- **Turning Point Risk**: ${p0_7TimeWindowConstraints.turning_point_risk || "N/A"}
- **Dominant Loops**: ${p0_7TimeWindowConstraints.dominant_loops?.join(", ") || "N/A"}
- **Key Delays**: ${p0_7TimeWindowConstraints.key_delays?.map(d => `${d.name} (${d.expected_months} months)`).join(", ") || "N/A"}
- **Watch List**: ${p0_7TimeWindowConstraints.watch_list?.join(", ") || "N/A"}

**請根據以上約束，重點關注以下訊號**：
${p0_7TimeWindowConstraints.watch_list?.map(item => `- ${item}`).join("\n") || "- 常規監控"}

` : "";

  return `
## 🗺️ P0.5 Mode 2：產業鏈動態監控（Chain Dynamics Monitor）

**你的角色**：產業鏈感測器

**你的任務**：觀察上中下游彼此的真實行為是否一致，偵測產業當下狀態與異常訊號

**核心哲學**：與其試圖用財務模型猜產業，不如直接觀察上中下游彼此的真實行為是否一致。

---

## ⚠️ 重要：職權邊界

**✅ 你可以做**：
- 監控上中下游行為一致性
- 識別異常狀態與轉折風險
- 提供證據包給下游模組
- 描述產業鏈當前狀態

**❌ 絕對禁止**：
- ❌ 不下投資結論（這是後續模組的職責）
- ❌ **不做時間定位裁決（禁止輸出 Early/Mid/Late，這是 P0.7 的職責）**
- ❌ 不進行長期前瞻敘事（這是 P0 的職責）
- ❌ 不判斷產業是否值得投資（這是 P0 的職責）

**P0.5 只做偵測與推演，不做時間定位裁決**

${p0_7ConstraintsText}
---

## 📥 輸入數據

### P0 的分析結果

以下是 P0 選出的潛力產業面與關鍵節點：

${JSON.stringify(p0Output, null, 2)}

### 產業鏈行為數據（來自 P1 公司池和 P2 財務數據）

**上游信號**：
${JSON.stringify(chainBehaviorData.upstream_signals || {}, null, 2)}

**中游信號**：
${JSON.stringify(chainBehaviorData.midstream_signals || {}, null, 2)}

**下游信號**：
${JSON.stringify(chainBehaviorData.downstream_signals || {}, null, 2)}

---

## 🎯 三階段推理流程（必須按照順序完成）

### **Step 1: 產業生態識別**（Mandatory，必須先完成）

**請先回答以下問題**：

1. **該產業的核心驅動是什麼？**
   - CapEx？
   - R&D？
   - 政策？
   - 庫存？
   - 訂單能見度？
   - 其他？

2. **財報數據相對於真實需求的「時間延遲」大約多久？**
   - 短期（1-3 個月）
   - 中期（3-6 個月）
   - 長期（6-12 個月）
   - 超長期（12 個月以上）

3. **哪一段（上/中/下游）最早反映真實變化？**
   - 上游（CapEx、訂單先行）
   - 中游（出貨、產能反映）
   - 下游（終端需求）

**⚠️ 此步驟的輸出是「分析方法的前提」，不是結論。**

### **Step 2: 上中下游行為抽象**（已由程式提供標準化數據）

**程式已提供標準化數據**（見上方的「產業鏈行為數據」），請直接使用。

**⚠️ 不要重新計算或判斷，直接使用提供的數據。**

### **Step 3: 一致性與異常推演**（AI 責任）

**請依據 Step 1 定義的產業生態，自行建立最合理的判斷模型**，解釋目前上中下游行為是否：

1. **高度一致**：所有段都在同一個方向（擴張/收縮/穩定）

2. **正常延遲**：上下游有時間差，但符合產業特性

3. **結構性背離**：上下游明顯不同步，可能代表轉折

4. **非典型但可解釋**：看似異常但有其原因（例如世代交替）

**若出現背離，必須提出至少 2-3 種可能解釋**，並標示「需要進一步監控」或「已具轉折風險」。

**⚠️ 禁止事項**：
- ❌ 不寫死情境清單（Case A/B/C）
- ❌ 不寫死產業生態清單（製造/軟體/能源）
- ❌ 不宣告「已到 Late」或「轉折點在 X 月後」（這是 P0.7 的職責）

---

## 📤 輸出格式（必須是 JSON，4 區結構）

**⚠️ 重要：輸出必須完全符合以下格式，欄位不可增刪。**

請按照以下 JSON 格式輸出：

{
  "meta": {
    "version": "0.1",
    "as_of": "${new Date().toISOString().split('T')[0]}",
    "cadence": "MONTHLY" | "QUARTERLY",
    "industry_id": "從 P0 獲取",
    "universe_scope": {
      "us": true | false,
      "tw": true | false,
      "jp": true | false
    },
    "coverage_level": "TW_MONTHLY_US_QUARTERLY" | "US_QUARTERLY_ONLY" | "TW_QUARTERLY_ONLY"
  },
  "signals": [
    {
      "signal_id": "S1",
      "signal_name": "demand_pull_downstream",
      "value": 75,
      "direction": "UP" | "DOWN" | "FLAT" | "DIVERGE",
      "strength": 0-100,
      "window": "1M" | "3M" | "6M",
      "evidence": {
        "source": "P2_Output",
        "tickers": ["AAPL", "MSFT"],
        "metric": "Revenue_YoY",
        "notes": "下游需求拉動（出貨/營收動能）",
        "available": true | false
      }
    },
    {
      "signal_id": "S2",
      "signal_name": "capacity_build_upstream",
      "value": 80,
      "direction": "UP" | "DOWN" | "FLAT" | "DIVERGE",
      "strength": 0-100,
      "window": "1M" | "3M" | "6M",
      "evidence": {
        "source": "P2_Output",
        "tickers": ["TSMC", "ASML"],
        "metric": "Revenue_YoY + FCF",
        "notes": "上游擴產/CapEx 動能（台股月營收 + 季報 CapEx proxy）",
        "available": true | false
      }
    }
    // ... 其他 6 個核心信號：
    // S3: inventory_pressure_midstream
    // S4: pricing_power_node
    // S5: order_visibility
    // S6: substitution_pressure
    // S7: capex_mismatch_divergence（⭐ 王牌）
    // S8: credit_stress_chain
  ],
  "diagnosis": {
    "current_chain_state": "ACCELERATING" | "HEALTHY_EXPANSION" | "LATE_TIGHTENING" | "INVENTORY_BUILD" | "DEMAND_SOFTENING" | "MIXED_SIGNALS" | "UNKNOWN",
    "state_confidence": "HIGH" | "MEDIUM" | "LOW",
    "state_rationale": "<= 120字（只允許引用 signals，不得引入外部敘事）",
    "industry_ecology_profile": "AI 針對該產業生態自動產出（如：長周期資本密集型 / 平台型 / 政策驅動型）",
    "anomalies": [
      {
        "pattern_id": "ANOMALY_001",
        "description": "上游CapEx放緩但中游仍擴張",
        "likely_explanations": [
          "新一代產品正在準備（世代交替）",
          "預期未來缺料，提前備庫存",
          "長約產業反應延遲"
        ],
        "what_to_watch_next": [
          "下季上游CapEx是否持續放緩",
          "中游庫存是否開始累積",
          "訂單能見度是否下降"
        ]
      }
    ]
  },
  "handoff": {
    "p0_7_evidence_pack": {
      "demand_trend": {"direction": "UP" | "DOWN" | "FLAT", "strength": 0-100},
      "capex_trend": {"direction": "UP" | "DOWN" | "FLAT", "strength": 0-100},
      "inventory_proxy": {"direction": "BUILD" | "DRAW" | "FLAT", "strength": 0-100},
      "pricing_tightness": {"direction": "TIGHT" | "LOOSENING" | "STABLE", "strength": 0-100},
      "divergence_flags": ["UPSTREAM_DOWNSTREAM_MISMATCH", "INVENTORY_ACCUMULATION", ...],
      "notes": "短（不推論、只給證據）"
    },
    "p1_inputs": {
      "nodes_to_prioritize": ["UPSTREAM_001", "MIDSTREAM_001"],
      "nodes_to_watch_victims": ["DOWNSTREAM_001"],
      "risk_flags": ["STRUCTURAL_WEAKENING", "SUBSTITUTION_ACCELERATING"]
    },
    "p2_inputs": {
      "capex_verification_priority": ["TSMC", "ASML"],
      "rpo_tracking_priority": ["NVDA", "AMD"],
      "executability_focus": "CapEx是否真的在動、RPO是否上升"
    },
    "p5_weekly_flags": {
      "LATE_CYCLE_RISK": false,
      "DIVERGENCE_ALERT": false,
      "INVENTORY_BUILD_WARNING": false,
      "PRICING_LOOSENING": false,
      "SUBSTITUTION_ACCELERATING": false
    }
  }
}

---

## ⚠️ 輸出要求

1. **8 個核心信號必須全部生成**：
   - \`demand_pull_downstream\`：下游需求拉動
   - \`capacity_build_upstream\`：上游擴產/CapEx 動能（⭐ 台股月營收 + 季報 CapEx proxy）
   - \`inventory_pressure_midstream\`：中游庫存/交期壓力
   - \`pricing_power_node\`：瓶頸節點是否仍有訂價權
   - \`order_visibility\`：訂單能見度（RPO/合約負債/Backlog proxy，有就用，沒有就標 available=false）
   - \`substitution_pressure\`：替代/被替代壓力
   - \`capex_mismatch_divergence\`：⭐ **上游 vs 下游不同步異常偵測（王牌）**
   - \`credit_stress_chain\`：產業鏈信用壓力（應收帳款天數/現金流緊縮 proxy，有就用）

2. **診斷必須在固定框架內輸出**（7 種狀態之一）：
   - 只允許引用 signals，不得引入外部敘事（\`state_rationale\` 限制 120 字）
   - 禁止宣告「已到 Late」或「轉折點在 X 月後」（這是 P0.7 的職責）

3. **handoff 必須可程式化**：
   - \`p0_7_evidence_pack\`：給 P0.7 的證據包（不推論、只給證據）
   - \`p1_inputs\`：給 P1 的節點優先級和風險標記
   - \`p2_inputs\`：給 P2 的驗證重點
   - \`p5_weekly_flags\`：給 P5 Weekly 的風控旗標

4. **保持客觀描述**：
   - 使用事實性描述，避免主觀判斷
   - 每個信號都必須附上證據（source, tickers, metric, notes）
   - 信號值必須可追溯、可驗證

---

## ⚠️ 重要：輸出格式要求（節省 Token 成本）

- ❌ **禁止任何客套話、開場白、結尾語**（例如：「你問得非常好...」、「如果你需要的話，我可以幫你...」等）
- ❌ **禁止任何與工作無關的說明文字**
- ✅ **只輸出純 JSON 格式**，直接開始 JSON 對象，不要有任何前綴或後綴
- ✅ **API 版本必須嚴格遵守此要求**，與網頁版不同，API 版本不應包含任何額外的禮貌性文字
- ✅ **節省 Token = 節省成本**，每多一個無用的 token 都會增加成本
`;
}

/**
 * 獲取 M0 Job 結果 ⭐ V8.17.1 新增：用於測試模式輪詢
 * @param {string} jobId - Job ID
 * @return {Object|null} M0 Job 結果，如果沒有則返回 null
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
    Logger.log(`P0.5：獲取 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}
