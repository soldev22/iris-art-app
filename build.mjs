// Bundles src/ into ONE self-contained HTML file (React and all code inlined) that works offline.
// Usage: npm install && npm run build   ->  dist/iris-studio.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const css = readFileSync('src/styles.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap">';

async function once() {
  const r = await build({
    entryPoints: ['src/main.jsx'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
    define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') }, jsx: 'automatic', legalComments: 'none',
  });
  const js = r.outputFiles[0].text;
  // Optional web fonts load when online; offline the page falls back to system fonts.
  const body = `<title>Iris Studio</title>\n${fonts}\n<style>\n${css}\n</style>\n<div id="root"></div>\n<script>\n${js}\n</script>\n`;
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/artifact.html', body);
  writeFileSync('dist/iris-studio.html',
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${body}</body></html>\n`);
  writeFileSync('dist/index.html', readFileSync('dist/iris-studio.html', 'utf8'));
  console.log('Built dist/iris-studio.html and dist/index.html', Math.round(js.length / 1024) + ' KB of script');
}
await once();
