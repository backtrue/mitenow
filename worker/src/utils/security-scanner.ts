/**
 * Security Scanner for mite.now
 * 五大資安檢測：幫助使用者在部署前發現潛在的安全風險
 */

export interface SecurityCheck {
    id: string;
    name: string;
    passed: boolean;
    severity: 'critical' | 'warning';
    message: string;
    findings: string[];
}

export interface SecurityScanResult {
    passed: boolean;           // 所有 critical 都通過
    hasWarnings: boolean;      // 有警告但可部署
    checks: SecurityCheck[];
}

// ====== 檢測模式定義 ======

// 1. 真實 API Key 模式（在 .env 中）
const REAL_API_KEY_PATTERNS = [
    /^AIza[0-9A-Za-z\-_]{35}$/,          // Google/Gemini
    /^sk-[a-zA-Z0-9]{48,}$/,              // OpenAI
    /^sk-proj-[a-zA-Z0-9]{48,}$/,         // OpenAI Project
    /^ghp_[a-zA-Z0-9]{36}$/,              // GitHub Personal Access Token
    /^gho_[a-zA-Z0-9]{36}$/,              // GitHub OAuth
    /^AKIA[0-9A-Z]{16}$/,                 // AWS Access Key
    /^xox[baprs]-[a-zA-Z0-9-]+$/,         // Slack Token
];

// 2. 敏感配置檔名
const SENSITIVE_FILES = [
    '.env.production',
    '.env.prod',
    '.env.staging',
    'serviceAccountKey.json',
    'service-account.json',
    'credentials.json',
    'firebase-adminsdk',
    '.npmrc',
    '.pypirc',
    'id_rsa',
    'id_ed25519',
];

const SENSITIVE_EXTENSIONS = [
    '.pem',
    '.key',
    '.p12',
    '.pfx',
];

// 3. 硬編碼密鑰模式（在程式碼中）
const HARDCODED_KEY_PATTERNS = [
    /['"]AIza[0-9A-Za-z\-_]{35}['"]/g,                    // Google API Key
    /['"]sk-[a-zA-Z0-9]{48,}['"]/g,                       // OpenAI
    /['"]sk-proj-[a-zA-Z0-9]{48,}['"]/g,                  // OpenAI Project
    /['"]ghp_[a-zA-Z0-9]{36}['"]/g,                       // GitHub PAT
    /['"]AKIA[0-9A-Z]{16}['"]/g,                          // AWS
    /apiKey\s*[:=]\s*['"][A-Za-z0-9\-_]{20,}['"]/gi,      // Generic apiKey assignment
    /api_key\s*[:=]\s*['"][A-Za-z0-9\-_]{20,}['"]/gi,
];

// 4. 內網位址模式
const INTERNAL_URL_PATTERNS = [
    /https?:\/\/localhost[:/]/gi,
    /https?:\/\/127\.0\.0\.1[:/]/gi,
    /https?:\/\/0\.0\.0\.0[:/]/gi,
    /https?:\/\/192\.168\.\d+\.\d+/gi,
    /https?:\/\/10\.\d+\.\d+\.\d+/gi,
    /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/gi,
];

// 5. 資料庫連線字串模式
const DB_CONNECTION_PATTERNS = [
    /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi,     // MongoDB with credentials
    /postgresql:\/\/[^:]+:[^@]+@/gi,          // PostgreSQL
    /mysql:\/\/[^:]+:[^@]+@/gi,               // MySQL
    /redis:\/\/[^:]+:[^@]+@/gi,               // Redis
];

// ====== ZIP 解析輔助函數 ======

interface ZipEntry {
    filename: string;
    content: string;
}

function parseZipEntries(buffer: ArrayBuffer): ZipEntry[] {
    const entries: ZipEntry[] = [];
    const view = new DataView(buffer);
    let offset = 0;

    try {
        while (offset < buffer.byteLength - 4) {
            const signature = view.getUint32(offset, true);

            // Local file header: 0x04034b50
            if (signature === 0x04034b50) {
                const compressedSize = view.getUint32(offset + 18, true);
                const filenameLength = view.getUint16(offset + 26, true);
                const extraFieldLength = view.getUint16(offset + 28, true);

                // Get filename
                const filenameBytes = new Uint8Array(buffer.slice(offset + 30, offset + 30 + filenameLength));
                const filename = new TextDecoder().decode(filenameBytes);

                // Get content (only for text files, skip binary)
                let content = '';
                const contentOffset = offset + 30 + filenameLength + extraFieldLength;
                if (compressedSize > 0 && compressedSize < 1024 * 1024) { // Max 1MB per file
                    try {
                        const contentBytes = new Uint8Array(buffer.slice(contentOffset, contentOffset + compressedSize));
                        content = new TextDecoder('utf-8').decode(contentBytes);
                    } catch {
                        // Binary file or decode error, skip content
                    }
                }

                entries.push({ filename, content });
                offset = contentOffset + compressedSize;
            } else {
                offset++;
            }
        }
    } catch {
        // Parse error, return what we have
    }

    return entries;
}

// ====== 五大檢測實作 ======

function checkRealApiKey(entries: ZipEntry[]): SecurityCheck {
    const findings: string[] = [];

    for (const entry of entries) {
        // 只檢查 .env 相關檔案
        if (entry.filename.includes('.env') && !entry.filename.includes('.example')) {
            const lines = entry.content.split('\n');
            for (const line of lines) {
                const [key, value] = line.split('=');
                if (value && !value.includes('PLACEHOLDER') && !value.includes('your_')) {
                    for (const pattern of REAL_API_KEY_PATTERNS) {
                        if (pattern.test(value.trim())) {
                            findings.push(`${entry.filename}: ${key} 包含真實 API Key`);
                            break;
                        }
                    }
                }
            }
        }
    }

    return {
        id: 'real_api_key',
        name: '真實 API Key',
        passed: findings.length === 0,
        severity: 'critical',
        message: findings.length === 0
            ? '未偵測到真實 API Key'
            : '發現 .env 中包含真實 API Key',
        findings
    };
}

function checkSensitiveFiles(entries: ZipEntry[]): SecurityCheck {
    const findings: string[] = [];

    for (const entry of entries) {
        const filename = entry.filename.toLowerCase();
        const basename = filename.split('/').pop() || '';

        // Check sensitive filenames
        for (const sensitive of SENSITIVE_FILES) {
            if (basename.includes(sensitive.toLowerCase())) {
                findings.push(entry.filename);
                break;
            }
        }

        // Check sensitive extensions
        for (const ext of SENSITIVE_EXTENSIONS) {
            if (filename.endsWith(ext)) {
                findings.push(entry.filename);
                break;
            }
        }

        // Check for .git directory
        if (filename.startsWith('.git/') || filename === '.git') {
            findings.push(entry.filename);
        }
    }

    return {
        id: 'sensitive_files',
        name: '敏感配置檔',
        passed: findings.length === 0,
        severity: 'critical',
        message: findings.length === 0
            ? '未發現敏感配置檔'
            : `發現 ${findings.length} 個敏感檔案`,
        findings
    };
}

function checkHardcodedKeys(entries: ZipEntry[]): SecurityCheck {
    const findings: string[] = [];
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.mjs', '.cjs'];

    for (const entry of entries) {
        const ext = '.' + (entry.filename.split('.').pop() || '');
        if (!codeExtensions.includes(ext)) continue;

        for (const pattern of HARDCODED_KEY_PATTERNS) {
            const matches = entry.content.match(pattern);
            if (matches) {
                // Avoid false positives: skip if looks like example/placeholder
                for (const match of matches) {
                    if (!match.includes('EXAMPLE') &&
                        !match.includes('YOUR_') &&
                        !match.includes('xxx') &&
                        !match.includes('placeholder')) {
                        findings.push(`${entry.filename}: 發現可能的硬編碼密鑰`);
                        break;
                    }
                }
            }
        }
    }

    return {
        id: 'hardcoded_keys',
        name: '硬編碼密鑰',
        passed: findings.length === 0,
        severity: 'critical',
        message: findings.length === 0
            ? '未發現硬編碼的密鑰'
            : '發現程式碼中可能含有硬編碼的密鑰',
        findings
    };
}

function checkInternalUrls(entries: ZipEntry[]): SecurityCheck {
    const findings: string[] = [];

    for (const entry of entries) {
        if (!entry.content) continue;

        for (const pattern of INTERNAL_URL_PATTERNS) {
            if (pattern.test(entry.content)) {
                findings.push(`${entry.filename}: 發現內網位址`);
                pattern.lastIndex = 0; // Reset regex
                break;
            }
        }
    }

    return {
        id: 'internal_urls',
        name: '內網位址',
        passed: findings.length === 0,
        severity: 'warning', // 只是警告，允許繼續
        message: findings.length === 0
            ? '未發現內網位址'
            : '發現 localhost 或內網 IP（建議移除）',
        findings
    };
}

function checkDbConnections(entries: ZipEntry[]): SecurityCheck {
    const findings: string[] = [];

    for (const entry of entries) {
        if (!entry.content) continue;

        for (const pattern of DB_CONNECTION_PATTERNS) {
            if (pattern.test(entry.content)) {
                findings.push(`${entry.filename}: 發現資料庫連線字串`);
                pattern.lastIndex = 0;
                break;
            }
        }
    }

    return {
        id: 'db_connections',
        name: '資料庫連線',
        passed: findings.length === 0,
        severity: 'critical',
        message: findings.length === 0
            ? '未發現資料庫連線字串'
            : '發現含有帳密的資料庫連線字串',
        findings
    };
}

// ====== 主要掃描函數 ======

export async function runSecurityChecks(buffer: ArrayBuffer): Promise<SecurityScanResult> {
    const entries = parseZipEntries(buffer);

    const checks: SecurityCheck[] = [
        checkRealApiKey(entries),
        checkSensitiveFiles(entries),
        checkHardcodedKeys(entries),
        checkInternalUrls(entries),
        checkDbConnections(entries),
    ];

    // passed = 所有 critical 都通過
    const passed = checks
        .filter(c => c.severity === 'critical')
        .every(c => c.passed);

    // hasWarnings = 有任何警告（但不影響部署）
    const hasWarnings = checks
        .filter(c => c.severity === 'warning')
        .some(c => !c.passed);

    return {
        passed,
        hasWarnings,
        checks
    };
}
