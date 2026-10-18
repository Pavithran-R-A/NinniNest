import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Node-side regression tests: pure logic only. react-native and
      // expo-file-system are replaced with minimal web-shaped stubs so the
      // native file paths stay out of the test runner.
      'react-native': new URL('./tests/stubs/reactNative.ts', import.meta.url).pathname,
      'expo-file-system': new URL('./tests/stubs/expoFileSystem.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
