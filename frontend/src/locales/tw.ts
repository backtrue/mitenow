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
    // SEO 優化 Hero Section
    title: 'Google AI Studio 做好了，然後呢？',
    titleHighlight: '30 秒，讓全世界都能用你的作品',
    subtitle: '不用學部署、不用買伺服器、不用搞 Vercel。把 ZIP 拖進來，貼上你的 API Key，搞定。',

    // 痛點共鳴區
    painPoints: {
      title: '你是不是也遇到這些問題？',
      items: [
        '「部署到 Vercel，圖片怎樣都生不出來...」',
        '「傳連結給朋友，結果打開的是 AI Studio 介面...」',
        '「環境變數、API Key 設定了還是沒用...」',
        '「問了 AI 一整天還是解決不了...」',
      ],
      solution: 'mite.now 專為 Google AI Studio 打造，一拖即上線。',
    },

    // 三步驟
    steps: {
      title: '只需三步',
      step1: {
        title: '從 AI Studio 下載 ZIP',
        description: '點一下「Download」按鈕',
      },
      step2: {
        title: '拖進 mite.now',
        description: '把 ZIP 丟進框框',
      },
      step3: {
        title: '貼上 API Key，發布！',
        description: '獲得你的專屬網址',
      },
    },

    // 上傳區
    uploadTitle: '把你的 ZIP 拖到這裡',
    uploadSubtitle: '支援 Google AI Studio 匯出的專案',

    // 設定
    configureTitle: '最後一步',
    configureSubtitle: '填入子網域和 API 金鑰',
    deployingTitle: '正在發布你的應用程式',
    deployingSubtitle: '通常需要 2-3 分鐘',

    // 登入相關
    signInRequired: '登入以開始發布',
    signInMessage: '免費帳號，免信用卡',
    signInButton: '使用 Google 登入',
    freeTier: '免費方案：5 個部署，72 小時有效期',

    // 配額
    quotaExceeded: '已達部署上限',
    quotaExceededMessage: '你已使用全部 {max} 個部署配額。',
    quotaExceededFree: ' 升級至 Pro 獲得更多！',
    quotaExceededPro: ' 新增更多配額包。',
    manageDeployments: '管理部署',
    upgradeToPro: '升級至 Pro',
    quotaDisplay: '部署數量：{current}/{max}',
    ttlDisplay: '{hours} 小時有效期',

    // 功能亮點
    features: {
      instant: '一拖即上線',
      secure: '你的 Key，你作主',
      autoScale: '全球加速，秒開',
    },

    // 優勢比較
    comparison: {
      title: 'mite.now vs 自己部署',
      theirs: {
        title: '自己搞',
        items: [
          '要學 Linux 指令',
          '設定伺服器很貴',
          '搞不定 HTTPS/網域',
          '朋友連不上',
        ],
      },
      ours: {
        title: '用 mite.now',
        items: [
          '拖放上傳就好',
          '基礎設施我們出',
          '自動配發安全網址',
          '全球 CDN，秒開',
        ],
      },
    },

    // FAQ
    faq: {
      title: '常見問題',
      items: [
        {
          q: 'Google AI Studio 做出來的東西可以部署嗎？',
          a: '可以！只要從 AI Studio 下載 ZIP，上傳到 mite.now 就能獲得專屬網址。',
        },
        {
          q: '為什麼需要 API Key？',
          a: 'API Key 讓你的應用可以呼叫 Gemini AI。mite.now 提供免費的主機空間，你只需要自備 API Key（有免費額度）。',
        },
        {
          q: '我的朋友需要登入 Google 才能用嗎？',
          a: '不用！發布後的網址任何人都可以直接打開使用。',
        },
        {
          q: '支援手機嗎？',
          a: '支援！所有透過 mite.now 發布的應用都會自動適配手機螢幕。',
        },
      ],
    },

    // API Key 說明
    apiKeyExplain: {
      title: '為什麼需要我的 Gemini Key？',
      description: '把你想像成「餐廳大廚」(你的 App)，我們提供「免費的頂級廚房」(主機)，你只需要自備「食材」(API Key)。這樣做的好處是：你不需要付昂貴的廚房租金，而且食材用多少算多少，完全透明！',
      cta: '還沒有 Key？1 分鐘免費申請',
      ctaUrl: 'https://aistudio.google.com/app/apikey',
    },

    supportedBy: '專為這些工具打造',
    frameworks: 'React • Streamlit • 靜態 HTML • Python Flask/FastAPI',

    footer: '© 2025 mite.now. 讓 AI 專案上線變簡單。',

    // CTA
    cta: {
      primary: '立即發布我的 AI 應用',
      secondary: '看看怎麼做',
    },
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
