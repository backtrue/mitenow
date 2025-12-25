export const en = {
  common: {
    signIn: 'Sign In',
    signOut: 'Logout',
    dashboard: 'Dashboard',
    admin: 'Admin',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    save: 'Save',
    back: 'Back',
  },

  nav: {
    home: 'Home',
    pricing: 'Pricing',
    docs: 'Docs',
    github: 'GitHub',
  },

  home: {
    // SEO-Optimized Hero Section
    title: 'Built in AI Studio. Now what?',
    titleHighlight: '30 seconds to share with the world',
    subtitle: 'No deployment skills needed. No server costs. Just drag your ZIP, paste your API Key, done.',

    // Pain Points Section
    painPoints: {
      title: 'Sound familiar?',
      items: [
        '"Deployed to Vercel but images won\'t generate..."',
        '"Shared the link but friends see AI Studio login..."',
        '"Set up env vars and API Key but still nothing..."',
        '"Asked AI for help all day, still stuck..."',
      ],
      solution: 'mite.now is built for Google AI Studio. Drag, drop, done.',
    },

    // Steps
    steps: {
      title: 'Just 3 Steps',
      step1: {
        title: 'Download ZIP from AI Studio',
        description: 'Click the Download button',
      },
      step2: {
        title: 'Drag into mite.now',
        description: 'Drop your ZIP into the box',
      },
      step3: {
        title: 'Paste API Key & Publish!',
        description: 'Get your unique URL',
      },
    },

    // Upload Section
    uploadTitle: 'Drop your ZIP here',
    uploadSubtitle: 'Supports Google AI Studio exports',

    // Configuration
    configureTitle: 'Final Step',
    configureSubtitle: 'Enter your subdomain and API Key',
    deployingTitle: 'Publishing Your App',
    deployingSubtitle: 'Usually takes 2-3 minutes',

    // Authentication
    signInRequired: 'Sign in to publish',
    signInMessage: 'Free account, no credit card',
    signInButton: 'Sign in with Google',
    freeTier: 'Free tier: 5 deployments, 72-hour TTL',

    // Quota
    quotaExceeded: 'Deployment limit reached',
    quotaExceededMessage: 'You\'ve used all {max} deployment slots.',
    quotaExceededFree: ' Upgrade to Pro for more!',
    quotaExceededPro: ' Add more quota packs.',
    manageDeployments: 'Manage Deployments',
    upgradeToPro: 'Upgrade to Pro',
    quotaDisplay: 'Deployments: {current}/{max}',
    ttlDisplay: '{hours}h TTL',

    // Features
    features: {
      instant: 'Drag & Deploy',
      secure: 'Your Key, Your Control',
      autoScale: 'Global CDN, Instant Load',
    },

    // Comparison Section
    comparison: {
      title: 'mite.now vs DIY',
      theirs: {
        title: 'Do It Yourself',
        items: [
          'Learn Linux commands',
          'Pay for servers',
          'Figure out HTTPS',
          'Debug connection issues',
        ],
      },
      ours: {
        title: 'Use mite.now',
        items: [
          'Just drag and drop',
          'We handle the infra',
          'Auto HTTPS included',
          'Global CDN, instant load',
        ],
      },
    },

    // FAQ Section
    faq: {
      title: 'FAQ',
      items: [
        {
          q: 'Can I deploy Google AI Studio apps?',
          a: 'Yes! Download the ZIP from AI Studio, upload to mite.now, and get your own URL.',
        },
        {
          q: 'Why do I need an API Key?',
          a: 'The API Key lets your app call Gemini AI. mite.now provides free hosting, you just bring your own key (which has free quota).',
        },
        {
          q: 'Do my friends need to log into Google?',
          a: 'No! Anyone can open and use your published app directly.',
        },
        {
          q: 'Does it work on mobile?',
          a: 'Yes! All apps published via mite.now are mobile-responsive.',
        },
      ],
    },

    // API Key Explanation
    apiKeyExplain: {
      title: 'Why do I need my Gemini Key?',
      description: 'Think of yourself as a chef (your app). We provide a free professional kitchen (hosting). You just bring your own ingredients (API Key). This way you don\'t pay rent for the kitchen, and only pay for what you cook!',
      cta: 'No Key yet? Get one free in 1 minute',
      ctaUrl: 'https://aistudio.google.com/app/apikey',
    },

    supportedBy: 'Built for',
    frameworks: 'React • Streamlit • Static HTML • Python Flask/FastAPI',

    footer: '© 2025 mite.now. Making AI projects go live, easily.',

    // CTA
    cta: {
      primary: 'Publish My AI App Now',
      secondary: 'See How It Works',
    },
  },

  login: {
    title: 'Sign in to manage your deployments',
    continueWith: 'Continue with Google',
    terms: 'By signing in, you agree to our',
    termsLink: 'Terms of Service',
    and: 'and',
    privacyLink: 'Privacy Policy',
    backToHome: '← Back to home',
  },

  dashboard: {
    title: 'Your Deployments',
    noDeployments: 'No deployments yet',
    noDeploymentsMessage: 'Upload your first app to get started',
    deployNow: 'Deploy Now',
    newDeployment: 'New Deployment',

    subscription: {
      title: 'Subscription',
      free: 'Free',
      pro: 'Pro',
      paymentDue: 'Payment Due',
      upgradeMessage: 'Upgrade to Pro for more deployments, custom domains, and database support.',
      upgradeButton: 'Upgrade to Pro - $2.99/mo',
      manageButton: 'Manage Subscription',
    },

    usage: {
      title: 'Usage',
      deployments: 'Deployments',
      expiresIn: '⏱️ Free deployments expire after {hours} hours',
      addQuota: 'Add 5 more (+$0.99/mo)',
    },

    deployment: {
      status: {
        active: 'Active',
        building: 'Building',
        failed: 'Failed',
        pending: 'Pending',
      },
      created: 'Created',
      expires: 'Expires',
      deleteConfirm: 'Are you sure you want to delete this deployment?',
    },

    checkout: {
      success: '🎉 Welcome to Pro! Your subscription is now active.',
      canceled: 'Checkout was canceled. You can upgrade anytime.',
    },
  },

  admin: {
    title: 'Admin Dashboard',
    stats: 'Statistics',
    deployments: 'Deployments',
    users: 'Users',
    revenue: 'Revenue',

    totalDeployments: 'Total Deployments',
    activeDeployments: 'Active',
    totalUsers: 'Total Users',
    proUsers: 'Pro Users',

    search: 'Search deployments...',
    filter: {
      all: 'All',
      active: 'Active',
      building: 'Building',
      failed: 'Failed',
    },

    deployment: {
      owner: 'Owner',
      framework: 'Framework',
      status: 'Status',
      created: 'Created',
      actions: 'Actions',
      view: 'View',
      delete: 'Delete',
    },
  },

  errors: {
    uploadFailed: 'Upload failed',
    deploymentFailed: 'Deployment failed',
    quotaExceeded: 'Deployment quota exceeded',
    unauthorized: 'Unauthorized',
    notFound: 'Not found',
    serverError: 'Server error',
  },
};

export type Translation = typeof en;
