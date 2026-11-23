import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = new URL('./notakita-tutorial.txt', import.meta.url);
const walkthroughSource = new URL('./notakita-tutorial-walkthroughs.json', import.meta.url);
const tutorial = '/tutorial/';
const starterPurchasePath = '/tutorial/paket-pembayaran/perpanjang-starter/';
const starterSandboxPath = '/tutorial/paket-pembayaran/uji-pembelian-starter/';
const support = 'https://wa.me/6285179936532?text=Halo%20Carera%20Tech%2C%20saya%20ingin%20bertanya%20tentang%20NotaKita.';
const escape = (value) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const plain = (value) => value.replaceAll('**', '');
const format = (value) => escape(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const link = (href, title, current = false) =>
  `<a href="${escape(href)}"${current ? ' aria-current="page"' : ''}>${escape(title)}</a>`;
const devices = { hp: 'Ponsel', tablet: 'Tablet' };
const isScreenshot = (name) => /^[a-z0-9-]+\.webp$/.test(name);
const groupId = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function readCatalog(input) {
  const categories = [];
  const articles = [];
  const paths = new Set([tutorial]);
  const screenshots = new Map();
  let category;
  let group;

  for (const [index, raw] of input.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const [id, title, ...fields] = line.split('|').map((field) => field.trim());
    if (!title) throw new Error(`Judul tutorial kosong pada baris ${index + 1}`);
    if (id === '@') {
      const [name, alt, tabletName, tabletAlt] = fields;
      if (!isScreenshot(name) || !alt || screenshots.has(title) ||
          (tabletName && (!isScreenshot(tabletName) || !tabletAlt))) {
        throw new Error(`Screenshot tutorial tidak valid pada baris ${index + 1}`);
      }
      screenshots.set(title, {
        hp: { name, alt },
        tablet: tabletName ? { name: tabletName, alt: tabletAlt } : undefined,
      });
      continue;
    }
    if (id === '+') {
      if (!category) throw new Error(`Submenu tanpa kategori pada baris ${index + 1}`);
      group = { id: groupId(title), title, articles: [] };
      category.groups.push(group);
      continue;
    }
    const categoryRow = id.startsWith('#');
    const slug = categoryRow ? id.slice(1) : id;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Slug tutorial tidak valid pada baris ${index + 1}`);
    }
    if (!categoryRow && (!category || !group)) {
      throw new Error(`Artikel tanpa kategori atau submenu pada baris ${index + 1}`);
    }
    const path = categoryRow ? `${tutorial}${slug}/` : `${category.path}${slug}/`;
    if (paths.has(path)) throw new Error(`URL tutorial ganda: ${path}`);
    paths.add(path);
    if (categoryRow) {
      const [description] = fields;
      category = { title, path, description, groups: [] };
      categories.push(category);
      group = undefined;
      continue;
    }
    const [summary, instructions, result, screenshotId, related, tabletInstructions] = fields;
    const steps = instructions?.split(' / ').filter(Boolean);
    const tabletSteps = tabletInstructions?.split(' / ').filter(Boolean);
    if (!summary || !result || !screenshotId || !steps || steps.length < 2 || steps.length > 6 ||
        (tabletSteps && (tabletSteps.length < 2 || tabletSteps.length > 6))) {
      throw new Error(`Artikel tutorial belum lengkap pada baris ${index + 1}`);
    }
    const article = { title, path, category, group: group.title, summary, steps, tabletSteps, result, screenshotId, related };
    group.articles.push(article);
    articles.push(article);
  }
  for (const article of articles) {
    if (!screenshots.has(article.screenshotId)) {
      throw new Error(`Screenshot tidak dikenal: ${article.screenshotId}`);
    }
  }
  return { categories, articles, screenshots };
}

function tutorialSections(categories) {
  const bySlug = new Map(categories.map((category) => [category.path.split('/')[2], category]));
  const select = (slug, ids) => {
    const category = bySlug.get(slug);
    if (!category) throw new Error(`Kategori tutorial tidak dikenal: ${slug}`);
    const groups = ids ? ids.map((id) => {
      const group = category.groups.find((candidate) => candidate.id === id);
      if (!group) throw new Error(`Submenu tutorial tidak dikenal: ${slug} / ${id}`);
      return group;
    }) : category.groups;
    return { category, groups };
  };
  const topic = (slug, { title, ids } = {}) => {
    const { category, groups } = select(slug, ids);
    return {
      title: title ?? category.title,
      path: ids ? `${category.path}#${groups[0].id}` : category.path,
      groups,
      showGroups: true,
    };
  };
  const separate = (slug, ids) => {
    const { category, groups } = select(slug, ids);
    return groups.map((group) => ({
      title: group.title,
      path: `${category.path}#${group.id}`,
      groups: [group],
      showGroups: false,
    }));
  };
  const sections = [
    ['Pendaftaran & Mulai Pakai', separate('mulai-pakai')],
    ['Transaksi', [topic('penjualan'), topic('pembelian')]],
    ['Produk & Kontak', [
      topic('barang-stok', {
        title: 'Data Barang & Jasa',
        ids: ['kelola-barang-jasa', 'kategori-barang', 'satuan-barang', 'harga-dan-satuan'],
      }),
      topic('pelanggan-supplier'),
    ]],
    ['Stok & Titipan', [
      { title: 'Stok awal saat tambah barang', path: `${tutorial}barang-stok/tambah-barang/#stok-awal-hp`, groups: [] },
      ...separate('barang-stok', [
        'perubahan-dan-cek-stok', 'transfer-stok', 'barang-titipan', 'kebijakan-dan-pengingat-stok',
      ]),
    ]],
    ['Mode Kafe', separate('mode-kafe')],
    ['Keuangan', separate('kas-keuangan')],
    ['Laporan', separate('laporan')],
    ['Paket & Pembayaran', separate('paket-pembayaran')],
    ['Pengaturan & Bantuan', [
      topic('cabang-tim-perangkat'),
      topic('pengaturan-bantuan', { title: 'Pengaturan aplikasi & bantuan' }),
    ]],
  ].map(([title, topics]) => ({ title, topics }));
  const articleNavigation = new Map();
  for (const section of sections) {
    for (const topic of section.topics) {
      for (const group of topic.groups) {
        for (const article of group.articles) {
          if (articleNavigation.has(article.path)) throw new Error(`Artikel muncul dua kali di daftar: ${article.path}`);
          articleNavigation.set(article.path, { section: section.title, topic });
        }
      }
    }
  }
  return { sections, articleNavigation };
}

function directory(sections, currentPath) {
  const articleLinks = (group) => group.articles.map((article) =>
    link(article.path, article.title, article.path === currentPath)).join('\n');
  const articleIsCurrent = (group) => group.articles.some((article) => article.path === currentPath);
  return `<nav class="tutorial-directory" id="daftar-tutorial" aria-label="Daftar Tutorial">
    ${link(tutorial, 'Semua Tutorial', currentPath === tutorial)}
    ${sections.map((section, index) => `<section class="tutorial-directory-section" aria-labelledby="daftar-kelompok-${index}">
      <h2 id="daftar-kelompok-${index}">${escape(section.title)}</h2>
      ${section.topics.map((topic) => {
        if (!topic.groups.length) return link(topic.path, topic.title);
        const active = currentPath === topic.path || topic.groups.some(articleIsCurrent);
        return `<details${active ? ' open' : ''}>
        <summary>${escape(topic.title)}</summary>
        ${topic.showGroups ? `${link(topic.path, 'Semua topik', currentPath === topic.path)}
        ${topic.groups.map((group) => `<details${articleIsCurrent(group) ? ' open' : ''}>
          <summary>${escape(group.title)}</summary>
          ${articleLinks(group)}
        </details>`).join('\n')}` : articleLinks(topic.groups[0])}
      </details>`;
      }).join('\n')}
    </section>`).join('\n')}
  </nav>`;
}

function listArticles(group) {
  return `<section class="tutorial-group" id="${group.id}">
    <h2>${escape(group.title)}</h2>
    <ul>${group.articles.map((article) => `<li>${link(article.path, article.title)}</li>`).join('\n')}</ul>
  </section>`;
}

function renderScreenshot({ name, alt }) {
  return `<figure class="tutorial-figure">
      <a href="/assets/tutorial/${name}" aria-label="Buka tangkapan layar dalam ukuran penuh">
        <img src="/assets/tutorial/${name}" alt="${escape(alt)}" loading="lazy" decoding="async">
      </a>
      <figcaption>${escape(alt)} · Data contoh</figcaption>
    </figure>`;
}

function devicePicker() {
  return `<fieldset class="tutorial-devices" aria-label="Tampilan tutorial" hidden>
    ${Object.entries(devices).map(([key, label]) => `<label>
      <input type="radio" name="perangkat" value="${key}"${key === 'hp' ? ' checked' : ''}>
      <span><i class="tutorial-device-icon tutorial-device-icon-${key}" aria-hidden="true"></i>${label}</span>
    </label>`).join('\n')}
  </fieldset>`;
}

function renderWalkthrough(article, guide, { portal, sandbox = false }) {
  const image = (shot) => shot?.image
    ? renderScreenshot({ name: `${shot.image}.webp`, alt: shot.alt })
    : '';
  const links = (items, device) => items?.length
    ? `<ul class="tutorial-step-links">${items.map(({ path, label, step }) =>
      `<li>${link(`${path}?perangkat=${device}${step ? `#${step}-${device}` : ''}`, label)}</li>`
    ).join('')}</ul>`
    : '';
  const stepContent = (step, key) => `
          ${[step.text, step[key]?.text].filter(Boolean).map((value) => `<p>${format(value)}</p>`).join('\n')}
          ${step.workbook ? `<p><a class="tutorial-download" href="/assets/tutorial/${step.workbook}" download>Unduh contoh Excel (.xlsx)</a></p>` : ''}
          ${image(step[key])}
          ${links(step.links, key)}`;
  const portalAction = article.path !== starterPurchasePath ? '' : portal
    ? `<p class="tutorial-related"><a class="button" href="${escape(portal.href)}">Buka Portal Pemilik</a></p>`
    : sandbox
      ? '<p class="tutorial-start">Portal Sandbox belum tersedia.</p>'
      : '<p class="tutorial-start">Portal Pemilik tersedia saat layanan pembayaran dibuka.</p>';
  return `<article class="tutorial-walkthrough">
    <h1>${escape(article.title)}</h1>
    <p class="tutorial-lead">${format(article.summary)}</p>
    ${portalAction}
    ${Object.entries(devices).map(([key, label]) => `<div class="tutorial-device-panel" data-device="${key}">
      <h2 class="tutorial-device-heading">Langkah di ${label}</h2>
      <p class="tutorial-start">${format(guide.start[key])}</p>
      <ol class="tutorial-steps">
        ${guide.steps.filter((step) => !step.onlyOn || step.onlyOn === key).map((step) => `<li>
          <h3${step.id ? ` id="${step.id}-${key}"` : ''}>${escape(step.title)}</h3>
          ${stepContent(step, key)}
          ${step.optional ? `<details class="tutorial-optional">
            <summary>${escape(step.optional.title)}</summary>
            ${stepContent(step.optional, key)}
            ${step.optional.steps?.length ? `<ol class="tutorial-steps">
              ${step.optional.steps.map((item) => `<li>
                <h4>${escape(item.title)}</h4>
                ${stepContent(item, key)}
              </li>`).join('\n')}
            </ol>` : ''}
          </details>` : ''}
        </li>`).join('\n')}
      </ol>
      <h2>Hasilnya</h2>
      <p class="tutorial-result">${format(article.result)}</p>
      ${image(guide.receipt?.[key])}
      ${links(guide.endLinks, key)}
    </div>`).join('\n')}
    ${renderArticleRelated(article)}
  </article>`;
}

function walkthroughSections(guide) {
  return guide.steps.flatMap((step) => step.optional
    ? [step, step.optional, ...(step.optional.steps ?? [])]
    : [step]);
}

function renderItemMasterIndex(article) {
  const groups = article.category.groups.filter(({ id }) => ['kategori-barang', 'satuan-barang'].includes(id));
  const shots = {
    hp: { name: 'tambah-barang-ponsel-isi.webp', alt: 'Kolom Kategori dan Satuan pada form barang di ponsel' },
    tablet: { name: 'tambah-barang-tablet-isi.webp', alt: 'Kolom Kategori dan Satuan pada form barang di tablet' },
  };
  return `<article>
    <h1>${escape(article.title)}</h1>
    <p class="tutorial-lead">${format(article.summary)}</p>
    ${groups.map((group) => `<section class="tutorial-group">
      <h2>${escape(group.title)}</h2>
      <ul>${group.articles.map((item) => `<li>${link(item.path, item.title)}</li>`).join('\n')}</ul>
    </section>`).join('\n')}
    <h2>Letak kolom di form barang</h2>
    ${Object.entries(shots).map(([key, shot]) =>
      `<div data-device="${key}"${key === 'tablet' ? ' hidden' : ''}>${renderScreenshot(shot)}</div>`
    ).join('\n')}
  </article>`;
}

function renderArticleRelated(article) {
  const relatedLinks = {
    plans: [['/panduan/', 'Baca Panduan Paket']],
    starter: [['/panduan/#starter', 'Lihat rincian Starter']],
    expiry: [['/panduan/#masa-aktif', 'Lihat panduan saat masa aktif berakhir']],
    help: [[support, 'Hubungi bantuan lewat WhatsApp']],
    contact: [
      ['/#bantuan', 'Baca pertanyaan umum NotaKita'],
      [support, 'Chat WhatsApp'],
      ['mailto:nandocarera1221@gmail.com', 'Email bantuan'],
    ],
    deletion: [['/privacy/', 'Baca Kebijakan Privasi']],
  };
  return (relatedLinks[article.related] ?? [])
    .map((target) => `<p class="tutorial-related">${link(...target)}</p>`).join('\n');
}

function renderArticle(article, screenshots) {
  if (article.related === 'item-masters') return renderItemMasterIndex(article);
  const shots = screenshots.get(article.screenshotId);
  const renderSteps = (steps) => `<ol class="tutorial-steps">${steps.map((step) => `<li>${format(step)}</li>`).join('\n')}</ol>`;
  return `<article>
    <h1>${escape(article.title)}</h1>
    <p class="tutorial-lead">${format(article.summary)}</p>
    ${article.tabletSteps
      ? `<div data-device="hp">${renderSteps(article.steps)}</div>
         <div data-device="tablet" hidden>${renderSteps(article.tabletSteps)}</div>`
      : renderSteps(article.steps)}
    ${Object.keys(devices).map((key) =>
      `<div data-device="${key}"${key === 'tablet' ? ' hidden' : ''}>${renderScreenshot(shots[key])}</div>`
    ).join('\n')}
    <p class="tutorial-result">${format(article.result)}</p>
    ${renderArticleRelated(article)}
  </article>`;
}

function renderPage({ title, description, breadcrumb, currentPath, sections, content, sandbox = false }) {
  return `<!doctype html>
<html lang="id" class="notakita">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0d1516">
  <meta name="description" content="${escape(plain(description))}">
  ${sandbox ? '<meta name="robots" content="noindex">' : ''}
  <title>${escape(title)}</title>
  <!-- canonical -->
  <link rel="icon" href="/assets/app-icon.webp">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="stylesheet" href="/assets/product-site.css">
  <link rel="stylesheet" href="/tutorial/style.css">
  <script type="module" src="/tutorial/tutorial.js"></script>
</head>
<body>
<a class="skip" href="#utama">Lewati ke konten</a>
<header class="site-header">
  <nav class="container site-nav" aria-label="Navigasi utama">
    <a class="brand" href="/"><img src="/assets/logo.svg" width="139" height="28" alt="NotaKita"></a>
    <div class="nav-links">
      <a href="/#fitur">Fitur</a>
      <a href="/#paket">Paket</a>
      <a href="/tutorial/" aria-current="page">Tutorial</a>
      <a href="/#bantuan">Bantuan</a>
    </div>
    <!-- catalog-nav -->
  </nav>
</header>
<div class="container tutorial-layout">
  <aside class="tutorial-sidebar">
    ${devicePicker()}
    <button class="tutorial-toggle" type="button" aria-controls="daftar-tutorial" aria-expanded="false" hidden>Daftar Tutorial</button>
    ${directory(sections, currentPath)}
  </aside>
  <main id="utama" class="tutorial-content" tabindex="-1">
    <section class="tutorial-search" aria-label="Pencarian tutorial" hidden>
      <label for="cari-tutorial">Cari tutorial</label>
      <div class="tutorial-search-field">
        <span class="tutorial-search-icon" aria-hidden="true"></span>
        <input id="cari-tutorial" type="search" placeholder="Misalnya cetak nota atau stok habis"
          autocomplete="off" enterkeyhint="search" aria-controls="hasil-tutorial">
        <button class="tutorial-search-clear" type="button" aria-label="Hapus kata pencarian" hidden>×</button>
      </div>
      <div class="tutorial-search-results" id="hasil-tutorial" hidden>
        <p role="status"></p>
        <ul aria-label="Hasil pencarian tutorial"></ul>
        <button class="tutorial-search-more" type="button" hidden>Lihat semua hasil</button>
      </div>
    </section>
    ${breadcrumb ? `<nav class="tutorial-breadcrumb" aria-label="Jejak navigasi">${breadcrumb}</nav>` : ''}
    ${content}
  </main>
</div>
<footer class="site-footer"><div class="container footer-links">
  <a href="/">NotaKita</a>
  <a href="/panduan/">Panduan Paket</a>
  <a href="/privacy/">Kebijakan Privasi</a>
  <a href="/terms/">Ketentuan Pembelian</a>
</div></footer>
<script>
  const toggle = document.querySelector('.tutorial-toggle');
  const topics = document.getElementById('daftar-tutorial');
  const narrow = matchMedia('(max-width: 760px)');
  function showTopics(open) {
    topics.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  function syncTopics() {
    toggle.hidden = !narrow.matches;
    showTopics(!narrow.matches);
  }
  syncTopics();
  narrow.addEventListener('change', syncTopics);
  toggle.addEventListener('click', () => showTopics(topics.hidden));
  toggle.parentElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && narrow.matches && !topics.hidden) {
      showTopics(false);
      toggle.focus();
    }
  });
</script>
</body>
</html>
`;
}

export async function buildNotakitaTutorial(output, { portal, stagingPortal } = {}) {
  const { categories, articles, screenshots } = readCatalog(await readFile(source, 'utf8'));
  const { sections, articleNavigation } = tutorialSections(categories);
  const walkthroughs = JSON.parse(await readFile(walkthroughSource, 'utf8'));
  const articlePaths = new Set(articles.map((article) => article.path));
  for (const article of articles) {
    if (!articleNavigation.has(article.path)) throw new Error(`Artikel belum masuk daftar: ${article.path}`);
    if (!walkthroughs[article.path] && !screenshots.get(article.screenshotId).tablet) {
      throw new Error(`Tambahkan tangkapan layar tablet untuk ${article.path}`);
    }
  }
  const assetNames = new Set([...screenshots.values()].flatMap((shots) =>
    Object.values(shots).filter(Boolean).map(({ name }) => name)));
  for (const [path, guide] of Object.entries(walkthroughs)) {
    if (!articlePaths.has(path)) {
      throw new Error(`Artikel tutorial tidak dikenal: ${path}`);
    }
    const ids = guide.steps.flatMap((step) => step.id ? [step.id] : []);
    if (ids.some((id) => !/^[a-z0-9-]+$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error(`ID langkah tutorial tidak valid: ${path}`);
    }
    const sections = walkthroughSections(guide);
    for (const step of guide.steps.filter((step) => step.onlyOn)) {
      if (!Object.hasOwn(devices, step.onlyOn) || !step[step.onlyOn]?.image) {
        throw new Error(`Langkah khusus perangkat tidak valid: ${path}`);
      }
    }
    for (const step of sections.filter((step) => step.workbook)) {
      if (!/^[a-z0-9-]+\.xlsx$/.test(step.workbook)) {
        throw new Error(`File contoh Excel tidak valid: ${path}`);
      }
      assetNames.add(step.workbook);
    }
    for (const related of [...sections.flatMap((step) => step.links ?? []), ...(guide.endLinks ?? [])]) {
      if (!related.label || !articlePaths.has(related.path) ||
          (related.step && !walkthroughs[related.path]?.steps.some((step) => step.id === related.step && !step.onlyOn))) {
        throw new Error(`Tautan panduan tidak valid: ${path} ke ${related.path}`);
      }
    }
    for (const key of Object.keys(devices)) {
      const shots = [...sections.map((step) => step[key]), guide.receipt?.[key]]
        .filter((shot) => shot?.image);
      if (shots.length === 0) {
        throw new Error(`Tambahkan tangkapan layar ${devices[key].toLowerCase()} untuk ${path}`);
      }
      for (const shot of shots) {
        if (!/^[a-z0-9-]+$/.test(shot.image) || !shot.alt) {
          throw new Error(`Tangkapan layar tutorial tidak valid: ${path}`);
        }
        assetNames.add(`${shot.image}.webp`);
      }
    }
  }
  await Promise.all([...assetNames].map((name) => readFile(join(output, 'assets/tutorial', name))));
  const searchIndex = articles.map(({ title, path, category, group, summary, steps, tabletSteps, result }) => {
    const guide = walkthroughs[path];
    const instructions = guide ? [
      ...Object.values(guide.start),
      ...walkthroughSections(guide).flatMap((step) => [step.title, step.text, step.hp?.text, step.tablet?.text]),
      ...(guide.searchTerms ?? []),
    ] : [...steps, ...(tabletSteps ?? [])];
    const { section, topic } = articleNavigation.get(path);
    return {
      title, path, category: category.title, group, section, topic: topic.title, summary: plain(summary),
      text: plain([...instructions, result].filter(Boolean).join(' ')),
    };
  });
  await writeFile(join(output, 'tutorial', 'index.json'), JSON.stringify(searchIndex));
  const intro = 'Panduan langkah demi langkah untuk menyiapkan usaha, memakai kasir, dan membaca laporan di NotaKita.';
  const pages = [{
    currentPath: tutorial,
    title: 'Tutorial NotaKita',
    description: intro,
    content: `<h1>Tutorial NotaKita</h1><p class="tutorial-lead">${intro}</p>
      <div class="tutorial-index">${sections.map((section) => `<section class="tutorial-index-section">
        <h2>${escape(section.title)}</h2>
        <ul class="tutorial-categories">${section.topics.map((topic) => `<li>${link(topic.path, topic.title)}</li>`).join('\n')}</ul>
      </section>`).join('\n')}</div>
      <p class="tutorial-related"><a href="/panduan/">Buka Panduan Paket</a></p>`,
  }];
  for (const category of categories) {
    pages.push({
      currentPath: category.path,
      title: `${category.title} · Tutorial NotaKita`,
      description: category.description,
      breadcrumb: link(tutorial, 'Tutorial'),
      content: `<h1>${escape(category.title)}</h1><p class="tutorial-lead">${escape(category.description)}</p>
        ${category.groups.map((group) => listArticles(group)).join('\n')}`,
    });
  }
  for (const article of articles) {
    const { section, topic } = articleNavigation.get(article.path);
    pages.push({
      currentPath: article.path,
      title: `${article.title} · Tutorial NotaKita`,
      description: article.summary,
      breadcrumb: `${link(tutorial, 'Tutorial')} / ${escape(section)} / ${link(topic.path, topic.title)}`,
      content: walkthroughs[article.path]
        ? renderWalkthrough(article, walkthroughs[article.path], { portal })
        : renderArticle(article, screenshots),
    });
    if (article.path === starterPurchasePath) {
      const sandboxArticle = {
        ...article,
        title: 'Uji pembelian Starter',
        summary: 'Gunakan akun Pemilik Staging. Pembayaran uji memakai Midtrans Sandbox.',
      };
      pages.push({
        currentPath: starterSandboxPath,
        title: `${sandboxArticle.title} · Tutorial NotaKita`,
        description: sandboxArticle.summary,
        sandbox: true,
        content: renderWalkthrough(sandboxArticle, walkthroughs[article.path], {
          portal: stagingPortal,
          sandbox: true,
        }),
      });
    }
  }

  await Promise.all(pages.map(async (page) => {
    const folder = join(output, page.currentPath);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'index.html'), renderPage({ ...page, sections }));
  }));
}
