'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'super_admin' | 'user';
  subscription_tier: 'free' | 'pro';
  subscription_status: 'active' | 'canceled' | 'past_due';
  custom_domain: string | null;
  custom_domain_verified: boolean;
}

interface Quota {
  max_deployments: number;
  current_deployments: number;
  remaining: number;
  expires_in_hours: number | null;
}

interface Deployment {
  id: string;
  subdomain: string;
  framework: string;
  status: string;
  cloud_run_url: string | null;
  expires_at: number | null;
  created_at: number;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkoutStatus = searchParams.get('checkout');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('無法讀取用戶資料');
      }

      const data = await response.json();
      setUser(data.user);
      setQuota(data.quota);

      // Fetch user's deployments
      await fetchDeployments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await fetch('/api/v1/deployments', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
      }
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
    }
  };

  const handleUpgrade = async () => {
    try {
      const response = await fetch('/api/v1/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ extra_quota_packs: 0 }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : '升級失敗');
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/v1/subscription/portal', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to open customer portal');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open portal');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/');
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!confirm('確定要刪除這個部署嗎？')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/deployments/${deploymentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete deployment');
      }

      // Refresh data
      await fetchUserData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              mite.now
            </Link>

            <div className="flex items-center gap-4">
              {user.role === 'super_admin' && (
                <Link
                  href="/admin"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-violet-600"
                >
                  管理後台
                </Link>
              )}
              <div className="flex items-center gap-2">
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {user.name || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Checkout Status */}
        {checkoutStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-700 dark:text-green-400">
              🎉 歡迎加入 Pro！你的訂閱已生效。
            </p>
          </div>
        )}

        {checkoutStatus === 'canceled' && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-400">
              結帳已取消。你隨時可以升級。
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Subscription Card */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                訂閱方案
              </h2>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${user.subscription_tier === 'pro'
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                    }`}
                >
                  {user.subscription_tier === 'pro' ? 'Pro' : 'Free'}
                </span>
                {user.subscription_status === 'past_due' && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    款項逾期
                  </span>
                )}
              </div>

              {user.subscription_tier === 'free' ? (
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    升級到 Pro 以獲得更多部署配額、自訂網域和資料庫支援。
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="w-full py-2 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                  >
                    升級到 Pro - $2.99/月
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  className="w-full py-2 px-4 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  管理訂閱
                </button>
              )}
            </div>

            {/* Quota Card */}
            {quota && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  使用量
                </h2>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-600 dark:text-zinc-400">部署數量</span>
                    <span className="text-zinc-900 dark:text-white">
                      {quota.current_deployments} / {quota.max_deployments}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-violet-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (quota.current_deployments / quota.max_deployments) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {quota.expires_in_hours && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    ⏱️ 免費部署將在 {quota.expires_in_hours} 小時後過期
                  </p>
                )}

                {user.subscription_tier === 'pro' && (
                  <button
                    onClick={() => {/* TODO: Add quota pack */ }}
                    className="mt-4 w-full py-2 px-4 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    增加 5 個配額 (+$0.99/月)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Deploy Button */}
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新部署
              </Link>
            </div>

            {/* Deployments List */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  你的部署
                </h2>
              </div>

              {deployments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">🚀</div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                    還沒有部署
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                    上傳你的第一個應用程式開始吧
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                  >
                    立即部署
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {deployments.map((deployment) => (
                    <div key={deployment.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://${deployment.subdomain}.mite.now`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-zinc-900 dark:text-white hover:text-violet-600"
                            >
                              {deployment.subdomain}.mite.now
                            </a>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${deployment.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : deployment.status === 'building'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : deployment.status === 'failed'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                              {deployment.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            <span>{deployment.framework}</span>
                            <span>
                              建立於 {new Date(deployment.created_at).toLocaleDateString('zh-TW')}
                            </span>
                            {deployment.expires_at && (
                              <span className="text-orange-500">
                                過期於 {new Date(deployment.expires_at).toLocaleDateString('zh-TW')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDeployment(deployment.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                          title="刪除部署"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
