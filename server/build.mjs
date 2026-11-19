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
  // CommonJS dependencies (sanitize-html → postcss) call require('path') etc.: give the ESM bundle a real require.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'info',
})
