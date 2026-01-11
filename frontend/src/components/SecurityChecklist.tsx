'use client';

import { Shield, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { SecurityScanResult, SecurityCheck } from '@/lib/api';

interface SecurityChecklistProps {
    result: SecurityScanResult;
    onConfirm?: (confirmed: boolean) => void;
    confirmed?: boolean;
}

const CHECK_ICONS: Record<string, string> = {
    real_api_key: '🔑',
    sensitive_files: '📁',
    hardcoded_keys: '🔐',
    internal_urls: '🔗',
    db_connections: '🗄️',
};

const CHECK_NAMES: Record<string, string> = {
    real_api_key: '真實 API Key',
    sensitive_files: '敏感配置檔',
    hardcoded_keys: '硬編碼密鑰',
    internal_urls: '內網位址',
    db_connections: '資料庫連線',
};

function CheckItem({ check }: { check: SecurityCheck }) {
    const [expanded, setExpanded] = useState(false);
    const hasFindings = check.findings.length > 0;

    return (
        <div className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
            <div
                className={clsx(
                    'flex items-center justify-between py-2 px-3',
                    hasFindings && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                )}
                onClick={() => hasFindings && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <span>{CHECK_ICONS[check.id] || '🔒'}</span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {CHECK_NAMES[check.id] || check.name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {check.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : check.severity === 'critical' ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className={clsx(
                        'text-xs',
                        check.passed ? 'text-green-600 dark:text-green-400' :
                            check.severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                                'text-yellow-600 dark:text-yellow-400'
                    )}>
                        {check.message}
                    </span>
                    {hasFindings && (
                        expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                </div>
            </div>
            {expanded && hasFindings && (
                <div className="px-3 pb-2 pl-8">
                    <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                        {check.findings.slice(0, 5).map((finding, i) => (
                            <li key={i} className="font-mono">• {finding}</li>
                        ))}
                        {check.findings.length > 5 && (
                            <li className="text-zinc-400">...還有 {check.findings.length - 5} 項</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

export function SecurityChecklist({ result, onConfirm, confirmed }: SecurityChecklistProps) {
    const passedCount = result.checks.filter(c => c.passed).length;
    const totalCount = result.checks.length;
    const hasFailures = !result.passed;
    const hasWarnings = result.hasWarnings;

    return (
        <div className={clsx(
            'rounded-lg border overflow-hidden',
            hasFailures ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20' :
                hasWarnings ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20' :
                    'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
        )}>
            {/* Header */}
            <div className={clsx(
                'flex items-center gap-2 px-4 py-3',
                hasFailures ? 'bg-red-100 dark:bg-red-900/30' :
                    hasWarnings ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        'bg-green-100 dark:bg-green-900/30'
            )}>
                <Shield className={clsx(
                    'w-5 h-5',
                    hasFailures ? 'text-red-600 dark:text-red-400' :
                        hasWarnings ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                )} />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    資安檢測
                </span>
                <span className={clsx(
                    'ml-auto text-sm font-medium',
                    hasFailures ? 'text-red-600 dark:text-red-400' :
                        hasWarnings ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                )}>
                    {passedCount}/{totalCount} 通過
                </span>
            </div>

            {/* Check Items */}
            <div className="bg-white dark:bg-zinc-900">
                {result.checks.map(check => (
                    <CheckItem key={check.id} check={check} />
                ))}
            </div>

            {/* Disclaimer */}
            <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    ⚠️ 此為輔助檢測，非完整資安審計。mite.now 不對外洩事件負責。
                </p>
            </div>

            {/* Confirmation Checkbox (only shown when there are warnings but no critical failures) */}
            {hasWarnings && !hasFailures && onConfirm && (
                <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-950/30 border-t border-yellow-200 dark:border-yellow-800">
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => onConfirm(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                            我已確認程式碼不含敏感資訊，並了解資安檢測僅供參考。
                        </span>
                    </label>
                </div>
            )}

            {/* Critical Failure Message */}
            {hasFailures && (
                <div className="px-4 py-3 bg-red-100 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                        ❌ 發現嚴重安全問題，請修正後重新上傳。
                    </p>
                </div>
            )}
        </div>
    );
}
