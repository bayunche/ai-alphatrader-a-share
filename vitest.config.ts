/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    define: {
        'import.meta.env': {
            VITE_API_BASE: 'http://mock-api',
            VITE_FORCE_BACKEND: 'false'
        }
    },
    test: {
        globals: true,
        environment: 'node',
        setupFiles: './src/setupTests.ts',
        css: false,
    },
});
