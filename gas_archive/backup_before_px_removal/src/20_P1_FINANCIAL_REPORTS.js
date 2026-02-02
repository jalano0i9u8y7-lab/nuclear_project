/**
 * ⭐ V8.14 新增：P1 財報抓取模組
 * 
 * 實作財報抓取功能：
 * - 美股：SEC API（Ticker → CIK → 最新 10-K/10-Q HTML）
 * - 台股：MOPS（固定 URL 結構，抓取最新一季 PDF）
 * - 日股：EDINET/金融廳（固定索引，抓取最新 Annual/Quarterly）
 * - Gemini File API 整合（上傳 PDF，取得 fileUri）
 * 
 * @version V8.14
 * @date 2026-01-19
 */

// ==========================================
// 美股 SEC API 整合
// ==========================================

/**
 * ⭐ V8.17.1 新增：SEC API 配置
 */
const SEC_UA = "HSIUNG (jalano0i9u8y7@gmail.com)";  // ⭐ SEC 要求：必須包含 email（標準格式：帶括號）
const SEC_SLEEP_MS = 200;  // ⭐ 節流：200ms ~ 5 req/sec（低於 SEC 10 req/sec 上限）

/**
 * ⭐ V8.17.1 重大更新：SEC 數據抓取（通過 Cloud Run 代理，避免 403）
 * 核心觀念：GAS 無法直接訪問 SEC（會被判為 Undeclared Automated Tool），必須通過 Cloud Run 代理
 * @param {string} url - SEC URL（可以是 Archives 或 API）
 * @param {string} type - 請求類型（"json", "html", "gzip"）
 * @return {Object|string} JSON 響應、HTML 內容或解壓後的文字
 */
function fetchSECArchives_(url, type = "html") {
  // ⭐ V8.17.1 重大更新：優先使用 Cloud Run 代理
  const properties = PropertiesService.getScriptProperties();
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (cloudRunUrl) {
    // 使用 Cloud Run 代理
    Logger.log(`P1 財報：通過 Cloud Run 代理訪問 SEC，URL=${url}`);
    Utilities.sleep(SEC_SLEEP_MS);
    
    try {
      const response = UrlFetchApp.fetch(`${cloudRunUrl}?url=${encodeURIComponent(url)}&type=${type}`, {
        method: "GET",
        muteHttpExceptions: true,
        followRedirects: true,
        timeout: 60000  // 60 秒超時（代理可能需要更長時間）
      });
      
      const code = response.getResponseCode();
      if (code !== 200) {
        const errorText = response.getContentText().substring(0, 500);
        Logger.log(`P1 財報：Cloud Run 代理錯誤（HTTP ${code}），URL=${url}`);
        Logger.log(`P1 財報：錯誤內容前 500 字符：${errorText}`);
        throw new Error(`Cloud Run 代理錯誤：HTTP ${code} for ${url}\n${errorText}`);
      }
      
      // 根據類型返回相應內容
      if (type === "json") {
        return JSON.parse(response.getContentText());
      } else {
        return response.getContentText();
      }
    } catch (proxyError) {
      Logger.log(`P1 財報：Cloud Run 代理失敗，嘗試直接訪問：${proxyError.message}`);
      // 如果代理失敗，回退到直接訪問（但這可能仍會 403）
    }
  }
  
  // ⚠️ 回退：直接訪問（可能仍會 403，但作為最後手段）
  Logger.log(`P1 財報：直接訪問 SEC（無代理），URL=${url}`);
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "User-Agent": SEC_UA,  // ⭐ 必須包含可識別的 User-Agent（含 email）
      "Accept": "application/json, text/html, */*",
      "Accept-Encoding": "gzip, deflate"
    },
    muteHttpExceptions: true,
    timeout: 30000  // 30 秒超時
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    const errorText = response.getContentText().substring(0, 500);
    Logger.log(`P1 財報：SEC 直接訪問錯誤（HTTP ${code}），URL=${url}`);
    Logger.log(`P1 財報：使用的 User-Agent=${SEC_UA}`);
    Logger.log(`P1 財報：錯誤內容前 500 字符：${errorText}`);
    
    throw new Error(`HTTP ${code} for ${url}\n${errorText}`);
  }
  
  if (type === "json") {
    return JSON.parse(response.getContentText());
  } else {
    return response.getContentText();
  }
}

/**
 * ⭐ V8.17.1 新增：從 GCS 公開 URL 讀取文件
 * @param {string} publicUrl - GCS 公開 URL
 * @return {string|null} 文件內容或 null
 */
/**
 * ⭐ V8.17.1 新增：從 GCS 讀取文件（支持公開 URL 和 Cloud Run 代理）
 * @param {string} publicUrl - GCS 公開 URL（如果 bucket 是公開的）
 * @param {string} gcsPath - GCS 路徑（gs:// 格式，用於 Cloud Run 代理）
 * @return {string|null} 文件內容或 null
 */
function readFileFromGCSPublicUrl(publicUrl, gcsPath = null) {
  try {
    // ⭐ 方法 1：嘗試從公開 URL 讀取（如果 bucket 是公開的）
    if (publicUrl) {
      Logger.log(`P1 財報：從 GCS 公開 URL 讀取文件：${publicUrl}`);
      const response = UrlFetchApp.fetch(publicUrl, {
        method: "GET",
        muteHttpExceptions: true,
        timeout: 60000
      });
      
      const code = response.getResponseCode();
      if (code === 200) {
        const content = response.getContentText();
        Logger.log(`P1 財報：成功從 GCS 公開 URL 讀取文件，長度=${content.length} 字符`);
        return content;
      }
      
      Logger.log(`P1 財報：GCS 公開 URL 讀取失敗（HTTP ${code}），嘗試通過 Cloud Run 代理讀取...`);
    }
    
    // ⭐ 方法 2：通過 Cloud Run 代理從 GCS 讀取（用於 bucket 禁止公開訪問的情況）
    const cloudRunUrl = PropertiesService.getScriptProperties().getProperty("CLOUD_FUNCTION_SEC_URL");
    if (cloudRunUrl) {
      // 優先使用提供的 gcsPath，否則從 publicUrl 推斷
      let gcsPathToUse = gcsPath;
      
      if (!gcsPathToUse && publicUrl) {
        // 從 publicUrl 推斷 GCS 路徑
        // 格式：https://storage.googleapis.com/{bucket}/sec/{cik}/{accession_no_dashes}/{filename}
        const match = publicUrl.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)$/);
        if (match) {
          const bucketName = match[1];
          const objectPath = match[2];
          gcsPathToUse = `gs://${bucketName}/${objectPath}`;
        }
      }
      
      if (gcsPathToUse) {
        Logger.log(`P1 財報：通過 Cloud Run 代理從 GCS 讀取：${gcsPathToUse}`);
        
        try {
          const proxyUrl = `${cloudRunUrl}/read-gcs?gcs_path=${encodeURIComponent(gcsPathToUse)}`;
          const proxyResponse = UrlFetchApp.fetch(proxyUrl, {
            method: "GET",
            timeout: 60000,
            muteHttpExceptions: true
          });
          
          if (proxyResponse.getResponseCode() === 200) {
            const content = proxyResponse.getContentText();
            Logger.log(`P1 財報：通過 Cloud Run 代理成功從 GCS 讀取文件，長度=${content.length} 字符`);
            return content;
          } else {
            const errorText = proxyResponse.getContentText().substring(0, 500);
            Logger.log(`P1 財報：Cloud Run 代理讀取失敗（HTTP ${proxyResponse.getResponseCode()}）：${errorText}`);
          }
        } catch (proxyError) {
          Logger.log(`P1 財報：Cloud Run 代理讀取失敗：${proxyError.message}`);
        }
      } else {
        Logger.log(`P1 財報：無法確定 GCS 路徑，無法通過 Cloud Run 代理讀取`);
      }
    } else {
      Logger.log(`P1 財報：Cloud Run 代理 URL 未設置，無法通過代理讀取`);
    }
    
    // ⭐ 方法 3：回退到從 SEC 重新下載（最後手段）
    if (publicUrl) {
      const match = publicUrl.match(/https:\/\/storage\.googleapis\.com\/[^\/]+\/sec\/(\d+)\/([^\/]+)\/(.+)$/);
      if (match) {
        const cik = match[1];
        const accessionNoDashes = match[2];
        const filename = match[3];
        const secUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${filename}`;
        
        Logger.log(`P1 財報：回退到從 SEC 重新下載：${secUrl}`);
        
        if (cloudRunUrl) {
          try {
            const proxyUrl = `${cloudRunUrl}/?url=${encodeURIComponent(secUrl)}&type=html`;
            const proxyResponse = UrlFetchApp.fetch(proxyUrl, {
              method: "GET",
              timeout: 30000,
              muteHttpExceptions: true
            });
            
            if (proxyResponse.getResponseCode() === 200) {
              const content = proxyResponse.getContentText();
              Logger.log(`P1 財報：從 SEC 重新下載成功，長度=${content.length} 字符`);
              return content;
            }
          } catch (secError) {
            Logger.log(`P1 財報：從 SEC 重新下載失敗：${secError.message}`);
          }
        }
      }
    }
    
    Logger.log(`P1 財報：所有讀取方法都失敗`);
    return null;
  } catch (error) {
    Logger.log(`P1 財報：從 GCS 讀取失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ V8.17.1 新增：通過 Cloud Run 將 SEC 數據存儲到 GCS
 * @param {string} url - SEC URL
 * @param {string} cik - CIK（不補零）
 * @param {string} accessionNoDashes - Accession Number（不含破折號）
 * @param {string} filename - 文件名
 * @param {string} type - 請求類型（"html", "json", "gzip"）
 * @return {Object|null} { gs_path, public_url, path } 或 null
 */
function fetchSECArchivesToGCS_(url, cik, accessionNoDashes, filename, type = "html") {
  const properties = PropertiesService.getScriptProperties();
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (!cloudRunUrl) {
    Logger.log("P1 財報：Cloud Run 代理 URL 未設置，無法使用 GCS 存儲");
    return null;
  }
  
  try {
    Utilities.sleep(SEC_SLEEP_MS);
    
    const response = UrlFetchApp.fetch(`${cloudRunUrl}/store`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        url: url,
        cik: cik,
        accession_no_dashes: accessionNoDashes,
        filename: filename,
        type: type
      }),
      muteHttpExceptions: true,
      timeout: 60000
    });
    
    const code = response.getResponseCode();
    if (code !== 200) {
      const errorText = response.getContentText().substring(0, 500);
      Logger.log(`P1 財報：GCS 存儲失敗（HTTP ${code}），URL=${url}`);
      Logger.log(`P1 財報：錯誤內容前 500 字符：${errorText}`);
      return null;
    }
    
    const result = JSON.parse(response.getContentText());
    Logger.log(`P1 財報：成功存儲到 GCS，路徑=${result.gs_path}`);
    return result;
  } catch (error) {
    Logger.log(`P1 財報：GCS 存儲失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ V8.17.1 新增：從 SEC Archives 獲取 index.json（列出該 filing 的所有檔案）
 * @param {string} cik - CIK（不補零，例如：320193）
 * @param {string} accessionNumber - Accession Number（帶破折號，例如：0000320193-24-000001）
 * @return {Object} index.json 內容
 */
function fetchEdgarIndex(cik, accessionNumber) {
  const cikNoZeros = String(parseInt(cik, 10));
  const acc = accessionNumber.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${acc}/index.json`;
  
  Logger.log(`P1 財報：抓取 index.json，URL=${url}`);
  Utilities.sleep(SEC_SLEEP_MS);  // ⭐ 節流
  
  const content = fetchSECArchives_(url, "json");
  return typeof content === "string" ? JSON.parse(content) : content;
}

/**
 * ⭐ V8.17.1 重大更新：下載並解壓 master.gz 檔案（通過 Cloud Run 代理）
 * @param {string} url - master.gz URL
 * @return {string} 解壓後的文字內容
 */
function fetchTextGz_(url) {
  // ⭐ V8.17.1 重大更新：優先使用 Cloud Run 代理
  const properties = PropertiesService.getScriptProperties();
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (cloudRunUrl) {
    // 使用 Cloud Run 代理（代理會自動解壓 gzip）
    Logger.log(`P1 財報：通過 Cloud Run 代理下載 master.gz，URL=${url}`);
    Utilities.sleep(SEC_SLEEP_MS);
    
    try {
      const response = UrlFetchApp.fetch(`${cloudRunUrl}?url=${encodeURIComponent(url)}&type=gzip`, {
        method: "GET",
        muteHttpExceptions: true,
        followRedirects: true,
        timeout: 60000  // 60 秒超時
      });
      
      const code = response.getResponseCode();
      if (code !== 200) {
        const errorText = response.getContentText().substring(0, 500);
        Logger.log(`P1 財報：Cloud Run 代理錯誤（HTTP ${code}），URL=${url}`);
        throw new Error(`Cloud Run 代理錯誤：HTTP ${code} ${url}\n${errorText}`);
      }
      
      // Cloud Run 代理應該已經解壓並返回文字內容
      return response.getContentText();
    } catch (proxyError) {
      Logger.log(`P1 財報：Cloud Run 代理失敗，嘗試直接訪問：${proxyError.message}`);
      // 如果代理失敗，回退到直接訪問
    }
  }
  
  // ⚠️ 回退：直接訪問（可能仍會 403）
  Logger.log(`P1 財報：直接下載 master.gz（無代理），URL=${url}`);
  Utilities.sleep(SEC_SLEEP_MS);
  const resp = UrlFetchApp.fetch(url, {
    headers: {
      'User-Agent': SEC_UA,
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate',
    },
    muteHttpExceptions: true,
    followRedirects: true,
    timeout: 30000
  });

  const code = resp.getResponseCode();
  if (code !== 200) {
    const errorText = resp.getContentText().substring(0, 500);
    throw new Error(`HTTP ${code} ${url}\n${errorText}`);
  }

  // master.gz 是 gzip 壓縮
  const bytes = resp.getContent();
  const unzipped = Utilities.ungzip(bytes);
  return unzipped.getDataAsString('UTF-8');
}

/**
 * ⭐ V8.17.1 新增：獲取季度編號（1-4）
 * @param {Date} dateObj - 日期對象
 * @return {number} 季度編號（1-4）
 */
function getQuarter_(dateObj) {
  const m = dateObj.getMonth() + 1;
  return Math.floor((m - 1) / 3) + 1; // 1..4
}

/**
 * ⭐ V8.17.1 新增：取最近 N 個季度（含本季）
 * @param {number} n - 要獲取的季度數量
 * @return {Array} [{year, qtr}, ...]
 */
function recentQuarters_(n) {
  const now = new Date();
  let y = now.getFullYear();
  let q = getQuarter_(now);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({year: y, qtr: q});
    q--;
    if (q === 0) { q = 4; y--; }
  }
  return out;
}

/**
 * ⭐ V8.17.1 重大更新：從 master index 裡找某 CIK 最新某 form（10-K / 10-Q）
 * 完全不走 API，使用 Archives 的 master.gz 索引檔
 * @param {string|number} cikInt - CIK（不補零）
 * @param {string} formType - 表單類型（"10-K" 或 "10-Q"）
 * @return {Object|null} { cik, form, dateFiled, filename }
 */
function findLatestFilingFromIndex_(cikInt, formType) {
  // ⭐ V8.17.1 修正：master index 中的 CIK 可能是補零的（10位）或不補零的
  // 統一轉換為數字進行比較，避免格式不匹配
  const cikNum = parseInt(cikInt, 10);
  const cikStr = String(cikNum);
  const quarters = recentQuarters_(3);      // 最近 3 季通常夠用
  let best = null;

  for (const {year, qtr} of quarters) {
    try {
      const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${qtr}/master.gz`;
      Logger.log(`P1 財報：下載 master index，URL=${url}`);
      const text = fetchTextGz_(url);

      // master.idx 前面有 header，資料從一行 "CIK|Company Name|Form Type|Date Filed|Filename" 之後開始
      const lines = text.split('\n');
      let lineCount = 0;
      let matchedCount = 0;
      let sampleLines = [];  // 保存前幾行作為樣本
      
      for (const line of lines) {
        lineCount++;
        
        // 保存前 5 行作為樣本（用於調試）
        if (lineCount <= 5) {
          sampleLines.push(line.substring(0, 100));  // 只保存前 100 字符
        }
        
        if (!line || line.indexOf('|') === -1) continue;
        // 典型：CIK|Company Name|Form Type|Date Filed|Filename
        const parts = line.split('|');
        if (parts.length < 5) continue;

        const lineCik = parts[0].trim();
        const form = parts[2].trim();
        const dateFiled = parts[3].trim();
        const filename = parts[4].trim();

        // ⭐ V8.17.1 修正：將 CIK 轉換為數字進行比較，避免補零格式不匹配
        const lineCikNum = parseInt(lineCik, 10);
        
        // 調試：記錄匹配的 CIK（前 10 個）
        if (lineCikNum === cikNum && matchedCount < 10) {
          matchedCount++;
          Logger.log(`P1 財報：找到匹配 CIK=${cikNum} 的行，Form=${form}，Date=${dateFiled}`);
        }
        
        if (lineCikNum === cikNum && form === formType) {
          if (!best || dateFiled > best.dateFiled) {
            // 保存原始 CIK 格式和公司名稱（從 filename 提取）
            const companyName = parts[1] ? parts[1].trim() : '';
            best = { 
              cik: lineCik,  // 保存原始格式
              cikNum: cikNum,  // 保存數字格式
              companyName: companyName,  // ⭐ 新增：公司名稱
              form, 
              dateFiled, 
              filename 
            };
          }
        }
      }
      
      // 調試：記錄解析統計
      Logger.log(`P1 財報：${year} Q${qtr} master index 解析完成，總行數=${lineCount}，匹配 CIK=${cikNum} 的行數=${matchedCount}`);
      if (sampleLines.length > 0) {
        Logger.log(`P1 財報：master index 前 5 行樣本：${sampleLines.join(' | ')}`);
      }
    } catch (error) {
      Logger.log(`P1 財報：下載 ${year} Q${qtr} master index 失敗：${error.message}`);
      // 繼續嘗試下一個季度
      continue;
    }
  }
  
  if (best) {
    Logger.log(`P1 財報：從 master index 找到最新 ${formType}，日期=${best.dateFiled}，檔案=${best.filename}，公司=${best.companyName || 'N/A'}`);
  } else {
    Logger.log(`P1 財報：從 master index 找不到 ${formType}（CIK=${cikNum}）`);
  }
  
  return best;
}

/**
 * ⭐ V8.17.1 新增：把 filename 拆出 accession（含破折號）與 accessionNoDashes
 * @param {string} filename - 例如：edgar/data/320193/0000320193-25-000010.txt
 * @return {Object|null} { accession, accessionNoDashes }
 */
function parseAccessionFromFilename_(filename) {
  // filename: edgar/data/{cik}/{accession}.txt
  const m = filename.match(/edgar\/data\/\d+\/([0-9-]+)\./);
  if (!m) return null;
  const accession = m[1];
  return { accession, accessionNoDashes: accession.replace(/-/g, '') };
}

/**
 * ⭐ V8.17.1 新增：構建 Archives URL（主文件）
 * Archives URL 格式：/Archives/edgar/data/{cik_no_leading_zeros}/{accession_no_no_dashes}/{primaryDocument}
 * @param {string} cik10 - CIK（10位補零）
 * @param {string} accessionNumber - Accession Number（帶破折號）
 * @param {string} primaryDocument - 主文件名
 * @return {string} Archives URL
 */
function buildPrimaryDocUrl_(cik10, accessionNumber, primaryDocument) {
  const cikNoZeros = String(parseInt(cik10, 10));
  const accNoDashes = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}/${primaryDocument}`;
}

/**
 * ⭐ V8.17.1 新增：從 index.json 中選擇最佳文件
 * 優先順序：.htm（財報全文） > _htm.xml（iXBRL） > .pdf（若公司有附）
 * @param {Object} indexJson - index.json 內容
 * @return {Object|null} { fileName, fileType, url }
 */
function selectBestFileFromIndex_(indexJson, cik, accessionNumber) {
  // ⭐ V8.17.1 新增：詳細調試日誌
  Logger.log(`P1 財報：selectBestFileFromIndex_ 開始，CIK=${cik}, accession=${accessionNumber}`);
  
  if (!indexJson) {
    Logger.log(`P1 財報：indexJson 為 null 或 undefined`);
    return null;
  }
  
  if (!indexJson.directory) {
    Logger.log(`P1 財報：indexJson.directory 不存在，indexJson 鍵：${Object.keys(indexJson).join(', ')}`);
    return null;
  }
  
  // ⭐ V8.17.1 修正：SEC index.json 結構是 directory.item（數組），不是 directory.files
  // 需要處理兩種可能的結構：directory.files 或 directory.item
  let files = null;
  
  if (indexJson.directory.files && Array.isArray(indexJson.directory.files)) {
    files = indexJson.directory.files;
    Logger.log(`P1 財報：使用 directory.files 結構`);
  } else if (indexJson.directory.item && Array.isArray(indexJson.directory.item)) {
    files = indexJson.directory.item;
    Logger.log(`P1 財報：使用 directory.item 結構`);
  } else {
    Logger.log(`P1 財報：directory 中沒有 files 或 item 數組，directory 鍵：${Object.keys(indexJson.directory).join(', ')}`);
    return null;
  }
  
  Logger.log(`P1 財報：index.json 包含 ${files.length} 個文件`);
  
  // 記錄前 5 個文件名（用於調試）
  const fileNames = files.slice(0, 5).map(f => {
    // 處理兩種可能的結構：f.name 或 f['-name']
    const name = f.name || f['-name'] || f['name'] || '';
    return name;
  }).filter(n => n).join(', ');
  Logger.log(`P1 財報：前 5 個文件名：${fileNames}`);
  
  const cikNoZeros = String(parseInt(cik, 10));
  const accNoDashes = accessionNumber.replace(/-/g, "");
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}`;
  
  // ⭐ 輔助函數：獲取文件名（處理不同的結構）
  const getFileName = (f) => {
    return f.name || f['-name'] || f['name'] || '';
  };
  
  // 優先順序：.htm > _htm.xml > .pdf
  const htmlFile = files.find(f => {
    const name = getFileName(f);
    return name && name.endsWith('.htm') && !name.endsWith('_htm.xml');
  });
  if (htmlFile) {
    const fileName = getFileName(htmlFile);
    Logger.log(`P1 財報：找到 HTML 文件：${fileName}`);
    return {
      fileName: fileName,
      fileType: 'HTML',
      url: `${baseUrl}/${fileName}`
    };
  }
  
  const xmlFile = files.find(f => {
    const name = getFileName(f);
    return name && name.endsWith('_htm.xml');
  });
  if (xmlFile) {
    const fileName = getFileName(xmlFile);
    Logger.log(`P1 財報：找到 iXBRL 文件：${fileName}`);
    return {
      fileName: fileName,
      fileType: 'iXBRL',
      url: `${baseUrl}/${fileName}`
    };
  }
  
  const pdfFile = files.find(f => {
    const name = getFileName(f);
    return name && name.endsWith('.pdf');
  });
  if (pdfFile) {
    const fileName = getFileName(pdfFile);
    Logger.log(`P1 財報：找到 PDF 文件：${fileName}`);
    return {
      fileName: fileName,
      fileType: 'PDF',
      url: `${baseUrl}/${fileName}`
    };
  }
  
  // ⭐ 如果都沒找到，列出所有文件類型
  const fileExtensions = files.map(f => {
    const name = getFileName(f);
    if (!name) return '';
    const ext = name.substring(name.lastIndexOf('.'));
    return ext;
  }).filter(ext => ext).join(', ');
  Logger.log(`P1 財報：未找到 .htm、_htm.xml 或 .pdf 文件，可用文件擴展名：${fileExtensions}`);
  
  return null;
}

/**
 * 從 SEC Archives 獲取公司最新財報（10-K/10-Q HTML）
 * ⭐ V8.17.1 重大更新：改用 Archives 靜態檔案伺服器，不走 API，避免 403
 * ⭐ V8.17.2 新增：支持「初次三季，之後一季」邏輯
 * 核心技巧：先抓 index.json，再挑選最佳文件（.htm > _htm.xml > .pdf）
 * @param {string} ticker - 股票代號（例如：AAPL）
 * @param {boolean} isInitialAnalysis - 是否為初次分析（true=下載最新兩季，false=只下載最新一季）
 * @return {Object|null} 財報資訊 { filing_url, filing_type, filing_date, html_content }
 */
function fetchSECFinancialReport(ticker, isInitialAnalysis = true) {
  try {
    // ⭐ V8.17.1 新增：節流（每次請求前 sleep）
    Utilities.sleep(SEC_SLEEP_MS);
    
    // 1. Ticker → CIK 對照表（使用緩存機制）
    const cik = getCIKFromTicker(ticker);  // 不補零的 CIK
    if (!cik) {
      Logger.log(`P1 財報：找不到 ${ticker} 的 CIK`);
      return null;
    }
    
    // ⭐ V8.17.1 重大更新：使用 master index（master.gz）獲取 filing 列表，完全不走 API
    // 完全避開 data.sec.gov API，使用 Archives 的 master.gz 索引檔
    Utilities.sleep(SEC_SLEEP_MS);
    
    // 2. 從 master index 獲取財報（完全不走 API）
    // ⭐ V8.17.4 更新：初次分析下載最新兩季，之後只下載最新一季
    Logger.log(`P1 財報：開始從 master index 查找 ${ticker} (CIK=${cik})，模式=${isInitialAnalysis ? "初次分析（最新兩季）" : "季度更新（最新一季）"}`);
    
    const quarterlyReports = [];
    
    // ⭐ V8.17.3 修復：將變數定義在區塊外，避免作用域問題
    let latest10K = null;
    let latest10Qs = [];
    let latest10Q = null;
    
    if (isInitialAnalysis) {
      // ⭐ V8.17.4 更新：初次分析改為下載最新兩季（最新10-K + 最新1個10-Q，或最新2個10-Q）
      latest10K = findLatestFilingFromIndex_(cik, "10-K");
      latest10Qs = typeof findLatestN10QsFromIndex_ === 'function' ? 
        findLatestN10QsFromIndex_(cik, 1) : [findLatestFilingFromIndex_(cik, "10-Q")].filter(Boolean);  // 最新1個10-Q，如果函數不存在則回退到1個
      
      if (latest10K) {
      try {
        // ⭐ V8.17.1 新增：從 filename 提取 accession
        const accInfo = parseAccessionFromFilename_(latest10K.filename);
        if (!accInfo) {
          Logger.log(`P1 財報：無法從 filename 提取 accession（${ticker} 10-K）：${latest10K.filename}`);
        } else {
          // 先抓 index.json
          Utilities.sleep(SEC_SLEEP_MS);
          const indexJson = fetchEdgarIndex(cik, accInfo.accession);
          
          // 選擇最佳文件
          const bestFile = selectBestFileFromIndex_(indexJson, cik, accInfo.accession);
          if (!bestFile) {
            Logger.log(`P1 財報：無法從 index.json 中找到合適的文件（${ticker} 10-K）`);
          } else {
            // ⭐ V8.17.1 新增：選項 1 - 存儲到 GCS（推薦，避免 GAS 6 分鐘限制）
            const gcsResult = fetchSECArchivesToGCS_(
              bestFile.url,
              cik,
              accInfo.accessionNoDashes,
              bestFile.fileName,
              bestFile.fileType === 'HTML' ? 'html' : (bestFile.fileType === 'XML' ? 'html' : 'html')
            );
            
            // ⭐ V8.17.1 新增：選項 2 - 直接下載內容（向後兼容，但可能受 6 分鐘限制）
            let fileContent = null;
            if (!gcsResult) {
              // 如果 GCS 存儲失敗，回退到直接下載
              Logger.log(`P1 財報：GCS 存儲失敗，回退到直接下載（${ticker} 10-K）`);
              Utilities.sleep(SEC_SLEEP_MS);
              fileContent = fetchSECArchives_(bestFile.url);
            }
            
            // ⭐ V8.17.1 新增：保存 GCS 路徑到 PropertiesService（用於後續檢查）
            if (gcsResult && gcsResult.gs_path) {
              try {
                const properties = PropertiesService.getScriptProperties();
                properties.setProperty(`P1_GCS_PATH_${ticker}`, gcsResult.gs_path);
                Logger.log(`P1 財報：已保存 ${ticker} 的 GCS 路徑到 PropertiesService`);
              } catch (e) {
                Logger.log(`P1 財報：保存 GCS 路徑到 PropertiesService 失敗：${e.message}`);
              }
            }
            
            quarterlyReports.push({
              filing_url: bestFile.url,
              filing_type: latest10K.form,
              filing_date: latest10K.dateFiled || null,
              html_content: fileContent,  // 如果使用 GCS，此欄位為 null
              gcs_path: gcsResult ? gcsResult.gs_path : null,  // ⭐ 新增：GCS 路徑
              gcs_public_url: gcsResult ? gcsResult.public_url : null,  // ⭐ 新增：公開 URL
              file_type: bestFile.fileType,
              source: gcsResult ? "SEC_ARCHIVES_GCS" : "SEC_ARCHIVES"  // ⭐ 更新：標記來源
            });
          }
        }
      } catch (error) {
        Logger.log(`P1 財報：下載 ${ticker} 10-K 失敗：${error.message}`);
      }
    }
    
      // 處理最新2個10-Q
      for (const latest10Q of latest10Qs) {
        if (!latest10Q) continue;
        
        try {
          const accInfo = parseAccessionFromFilename_(latest10Q.filename);
          if (!accInfo) {
            Logger.log(`P1 財報：無法從 filename 提取 accession（${ticker} 10-Q）：${latest10Q.filename}`);
            continue;
          }
          
          Utilities.sleep(SEC_SLEEP_MS);
          const indexJson = fetchEdgarIndex(cik, accInfo.accession);
          const bestFile = selectBestFileFromIndex_(indexJson, cik, accInfo.accession);
          if (!bestFile) {
            Logger.log(`P1 財報：無法從 index.json 中找到合適的文件（${ticker} 10-Q）`);
            continue;
          }
          
          const gcsResult = fetchSECArchivesToGCS_(
            bestFile.url,
            cik,
            accInfo.accessionNoDashes,
            bestFile.fileName,
            bestFile.fileType === 'HTML' ? 'html' : 'html'
          );
          
          let fileContent = null;
          if (!gcsResult) {
            Logger.log(`P1 財報：GCS 存儲失敗，回退到直接下載（${ticker} 10-Q）`);
            Utilities.sleep(SEC_SLEEP_MS);
            fileContent = fetchSECArchives_(bestFile.url);
          }
          
          quarterlyReports.push({
            filing_url: bestFile.url,
            filing_type: latest10Q.form,
            filing_date: latest10Q.dateFiled || null,
            html_content: fileContent,
            gcs_path: gcsResult ? gcsResult.gs_path : null,
            gcs_public_url: gcsResult ? gcsResult.public_url : null,
            file_type: bestFile.fileType,
            source: gcsResult ? "SEC_ARCHIVES_GCS" : "SEC_ARCHIVES"
          });
        } catch (error) {
          Logger.log(`P1 財報：下載 ${ticker} 10-Q 失敗：${error.message}`);
        }
      }
    } else {
      // 季度更新：只下載最新一季（最新10-Q）
      latest10Q = findLatestFilingFromIndex_(cik, "10-Q");
      
      if (latest10Q) {
        try {
          const accInfo = parseAccessionFromFilename_(latest10Q.filename);
          if (!accInfo) {
            Logger.log(`P1 財報：無法從 filename 提取 accession（${ticker} 10-Q）：${latest10Q.filename}`);
          } else {
            Utilities.sleep(SEC_SLEEP_MS);
            const indexJson = fetchEdgarIndex(cik, accInfo.accession);
            const bestFile = selectBestFileFromIndex_(indexJson, cik, accInfo.accession);
            if (!bestFile) {
              Logger.log(`P1 財報：無法從 index.json 中找到合適的文件（${ticker} 10-Q）`);
            } else {
              const gcsResult = fetchSECArchivesToGCS_(
                bestFile.url,
                cik,
                accInfo.accessionNoDashes,
                bestFile.fileName,
                bestFile.fileType === 'HTML' ? 'html' : 'html'
              );
              
              let fileContent = null;
              if (!gcsResult) {
                Logger.log(`P1 財報：GCS 存儲失敗，回退到直接下載（${ticker} 10-Q）`);
                Utilities.sleep(SEC_SLEEP_MS);
                fileContent = fetchSECArchives_(bestFile.url);
              }
              
              quarterlyReports.push({
                filing_url: bestFile.url,
                filing_type: latest10Q.form,
                filing_date: latest10Q.dateFiled || null,
                html_content: fileContent,
                gcs_path: gcsResult ? gcsResult.gs_path : null,
                gcs_public_url: gcsResult ? gcsResult.public_url : null,
                file_type: bestFile.fileType,
                source: gcsResult ? "SEC_ARCHIVES_GCS" : "SEC_ARCHIVES"
              });
            }
          }
        } catch (error) {
          Logger.log(`P1 財報：下載 ${ticker} 10-Q 失敗：${error.message}`);
        }
      }
    }
    
    if (quarterlyReports.length === 0) {
      Logger.log(`P1 財報：無法下載 ${ticker} 的任何財報`);
      return null;
    }
    
    // ⭐ 從 master index 結果獲取公司名稱
    let companyName = "";
    if (isInitialAnalysis && latest10K && latest10K.companyName) {
      companyName = latest10K.companyName;
    } else if (!isInitialAnalysis && latest10Q && latest10Q.companyName) {
      companyName = latest10Q.companyName;
    } else if (isInitialAnalysis && latest10Qs.length > 0 && latest10Qs[0].companyName) {
      companyName = latest10Qs[0].companyName;
    }
    
    return {
      ticker: ticker,
      market: "US",
      company_name: companyName,  // ⭐ V8.17.1 更新：從 master index 獲取公司名稱
      quarterly_reports: quarterlyReports,
      source: "SEC_ARCHIVES"
    };
    
  } catch (error) {
    Logger.log(`P1 財報：SEC Archives 抓取失敗（${ticker}）：${error.message}`);
    Logger.log(`P1 財報：錯誤堆疊：${error.stack}`);
    return null;
  }
}

/**
 * ⭐ V8.17.1 新增：從 Ticker 獲取 CIK（10位補零格式，使用緩存）
 * @param {string} ticker - 股票代號
 * @return {string|null} CIK（10位補零，例如：0000320193）
 */
function getCIKFromTicker10_(ticker) {
  const cik = getCIKFromTicker(ticker);
  if (!cik) return null;
  return String(parseInt(cik, 10)).padStart(10, "0");
}

/**
 * ⭐ V8.17.1 新增：已知 CIK 對照表（備用方案）
 * 如果 SEC API 失敗，使用此對照表
 */
const KNOWN_CIK_MAP = {
  "AAPL": "320193",
  "MSFT": "789019",
  "NVDA": "1045810",
  "GOOGL": "1652044",
  "GOOG": "1652044",
  "AMZN": "1018724",
  "META": "1326801",
  "TSLA": "1318605",
  "BRK.B": "1067983",
  "UNH": "731766",
  "JNJ": "200406",
  "V": "1403161",
  "WMT": "104169",
  "MA": "1141391",
  "PG": "80424",
  "JPM": "19617",
  "HD": "354950",
  "DIS": "1001039",
  "BAC": "70858",
  "ADBE": "796343",
  "CRM": "1108524",
  "NFLX": "1065280",
  "INTC": "50863",
  "AMD": "2488",
  "CSCO": "858877",
  "PEP": "77476",
  "TMO": "97745",
  "COST": "909832",
  "AVGO": "1730168",
  "ABBV": "1551152",
  "NKE": "320187",
  "MRK": "310158",
  "ACN": "1467373",
  "WFC": "72971",
  "TXN": "97476",
  "QCOM": "804328",
  "PM": "1413329",
  "NEE": "753308",
  "LIN": "1707925",
  "RTX": "101829",
  "HON": "773840",
  "UPS": "1090727",
  "AMGN": "318154",
  "AXP": "4962",
  "LOW": "60667",
  "SPGI": "64040",
  "INTU": "896878",
  "BKNG": "1075531",
  "GE": "40545",
  "CAT": "18230",
  "DE": "315189",
  "GS": "886982",
  "AMT": "1053507",
  "ISRG": "1035267",
  "SYK": "310764",
  "BLK": "1364742",
  "ADI": "6281",
  "TJX": "109198",
  "GILD": "882095",
  "VRTX": "875320",
  "ADP": "8670",
  "ZTS": "1555280",
  "CMCSA": "1166691",
  "REGN": "835585",
  "CDNS": "813672",
  "KLAC": "319201",
  "SNPS": "883241",
  "FTNT": "1262039",
  "NXPI": "1413447",
  "MCHP": "827054",
  "CTAS": "723254",
  "APH": "820313",
  "FAST": "815556",
  "ANSS": "1013462",
  "PAYX": "723531",
  "IDXX": "874716",
  "ODFL": "878927",
  "DXCM": "1093557",
  "CTSH": "1058290",
  "ON": "1097864",
  "FDS": "1013237",
  "GGG": "43196",
  "POOL": "945841",
  "ROL": "84839",
  "CPRT": "900075",
  "WST": "105770",
  "ZBRA": "877212",
  "NDAQ": "1120193",
  "MSCI": "1408198",
  "SPSC": "1091777",
  "BR": "1314770",
  "EXPD": "746515",
  "RBC": "832101",
  "TECH": "842023",
  "TTC": "731802",
  "VRSK": "1442145",
  "WWD": "108312",
  "ZWS": "1611980",
  "AOS": "91142",
  "IT": "749251",
  "FIX": "1035985",
  "GWW": "277135",
  "AME": "1037868",
  "PH": "76334",
  "TDY": "1094285",
  "SW": "93556",
  "KEYS": "1601046",
  "TER": "97210",
  "EME": "1053369",
  "PNR": "77360",
  "WAT": "1000697",
  "FTV": "1659166",
  "IEX": "832101",
  "DOV": "29905",
  "IR": "1699150",
  "OTIS": "1781335",
  "CMI": "26172",
  "ETN": "1551182",
  "ROK": "1024478",
  "ROP": "1772920",
  "TT": "1466258",
  "AME": "1037868",
  "WWD": "108312",
  "ZWS": "1611980",
  "AOS": "91142",
  "IT": "749251",
  "FIX": "1035985",
  "GWW": "277135",
  "AME": "1037868",
  "PH": "76334",
  "TDY": "1094285",
  "SW": "93556",
  "KEYS": "1601046",
  "TER": "97210",
  "EME": "1053369",
  "PNR": "77360",
  "WAT": "1000697",
  "FTV": "1659166",
  "IEX": "832101",
  "DOV": "29905",
  "IR": "1699150",
  "OTIS": "1781335",
  "CMI": "26172",
  "ETN": "1551182",
  "ROK": "1024478",
  "ROP": "1772920",
  "TT": "1466258"
};

/**
 * ⭐ V8.17.1 新增：從 Ticker 獲取 CIK（使用緩存機制，6小時緩存）
 * @param {string} ticker - 股票代號
 * @return {string|null} CIK（不補零，例如：320193）
 */
function getCIKFromTicker(ticker) {
  try {
    const upperTicker = ticker.toUpperCase();
    
    // 1. 先檢查已知 CIK 對照表（快速路徑）
    if (KNOWN_CIK_MAP[upperTicker]) {
      Logger.log(`P1 財報：從已知對照表找到 ${ticker} 的 CIK=${KNOWN_CIK_MAP[upperTicker]}`);
      return KNOWN_CIK_MAP[upperTicker];
    }
    
    // 2. 檢查緩存（6小時）
    const cache = CacheService.getScriptCache();
    const cached = cache.get("TICKER_CIK_MAP");
    if (cached) {
      const map = JSON.parse(cached);
      if (map[upperTicker]) {
        Logger.log(`P1 財報：從緩存找到 ${ticker} 的 CIK=${map[upperTicker]}`);
        return map[upperTicker];
      }
    }
    
    // 3. 從 SEC Archives 獲取（並緩存）
    // ⭐ V8.17.1 更新：company_tickers.json 位於 www.sec.gov/files/，這是靜態檔案，不是 API
    Logger.log(`P1 財報：開始從 SEC Archives 獲取 Ticker-CIK 對照表`);
    const tickerToCIKUrl = "https://www.sec.gov/files/company_tickers.json";
    
    // ⭐ V8.17.1 新增：節流（每次請求前 sleep）
    Utilities.sleep(SEC_SLEEP_MS);
    
    const content = fetchSECArchives_(tickerToCIKUrl);
    const data = JSON.parse(content);
    
    // 構建 Ticker → CIK 對照表
    const map = {};
    Object.keys(data).forEach(k => {
      const row = data[k];
      const tickerKey = (row.ticker || "").toString().toUpperCase();
      const cik = String(parseInt(row.cik_str, 10));
      if (tickerKey) map[tickerKey] = cik;
    });
    
    // 緩存 6 小時
    cache.put("TICKER_CIK_MAP", JSON.stringify(map), 6 * 60 * 60);
    Logger.log(`P1 財報：成功獲取並緩存 SEC 對照表，包含 ${Object.keys(map).length} 筆記錄`);
    
    // 返回對應的 CIK
    if (map[upperTicker]) {
      Logger.log(`P1 財報：找到 ${ticker} 的 CIK=${map[upperTicker]}`);
      return map[upperTicker];
    }
    
    Logger.log(`P1 財報：找不到 ${ticker} 的 CIK（在 ${Object.keys(map).length} 筆記錄中搜尋）`);
    return null;
    
  } catch (error) {
    Logger.log(`P1 財報：獲取 CIK 失敗（${ticker}）：${error.message}`);
    Logger.log(`P1 財報：錯誤堆疊：${error.stack}`);
    
    // ⭐ V8.17.1 新增：如果發生異常，嘗試使用已知 CIK
    const upperTicker = ticker.toUpperCase();
    if (KNOWN_CIK_MAP[upperTicker]) {
      Logger.log(`P1 財報：異常後使用已知 CIK=${KNOWN_CIK_MAP[upperTicker]}`);
      return KNOWN_CIK_MAP[upperTicker];
    }
    return null;
  }
}

/**
 * 下載 SEC Filing HTML（已棄用，改用 fetchSECArchives_）
 * ⭐ V8.17.1 更新：此函數保留以維持向後兼容性，但實際使用 fetchSECArchives_
 * @param {string} htmlUrl - HTML URL
 * @return {string} HTML 內容
 * @deprecated 使用 fetchSECArchives_ 代替
 */
function fetchSECFilingHTML(htmlUrl) {
  // ⭐ V8.17.1 更新：直接使用 fetchSECArchives_，這是 Archives 靜態檔案
  return fetchSECArchives_(htmlUrl);
}

/**
 * 從 SEC HTML 中提取 Business Description（Item 1）
 * @param {string} htmlContent - HTML 內容
 * @return {string} Business Description 段落
 */
function extractBusinessDescriptionFromSECHTML(htmlContent) {
  // 簡化處理：使用正則表達式提取 Item 1 部分
  // 實際應該使用更精確的 HTML 解析
  
  const item1Match = htmlContent.match(/ITEM\s+1\.?\s*[:\-]?\s*BUSINESS[^]*?(?=ITEM\s+1A|ITEM\s+2|<\/DOCUMENT>)/i);
  if (item1Match) {
    // 移除 HTML 標籤（簡化處理）
    return item1Match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  return null;
}

// ==========================================
// 台股 MOPS 整合
// ==========================================

/**
 * 從 MOPS 獲取公司最新財報（固定 URL 結構）
 * @param {string} companyCode - 公司代號（例如：2330）
 * @return {Object|null} 財報資訊 { filing_url, filing_type, filing_date, pdf_blob }
 */
function fetchMOPSFinancialReport(companyCode) {
  try {
    // MOPS 固定 URL 結構：https://mops.twse.com.tw/server-java/t164sb01?step=1&CO_ID=2330&SYEAR=2025&SSEASON=4&REPORT_ID=C
    // 最新一季通常是最近一個完整季度
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;  // 1-12
    
    // 判斷最新季度（Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12）
    let season = 4;  // 預設 Q4
    if (month >= 1 && month <= 3) {
      season = 1;  // Q1
    } else if (month >= 4 && month <= 6) {
      season = 2;  // Q2
    } else if (month >= 7 && month <= 9) {
      season = 3;  // Q3
    }
    
    // 嘗試最新季度，如果失敗則嘗試上一季度
    for (let attempt = 0; attempt < 2; attempt++) {
      const testSeason = attempt === 0 ? season : (season === 1 ? 4 : season - 1);
      const testYear = attempt === 0 ? year : (season === 1 ? year - 1 : year);
      
      const mopsUrl = `https://mops.twse.com.tw/server-java/t164sb01?step=1&CO_ID=${companyCode}&SYEAR=${testYear}&SSEASON=${testSeason}&REPORT_ID=C`;
      
      try {
        const response = UrlFetchApp.fetch(mopsUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0"
          },
          muteHttpExceptions: true
        });
        
        if (response.getResponseCode() === 200) {
          const content = response.getContentText();
          
          // 檢查是否有 PDF 連結
          const pdfMatch = content.match(/href="([^"]*\.pdf[^"]*)"/i);
          if (pdfMatch) {
            const pdfUrl = pdfMatch[1].startsWith('http') ? pdfMatch[1] : `https://mops.twse.com.tw${pdfMatch[1]}`;
            
            // 下載 PDF
            const pdfResponse = UrlFetchApp.fetch(pdfUrl, {
              method: "GET",
              headers: {
                "User-Agent": "Mozilla/5.0"
              },
              muteHttpExceptions: true
            });
            
            if (pdfResponse.getResponseCode() === 200) {
              return {
                filing_url: pdfUrl,
                filing_type: `Q${testSeason}`,
                filing_date: `${testYear}-${String(testSeason * 3).padStart(2, '0')}-01`,
                pdf_blob: pdfResponse.getBlob(),
                source: "MOPS"
              };
            }
          }
        }
      } catch (error) {
        Logger.log(`P1 財報：MOPS 嘗試失敗（${companyCode}, ${testYear}Q${testSeason}）：${error.message}`);
      }
    }
    
    Logger.log(`P1 財報：找不到 ${companyCode} 的最新 MOPS 財報`);
    return null;
    
  } catch (error) {
    Logger.log(`P1 財報：MOPS 抓取失敗（${companyCode}）：${error.message}`);
    return null;
  }
}

// ==========================================
// 日股 EDINET/金融廳整合
// ==========================================

/**
 * 從 EDINET 獲取公司最新財報（固定索引）
 * @param {string} companyCode - 公司代號（例如：6758）
 * @return {Object|null} 財報資訊 { filing_url, filing_type, filing_date, pdf_blob }
 */
function fetchEDINETFinancialReport(companyCode) {
  try {
    // EDINET 固定索引：https://disclosure.edinet-fsa.go.jp/E01EW/BLMainController.jsp?uji.verb=W00Z1010initialize&uji.bean=ee.bean.parent.EECommonSearchBean&TARGET=BL01E00111
    // 需要根據公司代號查找最新財報
    
    // 簡化處理：使用 EDINET API 或固定 URL 結構
    // 實際應該使用 EDINET 的公開 API 或索引
    
    Logger.log(`P1 財報：EDINET 整合待實現（${companyCode}）`);
    return null;
    
  } catch (error) {
    Logger.log(`P1 財報：EDINET 抓取失敗（${companyCode}）：${error.message}`);
    return null;
  }
}

// ==========================================
// 統一財報抓取接口
// ==========================================

/**
 * 統一財報抓取接口（根據市場自動選擇）
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場（US/TW/JP）
 * @return {Object|null} 財報資訊
 */
function fetchFinancialReport(ticker, market) {
  try {
    if (market === "US" || market === "美股") {
      return fetchSECFinancialReport(ticker);
    } else if (market === "TW" || market === "台股") {
      return fetchMOPSFinancialReport(ticker);
    } else if (market === "JP" || market === "日股") {
      return fetchEDINETFinancialReport(ticker);
    } else {
      Logger.log(`P1 財報：不支援的市場（${market}）`);
      return null;
    }
  } catch (error) {
    Logger.log(`P1 財報：統一抓取失敗（${ticker}, ${market}）：${error.message}`);
    return null;
  }
}

// ==========================================
// Gemini File API 整合（PDF 處理）
// ==========================================

/**
 * 上傳 PDF 到 Gemini File API 並提取 Business Description
 * @param {Blob} pdfBlob - PDF Blob
 * @param {string} fileName - 檔案名稱
 * @return {Object|null} { file_uri, business_description_text }
 */
function uploadPDFToGeminiAndExtract(pdfBlob, fileName) {
  try {
    // 1. 上傳到 Gemini File API
    const fileUri = uploadFileToGemini(pdfBlob, fileName);
    
    // 2. 使用 Gemini Flash 提取 Business Description
    const businessDescription = extractBusinessDescriptionFromGeminiFile(fileUri);
    
    // 3. 刪除 Gemini 檔案（釋放配額）
    deleteGeminiFile(fileUri);
    
    return {
      file_uri: fileUri,
      business_description_text: businessDescription
    };
    
  } catch (error) {
    Logger.log(`P1 財報：Gemini PDF 處理失敗：${error.message}`);
    return null;
  }
}

/**
 * 從 Gemini File 中提取 Business Description
 * @param {string} fileUri - Gemini File API URI
 * @return {string} Business Description 文字
 */
function extractBusinessDescriptionFromGeminiFile(fileUri) {
  const apiKey = getAPIKey("GOOGLE");
  const model = "gemini-3-flash-preview";
  
  const prompt = `你是一個文件閱讀器，負責從 PDF 文件中擷取「Business Description」或「業務描述」段落。

**你的任務**：
1. 閱讀這份 PDF 文件（可能是財報、年報或季報）
2. 找出文件中描述公司業務的段落（通常是「Business Description」、「業務描述」、「公司概況」等章節）
3. **只擷取原文段落，不要改寫、不要總結**

**擷取規則**：
1. **只擷取原文段落**：直接複製文件中描述公司業務的文字
2. **包含完整上下文**：如果業務描述分佈在多個段落，全部都要擷取
3. **標註頁數**：標註每個段落所在的頁數

**輸出格式（JSON）**：
{
  "business_description": "完整的業務描述原文段落（直接從文件中複製）",
  "page_numbers": [15, 16, 17],
  "source_section": "Business Description / 業務描述 / 公司概況"
}

**注意**：
- 不要進行任何分析、解釋或推理
- 只負責找到並複製業務描述的原文段落
`;
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { file_data: { mime_type: "application/pdf", file_uri: fileUri } }
      ]
    }]
  };
  
  const response = UrlFetchApp.fetch(apiUrl, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`Gemini 提取失敗：${response.getContentText()}`);
  }
  
  const result = JSON.parse(response.getContentText());
  const content = result.candidates[0].content.parts[0].text;
  
  // 解析 JSON
  let jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.business_description || content;
  }
  
  return content;
}

/**
 * 上傳檔案到 Gemini File API（通用版本，支援 Blob）
 * @param {Blob} blob - 檔案 Blob
 * @param {string} fileName - 檔案名稱
 * @return {string} fileUri
 */
function uploadFileToGemini(blob, fileName) {
  const apiKey = getAPIKey("GOOGLE");
  
  // 手動組裝 multipart/related Payload
  const boundary = "----WebKitFormBoundary" + Utilities.getUuid();
  const metadata = JSON.stringify({ file: { display_name: fileName } });
  
  // 組裝 multipart/related body
  let body = "";
  body += `--${boundary}\r\n`;
  body += `Content-Type: application/json\r\n\r\n`;
  body += `${metadata}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Type: application/pdf\r\n\r\n`;
  body += Utilities.newBlob(blob.getBytes()).getDataAsString();
  body += `\r\n--${boundary}--\r\n`;
  
  // 上傳到 Gemini
  const uploadUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files";
  const response = UrlFetchApp.fetch(uploadUrl, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    payload: body,
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`Gemini File API 上傳失敗：${response.getContentText()}`);
  }
  
  const result = JSON.parse(response.getContentText());
  return result.file.uri;
}

// ==========================================
// ⭐ V8.14 新增：財報下載與提取完整流程
// ==========================================

/**
 * P1 財報下載階段（統一入口）
 * @param {Array} companyPool - 公司池清單
 * @param {string} jobId - Job ID
 * @return {Object} 下載狀態
 */
function P1_FetchFinancialReports(companyPool, jobId) {
  const status = {
    us_companies: { total: 0, success: 0, failed: 0, skipped: 0 },
    tw_companies: { total: 0, folders_created: 0, pending: 0 },
    jp_companies: { total: 0, folders_created: 0, pending: 0 },
    errors: []
  };
  
  try {
    // ⭐ V8.17 地雷修復：可重入設計 - 載入已處理狀態
    const processedState = typeof loadProcessedFinancialReportCompanies === 'function' ? 
      loadProcessedFinancialReportCompanies(jobId) : { processed: [], processing: [], failed: [] };
    
    // 1. 分離美/台/日股
    const usCompanies = companyPool.filter(c => c.market === "US" || c.market === "美股");
    const twCompanies = companyPool.filter(c => c.market === "TW" || c.market === "台股");
    const jpCompanies = companyPool.filter(c => c.market === "JP" || c.market === "日股");
    
    status.us_companies.total = usCompanies.length;
    status.tw_companies.total = twCompanies.length;
    status.jp_companies.total = jpCompanies.length;
    
    // ⭐ V8.17 地雷修復：過濾已處理的公司
    const remainingUsCompanies = usCompanies.filter(c => 
      !processedState.processed.includes(c.ticker) && 
      !processedState.processing.includes(c.ticker)
    );
    
    if (remainingUsCompanies.length < usCompanies.length) {
      const skipped = usCompanies.length - remainingUsCompanies.length;
      status.us_companies.skipped = skipped;
      const skippedTickers = usCompanies.filter(c => processedState.processed.includes(c.ticker)).map(c => c.ticker).join(', ');
      Logger.log(`P1 財報可重入：跳過 ${skipped} 檔已處理公司：${skippedTickers}`);
    }
    
    // 2. 美股：自動抓取最新兩季（可重入處理）
    Logger.log(`P1 財報：開始下載 ${remainingUsCompanies.length} 檔美股財報（總共 ${usCompanies.length} 檔，已處理 ${processedState.processed.length} 檔）`);
    const usReportMetadata = [];
    
    for (const company of remainingUsCompanies) {
      try {
        // ⭐ V8.17 地雷修復：可重入處理單檔公司
        if (typeof processFinancialReportCompanyReentrant === 'function') {
          // ⭐ V8.17.2 新增：判斷是否為初次分析（檢查是否已有財報資料）
          const hasExistingReports = checkIfCompanyHasFinancialReports(company.ticker);
          const isInitialAnalysis = !hasExistingReports;
          
          const companyResult = processFinancialReportCompanyReentrant(jobId, company, (comp) => {
            // 下載財報（初次分析=三季，季度更新=一季）
            const result = fetchSECFinancialReport(comp.ticker, isInitialAnalysis);
            if (result && result.quarterly_reports && result.quarterly_reports.length > 0) {
              return {
                ticker: comp.ticker,
                company_name: comp.company_name,
                market: "US",
                reports: result.quarterly_reports,
                success: true
              };
            } else {
              throw new Error("抓取失敗：無財報資料");
            }
          });
          
          if (companyResult.skipped) {
            status.us_companies.skipped++;
            continue;
          }
          
          if (companyResult.success && companyResult.reports) {
            status.us_companies.success++;
            usReportMetadata.push(companyResult);
          } else {
            status.us_companies.failed++;
            status.errors.push(`${company.ticker} (US): 抓取失敗`);
          }
        } else {
          // 回退到舊方式（無可重入設計）
          // ⭐ V8.17.2 新增：判斷是否為初次分析
          const hasExistingReports = checkIfCompanyHasFinancialReports(company.ticker);
          const isInitialAnalysis = !hasExistingReports;
          const result = fetchSECFinancialReport(company.ticker, isInitialAnalysis);
          if (result && result.quarterly_reports && result.quarterly_reports.length > 0) {
            status.us_companies.success++;
            usReportMetadata.push({
              ticker: company.ticker,
              company_name: company.company_name,
              market: "US",
              reports: result.quarterly_reports
            });
          } else {
            status.us_companies.failed++;
            status.errors.push(`${company.ticker} (US): 抓取失敗`);
            markFinancialReportStatus(company.ticker, "US", "FAILED", jobId);
          }
        }
      } catch (error) {
        status.us_companies.failed++;
        status.errors.push(`${company.ticker} (US): ${error.message}`);
        if (typeof markFinancialReportCompanyFailed === 'function') {
          markFinancialReportCompanyFailed(jobId, company.ticker, error.message);
        } else {
          markFinancialReportStatus(company.ticker, "US", "FAILED", jobId);
        }
      }
    }
    
    // 3. 美股：立即進行 Flash 提取（優先從 GCS 讀取，如果沒有則使用 html_content）
    // ⭐ V8.17 地雷修復：可重入處理，每檔公司都是原子操作
    if (usReportMetadata.length > 0) {
      Logger.log(`P1 財報：開始提取 ${usReportMetadata.length} 檔美股財報（Flash 三欄位）`);
      for (const metadata of usReportMetadata) {
        try {
          // ⭐ V8.17 地雷修復：可重入處理提取階段
          if (typeof processFinancialReportCompanyReentrant === 'function') {
            const extractionResult = processFinancialReportCompanyReentrant(jobId, { ticker: metadata.ticker, market: "US" }, (comp) => {
              const extractionResults = [];
              for (const report of metadata.reports) {
                const filingPeriod = `${report.filing_date.substring(0, 4)}-Q${getQuarterFromDate(report.filing_date)}`;
                
                // ⭐ V8.17.1 新增：優先從 GCS 讀取，如果沒有則使用 html_content
                let contentForExtraction = null;
                let fileTypeForExtraction = "HTML";
                
                if (report.gcs_public_url) {
                  // 從 GCS 公開 URL 讀取
                  Logger.log(`P1 財報：從 GCS 讀取 ${comp.ticker} 財報（${filingPeriod}），URL=${report.gcs_public_url}`);
                  try {
                    contentForExtraction = readFileFromGCSPublicUrl(report.gcs_public_url, report.gcs_path);
                    if (contentForExtraction) {
                      Logger.log(`P1 財報：成功從 GCS 讀取 ${comp.ticker} 財報（${filingPeriod}），長度=${contentForExtraction.length} 字符`);
                    } else {
                      Logger.log(`P1 財報：從 GCS 讀取失敗，回退到 html_content（${comp.ticker}, ${filingPeriod}）`);
                      contentForExtraction = report.html_content;
                    }
                  } catch (gcsError) {
                    Logger.log(`P1 財報：從 GCS 讀取失敗，回退到 html_content（${comp.ticker}, ${filingPeriod}）：${gcsError.message}`);
                    contentForExtraction = report.html_content;
                  }
                } else if (report.gcs_path) {
                  // 如果有 gcs_path 但沒有公開 URL，嘗試構建公開 URL
                  // 格式：gs://bucket-name/path/to/file
                  const match = report.gcs_path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
                  if (match) {
                    const bucketName = match[1];
                    const objectPath = match[2];
                    const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
                    Logger.log(`P1 財報：嘗試使用構建的公開 URL：${publicUrl}`);
                    try {
                      contentForExtraction = readFileFromGCSPublicUrl(publicUrl, report.gcs_path);
                      if (!contentForExtraction) {
                        contentForExtraction = report.html_content;
                      }
                    } catch (gcsError) {
                      Logger.log(`P1 財報：從構建的公開 URL 讀取失敗，回退到 html_content：${gcsError.message}`);
                      contentForExtraction = report.html_content;
                    }
                  } else {
                    contentForExtraction = report.html_content;
                  }
                } else {
                  // 沒有 GCS 路徑，使用 html_content
                  contentForExtraction = report.html_content;
                }
                
                // 如果沒有內容，跳過
                if (!contentForExtraction) {
                  Logger.log(`P1 財報：${comp.ticker} (${filingPeriod}) 沒有可用內容，跳過提取`);
                  continue;
                }
                
                // 判斷文件類型（根據 URL 或內容）
                if (report.gcs_public_url && (report.gcs_public_url.endsWith('.pdf') || report.file_type === 'PDF')) {
                  // PDF 文件：優先使用 gcs_path（gs://），否則上傳到 Gemini File API
                  let extracted = null;
                  
                  if (report.gcs_path && report.gcs_path.startsWith("gs://") && report.gcs_path.endsWith('.pdf')) {
                    // ⭐ V8.17.7：優先使用 gs:// 路徑，直接傳給 Cloud Run /gemini-extract
                    Logger.log(`P1 財報：使用 GCS PDF 路徑進行提取（${comp.ticker}, ${filingPeriod}）：${report.gcs_path}`);
                    extracted = extractFinancialReportSegments(
                      report.gcs_path,
                      comp.ticker,
                      comp.market,
                      filingPeriod,
                      "PDF"
                    );
                  } else {
                    // 回退：上傳到 Gemini File API（舊方式，需要 API_KEY_GOOGLE）
                    Logger.log(`P1 財報：檢測到 PDF 文件，需要上傳到 Gemini File API（${comp.ticker}, ${filingPeriod}）`);
                    try {
                      // 將內容轉換為 Blob（如果是 PDF）
                      const pdfBlob = Utilities.newBlob(contentForExtraction, 'application/pdf');
                      const fileUri = uploadFileToGemini(pdfBlob, `${comp.ticker}_${filingPeriod}.pdf`);
                      
                      // 使用 Gemini File API 提取
                      extracted = extractFinancialReportSegments(
                        fileUri,
                        comp.ticker,
                        comp.market,
                        filingPeriod,
                        "PDF"
                      );
                      
                      // 刪除 Gemini 檔案
                      if (typeof deleteGeminiFile === 'function') {
                        deleteGeminiFile(fileUri);
                      } else {
                        deleteGeminiFile_P1(fileUri);
                      }
                    } catch (pdfError) {
                      Logger.log(`P1 財報：PDF 處理失敗（${comp.ticker}, ${filingPeriod}）：${pdfError.message}`);
                    }
                  }
                  
                  if (extracted) {
                    extractionResults.push({
                      filing_period: filingPeriod,
                      filing_type: report.filing_type,
                      filing_date: report.filing_date,
                      extracted_data: extracted
                    });
                  }
                } else {
                  // HTML 文件：優先使用 gcs_path（gs://），否則使用 HTML 內容
                  let fileUriForExtraction = null;
                  let fileTypeForExtraction = "HTML";
                  
                  if (report.gcs_path && report.gcs_path.startsWith("gs://")) {
                    // ⭐ V8.17.7：優先使用 gs:// 路徑，直接傳給 Cloud Run /gemini-extract
                    fileUriForExtraction = report.gcs_path;
                    fileTypeForExtraction = "HTML";
                    Logger.log(`P1 財報：使用 GCS 路徑進行提取（${comp.ticker}, ${filingPeriod}）：${fileUriForExtraction}`);
                  } else {
                    // 回退：使用 HTML 內容（舊方式，需要 API_KEY_GOOGLE）
                    fileUriForExtraction = contentForExtraction;
                    fileTypeForExtraction = "HTML";
                    Logger.log(`P1 財報：使用 HTML 內容進行提取（${comp.ticker}, ${filingPeriod}），長度=${contentForExtraction ? contentForExtraction.length : 0}`);
                  }
                  
                  const extracted = extractFinancialReportSegments(
                    fileUriForExtraction,
                    comp.ticker,
                    comp.market,
                    filingPeriod,
                    fileTypeForExtraction
                  );
                  if (extracted) {
                    extractionResults.push({
                      filing_period: filingPeriod,
                      filing_type: report.filing_type,
                      filing_date: report.filing_date,
                      extracted_data: extracted
                    });
                  }
                }
              }
              
              // 合併三季提取結果（選項 B：合併存儲）
              const mergedExtraction = mergeQuarterlyExtractions(extractionResults);
              
              // 保存到表格（原子操作）
              saveFinancialReportExtraction(comp.ticker, comp.market, mergedExtraction, jobId);
              
              return {
                success: true,
                reports_count: metadata.reports.length,
                extraction_results: extractionResults
              };
            });
            
            if (extractionResult.skipped) {
              Logger.log(`P1 財報可重入：跳過已處理提取（${metadata.ticker}）`);
              continue;
            }
            
            if (!extractionResult.success) {
              status.errors.push(`${metadata.ticker} (US): 提取失敗`);
            }
          } else {
            // 回退到舊方式（無可重入設計）
            const extractionResults = [];
            for (const report of metadata.reports) {
              const filingPeriod = `${report.filing_date.substring(0, 4)}-Q${getQuarterFromDate(report.filing_date)}`;
              
              // ⭐ V8.17.1 新增：優先從 GCS 讀取，如果沒有則使用 html_content
              let contentForExtraction = null;
              
              if (report.gcs_public_url) {
                try {
                  contentForExtraction = readFileFromGCSPublicUrl(report.gcs_public_url, report.gcs_path);
                  if (!contentForExtraction) {
                    contentForExtraction = report.html_content;
                  }
                } catch (gcsError) {
                  contentForExtraction = report.html_content;
                }
              } else {
                contentForExtraction = report.html_content;
              }
              
              if (!contentForExtraction) {
                continue;
              }
              
              // 提取邏輯（簡化版）
              let fileUriForExtraction = report.gcs_path && report.gcs_path.startsWith("gs://") ? 
                report.gcs_path : contentForExtraction;
              const fileType = report.file_type || "HTML";
              
              const extracted = extractFinancialReportSegments(
                fileUriForExtraction,
                metadata.ticker,
                metadata.market,
                filingPeriod,
                fileType
              );
              
              if (extracted) {
                extractionResults.push({
                  filing_period: filingPeriod,
                  filing_type: report.filing_type,
                  filing_date: report.filing_date,
                  extracted_data: extracted
                });
              }
            }
            
            // 合併三季提取結果
            const mergedExtraction = mergeQuarterlyExtractions(extractionResults);
            
            // 保存到表格
            saveFinancialReportExtraction(metadata.ticker, metadata.market, mergedExtraction, jobId);
          }
        } catch (error) {
          Logger.log(`P1 財報：提取 ${metadata.ticker} 失敗：${error.message}`);
          status.errors.push(`${metadata.ticker} (US): 提取失敗 - ${error.message}`);
          if (typeof markFinancialReportCompanyFailed === 'function') {
            markFinancialReportCompanyFailed(jobId, metadata.ticker, error.message);
          }
        }
      }
    }
    
    // 4. 台股/日股：創建 Google Drive 子資料夾
    if (twCompanies.length > 0) {
      Logger.log(`P1 財報：為 ${twCompanies.length} 檔台股創建 Google Drive 資料夾`);
      const folderResults = createFinancialReportFolders(twCompanies, "TW", jobId);
      status.tw_companies.folders_created = folderResults.created;
      status.tw_companies.pending = folderResults.pending;
    }
    
    if (jpCompanies.length > 0) {
      Logger.log(`P1 財報：為 ${jpCompanies.length} 檔日股創建 Google Drive 資料夾`);
      const folderResults = createFinancialReportFolders(jpCompanies, "JP", jobId);
      status.jp_companies.folders_created = folderResults.created;
      status.jp_companies.pending = folderResults.pending;
    }
    
    Logger.log(`P1 財報下載階段完成：美股 ${status.us_companies.success}/${status.us_companies.total} 成功`);
    
    return status;
    
  } catch (error) {
    Logger.log(`P1 財報下載階段失敗：${error.message}`);
    status.errors.push(`整體錯誤：${error.message}`);
    return status;
  }
}

/**
 * 創建 Google Drive 子資料夾（台股/日股）
 * @param {Array} companies - 公司清單
 * @param {string} market - 市場（TW/JP）
 * @param {string} jobId - Job ID
 * @return {Object} 創建結果
 */
function createFinancialReportFolders(companies, market, jobId) {
  const result = { created: 0, pending: 0, errors: [] };
  
  try {
    // 獲取母資料夾 ID（從配置或 PropertiesService）
    const parentFolderId = getFinancialReportParentFolderId();
    if (!parentFolderId) {
      throw new Error("未配置 Google Drive 母資料夾 ID");
    }
    
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const marketFolderName = market === "TW" ? "台股" : "日股";
    
    // 創建市場資料夾（如果不存在）
    let marketFolder;
    const existingFolders = parentFolder.getFoldersByName(marketFolderName);
    if (existingFolders.hasNext()) {
      marketFolder = existingFolders.next();
    } else {
      marketFolder = parentFolder.createFolder(marketFolderName);
    }
    
    // 為每個公司創建子資料夾
    for (const company of companies) {
      try {
        // ⭐ V8.17.1 修正：資料夾名稱使用股票代號格式（例如：2330.tw, 3436.jp）
        const marketSuffix = market.toLowerCase();  // tw 或 jp
        const folderName = `${company.ticker}.${marketSuffix}`;
        const existingCompanyFolders = marketFolder.getFoldersByName(folderName);
        
        if (!existingCompanyFolders.hasNext()) {
          const companyFolder = marketFolder.createFolder(folderName);
          result.created++;
          
          // 保存資料夾資訊
          saveFinancialReportFolderInfo(company.ticker, market, companyFolder.getId(), jobId);
        } else {
          // 資料夾已存在，檢查是否有 PDF
          const companyFolder = existingCompanyFolders.next();
          const pdfFiles = companyFolder.getFilesByType(MimeType.PDF);
          if (!pdfFiles.hasNext()) {
            result.pending++;
            saveFinancialReportFolderInfo(company.ticker, market, companyFolder.getId(), jobId);
          }
        }
      } catch (error) {
        result.errors.push(`${company.ticker}: ${error.message}`);
      }
    }
    
    Logger.log(`P1 財報：${marketFolderName} 創建 ${result.created} 個資料夾，${result.pending} 個待處理`);
    return result;
    
  } catch (error) {
    Logger.log(`P1 財報：創建 ${market} 資料夾失敗：${error.message}`);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * 獲取 Google Drive 母資料夾 ID（從 PropertiesService 或配置）
 * @return {string|null} 母資料夾 ID
 */
function getFinancialReportParentFolderId() {
  // 優先從 PropertiesService 讀取
  const properties = PropertiesService.getScriptProperties();
  let folderId = properties.getProperty("FINANCIAL_REPORT_PARENT_FOLDER_ID");
  
  if (!folderId) {
    // 如果沒有配置，返回 null（需要人工配置）
    Logger.log("警告：未配置 FINANCIAL_REPORT_PARENT_FOLDER_ID");
    Logger.log("請使用 BUTTON_SetFinancialReportParentFolder() 函數或執行以下命令設置：");
    Logger.log("P1_SetFinancialReportParentFolder('YOUR_FOLDER_ID')");
  }
  
  return folderId;
}

/**
 * 保存財報資料夾資訊
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {string} folderId - Google Drive 資料夾 ID
 * @param {string} jobId - Job ID
 */
function saveFinancialReportFolderInfo(ticker, market, folderId, jobId) {
  // 保存到 PropertiesService 或臨時表格
  const properties = PropertiesService.getScriptProperties();
  const key = `P1_FOLDER_${ticker}_${market}_${jobId}`;
  properties.setProperty(key, folderId);
  Logger.log(`P1 財報：保存 ${ticker} (${market}) 資料夾資訊：${folderId}`);
}

/**
 * 掃描 Google Drive 子資料夾中的 PDF 並提取
 * @param {string} jobId - Job ID
 * @return {Object} 掃描結果
 */
function P1_ScanAndExtractDrivePDFs(jobId) {
  const result = {
    scanned: 0,
    extracted: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // 1. 從 PropertiesService 讀取所有資料夾資訊
    const properties = PropertiesService.getScriptProperties();
    const allKeys = properties.getKeys();
    const folderKeys = allKeys.filter(key => key.startsWith(`P1_FOLDER_`) && key.endsWith(`_${jobId}`));
    
    Logger.log(`P1 財報：找到 ${folderKeys.length} 個資料夾需要掃描`);
    
    for (const key of folderKeys) {
      try {
        const folderId = properties.getProperty(key);
        if (!folderId) continue;
        
        // 解析 ticker 和 market
        const parts = key.replace(`P1_FOLDER_`, '').replace(`_${jobId}`, '').split('_');
        const market = parts.pop();
        const ticker = parts.join('_');
        
        // 掃描資料夾中的 PDF
        const folder = DriveApp.getFolderById(folderId);
        const pdfFiles = folder.getFilesByType(MimeType.PDF);
        
        if (!pdfFiles.hasNext()) {
          Logger.log(`P1 財報：${ticker} (${market}) 資料夾中沒有 PDF`);
          continue;
        }
        
        result.scanned++;
        
        // 處理每個 PDF
        const pdfList = [];
        while (pdfFiles.hasNext()) {
          pdfList.push(pdfFiles.next());
        }
        
        // 批次處理 PDF（最多處理最新三季）
        const sortedPDFs = pdfList.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
        const latestThreePDFs = sortedPDFs.slice(0, 3);
        
        const extractionResults = [];
        for (const pdfFile of latestThreePDFs) {
          try {
            // 上傳到 Gemini File API
            const pdfBlob = pdfFile.getBlob();
            const fileUri = uploadFileToGemini(pdfBlob, pdfFile.getName());
            
            // 推斷財報期間（從檔名或日期）
            const filingPeriod = inferFilingPeriodFromFileName(pdfFile.getName(), pdfFile.getDateCreated());
            
            // Flash 提取
            const extracted = extractFinancialReportSegments(
              fileUri,
              ticker,
              market,
              filingPeriod,
              "PDF"
            );
            
            if (extracted) {
              extractionResults.push({
                filing_period: filingPeriod,
                filing_type: "PDF",
                filing_date: pdfFile.getDateCreated().toISOString().split('T')[0],
                extracted_data: extracted
              });
            }
            
            // 刪除 Gemini 檔案（使用全局函數，如果不存在則使用本地版本）
            if (typeof deleteGeminiFile === 'function') {
              deleteGeminiFile(fileUri);
            } else {
              deleteGeminiFile_P1(fileUri);
            }
            
          } catch (error) {
            Logger.log(`P1 財報：處理 ${ticker} (${market}) PDF ${pdfFile.getName()} 失敗：${error.message}`);
            result.errors.push(`${ticker} (${market}): ${pdfFile.getName()} - ${error.message}`);
          }
        }
        
        if (extractionResults.length > 0) {
          // 合併三季提取結果
          const mergedExtraction = mergeQuarterlyExtractions(extractionResults);
          
          // 保存到表格
          saveFinancialReportExtraction(ticker, market, mergedExtraction, jobId);
          result.extracted++;
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push(`處理資料夾 ${key} 失敗：${error.message}`);
      }
    }
    
    Logger.log(`P1 財報掃描完成：掃描 ${result.scanned} 個，提取 ${result.extracted} 個，失敗 ${result.failed} 個`);
    return result;
    
  } catch (error) {
    Logger.log(`P1 財報掃描失敗：${error.message}`);
    result.errors.push(`整體錯誤：${error.message}`);
    return result;
  }
}

/**
 * ⭐ V8.17.1 新增：UI 按鈕函數 - 掃描並提取 Google Drive 中的 PDF，然後觸發 Step 2
 * 
 * 使用方式：
 * 1. 在 GAS 編輯器中執行此函數
 * 2. 或在 Google Sheets 中創建按鈕並綁定此函數
 * 
 * @return {string} 執行結果訊息
 */
function BUTTON_P1_ScanPDFsAndContinueStep2() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // 1. 獲取最新的 P1 Step 1 結果（從快照或表格）
    const p1Snapshot = getLatestP1Snapshot();
    if (!p1Snapshot) {
      ui.alert('錯誤', '找不到 P1 Step 1 的結果。請先執行 P1 Step 1。', ui.ButtonSet.OK);
      return "錯誤：找不到 P1 Step 1 的結果";
    }
    
    // 2. 從快照中提取 company_pool
    let companyPool = [];
    if (p1Snapshot.p1_output_json) {
      const p1Output = typeof p1Snapshot.p1_output_json === 'string' ?
        JSON.parse(p1Snapshot.p1_output_json) : p1Snapshot.p1_output_json;
      companyPool = p1Output.company_pool || [];
    }
    
    // 如果快照中沒有，嘗試從 Phase1_Company_Pool 表格讀取
    if (companyPool.length === 0) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("Phase1_Company_Pool");
      if (sheet && sheet.getLastRow() > 1) {
        const dataRange = sheet.getDataRange();
        const rows = dataRange.getValues();
        const headers = rows[0];
        const tickerCol = headers.indexOf("Company_Code");
        const nameCol = headers.indexOf("Company_Name");
        const marketCol = headers.indexOf("Market");
        
        for (let i = 1; i < rows.length; i++) {
          companyPool.push({
            ticker: rows[i][tickerCol],
            company_name: rows[i][nameCol],
            market: rows[i][marketCol]
          });
        }
      }
    }
    
    if (companyPool.length === 0) {
      ui.alert('錯誤', '找不到公司池數據。請先執行 P1 Step 1。', ui.ButtonSet.OK);
      return "錯誤：找不到公司池數據";
    }
    
    // 3. 獲取 jobId（從快照或使用默認值）
    const jobId = p1Snapshot.snapshot_id || `P1_${Date.now()}`;
    
    // 4. 掃描並提取 PDF
    ui.alert('開始掃描', `正在掃描 Google Drive 中的 PDF 文件（共 ${companyPool.length} 檔公司）...`, ui.ButtonSet.OK);
    Logger.log(`P1 UI：開始掃描 PDF，jobId=${jobId}`);
    
    const scanResult = P1_ScanAndExtractDrivePDFs(jobId);
    
    Logger.log(`P1 UI：PDF 掃描完成，掃描=${scanResult.scanned}，提取=${scanResult.extracted}，失敗=${scanResult.failed}`);
    
    if (scanResult.errors.length > 0) {
      Logger.log(`P1 UI：掃描錯誤：${scanResult.errors.join('; ')}`);
    }
    
    // 5. 構建 step1Result（用於 Step 2）
    const step1Result = {
      status: "COMPLETED",
      job_id: jobId,
      company_pool: companyPool,
      summary: {},
      financial_report_status: {
        scanned: scanResult.scanned,
        extracted: scanResult.extracted,
        failed: scanResult.failed
      }
    };
    
    // 6. 構建 params（用於 Step 2）
    const params = {
      trigger: p1Snapshot.trigger || "QUARTERLY",
      p0_snapshot_id: p1Snapshot.p0_snapshot_id || null,
      p0_5_snapshot_id: p1Snapshot.p0_5_snapshot_id || null,
      p0_7_snapshot_id: p1Snapshot.p0_7_snapshot_id || null,
      context: {
        test_mode: false  // 正式模式
      }
    };
    
    // 7. 觸發 Step 2
    Logger.log(`P1 UI：開始執行 Step 2（結構分級）`);
    ui.alert('開始 Step 2', 'PDF 掃描完成，正在觸發 Step 2（結構分級）...', ui.ButtonSet.OK);
    
    const step2Result = P1_ExecuteStep2(step1Result, params);
    
    // 8. 顯示結果
    const message = `PDF 掃描完成：
- 掃描：${scanResult.scanned} 個資料夾
- 提取：${scanResult.extracted} 個財報
- 失敗：${scanResult.failed} 個

Step 2 狀態：${step2Result.status || "未知"}
${step2Result.message || ""}`;
    
    ui.alert('執行完成', message, ui.ButtonSet.OK);
    
    return message;
    
  } catch (error) {
    Logger.log(`P1 UI：執行失敗：${error.message}`);
    Logger.log(`P1 UI：錯誤堆疊：${error.stack}`);
    ui.alert('執行失敗', `錯誤：${error.message}`, ui.ButtonSet.OK);
    return `錯誤：${error.message}`;
  }
}

/**
 * 從檔名推斷財報期間
 * @param {string} fileName - 檔名
 * @param {Date} fileDate - 檔案日期
 * @return {string} 財報期間（例如：2025-Q1）
 */
function inferFilingPeriodFromFileName(fileName, fileDate) {
  // 嘗試從檔名提取年份和季度
  const yearMatch = fileName.match(/(20\d{2})/);
  const quarterMatch = fileName.match(/[Qq]?([1-4])/);
  
  if (yearMatch && quarterMatch) {
    return `${yearMatch[1]}-Q${quarterMatch[1]}`;
  }
  
  // 如果無法從檔名推斷，使用檔案日期
  const year = fileDate.getFullYear();
  const month = fileDate.getMonth() + 1;
  let quarter = 1;
  if (month >= 1 && month <= 3) quarter = 1;
  else if (month >= 4 && month <= 6) quarter = 2;
  else if (month >= 7 && month <= 9) quarter = 3;
  else quarter = 4;
  
  return `${year}-Q${quarter}`;
}

/**
 * 刪除 Gemini File API 檔案
 * @param {string} fileUri - Gemini File API URI
 * 
 * ⚠️ 注意：如果 09_P0_VALIDATION.js 中已有此函數，此處為重複定義（GAS 全局作用域會覆蓋）
 * 建議統一使用 09_P0_VALIDATION.js 中的版本
 */
function deleteGeminiFile_P1(fileUri) {
  try {
    const apiKey = getAPIKey("GOOGLE");
    const fileId = fileUri.replace("files/", "");
    const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`;
    
    const response = UrlFetchApp.fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "x-goog-api-key": apiKey
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      Logger.log(`P1 財報：已刪除 Gemini 檔案 ${fileId}`);
    } else {
      Logger.log(`P1 財報：刪除 Gemini 檔案失敗：${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`P1 財報：刪除 Gemini 檔案時發生錯誤：${error.message}`);
  }
}

/**
 * 保存財報元數據
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {Object} reportData - 財報數據
 * @param {string} jobId - Job ID
 */
function saveFinancialReportMetadata(ticker, market, reportData, jobId) {
  // 保存到 Financial_Reports_Metadata 表格
  Logger.log(`P1 財報：保存 ${ticker} (${market}) 財報元數據`);
}

/**
 * 標記財報狀態
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {string} status - 狀態（FAILED/PENDING/EXTRACTED）
 * @param {string} jobId - Job ID
 */
function markFinancialReportStatus(ticker, market, status, jobId) {
  Logger.log(`P1 財報：標記 ${ticker} (${market}) 狀態為 ${status}`);
}

/**
 * ⭐ V8.17.2 新增：檢查公司是否已有財報資料（判斷是否為初次分析）
 * @param {string} ticker - 股票代號
 * @return {boolean} hasReports - 是否已有財報資料
 */
function checkIfCompanyHasFinancialReports(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return false;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const tickerCol = headers.indexOf("Company_Code");
    const extractionStatusCol = headers.indexOf("Extraction_Status");
    
    if (tickerCol === -1) {
      return false;
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker) {
        // 檢查是否有提取狀態
        if (extractionStatusCol !== -1 && rows[i][extractionStatusCol]) {
          const status = rows[i][extractionStatusCol];
          if (status === "EXTRACTED" || status === "COMPLETED") {
            return true;
          }
        }
        // 檢查是否有P1/P2/P3證據
        const p1Col = headers.indexOf("P1_Industry_Evidence_JSON");
        if (p1Col !== -1 && rows[i][p1Col]) {
          return true;
        }
        break;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log(`檢查公司財報資料失敗（${ticker}）：${error.message}`);
    return false;  // 預設為初次分析
  }
}

/**
 * ⭐ V8.17.2 新增：從 master index 獲取最新N個10-Q
 * @param {string|number} cikInt - CIK（不補零）
 * @param {number} n - 需要的10-Q數量
 * @return {Array} 最新N個10-Q列表
 */
function findLatestN10QsFromIndex_(cikInt, n) {
  const cikNum = parseInt(cikInt, 10);
  const quarters = recentQuarters_(4);  // 檢查最近4季
  const found10Qs = [];
  
  for (const {year, qtr} of quarters) {
    if (found10Qs.length >= n) break;
    
    try {
      const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${qtr}/master.gz`;
      const text = fetchTextGz_(url);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (found10Qs.length >= n) break;
        
        if (!line || line.indexOf('|') === -1) continue;
        const parts = line.split('|');
        if (parts.length < 5) continue;
        
        const lineCik = parseInt(parts[0].trim(), 10);
        if (lineCik !== cikNum) continue;
        
        const form = parts[2].trim();
        if (form === "10-Q") {
          found10Qs.push({
            cik: parts[0].trim(),
            companyName: parts[1] ? parts[1].trim() : '',
            form: form,
            dateFiled: parts[3].trim(),
            filename: parts[4].trim()
          });
        }
      }
    } catch (error) {
      Logger.log(`P1 財報：查找10-Q失敗（${year} Q${qtr}）：${error.message}`);
    }
  }
  
  // 按日期排序，取最新的N個
  found10Qs.sort((a, b) => {
    const dateA = new Date(a.dateFiled);
    const dateB = new Date(b.dateFiled);
    return dateB - dateA;  // 降序
  });
  
  Logger.log(`P1 財報：找到 ${found10Qs.length} 個10-Q，取最新 ${n} 個`);
  return found10Qs.slice(0, n);
}

/**
 * 從日期獲取季度
 * @param {string} dateString - 日期字串（YYYY-MM-DD）
 * @return {number} 季度（1-4）
 */
function getQuarterFromDate(dateString) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;  // 1-12
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
}

/**
 * 合併三季提取結果（選項 B：合併存儲）
 * @param {Array} extractionResults - 各季提取結果
 * @return {Object} 合併後的提取結果
 */
function mergeQuarterlyExtractions(extractionResults) {
  const merged = {
    p1_industry_evidence: [],
    p2_financial_evidence: [],
    p3_technical_evidence: []
  };
  
  for (const result of extractionResults) {
    const extracted = result.extracted_data;
    if (extracted) {
      // 合併 P1 證據（標註季度）
      if (extracted.p1_industry_evidence) {
        for (const evidence of extracted.p1_industry_evidence) {
          merged.p1_industry_evidence.push({
            ...evidence,
            filing_period: result.filing_period,
            filing_type: result.filing_type,
            filing_date: result.filing_date
          });
        }
      }
      
      // 合併 P2 證據（標註季度）
      if (extracted.p2_financial_evidence) {
        for (const evidence of extracted.p2_financial_evidence) {
          merged.p2_financial_evidence.push({
            ...evidence,
            filing_period: result.filing_period,
            filing_type: result.filing_type,
            filing_date: result.filing_date
          });
        }
      }
      
      // 合併 P3 證據（標註季度）
      if (extracted.p3_technical_evidence) {
        for (const evidence of extracted.p3_technical_evidence) {
          merged.p3_technical_evidence.push({
            ...evidence,
            filing_period: result.filing_period,
            filing_type: result.filing_type,
            filing_date: result.filing_date
          });
        }
      }
    }
  }
  
  return merged;
}

/**
 * ⭐ V8.19 新增：過濾最新三季的證據資料
 * ⭐ V8.17.4 更新：保留此函數名稱（向後兼容），但實際仍保留最新三季
 * @param {Array} evidenceList - 證據列表（每個證據包含 filing_period 或 filing_date）
 * @return {Array} 最新三季的證據列表
 */
function filterLatestThreeQuarters(evidenceList) {
  if (!evidenceList || evidenceList.length === 0) {
    return [];
  }
  
  // 提取所有唯一的季度（從 filing_period 或 filing_date 推斷）
  const quarterMap = new Map();
  
  for (const evidence of evidenceList) {
    let quarterKey = null;
    let quarterDate = null;
    
    if (evidence.filing_period) {
      // 格式：2025-Q1 或 2025Q1
      const match = evidence.filing_period.match(/(\d{4})[-\s]?Q(\d)/);
      if (match) {
        const year = parseInt(match[1]);
        const quarter = parseInt(match[2]);
        quarterKey = `${year}Q${quarter}`;
        quarterDate = new Date(year, (quarter - 1) * 3, 1);
      }
    } else if (evidence.filing_date) {
      // 從日期推斷季度
      const date = new Date(evidence.filing_date);
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      quarterKey = `${year}Q${quarter}`;
      quarterDate = new Date(year, (quarter - 1) * 3, 1);
    }
    
    if (quarterKey && quarterDate) {
      if (!quarterMap.has(quarterKey) || quarterMap.get(quarterKey).date < quarterDate) {
        quarterMap.set(quarterKey, { date: quarterDate, key: quarterKey });
      }
    }
  }
  
  // 排序並取最新三季
  const sortedQuarters = Array.from(quarterMap.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 3)
    .map(q => q.key);
  
  // 過濾證據：只保留最新三季的
  return evidenceList.filter(evidence => {
    let quarterKey = null;
    
    if (evidence.filing_period) {
      const match = evidence.filing_period.match(/(\d{4})[-\s]?Q(\d)/);
      if (match) {
        quarterKey = `${match[1]}Q${match[2]}`;
      }
    } else if (evidence.filing_date) {
      const date = new Date(evidence.filing_date);
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      quarterKey = `${year}Q${quarter}`;
    }
    
    return quarterKey && sortedQuarters.includes(quarterKey);
  });
}

/**
 * ⭐ V8.19 新增：從 Phase1_Company_Pool 讀取最新三季的證據資料（供後續分析使用）
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @return {Object} 最新三季的證據 { p1_industry_evidence, p2_financial_evidence, p3_technical_evidence }
 */
function getLatestThreeQuartersEvidence(ticker, market) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet) {
      Logger.log(`P1 財報：Phase1_Company_Pool 表格不存在`);
      return { p1_industry_evidence: [], p2_financial_evidence: [], p3_technical_evidence: [] };
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
      Logger.log(`P1 財報：找不到 Company_Code 或 Market 欄位`);
      return { p1_industry_evidence: [], p2_financial_evidence: [], p3_technical_evidence: [] };
    }
    
    // 查找對應的公司記錄
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker && rows[i][marketCol] === market) {
        let p1Evidence = [];
        let p2Evidence = [];
        let p3Evidence = [];
        
        if (p1Col !== -1 && rows[i][p1Col]) {
          try {
            p1Evidence = typeof rows[i][p1Col] === 'string' 
              ? JSON.parse(rows[i][p1Col]) 
              : rows[i][p1Col];
            if (!Array.isArray(p1Evidence)) p1Evidence = [];
          } catch (e) {
            Logger.log(`P1 財報：解析 P1 證據失敗：${e.message}`);
            p1Evidence = [];
          }
        }
        
        if (p2Col !== -1 && rows[i][p2Col]) {
          try {
            p2Evidence = typeof rows[i][p2Col] === 'string' 
              ? JSON.parse(rows[i][p2Col]) 
              : rows[i][p2Col];
            if (!Array.isArray(p2Evidence)) p2Evidence = [];
          } catch (e) {
            Logger.log(`P1 財報：解析 P2 證據失敗：${e.message}`);
            p2Evidence = [];
          }
        }
        
        if (p3Col !== -1 && rows[i][p3Col]) {
          try {
            p3Evidence = typeof rows[i][p3Col] === 'string' 
              ? JSON.parse(rows[i][p3Col]) 
              : rows[i][p3Col];
            if (!Array.isArray(p3Evidence)) p3Evidence = [];
          } catch (e) {
            Logger.log(`P1 財報：解析 P3 證據失敗：${e.message}`);
            p3Evidence = [];
          }
        }
        
        // 過濾最新三季
        return {
          p1_industry_evidence: filterLatestThreeQuarters(p1Evidence),
          p2_financial_evidence: filterLatestThreeQuarters(p2Evidence),
          p3_technical_evidence: filterLatestThreeQuarters(p3Evidence)
        };
      }
    }
    
    Logger.log(`P1 財報：找不到 ${ticker} (${market}) 的記錄`);
    return { p1_industry_evidence: [], p2_financial_evidence: [], p3_technical_evidence: [] };
    
  } catch (error) {
    Logger.log(`P1 財報：讀取證據失敗（${ticker}, ${market}）：${error.message}`);
    return { p1_industry_evidence: [], p2_financial_evidence: [], p3_technical_evidence: [] };
  }
}

/**
 * ⭐ V8.19 N1 新增：財報提取完整性檢查
 * 檢查必含章節（P1/P2/P3），缺失時標記 INCOMPLETE_EXTRACTION
 * @param {Object} extractedData - 提取結果
 * @returns {Object} { valid: boolean, incomplete_reasons: string[], extractedData }
 */
function validateFinancialReportExtraction(extractedData) {
  const reasons = [];
  const p1 = extractedData && extractedData.p1_industry_evidence;
  const p2 = extractedData && extractedData.p2_financial_evidence;
  const p3 = extractedData && extractedData.p3_technical_evidence;
  
  if (!Array.isArray(p1)) reasons.push("P1_產業證據缺失或非陣列");
  if (!Array.isArray(p2)) reasons.push("P2_財務證據缺失或非陣列");
  if (!Array.isArray(p3)) reasons.push("P3_技術證據缺失或非陣列");
  
  const allEmpty = (!p1 || p1.length === 0) && (!p2 || p2.length === 0) && (!p3 || p3.length === 0);
  if (allEmpty) reasons.push("P1/P2/P3 三欄位皆為空");
  
  const valid = reasons.length === 0;
  if (!valid) {
    const data = { ...extractedData };
    data.INCOMPLETE_EXTRACTION = true;
    data.incomplete_reasons = reasons;
    return { valid: false, incomplete_reasons: reasons, extractedData: data };
  }
  return { valid: true, incomplete_reasons: [], extractedData: extractedData };
}

/**
 * 保存財報提取結果到表格
 * ⭐ V8.19 更新：合併多季資料，保留最新三季；N1 新增：提取後完整性檢查與 INCOMPLETE_EXTRACTION 標記
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {Object} extractedData - 提取結果（新資料）
 * @param {string} jobId - Job ID
 */
function saveFinancialReportExtraction(ticker, market, extractedData, jobId) {
  try {
    // ⭐ V8.19 N1：Flash 提取後完整性檢查
    const validation = validateFinancialReportExtraction(extractedData);
    extractedData = validation.extractedData;
    if (!validation.valid) {
      Logger.log(`P1 財報：${ticker} (${market}) 提取不完整：${validation.incomplete_reasons.join("; ")}，已標記 INCOMPLETE_EXTRACTION`);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet) {
      Logger.log(`P1 財報：Phase1_Company_Pool 表格不存在，無法保存提取結果`);
      return;
    }
    
    // 查找該公司的記錄
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const tickerCol = headers.indexOf("Company_Code");
    const marketCol = headers.indexOf("Market");
    
    if (tickerCol === -1 || marketCol === -1) {
      Logger.log(`P1 財報：找不到 Company_Code 或 Market 欄位`);
      return;
    }
    
    // 查找對應的公司記錄（支持多種市場代碼格式）
    let foundRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowTicker = rows[i][tickerCol];
      const rowMarket = rows[i][marketCol];
      
      // ⭐ V8.17.4 新增：支持多種市場代碼格式匹配
      const tickerMatch = rowTicker === ticker || 
                          rowTicker === `${ticker}.${market.toLowerCase()}` ||
                          rowTicker === `${ticker}.${market}`;
      
      const marketMatch = rowMarket === market || 
                         rowMarket === market.toUpperCase() ||
                         rowMarket === market.toLowerCase() ||
                         (market === "TW" && (rowMarket === "台股" || rowMarket === "tw")) ||
                         (market === "JP" && (rowMarket === "日股" || rowMarket === "jp")) ||
                         (market === "US" && (rowMarket === "美股" || rowMarket === "us"));
      
      if (tickerMatch && marketMatch) {
        foundRowIndex = i;
        break;
      }
    }
    
    if (foundRowIndex > 0) {
      // 找到記錄，讀取現有資料並合併
      const i = foundRowIndex;
      const p1Col = headers.indexOf("P1_Industry_Evidence_JSON");
      const p2Col = headers.indexOf("P2_Financial_Evidence_JSON");
      const p3Col = headers.indexOf("P3_Technical_Evidence_JSON");
      const statusCol = headers.indexOf("Financial_Report_Extraction_Status");
        
        // 讀取現有資料
        let existingP1 = [];
        let existingP2 = [];
        let existingP3 = [];
        
        if (p1Col !== -1 && rows[i][p1Col]) {
          try {
            existingP1 = typeof rows[i][p1Col] === 'string' 
              ? JSON.parse(rows[i][p1Col]) 
              : rows[i][p1Col];
            if (!Array.isArray(existingP1)) existingP1 = [];
          } catch (e) {
            Logger.log(`P1 財報：解析現有 P1 證據失敗：${e.message}`);
            existingP1 = [];
          }
        }
        
        if (p2Col !== -1 && rows[i][p2Col]) {
          try {
            existingP2 = typeof rows[i][p2Col] === 'string' 
              ? JSON.parse(rows[i][p2Col]) 
              : rows[i][p2Col];
            if (!Array.isArray(existingP2)) existingP2 = [];
          } catch (e) {
            Logger.log(`P1 財報：解析現有 P2 證據失敗：${e.message}`);
            existingP2 = [];
          }
        }
        
        if (p3Col !== -1 && rows[i][p3Col]) {
          try {
            existingP3 = typeof rows[i][p3Col] === 'string' 
              ? JSON.parse(rows[i][p3Col]) 
              : rows[i][p3Col];
            if (!Array.isArray(existingP3)) existingP3 = [];
          } catch (e) {
            Logger.log(`P1 財報：解析現有 P3 證據失敗：${e.message}`);
            existingP3 = [];
          }
        }
        
        // 合併新舊資料
        const mergedP1 = [...existingP1, ...(extractedData.p1_industry_evidence || [])];
        const mergedP2 = [...existingP2, ...(extractedData.p2_financial_evidence || [])];
        const mergedP3 = [...existingP3, ...(extractedData.p3_technical_evidence || [])];
        
        // ⭐ V8.19：過濾並保留最新三季
        const filteredP1 = filterLatestThreeQuarters(mergedP1);
        const filteredP2 = filterLatestThreeQuarters(mergedP2);
        const filteredP3 = filterLatestThreeQuarters(mergedP3);
        
        // ⭐ V8.17.4 新增：防止超過 Google Sheets 50000 字元限制（智能截斷策略）
        const MAX_CELL_CHARS = 45000;  // 留 5000 字元緩衝
        const MAX_EVIDENCE_CONTENT_CHARS = 2000;  // 單個證據內容最大長度（保留完整段落）
        
        /**
         * 智能截斷證據：優先保留所有證據條目，只截斷單個證據的內容
         * @param {Array} evidenceList - 證據列表
         * @param {string} evidenceType - 證據類型（用於日誌）
         * @returns {Object} { truncated: 截斷後的證據列表, wasTruncated: 是否進行了截斷, originalCount: 原始數量 }
         */
        function smartTruncateEvidence(evidenceList, evidenceType) {
          if (!evidenceList || evidenceList.length === 0) {
            return { truncated: [], wasTruncated: false, originalCount: 0 };
          }
          
          const originalCount = evidenceList.length;
          let truncated = evidenceList.map(evidence => {
            // 如果證據有 content 字段且過長，截斷 content
            if (evidence.content && typeof evidence.content === 'string' && evidence.content.length > MAX_EVIDENCE_CONTENT_CHARS) {
              return {
                ...evidence,
                content: evidence.content.substring(0, MAX_EVIDENCE_CONTENT_CHARS) + '...[內容已截斷]',
                _truncated: true  // 標記已截斷
              };
            }
            return evidence;
          });
          
          // 檢查總長度
          let jsonStr = JSON.stringify(truncated);
          let wasTruncated = false;
          
          if (jsonStr.length > MAX_CELL_CHARS) {
            Logger.log(`P1 財報：${ticker} ${evidenceType} 證據過長（${jsonStr.length} 字元），開始移除最長證據...`);
            wasTruncated = true;
            
            // 如果截斷內容後仍然超過限制，按證據長度排序，逐步移除最長的
            truncated = [...truncated].sort((a, b) => {
              const aLen = JSON.stringify(a).length;
              const bLen = JSON.stringify(b).length;
              return aLen - bLen;  // 短的在前
            });
            
            // 逐步移除最長的證據，直到符合限制
            while (truncated.length > 0 && JSON.stringify(truncated).length > MAX_CELL_CHARS) {
              const removed = truncated.pop();
              Logger.log(`P1 財報：${ticker} ${evidenceType} 移除最長證據（${JSON.stringify(removed).length} 字元）`);
            }
            
            jsonStr = JSON.stringify(truncated);
            Logger.log(`P1 財報：${ticker} ${evidenceType} 證據已截斷至 ${truncated.length} 條（原始 ${originalCount} 條，${jsonStr.length} 字元）`);
          } else {
            // 檢查是否有單個證據被截斷
            const hasTruncatedContent = truncated.some(e => e._truncated);
            if (hasTruncatedContent) {
              wasTruncated = true;
              Logger.log(`P1 財報：${ticker} ${evidenceType} 證據內容已截斷（保留所有 ${originalCount} 條證據，但部分內容已截斷）`);
            }
          }
          
          // 移除臨時標記
          truncated = truncated.map(e => {
            const { _truncated, ...rest } = e;
            return rest;
          });
          
          return { truncated, wasTruncated, originalCount };
        }
        
        // 處理 P1 證據
        const p1Result = smartTruncateEvidence(filteredP1, "P1");
        const finalP1 = p1Result.truncated;
        const p1Truncated = p1Result.wasTruncated;
        const p1Json = JSON.stringify(finalP1);
        
        // 處理 P2 證據
        const p2Result = smartTruncateEvidence(filteredP2, "P2");
        const finalP2 = p2Result.truncated;
        const p2Truncated = p2Result.wasTruncated;
        const p2Json = JSON.stringify(finalP2);
        
        // 處理 P3 證據
        const p3Result = smartTruncateEvidence(filteredP3, "P3");
        const finalP3 = p3Result.truncated;
        const p3Truncated = p3Result.wasTruncated;
        const p3Json = JSON.stringify(finalP3);
        
        // 保存合併後的資料
        if (p1Col !== -1) {
          sheet.getRange(i + 1, p1Col + 1).setValue(p1Json);
        }
        if (p2Col !== -1) {
          sheet.getRange(i + 1, p2Col + 1).setValue(p2Json);
        }
        if (p3Col !== -1) {
          sheet.getRange(i + 1, p3Col + 1).setValue(p3Json);
        }
        if (statusCol !== -1) {
          sheet.getRange(i + 1, statusCol + 1).setValue(extractedData.INCOMPLETE_EXTRACTION ? "INCOMPLETE_EXTRACTION" : "EXTRACTED");
        }
        
        const truncationNote = p1Truncated || p2Truncated || p3Truncated 
          ? `（已截斷：P1=${p1Truncated ? '是' : '否'}, P2=${p2Truncated ? '是' : '否'}, P3=${p3Truncated ? '是' : '否'}）` 
          : '';
        Logger.log(`P1 財報：已保存 ${ticker} (${market}) 的提取結果（P1=${finalP1.length} 條，P2=${finalP2.length} 條，P3=${finalP3.length} 條，保留最新三季證據）${truncationNote}`);
        return;
    }
    
    // ⭐ V8.17.4 新增：如果找不到記錄，自動創建基本記錄（用於台股/日股手動下載）
    Logger.log(`P1 財報：找不到 ${ticker} (${market}) 的記錄，自動創建基本記錄...`);
    
    try {
      // 創建基本記錄
      // ⭐ V8.17.4 新增：從表格讀取 headers（如果 PHASE1_COMPANY_POOL_SCHEMA 不存在）
      let headers = null;
      if (typeof PHASE1_COMPANY_POOL_SCHEMA !== 'undefined' && PHASE1_COMPANY_POOL_SCHEMA && PHASE1_COMPANY_POOL_SCHEMA.headers) {
        headers = PHASE1_COMPANY_POOL_SCHEMA.headers;
      } else {
        // 從表格讀取 headers
        const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        headers = headerRow.filter(h => h && h.toString().trim() !== "");
      }
      
      if (!headers || headers.length === 0) {
        Logger.log(`P1 財報：無法獲取 Phase1_Company_Pool Schema，無法創建記錄`);
        return;
      }
      
      const now = new Date();
      const rowData = new Array(headers.length).fill("");
      
      // 設置基本欄位
      const tickerCol = headers.indexOf("Company_Code");
      const marketCol = headers.indexOf("Market");
      const companyNameCol = headers.indexOf("Company_Name");
      const p1Col = headers.indexOf("P1_Industry_Evidence_JSON");
      const p2Col = headers.indexOf("P2_Financial_Evidence_JSON");
      const p3Col = headers.indexOf("P3_Technical_Evidence_JSON");
      const statusCol = headers.indexOf("Financial_Report_Extraction_Status");
      const sourceCol = headers.indexOf("Financial_Report_Source");
      const createdAtCol = headers.indexOf("created_at");
      const updatedAtCol = headers.indexOf("updated_at");
      
      if (tickerCol !== -1) rowData[tickerCol] = ticker;
      if (marketCol !== -1) rowData[marketCol] = market;
      if (companyNameCol !== -1) {
        // 台日股顯示為 "公司名(代號)" 格式
        if (market === "TW" || market === "JP") {
          const marketSuffix = market.toLowerCase();
          rowData[companyNameCol] = `${ticker}.${marketSuffix}`;  // 暫時使用代號，後續可更新
        } else {
          rowData[companyNameCol] = ticker;
        }
      }
      if (sourceCol !== -1) {
        rowData[sourceCol] = market === "TW" ? "MOPS" : (market === "JP" ? "EDINET" : "SEC");
      }
      if (createdAtCol !== -1) rowData[createdAtCol] = now;
      if (updatedAtCol !== -1) rowData[updatedAtCol] = now;
      
      // 添加新記錄
      const newRowIndex = sheet.getLastRow() + 1;
      sheet.appendRow(rowData);
      
      Logger.log(`P1 財報：已創建 ${ticker} (${market}) 的基本記錄（行 ${newRowIndex}）`);
      
      // 保存提取結果到新創建的記錄
      // ⭐ V8.17.4 新增：使用智能截斷策略
      const MAX_CELL_CHARS = 45000;
      const MAX_EVIDENCE_CONTENT_CHARS = 2000;
      
      /**
       * 智能截斷證據（內聯函數，避免重複定義）
       */
      function smartTruncateEvidenceInline(evidenceList, evidenceType) {
        if (!evidenceList || evidenceList.length === 0) {
          return { truncated: [], wasTruncated: false, originalCount: 0 };
        }
        
        const originalCount = evidenceList.length;
        let truncated = evidenceList.map(evidence => {
          if (evidence.content && typeof evidence.content === 'string' && evidence.content.length > MAX_EVIDENCE_CONTENT_CHARS) {
            return {
              ...evidence,
              content: evidence.content.substring(0, MAX_EVIDENCE_CONTENT_CHARS) + '...[內容已截斷]',
              _truncated: true
            };
          }
          return evidence;
        });
        
        let jsonStr = JSON.stringify(truncated);
        let wasTruncated = false;
        
        if (jsonStr.length > MAX_CELL_CHARS) {
          Logger.log(`P1 財報：${ticker} ${evidenceType} 證據過長（${jsonStr.length} 字元），開始移除最長證據...`);
          wasTruncated = true;
          
          truncated = [...truncated].sort((a, b) => {
            const aLen = JSON.stringify(a).length;
            const bLen = JSON.stringify(b).length;
            return aLen - bLen;
          });
          
          while (truncated.length > 0 && JSON.stringify(truncated).length > MAX_CELL_CHARS) {
            truncated.pop();
          }
          
          jsonStr = JSON.stringify(truncated);
          Logger.log(`P1 財報：${ticker} ${evidenceType} 證據已截斷至 ${truncated.length} 條（原始 ${originalCount} 條，${jsonStr.length} 字元）`);
        } else {
          const hasTruncatedContent = truncated.some(e => e._truncated);
          if (hasTruncatedContent) {
            wasTruncated = true;
            Logger.log(`P1 財報：${ticker} ${evidenceType} 證據內容已截斷（保留所有 ${originalCount} 條證據，但部分內容已截斷）`);
          }
        }
        
        truncated = truncated.map(e => {
          const { _truncated, ...rest } = e;
          return rest;
        });
        
        return { truncated, wasTruncated, originalCount };
      }
      
      const p1Result = smartTruncateEvidenceInline(filterLatestThreeQuarters(extractedData.p1_industry_evidence || []), "P1");
      const p2Result = smartTruncateEvidenceInline(filterLatestThreeQuarters(extractedData.p2_financial_evidence || []), "P2");
      const p3Result = smartTruncateEvidenceInline(filterLatestThreeQuarters(extractedData.p3_technical_evidence || []), "P3");
      
      const finalP1 = p1Result.truncated;
      const finalP2 = p2Result.truncated;
      const finalP3 = p3Result.truncated;
      const p1Truncated = p1Result.wasTruncated;
      const p2Truncated = p2Result.wasTruncated;
      const p3Truncated = p3Result.wasTruncated;
      
      if (p1Col !== -1) {
        sheet.getRange(newRowIndex, p1Col + 1).setValue(JSON.stringify(finalP1));
      }
      if (p2Col !== -1) {
        sheet.getRange(newRowIndex, p2Col + 1).setValue(JSON.stringify(finalP2));
      }
      if (p3Col !== -1) {
        sheet.getRange(newRowIndex, p3Col + 1).setValue(JSON.stringify(finalP3));
      }
      if (statusCol !== -1) {
        sheet.getRange(newRowIndex, statusCol + 1).setValue(extractedData.INCOMPLETE_EXTRACTION ? "INCOMPLETE_EXTRACTION" : "EXTRACTED");
      }
      
      const truncationNote = p1Truncated || p2Truncated || p3Truncated
        ? `（已截斷：P1=${p1Truncated ? '是' : '否'}, P2=${p2Truncated ? '是' : '否'}, P3=${p3Truncated ? '是' : '否'}）` 
        : '';
      Logger.log(`P1 財報：已保存 ${ticker} (${market}) 的提取結果到新創建的記錄（P1=${finalP1.length} 條，P2=${finalP2.length} 條，P3=${finalP3.length} 條${extractedData.INCOMPLETE_EXTRACTION ? "，INCOMPLETE_EXTRACTION" : ""}）${truncationNote}`);
      
    } catch (createError) {
      Logger.log(`P1 財報：創建 ${ticker} (${market}) 記錄失敗：${createError.message}`);
    }
    
  } catch (error) {
    Logger.log(`P1 財報：保存提取結果失敗（${ticker}, ${market}）：${error.message}`);
  }
}

// ==========================================
// ⭐ V8.14 新增：Flash 三欄位提取（P1/P2/P3）
// ==========================================

/**
 * 使用 Flash 提取財報的三個欄位（P1/P2/P3）
 * @param {string} fileUri - Gemini File API URI（或 HTML 內容）
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {string} filingPeriod - 財報期間（例如：2025-Q1）
 * @param {string} fileType - 檔案類型（PDF/HTML）
 * @return {Object|null} 提取結果 { p1_industry_evidence, p2_financial_evidence, p3_technical_evidence }
 */
function extractFinancialReportSegments(fileUri, ticker, market, filingPeriod, fileType = "PDF") {
  try {
    const properties = PropertiesService.getScriptProperties();
    const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
    
    // ⭐ V8.17.7：優先使用 Cloud Run /gemini-extract 端點（當 fileUri 是 gs:// 路徑時）
    if (fileUri && fileUri.startsWith("gs://") && cloudRunUrl) {
      Logger.log(`P1 財報：使用 Cloud Run /gemini-extract 提取 ${ticker} (${filingPeriod})，GCS 路徑=${fileUri}`);
      
      const extractUrl = `${cloudRunUrl}/gemini-extract`;
      const requestBody = {
        gcs_path: fileUri,
        ticker: ticker,
        market: market,
        filing_period: filingPeriod.replace("-Q", "Q")  // 轉換為 2025Q1 格式
      };
      
      const response = UrlFetchApp.fetch(extractUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        const errorText = response.getContentText();
        throw new Error(`Cloud Run 提取失敗 (HTTP ${responseCode})：${errorText}`);
      }
      
      const result = JSON.parse(response.getContentText());
      
      // 返回格式與舊版一致
      return {
        p1_industry_evidence: result.p1_industry_evidence || [],
        p2_financial_evidence: result.p2_financial_evidence || [],
        p3_technical_evidence: result.p3_technical_evidence || []
      };
    }
    
    // ⭐ 舊方式：直接調用 Gemini API（用於 PDF 的 Gemini File API URI 或沒有 Cloud Run 時）
    const apiKey = getAPIKey("GOOGLE");
    if (!apiKey) {
      throw new Error("API Key 未配置：API_KEY_GOOGLE，請在 PropertiesService 中設置");
    }
    
    const model = "gemini-2.5-flash-lite";  // 測試用，正式環境改為 gemini-3-flash-preview
    const prompt = buildFinancialReportExtractionPrompt(ticker, market, filingPeriod);
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    // 構建請求體
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt }
        ]
      }]
    };
    
    // 如果是 PDF，使用 file_data；如果是 HTML，直接放在 text 中
    if (fileType === "PDF" && fileUri.startsWith("files/")) {
      requestBody.contents[0].parts.push({
        file_data: {
          mime_type: "application/pdf",
          file_uri: fileUri
        }
      });
    } else if (fileType === "HTML") {
      // HTML 內容直接放在 prompt 後面（fileUri 實際上是 HTML 內容）
      requestBody.contents[0].parts.push({
        text: `\n\n=== 財報內容（${filingPeriod}）===\n${fileUri}`
      });
    }
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Gemini 提取失敗：${response.getContentText()}`);
    }
    
    const result = JSON.parse(response.getContentText());
    const content = result.candidates[0].content.parts[0].text;
    
    // 解析 JSON
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("無法解析提取結果");
    
  } catch (error) {
    Logger.log(`P1 財報：提取 ${ticker} (${filingPeriod}) 失敗：${error.message}`);
    return null;
  }
}

/**
 * 構建財報提取 Prompt（三欄位分離）
 * @param {string} ticker - 股票代號
 * @param {string} market - 市場
 * @param {string} filingPeriod - 財報期間
 * @return {string} Prompt 內容
 */
function buildFinancialReportExtractionPrompt(ticker, market, filingPeriod) {
  return `
## Role Definition

You are a "Forensic Data Extractor" (法醫級數據提取員).

Your ONLY job is to read the provided financial report (PDF/Text) and extract verbatim segments for downstream analysis modules.

You possess high-speed reading capabilities and perfect memory for locating text.

---

## ⚠️ Strict Non-Functional Requirements (The Iron Rules)

1. **NO Analysis**: Do not interpret, summarize, calculate, or explain the data.
2. **NO Hallucination**: You must extract the text EXACTLY as it appears in the document. Do not change a single word.
3. **Verbatim & Context**: Extract the full sentence/paragraph containing the keyword, plus 1-2 preceding and following sentences to preserve context.
4. **Citation**: Every single extraction MUST include the specific Page Number \`(Page X)\`.
5. **Separation**: Strictly separate data into "P1_Industry_Evidence", "P2_Financial_Evidence", and "P3_Technical_Evidence".

---

## Extraction Scope

### Group 1: For P1 Analysis (Industry Position & Order of Battle)

Target: Information regarding "Who they are," "Where they fit in the supply chain," and "Strategic MOAT."

Look for paragraphs containing:

- **Business Description**: What does the company do? Main products/services?
- **Revenue Mix (Sales Breakdown)**: Revenue by product category or geography (e.g., "Mobile accounts for 50%...").
- **Supply Chain Role**: Mentions of "suppliers," "customers," "clients," "distributors," or "manufacturing process."
- **Competition**: Mentions of "competitors," "market share," "industry position," "rivals."
- **R&D & Technology**: Mentions of "patents," "technology barriers," "R&D expenses" (as a strategic effort), "new product launch."
- **Capacity**: Mentions of "factories," "production lines," "utilization rate," "expansion plans."

### Group 2: For P2 Analysis (Financial Safety & Growth)

Target: Information regarding "Financial Health," "Valuation," and "Growth Trends."

Look for paragraphs and tables containing:

- **Profitability**: Gross Margin, Operating Margin, Net Profit, EPS.
- **Growth**: Revenue growth rates, YoY comparisons, QoQ comparisons.
- **Balance Sheet Health**: Cash on hand, Total Debt, Inventory levels, Inventory Turnover days, Liabilities.
- **Cash Flow**: Operating Cash Flow, Free Cash Flow, Capital Expenditure (CapEx), Dividends.
- **Guidance & Outlook**: Management's prediction for the next quarter/year, order visibility, backlog.
- **Risk Factors**: Specific financial risks mentioned in the "Risk Factors" section.

**Important**: If a section implies a table, convert it to a Markdown table format within the "content" field.

### Group 3: For P3 Analysis (Technical Sentiment & Chips)

Target: Information regarding "Shareholder Structure," "Potential Selling Pressure," and "Insider Confidence."

Look for paragraphs and tables containing:

- **Shareholding Structure**: Major shareholders list, Director/Management shareholding percentage changes.
- **Potential Dilution**: Mentions of "Convertible Bonds (CB)" (especially conversion price and period), "Employee Stock Options," "Preferred Stock."
- **Capital Actions**: Mentions of "Share Repurchase (Buyback)," "Capital Reduction," "Private Placement" (私募).
- **Dividends Policy**: Cash dividend proposals (affects technical yield support).

---

## Output Format (Strict JSON)

Output a single JSON object with three main arrays. Each extraction must include:

\`\`\`json
{
  "p1_industry_evidence": [
    {
      "content": "完整的原文段落（直接從文件中複製，不要改寫）",
      "page_number": 15,
      "section": "Business Description / 業務描述 / 公司概況",
      "filing_period": "${filingPeriod}",
      "context_before": "前文（如果需要理解該段落，必須包含的前文）",
      "context_after": "後文（如果需要理解該段落，必須包含的後文）"
    }
  ],
  "p2_financial_evidence": [
    {
      "content": "完整的原文段落或 Markdown 表格（直接從文件中複製）",
      "page_number": 23,
      "section": "Financial Statements / 財務報表 / 損益表",
      "filing_period": "${filingPeriod}",
      "table_format": "如果內容是表格，轉換為 Markdown 格式",
      "context_before": "前文",
      "context_after": "後文"
    }
  ],
  "p3_technical_evidence": [
    {
      "content": "完整的原文段落（直接從文件中複製）",
      "page_number": 45,
      "section": "Shareholding Structure / 股權結構",
      "filing_period": "${filingPeriod}",
      "context_before": "前文",
      "context_after": "後文"
    }
  ]
}
\`\`\`

---

## ⚠️ Critical Instructions

1. **Extraction Order**: First locate section titles, then extract content.
2. **Table Handling**: Financial tables must be converted to Markdown format within the "content" field.
3. **Multi-language Support**: For TW/JP market reports, handle Chinese/Japanese text correctly.
4. **Context Preservation**: Each paragraph must include 1-2 preceding and following sentences.
5. **Page Numbers**: Every extraction MUST include the exact page number.
6. **No Calculation**: Do not calculate any metrics (e.g., growth rates, margins). Only extract raw data.

---

## Company Information

- **Ticker**: ${ticker}
- **Market**: ${market}
- **Filing Period**: ${filingPeriod}

**Now extract the data according to the above rules.**
`;
}
