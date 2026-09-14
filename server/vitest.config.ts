import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover pure logic (retrieval fusion, chunking, injection scanner,
 * pricing, history trimming, error mapping). Services are instantiated by hand,
 * so no NestJS DI (and therefore no `emitDecoratorMetadata`) is needed here;
 * the eval harness (evals/) boots the real application context instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig `baseUrl` import used across the codebase
      generated: resolve(__dirname, 'generated'),
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: { experimentalDecorators: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'evals/**/*.spec.ts'],
    passWithNoTests: false,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
});
