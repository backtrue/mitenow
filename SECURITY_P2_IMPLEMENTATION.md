# 🔒 P2 安全修復實施指南

**實施日期**: 2024-12-24  
**修復範圍**: 會話輪換機制 + 錯誤處理改善  
**狀態**: ✅ 程式碼已完成，待部署測試

---

## 📋 已完成的修復

### ✅ 1. 會話輪換機制 (Session Rotation)

#### 新增檔案
- `worker/src/utils/session-manager.ts` - 完整的會話管理工具

#### 修改檔案
- `worker/src/handlers/auth.ts` - 整合會話輪換
- `worker/src/types/index.ts` - 新增 ENVIRONMENT 欄位

#### 會話安全策略

| 參數 | 值 | 說明 |
|------|-----|------|
| **會話有效期** | 30 天 | 每次活動後延長 |
| **輪換間隔** | 24 小時 | 自動更換 session ID |
| **絕對超時** | 90 天 | 強制重新登入 |
| **Cookie 設定** | HttpOnly, Secure, SameSite=Lax | 防止 XSS 和 CSRF |

#### 實作特點

##### 1.1 自動會話輪換
```typescript
// 每 24 小時自動輪換 session ID
if (timeSinceRotation > 24 hours) {
  newSessionId = rotateSession(oldSessionId);
  // 舊 session 立即失效
}
```

##### 1.2 絕對超時保護
```typescript
// 90 天後強制重新登入
if (sessionAge > 90 days) {
  deleteSession(sessionId);
  throw new Error('SESSION_EXPIRED');
}
```

##### 1.3 透明輪換
- 用戶無感知的 session ID 更換
- 自動設定新的 session cookie
- 保持用戶登入狀態

##### 1.4 會話追蹤
```typescript
interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  last_rotated_at: number;
  rotation_count: number; // 輪換次數
}
```

#### 安全改善
- ✅ 防止會話劫持 (Session Hijacking)
- ✅ 限制會話生命週期
- ✅ 自動清理過期會話
- ✅ 追蹤會話輪換歷史
- ✅ 強制定期重新認證

#### 程式碼範例

**Before (無輪換)**:
```typescript
// 會話永久有效，容易被劫持
const user = await getCurrentUser(request, env);
```

**After (自動輪換)**:
```typescript
// 自動檢查並輪換會話
const result = await getCurrentUserWithRotation(request, env);
if (result.newSessionId) {
  // 設定新的 session cookie
  response.headers.set('Set-Cookie', getSessionCookieConfig(result.newSessionId));
}
```

---

### ✅ 2. 錯誤處理改善

#### 修改檔案
- `worker/src/index.ts` - 主錯誤處理邏輯
- `worker/src/utils/security-headers.ts` - 安全錯誤回應

#### 安全改善

##### 2.1 生產環境通用錯誤訊息

**Before (洩露內部資訊)**:
```typescript
// ⚠️ 危險：洩露堆疊追蹤和內部錯誤
catch (error) {
  return Response.json({
    error: error.message, // "Database connection failed at line 123"
    stack: error.stack     // 完整堆疊追蹤
  });
}
```

**After (安全的錯誤訊息)**:
```typescript
// ✅ 安全：生產環境使用通用訊息
const isProduction = env.ENVIRONMENT === 'production';

if (error instanceof ApiError) {
  // 預期的錯誤，可以顯示詳細訊息
  return Response.json({ error: error.message });
}

// 內部錯誤，使用通用訊息
const message = isProduction 
  ? 'An internal error occurred. Please try again later.'
  : error.message; // 開發環境顯示詳細訊息
```

##### 2.2 錯誤分類

| 錯誤類型 | 生產環境訊息 | 開發環境訊息 | 狀態碼 |
|---------|------------|------------|--------|
| **ApiError** | 原始訊息 | 原始訊息 | 自訂 |
| **內部錯誤** | 通用訊息 | 詳細訊息 | 500 |
| **未預期錯誤** | 通用訊息 | 詳細訊息 | 500 |

##### 2.3 安全標頭整合
```typescript
// 所有錯誤回應都包含安全標頭
const response = new Response(JSON.stringify(error), {
  status: 500,
  headers: { 'Content-Type': 'application/json' }
});

return addSecurityHeaders(response);
// 自動添加: X-Content-Type-Options, X-Frame-Options, CSP 等
```

#### 安全改善
- ✅ 防止資訊洩露
- ✅ 隱藏內部實作細節
- ✅ 統一錯誤格式
- ✅ 所有回應包含安全標頭
- ✅ 開發環境保留詳細訊息

---

## 🗄️ 資料庫變更

### 需要更新 sessions 表結構

```sql
-- 添加會話輪換追蹤欄位
ALTER TABLE sessions ADD COLUMN last_rotated_at INTEGER;
ALTER TABLE sessions ADD COLUMN rotation_count INTEGER DEFAULT 0;

-- 如果表不存在，完整建立語句：
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_rotated_at INTEGER NOT NULL,
  rotation_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## 🚀 部署步驟

### 步驟 1: 更新資料庫結構

```bash
# 連接到 D1 資料庫
wrangler d1 execute DB --command="
ALTER TABLE sessions ADD COLUMN last_rotated_at INTEGER;
ALTER TABLE sessions ADD COLUMN rotation_count INTEGER DEFAULT 0;
"

# 更新現有會話的新欄位
wrangler d1 execute DB --command="
UPDATE sessions 
SET last_rotated_at = created_at, 
    rotation_count = 0 
WHERE last_rotated_at IS NULL;
"
```

### 步驟 2: 設定環境變數

```bash
# 編輯 wrangler.toml
[vars]
ENVIRONMENT = "production"

# 或使用 wrangler secret
wrangler secret put ENVIRONMENT
# 輸入: production
```

### 步驟 3: 部署 Worker

```bash
cd worker
npm install
npm run deploy
```

### 步驟 4: 驗證會話輪換

```bash
# 1. 登入獲取 session cookie
curl -X POST https://api.mite.now/api/v1/auth/login \
  -c cookies.txt

# 2. 使用 session 請求 /me 端點
curl -X GET https://api.mite.now/api/v1/auth/me \
  -b cookies.txt \
  -v

# 檢查回應標頭是否包含新的 Set-Cookie (如果已輪換)

# 3. 模擬 24 小時後的請求
# (需要手動修改資料庫中的 last_rotated_at 來測試)
wrangler d1 execute DB --command="
UPDATE sessions 
SET last_rotated_at = last_rotated_at - 86400000 
WHERE id = 'YOUR_SESSION_ID';
"

# 再次請求，應該會收到新的 session cookie
curl -X GET https://api.mite.now/api/v1/auth/me \
  -b cookies.txt \
  -v
```

### 步驟 5: 驗證錯誤處理

```bash
# 測試生產環境錯誤訊息
curl -X POST https://api.mite.now/api/v1/deploy \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' \
  -v

# 預期回應 (生產環境):
# {
#   "error": {
#     "code": "INTERNAL_ERROR",
#     "message": "An internal error occurred. Please try again later."
#   }
# }

# 檢查回應標頭是否包含安全標頭
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

---

## 🔍 驗證清單

### 會話輪換驗證
- [ ] 新登入創建的會話包含 `last_rotated_at` 和 `rotation_count`
- [ ] 24 小時後請求自動觸發會話輪換
- [ ] 輪換後舊 session ID 立即失效
- [ ] 輪換後新 session cookie 正確設定
- [ ] 90 天絕對超時強制重新登入
- [ ] `rotation_count` 正確遞增
- [ ] 過期會話自動清理

### 錯誤處理驗證
- [ ] 生產環境內部錯誤使用通用訊息
- [ ] 開發環境顯示詳細錯誤訊息
- [ ] ApiError 正確顯示自訂訊息
- [ ] 所有錯誤回應包含安全標頭
- [ ] 錯誤回應格式統一
- [ ] 不洩露堆疊追蹤或內部路徑

---

## 📊 監控建議

### 1. 會話輪換監控

```typescript
// 記錄會話輪換事件
console.log('Session rotated', {
  userId: user.id,
  oldSessionId,
  newSessionId,
  rotationCount: session.rotation_count,
  sessionAge: now - session.created_at
});
```

### 2. 會話統計

```sql
-- 查看會話輪換統計
SELECT 
  AVG(rotation_count) as avg_rotations,
  MAX(rotation_count) as max_rotations,
  COUNT(*) as total_sessions
FROM sessions;

-- 查看即將過期的會話
SELECT COUNT(*) 
FROM sessions 
WHERE expires_at < (strftime('%s', 'now') * 1000 + 86400000);
```

### 3. 錯誤監控

```typescript
// 記錄生產環境錯誤（不包含敏感資訊）
if (isProduction && !(error instanceof ApiError)) {
  console.error('Internal error occurred', {
    timestamp: new Date().toISOString(),
    endpoint: request.url,
    method: request.method,
    // 不記錄錯誤訊息或堆疊
  });
}
```

### 4. 設定 Cloudflare 警報

- 會話輪換失敗率異常升高
- 大量會話在短時間內過期
- 內部錯誤發生頻率異常
- 特定端點錯誤率升高

---

## 🐛 已知問題與限制

### 1. 會話輪換時機
- 輪換僅在用戶請求時觸發，不會主動推送
- **影響**: 不活躍用戶的會話可能延遲輪換
- **緩解**: 這是預期行為，不活躍會話風險較低

### 2. 資料庫遷移
- 現有會話需要手動更新新欄位
- **解決方案**: 部署時執行遷移腳本

### 3. 多裝置登入
- 會話輪換可能導致其他裝置的會話失效
- **影響**: 用戶需要在其他裝置重新登入
- **建議**: 考慮實施多會話管理

### 4. 錯誤訊息粒度
- 生產環境錯誤訊息過於通用，可能影響除錯
- **建議**: 使用錯誤追蹤服務 (如 Sentry) 記錄詳細錯誤

---

## 🔄 後續改善建議

### 短期 (1-2 週)
1. 實施自動化會話清理排程
2. 建立會話管理儀表板
3. 添加會話活動日誌

### 中期 (1 個月)
1. 多裝置會話管理
2. 可疑活動檢測（異常 IP、位置變更）
3. 整合錯誤追蹤服務 (Sentry)

### 長期 (3 個月)
1. 實施 Refresh Token 機制
2. 基於風險的會話管理（高風險操作要求重新認證）
3. 會話指紋識別（裝置、瀏覽器特徵）

---

## 📞 問題排查

### 問題 1: 用戶頻繁被登出

**症狀**: 用戶抱怨需要頻繁重新登入

**可能原因**:
1. 會話輪換失敗
2. Cookie 未正確設定
3. 絕對超時觸發

**解決方案**:
```sql
-- 檢查用戶的會話記錄
SELECT * FROM sessions WHERE user_id = 'USER_ID';

-- 檢查輪換次數
SELECT rotation_count, created_at, last_rotated_at 
FROM sessions 
WHERE user_id = 'USER_ID';
```

### 問題 2: 會話輪換後前端未更新 cookie

**症狀**: 輪換後用戶下次請求失敗

**解決方案**:
```typescript
// 前端需要處理 Set-Cookie 標頭
// 確保 CORS 設定允許 credentials
fetch('/api/v1/auth/me', {
  credentials: 'include' // 重要！
});
```

### 問題 3: 錯誤訊息在開發環境也是通用的

**症狀**: 開發時無法看到詳細錯誤

**解決方案**:
```bash
# 確認環境變數設定
wrangler secret list

# 開發環境設定
wrangler dev --var ENVIRONMENT:development

# 或在 .dev.vars 中設定
echo "ENVIRONMENT=development" >> .dev.vars
```

---

## ✅ 完成確認

- [x] 會話管理工具已建立
- [x] 會話輪換機制已實施
- [x] 絕對超時保護已實施
- [x] 錯誤處理已改善
- [x] 安全標頭已整合
- [x] TypeScript 錯誤已修復
- [ ] 資料庫遷移已執行
- [ ] 已部署到生產環境
- [ ] 已執行測試驗證
- [ ] 監控已設定

---

## 🔗 相關資源

### 會話安全最佳實踐
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Session Fixation Attack Prevention](https://owasp.org/www-community/attacks/Session_fixation)

### 錯誤處理最佳實踐
- [OWASP Error Handling](https://owasp.org/www-community/Improper_Error_Handling)
- [Cloudflare Workers Error Handling](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#error-handling)

---

**下一步**: 執行資料庫遷移並部署到生產環境

**相關文件**:
- `SECURITY_AUDIT.md` - 完整安全審查報告
- `SECURITY_IMPLEMENTATION_GUIDE.md` - P0 修復實施指南
- `SECURITY_P1_IMPLEMENTATION.md` - P1 修復實施指南
