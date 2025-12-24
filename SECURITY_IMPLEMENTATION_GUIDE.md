# 🔒 P0 安全修復實施指南

**實施日期**: 2024-12-24  
**修復範圍**: Secret Manager 整合 + 檔案上傳安全驗證  
**狀態**: ✅ 程式碼已完成，待部署測試

---

## 📋 已完成的修復

### ✅ 1. Secret Manager 整合

#### 新增檔案
- `worker/src/utils/secret-manager.ts` - Secret Manager 工具函數

#### 修改檔案
- `worker/src/handlers/deploy.ts` - 使用 Secret Manager 儲存 API Key
- `worker/src/utils/cloud-build.ts` - Cloud Run 透過 Secret Manager 注入環境變數

#### 主要變更

**Before (不安全)**:
```typescript
// deploy.ts
await triggerCloudBuild(
  env,
  body.app_id,
  subdomain,
  analysis,
  body.api_key // ⚠️ 明文傳遞
);

// cloud-build.ts
'--set-env-vars', `GOOGLE_API_KEY=${geminiApiKey}` // ⚠️ 明文環境變數
```

**After (安全)**:
```typescript
// deploy.ts
// 儲存到 Secret Manager
const secretResourceName = await storeUserApiKey(env, body.app_id, body.api_key);

await triggerCloudBuild(
  env,
  body.app_id,
  subdomain,
  analysis,
  secretResourceName // ✅ 僅傳遞 Secret 參考
);

// cloud-build.ts
'--update-secrets', `GOOGLE_API_KEY=${secretResourceName}` // ✅ Secret Manager 參考
```

#### 安全改善
- ✅ API Key 不再以明文形式傳遞
- ✅ Cloud Build 日誌中不會出現 API Key
- ✅ 部署失敗時自動清理 Secret
- ✅ 使用 Google Secret Manager 加密儲存

---

### ✅ 2. 檔案上傳安全驗證

#### 新增檔案
- `worker/src/utils/file-validator.ts` - 完整的檔案安全驗證

#### 修改檔案
- `worker/src/handlers/prepare.ts` - 整合安全驗證

#### 驗證項目

##### ✅ 基礎驗證
- 檔案大小限制 (50MB)
- ZIP magic bytes 檢查
- 空檔案檢測

##### ✅ 壓縮炸彈防護
- 最大解壓縮大小限制 (200MB)
- 壓縮比例檢查 (最大 100:1)
- 個別檔案壓縮比檢查

##### ✅ 路徑遍歷防護
```typescript
// 檢測的危險模式
../                  // 相對路徑
/etc/, /proc/       // 系統路徑
C:\, \\server\      // Windows 路徑
```

##### ✅ 檔案類型驗證
- 白名單: `.py`, `.js`, `.html`, `.json`, `.txt` 等安全檔案
- 黑名單: `.exe`, `.dll`, `.bat`, `.zip` (巢狀壓縮檔) 等危險檔案

##### ✅ 惡意內容掃描
```typescript
// 檢測的惡意模式
rm -rf /                    // 刪除指令
curl ... | sh              // 遠端執行
nc -e                      // 反向 shell
xmrig, cryptonight        // 挖礦程式
eval(base64_decode(...))   // 混淆程式碼
```

#### 安全改善
- ✅ 防止惡意檔案上傳
- ✅ 防止壓縮炸彈攻擊
- ✅ 防止路徑遍歷攻擊
- ✅ 檢測常見惡意模式

---

## 🚀 部署步驟

### 步驟 1: 啟用 Google Secret Manager API

```bash
# 在 GCP 專案中啟用 Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID
```

### 步驟 2: 設定 Service Account 權限

```bash
# 授予 Secret Manager 權限給 Cloud Build Service Account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 授予 Secret Manager 權限給 Worker Service Account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"
```

### 步驟 3: 部署 Worker

```bash
cd worker
npm install
npm run deploy
```

### 步驟 4: 測試驗證

#### 測試 1: Secret Manager 功能
```bash
# 測試部署 (會自動儲存 API Key 到 Secret Manager)
curl -X POST https://api.mite.now/api/v1/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "test-app-123",
    "subdomain": "test-secure",
    "api_key": "AIza...your-test-key"
  }'

# 檢查 Secret Manager 中是否有 secret
gcloud secrets list --project=YOUR_PROJECT_ID | grep gemini-api-key
```

#### 測試 2: 檔案驗證功能
```bash
# 測試上傳正常檔案 (應該成功)
curl -X POST https://api.mite.now/api/v1/upload/test-app-123?token=YOUR_TOKEN \
  -H "Content-Type: application/zip" \
  --data-binary @normal-app.zip

# 測試上傳惡意檔案 (應該被拒絕)
# 建立包含 .exe 檔案的 ZIP
zip malicious.zip malware.exe
curl -X POST https://api.mite.now/api/v1/upload/test-app-123?token=YOUR_TOKEN \
  -H "Content-Type: application/zip" \
  --data-binary @malicious.zip
# 預期回應: 400 Bad Request - "Dangerous file type not allowed"

# 測試壓縮炸彈 (應該被拒絕)
# 建立高壓縮比檔案
dd if=/dev/zero bs=1M count=500 | gzip > bomb.gz
zip zipbomb.zip bomb.gz
curl -X POST https://api.mite.now/api/v1/upload/test-app-123?token=YOUR_TOKEN \
  -H "Content-Type: application/zip" \
  --data-binary @zipbomb.zip
# 預期回應: 400 Bad Request - "Suspicious compression ratio detected"
```

---

## 🔍 驗證清單

### Secret Manager 驗證
- [ ] Secret Manager API 已啟用
- [ ] Service Account 權限已設定
- [ ] 部署時 API Key 成功儲存到 Secret Manager
- [ ] Cloud Run 可以讀取 Secret
- [ ] 部署失敗時 Secret 被正確清理
- [ ] Cloud Build 日誌中沒有明文 API Key

### 檔案驗證驗證
- [ ] 正常 ZIP 檔案可以上傳
- [ ] 超過 50MB 的檔案被拒絕
- [ ] 包含 .exe 等危險檔案的 ZIP 被拒絕
- [ ] 包含路徑遍歷 (../) 的 ZIP 被拒絕
- [ ] 壓縮炸彈被檢測並拒絕
- [ ] 包含惡意指令的檔案被檢測

---

## 📊 監控建議

### 1. 監控 Secret Manager 使用量
```bash
# 查看 Secret 數量
gcloud secrets list --project=YOUR_PROJECT_ID --format="value(name)" | wc -l

# 定期清理過期的 Secrets (建議每週執行)
# 刪除 7 天前的部署 secrets
gcloud secrets list --project=YOUR_PROJECT_ID --format="value(name)" | \
  grep "gemini-api-key-" | \
  while read secret; do
    created=$(gcloud secrets describe $secret --format="value(createTime)")
    # 如果超過 7 天，刪除
    # (需要額外的日期比較邏輯)
  done
```

### 2. 監控檔案驗證拒絕率
在 Cloudflare Workers 中添加監控：
```typescript
// 在 file-validator.ts 中添加
if (validationFailed) {
  // 記錄到 Analytics
  env.ANALYTICS?.writeDataPoint({
    blobs: ['file_validation_failed', filename],
    doubles: [buffer.byteLength],
    indexes: [subdomain]
  });
}
```

### 3. 設定警報
- Secret Manager 配額使用超過 80%
- 檔案驗證拒絕率異常升高
- Secret 清理失敗

---

## 🐛 已知問題與限制

### 1. ZIP 解析器限制
- 當前使用簡化的 ZIP 解析器
- 對於複雜的 ZIP 結構可能無法完整解析
- **建議**: 未來考慮使用完整的 ZIP 解析庫

### 2. 惡意內容掃描限制
- 僅掃描前 1MB 內容
- 無法檢測所有類型的惡意程式碼
- **建議**: 整合專業的惡意軟體掃描服務 (如 VirusTotal API)

### 3. Secret Manager 成本
- 每個 secret 版本都會產生儲存成本
- 大量部署會增加成本
- **建議**: 實施自動清理機制

### 4. 效能影響
- 檔案驗證會增加上傳延遲 (約 100-500ms)
- Secret Manager API 呼叫會增加部署時間 (約 200-300ms)
- **可接受**: 安全性優先於效能

---

## 🔄 後續改善建議

### 短期 (1-2 週)
1. 實施 Secret 自動清理機制
2. 添加更詳細的驗證日誌
3. 建立監控儀表板

### 中期 (1 個月)
1. 整合專業惡意軟體掃描服務
2. 使用完整的 ZIP 解析庫
3. 實施檔案內容深度分析

### 長期 (3 個月)
1. 機器學習驅動的異常檢測
2. 自動化安全測試流程
3. 定期滲透測試

---

## 📞 問題排查

### 問題 1: Secret Manager 權限錯誤
```
Error: Permission denied on resource project
```

**解決方案**:
```bash
# 確認 Service Account 有正確的權限
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:YOUR_SA" \
  --format="table(bindings.role)"
```

### 問題 2: 檔案驗證過於嚴格
```
Error: Unknown file extension: myfile.custom
```

**解決方案**:
在 `file-validator.ts` 中添加檔案類型到白名單：
```typescript
const ALLOWED_EXTENSIONS = [
  // ... existing extensions
  '.custom', // 添加你的自訂副檔名
];
```

### 問題 3: Cloud Run 無法讀取 Secret
```
Error: Secret not found or permission denied
```

**解決方案**:
```bash
# 授予 Cloud Run Service Account 權限
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## ✅ 完成確認

- [x] Secret Manager 工具函數已建立
- [x] Cloud Build 配置已更新
- [x] Deploy handler 已整合 Secret Manager
- [x] 檔案驗證工具已建立
- [x] Upload handler 已整合驗證
- [ ] GCP Secret Manager API 已啟用
- [ ] Service Account 權限已設定
- [ ] 已部署到生產環境
- [ ] 已執行測試驗證
- [ ] 監控已設定

---

**下一步**: 執行部署步驟並進行完整測試驗證
