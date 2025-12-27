import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // Core package - use its own vitest config
      './core',

      // Web-app package - use its own vitest config
      './web-app',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'docs/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        'src-tauri/**',
        'e2e/**',
        'autoqa/**',
        '**/*.d.ts',
        '**/vitest.config.ts',
        '**/rolldown.config.mjs',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
    // Global test settings
    globals: true,
    passWithNoTests: true,
  },
})
