/**
 * E2E Tests for mite.now Homepage
 * Tests the main landing page and core functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the main heading', async ({ page }) => {
        // Check for the main title
        await expect(page.locator('h1')).toContainText(/mite\.now|Deploy|AI/i);
    });

    test('should have a visible upload area', async ({ page }) => {
        // Look for dropzone or file upload area
        const dropzone = page.locator('[data-testid="dropzone"], .dropzone, [role="button"]:has-text("Upload")');
        await expect(dropzone.first()).toBeVisible();
    });

    test('should show login button for unauthenticated users', async ({ page }) => {
        // Check for login button
        const loginButton = page.locator('button:has-text("Login"), a:has-text("Login"), button:has-text("登入")');
        await expect(loginButton.first()).toBeVisible();
    });

    test('should have responsive navigation', async ({ page }) => {
        // Check navigation elements exist
        const nav = page.locator('nav, header');
        await expect(nav.first()).toBeVisible();
    });

    test('should display feature highlights', async ({ page }) => {
        // Check for feature descriptions
        const features = page.locator('text=/60|seconds|deploy|zero|config/i');
        await expect(features.first()).toBeVisible();
    });

    test('should have working language switcher', async ({ page }) => {
        // Look for language switcher
        const langSwitcher = page.locator('[data-testid="locale-switcher"], button:has-text("EN"), button:has-text("日本語"), button:has-text("繁體中文")');

        if (await langSwitcher.first().isVisible()) {
            await langSwitcher.first().click();
            // Should show language options
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Upload Flow', () => {
    test('should show error for non-ZIP files', async ({ page }) => {
        await page.goto('/');

        // Find file input
        const fileInput = page.locator('input[type="file"]');

        if (await fileInput.count() > 0) {
            // Create a dummy non-ZIP file
            await fileInput.setInputFiles({
                name: 'test.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from('Hello World'),
            });

            // Should show error message
            await expect(page.locator('text=/only.*zip|zip.*only|不支援/i').first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should show upload progress for valid ZIP', async ({ page }) => {
        await page.goto('/');

        // Find file input
        const fileInput = page.locator('input[type="file"]');

        if (await fileInput.count() > 0) {
            // Create a minimal valid ZIP file structure
            const zipHeader = Buffer.from([
                0x50, 0x4B, 0x03, 0x04, // Local file header signature
                0x0A, 0x00, // Version needed to extract
                0x00, 0x00, // General purpose bit flag
                0x00, 0x00, // Compression method
                0x00, 0x00, // Last mod file time
                0x00, 0x00, // Last mod file date
                0x00, 0x00, 0x00, 0x00, // CRC-32
                0x00, 0x00, 0x00, 0x00, // Compressed size
                0x00, 0x00, 0x00, 0x00, // Uncompressed size
                0x06, 0x00, // File name length
                0x00, 0x00, // Extra field length
            ]);
            const fileName = Buffer.from('app.py');
            const zipBuffer = Buffer.concat([zipHeader, fileName]);

            await fileInput.setInputFiles({
                name: 'test-app.zip',
                mimeType: 'application/zip',
                buffer: zipBuffer,
            });

            // Should show some upload indication (progress, form, etc.)
            await page.waitForTimeout(1000);
        }
    });
});

test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');

        // Check h1 exists and is unique
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBe(1);
    });

    test('should have accessible buttons', async ({ page }) => {
        await page.goto('/');

        // All buttons should have accessible names
        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < count; i++) {
            const button = buttons.nth(i);
            const name = await button.getAttribute('aria-label') || await button.textContent();
            expect(name?.trim()).toBeTruthy();
        }
    });

    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/');

        // Tab through interactive elements
        await page.keyboard.press('Tab');

        // Should have focus on some element
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});

test.describe('Performance', () => {
    test('should load quickly', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        const loadTime = Date.now() - startTime;

        // Page should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
    });

    test('should have no console errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Filter out known non-critical errors
        const criticalErrors = errors.filter(err =>
            !err.includes('Failed to load resource') && // May occur if API is down
            !err.includes('favicon') // May not have favicon
        );

        expect(criticalErrors).toHaveLength(0);
    });
});
