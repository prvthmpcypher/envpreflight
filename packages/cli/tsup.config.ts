import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  splitting: false,
  sourcemap: true,
});
