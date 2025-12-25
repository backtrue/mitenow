'use client';

import { useState, useCallback, useEffect } from 'react';
import { Zap, Shield, Clock, LogIn, User, Check, X, ChevronDown, ExternalLink, Sparkles, Upload, Key, Rocket } from 'lucide-react';
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const scrollToUpload = () => {
    document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
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
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400"
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-500/20"
              >
                <LogIn className="w-4 h-4" />
                {t.common.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          專為 Google AI Studio 使用者打造
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
          {t.home.title}
        </h1>
        <p className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent mb-6">
          {t.home.titleHighlight}
        </p>
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          {t.home.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={scrollToUpload}
            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-xl text-lg font-semibold transition-all shadow-xl shadow-orange-500/30 hover:shadow-orange-500/40 hover:scale-105"
          >
            {t.home.cta.primary}
          </button>
          <a
            href="#how-it-works"
            className="px-8 py-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-xl text-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
          >
            {t.home.cta.secondary}
          </a>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-zinc-900 dark:bg-zinc-800 rounded-3xl p-8 md:p-12 text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            {t.home.painPoints.title}
          </h2>
          <div className="space-y-4 mb-8">
            {t.home.painPoints.items.map((item, index) => (
              <div key={index} className="flex items-start gap-3 text-zinc-300">
                <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-lg">{item}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
            <span className="text-lg font-medium text-green-300">
              {t.home.painPoints.solution}
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white mb-12">
          {t.home.steps.title}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">Step 1</div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {t.home.steps.step1.title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t.home.steps.step1.description}
            </p>
          </div>

          {/* Step 2 */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-2">Step 2</div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {t.home.steps.step2.title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t.home.steps.step2.description}
            </p>
          </div>

          {/* Step 3 */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <div className="text-sm font-bold text-green-600 dark:text-green-400 mb-2">Step 3</div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {t.home.steps.step3.title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t.home.steps.step3.description}
            </p>
          </div>
        </div>

        {/* YouTube Tutorial */}
        <div className="mt-12">
          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-700">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/h3HYA9wr4yI"
              title="mite.now Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section id="upload-section" className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-8 md:p-12">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-2">
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
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20"
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
                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-medium transition-colors"
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
      </section>

      {/* API Key Explanation */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-3xl p-8 md:p-12 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
                {t.home.apiKeyExplain.title}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                {t.home.apiKeyExplain.description}
              </p>
              <a
                href={t.home.apiKeyExplain.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                {t.home.apiKeyExplain.cta}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-white mb-8">
          {t.home.comparison.title}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* DIY */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-4">
              {t.home.comparison.theirs.title}
            </h3>
            <div className="space-y-3">
              {t.home.comparison.theirs.items.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* mite.now */}
          <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl p-6 text-white">
            <h3 className="text-xl font-bold mb-4">
              {t.home.comparison.ours.title}
            </h3>
            <div className="space-y-3">
              {t.home.comparison.ours.items.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-white flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-white mb-8">
          {t.home.faq.title}
        </h2>
        <div className="space-y-4">
          {t.home.faq.items.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium text-zinc-900 dark:text-white">{item.q}</span>
                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === index && (
                <div className="px-6 pb-4">
                  <p className="text-zinc-600 dark:text-zinc-400">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Zap className="w-8 h-8 text-orange-500 mb-3" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">{t.home.features.instant}</span>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Shield className="w-8 h-8 text-green-500 mb-3" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">{t.home.features.secure}</span>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Clock className="w-8 h-8 text-blue-500 mb-3" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">{t.home.features.autoScale}</span>
          </div>
        </div>
      </section>

      {/* Supported Apps */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {t.home.supportedBy}
        </p>
        <div className="flex items-center justify-center gap-6 flex-wrap mb-4">
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
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {t.home.frameworks}
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>{t.home.footer}</p>
        </div>
      </footer>
    </div>
  );
}
