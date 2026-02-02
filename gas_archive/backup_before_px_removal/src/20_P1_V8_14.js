/**
 * ⭐ V8.14 新增：P1 兩階段執行模組
 * 
 * 實作 P1 兩階段執行：
 * - Step 1：股票池生成（Gemini Flash 3.0）
 * - Step 2：結構分級（Gemini Pro 3.0）
 * 
 * @version V8.14
 * @date 2026-01-19
 */

// ==========================================
// P1 Step 1：股票池生成（Gemini Flash 3.0）
// ==========================================

/**
 * 構建 P1 Step 1 Prompt（股票池生成）
 * @param {Object} userInput - 用戶輸入
 * @param {Object} p0Output - P0 輸出
 * @param {Object} p0_5Output - P0.5 輸出（產業鏈地圖）
 * @param {Object} p0_7Output - P0.7 輸出
 * @return {string} Prompt 內容
 */
function buildP1Step1Prompt(userInput, p0Output, p0_5Output, p0_7Output) {
  const isTestMode = (userInput && userInput.test_mode === true) || 
                     (userInput && userInput.context && userInput.context.test_mode === true);
  
  return `
## 🎯 P1 Company Pool Selection — Structural Alpha Only ⭐ V8.17.1 強化版

**你的角色**：資料蒐集員（使用 Gemini Flash 3.0）

**你的任務**：**NOT** 列出主題的所有相關公司。

**你的任務**：識別**僅**直接體現 P0 識別的**結構性必然性（Structural Inevitability）**的公司。

---

## ⭐ V8.17.1 新增：Gate Clause（核心補強）

**⚠️ 強制要求：你必須 ONLY 選擇映射到 P0.5 節點中明確標記為 INVESTABLE_CHOKEPOINT 的公司。**

**如果一家公司僅僅是：**
- downstream adopter（下游採用者）
- adjacent beneficiary（相鄰受益者）
- generic infrastructure（通用基礎設施）

**則必須 EXCLUDE，除非物理利潤連結是強制性的。**

**錯殺保護（不確定時的處理方式）**：

**If uncertain, prefer EXCLUDE over INCLUDE, but explicitly list up to 3 borderline candidates with justification.**

- ✅ **如果不確定，優先排除**
- ✅ **但明確列出最多 3 個邊界候選，並提供理由**
- ✅ **這會讓主池子乾淨，又不會錯殺（有 Borderline List）**

---

### 1️⃣ Single Source of Truth (SSOT) — 唯一權威來源

你**必須**將 P0 分析視為主題的**唯一權威定義**。

- ❌ **不要擴展主題**
- ❌ **不要泛化產業**
- ❌ **不要僅僅因為公司「相關」、「暴露」或「受益」就納入**

如果一家公司**不能直接映射到 P0 定義的結構性角色**，它必須被排除。

---

### 2️⃣ 符合條件的公司標準（**全部必須滿足**）

一家公司**只有在滿足以下至少一個由 P0 定義的結構性角色時**，才能被納入 P1 池：

#### A. 結構性瓶頸（Structural Bottleneck）
- 控制產業無法繞過的流程、資產、技術或產能
- 如果這個節點受限，整個產業都會受限

#### B. 定價權 / 價值捕獲節點（Pricing Power / Value Capture Node）
- 具有決定定價、利潤率或經濟租金的結構性能力
- 當主題成長時，捕獲不成比例的價值份額

#### C. 結構性依賴錨點（Structural Dependency Anchor）
- 產業的成功在機制上依賴於這個節點
- 主題的營收成長**無法發生**，除非這家公司參與

---

### 3️⃣ 供應鏈包含規則（**嚴格**）

你**只有在以下情況下**才能包含上游或下游公司：

- 依賴關係是**高度耦合且確定性的**，不是可選的
- 如果公司 A 成長，公司 B 的營收**必須**作為直接機制性後果而成長
- 這種關係在短期到中期內**不可替代**

✅ **允許包含的範例**：
- NVDA → TSMC → ASML  
  （緊密耦合，產能和技術瓶頸）

❌ **禁止包含的範例**：
- 「AI 軟體」、「雲端」、「IT 服務」、「通用硬體」
- 僅僅因為需求或支出增加而受益的公司
- 沒有瓶頸或定價控制權的外圍推動者

---

### 4️⃣ 明確排除規則（**強制**）

你**必須排除**以下公司：
- 通用供應商
- 廣泛的服務提供商
- 邊緣受益者
- 「可有可無」的參與者
- 沒有結構性必要性的主題敘事符合者

如果包含是**有爭議的**，**排除它**。

這個池的設計是**精確的，而非詳盡的**。

---

### 5️⃣ 市場限制（**強制**）⭐ V8.17.1 新增

你**只能**包含以下市場的公司：
- **US**（美股）：60% 比例
- **JP**（日股）：30% 比例
- **TW**（台股）：20% 比例

**嚴格禁止**包含以下市場的公司：
- ❌ GB（英國）
- ❌ FR（法國）
- ❌ EU（歐盟）
- ❌ 其他任何非 US/JP/TW 的市場

**市場比例建議**：
- 如果總共 10 檔公司：6 檔美股、3 檔日股、2 檔台股
- 如果總共 20 檔公司：12 檔美股、6 檔日股、2 檔台股
- 如果總共 30 檔公司：18 檔美股、9 檔日股、3 檔台股

**注意**：如果某個市場沒有符合條件的公司，可以調整比例，但**絕對不能**包含非 US/JP/TW 市場的公司。

---

### 5️⃣ 輸出要求

對於每個包含的公司，你**必須明確說明**：
- 它滿足哪個 P0 結構性角色（A / B / C）
- 依賴或價值捕獲的確切機制
- 一句話的合理性說明，直接連結回 P0 結論

如果你**無法明確映射到 P0**，**不要包含它**。

---

## ⚠️ 重要：職權邊界（嚴格限制）

**✅ 你可以做**：
- 根據 P0/P0.5/P0.7 的「關鍵節點」找出符合條件的公司（上游/中游/下游/互補性產業/受害性產業）
- 產出 **5-15 檔公司清單**（美:台:日 = 5:3:2，建議比例，無法達成沒關係）
- 提供公司基本資訊（ticker, company_name, market）
- **判斷是否符合「關鍵節點」、「定價控制」、「必然瓶頸掌握」、「不可取代」的標準**

**❌ 絕對禁止**：
- ❌ **進行任何分析**（財務分析、估值分析、技術分析）
- ❌ **判斷產業鏈位置**（這是 Step 2 的職責）
- ❌ **獵殺舊技術龍頭**（這是 Step 2 的職責）
- ❌ **讀取財報**（財報將由系統自動下載後統一處理）
- ❌ **改寫 P0 主敘事或加入新宏觀論述**
- ❌ **把所有相關公司都納入**（只選擇關鍵節點）

**P1 Step 1 僅做資料蒐集，但必須聚焦於關鍵節點，不做任何分析或判斷**

---

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## 📥 輸入：P0/P0.5/P0.7 的分析結果

### P0 輸出（必然位置表）
${JSON.stringify(p0Output, null, 2)}

### P0.5 輸出（產業鏈地圖）
${JSON.stringify(p0_5Output, null, 2)}

### P0.7 輸出（系統動力學分析）
${JSON.stringify(p0_7Output, null, 2)}

---

## 🎯 你的分析任務

### **任務 1：股票池生成（聚焦關鍵節點，而非全面撒網）** ⭐ V8.17.1 更新

**⚠️ 核心原則：聚焦 P0 分析的「關鍵節點」，而非所有相關公司**

P1 的公司池應該**主要聚焦撈出符合 P0 分析的「關鍵節點」、「定價控制」、「必然瓶頸掌握」、「不可取代」**的主題產業，而不是撈該主題的所有相關公司。

**❌ 錯誤做法**：
- 把所有跟 AI 有關的硬體、軟體、雲端...全部都叫做"AI"主題
- 因為主題太籠統就把所有相關公司都納入
- 沒有判斷公司在產業鏈中的關鍵性就全部抓進來

**✅ 正確做法**：
- 只選擇符合 P0 分析的「關鍵節點」、「定價控制」、「必然瓶頸掌握」、「不可取代」的公司
- 只有當 AI 判斷其產業鏈有**高度依存性**時，才一併抓進公司池
- 例如：AI 晶片商 NVDA → 上游晶圓廠 TSM → 再上游 ASML，業務屬同一產業鏈高度依存，可納入同一主題

---

### 6️⃣ 目標池大小指引（軟約束）

- 典型池大小應該是**每個主題 10-40 家公司**
- 如果你超過 50 家公司，你很可能違反了結構性聚焦規則

**市場比例建議**：美:日:台 = 6:3:2（60% 美股、30% 日股、20% 台股，無法達成沒關係）

**⚠️ 市場限制（強制）**：**只能**包含 US（美股）、JP（日股）、TW（台股）市場的公司。**嚴格禁止**包含 GB（英國）、FR（法國）、EU（歐盟）或其他任何非 US/JP/TW 市場的公司。

**⚠️ 記住**：這個池的設計是**精確的，而非詳盡的**。寧可少選，不可多選。

**注意**：
- 你只需要提供公司清單，不需要讀取財報
- 財報將由系統自動下載後統一處理
- 你不需要判斷公司在產業鏈的位置（這是 Step 2 的職責）
- **但必須判斷公司是否符合「關鍵節點」、「定價控制」、「必然瓶頸掌握」、「不可取代」的標準**
- **寧可少選，不可多選**：只選擇真正符合標準的公司

---

## 📤 輸出格式

請按照以下 JSON 格式輸出：

{
  "company_pool": [
    {
      "ticker": "NVDA",
      "company_name": "NVIDIA Corporation",
      "market": "US",
      "theme_id": "THEME_001",
      "subtheme_id": "SUBTHEME_001",
      "structural_role": "B",  // ⭐ V8.17.1 新增：A=結構性瓶頸, B=定價權/價值捕獲, C=結構性依賴錨點
      "p0_mapping": "P0 識別為 AI 加速器的定價控制節點",  // ⭐ V8.17.1 新增：直接映射到 P0 結論
      "dependency_mechanism": "AI 訓練和推理的計算需求直接依賴於 NVDA 的 GPU 架構和產能",  // ⭐ V8.17.1 新增：依賴機制
      "justification": "P0 分析指出 AI 產業的成長在機制上依賴於高性能 GPU 的供應，NVDA 控制定價和技術標準",  // ⭐ V8.17.1 新增：合理性說明
      "potential_categories": ["Midstream"],  // 僅供參考，最終由 Step 2 判斷
      "notes": "符合結構性角色 B（定價權/價值捕獲節點）"
    }
  ],
  "summary": {
    "total_companies": 15,
    "us_companies": 8,
    "tw_companies": 5,
    "jp_companies": 2,
    "structural_roles_breakdown": {
      "A_structural_bottleneck": 5,
      "B_pricing_power": 7,
      "C_dependency_anchor": 3
    }
  }
}

---

## ⚠️ 輸出要求

1. **必須完全來自系統內已完成的 P0/P0.5/P0.7**：
   - 不可以重作新產業分析
   - 不可以網路搜尋「非官方」資料
   - 只可以根據 P0/P0.5/P0.7 的結論找出相關公司

2. **結構性聚焦原則（Structural Focus）** ⭐ V8.17.1 強化版：
   - **只選擇直接體現 P0 識別的「結構性必然性」的公司**
   - **必須滿足至少一個結構性角色**：A（結構性瓶頸）、B（定價權/價值捕獲）、C（結構性依賴錨點）
   - **供應鏈包含規則嚴格**：只有高度耦合且確定性的依賴關係才納入
   - **明確排除規則**：排除通用供應商、廣泛服務提供商、邊緣受益者、可有可無的參與者
   - **如果包含有爭議，排除它**：這個池的設計是精確的，而非詳盡的
   - **典型池大小**：每個主題 10-40 家公司（如果超過 50 家，很可能違反結構性聚焦規則）

3. **輸出格式要求** ⭐ V8.17.1 強化版：
   - **必須明確說明**：每個公司滿足哪個 P0 結構性角色（A / B / C）
   - **必須明確說明**：依賴或價值捕獲的確切機制
   - **必須明確說明**：一句話的合理性說明，直接連結回 P0 結論
   - **如果無法明確映射到 P0，不要包含它**

4. **僅做資料蒐集，不做分析**：
   - 不需要判斷公司在產業鏈的位置（這是 Step 2 的職責）
   - 不需要獵殺舊技術龍頭（這是 Step 2 的職責）
   - 不需要讀取財報（財報將由系統自動下載後統一處理）
   - **但必須判斷公司是否符合結構性角色標準（A/B/C）**

5. **保持客觀描述**：
   - 使用事實性描述，避免主觀判斷
   - 提供公司基本資訊（ticker, company_name, market）
   - 在 structural_role、p0_mapping、dependency_mechanism、justification 欄位中明確說明結構性角色和合理性
`;
}

/**
 * 處理 P1 Step 1 結果
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @return {Object} Step 1 處理結果
 */
function P1_ProcessStep1Result(jobId, m0Result, params) {
  try {
    Logger.log(`P1 V8.14：處理 Step 1 結果，jobId=${jobId}`);
    // ⭐ V8.17.1 修正：確保 params 有默認值
    params = params || {};
    Logger.log(`P1 V8.14：m0Result 類型=${typeof m0Result}, 鍵=${m0Result ? Object.keys(m0Result).slice(0, 10).join(", ") : "null"}`);
    
    // ⭐ V8.17.1 修正：從 m0Result.output 中提取 executor_output（類似 P0.5 的處理）
    // 首先處理 m0Result.output，它可能是字符串或對象
    let finalOutput = m0Result.output || {};
    if (typeof finalOutput === 'string') {
      try {
        finalOutput = JSON.parse(finalOutput);
        Logger.log(`P1 V8.14：成功解析 m0Result.output 字符串為對象`);
      } catch (e) {
        Logger.log(`P1 V8.14：無法解析 m0Result.output 字符串：${e.message}，嘗試直接使用`);
        // 如果無法解析，可能是因為 output 本身就是一個 JSON 字符串，需要再次解析
        try {
          const parsed = JSON.parse(finalOutput);
          if (typeof parsed === 'string') {
            // 雙重字符串化，再次解析
            finalOutput = JSON.parse(parsed);
          } else {
            finalOutput = parsed;
          }
          Logger.log(`P1 V8.14：成功解析雙重字符串化的 m0Result.output`);
        } catch (e2) {
          Logger.log(`P1 V8.14：無法解析雙重字符串化的 m0Result.output：${e2.message}`);
          finalOutput = {};
        }
      }
    }
    
    // 提取 executor_output（P1_STEP1 沒有 AUDITOR，所以 final_output 直接是 executor_output）
    // ⭐ V8.17.4 修正：支持多種格式，確保向後兼容
    let executorOutput = finalOutput.executor_output || finalOutput.output || finalOutput.executor || finalOutput || m0Result.executor_output || m0Result.output || {};
    
    // ⭐ V8.17.4 新增：如果 executorOutput 為空對象，嘗試使用 finalOutput 本身（向後兼容舊格式）
    if (!executorOutput || (typeof executorOutput === 'object' && Object.keys(executorOutput).length === 0 && finalOutput && Object.keys(finalOutput).length > 0)) {
      // 如果 finalOutput 有 company_pool 等欄位，說明它是舊格式（直接是 executor_output）
      if (finalOutput.company_pool || finalOutput.themes || finalOutput.tiered_companies) {
        executorOutput = finalOutput;
        Logger.log(`P1 V8.14：檢測到舊格式，使用 finalOutput 作為 executorOutput`);
      }
    }
    
    Logger.log(`P1 V8.14：executorOutput 類型=${typeof executorOutput}, 鍵=${executorOutput ? Object.keys(executorOutput).slice(0, 10).join(", ") : "null"}`);
    
    // 解析輸出
    let step1Output = {};
    if (typeof executorOutput === 'string') {
      try {
        let jsonString = executorOutput.trim();
        // 移除 markdown 代碼塊
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        // 嘗試找到第一個 { 到最後一個 } 之間的內容（處理可能的額外文本）
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
        step1Output = JSON.parse(jsonString);
        Logger.log(`P1 V8.14：成功解析 Step 1 executorOutput 字符串為 JSON 對象`);
      } catch (e) {
        Logger.log(`P1 V8.14：無法解析 Step 1 executorOutput：${e.message}`);
        Logger.log(`P1 V8.14：executorOutput 前 500 字符：${executorOutput.substring(0, 500)}`);
        // 嘗試更寬鬆的解析
        try {
          // 如果包含未轉義的換行符，嘗試修復
          let fixedJson = executorOutput.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
          step1Output = JSON.parse(fixedJson);
          Logger.log(`P1 V8.14：使用修復後的 JSON 字符串成功解析`);
        } catch (e2) {
          Logger.log(`P1 V8.14：修復後仍無法解析：${e2.message}`);
          throw new Error(`無法解析 Step 1 executorOutput：${e.message}`);
        }
      }
    } else {
      step1Output = executorOutput;
    }
    
    // 驗證公司池結構
    if (!step1Output.company_pool || !Array.isArray(step1Output.company_pool)) {
      throw new Error("Step 1 輸出缺少 company_pool 欄位或格式不正確");
    }
    
    Logger.log(`P1 V8.14：Step 1 生成 ${step1Output.company_pool.length} 檔公司`);
    
    // ⭐ V8.17.1 新增：過濾市場（只保留 US/JP/TW）
    const allowedMarkets = ["US", "JP", "TW"];
    const marketFilteredPool = step1Output.company_pool.filter(company => {
      const market = (company.market || "").toUpperCase();
      return allowedMarkets.includes(market);
    });
    
    if (marketFilteredPool.length < step1Output.company_pool.length) {
      const removedCount = step1Output.company_pool.length - marketFilteredPool.length;
      const removedMarkets = [...new Set(step1Output.company_pool
        .filter(c => !allowedMarkets.includes((c.market || "").toUpperCase()))
        .map(c => c.market))];
      Logger.log(`P1 V8.17.1：已移除 ${removedCount} 檔非 US/JP/TW 市場的公司（市場：${removedMarkets.join(", ")}）`);
    }
    
    Logger.log(`P1 V8.17.1：市場過濾後剩餘 ${marketFilteredPool.length} 檔公司`);
    
    // ⭐ V8.17.1 新增：公司池縮限機制（如果超過 200 檔）
    let filteredCompanyPool = marketFilteredPool;
    if (filteredCompanyPool.length > 200) {
      Logger.log(`P1 V8.17.1：公司池超過 200 檔（${filteredCompanyPool.length}），開始縮限`);
      filteredCompanyPool = filterCompanyPoolByPriority(filteredCompanyPool, step1Output.summary);
      Logger.log(`P1 V8.17.1：縮限後剩餘 ${filteredCompanyPool.length} 檔公司`);
    }
    
    // ⭐ 新增：財報下載階段
    Logger.log(`P1 V8.14：開始財報下載階段`);
    const financialReportStatus = P1_FetchFinancialReports(filteredCompanyPool, jobId);
    
    // ⭐ V8.17.1 新增：保存 Step 1 數據到 Phase1_Company_Pool 和 P1__SNAPSHOT
    Logger.log(`P1 V8.17.1：開始保存 Step 1 數據`);
    const step1PoolResults = saveStep1CompanyPoolToSheet(filteredCompanyPool, jobId);
    const step1Snapshot = saveP1Step1Snapshot({
      job_id: jobId,
      trigger: params?.trigger || "QUARTERLY",
      company_pool: filteredCompanyPool,
      summary: step1Output.summary || {},
      financial_report_status: financialReportStatus,
      pool_results: step1PoolResults,
      p0_snapshot_id: params?.p0_snapshot_id || null,
      p0_5_snapshot_id: params?.p0_5_snapshot_id || null,
      p0_7_snapshot_id: params?.p0_7_snapshot_id || null
    });
    
    Logger.log(`P1 V8.17.1：Step 1 數據已保存，snapshot_id=${step1Snapshot.snapshot_id}`);
    
    return {
      status: "COMPLETED",
      job_id: jobId,
      snapshot_id: step1Snapshot.snapshot_id,
      company_pool: filteredCompanyPool,
      summary: step1Output.summary || {},
      financial_report_status: financialReportStatus,
      pool_results: step1PoolResults
    };
    
  } catch (error) {
    Logger.log(`P1 V8.14：處理 Step 1 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// P1 Step 2：結構分級（Gemini Pro 3.0）
// ==========================================

/**
 * 執行 P1 Step 2（結構分級）
 * @param {Object} step1Result - Step 1 處理結果
 * @param {Object} params - 原始執行參數
 * @return {Object} Step 2 執行結果
 */
function P1_ExecuteStep2(step1Result, params) {
  try {
    Logger.log(`P1 V8.14：開始執行 Step 2（結構分級）`);
    
    // 1. 讀取 P0/P0.5/P0.7 輸出（從 params 獲取，如果沒有則從快照讀取）
    let p0Output, p0_5Output, p0_7Output;
    let p0Snapshot, p0_5Snapshot, p0_7Snapshot;
    
    if (params.p0_output && params.p0_5_output && params.p0_7_output) {
      // 直接使用 params 中的輸出（避免重複讀取）
      p0Output = params.p0_output;
      p0_5Output = params.p0_5_output;
      p0_7Output = params.p0_7_output;
      
      // 如果 params 中有 snapshot_id，也保存起來
      if (params.p0_snapshot_id) {
        p0Snapshot = { snapshot_id: params.p0_snapshot_id };
      }
      if (params.p0_5_snapshot_id) {
        p0_5Snapshot = { snapshot_id: params.p0_5_snapshot_id };
      }
      if (params.p0_7_snapshot_id) {
        p0_7Snapshot = { snapshot_id: params.p0_7_snapshot_id };
      }
    } else {
      // 從快照讀取
      p0Snapshot = getP0SnapshotById(params.p0_snapshot_id);
      p0_5Snapshot = getP0_5SnapshotById(params.p0_5_snapshot_id);
      p0_7Snapshot = getP0_7SnapshotById(params.p0_7_snapshot_id);
      
      if (!p0Snapshot || !p0Snapshot.p0_output_json) {
        throw new Error("P0 快照不存在或缺少數據");
      }
      if (!p0_5Snapshot || !p0_5Snapshot.p0_5_output_json) {
        throw new Error("P0.5 快照不存在或缺少數據");
      }
      if (!p0_7Snapshot || !p0_7Snapshot.p0_7_output_json) {
        throw new Error("P0.7 快照不存在或缺少數據");
      }
      
      p0Output = typeof p0Snapshot.p0_output_json === 'string' ?
        JSON.parse(p0Snapshot.p0_output_json) : p0Snapshot.p0_output_json;
      p0_5Output = typeof p0_5Snapshot.p0_5_output_json === 'string' ?
        JSON.parse(p0_5Snapshot.p0_5_output_json) : p0_5Snapshot.p0_5_output_json;
      p0_7Output = typeof p0_7Snapshot.p0_7_output_json === 'string' ?
        JSON.parse(p0_7Snapshot.p0_7_output_json) : p0_7Snapshot.p0_7_output_json;
    }
    
    // 2. 讀取 Flash 提取的財報資料（從表格中讀取）
    const financialReportData = loadFinancialReportExtractions(step1Result.company_pool);
    
    // 3. 構建 Step 2 Prompt（包含 Flash 提取的資料）
    const step2Prompt = buildP1Step2Prompt(step1Result.company_pool, financialReportData, p0Output, p0_5Output, p0_7Output);
    
    // 3. 準備 M0 Job 輸入
    const m0InputPayload_Step2 = {
      phase: "P1_STEP2",
      trigger: params.trigger || "QUARTERLY",
      step1_result: step1Result,
      company_pool: step1Result.company_pool,
      financial_report_data: financialReportData,  // ⭐ V8.14 新增：傳遞 Flash 提取的財報資料給審查者
      p0_output: p0Output,
      p0_5_output: p0_5Output,
      p0_7_output: p0_7Output,
      p0_snapshot_id: p0Snapshot ? p0Snapshot.snapshot_id : params.p0_snapshot_id || null,
      p0_5_snapshot_id: p0_5Snapshot ? p0_5Snapshot.snapshot_id : params.p0_5_snapshot_id || null,
      p0_7_snapshot_id: p0_7Snapshot ? p0_7Snapshot.snapshot_id : params.p0_7_snapshot_id || null,
      p1_step2_prompt: step2Prompt,
      context: params.context || {}
    };
    
    // 4. 提交到 M0 Job Queue
    const requestedFlow_Step2 = [
      "EXECUTOR",  // Gemini Pro 3.0（結構分級）
      "AUDITOR"    // GPT-5.2（審查）
    ];
    
    const jobId_Step2 = submitToM0JobQueue("P1_STEP2", requestedFlow_Step2, m0InputPayload_Step2);
    Logger.log(`P1 V8.14：已提交 Step 2（結構分級）到 M0 Job Queue，jobId=${jobId_Step2}`);
    
    // 5. 測試模式下自動執行
    if (params.context && params.context.test_mode === true) {
      Logger.log(`P1 V8.14：測試模式，自動執行 Step 2`);
      
      // 輪詢 Step 2 結果
      const maxWaitTime = 120000;
      const pollInterval = 2000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const m0Result_Step2 = getM0JobResult(jobId_Step2);
        
        if (m0Result_Step2 && m0Result_Step2.output) {
          Logger.log(`P1 V8.14：Step 2 執行完成`);
          
          // 處理 Step 2 結果
          return P1_ProcessStep2Result(jobId_Step2, m0Result_Step2, step1Result, params);
        }
        
        try {
          M0_Execute();
        } catch (e) {
          Logger.log(`P1 V8.14：調用 M0_Execute() 時發生錯誤：${e.message}`);
        }
        
        Utilities.sleep(pollInterval);
      }
      
      throw new Error("P1 Step 2 執行超時");
    }
    
    return {
      status: "SUBMITTED",
      job_id_step1: step1Result.job_id,
      job_id_step2: jobId_Step2,
      message: "P1 Step 2（結構分級）已提交到 M0，請執行 M0_Execute() 處理"
    };
    
  } catch (error) {
    Logger.log(`P1 V8.14：執行 Step 2 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 從表格讀取 Flash 提取的財報資料
 * @param {Array} companyPool - 公司池清單
 * @return {Object} 財報資料 { ticker: { p1_evidence, p2_evidence, p3_evidence } }
 */
function loadFinancialReportExtractions(companyPool) {
  const financialData = {};
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P1 V8.14：Phase1_Company_Pool 表格不存在或沒有數據`);
      return financialData;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const tickerCol = headers.indexOf("Company_Code");
    const marketCol = headers.indexOf("Market");
    const p1Col = headers.indexOf("P1_Industry_Evidence_JSON");
    const p2Col = headers.indexOf("P2_Financial_Evidence_JSON");
    const p3Col = headers.indexOf("P3_Technical_Evidence_JSON");
    
    if (tickerCol === -1 || marketCol === -1) {
      Logger.log(`P1 V8.14：找不到必要的欄位`);
      return financialData;
    }
    
    // 建立 ticker+market 的索引
    const companyMap = {};
    for (const company of companyPool) {
      const key = `${company.ticker}_${company.market}`;
      companyMap[key] = company;
    }
    
    // 讀取表格中的提取資料
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      const market = rows[i][marketCol];
      const key = `${ticker}_${market}`;
      
      if (companyMap[key]) {
        try {
          const p1Json = p1Col !== -1 && rows[i][p1Col] ? 
            (typeof rows[i][p1Col] === 'string' ? JSON.parse(rows[i][p1Col]) : rows[i][p1Col]) : [];
          const p2Json = p2Col !== -1 && rows[i][p2Col] ? 
            (typeof rows[i][p2Col] === 'string' ? JSON.parse(rows[i][p2Col]) : rows[i][p2Col]) : [];
          const p3Json = p3Col !== -1 && rows[i][p3Col] ? 
            (typeof rows[i][p3Col] === 'string' ? JSON.parse(rows[i][p3Col]) : rows[i][p3Col]) : [];
          
          financialData[key] = {
            p1_industry_evidence: p1Json,
            p2_financial_evidence: p2Json,
            p3_technical_evidence: p3Json
          };
        } catch (e) {
          Logger.log(`P1 V8.14：解析 ${ticker} (${market}) 的提取資料失敗：${e.message}`);
        }
      }
    }
    
    Logger.log(`P1 V8.14：已讀取 ${Object.keys(financialData).length} 檔公司的財報提取資料`);
    return financialData;
    
  } catch (error) {
    Logger.log(`P1 V8.14：讀取財報提取資料失敗：${error.message}`);
    return financialData;
  }
}

/**
 * 構建 P1 Step 2 Prompt（結構分級）
 * @param {Array} companyPool - Step 1 生成的公司池
 * @param {Object} financialReportData - Flash 提取的財報資料
 * @param {Object} p0Output - P0 輸出
 * @param {Object} p0_5Output - P0.5 輸出
 * @param {Object} p0_7Output - P0.7 輸出
 * @return {string} Prompt 內容
 */
function buildP1Step2Prompt(companyPool, financialReportData, p0Output, p0_5Output, p0_7Output) {
  return `
## 🏢 P1 Step 2：結構分級與產業鏈定位（Structural Tiering & Chain Positioning）

**你的角色**：結構分析師（使用 Gemini Pro 3.0）

**你的任務**：
1. 檢視 Step 1 的股票池和 Flash 提取的財報資料
2. 將公司排入產業鏈正確的上中下游/互補/替代位置
3. 剔除完全無關的公司並說明理由
4. 主動獵殺舊技術龍頭（標記為 Tier X）
5. 按 Tier S/A/B/X 進行結構分級
6. 分析受益/受害機制

---

## ⚠️ 重要：職權邊界

**✅ 你可以做**：
- 檢視 Step 1 的股票池和 Flash 提取的財報資料（P1_Industry_Evidence, P2_Financial_Evidence, P3_Technical_Evidence）
- **將公司排入產業鏈正確位置**（上中下游/互補/替代）
- **剔除完全無關的公司**並說明理由
- **主動獵殺舊技術龍頭**（根據 P0 的技術替代路徑，找出提供舊技術的主流公司，標記為 Tier X）
- 按 Tier S/A/B/X 進行結構分級
- 分析受益/受害機制
- 使用業務結構佔比（Revenue Exposure / Mix）判斷「純度」

**❌ 絕對禁止**：
- ❌ 使用財務績效數據（EPS/成長率/毛利率數字）作為分級依據
- ❌ 使用估值（P/E、FPE、PEG）作為證據
- ❌ 使用技術分析（均線、支撐壓力）作為證據
- ❌ 使用股價漲跌證明地位
- ❌ 改寫 P0 主敘事或加入新宏觀論述

**P1 Step 2 負責分析、定位、分級，不負責資料蒐集**

---

## 📥 輸入：Step 1 的股票池 + Flash 提取的財報資料

### Step 1 生成的公司池
${JSON.stringify(companyPool, null, 2)}

### Flash 提取的財報資料（P1/P2/P3 三欄位）
**注意**：以下資料是 Flash 從各公司最新三季財報中提取的原文段落，已按 P1/P2/P3 分類。

每個公司都有以下結構：
- \`p1_industry_evidence\`: 產業定位相關段落（Business Description, Revenue Mix, Supply Chain, Competition, R&D, Capacity）
- \`p2_financial_evidence\`: 財務相關段落（Profitability, Growth, Balance Sheet, Cash Flow, Guidance, Risk Factors）
- \`p3_technical_evidence\`: 股權結構相關段落（Shareholding, Dilution, Capital Actions, Dividends）

**你必須使用這些提取的資料進行分析，不得自行搜尋其他資料。**

**財報提取資料（按公司索引）**：
${Object.keys(financialReportData).length > 0 ? 
  Object.entries(financialReportData).map(([key, data]) => {
    const [ticker, market] = key.split('_');
    return `\n**${ticker} (${market})**：
- P1_Industry_Evidence: ${data.p1_industry_evidence?.length || 0} 筆段落
- P2_Financial_Evidence: ${data.p2_financial_evidence?.length || 0} 筆段落
- P3_Technical_Evidence: ${data.p3_technical_evidence?.length || 0} 筆段落
${JSON.stringify(data, null, 2)}`;
  }).join('\n\n') : 
  '**注意**：部分公司可能尚未完成財報提取，請根據可用的資料進行分析。'}

### P0 輸出（必然位置表）
${JSON.stringify(p0Output, null, 2)}

### P0.5 輸出（產業鏈地圖）
${JSON.stringify(p0_5Output, null, 2)}

### P0.7 輸出（系統動力學分析）
${JSON.stringify(p0_7Output, null, 2)}

---

## 🎯 你的分析任務

### **任務 1：產業鏈位置定位與篩選**

針對 Step 1 生成的每個公司：

1. **讀取 Flash 提取的 P1_Industry_Evidence**：
   - 根據 Business Description 和 Supply Chain Role，判斷公司在產業鏈的位置
   - 將公司排入正確的上中下游/互補/替代位置
   - 對應到 P0.5 產業鏈地圖的具體節點

2. **剔除完全無關的公司**：
   - 如果 Flash 提取的資料顯示公司與該產業完全無關，必須剔除
   - 必須說明剔除理由（例如：業務描述不符、無相關產品/服務）

3. **主動獵殺舊技術龍頭**：
   - 根據 P0 的技術替代路徑（例如光取代銅），**主動搜尋「目前提供舊技術的主流公司」**
   - 讀取 Flash 提取的資料，確認該公司是否主要提供舊技術
   - 將其標記為 Tier X 候選，並說明理由

### **任務 2：結構分級（Tier S/A/B/X）**

針對通過任務 1 篩選的公司，進行結構分級：

## ⚖️ 結構分級原則（Structure-First, Evidence-Weighted）⭐ V8.17 補丁

### 1. 中性起點（Neutral Start）
- 所有公司初始預設為 [Tier B]（結構觀察名單）。
- **禁止** 因「資料不足」、「公司較小」、「尚未獲利」而直接標記為 [Tier X]。

### 2. 分級依據（只看結構，不看財務好壞）
你在 P1 階段的任務 **不是判斷公司好不好**，而是回答：

> 「在這條產業鏈裡，它是被放大的，還是被擠壓的？」

請根據以下結構證據加權判斷：

- 是否位於關鍵瓶頸節點（Bottleneck / Chokepoint）
- 是否具備定價權或議價權提升的結構位置
- 是否受益於明確的需求拉動、擴產循環、或訂單能見度提升
- 是否面臨結構性替代、去中介化、或成本轉嫁失敗

### 3. 升級原則（Upside Recognition）
- 當「受益機制明確」且「放大效應存在」，可升級至：
  - [Tier A]：次核心放大者
  - [Tier S]：關鍵不可替代節點
- 即使資料不完整，只要**結構邏輯自洽**，允許升級。

### 4. 降級原則（Downside Protection）
- 僅在你能明確指出「結構性受害機制」時，才可標記為 [Tier X]。
- 必須回答：「它是**怎麼被擠壓的**？」而不是「我覺得它不行」。

### 5. 不確定性處理
- 若結構角色尚不明確，請保留在 [Tier B]，並說明「關鍵觀察點」。

🎯 為什麼這樣不會寫死 AI？

AI 仍然要思考結構

但不能因為「沒資料」偷懶直接丟 Tier X

---

#### **Tier S：核心瓶頸/不可取代（Kingmaker）**

定義：產業要噴，這家公司幾乎必吃最大肉，且難以被替代。

滿足以下至少 2 條（越多越 S）：
- **Choke Point**：位於 P0.5 產業鏈地圖的瓶頸節點（關鍵製程/材料/設備/標準）
- **Pricing Power**：具備訂價權（供需缺口時能主導價格或配額）
- **Low Substitutability**：替代成本高、驗證週期長（≥ 12–24 個月）
- **Structural Gatekeeper**：若缺貨，整條鏈會停擺或延遲
- **P0.7 對齊**：其受益機制在當前週期位置（Early/Mid/Late）仍成立

**注意**：S 可以是受益者，也可以是「危險節點」（例如 Late 時的泡沫核心），但若是風險核心需額外標記 risk_flag。

#### **Tier A：高連動受益/次核心（Contender）**

定義：高度吃到紅利，但有競爭者或可替代，或受制於上游。

滿足至少 1–2 條：
- **High Beta to Thesis**：需求成長會直接拉動訂單/出貨（但不掌控價格）
- **Competitive Field**：2–5 家競爭者，市占會輪動
- **Capacity Follower**：產能擴張受制於上游或設備交期
- **P0.7 Window-sensitive**：只有在某個窗口內（例如 Mid）最受益

#### **Tier B：順風受益/邊緣紅利（Beneficiary）**

定義：產業好它會跟漲，但不是決定性節點，利潤可能被上游/下游吃掉。

典型特徵：
- **Indirect Beneficiary**：需求外溢帶動（例如 DRAM 因 HBM 擠壓產能而漲）
- **Low Moat**：產品同質化，容易被比價
- **Margin Taker**：缺乏訂價權、毛利受擠壓（注意：這是結構描述，不是財務分析）
- **Narrative-driven**：較容易被題材帶動，但缺乏結構護城河

#### **Tier X：結構性受害者（Victim/Squeezed）**

定義：產業紅利來臨時，這類公司反而被擠壓、被替代、或被重新分配利潤。

至少符合 1 條：
- **Margin Squeeze**：上游漲價或下游砍價，利潤被壓縮
- **Demand Substitution**：替代節點成熟，需求被轉移
- **Capex Burden**：被迫投入大量資本，但回收期長且定價權不在自己
- **Regulatory/Policy Drag**：政策/法規導致成本上升或市場萎縮
- **P0.7 Failure Mode Exposure**：正好暴露於動力學的失敗模式（例如供給過剩時最先死）

**注意**：X 不是「垃圾公司」，而是「在本產業劇本下的受害者」。你必須主動獵殺的舊技術龍頭應該標記為 Tier X。

---

## 📤 輸出格式

請按照以下 JSON 格式輸出：

{
  "tiered_companies": [
    {
      "ticker": "AAPL",
      "company_name": "Apple Inc.",
      "market": "US",
      "theme_id": "THEME_001",
      "subtheme_id": "SUBTHEME_001",
      "supply_chain_position": "Upstream / Midstream / Downstream / Complementary / Victim",
      "p0_5_chain_map_node_id": "UPSTREAM_001",
      "is_relevant": true,
      "exclusion_reason": null,
      "is_old_tech_leader": false,
      "old_tech_leader_reason": null,
      "tier": "S / A / B / X",
      "tier_reason": "分級理由（必須基於結構性特徵，不可用財務數據）",
      "benefit_mechanism": "受益機制描述（Tier S/A/B 使用）",
      "detriment_mechanism": "受害機制描述（Tier X 使用）",
      "revenue_exposure": {
        "exposure_percentage": 85.5,
        "exposure_description": "AI 相關業務佔總營收 85.5%"
      },
      "confidence_level": 0.9,
      "evidence_sufficiency": "High / Medium / Low"
    },
    {
      "ticker": "IRRELEVANT_001",
      "company_name": "無關公司",
      "market": "US",
      "theme_id": "THEME_001",
      "subtheme_id": "SUBTHEME_001",
      "is_relevant": false,
      "exclusion_reason": "業務描述顯示該公司主要從事其他產業，與本主題無關",
      "tier": null
    }
  ],
  "summary": {
    "total_companies_from_step1": 25,
    "relevant_companies": 23,
    "excluded_companies": 2,
    "old_tech_leaders_found": 1,
    "tier_s_count": 3,
    "tier_a_count": 8,
    "tier_b_count": 12,
    "tier_x_count": 2
  }
}

---

## ⚠️ 輸出要求

1. **必須先進行產業鏈位置定位與篩選**：
   - 讀取 Flash 提取的 P1_Industry_Evidence，判斷公司在產業鏈的位置
   - 剔除完全無關的公司，說明剔除理由
   - 主動獵殺舊技術龍頭，標記為 Tier X

2. **分級依據必須是結構性特徵**：
   - ✅ 允許：Choke Point、Pricing Power、Substitutability、供應鏈位置、P0.7 週期風險
   - ✅ 允許：業務結構佔比（Revenue Exposure / Mix）判斷「純度」
   - ✅ 允許：使用 Flash 提取的 P1_Industry_Evidence 進行產業鏈定位
   - ❌ 禁止：EPS/成長率/毛利率數字、估值、技術分析、股價

3. **必須分析受益/受害機制**：
   - 每家公司至少 1 條機制描述
   - Tier S/A/B 使用 benefit_mechanism
   - Tier X 使用 detriment_mechanism

4. **必須使用 Flash 提取的資料**：
   - 優先使用 P1_Industry_Evidence 進行產業鏈定位
   - 可以使用 P2_Financial_Evidence 判斷「純度」（Revenue Exposure）
   - 不得自行搜尋其他資料

5. **必須對齊 P0/P0.5/P0.7**：
   - 不得改寫 P0 主敘事
   - 不得加入新宏觀論述
   - 只能新增：公司與節點的映射、受益/受害機制、分級理由
`;
}

/**
 * 處理 P1 Step 2 結果
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @param {Object} step1Result - Step 1 處理結果
 * @param {Object} params - 原始執行參數
 * @return {Object} P1 最終處理結果
 */
function P1_ProcessStep2Result(jobId, m0Result, step1Result, params) {
  try {
    Logger.log(`P1 V8.14：處理 Step 2 結果，jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || m0Result.output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 解析輸出
    let step2Output = {};
    if (typeof executorOutput === 'string') {
      try {
        let jsonString = executorOutput.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        step2Output = JSON.parse(jsonString);
      } catch (e) {
        Logger.log(`P1 V8.14：無法解析 Step 2 executorOutput：${e.message}`);
        step2Output = executorOutput;
      }
    } else {
      step2Output = executorOutput;
    }
    
    // 驗證分級結果結構
    if (!step2Output.tiered_companies || !Array.isArray(step2Output.tiered_companies)) {
      throw new Error("Step 2 輸出缺少 tiered_companies 欄位或格式不正確");
    }
    
    Logger.log(`P1 V8.14：Step 2 完成分級，共 ${step2Output.tiered_companies.length} 檔公司`);
    
    // 生成 P1 最終輸出（使用 Tier 系統）
    const p1Output = {
      tiered_companies: step2Output.tiered_companies,
      summary: step2Output.summary || {},
      auditor_review: auditorOutput.audit_review || auditorOutput.review || null,
      confidence_level: auditorOutput.confidence || auditorOutput.confidence_level || 0.7,
      timestamp: new Date().toISOString()
    };
    
    // 保存到 Phase1_Company_Pool（使用 Tier 系統）
    const poolResults = saveToP1CompanyPool(p1Output);
    
    // 保存快照
    const snapshot = saveP1Snapshot({
      job_id: jobId,
      trigger: params.trigger || "QUARTERLY",
      p1_output: p1Output,
      pool_results: poolResults,
      p0_snapshot_id: params.p0_snapshot_id,
      p0_5_snapshot_id: params.p0_5_snapshot_id,
      p0_7_snapshot_id: params.p0_7_snapshot_id,
      changes: compareWithPreviousSnapshotP1(p1Output)
    });
    
    // 檢查是否需要觸發下游
    if (snapshot.changes && snapshot.changes.has_changes) {
      triggerDownstreamPhasesP1("P1", snapshot);
    }
    
    Logger.log(`P1 V8.14：處理完成，snapshot_id=${snapshot.snapshot_id}`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p1_output: p1Output,
      pool_results: poolResults,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P1 V8.14：處理 Step 2 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 保存到 Phase1_Company_Pool（Tier 系統）
// ==========================================

/**
 * 保存到 Phase1_Company_Pool（使用 Tier 系統）
 * @param {Object} p1Output - P1 輸出
 * @return {Object} 保存結果
 */
function saveToP1CompanyPool(p1Output) {
  const results = {
    companies_saved: 0,
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet) {
      sheet = ss.insertSheet("Phase1_Company_Pool");
      sheet.appendRow(PHASE1_COMPANY_POOL_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const headers = PHASE1_COMPANY_POOL_SCHEMA.headers;
    const now = new Date();
    
    for (const company of p1Output.tiered_companies || []) {
      try {
        // 檢查是否已存在（根據 Theme_ID + Company_Code）
        const existingRow = findExistingRowInCompanyPool(sheet, company.theme_id, company.ticker);
        
        // 讀取 Flash 提取的資料（如果已存在）
        const key = `${company.ticker}_${company.market}`;
        const extractedData = loadFinancialReportExtractions([company])[key] || {};
        
        // 按照 PHASE1_COMPANY_POOL_SCHEMA.headers 的順序構建 rowData
        // ⭐ V8.17.1 修正：台日股 Company_Name 顯示為 "公司名(代號)" 格式
        let displayName = company.company_name || "";
        if (company.market === "TW" || company.market === "JP") {
          const marketSuffix = company.market.toLowerCase();  // tw 或 jp
          displayName = `${displayName}(${company.ticker}.${marketSuffix})`;
        }
        
        const rowData = [
          company.theme_id || "",  // Theme_Track
          company.theme_id || "",  // Theme_ID
          company.subtheme_id || "",  // Subtheme_ID
          company.ticker || "",  // Company_Code
          displayName,  // Company_Name（台日股包含代號）
          company.market || "",  // Market
          company.p0_5_chain_map_node_id || "",  // Primary_Technology_or_Node
          company.tier || "",  // Tier
          company.tier_reason || "",  // Tier_Reason
          company.benefit_mechanism || "",  // Benefit_Mechanism
          company.detriment_mechanism || "",  // Detriment_Mechanism
          company.revenue_exposure?.exposure_percentage || "",  // Revenue_Exposure
          "",  // Financial_Report_Proof（已移至 Flash 提取結果）
          "SEC/MOPS/EDINET",  // Financial_Report_Source
          company.is_relevant === false ? "EXCLUDED" : (extractedData.p1_industry_evidence ? "EXTRACTED" : "PENDING"),  // Financial_Report_Status
          JSON.stringify(extractedData.p1_industry_evidence || []),  // P1_Industry_Evidence_JSON
          JSON.stringify(extractedData.p2_financial_evidence || []),  // P2_Financial_Evidence_JSON
          JSON.stringify(extractedData.p3_technical_evidence || []),  // P3_Technical_Evidence_JSON
          extractedData.p1_industry_evidence ? "EXTRACTED" : "PENDING",  // Financial_Report_Extraction_Status
          company.supply_chain_position || "",  // Supply_Chain_Position
          company.p0_5_chain_map_node_id || "",  // P0_5_Chain_Map_Node
          "",  // P0.7_Loop_Dominance（從 P0.7 獲取）
          "",  // P0.7_Time_Position（從 P0.7 獲取）
          "",  // P0.7_Leveraged_Role_Type（從 P0.7 獲取）
          company.confidence_level || 0.7,  // Confidence_Level
          company.evidence_sufficiency || "Medium",  // Evidence_Sufficiency
          "P1_V8.14",  // Source_Type
          "1.0",  // Phase_Version
          "",  // Notes
          now,  // created_at
          now   // updated_at
        ];
        
        if (existingRow > 0) {
          // 更新現有記錄
          for (let col = 0; col < rowData.length && col < headers.length; col++) {
            sheet.getRange(existingRow, col + 1).setValue(rowData[col]);
          }
        } else {
          // 新增記錄
          sheet.appendRow(rowData);
          results.companies_saved++;
        }
      } catch (error) {
        Logger.log(`保存公司到 Phase1_Company_Pool 失敗：${error.message}`);
        results.errors.push(error.message);
      }
    }
    
    Logger.log(`P1 V8.14：已保存 ${results.companies_saved} 筆公司到 Phase1_Company_Pool`);
    return results;
    
  } catch (error) {
    Logger.log(`保存到 Phase1_Company_Pool 失敗：${error.message}`);
    results.errors.push(error.message);
    return results;
  }
}

/**
 * 在 Phase1_Company_Pool 中查找現有記錄
 * @param {Sheet} sheet - 表格
 * @param {string} themeId - Theme ID
 * @param {string} ticker - 股票代號
 * @return {number} 行號（1-based），如果不存在則返回 -1
 */
function findExistingRowInCompanyPool(sheet, themeId, ticker) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const themeIdCol = headers.indexOf("Theme_ID");
  const tickerCol = headers.indexOf("Company_Code");
  
  if (themeIdCol === -1 || tickerCol === -1) {
    return -1;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][themeIdCol] === themeId && rows[i][tickerCol] === ticker) {
      return i + 1;  // 1-based
    }
  }
  
  return -1;
}

// ==========================================
// 公司池縮限機制（V8.17.1 新增）
// ==========================================

/**
 * 按優先級篩選公司池（V8.17.1 新增）
 * @param {Array} companyPool - 原始公司池
 * @param {Object} summary - 公司池摘要
 * @return {Array} 篩選後的公司池
 */
function filterCompanyPoolByPriority(companyPool, summary) {
  try {
    Logger.log(`P1 V8.17.1：開始按優先級篩選公司池（原始數量：${companyPool.length}）`);
    
    // 按 Theme 分組
    const companiesByTheme = {};
    for (const company of companyPool) {
      const themeId = company.theme_id || "UNKNOWN";
      if (!companiesByTheme[themeId]) {
        companiesByTheme[themeId] = [];
      }
      companiesByTheme[themeId].push(company);
    }
    
    Logger.log(`P1 V8.17.1：檢測到 ${Object.keys(companiesByTheme).length} 個 Theme`);
    
    // 對每個 Theme 進行縮限
    const filteredPool = [];
    const maxPerTheme = 40;  // 每個 Theme 最多 40 檔
    
    for (const [themeId, companies] of Object.entries(companiesByTheme)) {
      if (companies.length <= maxPerTheme) {
        // 不需要縮限
        filteredPool.push(...companies);
        Logger.log(`P1 V8.17.1：Theme ${themeId} 有 ${companies.length} 檔，無需縮限`);
      } else {
        // 需要縮限：優先保留大企業和關鍵節點
        const sorted = companies.sort((a, b) => {
          // 優先級 1：大企業（根據 ticker 判斷，知名公司通常更短或更常見）
          const aIsLarge = isLargeCompany(a.ticker);
          const bIsLarge = isLargeCompany(b.ticker);
          if (aIsLarge !== bIsLarge) {
            return bIsLarge ? 1 : -1;
          }
          
          // 優先級 2：關鍵節點（根據 potential_categories 判斷）
          const aIsKeyNode = (a.potential_categories || []).includes("Upstream") || 
                            (a.potential_categories || []).includes("Midstream");
          const bIsKeyNode = (b.potential_categories || []).includes("Upstream") || 
                            (b.potential_categories || []).includes("Midstream");
          if (aIsKeyNode !== bIsKeyNode) {
            return bIsKeyNode ? 1 : -1;
          }
          
          // 優先級 3：美股優先（更容易獲取財報）
          if (a.market !== b.market) {
            if (a.market === "US") return -1;
            if (b.market === "US") return 1;
          }
          
          return 0;
        });
        
        const selected = sorted.slice(0, maxPerTheme);
        filteredPool.push(...selected);
        Logger.log(`P1 V8.17.1：Theme ${themeId} 從 ${companies.length} 檔縮限到 ${selected.length} 檔`);
      }
    }
    
    Logger.log(`P1 V8.17.1：篩選完成，最終數量：${filteredPool.length} 檔`);
    return filteredPool;
    
  } catch (error) {
    Logger.log(`P1 V8.17.1：公司池篩選失敗：${error.message}，返回原始公司池`);
    return companyPool;
  }
}

/**
 * 判斷是否為大企業（根據 ticker 簡單判斷）
 * @param {string} ticker - 股票代號
 * @return {boolean} 是否為大企業
 */
function isLargeCompany(ticker) {
  if (!ticker) return false;
  
  // 知名大企業列表（可以擴展）
  const largeCompanies = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
    "TSM", "ASML", "AMD", "INTC", "QCOM", "AVGO", "TXN", "NFLX",
    "JPM", "V", "MA", "WMT", "JNJ", "PG", "UNH", "HD", "DIS",
    "TM", "SONY", "HON", "GE", "BA", "CAT", "DE", "IBM"
  ];
  
  return largeCompanies.includes(ticker.toUpperCase());
}

/**
 * 保存 Step 1 公司池到 Phase1_Company_Pool（V8.17.1 新增）
 * @param {Array} companyPool - 公司池
 * @param {string} jobId - Job ID
 * @return {Object} 保存結果
 */
function saveStep1CompanyPoolToSheet(companyPool, jobId) {
  const results = {
    companies_saved: 0,
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet) {
      sheet = ss.insertSheet("Phase1_Company_Pool");
      sheet.appendRow(PHASE1_COMPANY_POOL_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const headers = PHASE1_COMPANY_POOL_SCHEMA.headers;
    const now = new Date();
    
    for (const company of companyPool) {
      try {
        // 檢查是否已存在（根據 Theme_ID + Company_Code）
        const existingRow = findExistingRowInCompanyPool(sheet, company.theme_id, company.ticker);
        
        // Step 1 階段：Tier 設為 "PENDING"，待 Step 2 更新
        // ⭐ V8.17.1 修正：台日股 Company_Name 顯示為 "公司名(代號)" 格式
        let displayName = company.company_name || "";
        if (company.market === "TW" || company.market === "JP") {
          const marketSuffix = company.market.toLowerCase();  // tw 或 jp
          displayName = `${displayName}(${company.ticker}.${marketSuffix})`;
        }
        
        const rowData = [
          company.theme_id || "",  // Theme_Track
          company.theme_id || "",  // Theme_ID
          company.subtheme_id || "",  // Subtheme_ID
          company.ticker || "",  // Company_Code
          displayName,  // Company_Name（台日股包含代號）
          company.market || "",  // Market
          "",  // Primary_Technology_or_Node（Step 2 填充）
          "PENDING",  // Tier（Step 2 填充）
          "",  // Tier_Reason（Step 2 填充）
          "",  // Benefit_Mechanism（Step 2 填充）
          "",  // Detriment_Mechanism（Step 2 填充）
          "",  // Revenue_Exposure（Step 2 填充）
          "",  // Financial_Report_Proof
          "SEC/MOPS/EDINET",  // Financial_Report_Source
          "PENDING",  // Financial_Report_Status
          "",  // P1_Industry_Evidence_JSON
          "",  // P2_Financial_Evidence_JSON
          "",  // P3_Technical_Evidence_JSON
          "PENDING",  // Financial_Report_Extraction_Status
          (company.potential_categories || []).join(", ") || "",  // Supply_Chain_Position（初步判斷）
          "",  // P0_5_Chain_Map_Node
          "",  // P0.7_Loop_Dominance
          "",  // P0.7_Time_Position
          "",  // P0.7_Leveraged_Role_Type
          0.7,  // Confidence_Level
          "Medium",  // Evidence_Sufficiency
          "P1_V8.17.1",  // Source_Type
          "1.0",  // Phase_Version
          company.notes || "",  // Notes
          now,  // created_at
          now   // updated_at
        ];
        
        if (existingRow > 0) {
          // 更新現有記錄（只更新基本信息，保留 Step 2 的 Tier 信息）
          const tierCol = headers.indexOf("Tier");
          const existingTier = sheet.getRange(existingRow, tierCol + 1).getValue();
          
          // 如果已有 Tier（不是 PENDING），保留它
          if (existingTier && existingTier !== "PENDING") {
            rowData[tierCol] = existingTier;
          }
          
          for (let col = 0; col < rowData.length && col < headers.length; col++) {
            // 跳過已填充的 Tier 相關欄位（如果已有 Tier）
            if (existingTier && existingTier !== "PENDING") {
              const colName = headers[col];
              if (["Tier", "Tier_Reason", "Benefit_Mechanism", "Detriment_Mechanism"].includes(colName)) {
                continue;  // 保留原有值
              }
            }
            sheet.getRange(existingRow, col + 1).setValue(rowData[col]);
          }
        } else {
          // 新增記錄
          sheet.appendRow(rowData);
          results.companies_saved++;
        }
      } catch (error) {
        Logger.log(`保存公司到 Phase1_Company_Pool 失敗（${company.ticker}）：${error.message}`);
        results.errors.push(`${company.ticker}: ${error.message}`);
      }
    }
    
    Logger.log(`P1 V8.17.1：已保存 ${results.companies_saved} 筆公司到 Phase1_Company_Pool（Step 1）`);
    return results;
    
  } catch (error) {
    Logger.log(`保存 Step 1 公司池到 Phase1_Company_Pool 失敗：${error.message}`);
    results.errors.push(error.message);
    return results;
  }
}

/**
 * 保存 P1 Step 1 快照（V8.17.1 新增）
 * @param {Object} snapshotData - 快照數據
 * @return {Object} 快照結果
 */
function saveP1Step1Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P1__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P1__SNAPSHOT");
    sheet.appendRow(P1_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP1SnapshotId();
  
  // 構建 Step 1 輸出結構
  const p1Step1Output = {
    step: 1,
    company_pool: snapshotData.company_pool,
    summary: snapshotData.summary,
    financial_report_status: snapshotData.financial_report_status,
    tiered_companies: []  // Step 1 還沒有 Tier 分級
  };
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(p1Step1Output),
    JSON.stringify(snapshotData.pool_results),
    snapshotData.p0_snapshot_id || "",
    snapshotData.p0_5_snapshot_id || "",
    snapshotData.p0_7_snapshot_id || "",
    JSON.stringify({
      has_changes: true,
      is_first_run: true,
      step: 1,
      companies_count: snapshotData.company_pool.length
    }),
    "V8.17.1"
  ]);
  
  Logger.log(`P1 Step 1 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: {
      has_changes: true,
      is_first_run: true,
      step: 1
    }
  };
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取 P0.5 快照（根據 snapshot_id）
 * @param {string} snapshotId - 快照 ID
 * @return {Object|null} P0.5 快照
 */
function getP0_5SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const getColIndex = (headerName) => headers.indexOf(headerName);
    const snapshotIdCol = getColIndex("snapshot_id");
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][snapshotIdCol] === snapshotId) {
        const row = rows[i];
        return {
          snapshot_id: row[snapshotIdCol],
          created_at: row[getColIndex("created_at")] || null,
          trigger: row[getColIndex("trigger")] || null,
          p0_5_output_json: row[getColIndex("p0_5_output_json")] || null,
          p0_snapshot_id: row[getColIndex("p0_snapshot_id")] || null,
          industry_chain_map_json: row[getColIndex("industry_chain_map_json")] || null,
          supply_chain_risk_json: row[getColIndex("supply_chain_risk_json")] || null,
          changes_json: row[getColIndex("changes_json")] || null,
          version: row[getColIndex("version")] || "V8.14"
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`獲取 P0.5 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取最新的 P0.5 快照
 * @return {Object|null} P0.5 快照
 */
function getLatestP0_5Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    // 返回最後一行（最新的快照）
    const lastRow = rows[rows.length - 1];
    
    return {
      snapshot_id: lastRow[getColIndex("snapshot_id")],
      created_at: lastRow[getColIndex("created_at")] || null,
      trigger: lastRow[getColIndex("trigger")] || null,
      p0_5_output_json: lastRow[getColIndex("p0_5_output_json")] || null,
      p0_snapshot_id: lastRow[getColIndex("p0_snapshot_id")] || null,
      industry_chain_map_json: lastRow[getColIndex("industry_chain_map_json")] || null,
      supply_chain_risk_json: lastRow[getColIndex("supply_chain_risk_json")] || null,
      changes_json: lastRow[getColIndex("changes_json")] || null,
      version: lastRow[getColIndex("version")] || "V8.14"
    };
  } catch (error) {
    Logger.log(`獲取最新 P0.5 快照失敗：${error.message}`);
    return null;
  }
}
