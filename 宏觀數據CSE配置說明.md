# 宏觀數據 CSE 配置說明

## ⚠️ V8.0 重要變更

**宏觀數據不再從 Stooq 抓取**，改為使用：
1. **FRED (Federal Reserve Economic Data)** - 主要來源（穩定、免費、EOD）
2. **Yahoo Finance JSON API** - 備用來源（即時數據）

## CSE 配置說明

### ⚠️ V8.0 修正：不需要新增 P5_MACRO CSE

**P5_MACRO 使用現有的 P5_WORLD CSE**：
- **CSE 名稱**：`P5_WORLD`
- **CX ID 變數名**：`GOOGLE_CSE_CX_P5_WORLD`
- **CX ID**：`519d1500d22b24e31` ✅
- **已包含網域**：`fred.stlouisfed.org` ✅

**Yahoo Finance JSON API**：
- 不需要 CSE（直接 API 調用：`query1.finance.yahoo.com/v7/finance/quote`）
- 不需要在 CSE 後台新增網域

## FRED 系列 ID 映射

| 宏觀指標 | FRED 系列 ID | Yahoo Finance Ticker |
|---------|-------------|---------------------|
| WTI原油 | `DCOILWTICO` | `CL=F` |
| Brent原油 | `DCOILBRENTEU` | `BZ=F` |
| 黃金 | `GOLDAMGBD228NLBM` | `GC=F` |
| 白銀 | `SLVPRUSD` | `SI=F` |
| 銅 | `PCOPPUSDM` | `HG=F` |
| VIX | `VIXCLS` | `^VIX` |
| 美元指數 | - | `DX-Y.NYB` |
| 美國10年期國債 | `DGS10` | `^TNX` |
| 美國3個月國債 | `DGS3MO` | `^IRX` |

## 數據源優先順序

1. **商品/波動率/利率**：FRED（優先）→ Yahoo Finance JSON API（備用）
2. **匯率**：Stooq（只限 FX，因為 FX 目前正常）→ Yahoo Finance JSON API（備用）
3. **美元指數**：Yahoo Finance JSON API（FRED 無此數據）

## Stooq 白名單化

**Stooq 只保留用於**：
- EURUSD, GBPUSD, USDJPY, USDCHF, USDCNY（匯率，目前正常）

**Stooq 不再用於**：
- 商品期貨（CL.F, GC.F, SI.F, HG.F, BRENT.F）
- 波動率（VI.F）
- 利率（10YUSY.B, 3MUSY.B）
- 美元指數（DX-Y.NYB）
