PRD (產品需求文件) - mite.now1. 產品願景mite.now 旨在消除 AI 應用從「開發」到「部署」的最後一哩路，讓不具備 DevOps 經驗的開發者（Vibe Coders）能以最直覺的「拖放 ZIP」方式，在 60 秒內將 Google AI Studio 的作品轉化為具備自定義網址的 SaaS 原型。2. User Stories (使用者故事)ID角色需求 (Want)目的 (So that)US.1Vibe Coder上傳從 AI Studio 下載的 ZIP 檔無需設定 Git Repo 或處理 Dockerfile 即可看到 App 在線運行。US.2開發者在介面輸入自己的 Gemini API KeyApp 部署後能正確調用 AI 模型，且不需將 Key 寫死在程式碼中。US.3原型設計師獲得一個 [name].mite.now 的網址方便分享給客戶或社群，展現專業感與品牌識別。US.4終端使用者存取子網域網址能夠直接與 AI 工具互動，不需知道後端運行在 Cloud Run。US.5管理者設定 App 的自動失效時間 (TTL)節省伺服器資源，並針對不同等級用戶提供不同託管方案。3. 功能規格 (Functional Specifications)3.1 部署流 (Deployment Pipeline)ZIP 解析器： 掃描 ZIP 根目錄，辨識 app.py 或 main.py，並偵測 requirements.txt 中的關鍵套件（Streamlit/Gradio）。Dockerfile 注入器： 基於偵測結果，動態生成標準化的 Dockerfile。環境變數對應： UI 收集的 API Key 必須映射至容器環境變數 GOOGLE_API_KEY。3.2 路由管理 (Routing)Wildcard DNS： 支援 *.mite.now 解析。反向代理 (Reverse Proxy)： 隱藏 Google Cloud Run 的原始 .a.run.app 網址，維持 mite.now 的域名一致性。4. 驗收標準 (Acceptance Criteria)App 必須在 90 秒內完成「上傳 -> 構建 -> 部署」。如果 ZIP 內缺少 requirements.txt，系統應自動補齊基礎 Python 環境而非報錯。用戶上傳的 API Key 嚴禁儲存於任何持久化資料庫中（除 Cloud Run 運算環境外）。SDD (軟體設計文件) - mite.now1. 系統組件架構Frontend (Cloudflare Pages): Next.js SPA，處理文件上傳與狀態輪詢。Orchestrator (Cloudflare Workers): 核心 API 層。負責產出簽署網址 (Signed URL) 給用戶直接上傳至 R2。調用 Google Cloud Build API 觸發構建。管理 KV 狀態（存儲 slug -> cloud_run_url）。Storage (Cloudflare R2): 儲存用戶上傳的原始 ZIP 與構建生成的日誌。Build Engine (Google Cloud Build):執行 docker build。推送到 Artifact Registry。Runtime (Google Cloud Run): 執行 Python 容器，設定 min-instances: 0。2. 資料庫/狀態設計 (Cloudflare KV)Key: app:[slug]Value: ```json{"status": "deployed","target_url": "https://www.google.com/search?q=https://service-hash.us-central1.a.run.app","created_at": 1700000000,"ttl": 86400}
3. API 端點設計 (Cloudflare Workers)MethodPathDescriptionPayloadPOST/api/v1/prepare取得 R2 上傳簽署網址與 AppID{ "filename": "app.zip" }POST/api/v1/deploy觸發 GCP 構建與部署流程{ "app_id": "xxx", "api_key": "sk-...", "subdomain": "my-tool" }GET/api/v1/status/:id查詢部署進度與最終 URLNone4. 核心邏輯實作 (Claude 開發參考)A. 動態 Dockerfile 生成邏輯 (Python)Python# 基於偵測到的框架生成內容
DOCKER_TEMPLATES = {
    "streamlit": """
FROM python:3.9-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8080
CMD ["streamlit", "run", "app.py", "--server.port=8080", "--server.address=0.0.0.0"]
""",
    "gradio": """
FROM python:3.9-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8080
ENV GRADIO_SERVER_NAME="0.0.0.0"
ENV GRADIO_SERVER_PORT=8080
CMD ["python", "app.py"]
"""
}
B. Cloudflare Worker 反向代理實作JavaScript// 處理 *.mite.now 的請求
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.hostname.split('.')[0];
    
    // 排除官方首頁
    if (slug === 'mite' || slug === 'www') return env.ASSETS.fetch(request);

    const appData = await env.MITE_KV.get(`app:${slug}`, { type: "json" });
    if (!appData) return new Response("App Not Found", { status: 404 });

    // 修改 Request Header 進行轉發
    const newRequest = new Request(appData.target_url + url.pathname + url.search, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    return fetch(newRequest);
  }
}
5. 安全考量 (Security Checklist)CORS: 僅允許 mite.now 網域調用部署 API。Container Isolation: Cloud Run 啟用二代執行環境 (gVisor)，防止容器逃逸。Key Protection: API Key 傳輸過程必須全程加密，且在容器環境變數中設定 No-Persist。Resource Quota: 限制單一容器記憶體上限為 512MB，防止資源濫用。