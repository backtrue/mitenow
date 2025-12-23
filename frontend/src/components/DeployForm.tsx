'use client';

import { useState, useEffect, useCallback } from 'react';
import { Rocket, Key, Globe, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { api, SubdomainCheckResponse } from '@/lib/api';

interface DeployFormProps {
  appId: string | null;
  onDeploy: (subdomain: string, apiKey: string, framework: string) => Promise<void>;
  disabled?: boolean;
}

export function DeployForm({ appId, onDeploy, disabled = false }: DeployFormProps) {
  const [subdomain, setSubdomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [framework, setFramework] = useState('auto');
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Subdomain availability check
  const [subdomainCheck, setSubdomainCheck] = useState<SubdomainCheckResponse | null>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Debounced subdomain check
  const checkSubdomain = useCallback(async (value: string) => {
    if (value.length < 3) {
      setSubdomainCheck(null);
      return;
    }

    setIsCheckingSubdomain(true);
    try {
      const result = await api.checkSubdomain(value);
      setSubdomainCheck(result);
    } catch {
      setSubdomainCheck(null);
    } finally {
      setIsCheckingSubdomain(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (subdomain.length >= 3) {
        checkSubdomain(subdomain);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [subdomain, checkSubdomain]);

  const handleReleaseSubdomain = async () => {
    if (!subdomainCheck?.canRelease) return;
    
    setIsReleasing(true);
    try {
      await api.releaseSubdomain(subdomain);
      // Re-check availability after release
      await checkSubdomain(subdomain);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release subdomain');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !subdomain || !apiKey || !subdomainCheck?.available) return;

    setIsDeploying(true);
    setError(null);

    try {
      await onDeploy(subdomain, apiKey, framework);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const isFormValid = appId && subdomain.length >= 3 && apiKey.length > 0 && subdomainCheck?.available;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="subdomain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          <Globe className="w-4 h-4 inline-block mr-1" />
          Subdomain
        </label>
        <div className="flex items-center">
          <div className="relative flex-1">
            <input
              type="text"
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-app"
              disabled={disabled || isDeploying}
              className={clsx(
                'w-full px-4 py-3 pr-10 rounded-l-lg border border-r-0',
                'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                subdomainCheck?.available === true && 'border-green-500 dark:border-green-500',
                subdomainCheck?.available === false && 'border-red-500 dark:border-red-500',
                !subdomainCheck && 'border-zinc-300 dark:border-zinc-700'
              )}
            />
            {subdomain.length >= 3 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingSubdomain ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                ) : subdomainCheck?.available ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : subdomainCheck?.canRelease ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                ) : subdomainCheck ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : null}
              </div>
            )}
          </div>
          <span className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-l-0 border-zinc-300 dark:border-zinc-700 rounded-r-lg text-zinc-500 dark:text-zinc-400">
            .mite.now
          </span>
        </div>
        {subdomainCheck && (
          <div className={clsx(
            'mt-2 flex items-center justify-between text-sm',
            subdomainCheck.available ? 'text-green-600 dark:text-green-400' : 
            subdomainCheck.canRelease ? 'text-yellow-600 dark:text-yellow-400' : 
            'text-red-600 dark:text-red-400'
          )}>
            <span>{subdomainCheck.message}</span>
            {subdomainCheck.canRelease && (
              <button
                type="button"
                onClick={handleReleaseSubdomain}
                disabled={isReleasing}
                className="ml-2 px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 disabled:opacity-50"
              >
                {isReleasing ? 'Releasing...' : 'Release & Use'}
              </button>
            )}
          </div>
        )}
        {!subdomainCheck && subdomain.length > 0 && subdomain.length < 3 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Subdomain must be at least 3 characters
          </p>
        )}
        {(!subdomainCheck || subdomainCheck.available) && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Your app will be available at https://{subdomain || 'my-app'}.mite.now
          </p>
        )}
      </div>

      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          <Key className="w-4 h-4 inline-block mr-1" />
          OpenAI API Key
        </label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          disabled={disabled || isDeploying}
          className={clsx(
            'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
            'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Your API key is passed securely to your app and never stored
        </p>
      </div>

      <div>
        <label htmlFor="framework" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Framework
        </label>
        <select
          id="framework"
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          disabled={disabled || isDeploying}
          className={clsx(
            'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
            'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <option value="auto">Auto-detect</option>
          <option value="streamlit">Streamlit</option>
          <option value="gradio">Gradio</option>
          <option value="flask">Flask</option>
          <option value="fastapi">FastAPI</option>
          <option value="react">React/Vite</option>
          <option value="nextjs">Next.js</option>
          <option value="express">Express.js</option>
          <option value="static">Static HTML</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || disabled || isDeploying}
        className={clsx(
          'w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-medium text-white',
          'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-purple-600',
          'transition-all duration-200'
        )}
      >
        {isDeploying ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            Deploy to mite.now
          </>
        )}
      </button>
    </form>
  );
}
