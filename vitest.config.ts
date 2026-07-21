import { defineConfig } from 'vitest/config';

// DB-layer and pure-logic tests run in a plain Node environment against
// better-sqlite3 (in-memory) — no React Native / jsdom environment is
// needed for Phase 1's test scope. Do not add `watch: true` as the default;
// `npx vitest run` is the standard one-shot command.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.expo/**'],
    watch: false,
  },
});
