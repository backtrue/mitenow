/**
 * Share Page API Handler
 * GET /api/v1/share/:appId
 */

import type { Env } from '../types';
import { ApiError } from '../types';

interface ShareData {
    subdomain: string;
    live_url: string;
    praise_text: string | null;
    character_id: string | null;
    framework: string | null;
    created_at: number;
}

export async function handleGetShare(
    request: Request,
    env: Env,
    appId: string
): Promise<Response> {
    if (request.method !== 'GET') {
        throw new ApiError(405, 'Method not allowed');
    }

    // Get deployment info
    const deployment = await env.DB.prepare(`
    SELECT subdomain, cloud_run_url, praise_text, praise_character, framework, created_at
    FROM deployments
    WHERE id = ?
  `).bind(appId).first<{
        subdomain: string;
        cloud_run_url: string | null;
        praise_text: string | null;
        praise_character: string | null;
        framework: string | null;
        created_at: number;
    }>();

    if (!deployment) {
        throw new ApiError(404, 'Deployment not found');
    }

    const shareData: ShareData = {
        subdomain: deployment.subdomain,
        live_url: `https://${deployment.subdomain}.mite.now`,
        praise_text: deployment.praise_text,
        character_id: deployment.praise_character,
        framework: deployment.framework,
        created_at: deployment.created_at,
    };

    return Response.json(shareData);
}
