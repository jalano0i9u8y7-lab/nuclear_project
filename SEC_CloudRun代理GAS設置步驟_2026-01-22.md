# SEC Cloud Run 代理 GAS 設置步驟

**版本**：V8.17.1  
**日期**：2026-01-22  
**狀態**：✅ 已從主程式碼還原

---

## 📋 概述

SEC Cloud Run 代理用於代理 GAS 對 SEC 的請求，避免 403 錯誤。本文檔說明如何在 GAS 中設置和使用此代理服務。

---

## 🔧 一、設置代理 URL

### 方法 1：使用 setupSECProxy() 函數（推薦）

1. **在 GAS 編輯器中打開** `src/20_P1_FINANCIAL_REPORTS_CONFIG.js`

2. **執行設置函數**：
   ```javascript
   setupSECProxy("https://您的CloudRun服務URL.a.run.app");
   ```

3. **確認設置**：
   - 函數會將 URL 存儲到 `PropertiesService` 的 `CLOUD_FUNCTION_SEC_URL` 屬性
   - 日誌會顯示設置成功的訊息

### 方法 2：使用 setupSECProxyManually() 函數

1. **修改函數內的 URL**：
   ```javascript
   // 在 src/20_P1_FINANCIAL_REPORTS_CONFIG.js 中找到此函數
   function setupSECProxyManually() {
     const cloudFunctionUrl = "https://您的CloudRun服務URL.a.run.app";  // ⚠️ 替換這裡
     // ...
   }
   ```

2. **執行函數**：
   ```javascript
   setupSECProxyManually();
   ```

---

## ✅ 二、檢查配置

### 檢查代理配置

執行以下函數檢查代理 URL 是否已設置：

```javascript
checkSECProxyConfig();
```

**輸出範例**：
```
✓ SEC 代理 URL 已設置：https://sec-cloud-run-proxy-XXXXX-XX.a.run.app
```

或

```
⚠️ SEC 代理 URL 未設置
請執行 setupSECProxy() 函數設置代理 URL
```

---

## 🧪 三、測試代理

### 執行測試函數

```javascript
testSECProxy();
```

**測試內容**：
1. **健康檢查**：測試 `/health` 端點
2. **master.gz 下載**：測試 gzip 解壓功能
3. **JSON 響應處理**：測試 JSON 格式處理
4. **gzip 解壓驗證**：確認 master.gz 正確解壓

**成功輸出範例**：
```
🧪 開始測試 SEC Cloud Run 代理：https://sec-cloud-run-proxy-XXXXX-XX.a.run.app
測試 0：健康檢查...
✅ 健康檢查通過：{"status":"ok"}
測試 1：下載 master.gz...
✓ 測試 1 成功：下載了 1234567 字符
測試 2：測試 JSON 響應處理...
✓ 測試 2 成功：解析了 JSON，包含 1234 個鍵/元素
測試 3：快速驗證 master.gz 解壓...
✅ 測試 3：確認 master.gz 已正確解壓（包含表頭）
🧪 測試完成
```

---

## 📝 四、主程式中的使用方式

### 1. SEC 數據抓取

主程式會自動使用代理訪問 SEC：

```javascript
// src/20_P1_FINANCIAL_REPORTS.js
function fetchSECArchives_(url, type = "html") {
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (cloudRunUrl) {
    // 使用 Cloud Run 代理
    const response = UrlFetchApp.fetch(`${cloudRunUrl}?url=${encodeURIComponent(url)}&type=${type}`, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 60000
    });
    // ...
  }
}
```

### 2. GCS 存儲

通過代理將 SEC 數據存儲到 GCS：

```javascript
// src/20_P1_FINANCIAL_REPORTS.js
function fetchSECArchivesToGCS_(url, cik, accessionNoDashes, filename, type) {
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (!cloudRunUrl) {
    Logger.log("P1 財報：Cloud Run 代理 URL 未設置，無法使用 GCS 存儲");
    return null;
  }
  
  const response = UrlFetchApp.fetch(`${cloudRunUrl}/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    payload: JSON.stringify({
      url: url,
      cik: cik,
      accession_no_dashes: accessionNoDashes,
      filename: filename,
      type: type
    }),
    timeout: 60000
  });
  // ...
}
```

### 3. 從 GCS 讀取

通過代理從 GCS 讀取文件：

```javascript
// src/20_P1_FINANCIAL_REPORTS.js
function readFileFromGCSPublicUrl(publicUrl, gcsPath = null) {
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (cloudRunUrl && gcsPath) {
    const proxyUrl = `${cloudRunUrl}/read-gcs?gcs_path=${encodeURIComponent(gcsPath)}`;
    const response = UrlFetchApp.fetch(proxyUrl, {
      method: "GET",
      timeout: 60000
    });
    // ...
  }
}
```

---

## 🔍 五、代理端點說明

### 1. 健康檢查

```
GET /health
```

**響應**：
```json
{"status": "ok"}
```

### 2. SEC 數據代理

```
GET /?url={SEC_URL}&type={type}
```

**參數**：
- `url`: SEC URL（需要 URL 編碼）
- `type`: 請求類型（`json`、`html`、`gzip`）

**範例**：
```
GET /?url=https://www.sec.gov/Archives/edgar/full-index/2026/QTR1/master.gz&type=gzip
GET /?url=https://www.sec.gov/Archives/edgar/data/320193/000032019324000001/index.json&type=json
```

### 3. GCS 存儲

```
POST /store
```

**請求體**：
```json
{
  "url": "SEC URL",
  "cik": "CIK（不補零）",
  "accession_no_dashes": "Accession Number（不含破折號）",
  "filename": "文件名",
  "type": "html|json|gzip"
}
```

**響應**：
```json
{
  "gs_path": "gs://bucket/path/to/file",
  "public_url": "https://storage.googleapis.com/bucket/path/to/file",
  "path": "path/to/file"
}
```

### 4. 從 GCS 讀取

```
GET /read-gcs?gcs_path={GCS_PATH}
```

**參數**：
- `gcs_path`: GCS 路徑（`gs://bucket/path/to/file` 格式，需要 URL 編碼）

---

## ⚠️ 六、常見問題

### 問題 1：代理 URL 未設置

**症狀**：
- P1 財報下載失敗
- 日誌顯示「Cloud Run 代理 URL 未設置」

**解決方案**：
1. 執行 `setupSECProxy(cloudRunUrl)` 設置代理 URL
2. 確認 Cloud Run 服務已部署並正常運行

### 問題 2：健康檢查失敗

**症狀**：
- `testSECProxy()` 測試中健康檢查失敗

**解決方案**：
1. 檢查 Cloud Run 服務狀態
2. 確認服務 URL 正確
3. 可能需要重新部署 Cloud Run 服務

### 問題 3：403 錯誤

**症狀**：
- 即使使用代理，仍收到 403 錯誤

**解決方案**：
1. 確認代理服務正常運行
2. 檢查代理服務的 User-Agent 設置
3. 確認 SEC 節流設置（SEC_SLEEP_MS）

---

## 📚 七、相關檔案

- **設置函數**：`src/20_P1_FINANCIAL_REPORTS_CONFIG.js`
- **使用實現**：`src/20_P1_FINANCIAL_REPORTS.js`
- **部署腳本**：`sec-cloud-run-proxy/deploy_cloud_shell.sh`
- **README**：`sec-cloud-run-proxy/README.md`

---

**建立時間**：2026-01-28  
**還原來源**：主程式碼（`src/20_P1_FINANCIAL_REPORTS_CONFIG.js`、`src/20_P1_FINANCIAL_REPORTS.js`）
