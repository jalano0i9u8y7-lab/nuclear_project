/**
 * 🧪 P1 Flash 提取測試函數
 * 
 * 提供三個測試功能：
 * 1. 檢查 GCS 存儲內容
 * 2. 美股 Flash 自動讀檔與擷取
 * 3. 台日股 Flash 手動讀檔
 * 
 * @version V8.17.1
 * @date 2026-01-23
 */

/**
 * 🔍 測試 P1：檢查 GCS 存儲內容
 * 
 * 檢查已存儲到 GCS 的財報文件是否可讀取
 * ⭐ 不重新下載，直接從 PropertiesService 或 Cloud Run 代理讀取
 */
function TEST_P1_CheckGCSContent() {
  try {
    Logger.log("🔍 開始檢查 GCS 存儲內容（不重新下載）");
    
    const ui = SpreadsheetApp.getUi();
    const properties = PropertiesService.getScriptProperties();
    
    // 測試三檔股票：AAPL, MSFT, NVDA
    const testTickers = ["AAPL", "MSFT", "NVDA"];
    const results = [];
    
    for (const ticker of testTickers) {
      Logger.log(`檢查 ${ticker}...`);
      
      // ⭐ 方法 1：從 PropertiesService 讀取已存儲的 GCS 路徑
      const gcsPathKey = `P1_GCS_PATH_${ticker}`;
      const gcsPath = properties.getProperty(gcsPathKey);
      
      // ⭐ 方法 2：如果沒有存儲，嘗試從 Cloud Run 代理讀取（使用 /latest 端點）
      let gcsPublicUrl = null;
      
      if (gcsPath) {
        // 從 gs:// 路徑構建公開 URL
        const match = gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
        if (match) {
          const bucketName = match[1];
          const objectPath = match[2];
          gcsPublicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
          Logger.log(`從 PropertiesService 讀取 ${ticker} GCS 路徑：${gcsPath}`);
        }
      } else {
        // 嘗試從 Cloud Run 代理獲取最新財報的 GCS 路徑
        Logger.log(`PropertiesService 中沒有 ${ticker} 的 GCS 路徑，嘗試從 Cloud Run 代理獲取...`);
        
        const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
        if (cloudRunUrl) {
          try {
            // 獲取 CIK
            const cik = getCIKFromTicker(ticker);
            if (cik) {
              // 調用 Cloud Run 的 /latest 端點（如果有的話）
              // 注意：這需要 Cloud Run 支持返回 GCS 路徑
              Logger.log(`嘗試從 Cloud Run 獲取 ${ticker} (CIK=${cik}) 的最新財報...`);
              // 這裡暫時跳過，因為 /latest 端點可能不返回 GCS 路徑
            }
          } catch (e) {
            Logger.log(`無法從 Cloud Run 獲取 ${ticker} 的 GCS 路徑：${e.message}`);
          }
        }
      }
      
      if (!gcsPublicUrl) {
        results.push({
          ticker: ticker,
          status: "NO_GCS_PATH",
          message: "找不到已存儲的 GCS 路徑。請先執行 TEST_P1_SEC_DataSource() 下載財報。"
        });
        continue;
      }
      
      // 嘗試從 GCS 讀取（優先使用 gcs_path，如果 bucket 禁止公開訪問）
      Logger.log(`從 GCS 讀取 ${ticker} 財報：${gcsPublicUrl || gcsPath}`);
      let content = readFileFromGCSPublicUrl(gcsPublicUrl, gcsPath);
      
      // ⭐ 如果公開 URL 失敗，嘗試通過 Cloud Run 代理讀取
      if (!content) {
        Logger.log(`公開 URL 讀取失敗，嘗試通過 Cloud Run 代理讀取...`);
        const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
        if (cloudRunUrl && gcsPath) {
          // 構建 SEC URL（從 GCS 路徑推斷）
          const match = gcsPath.match(/^gs:\/\/[^\/]+\/sec\/(\d+)\/([^\/]+)\/(.+)$/);
          if (match) {
            const cik = match[1];
            const accessionNoDashes = match[2];
            const filename = match[3];
            const secUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${filename}`;
            
            // 通過 Cloud Run 代理讀取
            try {
              const proxyUrl = `${cloudRunUrl}/?url=${encodeURIComponent(secUrl)}&type=html`;
              const response = UrlFetchApp.fetch(proxyUrl, {
                method: "GET",
                timeout: 30000
              });
              
              if (response.getResponseCode() === 200) {
                content = response.getContentText();
                Logger.log(`✅ 通過 Cloud Run 代理成功讀取 ${ticker} 財報`);
              }
            } catch (e) {
              Logger.log(`通過 Cloud Run 代理讀取失敗：${e.message}`);
            }
          }
        }
      }
      
      if (!content) {
        results.push({
          ticker: ticker,
          status: "READ_FAILED",
          message: "無法從 GCS 讀取內容（可能是 bucket 未設置公開權限）",
          gcs_url: gcsPublicUrl,
          suggestion: "請參考 GCS_Bucket公開權限設置指南.md 設置 bucket 公開權限"
        });
        continue;
      }
      
      // 檢查內容
      const contentLength = content.length;
      const hasHTML = content.includes('<html') || content.includes('<!DOCTYPE');
      const preview = content.substring(0, 200);
      
      results.push({
        ticker: ticker,
        status: "SUCCESS",
        gcs_path: gcsPath,
        gcs_url: gcsPublicUrl,
        content_length: contentLength,
        has_html: hasHTML,
        preview: preview
      });
      
      Logger.log(`✅ ${ticker}：成功讀取，長度=${contentLength}，包含 HTML=${hasHTML}`);
    }
    
    // 生成報告
    let report = "📊 GCS 存儲內容檢查結果：\n\n";
    for (const result of results) {
      report += `📊 ${result.ticker}：\n`;
      report += `  狀態：${result.status}\n`;
      if (result.filing_type) {
        report += `  財報類型：${result.filing_type}\n`;
        report += `  財報日期：${result.filing_date}\n`;
      }
      if (result.content_length) {
        report += `  內容長度：${result.content_length} 字符\n`;
        report += `  包含 HTML：${result.has_html ? '是' : '否'}\n`;
        report += `  GCS URL：${result.gcs_url}\n`;
        report += `  內容預覽：${result.preview.substring(0, 100)}...\n`;
      }
      if (result.message) {
        report += `  訊息：${result.message}\n`;
      }
      report += "\n";
    }
    
    Logger.log(report);
    ui.alert('GCS 檢查完成', report, ui.ButtonSet.OK);
    
    return results;
    
  } catch (error) {
    Logger.log(`❌ GCS 檢查失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    SpreadsheetApp.getUi().alert('錯誤', `GCS 檢查失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }
}

/**
 * 📖 測試 P1：美股 Flash 自動讀檔與擷取
 * 
 * 從 GCS 讀取美股財報並使用 Flash 提取段落
 */
function TEST_P1_US_FlashExtraction() {
  try {
    Logger.log("📖 開始測試美股 Flash 自動讀檔與擷取");
    
    const ui = SpreadsheetApp.getUi();
    
    // ⭐ V8.19：測試三檔股票（NVDA, QCOM, AMD）
    const testTickers = ["NVDA", "QCOM", "AMD"];
    Logger.log(`測試 ${testTickers.join(", ")}...`);
    
    const allResults = [];
    
    for (const testTicker of testTickers) {
      try {
        Logger.log(`\n處理 ${testTicker}...`);
        
        // 1. 獲取財報數據
        const reportData = fetchSECFinancialReport(testTicker);
        if (!reportData || !reportData.quarterly_reports || reportData.quarterly_reports.length === 0) {
          Logger.log(`⚠️ ${testTicker}：無法獲取財報數據`);
          continue;
        }
        
        const reports = reportData.quarterly_reports;
        Logger.log(`${testTicker} 找到 ${reports.length} 筆財報`);
        
        // 2. 處理每筆財報（最多處理最新 2 筆）
        const latestReports = reports.slice(0, 2);
        const extractionResults = [];
    
        for (const report of latestReports) {
          try {
            const filingPeriod = `${report.filing_date.substring(0, 4)}-Q${getQuarterFromDate(report.filing_date)}`;
            Logger.log(`處理 ${testTicker} ${filingPeriod}...`);
        
        // ⭐ V8.17.7：優先使用 gcs_path（gs://），直接傳給 Cloud Run /gemini-extract
        let fileUriForExtraction = null;
        let fileTypeForExtraction = "HTML";
        
        if (report.gcs_path && report.gcs_path.startsWith("gs://")) {
          // 有 gs:// 路徑，直接使用（Cloud Run 會從 GCS 下載）
          fileUriForExtraction = report.gcs_path;
          fileTypeForExtraction = report.gcs_path.endsWith('.pdf') ? "PDF" : "HTML";
          Logger.log(`使用 GCS 路徑：${fileUriForExtraction}`);
        } else if (report.gcs_public_url) {
          // 沒有 gs:// 路徑，但有公開 URL，嘗試讀取內容（舊方式）
          Logger.log(`從 GCS 讀取：${report.gcs_public_url}`);
          const contentForExtraction = readFileFromGCSPublicUrl(report.gcs_public_url);
          if (!contentForExtraction) {
            Logger.log(`從 GCS 讀取失敗，跳過 ${filingPeriod}`);
            continue;
          }
          Logger.log(`成功讀取，長度=${contentForExtraction.length} 字符`);
          fileUriForExtraction = contentForExtraction;  // HTML 內容
          fileTypeForExtraction = "HTML";
        } else {
          Logger.log(`沒有 GCS 路徑或 URL，跳過 ${filingPeriod}`);
          continue;
        }
        
          // 使用 Flash 提取
          Logger.log(`開始 Flash 提取 ${testTicker} ${filingPeriod}...`);
          const extracted = extractFinancialReportSegments(
            fileUriForExtraction,
            testTicker,
            "US",
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
            
            Logger.log(`✅ ${testTicker} ${filingPeriod} 提取成功`);
            Logger.log(`  P1 證據：${extracted.p1_industry_evidence ? extracted.p1_industry_evidence.length : 0} 條`);
            Logger.log(`  P2 證據：${extracted.p2_financial_evidence ? extracted.p2_financial_evidence.length : 0} 條`);
            Logger.log(`  P3 證據：${extracted.p3_technical_evidence ? extracted.p3_technical_evidence.length : 0} 條`);
          } else {
            Logger.log(`❌ ${testTicker} ${filingPeriod} 提取失敗`);
          }
          
        } catch (error) {
          Logger.log(`處理 ${testTicker} ${report.filing_date} 失敗：${error.message}`);
        }
      }
      
      // ⭐ V8.19：合併提取結果並保存到 Phase1_Company_Pool（與台日股測試一致）
      if (extractionResults.length > 0) {
        const mergedExtraction = mergeQuarterlyExtractions(extractionResults);
        saveFinancialReportExtraction(testTicker, "US", mergedExtraction, null);
        Logger.log(`✅ 已保存擷取段落到 Phase1_Company_Pool（${testTicker}, US）`);
      }
      
      allResults.push({
        ticker: testTicker,
        extractions: extractionResults
      });
      
    } catch (error) {
      Logger.log(`處理 ${testTicker} 失敗：${error.message}`);
    }
    }
    
    // 3. 生成報告
    let reportText = `📖 美股 Flash 提取結果：\n\n`;
    reportText += `處理公司數：${allResults.length}\n\n`;
    
    for (const result of allResults) {
      reportText += `📊 ${result.ticker} (US)：\n`;
      reportText += `  處理財報數：${result.extractions.length}\n`;
      if (result.extractions.length > 0) {
        reportText += `  ✅ 已寫入 Phase1_Company_Pool（P1/P2/P3_*_JSON、Extraction_Status）\n`;
      }
      for (const extraction of result.extractions) {
        if (extraction.extracted_data) {
          const data = extraction.extracted_data;
          reportText += `    ${extraction.filing_period} (${extraction.filing_type})：\n`;
          reportText += `      P1 產業證據：${data.p1_industry_evidence ? data.p1_industry_evidence.length : 0} 條\n`;
          reportText += `      P2 財務證據：${data.p2_financial_evidence ? data.p2_financial_evidence.length : 0} 條\n`;
          reportText += `      P3 技術證據：${data.p3_technical_evidence ? data.p3_technical_evidence.length : 0} 條\n`;
        }
      }
      reportText += "\n";
    }
    
    Logger.log(reportText);
    ui.alert('Flash 提取完成', reportText, ui.ButtonSet.OK);
    
    return allResults;
    
  } catch (error) {
    Logger.log(`❌ 美股 Flash 提取失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    SpreadsheetApp.getUi().alert('錯誤', `美股 Flash 提取失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }
}

/**
 * 📖 測試 P1：台日股 Flash 手動讀檔
 * 
 * 掃描 Google Drive 中的台日股 PDF 並使用 Flash 提取段落
 */
function TEST_P1_TWJP_FlashExtraction() {
  try {
    Logger.log("📖 開始測試台日股 Flash 手動讀檔");
    
    const ui = SpreadsheetApp.getUi();
    
    // 獲取母資料夾
    const parentFolderId = getFinancialReportParentFolderId();
    if (!parentFolderId) {
      ui.alert('錯誤', '未配置 Google Drive 母資料夾 ID。\n\n請先執行 BUTTON_SetFinancialReportParentFolder() 設置資料夾。', ui.ButtonSet.OK);
      return null;
    }
    
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    
    // 掃描台股和日股資料夾
    const markets = [
      { name: "台股", folderName: "台股", market: "TW" },
      { name: "日股", folderName: "日股", market: "JP" }
    ];
    
    const allResults = [];
    
    for (const marketInfo of markets) {
      Logger.log(`掃描 ${marketInfo.name} 資料夾...`);
      
      const marketFolders = parentFolder.getFoldersByName(marketInfo.folderName);
      if (!marketFolders.hasNext()) {
        Logger.log(`${marketInfo.name} 資料夾不存在，跳過`);
        continue;
      }
      
      const marketFolder = marketFolders.next();
      const companyFolders = marketFolder.getFolders();
      
      let companyCount = 0;
      while (companyFolders.hasNext() && companyCount < 3) {  // 最多處理 3 個公司
        const companyFolder = companyFolders.next();
        const folderName = companyFolder.getName();
        
        // 解析 ticker（格式：2330.tw 或 3436.jp）
        const tickerMatch = folderName.match(/^([^.]+)\.(tw|jp)$/);
        if (!tickerMatch) {
          Logger.log(`跳過不符合格式的資料夾：${folderName}`);
          continue;
        }
        
        const ticker = tickerMatch[1];
        const market = tickerMatch[2].toUpperCase();
        companyCount++;
        
        Logger.log(`處理 ${ticker} (${market})...`);
        
        // 掃描 PDF 文件
        const pdfFiles = companyFolder.getFilesByType(MimeType.PDF);
        const pdfList = [];
        while (pdfFiles.hasNext()) {
          pdfList.push(pdfFiles.next());
        }
        
        if (pdfList.length === 0) {
          Logger.log(`${ticker} (${market}) 沒有 PDF 文件`);
          continue;
        }
        
        // ⭐ V8.19：處理所有 PDF（按日期排序，從新到舊）
        const sortedPDFs = pdfList.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
        // 可選：限制最多處理數量（避免 GAS 執行時間上限），預設處理所有
        const maxPDFs = 10;  // 最多處理 10 個 PDF（可調整）
        const latestPDFs = sortedPDFs.slice(0, maxPDFs);
        Logger.log(`${ticker} (${market}) 找到 ${pdfList.length} 個 PDF，將處理 ${latestPDFs.length} 個（${pdfList.length > maxPDFs ? '已限制' : '全部'}）`);
        
        const extractionResults = [];
        for (const pdfFile of latestPDFs) {
          try {
            Logger.log(`處理 PDF：${pdfFile.getName()}`);
            
            // ⭐ V8.17.7：優先上傳到 GCS，然後使用 Cloud Run /gemini-extract
            const properties = PropertiesService.getScriptProperties();
            const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
            let gcsPath = null;
            
            if (cloudRunUrl) {
              try {
                // 讀取 PDF 並轉換為 base64
                const pdfBlob = pdfFile.getBlob();
                const pdfBytes = pdfBlob.getBytes();
                const pdfBase64 = Utilities.base64Encode(pdfBytes);
                
                // 上傳到 GCS（通過 Cloud Run /upload 端點）
                Logger.log(`上傳 PDF 到 GCS：${pdfFile.getName()}`);
                const uploadUrl = `${cloudRunUrl}/upload`;
                const uploadResponse = UrlFetchApp.fetch(uploadUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  payload: JSON.stringify({
                    file_content: pdfBase64,
                    filename: pdfFile.getName(),
                    ticker: ticker,
                    market: market,
                    mime_type: "application/pdf"
                  }),
                  muteHttpExceptions: true
                });
                
                if (uploadResponse.getResponseCode() === 200) {
                  const uploadResult = JSON.parse(uploadResponse.getContentText());
                  gcsPath = uploadResult.gs_path;
                  Logger.log(`✅ PDF 已上傳到 GCS：${gcsPath}`);
                } else {
                  const errorText = uploadResponse.getContentText();
                  Logger.log(`⚠️ GCS 上傳失敗（HTTP ${uploadResponse.getResponseCode()}），回退到 Gemini File API：${errorText}`);
                }
              } catch (uploadError) {
                Logger.log(`⚠️ GCS 上傳失敗，回退到 Gemini File API：${uploadError.message}`);
              }
            }
            
            // 推斷財報期間
            const filingPeriod = inferFilingPeriodFromFileName(pdfFile.getName(), pdfFile.getDateCreated());
            
            // Flash 提取
            Logger.log(`開始 Flash 提取 ${ticker} ${filingPeriod}...`);
            let extracted = null;
            
            if (gcsPath) {
              // 使用 GCS 路徑（不需要 API_KEY_GOOGLE）
              extracted = extractFinancialReportSegments(
                gcsPath,
                ticker,
                market,
                filingPeriod,
                "PDF"
              );
            } else {
              // 回退：上傳到 Gemini File API（需要 API_KEY_GOOGLE）
              Logger.log(`使用 Gemini File API（需要 API_KEY_GOOGLE）`);
              const pdfBlob = pdfFile.getBlob();
              const fileUri = uploadFileToGemini(pdfBlob, pdfFile.getName());
              
              extracted = extractFinancialReportSegments(
                fileUri,
                ticker,
                market,
                filingPeriod,
                "PDF"
              );
              
              // 刪除 Gemini 檔案
              if (typeof deleteGeminiFile === 'function') {
                deleteGeminiFile(fileUri);
              } else if (typeof deleteGeminiFile_P1 === 'function') {
                deleteGeminiFile_P1(fileUri);
              }
            }
            
            if (extracted) {
              extractionResults.push({
                filing_period: filingPeriod,
                filing_type: "PDF",
                filing_date: pdfFile.getDateCreated().toISOString().split('T')[0],
                extracted_data: extracted
              });
              
              Logger.log(`✅ ${ticker} ${filingPeriod} 提取成功`);
              Logger.log(`  P1 證據：${extracted.p1_industry_evidence ? extracted.p1_industry_evidence.length : 0} 條`);
              Logger.log(`  P2 證據：${extracted.p2_financial_evidence ? extracted.p2_financial_evidence.length : 0} 條`);
              Logger.log(`  P3 證據：${extracted.p3_technical_evidence ? extracted.p3_technical_evidence.length : 0} 條`);
            } else {
              Logger.log(`❌ ${ticker} ${filingPeriod} 提取失敗`);
            }
            
          } catch (error) {
            Logger.log(`處理 ${ticker} PDF ${pdfFile.getName()} 失敗：${error.message}`);
          }
        }
        
        if (extractionResults.length > 0) {
          // ⭐ V8.19：合併多季提取結果並保存
          const mergedExtraction = mergeQuarterlyExtractions(extractionResults);
          saveFinancialReportExtraction(ticker, market, mergedExtraction, null);
          
          allResults.push({
            ticker: ticker,
            market: market,
            extractions: extractionResults
          });
        }
      }
    }
    
    // 生成報告
    let reportText = `📖 台日股 Flash 提取結果：\n\n`;
    reportText += `處理公司數：${allResults.length}\n\n`;
    
    for (const result of allResults) {
      reportText += `📊 ${result.ticker} (${result.market})：\n`;
      reportText += `  處理財報數：${result.extractions.length}\n`;
      for (const extraction of result.extractions) {
        if (extraction.extracted_data) {
          const data = extraction.extracted_data;
          reportText += `    ${extraction.filing_period}：\n`;
          reportText += `      P1 證據：${data.p1_industry_evidence ? data.p1_industry_evidence.length : 0} 條\n`;
          reportText += `      P2 證據：${data.p2_financial_evidence ? data.p2_financial_evidence.length : 0} 條\n`;
          reportText += `      P3 證據：${data.p3_technical_evidence ? data.p3_technical_evidence.length : 0} 條\n`;
        }
      }
      reportText += "\n";
    }
    
    Logger.log(reportText);
    ui.alert('Flash 提取完成', reportText, ui.ButtonSet.OK);
    
    return allResults;
    
  } catch (error) {
    Logger.log(`❌ 台日股 Flash 提取失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    SpreadsheetApp.getUi().alert('錯誤', `台日股 Flash 提取失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }
}
