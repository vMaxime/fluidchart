import { build } from 'esbuild'

// One self-contained file for production (bundles @chart/shared and Hono).
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
})
