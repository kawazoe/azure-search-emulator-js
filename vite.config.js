// vite.config.js
import { defineConfig } from 'vite'
import { resolve } from 'path';

import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    dts({ insertTypesEntry: true, skipDiagnostics: false }),
    viteStaticCopy({
      targets: [
        {
          src: 'package.json',
          dest: '.',
        },
        {
          src: 'LICENSE',
          dest: '.',
        },
        {
          src: 'README.md',
          dest: '.',
        },
      ],
    }),
  ],
  build: {
    sourcemap: true,
    minify: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'azure-search-emulator',
      formats: ['es', 'umd'],
      fileName: format => `azure-search-emulator.${format}.js`,
    },
  },
})