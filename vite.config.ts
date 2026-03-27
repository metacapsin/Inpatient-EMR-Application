import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'react-icons/fa': path.resolve(__dirname, './src/lib/fa-icons.ts'),
            'react-icons/fa6': path.resolve(__dirname, './src/lib/fa6-icons.ts'),
            'react-icons-fa-real': path.resolve(__dirname, 'node_modules/react-icons/fa'),
            'react-icons-fa6-real': path.resolve(__dirname, 'node_modules/react-icons/fa6'),
        },
    },
});
