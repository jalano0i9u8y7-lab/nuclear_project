# P5 Calendar 2026 數據導入示例結構

## 📋 說明

由於用戶提供的 Markdown 格式數據非常詳細且複雜，建議將數據轉換為結構化的 JSON 格式後再導入。

本文檔提供示例數據結構，您可以參考此結構手動構建事件數據，或使用腳本輔助轉換。

---

## 📊 重大財經事件數據結構

### 示例：CES 2026

```javascript
{
  name: "CES 2026",
  date_start: "2026年1月6日",
  date_end: "2026年1月9日",
  date_estimated: false,  // 已確認日期
  date_source: "OFFICIAL",
  market: "GLOBAL",
  event_type: "CONFERENCE",
  description: "消費電子展",
  historical_stats: {
    pre_period_performance: {
      success_rate: 0.7,
      average_impact: 4.2,
      note: "展前7-10天開始科技股上漲，機率70%"
    },
    event_day_performance: {
      average_volatility: 2.1,
      note: "利多出盡效應顯著"
    },
    post_period_performance: {
      success_rate: 0.68,
      average_impact: -4.8,
      note: "展後回調機率68%，平均回調-4.8%"
    }
  },
  monitoring_suggestions: {
    pre_event_data: [
      "RSI是否過熱(>70警戒)",
      "成交量是否異常放大",
      "期權Put/Call比率",
      "機構持倉變化"
    ],
    event_day_focus: [
      "NVIDIA Keynote時間",
      "Intel Keynote時間",
      "新品發表是否超預期",
      "CEO發言基調"
    ],
    post_event_data: [
      "獲利了結信號",
      "回調至展前起漲點",
      "成交量萎縮"
    ]
  },
  tracking_suggestions: "技術面：RSI、成交量、支撐位。籌碼面：期權活動、機構持倉。消息面：新品洩露、分析師預期調整。"
}
```

### 示例：FOMC 2026-01-28

```javascript
{
  name: "FOMC 2026-01-28",
  date_start: "2026年1月28日",
  date_end: "2026年1月28日",
  date_estimated: false,  // 已確認日期
  date_source: "OFFICIAL",
  market: "US",
  event_type: "ECONOMIC_EVENT",
  description: "聯準會利率決議",
  historical_stats: {
    pre_period_performance: {
      success_rate: 0.65,
      average_impact: 0,
      note: "會前波動率上升機率65%，平均VIX +2.1點"
    },
    event_day_performance: {
      average_volatility: 1.5,
      note: "決議後30分鐘最劇烈波動期"
    },
    post_period_performance: {
      success_rate: 0.6,
      average_impact: 0.5,
      note: "鴿派決議後一週上漲機率60%"
    }
  },
  monitoring_suggestions: {
    pre_event_data: [
      "CPI/PPI數據",
      "就業報告",
      "ISM製造業/服務業指數",
      "CME FedWatch Tool利率期貨隱含機率"
    ],
    event_day_focus: [
      "聲明稿關鍵字",
      "點陣圖",
      "Powell記者會重點"
    ],
    post_event_data: [
      "市場消化決議內容",
      "後續經濟數據驗證"
    ]
  },
  tracking_suggestions: "會前：降低槓桿，買入VIX期權對沖。決議當天：觀察聲明稿和點陣圖。決議後：根據鴿派/鷹派情境調整部位。"
}
```

---

## 💰 產業龍頭財報數據結構

### 示例：NVDA Q4 FY2026 財報

```javascript
{
  company: "NVIDIA",
  ticker: "NVDA",
  quarter: "Q4 FY2026",
  earnings_date: "2026年2月25日",
  date_estimated: false,  // 已確認日期
  date_source: "OFFICIAL",
  market: "US",
  event_type: "EARNINGS",
  historical_performance: {
    pre_earnings_performance: {
      success_rate: 0.6,
      average_impact: 6.8,
      note: "財報前一週上漲機率60%，平均漲幅+6.8%"
    },
    earnings_day_performance: {
      average_volatility: 8.5,
      success_rate: 0.7,
      note: "財報後當日平均波動±8-15%，方向取決於EPS/營收vs預期"
    },
    post_earnings_performance: {
      success_rate: 0.7,
      average_impact: 3.2,
      note: "若財報日大漲(>8%)，後兩週持續上漲機率70%"
    },
    beat_rate: 0.75,
    average_volatility: 10.5
  },
  key_metrics: {
    primary_metrics: [
      "營收（Data Center營收佔比80%以上）",
      "EPS",
      "毛利率（預期維持75%以上）"
    ],
    secondary_metrics: [
      "Blackwell量產進度",
      "客戶需求持續性"
    ],
    guidance_focus: [
      "Q1 FY2027營收指引",
      "毛利率趨勢",
      "資本支出計畫"
    ]
  },
  monitoring_suggestions: {
    pre_earnings_data: [
      "CES展會時Jensen Huang發言暗示",
      "供應鏈動態（台積電產能、CoWoS封裝）",
      "主要客戶資本支出（Meta, Microsoft, Amazon）",
      "華爾街分析師評級調整"
    ],
    earnings_day_focus: [
      "營收 vs 預期",
      "EPS vs 預期",
      "Jensen Huang發言基調",
      "Q&A環節意外發言"
    ],
    post_earnings_data: [
      "華爾街投行深度報告",
      "目標價調整趨勢",
      "機構買盤/賣盤流向"
    ]
  },
  tracking_suggestions: "財報前：技術面（RSI、成交量、支撐位）、籌碼面（期權活動、機構持倉）、消息面（供應鏈動態、分析師預期）。財報當天：盤後前30分鐘波動最劇烈，法說會期間可能二次波動。財報後：若大漲通常持續走強，若大跌反彈機率較低。"
}
```

### 示例：TSLA Q4 2025 財報

```javascript
{
  company: "Tesla",
  ticker: "TSLA",
  quarter: "Q4 2025",
  earnings_date: "2026年1月27日",
  date_estimated: false,  // 已確認日期
  date_source: "OFFICIAL",
  market: "US",
  event_type: "EARNINGS",
  historical_performance: {
    pre_earnings_performance: {
      success_rate: 0.55,
      average_impact: 2.5,
      note: "財報前表現分歧，取決於交車數據"
    },
    earnings_day_performance: {
      average_volatility: 10.5,
      success_rate: 0.6,
      note: "財報後平均波動±8-12%，Elon Musk發言影響力>財報數字本身"
    },
    post_earnings_performance: {
      success_rate: 0.4,
      average_impact: -5.2,
      note: "若暴跌>8%可能出現抄底買盤，若暴漲>8%注意獲利了結壓力"
    },
    beat_rate: 0.5,
    average_volatility: 9.8
  },
  key_metrics: {
    primary_metrics: [
      "交車量（Deliveries）",
      "汽車毛利率（Automotive Gross Margin）",
      "自由現金流（Free Cash Flow）"
    ],
    secondary_metrics: [
      "儲能業務（Energy Storage）",
      "FSD進展",
      "Robotaxi商業化時間表"
    ],
    guidance_focus: [
      "2026全年交車指引",
      "新車型進展（低價車款、Cybertruck、Semi）",
      "自動駕駛/Robotaxi進展"
    ]
  },
  monitoring_suggestions: {
    pre_earnings_data: [
      "交車數據（1/2公布）",
      "上海工廠產能利用率",
      "價格調整（官網降價=需求疲弱）",
      "比亞迪(BYD)銷量對比"
    ],
    earnings_day_focus: [
      "2026全年交車指引",
      "新車型進展",
      "自動駕駛/Robotaxi進展",
      "Elon Q&A環節"
    ],
    post_earnings_data: [
      "月初交車數據vs指引",
      "競爭對手動態",
      "Elon後續發言補充/修正"
    ]
  },
  tracking_suggestions: "財報前：交車數據最關鍵。財報當天：Elon Musk發言影響力>財報數字。財報後：若暴跌>8%可能出現抄底買盤。"
}
```

---

## 🔧 使用方式

### 方式 1：手動構建 JSON 數組

1. 參考上述示例結構
2. 將 Markdown 數據轉換為 JSON 格式
3. 調用 `importEventsFromJSON(events)` 函數

### 方式 2：使用測試函數

調用 `testImportP5Calendar2026()` 測試導入功能（使用預設的測試數據）

### 方式 3：逐步導入

1. 先導入部分事件測試（如 CES 2026、NVDA Q4 財報）
2. 驗證數據格式和完整性
3. 確認無誤後批量導入所有事件

---

## 📝 注意事項

1. **日期格式**：支持中文格式（"2026年1月6日"）和標準格式（"2026-01-06"）
2. **預估日期**：如果日期是預估的，設置 `date_estimated: true` 和 `date_source: "ESTIMATED"`
3. **歷史統計**：將用戶提供的歷史統計數據完整存入 `historical_stats`
4. **監控建議**：將追蹤建議存入 `monitoring_suggestions` 和 `tracking_suggestions`
5. **權重計算**：可以手動設置 `prior_weight` 和 `prior_confidence`，或讓系統自動計算

---

## 🚀 下一步

1. 將 Markdown 數據轉換為上述 JSON 格式
2. 調用 `importEventsFromJSON()` 批量導入
3. 使用 `checkAndUpdateEstimatedDates()` 定期檢查並更新預估日期
