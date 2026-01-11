/**
 * Handler for deploying code directly (without ZIP upload)
 * POST /api/v1/deploy-code
 */

import { Env, ApiError, FrameworkType } from '../types';
import {
    validateCode,
    detectAIGenerated,
    detectFramework,
    CodeValidationResult,
    AIDetectionResult,
    FrameworkDetectionResult,
} from '../utils/code-validator';
import { isSubdomainAvailable, createAppRecord, updateAppStatus } from '../utils/kv';
import { createDeploymentInD1 } from '../utils/quota';
import { triggerCloudBuild } from '../utils/cloud-build';
import { storeUserApiKey } from '../utils/secret-manager';

interface DeployCodeRequest {
    code: string;
    subdomain: string;
    api_key: string;
    framework?: string; // Optional: user can override auto-detection
    filename?: string;  // Optional: specify filename (default: app.py or index.html)
}

interface DeployCodeResponse {
    app_id: string;
    subdomain: string;
    status: string;
    message: string;
    ai_detection: AIDetectionResult;
    framework_detection: FrameworkDetectionResult;
    validation: CodeValidationResult;
}

const AI_CONFIDENCE_THRESHOLD = 50; // Minimum confidence to accept as AI-generated

/**
 * Get today's date string for rate limiting
 */
function getToday(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export async function handleDeployCode(
    request: Request,
    env: Env
): Promise<Response> {
    if (request.method !== 'POST') {
        throw new ApiError(405, 'Method not allowed');
    }

    // Parse request body
    let body: DeployCodeRequest;
    try {
        body = await request.json() as DeployCodeRequest;
    } catch {
        throw new ApiError(400, 'Invalid JSON body');
    }

    const { code, subdomain, api_key, framework: userFramework, filename } = body;

    // Validate required fields
    if (!code || !subdomain || !api_key) {
        throw new ApiError(400, 'Missing required fields: code, subdomain, api_key');
    }

    // Get client IP for rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Check rate limit (10 deployments per day)
    const rateLimitKey = `ratelimit:code:${clientIp}:${getToday()}`;
    const currentCount = parseInt(await env.MITE_KV.get(rateLimitKey) || '0');

    if (currentCount >= 10) {
        throw new ApiError(429, 'Rate limit exceeded. You can deploy 10 times per day. Try again tomorrow.', 'RATE_LIMIT_EXCEEDED');
    }

    // Step 1: Validate code
    const validation = validateCode(code);
    if (!validation.valid) {
        throw new ApiError(400, `Code validation failed: ${validation.errors.join(', ')}`);
    }

    // Step 2: Detect if AI-generated
    const aiDetection = detectAIGenerated(code);
    if (!aiDetection.isAIGenerated || aiDetection.confidence < AI_CONFIDENCE_THRESHOLD) {
        throw new ApiError(
            400,
            `This code does not appear to be AI-generated (confidence: ${aiDetection.confidence}%). ` +
            `mite.now currently only supports deploying AI-generated code from ChatGPT, Gemini, or similar tools.`,
            'NOT_AI_GENERATED'
        );
    }

    // Step 3: Detect framework
    const frameworkDetection = detectFramework(code);
    const detectedFramework = userFramework || frameworkDetection.framework;

    if (detectedFramework === 'unknown') {
        throw new ApiError(
            400,
            'Unable to detect framework. Please specify the framework manually.',
            'UNKNOWN_FRAMEWORK'
        );
    }

    // Step 4: Validate subdomain
    const subdomainLower = subdomain.toLowerCase().trim();
    if (subdomainLower.length < 3 || subdomainLower.length > 63) {
        throw new ApiError(400, 'Subdomain must be between 3 and 63 characters');
    }

    // Check subdomain availability
    const available = await isSubdomainAvailable(env, subdomainLower);
    if (!available) {
        throw new ApiError(409, 'Subdomain is already taken or reserved');
    }

    // Step 5: Generate app ID
    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Step 6: Determine filename based on framework
    const codeFilename = filename || getDefaultFilename(detectedFramework, frameworkDetection.language);

    // Step 7: Create virtual ZIP file in R2
    await createVirtualZip(env, appId, code, codeFilename, detectedFramework);

    // Step 8: Create app record in KV
    await createAppRecord(env, appId, subdomainLower);

    // Step 9: Update status to building
    await updateAppStatus(env, appId, 'building', {
        framework: detectedFramework as FrameworkType
    });

    // Step 10: Store API key securely
    const secretResourceName = await storeUserApiKey(env, appId, api_key);

    // Step 11: Create deployment record in D1
    await createDeploymentInD1(env, {
        id: appId,
        user_id: null, // Anonymous deployment
        subdomain: subdomainLower,
        framework: detectedFramework as FrameworkType,
        status: 'building'
    });

    // Step 12: Trigger Cloud Build
    await triggerCloudBuild(
        env,
        appId,
        subdomainLower,
        { framework: detectedFramework as FrameworkType, language: frameworkDetection.language },
        secretResourceName
    );

    // Increment rate limit counter
    await env.MITE_KV.put(rateLimitKey, String(currentCount + 1), {
        expirationTtl: 86400 // 24 hours
    });

    // Return success response
    const response: DeployCodeResponse = {
        app_id: appId,
        subdomain: subdomainLower,
        status: 'building',
        message: `Deployment started. Your app will be available at https://${subdomainLower}.mite.now`,
        ai_detection: aiDetection,
        framework_detection: frameworkDetection,
        validation,
    };

    return new Response(JSON.stringify(response), {
        status: 202, // Accepted
        headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(9 - currentCount),
        }
    });
}

/**
 * Get default filename based on framework and language
 */
function getDefaultFilename(framework: string, language: string): string {
    if (language === 'python') {
        return 'app.py';
    } else if (language === 'javascript') {
        return framework === 'react' ? 'App.jsx' : 'index.js';
    } else if (language === 'html') {
        return 'index.html';
    }
    return 'main.py'; // Default fallback
}

/**
 * Create a virtual ZIP file in R2 containing the code
 */
async function createVirtualZip(
    env: Env,
    appId: string,
    code: string,
    filename: string,
    framework: string
): Promise<void> {
    // Create a simple ZIP structure
    // For now, we'll store the code as a single file
    // In production, you might want to use a proper ZIP library

    const files: Record<string, string> = {
        [filename]: code,
    };

    // Add requirements.txt or package.json based on framework
    if (framework === 'streamlit') {
        files['requirements.txt'] = 'streamlit>=1.28.0\n';
    } else if (framework === 'gradio') {
        files['requirements.txt'] = 'gradio>=4.0.0\n';
    } else if (framework === 'flask') {
        files['requirements.txt'] = 'flask>=3.0.0\ngunicorn>=21.0.0\n';
    } else if (framework === 'fastapi') {
        files['requirements.txt'] = 'fastapi>=0.104.0\nuvicorn>=0.24.0\n';
    } else if (framework === 'react') {
        files['package.json'] = JSON.stringify({
            name: 'react-app',
            version: '1.0.0',
            dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
            },
        }, null, 2);
    }

    // Store as JSON in R2 (we'll extract it during build)
    const zipData = JSON.stringify(files);

    await env.MITE_BUCKET.put(`${appId}/code.json`, zipData, {
        httpMetadata: {
            contentType: 'application/json',
        },
        customMetadata: {
            type: 'code_deployment',
            framework,
            filename,
        },
    });
}
