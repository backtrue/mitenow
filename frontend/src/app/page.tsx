'use client';

import { useState, useCallback } from 'react';
import { Zap, Github, Shield, Clock } from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { DeployForm } from '@/components/DeployForm';
import { DeployStatus } from '@/components/DeployStatus';
import { api } from '@/lib/api';

type Step = 'upload' | 'configure' | 'deploying';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null);
    setIsUploading(true);

    try {
      // Get upload URL
      const { app_id, upload_url } = await api.prepare(selectedFile.name);
      setAppId(app_id);

      // Upload file
      await api.upload(upload_url, selectedFile);
      
      setStep('configure');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  }, []);

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
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <Github className="w-6 h-6" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
            Deploy AI Apps in{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Seconds
            </span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Upload your AI-generated app and get a live URL instantly.
            Works with code from Google AI Studio, ChatGPT, and more.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Zap className="w-6 h-6 text-blue-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Instant Deploy</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Shield className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Secure Keys</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Clock className="w-6 h-6 text-purple-500 mb-2" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Auto Scale</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
                  Upload Your App
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Drag and drop your ZIP file — we&apos;ll auto-detect the framework
                </p>
              </div>
              
              <DropZone 
                onFileSelect={handleFileSelect} 
                disabled={isUploading}
              />
              
              {isUploading && (
                <div className="text-center text-sm text-zinc-500">
                  Uploading {file?.name}...
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
                  Configure Deployment
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Choose your subdomain and add your API key
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
                  Deploying Your App
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Sit back while we build and deploy your application
                </p>
              </div>
              
              <DeployStatus appId={appId} subdomain={subdomain} />
            </div>
          )}
        </div>

        {/* Supported Apps */}
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Works with apps generated by
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
            Python (Streamlit, Gradio, Flask, FastAPI) • React • Next.js • Static HTML
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>© 2025 mite.now. Deploy AI apps without the hassle.</p>
        </div>
      </footer>
    </div>
  );
}
