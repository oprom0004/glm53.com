// Run from the project root: node scripts/fixtures/video-rates-preview.mjs
// Uses the installed bundler and the running dev server's CSS. All writes are mocked.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('tsx')] })
);
const result = await build({
  entryPoints: ['scripts/fixtures/video-rates-preview.client.tsx'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [
    {
      name: 'preview-router',
      setup(builder) {
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: 'router',
          namespace: 'preview',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({
          contents:
            'export const useRouter = () => ({push(url){location.assign(url)}});',
        }));
      },
    },
  ],
});
const html = await (await fetch('http://localhost:3000/zh/sign-in')).text();
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
  .map(([tag]) => tag.replace(/href="\//, 'href="http://localhost:3000/'))
  .join('');
const server = createServer((req, res) => {
  if (req.url === '/preview.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(result.outputFiles[0].text);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>视频费率 · 隔离测试预览</title>${styles}</head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>`
  );
});
server.listen(3108, '127.0.0.1', () =>
  console.log('Isolated UI fixture: http://127.0.0.1:3108')
);
