# Daily 每日需要蒐集的所有數據（SSOT 級）與白名單

**日期**：2026-01-26  
**目的**：確保討論串中要蒐集與監控的**所有清單**都寫入 SSOT 級文檔；列出 **Daily 每天需要蒐集的所有數據**，並註記**來源都必須來自白名單**；同時說明 **Python 數據來源選項**（GAS 用 CSE 限制搜尋，Python 是否有更好選擇）。

---

## 一、總則：來源必須白名單

- **所有 Daily 蒐集的數據來源都必須來自白名單**；禁止開放式爬蟲或讓 AI 自行搜尋。
- **GAS 時代**：以 **CSE（Custom Search Engine）** 限制搜尋範圍（後台白名單網站）；程式只呼叫 CSE，由 CSE 後台設定限定域名。
- **Python 時代**：可沿用 Google Custom Search API（同一 CSE ID），或改用**專用 API / 白名單域名**（見下「Python 數據來源選項」）。

---

## 二、Daily 每天需要蒐集的所有數據（依 D-1～D-4 與討論整理）

### D-1（新聞與論壇）

| 數據項 | 說明 | 頻率 | 白名單來源（GAS） | 備註 |
|--------|------|------|-------------------|------|
| 權威新聞（D-1A） | 十大類新聞、多語、原子化、去重、分類 | 每日 | CSE 白名單（P5_NEWS）；後台限定權威媒體 | 輸出：NEWS_ATOMS_DAILY、STOCK_NEWS_INDEX_DAILY 等 |
| 散戶論壇（D-1B） | 論壇討論、清洗、判讀、散戶溫度計、個股/宏觀索引 | 每日 | 論壇白名單（中/英/日散戶集中論壇） | 輸出：WEB_SENTIMENT_DAILY；與 D-1A 嚴格分隔 |
| 機構評級 | 機構評級獨立資料庫、目標價變化、多語去重 | 每日 | CSE 白名單（P5_INSTITUTIONAL_RATINGS：The Fly, StreetInsider, Benzinga, TipRanks, 鉅亨網, 經濟日報, 工商時報, Minkabu, Kabutan, Traders Web） | 輸出：INSTITUTIONAL_RATINGS_DAILY |

### D-2（新聞↔個股連接）

| 數據項 | 說明 | 頻率 | 白名單來源 | 備註 |
|--------|------|------|------------|------|
| 新聞關聯個股索引 | D-1 新聞經 D-2 判斷關聯個股，建立新聞↔個股連接 | 每日 | 輸入為 D-1 產出；不另抓外部數據 | 輸出：供 D-3 使用的當日個股新聞索引 |

### D-3（個股世界紀錄官）— 輸入彙總

| 數據項 | 說明 | 頻率 | 白名單來源 | 備註 |
|--------|------|------|------------|------|
| 當日個股新聞索引 | D-2 給的當日所有個股新聞索引 | 每日 | 來自 D-2（D-2 輸入為 D-1 白名單新聞） | D-3 輸入① |
| 個股現貨 OHLCV（當天） | P6 給的個股現貨當天 OHLCV | 每日 | P6 數據來源（GOOGLEFINANCE 或目標架構可靠 API）；P6 僅用於盤中/日結，來源須白名單 | D-3 輸入② |
| 個股衍生性商品資訊 | 個股期權、借券、可轉債、槓桿/反向 ETF 等 Raw 數據 | 每日 | 白名單數據源（見下「衍生品/期權」）；GAS 為 CSE 或專用 API | D-3 自蒐；輸入③ |
| 個股歷史事件集 | 前幾天事件叢、敘事連接、歷史快照 | 每日 | 來自 D-3 自身前日產出與 DB | D-3 自蒐；與前幾天連結 |
| **D-3 產出** | 每檔個股當日快照，與前幾天歷史連結，摘要版供 Weekly | 每日 | — | 不下結論、不給策略；僅記錄、統整、連結 |

### D-4（宏觀世界編年史官）— 輸入彙總

| 數據項 | 說明 | 頻率 | 白名單來源 | 備註 |
|--------|------|------|------------|------|
| D-1 宏觀相關新聞 | 十大類中與宏觀相關的新聞（或未來 10–12 類） | 每日 | 同 D-1 CSE 白名單 | D-4 輸入① |
| 宏觀現貨數據 | 利率、匯率、商品、指數、美債等現貨價格與指標 | 每日 | GOOGLEFINANCE / yfinance / 官方 API / Stooq 等白名單 | D-4 輸入②；見下「宏觀現貨」 |
| 宏觀衍生品數據 | 期貨曲線、期權 IV/skew、ETF flows、信用 spreads 等 | 每日 | 白名單數據源（見下「衍生品/宏觀」） | D-4 輸入③ |
| **D-4 產出** | 各宏觀子世界敘事快照（10–12 類）+ 總金融世界觀快照 | 每日 | — | Narrative_Snapshot_Day_T，串接 T-1 |

### 宏觀分類（10–12 類，D4 產出結構）

1. 利率與流動性世界（美債、Yield Curve、SOFR、利率期貨/選擇權）  
2. 美元與全球資金世界（DXY、主要匯率、FX Swap、外匯期權波動率）  
3. 股權市場世界（指數、Index Options、Equity ETF Flow、相關性變化）  
4. 貴金屬世界（Gold/Silver 現貨、期貨 OI、選擇權 IV/Skew、金銀比、ETF Flow）  
5. 能源世界（原油/天然氣、Crack Spread、能源期權、地緣連動）  
6. 工業商品世界（銅鋁鐵礦、中國需求 proxy、期貨曲線）  
7. 信用與違約世界（IG/HY Spread、CDS、違約率、CLO/Leveraged Loan）  
8. 衍生品結構世界（全市場 Gamma Exposure、CTA、Vol Target、Option Dealer Positioning）  
9. 政策與制度世界（央行、財政、監管、新 ETF/新產品）  
10. 市場情緒與敘事世界（Put/Call、VIX Term Structure、新聞情緒、敘事轉向）  
11. （可選）系統性風險監測世界（Correlation Spike、Liquidity Withdrawal、Cross-asset stress）

### 現貨與衍生品（討論 A–G 類，Daily 蒐集 Raw）

| 大類 | 蒐集項（Raw） | 頻率 | 白名單來源（原則） |
|------|---------------|------|--------------------|
| A 全市場 | 指數期權 IV/skew、Put/Call、OI by strike、0DTE 占比；VIX/VVIX、VIX futures；SOFR/Repo/TGA/RRP 等 | Daily（至少） | 交易所/彭博/Refinitiv 或授權 API；GAS 曾用 GOOGLEFINANCE 部分 |
| B 個股 | 個股期權 ATM IV、skew、Put/Call、OI by strike、期限分佈；借券/Short interest；可轉債；槓桿/反向 ETF flows | Daily（Top 持股/Watchlist） | 白名單 CSE 或專用期權/借券 API |
| C 大宗商品 | 期貨價格/OI、spreads、roll yield；商品期權 IV/skew；ETF flows、倉儲庫存 | Daily / Weekly | 白名單數據源 |
| D 利率/信用 | UST yields、curve spreads、CDX/OAS、違約率 proxy | Daily | 白名單 API 或 GOOGLEFINANCE 等 |
| E 外匯 | FX 期權 IV、risk reversals、期限結構 | Weekly（事件期 Daily） | 白名單 |
| F Crypto | Funding rate、OI、liquidations（若納入） | Daily/Intraday | 白名單交易所 API |
| G 結構/制度 | 保證金調整、熔斷、新 ETF/期權上市、監管聲明 | Event-driven | 交易所/監管白名單公告 |

**註**：以上 Raw 蒐集均須**來自白名單**；Computed 與 Flags 由程式算（Layer 2），不經 AI。

---

## 三、Python 數據來源選項（vs GAS CSE）

**GAS 做法**：以 **Google CSE（Custom Search Engine）** 限制搜尋範圍；後台設定「只搜尋這些網站」，程式呼叫 CSE API 即只得到白名單內結果。優點：易控管、不需自建爬蟲；缺點：配額與延遲、無法直接控制每站格式。

**Python 更好選擇建議**：

| 數據類型 | GAS（CSE） | Python 建議 | 說明 |
|----------|------------|--------------|------|
| 新聞（權威） | P5_NEWS CSE | ① **Google Custom Search API**（同一 CSE ID，延續白名單） ② **專用新聞 API**（如 NewsAPI、Benzinga、Reuters API）配白名單來源 ID ③ **RSS/Atom + 白名單域名**（只訂閱白名單媒體） | 專用 API 通常有結構化欄位、配額清晰；RSS 省成本但需自建解析 |
| 新聞（論壇） | 論壇白名單 | ① **論壇官方 API**（若有） ② **白名單域名爬蟲**（僅抓列在白名單內的論壇 URL，rate limit） | 嚴守白名單與法律條款 |
| 機構評級 | P5_INSTITUTIONAL_RATINGS CSE | ① **Google Custom Search API**（同一 CSE） ② **TipRanks / Benzinga / 鉅亨網 等專用 API**（若訂閱） ③ **RSS/白名單爬蟲**（僅限白名單站） | 同新聞；優先專用 API 以保結構一致 |
| 財報（P2） | P2_US_TAIWAN / P2_JAPAN CSE（財報狗、buffet code） | ① **財報狗/buffet code 官方 API**（若有） ② **Google Custom Search API**（同一 CSE） ③ **SEC/EDINET 官方** + 財報狗僅作同業比較用 | 同業比較須同一數據源；Python 可主用官方 + 白名單輔助 |
| OHLCV/宏觀 | GOOGLEFINANCE、Stooq | **yfinance、pandas-datareader、Stooq、官方央行/交易所 API**；GOOGLEFINANCE 僅 P6 或備援 | SSOT 目標架構：主來源可靠 API，GOOGLEFINANCE 僅 P6 或備援 |
| 期權/衍生品 Raw | 部分 GOOGLEFINANCE、CSE | **交易所/彭博/Refinitiv API、或授權數據商**；若無則 CSE 白名單（僅限已知可靠站） | 衍生品 Raw 最好來自授權數據源；白名單為底線 |

**原則**：  
- **所有蒐集來源必須在白名單內**（無論 CSE 或 API 或 RSS/爬蟲）。  
- Python 可選「專用 API + 白名單來源 ID」或「同一 CSE」或「白名單域名限定爬蟲」，依成本與穩定性選擇；**不開放未列白名單的來源**。

---

## 四、SSOT 對齊與後續

- 本清單為 **SSOT 級**：討論串中要蒐集與監控的**所有清單**已納入本節；Daily 每天需要蒐集的所有數據已列於第二節，並註記**來源都必須來自白名單**。  
- 建議將本文件**要點併入 SSOT**（或 SSOT 引用本文件）：例如在 SSOT「P5 Daily」章新增「Daily 每日蒐集清單與白名單」一節，或附錄「Daily 蒐集清單」引用本文件。  
- Python 實作時：數據源層**抽象化**（同一介面，可插 CSE / 專用 API / 白名單爬蟲），並在配置中**明確列出白名單來源 ID 或域名**，不得未列即用。
