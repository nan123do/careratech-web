import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNotakitaTutorial } from './notakita-tutorial.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const sites = { careratech: 4173, notaku: 4174, notakita: 4175 };
const mode = process.argv[2];
const production = mode === '--production';

const optionalProductSites = [
  { id: 'serviskita', port: 4176, title: 'ServisKita', icon: 'serviskita-icon.webp', mascot: 'serviskita-cek-kilometer.webp', hero: 'maskot-kilometer.webp' },
  { id: 'receipt_keeper', port: 4177, title: 'Receipt Keeper', icon: 'receipt_keeper-icon.webp', mascot: 'receipt-keeper-foto-struk.webp', hero: 'maskot-struk.webp' },
];

for (const { id, port } of optionalProductSites) {
  if (!production || process.env[`${id.toUpperCase()}_URL`]) sites[id] = port;
}

if (process.argv.length > 3 || (mode && mode !== '--production' && mode !== '--serve')) {
  throw new Error('Gunakan node scripts/build.mjs [--production|--serve]');
}

function httpsUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} harus berisi URL HTTPS yang valid.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} harus berupa URL HTTPS tanpa kredensial, query, atau fragmen.`);
  }
  return url;
}

function siteOrigin(site, port) {
  if (!production) return `http://127.0.0.1:${port}`;
  const name = `${site.toUpperCase()}_URL`;
  const url = httpsUrl(process.env[name], name);
  if (url.pathname !== '/') throw new Error(`${name} harus berupa origin tanpa path.`);
  return url.origin;
}

function portalUrl() {
  const value = process.env.NOTAKITA_PORTAL_URL;
  if (!production || !value) return null;
  const url = httpsUrl(value, 'NOTAKITA_PORTAL_URL');
  if (!/^\/langganan\/?$/.test(url.pathname)) {
    throw new Error('NOTAKITA_PORTAL_URL harus mengarah ke /langganan.');
  }
  return url;
}

const origins = Object.fromEntries(
  Object.entries(sites).map(([site, port]) => [site, siteOrigin(site, port)]),
);

if (new Set(Object.values(origins)).size !== Object.keys(sites).length) {
  throw new Error('Setiap situs membutuhkan origin yang berbeda.');
}
const portal = portalUrl();
const linkToPortal = portal
  ? `<div class="actions"><a class="button" href="${portal.href}">Kelola langganan</a></div>`
  : '';
const linkToAccountDeletion = portal
  ? `<p>Anda juga bisa <a href="${new URL('/hapus-akun', portal).href}">mengajukan penghapusan akun lewat browser</a> dengan verifikasi email.</p>`
  : '';

const showcaseScript = await readFile(resolve(root, 'scripts/showcase.js'), 'utf8');

async function preparePages(site, output) {
  const files = await readdir(output, { recursive: true, withFileTypes: true });
  const pageUrls = [];
  for (const file of files) {
    if (!file.isFile() || file.name !== 'index.html') continue;
    const path = resolve(file.parentPath, file.name);
    const page = relative(output, file.parentPath).split(sep).join('/');
    const route = page.split('/').map(encodeURIComponent).join('/');
    const canonicalUrl = new URL(route ? `/${route}/` : '/', origins[site]);
    pageUrls.push(canonicalUrl.href);
    const canonical = production ? `<link rel="canonical" href="${canonicalUrl.href}">` : '';
    const html = await readFile(path, 'utf8');
    const rendered = html
      .replace('<!-- canonical -->', canonical)
      .replace('<!-- showcase-script -->', () => '<script>' + showcaseScript + '</script>')
      .replace('<!-- portal-link -->', linkToPortal)
      .replace('<!-- account-deletion-link -->', linkToAccountDeletion)
      .replace(/<!-- product-site-link: (serviskita|receipt_keeper) -->/g, (_, id) => {
        const origin = origins[id];
        const product = optionalProductSites.find(entry => entry.id === id);
        return origin ? `<a class="utility-link" href="${origin}/">Website ${product.title}</a>` : '';
      })
      .replaceAll(/\{\{(careratech|notaku|notakita)\}\}/g, (_, target) => `${origins[target]}/`);
    await writeFile(path, rendered);
  }

  if (production) {
    const sitemapUrl = new URL('/sitemap.xml', origins[site]);
    const entries = pageUrls.sort().map((url) => `  <url><loc>${url}</loc></url>`);
    await writeFile(resolve(output, 'sitemap.xml'), [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n'));
    await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl.href}\n`);
  }
}

for (const site of Object.keys(sites)) {
  const output = resolve(dist, site);
  await rm(output, { recursive: true, force: true });
  await cp(resolve(root, site), output, {
    recursive: true,
    filter: (path) => !basename(path).startsWith('.'),
  });
  await mkdir(resolve(output, 'assets'), { recursive: true });
  await cp(resolve(root, 'shared/site.css'), resolve(output, 'assets/site.css'));
  if (site !== 'careratech') {
    await cp(resolve(root, 'shared/product-site.css'), resolve(output, 'assets/product-site.css'));
  }
  const product = optionalProductSites.find(entry => entry.id === site);
  if (site === 'notakita' || product) {
    await cp(resolve(root, 'shared/guide.css'), resolve(output, 'assets/guide.css'));
  }
  if (product) {
    const catalogAssets = resolve(root, 'careratech/assets');
    await cp(resolve(catalogAssets, product.icon), resolve(output, 'assets/app-icon.webp'));
    await cp(resolve(catalogAssets, product.mascot), resolve(output, 'assets', product.hero));
    await cp(resolve(catalogAssets, 'google-play-id.webp'), resolve(output, 'assets/google-play-id.webp'));
  }
  if (site === 'notakita') {
    await buildNotakitaTutorial(output);
    await cp(resolve(root, 'careratech/assets/notakita-full.webp'), resolve(output, 'assets/app-icon.webp'));
    await cp(resolve(root, 'careratech/assets/notakita-kelola-cabang.webp'), resolve(output, 'assets/maskot-cabang.webp'));
    await cp(resolve(root, 'notaku/assets/fitur-icons.webp'), resolve(output, 'assets/fitur-icons.webp'));
  }
  if (site === 'careratech') {
    await cp(resolve(root, 'notakita/assets/beranda-tablet.webp'), resolve(output, 'assets/notakita-tablet.webp'));
    await cp(resolve(root, 'notaku/assets/app-icon.webp'), resolve(output, 'assets/app-icon.webp'));
  }
  if (site === 'notaku') {
    await cp(resolve(root, 'careratech/assets/notakita-full.webp'), resolve(output, 'assets/notakita-logo.webp'));
    await cp(resolve(root, 'notakita/assets/beranda-tablet.webp'), resolve(output, 'assets/notakita-tablet.webp'));
  }
  await cp(resolve(root, 'shared/404.html'), resolve(output, '404.html'));
  await preparePages(site, output);
  console.log(`dist/${site}`);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function startPreview(site, port) {
  const base = resolve(dist, site);
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const path = decodeURIComponent(new URL(request.url, origins[site]).pathname);
      const file = resolve(base, `.${path.endsWith('/') ? path + 'index.html' : path}`);
      const type = contentTypes[extname(file)];
      if (!file.startsWith(base + sep) || !type) throw new Error('Path tidak tersedia');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404, { 'Content-Type': contentTypes['.html'] });
      response.end(request.method === 'HEAD' ? undefined : await readFile(resolve(base, '404.html')));
    }
  });

  server.listen(port, "127.0.0.1", () => console.log(`${site}: ${origins[site]}/`));
}

if (mode === '--serve') {
  for (const [site, port] of Object.entries(sites)) startPreview(site, port);
}
