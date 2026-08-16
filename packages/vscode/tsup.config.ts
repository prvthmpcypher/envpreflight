import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  external: ['vscode'],
  clean: true,
  splitting: false,
  sourcemap: true,
  outExtension() {
    return {
      js: '.cjs',
    };
  },
});
