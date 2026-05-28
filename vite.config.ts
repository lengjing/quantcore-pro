import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json';

const DEFAULT_PORT = 5173;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devPort = parseInt(env.VITE_PORT || env.VITE_DEV_PORT || String(DEFAULT_PORT), 10);
  return {
    base: './', // Important for Electron
    server: {
      port: devPort,
      host: '0.0.0.0',
    },
    plugins: [tailwindcss(), react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.VITE_PORT': JSON.stringify(env.VITE_PORT || env.VITE_DEV_PORT || String(DEFAULT_PORT)),
      'process.env.FREE_CLAUDE_PORT': JSON.stringify(env.FREE_CLAUDE_PORT || env.PORT || '8082'),
      '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});
