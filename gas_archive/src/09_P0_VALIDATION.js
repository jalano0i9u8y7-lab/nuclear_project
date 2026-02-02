/**
 * ⭐ V8.14 新增：P0 時效性防呆機制
 * 
 * 實作 P0 驗證流程相關函數：
 * - extractValidationQuestions: 從 OPUS 輸出中提取驗證問題
 * - saveP0InitialAnalysis: 保存 OPUS 第一次分析結果
 * - uploadFileToGemini: 上傳 Google Drive 檔案到 Gemini File API
 * - extractContextFromGeminiFile: 從 Gemini File 中提取原文段落
 * - deleteGeminiFile: 刪除 Gemini File API 中的檔案
 * - buildP0ReanalysisPrompt: 構建 OPUS 重新分析的 Prompt
 * - triggerP0Reanalysis: 觸發 OPUS 重新分析
 * - P0_ProcessM0ReanalysisResult: 處理 OPUS 重新分析的結果
 * 
 * @version V8.14
 * @date 2026-01-19
 */

// ==========================================
// 驗證問題提取
// ==========================================

/**
 * 從 OPUS 輸出中提取驗證問題
 * @param {Object} executorOutput - OPUS 執行者輸出
 * @return {Array} 驗證問題列表
 */
function extractValidationQuestions(executorOutput) {
  const questions = [];
  
  // 從 themes 中提取
  if (executorOutput.themes && Array.isArray(executorOutput.themes)) {
    executorOutput.themes.forEach((theme, themeIndex) => {
      if (theme.validation_questions && Array.isArray(theme.validation_questions)) {
        theme.validation_questions.forEach((q, qIndex) => {
          questions.push({
            question_id: `T${themeIndex + 1}_Q${qIndex + 1}`,
            theme_id: theme.theme_id || `THEME_${themeIndex + 1}`,
            question_text: q.question_text,
            data_source_url: q.data_source_url,
            data_source_site: q.data_source_site,
            data_source_keywords: q.data_source_keywords,
            expected_document_title: q.expected_document_title,
            status: "PENDING"
          });
        });
      }
    });
  }
  
  // 從 subthemes 中提取
  if (executorOutput.subthemes && Array.isArray(executorOutput.subthemes)) {
    executorOutput.subthemes.forEach((subtheme, subthemeIndex) => {
      if (subtheme.validation_questions && Array.isArray(subtheme.validation_questions)) {
        subtheme.validation_questions.forEach((q, qIndex) => {
          questions.push({
            question_id: `ST${subthemeIndex + 1}_Q${qIndex + 1}`,
            subtheme_id: subtheme.subtheme_id || `SUBTHEME_${subthemeIndex + 1}`,
            theme_id: subtheme.theme_id,
            question_text: q.question_text,
            data_source_url: q.data_source_url,
            data_source_site: q.data_source_site,
            data_source_keywords: q.data_source_keywords,
            expected_document_title: q.expected_document_title,
            status: "PENDING"
          });
        });
      }
    });
  }
  
  return questions;
}

// ==========================================
// 第一次分析結果保存
// ==========================================

/**
 * 保存 OPUS 第一次分析結果
 * @param {string} snapshotId - 快照 ID
 * @param {Object} executorOutput - OPUS 執行者輸出
 * @param {Array} validationQuestions - 驗證問題列表
 */
function saveP0InitialAnalysis(snapshotId, executorOutput, validationQuestions) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P0__SNAPSHOT");
  
  if (!sheet) {
    throw new Error("P0__SNAPSHOT 表格不存在");
  }
  
  // 找到對應的快照行
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const snapshotIdCol = headers.indexOf("snapshot_id");
  
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][snapshotIdCol] === snapshotId) {
      targetRow = i + 1;  // 1-based
      break;
    }
  }
  
  if (targetRow === -1) {
    throw new Error(`找不到快照：${snapshotId}`);
  }
  
  // 更新欄位
  const initialAnalysisCol = headers.indexOf("initial_analysis_json");
  const validationQuestionsCol = headers.indexOf("validation_questions_json");
  const validationStatusCol = headers.indexOf("validation_status");
  
  if (initialAnalysisCol !== -1) {
    sheet.getRange(targetRow, initialAnalysisCol + 1).setValue(JSON.stringify(executorOutput));
  }
  if (validationQuestionsCol !== -1) {
    sheet.getRange(targetRow, validationQuestionsCol + 1).setValue(JSON.stringify(validationQuestions));
  }
  if (validationStatusCol !== -1) {
    sheet.getRange(targetRow, validationStatusCol + 1).setValue("PENDING");
  }
  
  Logger.log(`P0 V8.14：已保存第一次分析結果和 ${validationQuestions.length} 個驗證問題`);
}

// ==========================================
// Gemini File API 實作
// ==========================================

/**
 * 上傳 Google Drive 檔案到 Gemini File API
 * @param {string} driveFileId - Google Drive 檔案 ID
 * @return {string} fileUri - Gemini File API 返回的 URI
 */
function uploadFileToGemini(driveFileId) {
  const apiKey = getAPIKey("GOOGLE");
  const file = DriveApp.getFileById(driveFileId);
  const blob = file.getBlob();
  const fileName = file.getName();
  
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

/**
 * 從 Gemini File 中提取驗證問題的相關原文段落
 * @param {string} fileUri - Gemini File API URI
 * @param {Array} questions - 驗證問題列表
 * @return {Object} 提取的原文段落結果
 */
function extractContextFromGeminiFile(fileUri, questions) {
  const apiKey = getAPIKey("GOOGLE");
  const model = "gemini-3-flash-preview";
  
  const prompt = `你是一個文件閱讀器，負責從 PDF 文件中擷取與特定問題相關的原文段落。

**你的任務**：
1. 閱讀這份 PDF 文件
2. 針對以下每個問題，找出文件中與該問題相關的原文段落
3. **只擷取原文段落，不要回答問題，不要提供摘要，不要進行任何分析或解釋**

**問題列表**：
${questions.map((q, i) => `${i + 1}. [${q.question_id}] ${q.question_text}`).join('\n')}

**擷取規則**：
1. **只擷取原文段落**：直接複製文件中與問題相關的文字，不要改寫、不要總結
2. **包含完整上下文**：如果某個段落是答案的關鍵，但需要前後文才能理解，必須一併擷取前後文，不能忽略會影響判斷的段落
3. **可能多段落**：一個問題可能對應多個段落，全部都要擷取
4. **標註頁數**：每個段落必須標註其所在的頁數（Page Number）
5. **保持原文順序**：如果有多個段落，按照在文件中出現的順序排列

**輸出格式（JSON）**：
{
  "extracted_passages": [
    {
      "question_id": "Q001",
      "question_text": "問題內容",
      "passages": [
        {
          "page_number": 15,
          "content": "完整的原文段落（包含必要的上下文），直接從文件中複製，不要改寫",
          "context_before": "前文（如果需要理解該段落，必須包含的前文）",
          "context_after": "後文（如果需要理解該段落，必須包含的後文）"
        },
        {
          "page_number": 23,
          "content": "另一個相關的原文段落",
          "context_before": "前文",
          "context_after": "後文"
        }
      ]
    }
  ]
}

**注意**：
- 不要試圖回答問題或提供摘要
- 不要進行任何分析、解釋或推理
- 只負責找到並複製相關的原文段落
- 確保包含足夠的上下文，讓讀者能夠理解這些段落的完整含義
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
  
  // 解析 JSON（可能需要處理 markdown 代碼塊）
  let jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error("無法解析 Gemini 輸出");
}

/**
 * 刪除 Gemini File API 中的檔案
 * @param {string} fileUri - Gemini File API URI
 */
function deleteGeminiFile(fileUri) {
  try {
    const apiKey = getAPIKey("GOOGLE");
    // 從 URI 提取 file ID（格式：https://generativelanguage.googleapis.com/v1beta/files/{file_id}）
    const fileId = fileUri.split('/').pop();
    
    const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}`;
    
    const response = UrlFetchApp.fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "x-goog-api-key": apiKey
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`⚠️ Gemini 檔案刪除失敗：${response.getContentText()}`);
    } else {
      Logger.log(`✅ Gemini 檔案已刪除：${fileId}`);
    }
  } catch (error) {
    Logger.log(`⚠️ Gemini 檔案刪除異常：${error.message}`);
  }
}

// ==========================================
// OPUS 重新分析 Prompt
// ==========================================

/**
 * 構建 OPUS 重新分析的 Prompt（嚴格限制版本）
 * @param {Object} initialAnalysis - OPUS 第一次分析結果
 * @param {Array} validationResults - Gemini 驗證結果（原文段落）
 * @return {string} Prompt 內容
 */
function buildP0ReanalysisPrompt(initialAnalysis, validationResults) {
  const validationResultsText = validationResults.map(result => {
    const passages = result.passages || [];
    return `
**問題 ${result.question_id}**：${result.question_text}
- **資料來源**：${result.data_source}
- **相關原文段落**（從文件中擷取的完整段落）：
${passages.map(p => `
  **第 ${p.page_number} 頁**：
  ${p.context_before ? `[前文] ${p.context_before}\n` : ''}
  ${p.content}
  ${p.context_after ? `\n[後文] ${p.context_after}` : ''}
`).join('\n\n')}
`;
  }).join('\n\n');
  
  return `
## ⚠️ 重要：這不是重新分析任務

**你的角色**：你是一個「驗證者」，不是「分析者」。

**你的任務**：針對你第一次分析中因內建知識時效性不足但絕對需要驗證的關鍵問題，使用最新找到的相關文件原文段落，加強驗證你原分析論點是否成立或有變化。

**❌ 禁止行為**：
1. **禁止重新做產業分析**：不要從頭分析產業、不要重新篩選 themes/subthemes、不要重新評估產業結構
2. **禁止大幅度推翻第一次分析**：除非最新資料顯示已經與原來的分析明顯背離，否則不能大幅度推翻第一次分析的結論
3. **禁止重新回答源頭問題**：不要重新回答「產業是否必然存在」、「結構性定價權來源」等源頭問題

**✅ 允許行為**：
1. **驗證特定問題**：針對你提出的驗證問題，根據最新文件的原文段落，自問自答
2. **微調論點**：如果最新資料與原分析有細微差異，可以微調論點
3. **加強論證**：如果最新資料支持原分析，可以加強論證
4. **修正明顯錯誤**：如果最新資料明顯背離原分析，可以修正相關結論

---

## 你的第一次分析（分析 A）

${JSON.stringify(initialAnalysis, null, 2)}

---

## 查證結果（資料 B）

以下是我們從你指定的資料來源中提取的**原文段落**（Gemini 只負責閱讀和擷取，不進行分析）：

${validationResultsText}

---

## 你的驗證任務

**步驟 1：閱讀原文段落**
- 仔細閱讀上述每個問題對應的原文段落
- 理解這些段落的完整含義（包含前後文）

**步驟 2：自問自答**
- 針對每個驗證問題，根據你讀到的原文段落，自問自答
- 標明這些原文段落對你原分析的影響（支持/中立/修正）

**步驟 3：評估影響**
- 評估新資料對你原來決策的影響是「支持」、「中立」還是「修正」？
- **除非最新資料明顯背離原分析，否則不能大幅度推翻第一次分析的結論**

**步驟 4：生成輸出**
- 保留第一次分析的所有 themes/subthemes 和結論
- 只在需要微調的地方進行微調
- 標註驗證結果對每個論點的影響

---

## 輸出格式

{
  "revised_analysis": {
    // ⚠️ 注意：必須保留第一次分析的所有結構，只在需要的地方微調
    // 格式與第一次分析完全相同
    "themes": [
      {
        // ... 第一次分析的 theme 結構 ...
        // 如果有微調，在 "notes" 欄位說明微調原因
        "validation_notes": "根據最新資料（第 X 頁），良率數據符合預期，支持原分析"
      }
    ],
    "subthemes": [ /* 格式同 themes */ ],
    "confidence_level": 0.9  // 根據驗證結果調整信心度
  },
  "validation_impact": [
    {
      "question_id": "Q001",
      "question_text": "問題內容",
      "impact_type": "SUPPORT / NEUTRAL / CORRECTION",
      "impact_description": "根據原文段落（第 X 頁）的內容，...（說明影響）",
      "data_source": "資料來源",
      "page_references": [15, 23, 45],
      "original_passages_summary": "相關原文段落摘要（用於審查）"
    }
  ],
  "summary": "驗證總結：本次驗證針對 X 個關鍵問題，找到 Y 個相關文件段落。其中 Z 個問題的驗證結果支持原分析，W 個問題需要微調論點。整體而言，原分析的結論仍然成立/需要修正（說明原因）。"
}
`;
}

// ==========================================
// 驗證流程觸發
// ==========================================

/**
 * 觸發 Gemini Flash 驗證流程
 * @param {string} jobId - P0 Job ID
 * @param {string} googleDriveFolderId - Google Drive 資料夾 ID
 * @return {Object} 處理結果
 */
function P0_TriggerGeminiValidation(jobId, googleDriveFolderId) {
  try {
    Logger.log(`P0 V8.14：開始驗證流程，jobId=${jobId}, folderId=${googleDriveFolderId}`);
    
    // 1. 讀取快照和驗證問題
    const snapshot = getP0SnapshotByJobId(jobId);
    if (!snapshot) {
      throw new Error(`找不到快照：jobId=${jobId}`);
    }
    
    const validationQuestions = JSON.parse(snapshot.validation_questions_json || "[]");
    if (validationQuestions.length === 0) {
      Logger.log(`P0 V8.14：沒有驗證問題，跳過驗證流程`);
      return { status: "SKIPPED", message: "沒有驗證問題" };
    }
    
    // 2. 掃描 Google Drive 資料夾中的 PDF
    const folder = DriveApp.getFolderById(googleDriveFolderId);
    const pdfFiles = folder.getFilesByType(MimeType.PDF);
    
    const validationResults = [];
    
    // 3. 對每個 PDF 進行處理
    while (pdfFiles.hasNext()) {
      const pdfFile = pdfFiles.next();
      const pdfFileId = pdfFile.getId();
      const pdfFileName = pdfFile.getName();
      
      Logger.log(`P0 V8.14：處理 PDF：${pdfFileName}`);
      
      try {
        // 3.1 上傳到 Gemini
        const fileUri = uploadFileToGemini(pdfFileId);
        Logger.log(`P0 V8.14：PDF 已上傳到 Gemini：${fileUri}`);
        
        // 3.2 提取相關上下文
        const extractedContext = extractContextFromGeminiFile(fileUri, validationQuestions);
        
        // 3.3 記錄結果
        // ⚠️ 注意：extractedContext.extracted_passages 是 Gemini 擷取的原文段落
        if (extractedContext.extracted_passages && Array.isArray(extractedContext.extracted_passages)) {
          extractedContext.extracted_passages.forEach(passage => {
            validationResults.push({
              question_id: passage.question_id,
              question_text: passage.question_text,
              google_drive_file_id: pdfFileId,
              gemini_file_uri: fileUri,
              passages: passage.passages || [],  // 原文段落列表（包含頁數、內容、前後文）
              data_source: `${pdfFileName} (${googleDriveFolderId})`,
              processing_status: "COMPLETED",
              processed_at: new Date().toISOString()
            });
          });
        }
        
        // 3.4 刪除 Gemini 檔案（釋放配額）
        deleteGeminiFile(fileUri);
        
      } catch (error) {
        Logger.log(`P0 V8.14：處理 PDF 失敗（${pdfFileName}）：${error.message}`);
        // 繼續處理下一個 PDF
      }
    }
    
    // 4. 更新快照
    updateP0ValidationResults(snapshot.snapshot_id, validationResults);
    
    // 5. 觸發 OPUS 重新分析
    triggerP0Reanalysis(snapshot.snapshot_id);
    
    return {
      status: "COMPLETED",
      processed_files: validationResults.length,
      message: "驗證流程完成，已觸發 OPUS 重新分析"
    };
    
  } catch (error) {
    Logger.log(`P0 V8.14：驗證流程失敗：${error.message}`);
    throw error;
  }
}

/**
 * 更新 P0 驗證結果
 * @param {string} snapshotId - 快照 ID
 * @param {Array} validationResults - 驗證結果列表
 */
function updateP0ValidationResults(snapshotId, validationResults) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P0__SNAPSHOT");
  
  if (!sheet) {
    throw new Error("P0__SNAPSHOT 表格不存在");
  }
  
  // 找到對應的快照行
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const snapshotIdCol = headers.indexOf("snapshot_id");
  
  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][snapshotIdCol] === snapshotId) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) {
    throw new Error(`找不到快照：${snapshotId}`);
  }
  
  // 更新欄位
  const geminiResultsCol = headers.indexOf("gemini_validation_results_json");
  const validationStatusCol = headers.indexOf("validation_status");
  
  if (geminiResultsCol !== -1) {
    sheet.getRange(targetRow, geminiResultsCol + 1).setValue(JSON.stringify(validationResults));
  }
  if (validationStatusCol !== -1) {
    sheet.getRange(targetRow, validationStatusCol + 1).setValue("IN_PROGRESS");
  }
  
  Logger.log(`P0 V8.14：已更新驗證結果，共 ${validationResults.length} 筆`);
}

/**
 * 觸發 OPUS 重新分析
 * @param {string} snapshotId - 快照 ID
 * @return {string} 新的 Job ID
 */
function triggerP0Reanalysis(snapshotId) {
  try {
    // 1. 讀取快照
    const snapshot = getP0Snapshot(snapshotId);
    const initialAnalysis = JSON.parse(snapshot.initial_analysis_json);
    const validationResults = JSON.parse(snapshot.gemini_validation_results_json || "[]");
    
    // 2. 構建重新分析的 Prompt
    const reanalysisPrompt = buildP0ReanalysisPrompt(initialAnalysis, validationResults);
    
    // 3. 提交到 M0 Job Queue
    const m0InputPayload = {
      phase: "P0",
      trigger: "VALIDATION_COMPLETED",
      snapshot_id: snapshotId,
      initial_analysis: initialAnalysis,
      validation_results: validationResults,
      p0_reanalysis_prompt: reanalysisPrompt
    };
    
    const requestedFlow = [
      "EXECUTOR",  // OPUS 重新分析
      "AUDITOR"    // GPT 審查
    ];
    
    const jobId = submitToM0JobQueue("P0", requestedFlow, m0InputPayload);
    Logger.log(`P0 V8.14：已提交重新分析任務，jobId=${jobId}`);
    
    return jobId;
    
  } catch (error) {
    Logger.log(`P0 V8.14：觸發重新分析失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 OPUS 重新分析的結果
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 */
function P0_ProcessM0ReanalysisResult(jobId, m0Result) {
  try {
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 從 input_payload 中獲取 snapshot_id
    const inputPayload = JSON.parse(m0Result.input_payload || "{}");
    const snapshotId = inputPayload.snapshot_id;
    
    if (!snapshotId) {
      throw new Error("找不到 snapshot_id");
    }
    
    // 更新快照
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const snapshotIdCol = headers.indexOf("snapshot_id");
    
    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][snapshotIdCol] === snapshotId) {
        targetRow = i + 1;
        break;
      }
    }
    
    if (targetRow === -1) {
      throw new Error(`找不到快照：${snapshotId}`);
    }
    
    // 更新 final_analysis_json 和 validation_status
    const finalAnalysisCol = headers.indexOf("final_analysis_json");
    const validationStatusCol = headers.indexOf("validation_status");
    
    if (finalAnalysisCol !== -1) {
      sheet.getRange(targetRow, finalAnalysisCol + 1).setValue(JSON.stringify(executorOutput));
    }
    if (validationStatusCol !== -1) {
      sheet.getRange(targetRow, validationStatusCol + 1).setValue("COMPLETED");
    }
    
    // 使用重新分析結果生成 P0 輸出（原有邏輯）
    const p0Output = generateP0Output(executorOutput, auditorOutput);
    
    // 保存快照（使用重新分析結果）
    saveP0Snapshot({
      snapshot_id: snapshotId,
      trigger: "VALIDATION_COMPLETED",
      p0_output: p0Output,
      final_analysis_json: JSON.stringify(executorOutput),
      validation_status: "COMPLETED"
    });
    
    Logger.log(`P0 V8.14：重新分析完成，已更新快照 ${snapshotId}`);
    
    return p0Output;
    
  } catch (error) {
    Logger.log(`P0 V8.14：處理重新分析結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 根據 job_id 獲取 P0 快照
 * @param {string} jobId - Job ID
 * @return {Object|null} 快照對象
 */
function getP0SnapshotByJobId(jobId) {
  // 實作：從 P0__SNAPSHOT 表格中查找對應 job_id 的快照
  // 這裡需要根據實際的表格結構來實現
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P0__SNAPSHOT");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  // 查找最新的快照（假設 job_id 在 p0_output_json 的 metadata 中）
  // 這裡簡化處理，實際應該根據具體的表格結構來查找
  const lastRow = rows[rows.length - 1];
  
  return {
    snapshot_id: lastRow[headers.indexOf("snapshot_id")],
    initial_analysis_json: lastRow[headers.indexOf("initial_analysis_json")],
    validation_questions_json: lastRow[headers.indexOf("validation_questions_json")],
    validation_status: lastRow[headers.indexOf("validation_status")],
    gemini_validation_results_json: lastRow[headers.indexOf("gemini_validation_results_json")],
    final_analysis_json: lastRow[headers.indexOf("final_analysis_json")]
  };
}

/**
 * 根據 snapshot_id 獲取 P0 快照
 * @param {string} snapshotId - 快照 ID
 * @return {Object|null} 快照對象
 */
function getP0Snapshot(snapshotId) {
  // 實作：從 P0__SNAPSHOT 表格中查找對應 snapshot_id 的快照
  // 這裡需要根據實際的表格結構來實現
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P0__SNAPSHOT");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  const snapshotIdCol = headers.indexOf("snapshot_id");
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][snapshotIdCol] === snapshotId) {
      return {
        snapshot_id: rows[i][snapshotIdCol],
        initial_analysis_json: rows[i][headers.indexOf("initial_analysis_json")],
        validation_questions_json: rows[i][headers.indexOf("validation_questions_json")],
        validation_status: rows[i][headers.indexOf("validation_status")],
        gemini_validation_results_json: rows[i][headers.indexOf("gemini_validation_results_json")],
        final_analysis_json: rows[i][headers.indexOf("final_analysis_json")]
      };
    }
  }
  
  return null;
}

/**
 * 生成 P0 輸出（從 executor 和 auditor 輸出中提取）
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} auditorOutput - 審查者輸出
 * @return {Object} P0 輸出
 */
function generateP0Output(executorOutput, auditorOutput) {
  // 這裡應該根據實際的 P0 輸出格式來實現
  // 簡化處理，直接返回 executorOutput
  return executorOutput;
}
