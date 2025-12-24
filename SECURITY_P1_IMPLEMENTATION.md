# 🔒 P1 安全修復實施指南

**實施日期**: 2024-12-24  
**修復範圍**: 速率限制 + CORS 強化 + 子網域所有權驗證 + 安全標頭  
**狀態**: ✅ 程式碼已完成，待部署測試

---

## 📋 已完成的修復

### ✅ 1. 速率限制 (Rate Limiting)

#### 新增檔案
- `worker/src/utils/rate-limiter.ts` - 完整的速率限制工具

#### 修改檔案
- `worker/src/index.ts` - 所有 API 端點整合速率限制

#### 速率限制配置

| 端點 | 限制 | 時間窗口 | 說明 |
|------|------|---------|------|
| `/api/v1/prepare` | 10 次 | 60 秒 | 檔案上傳準備 |
| `/api/v1/deploy` | 5 次 | 60 秒 | 部署觸發 |
| `/api/v1/upload/*` | 3 次 | 60 秒 | 檔案上傳 |
| `/api/v1/status/*` | 30 次 | 60 秒 | 狀態查詢 |
| `/api/v1/subdomain/*` | 20 次 | 60 秒 | 子網域操作 |
| `/api/v1/auth/*` | 10 次 | 300 秒 | 認證操作 |
| **全域限制** | 100 次 | 60 秒 | 所有端點總和 |

#### 用戶級別限制 (已認證用戶)

| 操作 | 限制 | 時間窗口 |
|------|------|---------|
| 部署 | 50 次 | 24 小時 |
| 上傳 | 100 次 | 24 小時 |

#### 實作特點
- ✅ 基於 IP 的速率限制
- ✅ 基於用戶 ID 的速率限制
- ✅ 使用 Cloudflare KV 儲存計數
- ✅ 自動過期機制
- ✅ 返回 `X-RateLimit-*` 標頭
- ✅ 429 Too Many Requests 回應

#### 程式碼範例
```typescript
// 自動應用到所有端點
if (path === '/api/v1/deploy') {
  await enforceRateLimit(env, request, 'deploy');
  response = await handleDeploy(request, env);
}

// 超過限制時自動拋出錯誤
// ApiError(429, 'Rate limit exceeded. Try again in 45 seconds.')
```

---

### ✅ 2. CORS 配置強化

#### 修改檔案
- `worker/src/index.ts` - `getCorsHeaders` 函數

#### 安全改善

**Before (不安全)**:
```typescript
// 允許所有 .mite.now 子網域
if (origin.endsWith('.mite.now')) return true; // ⚠️ 危險
```

**After (安全)**:
```typescript
// 嚴格的白名單，僅精確匹配
const allowedOrigins = [
  'https://mite.now',
  'https://www.mite.now',
  'http://localhost:3000'
];
const isAllowed = allowedOrigins.includes(origin); // ✅ 安全
```

#### 配置方式
透過環境變數 `ALLOWED_ORIGINS` 設定：
```bash
# wrangler.toml
[vars]
ALLOWED_ORIGINS = "https://mite.now,https://www.mite.now,http://localhost:3000"
```

#### 安全改善
- ✅ 移除通配符子網域匹配
- ✅ 僅允許明確列出的來源
- ✅ 防止惡意子網域攻擊
- ✅ 精確匹配，無模糊比對

---

### ✅ 3. 子網域所有權驗證

#### 修改檔案
- `worker/src/utils/kv.ts` - 新增所有權驗證和冷卻期
- `worker/src/handlers/subdomain.ts` - 整合用戶驗證
- `worker/src/types/index.ts` - AppRecord 新增 `user_id` 欄位

#### 新增功能

##### 3.1 所有權驗證
```typescript
// 檢查用戶是否可以釋放子網域
const canRelease = await canUserReleaseSubdomain(env, subdomain, userId);
if (!canRelease.canRelease) {
  throw new ApiError(403, canRelease.reason);
}
```

##### 3.2 冷卻期機制
- **擁有者**: 可以立即釋放自己的子網域
- **非擁有者**: 必須等待 **24 小時**冷卻期

##### 3.3 審計日誌
```typescript
// 所有釋放操作都會記錄
{
  subdomain: "example",
  appId: "app-123",
  userId: "user-456",
  timestamp: "2024-12-24T01:00:00Z",
  action: "release"
}
// 保留 90 天
```

#### 安全改善
- ✅ 防止子網域搶佔攻擊
- ✅ 保護用戶的子網域所有權
- ✅ 完整的操作審計追蹤
- ✅ 冷卻期防止濫用

---

### ✅ 4. 安全標頭

#### 新增檔案
- `worker/src/utils/security-headers.ts` - 安全標頭工具

#### 預設安全標頭

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
```

#### 使用方式
```typescript
import { addSecurityHeaders } from './utils/security-headers';

// 為回應添加安全標頭
response = addSecurityHeaders(response);
```

#### 安全改善
- ✅ 防止 MIME 類型嗅探
- ✅ 防止點擊劫持 (Clickjacking)
- ✅ 啟用 XSS 保護
- ✅ 強制 HTTPS (HSTS)
- ✅ 內容安全策略 (CSP)
- ✅ 限制瀏覽器功能權限

---

## 🚀 部署步驟

### 步驟 1: 更新環境變數

```bash
# 編輯 wrangler.toml
[vars]
ALLOWED_ORIGINS = "https://mite.now,https://www.mite.now,http://localhost:3000"

# 或使用 wrangler secret
wrangler secret put ALLOWED_ORIGINS
```

### 步驟 2: 部署 Worker

```bash
cd worker
npm install
npm run deploy
```

### 步驟 3: 驗證速率限制

```bash
# 測試速率限制 - 快速發送多個請求
for i in {1..15}; do
  curl -X POST https://api.mite.now/api/v1/prepare \
    -H "Content-Type: application/json" \
    -d '{"filename": "test.zip"}' &
done
wait

# 預期: 前 10 個成功，後 5 個返回 429
```

### 步驟 4: 驗證 CORS

```bash
# 測試允許的來源
curl -X OPTIONS https://api.mite.now/api/v1/health \
  -H "Origin: https://mite.now" \
  -H "Access-Control-Request-Method: GET" \
  -v

# 預期: 返回 Access-Control-Allow-Origin: https://mite.now

# 測試不允許的來源
curl -X OPTIONS https://api.mite.now/api/v1/health \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# 預期: 返回 Access-Control-Allow-Origin: https://mite.now (fallback)
```

### 步驟 5: 驗證子網域所有權

```bash
# 1. 部署一個應用 (會記錄 user_id)
curl -X POST https://api.mite.now/api/v1/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "app_id": "test-123",
    "subdomain": "myapp",
    "api_key": "..."
  }'

# 2. 嘗試立即釋放 (擁有者 - 應該成功)
curl -X POST https://api.mite.now/api/v1/subdomain/release/myapp \
  -H "Cookie: session=YOUR_SESSION"

# 3. 嘗試釋放他人的子網域 (非擁有者 - 應該失敗)
curl -X POST https://api.mite.now/api/v1/subdomain/release/someone-else \
  -H "Cookie: session=DIFFERENT_SESSION"

# 預期: 403 Forbidden - "Cooldown period active. 24 hours remaining."
```

---

## 🔍 驗證清單

### 速率限制驗證
- [ ] 單一 IP 超過限制時返回 429
- [ ] 回應包含 `X-RateLimit-*` 標頭
- [ ] 不同端點有不同的限制
- [ ] 全域限制正常運作
- [ ] 已認證用戶有更高的限制
- [ ] KV 中的計數器正確遞增和過期

### CORS 驗證
- [ ] 允許的來源可以正常請求
- [ ] 不允許的來源被拒絕
- [ ] 不再接受任意 `.mite.now` 子網域
- [ ] OPTIONS 預檢請求正常
- [ ] CORS 標頭正確設定

### 子網域所有權驗證
- [ ] 擁有者可以立即釋放自己的子網域
- [ ] 非擁有者必須等待冷卻期
- [ ] 冷卻期計算正確 (24 小時)
- [ ] 釋放操作被記錄到審計日誌
- [ ] 審計日誌保留 90 天

### 安全標頭驗證
- [ ] 所有回應包含安全標頭
- [ ] HSTS 標頭正確設定
- [ ] CSP 標頭防止內容注入
- [ ] X-Frame-Options 防止點擊劫持

---

## 📊 監控建議

### 1. 速率限制監控

```typescript
// 在 rate-limiter.ts 中添加
if (!result.allowed) {
  // 記錄到 Analytics
  env.ANALYTICS?.writeDataPoint({
    blobs: ['rate_limit_exceeded', endpoint],
    doubles: [1],
    indexes: [clientId]
  });
}
```

### 2. CORS 拒絕監控

```typescript
// 記錄被拒絕的來源
if (!isAllowed) {
  console.warn(`CORS rejected origin: ${origin}`);
}
```

### 3. 子網域釋放監控

```bash
# 查看審計日誌
wrangler kv:key list --namespace-id=YOUR_KV_ID --prefix="log:release:"

# 統計釋放次數
wrangler kv:key list --namespace-id=YOUR_KV_ID --prefix="log:release:" | wc -l
```

### 4. 設定 Cloudflare 警報

- 速率限制觸發次數異常升高
- 特定 IP 頻繁觸發速率限制
- 子網域釋放操作異常頻繁

---

## 🐛 已知問題與限制

### 1. 速率限制精確度
- KV 寫入有輕微延遲，極端情況下可能允許略超過限制
- **影響**: 極小，可接受
- **緩解**: 使用 Durable Objects 可獲得更精確的計數

### 2. CORS 配置彈性
- 需要手動更新環境變數來添加新來源
- **解決方案**: 考慮建立管理介面動態管理

### 3. 子網域冷卻期
- 24 小時可能對某些用戶來說太長
- **建議**: 根據用戶回饋調整為 12 或 6 小時

### 4. 審計日誌查詢
- KV 不支援複雜查詢，難以分析審計日誌
- **建議**: 考慮將日誌同步到 D1 或外部日誌服務

---

## 🔄 後續改善建議

### 短期 (1-2 週)
1. 整合安全標頭到所有回應
2. 建立速率限制監控儀表板
3. 實施自動化測試

### 中期 (1 個月)
1. 使用 Durable Objects 提升速率限制精確度
2. 建立 CORS 管理介面
3. 審計日誌同步到 D1

### 長期 (3 個月)
1. 智能速率限制 (基於用戶行為)
2. 異常檢測和自動封鎖
3. 完整的安全事件回應系統

---

## 📞 問題排查

### 問題 1: 速率限制過於嚴格

**症狀**: 正常用戶頻繁遇到 429 錯誤

**解決方案**:
```typescript
// 調整 rate-limiter.ts 中的配置
'deploy': {
  maxRequests: 10, // 從 5 增加到 10
  windowSeconds: 60,
  keyPrefix: 'rl:deploy'
}
```

### 問題 2: CORS 阻擋合法請求

**症狀**: 前端無法請求 API

**解決方案**:
```bash
# 檢查環境變數
wrangler secret list

# 更新允許的來源
wrangler secret put ALLOWED_ORIGINS
# 輸入: https://mite.now,https://www.mite.now,https://your-new-domain.com
```

### 問題 3: 子網域無法釋放

**症狀**: 用戶無法釋放自己的失敗部署

**解決方案**:
```typescript
// 檢查 AppRecord 是否正確設定 user_id
const record = await getAppRecord(env, appId);
console.log('Record user_id:', record?.user_id);

// 如果 user_id 未設定，手動更新
await updateAppStatus(env, appId, 'failed', { user_id: userId });
```

---

## ✅ 完成確認

- [x] 速率限制工具已建立
- [x] 所有 API 端點已整合速率限制
- [x] CORS 配置已強化
- [x] 子網域所有權驗證已實施
- [x] 冷卻期機制已實施
- [x] 審計日誌已實施
- [x] 安全標頭工具已建立
- [ ] 已部署到生產環境
- [ ] 已執行測試驗證
- [ ] 監控已設定

---

**下一步**: 執行部署步驟並進行完整測試驗證

**相關文件**:
- `SECURITY_AUDIT.md` - 完整安全審查報告
- `SECURITY_IMPLEMENTATION_GUIDE.md` - P0 修復實施指南
