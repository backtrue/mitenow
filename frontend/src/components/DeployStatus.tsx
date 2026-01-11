'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Clock, Upload, Hammer, Rocket, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { api, StatusResponse } from '@/lib/api';

interface DeployStatusProps {
  appId: string;
  subdomain: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    label: '等待中',
    description: '準備開始...',
  },
  uploading: {
    icon: Upload,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: '上傳中',
    description: '正在上傳檔案...',
  },
  building: {
    icon: Hammer,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: '建置中',
    description: '正在建置應用程式...',
  },
  deploying: {
    icon: Rocket,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: '部署中',
    description: '正在部署到雲端...',
  },
  active: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: '運行中',
    description: '你的應用程式已上線！',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: '失敗',
    description: '部署失敗',
  },
};

export function DeployStatus({ appId, subdomain }: DeployStatusProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const data = await api.getStatus(appId);
        if (mounted) {
          setStatus(data);
          setError(null);

          // Stop polling if deployment is complete or failed
          if (data.status === 'active' || data.status === 'failed') {
            clearInterval(intervalId);

            // Redirect to share page on success (after generating praise)
            if (data.status === 'active') {
              try {
                // Generate praise first, then redirect
                console.log('Generating praise before redirect...');
                await fetch(`/api/v1/praise/${appId}?locale=tw`);
                console.log('Praise generated, redirecting...');
              } catch (err) {
                console.error('Failed to generate praise:', err);
                // Still redirect even if praise fails
              }
              window.location.href = `/share?id=${appId}`;
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : '無法取得狀態');
        }
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [appId]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const config = STATUS_CONFIG[status.status];
  const Icon = config.icon;
  const appUrl = `https://${subdomain}.mite.now`;

  return (
    <div className="space-y-6">
      <div className={clsx('p-6 rounded-xl', config.bgColor)}>
        <div className="flex items-center gap-4">
          <div className={clsx('p-3 rounded-full bg-white dark:bg-zinc-900', config.color)}>
            {status.status === 'building' || status.status === 'deploying' || status.status === 'uploading' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Icon className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className={clsx('text-lg font-semibold', config.color)}>
              {config.label}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {status.error || config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-4">
        {['uploading', 'building', 'deploying', 'active'].map((step, index) => {
          const stepIndex = ['uploading', 'building', 'deploying', 'active'].indexOf(status.status);
          const currentIndex = ['uploading', 'building', 'deploying', 'active'].indexOf(step);
          const isComplete = currentIndex < stepIndex || status.status === 'active';
          const isCurrent = step === status.status;
          const isFailed = status.status === 'failed';

          return (
            <div key={step} className="flex items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  {
                    'bg-green-500 text-white': isComplete && !isFailed,
                    'bg-blue-500 text-white': isCurrent && !isFailed,
                    'bg-zinc-200 dark:bg-zinc-700 text-zinc-500': !isComplete && !isCurrent,
                    'bg-red-500 text-white': isFailed && isCurrent,
                  }
                )}
              >
                {isComplete && !isFailed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              {index < 3 && (
                <div
                  className={clsx('w-12 h-1 mx-2', {
                    'bg-green-500': isComplete && !isFailed,
                    'bg-zinc-200 dark:bg-zinc-700': !isComplete,
                  })}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* App URL */}
      {status.status === 'active' && (
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center justify-center gap-2 w-full px-6 py-4 rounded-lg font-medium',
            'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700',
            'text-white transition-all duration-200'
          )}
        >
          <ExternalLink className="w-5 h-5" />
          開啟 {appUrl}
        </a>
      )}

      {/* Metadata */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
        <p>應用程式 ID: {appId}</p>
        <p>建立時間: {new Date(status.created_at).toLocaleString()}</p>
        <p>更新時間: {new Date(status.updated_at).toLocaleString()}</p>
      </div>
    </div>
  );
}
