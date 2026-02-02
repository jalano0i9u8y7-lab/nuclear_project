/**
 * 💰 P2.5: Prompt 構建
 * 
 * 構建 P2.5 機構級籌碼面分析的 Prompt
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

/**
 * ⭐ V8.0 新增：構建 P2.5 批次處理 Prompt
 * @param {Array<string>} batchTickers - 批次股票代碼列表（6 檔）
 * @param {Object} batchSmartMoneyData - 批次籌碼面數據
 * @param {string} frequency - 執行頻率（MONTHLY / QUARTERLY）
 * @param {number} batchNumber - 批次編號
 * @param {number} totalBatches - 總批數
 * @return {string} 批次 Prompt
 */
function buildP2_5BatchPrompt(batchTickers, batchSmartMoneyData, frequency, batchNumber, totalBatches) {
  const isQuarterly = frequency === "QUARTERLY";
  
  return `
**⭐ V8.0 批次處理說明（重要）**

本次分析為**批次處理模式**，批次 ${batchNumber}/${totalBatches}。

**批次隔離規則**：
- 使用 \`<<<COMPANY: TICKER>>>\` 分隔符分隔每檔股票
- 每檔股票必須獨立分析，不得混線或交叉污染
- 輸出時必須為每檔股票分別輸出結果，不得合併或簡化
- 必須確保每檔股票分析的完整性和獨立性

---

` + buildP2_5Prompt(batchTickers, batchSmartMoneyData, frequency).replace(
    /### 股票列表/,
    `### 股票列表（批次 ${batchNumber}/${totalBatches}）

**重要**：這是批次處理模式，請使用 \`<<<COMPANY: TICKER>>>\` 分隔符分隔每檔股票，確保獨立分析。

`
  );
}

/**
 * 構建 P2.5 機構級籌碼面分析 Prompt
 * @param {Array<string>} tickers - 股票代碼列表
 * @param {Object} smartMoneyData - 籌碼面數據
 * @param {string} frequency - 執行頻率（MONTHLY / QUARTERLY）
 * @return {string} Prompt 內容
 */
function buildP2_5Prompt(tickers, smartMoneyData, frequency) {
  const isQuarterly = frequency === "QUARTERLY";
  
  return `
你是一位資深的機構級籌碼面分析師，負責進行 Nuclear Project 的籌碼面分析。

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## 投資哲學

**基本面是底，籌碼面是因，技術面是果**

- 基本面（P2）確保可以長期持有的根柢
- 籌碼面（P2.5）是大資金的流向，無法隱瞞
- 技術面（P3）是籌碼流動呈現的結果，可能短期會騙人
- 從大資金的籌碼面去揪出來，用技術面驗證

## 任務目標

基於 P2 的基本面分析結果，進行機構級籌碼面分析，識別：
1. **機構持倉變化趨勢**：13F 持倉變化、主要買家/賣家
2. **內部人交易信號**：內部人買賣行為、交易金額
3. **期權活動分析**：異常期權活動、Put/Call Ratio、最大 OI 位置
4. **Dark Pool 活動**：Smart Money 的暗池交易活動
5. **對沖基金 Clone**：追蹤知名對沖基金的持倉變化

## ⭐ V8.17.1 新增：避免過度解讀（防幻覺）

**⚠️ 重要：如果沒有異常活動存在，明確輸出 "NO SIGNAL"。**

**核心原則**：
- ✅ **如果沒有異常活動，明確輸出："NO SIGNAL"**
- ✅ **不要強制解釋或創造不存在的信號**
- ❌ **不要為了輸出而輸出，不要過度解讀正常波動**
- ❌ **不要強制將正常數據解釋為異常信號**

**輸出要求**：
- 如果所有指標都在正常範圍內，明確標註 "NO SIGNAL"
- 只有在確實存在異常活動時，才進行詳細分析

## 輸入數據

### 股票列表

**⭐ 批次處理格式要求**：如果有多檔股票，請使用以下格式分隔：

\`\`\`
<<<COMPANY: TICKER1>>>
[股票 1 的完整數據和分析]

<<<COMPANY: TICKER2>>>
[股票 2 的完整數據和分析]

...（依此類推）
\`\`\`

${JSON.stringify(tickers, null, 2)}

### 機構持倉變化（13F）
${JSON.stringify(smartMoneyData.institutional_holdings || {}, null, 2)}

### 內部人交易
${JSON.stringify(smartMoneyData.insider_trading || {}, null, 2)}

### 期權活動
${JSON.stringify(smartMoneyData.options_flow || {}, null, 2)}

### Dark Pool 活動
${JSON.stringify(smartMoneyData.dark_pool || {}, null, 2)}

## 分析要求

### 1. 機構持倉變化分析

針對每個股票，分析：
- **淨變化趨勢**：機構是累積（ACCUMULATING）還是分發（DISTRIBUTING）？
- **主要買家/賣家**：哪些機構在買入/賣出？
- **機構數量變化**：跟進的機構數量是增加還是減少？
- **持倉集中度**：是否集中在少數大型機構？

### 2. 內部人交易分析

針對每個股票，分析：
- **交易信號**：內部人是買入（BULLISH）還是賣出（BEARISH）？
- **交易金額**：交易金額是否異常大？
- **交易頻率**：內部人交易是否頻繁？
- **交易者身份**：CEO、CFO、董事等不同身份的交易行為

### 3. 期權活動分析

針對每個股票，分析：
- **異常活動**：是否有異常的期權活動？
- **Put/Call Ratio**：看跌/看漲比例如何？
- **最大 OI 位置**：Call 和 Put 的最大未平倉量位置
- **隱含波動率**：30 天隱含波動率是否異常？

### 4. Dark Pool 活動分析

針對每個股票，分析：
- **異常成交量**：是否有異常的暗池成交量？
- **資金流向**：Smart Money 是流入還是流出？
- **情緒判斷**：暗池活動顯示的情緒是看漲還是看跌？

### 5. 分發風險分析 ⭐ V8.17.5 新增：Distribution Risk

針對每個股票，分析：
- **分發風險等級**：LOW / MEDIUM / HIGH
- **判斷依據**：
  - **LOW**：機構持續累積、內部人買入、期權看漲、Dark Pool 流入
  - **MEDIUM**：機構持倉持平、內部人交易中性、期權中性
  - **HIGH**：機構持續分發、內部人賣出、期權看跌、Dark Pool 流出、高檔爆量不漲
- **分發風險的重要性**：如果 Distribution Risk = HIGH，表示機構正在出貨，不適合進行 ICDZ 定錨

### 6. 對沖基金 Clone 分析 ⭐ V8.0 補強：明確 Top 10 對沖基金清單

**Top 10 對沖基金清單（按影響力排序）**：
1. **Berkshire Hathaway**（巴菲特）- 價值投資、長期持有
2. **Bridgewater Associates**（達里奧）- 宏觀對沖、系統性風險
3. **Renaissance Technologies**（西蒙斯）- 量化交易、數學模型
4. **Tiger Global**（科爾曼）- 科技成長股、早期投資
5. **Coatue Management**（拉豐）- 科技股、TMT 領域
6. **D1 Capital Partners**（丹尼爾·桑德海姆）- 科技成長股
7. **Viking Global**（安德烈森）- 多策略、長期持有
8. **Lone Pine Capital**（曼德爾）- 成長股、集中持股
9. **Maverick Capital**（艾因霍恩）- 多空策略、事件驅動
10. **Citadel**（格里芬）- 量化交易、高頻交易

**Clone 評分邏輯** ⭐ V8.0 補強：
- **強力信號（Clone Score >= 80）**：如果某檔股票出現在 >= 5 家 Top 10 對沖基金的新增持倉中 → 這是強力信號（聰明錢一致看多）
- **中等信號（Clone Score 50-79）**：出現在 3-4 家 Top 10 對沖基金的新增持倉中
- **弱信號（Clone Score < 50）**：出現在 1-2 家 Top 10 對沖基金的新增持倉中，或僅在持倉中但無新增

針對每個股票，分析：
- **Top 10 對沖基金持倉情況**：哪些 Top 10 對沖基金持有該股票？
- **新增持倉數量**：有多少家 Top 10 對沖基金在本季度新增持倉？
- **相似持倉**：哪些知名對沖基金持有類似股票？
- **Clone 評分**：與 Top 10 對沖基金持倉的相似度（0-100），基於新增持倉數量計算

## 輸出格式（必須是 JSON）

**⭐ 批次處理輸出要求**：
- 每檔股票必須獨立輸出，使用 ticker 作為 key
- 必須使用 \`<<<COMPANY: TICKER>>>\` 分隔符在輸出中標記每檔股票
- 不得混線或交叉污染不同股票的數據

{
  "smart_money_analysis": {
    "NVDA": {
      "ticker": "NVDA",
    "institutional_holdings": {
      "13f_changes": {
        "net_change": "+5.2%",
        "trend": "ACCUMULATING/DISTRIBUTING/NEUTRAL",
        "top_buyers": ["ARK", "Vanguard"],
        "top_sellers": ["BlackRock"],
        "institution_count": 150,
        "analysis": "機構持續累積，顯示強烈看漲信號"
      }
    },
    "insider_trading": {
      "signal": "BULLISH/NEUTRAL/BEARISH",
      "recent_transactions": [
        {
          "date": "2025-01-10",
          "type": "BUY/SELL",
          "amount": 1000000,
          "insider": "CEO"
        }
      ],
      "analysis": "內部人大額買入，信心度高"
    },
    "options_flow": {
      "unusual_activity": true/false,
      "put_call_ratio": 0.45,
      "max_oi_strike_call": 500,
      "max_oi_strike_put": 450,
      "sentiment": "BULLISH/NEUTRAL/BEARISH",
      "analysis": "期權活動顯示看漲情緒"
    },
    "dark_pool_activity": {
      "unusual_volume": true/false,
      "sentiment": "BULLISH/NEUTRAL/BEARISH",
      "net_flow": 1000000,
      "analysis": "Smart Money 大量流入"
    },
    "hedge_fund_clone": {
      "similar_holdings": ["TSM", "AMD"],
      "clone_score": 0.75,
      "analysis": "與知名對沖基金持倉高度相似"
    },
    "smart_money_score": 0.82,  // 0-100，綜合評分
    "distribution_risk": "LOW/MEDIUM/HIGH",  // ⭐ V8.17.5 新增：分發風險（機構是否在出貨）
    "institutional_anchor_signal": {  // ⭐ V8.17.5 新增：ICDZ 信號（是否值得定錨）
      "present": true/false,  // 是否值得進行 ICDZ 定錨
      "confidence": "HIGH/MEDIUM/LOW/N/A",  // 信心等級
      "anchor_reason": [  // 支持定錨的理由
        "Top 5 funds increased position >15%",
        "Insider buying clustered within last 2 quarters"
      ],
      "disabled_reason": null  // 如果 present=false，說明為什麼禁用（例如："DISTRIBUTION_RISK_HIGH"）
    },
    "recommendations": [
      "機構持續累積，建議增持",
      "內部人大額買入，信心度高",
      "期權活動顯示看漲情緒"
    ]
  },
  "confidence_level": 0.0-1.0,
  "analysis_date": "YYYY-MM-DD"
}

## 注意事項

1. 必須基於提供的籌碼面數據進行分析，不能憑空猜測
2. 籌碼面分析要有邏輯性和可追溯性
3. 輸出必須是有效的 JSON 格式
4. 每個股票都應該有完整的分析
5. Smart_Money_Score 是綜合評分，需要考慮所有因素
6. ${isQuarterly ? "季度分析需要更深入，包含 13F 持倉變化的詳細分析" : "月度分析重點關注近期變化趨勢"}

7. **⚠️ 重要：輸出格式要求（節省 Token 成本）**：
   - ❌ **禁止任何客套話、開場白、結尾語**（例如：「你問得非常好...」、「如果你需要的話，我可以幫你...」等）
   - ❌ **禁止任何與工作無關的說明文字**
   - ✅ **只輸出純 JSON 格式**，直接開始 JSON 對象，不要有任何前綴或後綴
   - ✅ **API 版本必須嚴格遵守此要求**，與網頁版不同，API 版本不應包含任何額外的禮貌性文字
   - ✅ **節省 Token = 節省成本**，每多一個無用的 token 都會增加成本
`;
}
