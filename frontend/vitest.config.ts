import { defineConfig } from 'vitest/config';

// Unit tests only (pure modules). Component/browser testing is not set up in this repo.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
    },
});
