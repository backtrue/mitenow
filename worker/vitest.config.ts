import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test environment
        environment: 'node',

        // Global test settings
        globals: true,

        // Test file patterns
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

        // Exclude patterns
        exclude: ['node_modules', '.wrangler'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/types/**',
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70,
            },
        },

        // Timeout for tests
        testTimeout: 10000,

        // Watch mode settings
        watch: false,

        // Reporter
        reporter: ['verbose'],
    },

    // Resolve aliases
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
