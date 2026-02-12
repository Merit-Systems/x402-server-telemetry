import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    siwx: 'src/siwx.ts',
    builder: 'src/route-builder.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: [
    'next',
    '@clickhouse/client',
    '@x402/core',
    '@x402/next',
    '@x402/extensions',
    'zod',
  ],
});
