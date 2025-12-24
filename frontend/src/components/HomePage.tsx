'use client';

import { useState, useCallback, useEffect } from 'react';
import { Zap, Shield, Clock, LogIn, User } from 'lucide-react';
import Link from 'next/link';
import { DropZone } from '@/components/DropZone';
import { DeployForm } from '@/components/DeployForm';
import { DeployStatus } from '@/components/DeployStatus';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { api } from '@/lib/api';
import { useTranslation, interpolate } from '@/hooks/useTranslation';

type Step = 'upload' | 'configure' | 'deploying';

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  subscription_tier: 'free' | 'pro';
}

interface QuotaInfo {
  max_deployments: number;
  current_deployments: number;
  remaining: number;
  expires_in_hours: number | null;
}

export function HomePage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setQuota(data.quota);
      }
    } catch (err) {
      // Not logged in
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
    setQuota(null);
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null);
    setIsUploading(true);

    try {
      const { app_id, upload_url } = await api.prepare(selectedFile.name);
      setAppId(app_id);
      await api.upload(upload_url, selectedFile);
      setStep('configure');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.errors.uploadFailed);
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  }, [t]);

  const handleDeploy = useCallback(async (subdomainValue: string, apiKey: string, framework: string) => {
    if (!appId) return;
    setSubdomain(subdomainValue);
    await api.deploy({
      app_id: appId,
      subdomain: subdomainValue,
      api_key: apiKey,
      framework: framework as 'streamlit' | 'gradio' | 'flask' | 'auto',
    });
    setStep('deploying');
  }, [appId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">mite.now</span>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            {authLoading ? (
              <div className="w-6 h-6 animate-pulse bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400"
                >
                  {t.common.dashboard}
                </Link>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name || ''} className="w-7 h-7 rounded-full" />
                  ) : (
                    <User className="w-5 h-5 text-zinc-500" />
                  )}
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 hidden sm:inline">
                    {user.name || user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {t.common.signOut}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {t.common.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
            {t.home.title}{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t.home.titleHighlight}
            </span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            {t.home.subtitle}
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Zap className="w-6 h-6 text-blue-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.home.features.instant}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Shield className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.home.features.secure}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Clock className="w-6 h-6 text-purple-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.home.features.autoScale}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
                  {t.home.uploadTitle}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {t.home.uploadSubtitle}
                </p>
              </div>
              
              {!authLoading && !user ? (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <LogIn className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                    {t.home.signInRequired}
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                    {t.home.signInMessage}
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <LogIn className="w-5 h-5" />
                    {t.home.signInButton}
                  </Link>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
                    {t.home.freeTier}
                  </p>
                </div>
              ) : (
                <>
                  {quota && quota.remaining <= 0 ? (
                    <div className="text-center py-8">
                      <div className="mb-4 text-4xl">📦</div>
                      <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                        {t.home.quotaExceeded}
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                        {interpolate(t.home.quotaExceededMessage, { max: quota.max_deployments })}
                        {user?.subscription_tier === 'free' ? t.home.quotaExceededFree : t.home.quotaExceededPro}
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Link
                          href="/dashboard"
                          className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {t.home.manageDeployments}
                        </Link>
                        {user?.subscription_tier === 'free' && (
                          <Link
                            href="/dashboard"
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                          >
                            {t.home.upgradeToPro}
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {quota && (
                        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                          <span>{interpolate(t.home.quotaDisplay, { current: quota.current_deployments, max: quota.max_deployments })}</span>
                          {quota.expires_in_hours && (
                            <span className="text-orange-500">• {interpolate(t.home.ttlDisplay, { hours: quota.expires_in_hours })}</span>
                          )}
                        </div>
                      )}
                      
                      <DropZone 
                        onFileSelect={handleFileSelect} 
                        disabled={isUploading}
                      />
                    </>
                  )}
                </>
              )}
              
              {isUploading && (
                <div className="text-center text-sm text-zinc-500">
                  {t.common.loading}
                </div>
              )}
              
              {uploadError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
                  {t.home.configureTitle}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {t.home.configureSubtitle}
                </p>
              </div>
              
              <DeployForm 
                appId={appId} 
                onDeploy={handleDeploy}
              />
            </div>
          )}

          {step === 'deploying' && appId && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
                  {t.home.deployingTitle}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {t.home.deployingSubtitle}
                </p>
              </div>
              
              <DeployStatus appId={appId} subdomain={subdomain} />
            </div>
          )}
        </div>

        {/* Supported Apps */}
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {t.home.supportedBy}
          </p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="text-xl">✨</span>
              <span className="font-medium">Google AI Studio</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="text-xl">🤖</span>
              <span className="font-medium">ChatGPT</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="text-xl">🧠</span>
              <span className="font-medium">Claude</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
            {t.home.frameworks}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>{t.home.footer}</p>
        </div>
      </footer>
    </div>
  );
}
