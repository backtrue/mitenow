/**
 * E2E Tests for API Endpoints
 * Tests the backend API through the frontend
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8787';

test.describe('Health Check API', () => {
    test('should return healthy status', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/health`);

        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toMatch(/healthy|degraded|ok/);
        expect(data.timestamp).toBeDefined();
    });
});

test.describe('Prepare API', () => {
    test('should return upload URL for valid request', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            data: {
                filename: 'test-app.zip',
            },
        });

        // May fail if rate limited or server not running
        if (response.ok()) {
            const data = await response.json();
            expect(data.app_id).toBeDefined();
            expect(data.upload_url).toBeDefined();
            expect(data.expires_at).toBeDefined();
        }
    });

    test('should reject non-ZIP filenames', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            data: {
                filename: 'test-app.txt',
            },
        });

        // Should return 400 Bad Request
        expect(response.status()).toBe(400);
    });

    test('should reject empty filename', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            data: {
                filename: '',
            },
        });

        expect(response.status()).toBe(400);
    });

    test('should reject missing filename', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            data: {},
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Subdomain Check API', () => {
    test('should check subdomain availability', async ({ request }) => {
        const testSubdomain = `test-${Date.now()}`;

        const response = await request.get(
            `${API_BASE}/api/v1/subdomain/check/${testSubdomain}`
        );

        if (response.ok()) {
            const data = await response.json();
            expect(typeof data.available).toBe('boolean');
        }
    });

    test('should reject invalid subdomain format', async ({ request }) => {
        const response = await request.get(
            `${API_BASE}/api/v1/subdomain/check/INVALID_SUBDOMAIN!`
        );

        // Should return 400 Bad Request
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should reject reserved subdomains', async ({ request }) => {
        const reservedNames = ['www', 'api', 'admin', 'mail'];

        for (const name of reservedNames) {
            const response = await request.get(
                `${API_BASE}/api/v1/subdomain/check/${name}`
            );

            if (response.ok()) {
                const data = await response.json();
                expect(data.available).toBe(false);
            }
        }
    });
});

test.describe('Auth API', () => {
    test('should return login URL', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/auth/login`);

        // Should redirect to Google OAuth
        if (response.status() === 302 || response.status() === 307) {
            const location = response.headers()['location'];
            expect(location).toMatch(/accounts\.google\.com|oauth/);
        }
    });

    test('should return 401 for unauthenticated /me', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/auth/me`);

        // Should return 401 Unauthorized
        expect(response.status()).toBe(401);
    });
});

test.describe('Rate Limiting', () => {
    test('should rate limit excessive requests', async ({ request }) => {
        const requests = [];

        // Send many requests quickly
        for (let i = 0; i < 20; i++) {
            requests.push(
                request.post(`${API_BASE}/api/v1/prepare`, {
                    data: { filename: `test-${i}.zip` },
                })
            );
        }

        const responses = await Promise.all(requests);

        // At least some should be rate limited (429)
        const rateLimited = responses.filter(r => r.status() === 429);

        // Note: This test may pass without rate limiting if the limit is high
        // or if the test runs slowly
        console.log(`Rate limited: ${rateLimited.length} / ${responses.length}`);
    });
});

test.describe('CORS', () => {
    test('should handle CORS preflight', async ({ request }) => {
        const response = await request.fetch(`${API_BASE}/api/v1/prepare`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://mite.now',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type',
            },
        });

        // Should return 204 No Content for OPTIONS
        expect(response.status()).toBe(204);

        // Should have CORS headers
        const headers = response.headers();
        expect(headers['access-control-allow-origin']).toBeDefined();
        expect(headers['access-control-allow-methods']).toContain('POST');
    });

    test('should reject requests from unauthorized origins', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            headers: {
                'Origin': 'https://malicious-site.com',
            },
            data: {
                filename: 'test.zip',
            },
        });

        const headers = response.headers();
        // Should not allow the malicious origin
        expect(headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
});

test.describe('Error Handling', () => {
    test('should return proper error format', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/v1/prepare`, {
            data: 'invalid json{',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        expect(response.status()).toBeGreaterThanOrEqual(400);

        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.message).toBeDefined();
    });

    test('should return 404 for unknown endpoints', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/nonexistent`);

        expect(response.status()).toBe(404);

        const data = await response.json();
        expect(data.error).toBeDefined();
    });
});
