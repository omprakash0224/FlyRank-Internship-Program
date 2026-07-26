import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'prisma/**',
        'scripts/**',
        'src/index.js',  // entry point — tested via integration
      ],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
    testTimeout: 10000,
  },
});
