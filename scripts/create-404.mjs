import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  throw new Error('dist/index.html not found. Run vite build first.');
}

copyFileSync('dist/index.html', 'dist/404.html');
console.log('GitHub Pages SPA fallback created: dist/404.html');
