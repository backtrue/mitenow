import type { Translation } from './en';

export const jp: Translation = {
  common: {
    signIn: 'ログイン',
    signOut: 'ログアウト',
    dashboard: 'ダッシュボード',
    admin: '管理画面',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    cancel: 'キャンセル',
    confirm: '確認',
    delete: '削除',
    save: '保存',
    back: '戻る',
  },
  
  nav: {
    home: 'ホーム',
    pricing: '料金',
    docs: 'ドキュメント',
    github: 'GitHub',
  },
  
  home: {
    title: 'AIアプリを',
    titleHighlight: '数秒で',
    subtitle: 'AI生成アプリをアップロードして、すぐにライブURLを取得。Google AI Studio、ChatGPTなどのコードに対応。',
    uploadTitle: 'アプリをアップロード',
    uploadSubtitle: 'ZIPファイルをドラッグ&ドロップ — フレームワークを自動検出します',
    configureTitle: 'デプロイ設定',
    configureSubtitle: 'サブドメインを選択してAPIキーを追加',
    deployingTitle: 'アプリをデプロイ中',
    deployingSubtitle: 'ビルドとデプロイを実行しています',
    
    signInRequired: 'デプロイするにはログイン',
    signInMessage: '無料アカウントを作成してアプリのデプロイを開始',
    signInButton: 'Googleでログイン',
    freeTier: '無料プラン：5デプロイ、72時間有効',
    
    quotaExceeded: 'デプロイ上限に達しました',
    quotaExceededMessage: '{max}個のデプロイスロットをすべて使用しました。',
    quotaExceededFree: ' Proにアップグレードして増やしましょう！',
    quotaExceededPro: ' クォータパックを追加してください。',
    manageDeployments: 'デプロイを管理',
    upgradeToPro: 'Proにアップグレード',
    
    quotaDisplay: 'デプロイ数：{current}/{max}',
    ttlDisplay: '{hours}時間有効',
    
    features: {
      instant: '即時デプロイ',
      secure: 'セキュアキー',
      autoScale: '自動スケール',
    },
    
    supportedBy: '以下のツールで生成されたアプリに対応',
    frameworks: 'Python (Streamlit, Gradio, Flask, FastAPI) • React • Next.js • 静的HTML',
    
    footer: '© 2025 mite.now. AIアプリを簡単にデプロイ。',
  },
  
  login: {
    title: 'デプロイを管理するにはログイン',
    continueWith: 'Googleで続ける',
    terms: 'ログインすることで、',
    termsLink: '利用規約',
    and: 'と',
    privacyLink: 'プライバシーポリシー',
    backToHome: '← ホームに戻る',
  },
  
  dashboard: {
    title: 'あなたのデプロイ',
    noDeployments: 'デプロイがありません',
    noDeploymentsMessage: '最初のアプリをアップロードして始めましょう',
    deployNow: '今すぐデプロイ',
    newDeployment: '新規デプロイ',
    
    subscription: {
      title: 'サブスクリプション',
      free: '無料',
      pro: 'Pro',
      paymentDue: '支払い期限',
      upgradeMessage: 'Proにアップグレードして、より多くのデプロイ、カスタムドメイン、データベースサポートを利用できます。',
      upgradeButton: 'Proにアップグレード - $2.99/月',
      manageButton: 'サブスクリプション管理',
    },
    
    usage: {
      title: '使用状況',
      deployments: 'デプロイ数',
      expiresIn: '⏱️ 無料デプロイは{hours}時間後に期限切れになります',
      addQuota: '5個追加 (+$0.99/月)',
    },
    
    deployment: {
      status: {
        active: '稼働中',
        building: 'ビルド中',
        failed: '失敗',
        pending: '待機中',
      },
      created: '作成日時',
      expires: '期限',
      deleteConfirm: 'このデプロイを削除してもよろしいですか？',
    },
    
    checkout: {
      success: '🎉 Proへようこそ！サブスクリプションが有効になりました。',
      canceled: 'チェックアウトがキャンセルされました。いつでもアップグレードできます。',
    },
  },
  
  admin: {
    title: '管理ダッシュボード',
    stats: '統計',
    deployments: 'デプロイ',
    users: 'ユーザー',
    revenue: '収益',
    
    totalDeployments: '総デプロイ数',
    activeDeployments: '稼働中',
    totalUsers: '総ユーザー数',
    proUsers: 'Proユーザー',
    
    search: 'デプロイを検索...',
    filter: {
      all: 'すべて',
      active: '稼働中',
      building: 'ビルド中',
      failed: '失敗',
    },
    
    deployment: {
      owner: '所有者',
      framework: 'フレームワーク',
      status: 'ステータス',
      created: '作成日時',
      actions: 'アクション',
      view: '表示',
      delete: '削除',
    },
  },
  
  errors: {
    uploadFailed: 'アップロード失敗',
    deploymentFailed: 'デプロイ失敗',
    quotaExceeded: 'デプロイクォータを超過',
    unauthorized: '未認証',
    notFound: '見つかりません',
    serverError: 'サーバーエラー',
  },
};
