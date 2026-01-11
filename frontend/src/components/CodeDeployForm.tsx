'use client';

import { useState, useCallback } from 'react';
import { Code2, Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { api, DeployCodeResponse } from '@/lib/api';

interface CodeDeployFormProps {
    onSuccess: (appId: string, subdomain: string) => void;
}

export function CodeDeployForm({ onSuccess }: CodeDeployFormProps) {
    const [code, setCode] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [framework, setFramework] = useState('auto');
    const [isDeploying, setIsDeploying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiDetection, setAiDetection] = useState<DeployCodeResponse['ai_detection'] | null>(null);

    // Calculate code stats
    const codeStats = {
        lines: code.split('\n').length,
        chars: code.length,
        sizeKB: (code.length / 1024).toFixed(1),
    };

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !subdomain || !apiKey) return;

        setIsDeploying(true);
        setError(null);
        setAiDetection(null);

        try {
            // Save API key for future use
            localStorage.setItem('mite_api_key', apiKey);

            const result = await api.deployCode({
                code,
                subdomain,
                api_key: apiKey,
                framework: framework === 'auto' ? undefined : framework,
            });

            setAiDetection(result.ai_detection);

            // Call success callback
            onSuccess(result.app_id, result.subdomain);
        } catch (err) {
            setError(err instanceof Error ? err.message : '部署失敗');
        } finally {
            setIsDeploying(false);
        }
    };

    const isFormValid = code.length >= 10 && subdomain.length >= 3 && apiKey.length > 0;

    return (
        <form onSubmit={handleDeploy} className="space-y-6">
            {/* AI Detection Info Banner */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                            只接受 AI 生成的程式碼
                        </h3>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                            請貼上從 ChatGPT Canvas、Gemini 或其他 AI 工具生成的程式碼。我們會自動偵測程式碼來源和框架。
                        </p>
                    </div>
                </div>
            </div>

            {/* Code Input */}
            <div>
                <label htmlFor="code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    <Code2 className="w-4 h-4 inline-block mr-1" />
                    程式碼
                </label>
                <textarea
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="貼上你的 AI 生成程式碼..."
                    disabled={isDeploying}
                    rows={15}
                    className={clsx(
                        'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
                        'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                        'font-mono text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'resize-y'
                    )}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                        {codeStats.lines} 行 • {codeStats.chars} 字元 • {codeStats.sizeKB} KB
                    </span>
                    <span className={clsx(
                        code.length > 500_000 && 'text-red-500 dark:text-red-400 font-medium'
                    )}>
                        上限: 500 KB
                    </span>
                </div>
            </div>

            {/* Subdomain */}
            <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    子網域
                </label>
                <div className="flex items-center">
                    <input
                        type="text"
                        id="subdomain"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="my-app"
                        disabled={isDeploying}
                        className={clsx(
                            'flex-1 px-4 py-3 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700',
                            'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                    />
                    <span className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-l-0 border-zinc-300 dark:border-zinc-700 rounded-r-lg text-zinc-500 dark:text-zinc-400">
                        .mite.now
                    </span>
                </div>
            </div>

            {/* API Key */}
            <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Gemini API 金鑰
                </label>
                <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    disabled={isDeploying}
                    className={clsx(
                        'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
                        'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                />
            </div>

            {/* Framework Selection */}
            <div>
                <label htmlFor="framework" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    框架 (選填)
                </label>
                <select
                    id="framework"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    disabled={isDeploying}
                    className={clsx(
                        'w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700',
                        'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    <option value="auto">自動偵測</option>
                    <option value="streamlit">Streamlit</option>
                    <option value="gradio">Gradio</option>
                    <option value="flask">Flask</option>
                    <option value="fastapi">FastAPI</option>
                    <option value="react">React/Vite</option>
                    <option value="static">靜態 HTML</option>
                </select>
            </div>

            {/* AI Detection Result */}
            {aiDetection && (
                <div className={clsx(
                    'p-4 rounded-lg border',
                    aiDetection.isAIGenerated
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                )}>
                    <div className="flex items-start gap-3">
                        {aiDetection.isAIGenerated ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <p className={clsx(
                                'text-sm font-medium mb-1',
                                aiDetection.isAIGenerated
                                    ? 'text-green-900 dark:text-green-100'
                                    : 'text-yellow-900 dark:text-yellow-100'
                            )}>
                                {aiDetection.isAIGenerated
                                    ? `✓ AI 生成程式碼 (信心度: ${aiDetection.confidence}%)`
                                    : `⚠ 偵測信心度不足 (${aiDetection.confidence}%)`
                                }
                            </p>
                            <p className={clsx(
                                'text-xs',
                                aiDetection.isAIGenerated
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-yellow-700 dark:text-yellow-300'
                            )}>
                                來源: {aiDetection.source === 'chatgpt' ? 'ChatGPT' : aiDetection.source === 'gemini' ? 'Gemini' : '未知'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!isFormValid || isDeploying}
                className={clsx(
                    'w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-medium text-white',
                    'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-blue-600',
                    'transition-all duration-200'
                )}
            >
                {isDeploying ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        部署中...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        部署 AI 程式碼
                    </>
                )}
            </button>
        </form>
    );
}
