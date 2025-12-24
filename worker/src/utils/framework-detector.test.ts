/**
 * Unit Tests for Framework Detection Utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
interface MockEnv {
    MITE_BUCKET: {
        head: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
    };
}

// Helper to create a minimal valid ZIP file with specific content
function createMockZip(files: Record<string, string>): ArrayBuffer {
    // Create a simple ZIP structure for testing
    // This is a minimal implementation for uncompressed files only

    const entries: Array<{
        name: string;
        content: Uint8Array;
        localHeaderOffset: number;
    }> = [];

    let offset = 0;
    const chunks: Uint8Array[] = [];

    // Create local file headers and data
    for (const [name, content] of Object.entries(files)) {
        const nameBytes = new TextEncoder().encode(name);
        const contentBytes = new TextEncoder().encode(content);

        entries.push({
            name,
            content: contentBytes,
            localHeaderOffset: offset,
        });

        // Local file header (30 bytes + name + content)
        const localHeader = new Uint8Array(30 + nameBytes.length + contentBytes.length);
        const view = new DataView(localHeader.buffer);

        // Signature
        view.setUint32(0, 0x04034b50, true);
        // Version needed
        view.setUint16(4, 10, true);
        // General purpose bit flag
        view.setUint16(6, 0, true);
        // Compression method (0 = stored)
        view.setUint16(8, 0, true);
        // Last mod time
        view.setUint16(10, 0, true);
        // Last mod date
        view.setUint16(12, 0, true);
        // CRC-32 (simplified, not actual CRC)
        view.setUint32(14, 0, true);
        // Compressed size
        view.setUint32(18, contentBytes.length, true);
        // Uncompressed size
        view.setUint32(22, contentBytes.length, true);
        // File name length
        view.setUint16(26, nameBytes.length, true);
        // Extra field length
        view.setUint16(28, 0, true);

        // File name
        localHeader.set(nameBytes, 30);
        // File data
        localHeader.set(contentBytes, 30 + nameBytes.length);

        chunks.push(localHeader);
        offset += localHeader.length;
    }

    const centralDirStart = offset;

    // Create central directory
    for (const entry of entries) {
        const nameBytes = new TextEncoder().encode(entry.name);

        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const view = new DataView(centralHeader.buffer);

        // Signature
        view.setUint32(0, 0x02014b50, true);
        // Version made by
        view.setUint16(4, 20, true);
        // Version needed
        view.setUint16(6, 10, true);
        // General purpose bit flag
        view.setUint16(8, 0, true);
        // Compression method
        view.setUint16(10, 0, true);
        // Last mod time
        view.setUint16(12, 0, true);
        // Last mod date
        view.setUint16(14, 0, true);
        // CRC-32
        view.setUint32(16, 0, true);
        // Compressed size
        view.setUint32(20, entry.content.length, true);
        // Uncompressed size
        view.setUint32(24, entry.content.length, true);
        // File name length
        view.setUint16(28, nameBytes.length, true);
        // Extra field length
        view.setUint16(30, 0, true);
        // Comment length
        view.setUint16(32, 0, true);
        // Disk number start
        view.setUint16(34, 0, true);
        // Internal file attributes
        view.setUint16(36, 0, true);
        // External file attributes
        view.setUint32(38, 0, true);
        // Relative offset of local header
        view.setUint32(42, entry.localHeaderOffset, true);

        // File name
        centralHeader.set(nameBytes, 46);

        chunks.push(centralHeader);
        offset += centralHeader.length;
    }

    const centralDirSize = offset - centralDirStart;

    // End of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    // Signature
    eocdView.setUint32(0, 0x06054b50, true);
    // Number of this disk
    eocdView.setUint16(4, 0, true);
    // Disk where central directory starts
    eocdView.setUint16(6, 0, true);
    // Number of central directory records on this disk
    eocdView.setUint16(8, entries.length, true);
    // Total number of central directory records
    eocdView.setUint16(10, entries.length, true);
    // Size of central directory
    eocdView.setUint32(12, centralDirSize, true);
    // Offset of start of central directory
    eocdView.setUint32(16, centralDirStart, true);
    // Comment length
    eocdView.setUint16(20, 0, true);

    chunks.push(eocd);

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
    }

    return result.buffer;
}

// Create mock environment
function createMockEnv(zipFiles?: Record<string, string>, metadata?: Record<string, string>): MockEnv {
    const mockHead = vi.fn();
    const mockGet = vi.fn();

    if (zipFiles) {
        const zipBuffer = createMockZip(zipFiles);

        mockHead.mockResolvedValue({
            customMetadata: metadata || {},
        });

        mockGet.mockResolvedValue({
            arrayBuffer: () => Promise.resolve(zipBuffer),
        });
    } else {
        mockHead.mockResolvedValue(null);
        mockGet.mockResolvedValue(null);
    }

    return {
        MITE_BUCKET: {
            head: mockHead,
            get: mockGet,
        },
    };
}

// Import the module dynamically to avoid issues with mocking
describe('Framework Detector', () => {
    describe('detectFrameworkType', () => {
        it('should detect Streamlit from requirements.txt', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'streamlit>=1.28.0\npython-dotenv\n',
                'app.py': 'import streamlit as st',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('streamlit');
            expect(result.has_requirements).toBe(true);
            expect(result.entrypoint).toBe('app.py');
        });

        it('should detect Gradio from requirements.txt', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'gradio>=4.0.0\ngoogle-generativeai\n',
                'app.py': 'import gradio as gr',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('gradio');
            expect(result.has_requirements).toBe(true);
        });

        it('should detect FastAPI from requirements.txt', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'fastapi>=0.100.0\nuvicorn\n',
                'main.py': 'from fastapi import FastAPI',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('fastapi');
            expect(result.entrypoint).toBe('main.py');
        });

        it('should detect Flask from requirements.txt', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'flask>=3.0.0\ngunicorn\n',
                'app.py': 'from flask import Flask',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('flask');
        });

        it('should use override framework when provided', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'streamlit>=1.0.0\n',
                'app.py': 'import streamlit',
            }) as unknown as import('../types').Env;

            // Override to gradio despite streamlit in requirements
            const result = await analyzeAppFramework(env, 'test-app', 'gradio');

            expect(result.framework).toBe('gradio');
        });

        it('should default to streamlit when no source found', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv() as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('streamlit');
        });

        it('should use metadata framework hint if available', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv(
                { 'app.py': 'print("hello")' },
                { framework: 'flask' }
            ) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('flask');
        });
    });

    describe('Node.js Framework Detection', () => {
        it('should detect Next.js from package.json', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'package.json': JSON.stringify({
                    dependencies: {
                        next: '^14.0.0',
                        react: '^18.0.0',
                    },
                }),
                'pages/index.tsx': 'export default function Home() {}',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('nextjs');
            expect(result.has_package_json).toBe(true);
        });

        it('should detect React+Vite from package.json', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'package.json': JSON.stringify({
                    dependencies: {
                        react: '^18.0.0',
                        vite: '^5.0.0',
                    },
                }),
                'src/App.tsx': 'function App() {}',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('react');
        });

        it('should detect Express from package.json', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'package.json': JSON.stringify({
                    dependencies: {
                        express: '^4.18.0',
                    },
                }),
                'index.js': 'const express = require("express")',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('express');
            expect(result.entrypoint).toBe('index.js');
        });
    });

    describe('Static Site Detection', () => {
        it('should detect static site with index.html', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'index.html': '<!DOCTYPE html><html></html>',
                'style.css': 'body {}',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            expect(result.framework).toBe('static');
            expect(result.entrypoint).toBe('index.html');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty ZIP gracefully', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({}) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            // Should default to streamlit
            expect(result.framework).toBe('streamlit');
        });

        it('should ignore invalid framework override', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'requirements.txt': 'streamlit\n',
            }) as unknown as import('../types').Env;

            // Invalid framework should be ignored
            const result = await analyzeAppFramework(env, 'test-app', 'invalid-framework');

            expect(result.framework).toBe('streamlit');
        });

        it('should handle malformed package.json', async () => {
            const { analyzeAppFramework } = await import('./framework-detector');

            const env = createMockEnv({
                'package.json': 'not valid json {{{',
                'index.html': '<!DOCTYPE html>',
            }) as unknown as import('../types').Env;

            const result = await analyzeAppFramework(env, 'test-app');

            // Should fall back to static (has HTML)
            expect(result.framework).toBe('static');
        });
    });
});

describe('ZIP Parsing', () => {
    it('should correctly parse ZIP central directory', () => {
        const zipBuffer = createMockZip({
            'file1.txt': 'content1',
            'file2.txt': 'content2',
            'nested/file3.txt': 'content3',
        });

        const bytes = new Uint8Array(zipBuffer);

        // Verify ZIP structure by checking signatures
        // Local file header: PK\x03\x04
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4B);
        expect(bytes[2]).toBe(0x03);
        expect(bytes[3]).toBe(0x04);
    });
});
