'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Shield,
  BarChart3
} from 'lucide-react';
import clsx from 'clsx';

interface AppRecord {
  app_id: string;
  subdomain: string;
  status: 'pending' | 'uploading' | 'building' | 'deploying' | 'active' | 'failed' | 'expired';
  target_url?: string;
  framework?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  active: number;
  building: number;
  pending: number;
  failed: number;
}

interface DeploymentsResponse {
  deployments: AppRecord[];
  stats: Stats;
  list_complete: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.mite.now';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deployments, setDeployments] = useState<AppRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDeployments = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/deployments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setIsAuthenticated(false);
          throw new Error('管理者權杖無效');
        }
        throw new Error('無法取得部署列表');
      }

      const data: DeploymentsResponse = await response.json();
      setDeployments(data.deployments);
      setStats(data.stats);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchDeployments();
  };

  const handleDelete = async (appId: string) => {
    if (!confirm('確定要刪除這個部署嗎？')) return;

    setDeletingId(appId);
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/deployments/${appId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('刪除部署失敗');
      }

      // Refresh list
      await fetchDeployments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  // Auto-refresh every 30 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchDeployments, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchDeployments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'building':
      case 'deploying':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      building: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      deploying: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      uploading: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };

    return (
      <span className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        colors[status] || 'bg-gray-100 text-gray-800'
      )}>
        {getStatusIcon(status)}
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">管理者後台</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">請輸入管理者權杖以繼續</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="管理者權杖"
              className={clsx(
                'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
                'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={!token || isLoading}
              className={clsx(
                'w-full px-4 py-3 rounded-lg font-medium text-white',
                'bg-gradient-to-r from-blue-600 to-purple-600',
                'hover:from-blue-700 hover:to-purple-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  驗證中...
                </>
              ) : (
                '登入'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">mite.now</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2">Admin</span>
          </div>

          <button
            onClick={fetchDeployments}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            重新整理
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">總計</span>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">運行中</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <Loader2 className="w-4 h-4" />
                <span className="text-sm">建置中</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.building}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-yellow-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">等待中</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">失敗</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Deployments Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">部署列表</h2>
          </div>

          {deployments.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
              尚無部署紀錄
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      子網域
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      框架
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      建立時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {deployments.map((deployment) => (
                    <tr key={deployment.app_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4">
                        <div>
                          <a
                            href={`https://${deployment.subdomain}.mite.now`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {deployment.subdomain}.mite.now
                          </a>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
                            {deployment.app_id}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(deployment.status)}
                        {deployment.error && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={deployment.error}>
                            {deployment.error}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {deployment.framework || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatDate(deployment.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {deployment.status === 'active' && deployment.target_url && (
                            <a
                              href={`https://${deployment.subdomain}.mite.now`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-zinc-400 hover:text-blue-500"
                              title="開啟網站"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(deployment.app_id)}
                            disabled={deletingId === deployment.app_id}
                            className="p-2 text-zinc-400 hover:text-red-500 disabled:opacity-50"
                            title="刪除部署"
                          >
                            {deletingId === deployment.app_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
