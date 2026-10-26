import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Node-side regression tests: pure logic only. react-native and
      // expo-file-system are replaced with minimal web-shaped stubs so the
      // native file paths stay out of the test runner.
      // fileURLToPath keeps the aliases valid on Windows (URL.pathname
      // yields "/C:/..." there, which never resolves).
      'react-native': fileURLToPath(new URL('./tests/stubs/reactNative.ts', import.meta.url)),
      'expo-file-system': fileURLToPath(new URL('./tests/stubs/expoFileSystem.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Analytics bucket events into LOCAL calendar days. Pin the runner to
    // UTC so day-window expectations are identical on every machine
    // (mirrors the UTC environment the expectations were authored in).
    env: {
      TZ: 'UTC',
    },
  },
});
