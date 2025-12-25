'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Copy, Check, Share2, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Character avatars (emoji-based for now)
const CHARACTER_AVATARS: Record<string, string> = {
    passionate_disciple: '🔥',
    fangirl_junior: '💕',
    tsundere_maid: '😤',
    shocked_passerby: '😱',
    newbie_engineer: '🙇',
    summoned_demon: '👹',
    cat_servant: '🐱',
    mad_scientist_assistant: '🧪',
    court_musician: '🎻',
    pilgrim_believer: '🙏',
    diehard_fan: '✨',
    bard_storyteller: '📜',
};

interface ShareData {
    subdomain: string;
    live_url: string;
    praise_text: string | null;
    character_id: string | null;
    framework: string | null;
    created_at: number;
}

export function SharePageClient() {
    const searchParams = useSearchParams();
    const appId = searchParams.get('id');

    const [shareData, setShareData] = useState<ShareData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [generatingPraise, setGeneratingPraise] = useState(false);

    useEffect(() => {
        if (appId) {
            fetchShareData();
        } else {
            setError('缺少應用程式 ID');
            setLoading(false);
        }
    }, [appId]);

    const fetchShareData = async () => {
        try {
            const response = await fetch(`/api/v1/share/${appId}`);
            if (!response.ok) {
                throw new Error('Deployment not found');
            }
            const data = await response.json();
            setShareData(data);

            // If no praise yet, try to generate it
            if (!data.praise_text) {
                await generatePraise();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '讀取失敗');
        } finally {
            setLoading(false);
        }
    };

    const generatePraise = async () => {
        if (!appId) return;

        setGeneratingPraise(true);
        try {
            const locale = document.documentElement.lang === 'ja' ? 'jp' :
                document.documentElement.lang === 'zh-TW' ? 'tw' : 'tw'; // Default to TW

            console.log('Calling praise API for:', appId, 'locale:', locale);

            const response = await fetch(`/api/v1/praise/${appId}?locale=${locale}`);

            console.log('Praise API response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Praise generated:', data);
                setShareData(prev => prev ? {
                    ...prev,
                    praise_text: data.praise_text,
                    character_id: data.character_id,
                } : null);
            } else {
                const errorText = await response.text();
                console.error('Praise API error:', errorText);
            }
        } catch (err) {
            console.error('Failed to generate praise:', err);
        } finally {
            setGeneratingPraise(false);
        }
    };

    const copyLink = async () => {
        if (!shareData) return;
        await navigator.clipboard.writeText(shareData.live_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareToFacebook = () => {
        if (!shareData) return;
        const text = shareData.praise_text || `Check out my AI app: ${shareData.live_url}`;
        window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.live_url)}&quote=${encodeURIComponent(text)}`,
            '_blank'
        );
    };

    const shareToThreads = () => {
        if (!shareData) return;
        const text = shareData.praise_text
            ? `${shareData.praise_text}\n\n🔗 ${shareData.live_url}`
            : `Check out my AI app: ${shareData.live_url}`;
        window.open(
            `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`,
            '_blank'
        );
    };

    const shareToLine = () => {
        if (!shareData) return;
        const text = shareData.praise_text
            ? `${shareData.praise_text}\n\n${shareData.live_url}`
            : `Check out my AI app: ${shareData.live_url}`;
        window.open(
            `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareData.live_url)}&text=${encodeURIComponent(text)}`,
            '_blank'
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error || !shareData) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">{error || 'Not found'}</p>
                    <Link href="/" className="text-orange-500 hover:underline">
                        ← Back to home
                    </Link>
                </div>
            </div>
        );
    }

    const avatar = shareData.character_id ? CHARACTER_AVATARS[shareData.character_id] : '🎉';

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
            {/* Header */}
            <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm">⚡</span>
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white">mite.now</span>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-6 py-12">
                {/* Success Message */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                        Your App is Live!
                    </h1>
                </div>

                {/* Live URL Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Live URL</p>
                            <a
                                href={shareData.live_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-medium text-orange-600 dark:text-orange-400 hover:underline truncate block"
                            >
                                {shareData.live_url}
                            </a>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={copyLink}
                                className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Copy link"
                            >
                                {copied ? (
                                    <Check className="w-5 h-5 text-green-500" />
                                ) : (
                                    <Copy className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                )}
                            </button>
                            <a
                                href={shareData.live_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors"
                                title="Open app"
                            >
                                <ExternalLink className="w-5 h-5 text-white" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Praise Section */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 p-6 mb-8">
                    {generatingPraise || !shareData.praise_text ? (
                        <div className="flex items-center justify-center gap-3 py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                            <span className="text-purple-600 dark:text-purple-400">正在生成誇讚...</span>
                        </div>
                    ) : (
                        <>
                            <div className="text-5xl text-center mb-4">{avatar}</div>
                            <p className="text-lg text-zinc-700 dark:text-zinc-300 text-center leading-relaxed">
                                {shareData.praise_text}
                            </p>
                        </>
                    )}
                </div>

                {/* Share Buttons */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Share2 className="w-5 h-5 text-zinc-500" />
                        <h3 className="font-medium text-zinc-900 dark:text-white">Share your creation</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            onClick={shareToFacebook}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                        >
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">f</span>
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">Facebook</span>
                        </button>
                        <button
                            onClick={shareToThreads}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                                <span className="text-white dark:text-black font-bold text-lg">@</span>
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">Threads</span>
                        </button>
                        <button
                            onClick={shareToLine}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                        >
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">L</span>
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">LINE</span>
                        </button>
                    </div>
                </div>

                {/* Back to Dashboard */}
                <div className="text-center mt-8">
                    <Link
                        href="/dashboard"
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </main>
        </div>
    );
}
