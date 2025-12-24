import type { Translation } from './en';

export const tw: Translation = {
  common: {
    signIn: '登入',
    signOut: '登出',
    dashboard: '儀表板',
    admin: '管理後台',
    loading: '載入中...',
    error: '錯誤',
    success: '成功',
    cancel: '取消',
    confirm: '確認',
    delete: '刪除',
    save: '儲存',
    back: '返回',
  },
  
  nav: {
    home: '首頁',
    pricing: '價格',
    docs: '文件',
    github: 'GitHub',
  },
  
  home: {
    title: '在',
    titleHighlight: '幾秒內',
    subtitle: '上傳你的 AI 生成應用程式，立即獲得線上網址。支援 Google AI Studio、ChatGPT 等工具產生的程式碼。',
    uploadTitle: '上傳你的應用程式',
    uploadSubtitle: '拖放你的 ZIP 檔案 — 我們會自動偵測框架',
    configureTitle: '設定部署',
    configureSubtitle: '選擇你的子網域並新增 API 金鑰',
    deployingTitle: '正在部署你的應用程式',
    deployingSubtitle: '請稍候，我們正在建置並部署你的應用程式',
    
    signInRequired: '登入以開始部署',
    signInMessage: '建立免費帳號開始部署你的應用程式',
    signInButton: '使用 Google 登入',
    freeTier: '免費方案：5 個部署，72 小時有效期',
    
    quotaExceeded: '已達部署上限',
    quotaExceededMessage: '你已使用全部 {max} 個部署配額。',
    quotaExceededFree: ' 升級至 Pro 獲得更多！',
    quotaExceededPro: ' 新增更多配額包。',
    manageDeployments: '管理部署',
    upgradeToPro: '升級至 Pro',
    
    quotaDisplay: '部署數量：{current}/{max}',
    ttlDisplay: '{hours} 小時有效期',
    
    features: {
      instant: '即時部署',
      secure: '安全金鑰',
      autoScale: '自動擴展',
    },
    
    supportedBy: '支援以下工具產生的應用程式',
    frameworks: 'Python (Streamlit, Gradio, Flask, FastAPI) • React • Next.js • 靜態 HTML',
    
    footer: '© 2025 mite.now. 輕鬆部署 AI 應用程式。',
  },
  
  login: {
    title: '登入以管理你的部署',
    continueWith: '使用 Google 繼續',
    terms: '登入即表示你同意我們的',
    termsLink: '服務條款',
    and: '和',
    privacyLink: '隱私政策',
    backToHome: '← 返回首頁',
  },
  
  dashboard: {
    title: '你的部署',
    noDeployments: '尚無部署',
    noDeploymentsMessage: '上傳你的第一個應用程式開始使用',
    deployNow: '立即部署',
    newDeployment: '新增部署',
    
    subscription: {
      title: '訂閱方案',
      free: '免費',
      pro: 'Pro',
      paymentDue: '待付款',
      upgradeMessage: '升級至 Pro 以獲得更多部署、自訂網域和資料庫支援。',
      upgradeButton: '升級至 Pro - $2.99/月',
      manageButton: '管理訂閱',
    },
    
    usage: {
      title: '使用量',
      deployments: '部署數量',
      expiresIn: '⏱️ 免費部署將在 {hours} 小時後過期',
      addQuota: '新增 5 個配額 (+$0.99/月)',
    },
    
    deployment: {
      status: {
        active: '運行中',
        building: '建置中',
        failed: '失敗',
        pending: '等待中',
      },
      created: '建立時間',
      expires: '過期時間',
      deleteConfirm: '確定要刪除此部署嗎？',
    },
    
    checkout: {
      success: '🎉 歡迎使用 Pro！你的訂閱已啟用。',
      canceled: '結帳已取消。你可以隨時升級。',
    },
  },
  
  admin: {
    title: '管理後台',
    stats: '統計資料',
    deployments: '部署',
    users: '用戶',
    revenue: '收益',
    
    totalDeployments: '總部署數',
    activeDeployments: '運行中',
    totalUsers: '總用戶數',
    proUsers: 'Pro 用戶',
    
    search: '搜尋部署...',
    filter: {
      all: '全部',
      active: '運行中',
      building: '建置中',
      failed: '失敗',
    },
    
    deployment: {
      owner: '擁有者',
      framework: '框架',
      status: '狀態',
      created: '建立時間',
      actions: '操作',
      view: '查看',
      delete: '刪除',
    },
  },
  
  errors: {
    uploadFailed: '上傳失敗',
    deploymentFailed: '部署失敗',
    quotaExceeded: '已超過部署配額',
    unauthorized: '未授權',
    notFound: '找不到',
    serverError: '伺服器錯誤',
  },
};
