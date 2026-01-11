/**
 * Code validation and AI detection utilities
 */

export interface CodeValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface AIDetectionResult {
    isAIGenerated: boolean;
    confidence: number; // 0-100
    source: 'chatgpt' | 'gemini' | 'copilot' | 'unknown';
    features: {
        hasComments: boolean;
        commentDensity: number; // percentage
        hasTyping: boolean;
        avgLineLength: number;
        complexity: number;
        hasSpecialChars: boolean; // Unicode markers
    };
}

export interface FrameworkDetectionResult {
    framework: string;
    confidence: number; // 0-100
    language: 'python' | 'javascript' | 'html' | 'unknown';
}

// Code size limits
export const CODE_LIMITS = {
    maxTotalSize: 500_000,      // 500KB total
    maxLineLength: 1000,        // Max characters per line
    maxLines: 5000,             // Max number of lines
    minSize: 10,                // Minimum 10 bytes
};

// Blocked patterns for security
const BLOCKED_PATTERNS = [
    { pattern: /eval\s*\(/gi, reason: 'eval() execution is not allowed' },
    { pattern: /exec\s*\(/gi, reason: 'exec() execution is not allowed' },
    { pattern: /subprocess\.(?:call|run|Popen)/gi, reason: 'Subprocess execution is not allowed' },
    { pattern: /os\.system/gi, reason: 'System command execution is not allowed' },
    { pattern: /shell=True/gi, reason: 'Shell execution is not allowed' },
    { pattern: /crypto.*mining/gi, reason: 'Cryptocurrency mining is not allowed' },
    { pattern: /__import__\s*\(/gi, reason: 'Dynamic imports are not allowed' },
];

// Suspicious patterns (warnings, not blocking)
const SUSPICIOUS_PATTERNS = [
    { pattern: /\.env|API_KEY|SECRET_KEY|PASSWORD/gi, reason: 'Contains potential sensitive information' },
    { pattern: /requests\.get|fetch\(/gi, reason: 'Makes external HTTP requests' },
    { pattern: /open\s*\(/gi, reason: 'File system access detected' },
];

/**
 * Validate code size and content
 */
export function validateCode(code: string): CodeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum size
    if (code.length < CODE_LIMITS.minSize) {
        errors.push(`Code is too small (${code.length} bytes). Minimum is ${CODE_LIMITS.minSize} bytes.`);
    }

    // Check maximum size
    if (code.length > CODE_LIMITS.maxTotalSize) {
        errors.push(`Code is too large (${code.length} bytes). Maximum is ${CODE_LIMITS.maxTotalSize} bytes.`);
    }

    // Check line count
    const lines = code.split('\n');
    if (lines.length > CODE_LIMITS.maxLines) {
        errors.push(`Too many lines (${lines.length}). Maximum is ${CODE_LIMITS.maxLines} lines.`);
    }

    // Check line length
    const longLines = lines.filter(l => l.length > CODE_LIMITS.maxLineLength);
    if (longLines.length > 0) {
        errors.push(`${longLines.length} line(s) exceed maximum length of ${CODE_LIMITS.maxLineLength} characters.`);
    }

    // Check blocked patterns
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
        if (pattern.test(code)) {
            errors.push(reason);
        }
    }

    // Check suspicious patterns
    for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(code)) {
            warnings.push(reason);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Detect if code is AI-generated
 * This uses heuristics to identify common patterns in AI-generated code
 */
export function detectAIGenerated(code: string): AIDetectionResult {
    let score = 0;
    const features = analyzeCodeFeatures(code);

    // Feature 1: Comment density (AI code tends to have more comments)
    if (features.commentDensity > 15) score += 20;
    else if (features.commentDensity > 10) score += 10;

    // Feature 2: Consistent formatting (AI code is usually well-formatted)
    const hasConsistentIndentation = checkConsistentIndentation(code);
    if (hasConsistentIndentation) score += 15;

    // Feature 3: Descriptive variable names (AI uses verbose names)
    const hasDescriptiveNames = checkDescriptiveNaming(code);
    if (hasDescriptiveNames) score += 15;

    // Feature 4: Type hints/annotations (AI often includes these)
    if (features.hasTyping) score += 15;

    // Feature 5: Special Unicode characters (ChatGPT marker)
    if (features.hasSpecialChars) score += 25;

    // Feature 6: Docstrings/JSDoc (AI frequently adds documentation)
    const hasDocstrings = checkDocstrings(code);
    if (hasDocstrings) score += 10;

    // Determine source
    let source: AIDetectionResult['source'] = 'unknown';
    if (features.hasSpecialChars) {
        source = 'chatgpt'; // Special Unicode chars are ChatGPT markers
    } else if (score > 60 && features.commentDensity > 15) {
        source = 'gemini'; // High comment density suggests Gemini
    } else if (score > 50) {
        source = 'copilot'; // Generic AI
    }

    return {
        isAIGenerated: score >= 50, // Threshold: 50% confidence
        confidence: Math.min(score, 100),
        source,
        features,
    };
}

/**
 * Detect framework from code
 */
export function detectFramework(code: string): FrameworkDetectionResult {
    const detectors = [
        {
            framework: 'streamlit',
            language: 'python' as const,
            patterns: [
                { regex: /import streamlit/i, weight: 30 },
                { regex: /st\./g, weight: 10 },
                { regex: /st\.title|st\.write|st\.button/i, weight: 15 },
            ],
        },
        {
            framework: 'gradio',
            language: 'python' as const,
            patterns: [
                { regex: /import gradio/i, weight: 30 },
                { regex: /gr\./g, weight: 10 },
                { regex: /gr\.Interface|gr\.Blocks/i, weight: 15 },
            ],
        },
        {
            framework: 'flask',
            language: 'python' as const,
            patterns: [
                { regex: /from flask import/i, weight: 30 },
                { regex: /@app\.route/g, weight: 20 },
                { regex: /Flask\(__name__\)/i, weight: 15 },
            ],
        },
        {
            framework: 'fastapi',
            language: 'python' as const,
            patterns: [
                { regex: /from fastapi import/i, weight: 30 },
                { regex: /@app\.(get|post|put|delete)/g, weight: 20 },
                { regex: /FastAPI\(/i, weight: 15 },
            ],
        },
        {
            framework: 'react',
            language: 'javascript' as const,
            patterns: [
                { regex: /import React/i, weight: 30 },
                { regex: /from ['"]react['"]/i, weight: 30 },
                { regex: /useState|useEffect|useContext/g, weight: 15 },
                { regex: /export default function/i, weight: 10 },
            ],
        },
        {
            framework: 'static',
            language: 'html' as const,
            patterns: [
                { regex: /<!DOCTYPE html>/i, weight: 30 },
                { regex: /<html/i, weight: 20 },
                { regex: /<head>|<body>/i, weight: 15 },
            ],
        },
    ];

    let bestMatch = {
        framework: 'unknown',
        language: 'unknown' as const,
        confidence: 0,
    };

    for (const detector of detectors) {
        let score = 0;
        for (const { regex, weight } of detector.patterns) {
            const matches = code.match(regex);
            if (matches) {
                score += weight * Math.min(matches.length, 3); // Cap at 3 occurrences
            }
        }

        if (score > bestMatch.confidence) {
            bestMatch = {
                framework: detector.framework,
                language: detector.language,
                confidence: Math.min(score, 100),
            };
        }
    }

    return bestMatch;
}

/**
 * Analyze code features for AI detection
 */
function analyzeCodeFeatures(code: string): AIDetectionResult['features'] {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);

    // Count comments
    let commentLines = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            commentLines++;
        }
    }

    const commentDensity = nonEmptyLines.length > 0
        ? (commentLines / nonEmptyLines.length) * 100
        : 0;

    // Check for type hints
    const hasTyping = /:\s*(str|int|float|bool|list|dict|List|Dict|Optional|Union)/i.test(code) ||
        /:\s*\w+\s*=/.test(code); // TypeScript/Flow

    // Calculate average line length
    const totalLength = nonEmptyLines.reduce((sum, line) => sum + line.length, 0);
    const avgLineLength = nonEmptyLines.length > 0 ? totalLength / nonEmptyLines.length : 0;

    // Check for special Unicode characters (ChatGPT marker)
    const hasSpecialChars = /\u202F|\u00A0/.test(code); // Narrow No-Break Space, Non-Breaking Space

    // Simple complexity metric (number of control structures)
    const controlStructures = (code.match(/\b(if|else|elif|for|while|switch|case|try|catch|except)\b/g) || []).length;
    const complexity = nonEmptyLines.length > 0 ? (controlStructures / nonEmptyLines.length) * 100 : 0;

    return {
        hasComments: commentLines > 0,
        commentDensity,
        hasTyping,
        avgLineLength,
        complexity,
        hasSpecialChars,
    };
}

/**
 * Check if code has consistent indentation
 */
function checkConsistentIndentation(code: string): boolean {
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 5) return true; // Too few lines to judge

    const indentations = lines.map(line => {
        const match = line.match(/^(\s+)/);
        return match ? match[1].length : 0;
    }).filter(indent => indent > 0);

    if (indentations.length === 0) return true;

    // Check if all indentations are multiples of the same base
    const gcd = indentations.reduce((a, b) => {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    });

    // If GCD is 2 or 4 (common indentation), it's consistent
    return gcd === 2 || gcd === 4;
}

/**
 * Check if code uses descriptive variable names
 */
function checkDescriptiveNaming(code: string): boolean {
    // Look for variable assignments
    const varPattern = /(?:const|let|var|=)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = code.match(varPattern);

    if (!matches || matches.length < 3) return false;

    // Count descriptive names (length > 5, contains underscore or camelCase)
    let descriptiveCount = 0;
    for (const match of matches) {
        const varName = match.split(/\s+/).pop() || '';
        if (varName.length > 5 || /_/.test(varName) || /[a-z][A-Z]/.test(varName)) {
            descriptiveCount++;
        }
    }

    return descriptiveCount / matches.length > 0.5; // More than 50% are descriptive
}

/**
 * Check if code has docstrings or JSDoc comments
 */
function checkDocstrings(code: string): boolean {
    // Python docstrings
    const pythonDocstrings = /"""[\s\S]*?"""|'''[\s\S]*?'''/g;
    // JSDoc comments
    const jsdoc = /\/\*\*[\s\S]*?\*\//g;

    return pythonDocstrings.test(code) || jsdoc.test(code);
}
