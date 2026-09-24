import { defineConfig } from 'vitest/config';

export default defineConfig({
  // three.js 本身就約 550 kB(已與主程式分開、延後載入)
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
