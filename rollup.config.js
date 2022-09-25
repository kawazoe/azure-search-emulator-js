import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'index.js',
  plugins: [
    terser({
      format: {
        comments: false,
      }
    }),
    copy({
      targets: [
        { src: 'package.json', dest: 'dist' },
        { src: 'README.md', dest: 'dist' },
        { src: 'LICENSE', dest: 'dist' },
      ]
    })
  ],
  output: [
    {
      file: 'dist/azure-search-emulator.es.js',
      format: 'es'
    },
    {
      file: 'dist/azure-search-emulator.js',
      name: 'azureSearchEmulator',
      format: 'umd'
    },
  ]
}