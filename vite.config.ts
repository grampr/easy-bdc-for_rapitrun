import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // 開発サーバー設定
  server: {
    port: 5173,
    strictPort: false,
    cors: true,
  },

  // モジュール解決設定
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
});
