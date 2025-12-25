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
    // SEO最適化ヒーローセクション
    title: 'AI Studioで作った。次はどうする？',
    titleHighlight: '30秒で世界中に公開',
    subtitle: 'デプロイの知識不要。サーバー費用不要。ZIPをドラッグして、APIキーを貼り付けるだけ。',

    // 痛点共感セクション
    painPoints: {
      title: 'こんな経験ありませんか？',
      items: [
        '「Vercelにデプロイしたけど画像が生成されない...」',
        '「リンクを共有したら友達がAI Studioのログイン画面に...」',
        '「環境変数やAPIキーを設定しても動かない...」',
        '「AIに一日中質問しても解決しなかった...」',
      ],
      solution: 'mite.nowはGoogle AI Studio専用設計。ドラッグ＆ドロップですぐ公開。',
    },

    // ステップ
    steps: {
      title: 'たった3ステップ',
      step1: {
        title: 'AI StudioからZIPをダウンロード',
        description: 'Downloadボタンをクリック',
      },
      step2: {
        title: 'mite.nowにドラッグ',
        description: 'ZIPをボックスに入れる',
      },
      step3: {
        title: 'APIキーを貼り付けて公開！',
        description: '専用URLを取得',
      },
    },

    // アップロードセクション
    uploadTitle: 'ZIPをここにドロップ',
    uploadSubtitle: 'Google AI Studio エクスポートに対応',

    // 設定
    configureTitle: '最後のステップ',
    configureSubtitle: 'サブドメインとAPIキーを入力',
    deployingTitle: 'アプリを公開中',
    deployingSubtitle: '通常2〜3分かかります',

    // 認証
    signInRequired: '公開するにはログイン',
    signInMessage: '無料アカウント、クレジットカード不要',
    signInButton: 'Googleでログイン',
    freeTier: '無料プラン：5デプロイ、72時間有効',

    // クォータ
    quotaExceeded: 'デプロイ上限に達しました',
    quotaExceededMessage: '{max}個のデプロイスロットをすべて使用しました。',
    quotaExceededFree: ' Proにアップグレードして増やしましょう！',
    quotaExceededPro: ' クォータパックを追加してください。',
    manageDeployments: 'デプロイを管理',
    upgradeToPro: 'Proにアップグレード',
    quotaDisplay: 'デプロイ数：{current}/{max}',
    ttlDisplay: '{hours}時間有効',

    // 機能
    features: {
      instant: 'ドラッグ＆デプロイ',
      secure: 'あなたのキー、あなたのコントロール',
      autoScale: 'グローバルCDN、瞬時ロード',
    },

    // 比較セクション
    comparison: {
      title: 'mite.now vs 自分でやる',
      theirs: {
        title: '自分でやる',
        items: [
          'Linuxコマンドを学ぶ',
          'サーバー費用を払う',
          'HTTPSを設定する',
          '接続問題をデバッグ',
        ],
      },
      ours: {
        title: 'mite.nowを使う',
        items: [
          'ドラッグ＆ドロップだけ',
          'インフラは私たちが担当',
          'HTTPS自動設定',
          'グローバルCDN、瞬時ロード',
        ],
      },
    },

    // FAQセクション
    faq: {
      title: 'よくある質問',
      items: [
        {
          q: 'Google AI Studioのアプリはデプロイできますか？',
          a: 'はい！AI StudioからZIPをダウンロードして、mite.nowにアップロードするだけで専用URLが取得できます。',
        },
        {
          q: 'なぜAPIキーが必要ですか？',
          a: 'APIキーを使ってアプリがGemini AIを呼び出します。mite.nowは無料ホスティングを提供し、あなたは自分のキー（無料枠あり）を持参するだけです。',
        },
        {
          q: '友達はGoogleにログインする必要がありますか？',
          a: 'いいえ！公開後のURLは誰でも直接アクセスして使用できます。',
        },
        {
          q: 'スマホで動きますか？',
          a: 'はい！mite.nowで公開されたすべてのアプリはモバイル対応です。',
        },
      ],
    },

    // APIキー説明
    apiKeyExplain: {
      title: 'なぜGeminiキーが必要？',
      description: '料理人（あなたのアプリ）として考えてください。私たちは無料のプロキッチン（ホスティング）を提供します。あなたは材料（APIキー）を持参するだけ。キッチンの家賃を払う必要がなく、料理した分だけ支払います！',
      cta: 'キーがまだ？1分で無料取得',
      ctaUrl: 'https://aistudio.google.com/app/apikey',
    },

    supportedBy: '対応ツール',
    frameworks: 'React • Streamlit • 静的HTML • Python Flask/FastAPI',

    footer: '© 2025 mite.now. AIプロジェクトを簡単に公開。',

    // CTA
    cta: {
      primary: '今すぐアプリを公開',
      secondary: '使い方を見る',
    },
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
