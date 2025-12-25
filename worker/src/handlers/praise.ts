/**
 * GET /api/v1/praise/:appId
 * Generate praise for a deployed app using platform API key
 * Uses ZIP content from R2 for better LLM context
 */

import type { Env } from '../types';
import { ApiError } from '../types';
import { generatePraise, savePraise, getPraise } from '../utils/praise-generator';
import { getSecret } from '../utils/secret-manager';
import { getFromR2 } from '../utils/r2';
import { unzipSync } from 'fflate';

interface GeneratePraiseRequest {
    locale?: 'tw' | 'en' | 'jp';
}

// Cache the API key in memory to avoid repeated Secret Manager calls
let cachedApiKey: string | null = null;

async function getGeminiApiKey(env: Env): Promise<string> {
    if (cachedApiKey) {
        return cachedApiKey;
    }

    try {
        cachedApiKey = await getSecret(env, 'GEMINI_API_KEY');
        return cachedApiKey;
    } catch (error) {
        console.error('Failed to get GEMINI_API_KEY from Secret Manager:', error);
        throw new ApiError(500, 'Praise generation not configured');
    }
}

export async function handleGeneratePraise(
    request: Request,
    env: Env,
    appId: string
): Promise<Response> {
    // Support both GET and POST for flexibility
    if (request.method !== 'POST' && request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed');
    }

    // Check if praise already exists
    const existingPraise = await getPraise(env, appId);
    if (existingPraise?.praise_text) {
        return Response.json({
            praise_text: existingPraise.praise_text,
            character_id: existingPraise.praise_character,
            cached: true,
        });
    }

    // Parse locale from request
    let locale: 'tw' | 'en' | 'jp' = 'tw';
    if (request.method === 'POST') {
        try {
            const body = await request.json() as GeneratePraiseRequest;
            locale = body.locale || 'tw';
        } catch {
            // Ignore parse errors, use default locale
        }
    } else {
        const url = new URL(request.url);
        locale = (url.searchParams.get('locale') as 'tw' | 'en' | 'jp') || 'tw';
    }

    // Get subdomain from DB for fallback context
    const deployment = await env.DB.prepare(
        'SELECT subdomain FROM deployments WHERE id = ?'
    ).bind(appId).first<{ subdomain: string }>();

    if (!deployment?.subdomain) {
        throw new ApiError(404, 'Deployment not found');
    }

    // Get code content from R2 ZIP
    console.log(`Reading ZIP from R2 for ${appId}`);
    let codeContent = '';

    try {
        const r2Object = await getFromR2(env, appId);
        if (r2Object) {
            const zipData = await r2Object.arrayBuffer();
            codeContent = extractCodeFromZip(zipData, deployment.subdomain);
            console.log(`Extracted ${codeContent.length} chars from ZIP`);
        } else {
            console.error(`No R2 object found for ${appId}`);
        }
    } catch (error) {
        console.error('Error reading ZIP from R2:', error);
    }

    // Fallback if ZIP extraction failed
    if (!codeContent || codeContent.length < 50) {
        codeContent = `A web application called "${deployment.subdomain}" - an innovative AI-powered project`;
    }

    // Generate praise using platform API key from Secret Manager
    const apiKey = await getGeminiApiKey(env);
    console.log(`Generating praise for ${appId} with locale ${locale}`);
    const { praise, characterId } = await generatePraise(apiKey, codeContent, locale);

    if (!praise) {
        throw new ApiError(500, 'Failed to generate praise');
    }

    // Save to database
    await savePraise(env, appId, praise, characterId);

    return Response.json({
        praise_text: praise,
        character_id: characterId,
        cached: false,
    });
}

/**
     * Extract code content from ZIP using fflate
     * Optimized for Google AI Studio export structure:
     * - metadata.json: project name and description
     * - App.tsx: main application logic
     * - services/geminiService.ts: AI prompts
     * - README.md: project documentation
     */
function extractCodeFromZip(zipData: ArrayBuffer, subdomain: string): string {
    try {
        const uint8Array = new Uint8Array(zipData);
        const unzipped = unzipSync(uint8Array);
        const decoder = new TextDecoder('utf-8');

        // Helper to safely decode file content
        const decodeFile = (filename: string): string | null => {
            const fileData = unzipped[filename];
            if (!fileData) return null;
            try {
                return decoder.decode(fileData);
            } catch {
                return null;
            }
        };

        // 1. Extract metadata.json first (most important!)
        let projectName = subdomain;
        let projectDescription = '';

        const metadataContent = decodeFile('metadata.json');
        if (metadataContent) {
            try {
                const metadata = JSON.parse(metadataContent);
                projectName = metadata.name?.trim() || subdomain;
                projectDescription = metadata.description?.trim() || '';
                console.log(`Project metadata: ${projectName}`);
            } catch {
                // Ignore JSON parse errors
            }
        }

        // 2. Build result with project info header
        let result = `【專案名稱】${projectName}\n`;
        if (projectDescription) {
            result += `【專案描述】${projectDescription}\n`;
        }
        result += '\n';

        // 3. Priority files to extract (in order)
        const priorityFiles = [
            { path: 'App.tsx', label: '主程式' },
            { path: 'App.jsx', label: '主程式' },
            { path: 'app.py', label: '主程式' },
            { path: 'main.py', label: '主程式' },
            { path: 'services/geminiService.ts', label: 'AI 服務' },
            { path: 'services/geminiService.js', label: 'AI 服務' },
            { path: 'index.html', label: '頁面結構' },
        ];

        let extractedCount = 0;
        const maxFiles = 3;
        const maxPerFile = 4000;

        for (const { path, label } of priorityFiles) {
            if (extractedCount >= maxFiles) break;

            const content = decodeFile(path);
            if (content && content.length > 50) {
                result += `【${label}】(${path})\n`;
                result += '```\n';
                result += content.slice(0, maxPerFile);
                if (content.length > maxPerFile) {
                    result += '\n... (截斷)';
                }
                result += '\n```\n\n';
                extractedCount++;
            }
        }

        // 4. If no priority files found, try any .tsx/.ts/.py file
        if (extractedCount === 0) {
            console.log('No priority files found, searching for any code files...');

            for (const [filename, fileData] of Object.entries(unzipped)) {
                if (extractedCount >= maxFiles) break;
                if (filename.endsWith('/')) continue; // Skip directories

                const ext = filename.split('.').pop()?.toLowerCase();
                if (!['tsx', 'ts', 'jsx', 'js', 'py'].includes(ext || '')) continue;
                if (filename.includes('node_modules/')) continue;

                try {
                    const content = decoder.decode(fileData);
                    if (content.length > 50 && content.length < 50000) {
                        result += `【程式碼】(${filename})\n`;
                        result += '```\n';
                        result += content.slice(0, maxPerFile);
                        result += '\n```\n\n';
                        extractedCount++;
                    }
                } catch {
                    // Skip decode errors
                }
            }
        }

        console.log(`Extracted ${extractedCount} code files, total ${result.length} chars`);
        return result.slice(0, 10000); // Limit total for LLM

    } catch (error) {
        console.error('Error extracting ZIP:', error);
        return `專案名稱：${subdomain}\n無法讀取專案內容`;
    }
}

