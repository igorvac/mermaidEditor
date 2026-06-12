/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4096
  },
  server: {
    port: 5180,
    strictPort: true
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
