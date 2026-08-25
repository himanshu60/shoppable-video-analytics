import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Each file gets its own process so the in-memory DB module state in one
    // suite cannot leak into another.
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
    },
  },
});
