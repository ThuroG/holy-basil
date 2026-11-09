import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests never touch the real data/ folder.
    env: {
      HB_DATA_DIR: path.join(os.tmpdir(), `holy-basil-test-${process.pid}`),
      CREW_PIN: '424242',
      DEMO_PAYMENTS: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Everything that runs on the server counts, including the HTTP layer and the views.
      include: ['src/**/*.ts'],
      exclude: ['src/lib/types.ts'],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
});
