const commonWords = new Set([
  'bagaimana', 'cara', 'dari', 'di', 'gimana', 'ke', 'untuk', 'yang',
]);

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\brp(?=\d)/g, 'rp ')
    .replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, (amount) => amount.replace(/[.,]/g, ''))
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const searchAliases = [
  [/\b(?:print|ngeprint|mencetak)\b/g, 'cetak'],
  [/\b(?:struk|bon)\b/g, 'nota'],
  [/\b(?:utang)\b/g, 'hutang'],
  [/\b(?:bayar cash|cash)\b/g, 'tunai'],
  [/\bdp\b/g, 'uang muka'],
  [/\bstok (?:habis|sedikit|menipis)\b/g, 'pengingat stok'],
  [/\b(?:inventory|stok opname)\b/g, 'cek stok fisik'],
  [/\bmultisatuan\b/g, 'multi satuan'],
  [/\bmultiharga\b/g, 'multi harga'],
  [/\b(?:pelunasan|melunasi)\b/g, 'lunasi'],
];

function translateQuery(query) {
  for (const [alias, replacement] of searchAliases) {
    query = query.replace(alias, replacement);
  }
  return query;
}

export function prepareIndex(entries) {
  return entries.map((entry) => {
    const title = normalize(entry.title);
    const section = normalize([entry.section, entry.topic, entry.category, entry.group].filter(Boolean).join(' '));
    const body = normalize(`${entry.summary} ${entry.text}`);
    return {
      ...entry,
      title,
      label: entry.title,
      titleWords: title.split(' '),
      sectionWords: section.split(' '),
      bodyWords: body.split(' '),
    };
  });
}

export function findTutorials(index, input) {
  const normalized = translateQuery(normalize(input));
  const terms = [...new Set(normalized.split(' ').filter((term) => term && !commonWords.has(term)))];
  if (!terms.length) return [];

  const phrase = terms.join(' ');
  const matches = [];
  for (const entry of index) {
    let score = 0;
    for (const term of terms) {
      if (entry.titleWords.includes(term)) score += 13;
      else if (entry.titleWords.some((word) => word.startsWith(term))) score += 9;
      else if (entry.sectionWords.some((word) => word.startsWith(term))) score += 4;
      else if (entry.bodyWords.some((word) => word.startsWith(term))) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (!score) continue;
    if (entry.title === phrase) score += 36;
    else if (entry.title.startsWith(phrase)) score += 24;
    else if (entry.title.includes(phrase)) score += 16;
    matches.push({ entry, score });
  }

  return matches.sort((left, right) => right.score - left.score
    || left.entry.label.localeCompare(right.entry.label, 'id')).map(({ entry }) => entry);
}

function activateSearch(search, tutorialHref) {
  const field = search.querySelector('input');
  const clear = search.querySelector('.tutorial-search-clear');
  const results = search.querySelector('.tutorial-search-results');
  const list = results.querySelector('ul');
  const status = results.querySelector('[role="status"]');
  const more = search.querySelector('.tutorial-search-more');
  const initialLimit = 6;
  let index;
  let request;
  let showAll = false;
  let updateId = 0;

  async function update() {
    const id = ++updateId;
    const query = field.value.trim();
    clear.hidden = !field.value;
    results.hidden = !query;
    list.replaceChildren();
    more.hidden = true;
    if (!query) return;

    if (!index) {
      status.textContent = 'Memuat daftar tutorial…';
      try {
        request ??= fetch('/tutorial/index.json').then(async (response) => {
          if (!response.ok) throw new Error('Indeks tutorial gagal dimuat.');
          return prepareIndex(await response.json());
        });
        index = await request;
      } catch {
        request = undefined;
        if (!results.hidden && id === updateId) {
          status.textContent = 'Pencarian belum bisa dimuat. Coba ketik ulang atau buka Daftar Tutorial.';
        }
        return;
      }
      if (results.hidden || id !== updateId) return;
    }

    const matches = findTutorials(index, query);
    if (!matches.length) {
      status.textContent = 'Tidak ada hasil. Coba nama fitur atau kata yang lebih pendek.';
      return;
    }

    const visible = showAll ? matches : matches.slice(0, initialLimit);
    status.textContent = visible.length === matches.length
      ? `${matches.length} tutorial ditemukan`
      : `Menampilkan ${visible.length} dari ${matches.length} tutorial`;
    more.hidden = visible.length === matches.length;
    for (const hit of visible) {
      const row = document.createElement('li');
      const action = document.createElement('a');
      action.href = tutorialHref(hit.path);
      const title = document.createElement('strong');
      title.textContent = hit.label;
      const category = document.createElement('small');
      category.textContent = [...new Set([hit.section, hit.topic ?? hit.category, hit.group].filter(Boolean))].join(' · ');
      const snippet = document.createElement('span');
      snippet.textContent = hit.summary;
      action.append(title, category, snippet);
      row.append(action);
      list.append(row);
    }
  }

  field.addEventListener('input', () => {
    showAll = false;
    update();
  });
  field.addEventListener('focus', () => {
    if (field.value.trim() && results.hidden) update();
  });
  clear.addEventListener('click', () => {
    field.value = '';
    field.focus();
    update();
  });
  more.addEventListener('click', async () => {
    showAll = true;
    await update();
    if (showAll) list.querySelectorAll('a')[initialLimit]?.focus();
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !results.hidden) {
      event.preventDefault();
      field.focus();
      results.hidden = true;
    }
    if (event.target !== field || results.hidden || event.isComposing) return;
    if (event.key === 'ArrowDown') {
      const first = list.querySelector('a');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'Enter') list.querySelector('a')?.click();
  });

  search.hidden = false;
  return () => {
    field.value = '';
    showAll = false;
    update();
  };
}

function activateDevices(picker) {
  const options = [...picker.querySelectorAll('input')];
  let previous;
  try {
    previous = localStorage.getItem('nota-tutorial-device')
      ?? sessionStorage.getItem('nota-tutorial-device');
  } catch {
    // Device selection remains available without browser storage.
  }
  let selected = options.find((item) => item.value === previous)?.value ?? options[0].value;

  function deviceHash(hash) {
    return hash.replace(/-(hp|tablet)$/, `-${selected}`);
  }

  function tutorialHref(href) {
    const target = new URL(href, location.href);
    if (target.origin !== location.origin || !target.pathname.startsWith('/tutorial/')) return href;
    target.searchParams.set('perangkat', selected);
    if (/-(hp|tablet)$/.test(target.hash)) {
      target.hash = deviceHash(target.hash);
    }
    return target.pathname + target.search + target.hash;
  }

  function show(device) {
    selected = device;
    for (const option of options) option.checked = option.value === selected;
    for (const panel of document.querySelectorAll('main [data-device]')) {
      panel.hidden = panel.dataset.device !== device;
      const heading = panel.querySelector('.tutorial-device-heading');
      if (heading) heading.hidden = true;
    }
    for (const anchor of document.querySelectorAll('a[href^="/tutorial/"]')) {
      anchor.setAttribute('href', tutorialHref(anchor.getAttribute('href')));
    }
  }

  function sync() {
    const parameter = new URL(location.href).searchParams.get('perangkat');
    show(options.find((item) => item.value === parameter)?.value ?? selected);
  }

  picker.hidden = false;
  sync();
  picker.addEventListener('change', (event) => {
    const device = event.target.value;
    show(device);
    const url = new URL(location.href);
    url.searchParams.set('perangkat', device);
    if (/-(hp|tablet)$/.test(url.hash)) url.hash = deviceHash(url.hash);
    history.replaceState(history.state, '', url);
    if (/-(hp|tablet)$/.test(url.hash)) scrollToTutorialTarget(url.hash);
    try {
      localStorage.setItem('nota-tutorial-device', device);
    } catch {
      // The URL already carries the selected device.
    }
  });
  return { tutorialHref, deviceHash, sync };
}

function scrollToTutorialTarget(hash) {
  const target = document.getElementById(hash.slice(1));
  if (target) target.scrollIntoView({ behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
}

function activateNavigation(devices, resetSearch) {
  const main = document.getElementById('utama');
  const search = main.querySelector('.tutorial-search');
  const sidebar = document.querySelector('.tutorial-sidebar');
  const directory = document.getElementById('daftar-tutorial');
  const toggle = sidebar.querySelector('.tutorial-toggle');
  const activeSelector = 'a[aria-current="page"]';
  let displayedPath = location.pathname;
  let pending;

  function revealActiveLink() {
    const active = directory.querySelector(activeSelector);
    if (!active || directory.hidden) return;
    const scroller = toggle.hidden ? sidebar : directory;
    const top = scroller.getBoundingClientRect().top + scroller.clientTop;
    const bottom = top + scroller.clientHeight;
    const bounds = active.getBoundingClientRect();
    if (bounds.top < top) scroller.scrollTop += bounds.top - top;
    else if (bounds.bottom > bottom) scroller.scrollTop += bounds.bottom - bottom;
  }

  function updateActiveLink(page) {
    const href = page.querySelector(`#daftar-tutorial ${activeSelector}`)?.getAttribute('href');
    const active = [...directory.querySelectorAll('a')].find((link) => {
      const url = new URL(link.href);
      return url.pathname + url.hash === href;
    });
    directory.querySelector(activeSelector)?.removeAttribute('aria-current');
    if (!active) return;
    active.setAttribute('aria-current', 'page');
    for (const group of directory.querySelectorAll('details')) {
      if (group.contains(active)) group.open = true;
    }
  }

  function focusArticle(target) {
    if (!toggle.hidden && !directory.hidden) toggle.click();
    main.focus({ preventScroll: true });
    scrollToTutorialTarget(devices.deviceHash(target.hash));
    revealActiveLink();
  }

  async function navigate(target, fromHistory = false) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    main.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(target, { signal: request.signal });
      if (!response.ok) throw new Error('Tutorial gagal dimuat.');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextMain = page.querySelector('#utama.tutorial-content');
      const nextSearch = nextMain?.querySelector('.tutorial-search');
      if (!nextSearch) throw new Error('Halaman tutorial tidak lengkap.');
      if (request.signal.aborted) return;

      if (!fromHistory) history.pushState(null, '', devices.tutorialHref(target));
      displayedPath = target.pathname;
      document.title = page.title;
      for (const [selector, attribute] of [['meta[name="description"]', 'content'], ['link[rel="canonical"]', 'href']]) {
        const value = page.querySelector(selector)?.getAttribute(attribute);
        if (value) document.querySelector(selector)?.setAttribute(attribute, value);
      }
      nextSearch.remove();
      main.replaceChildren(search, ...nextMain.children);
      resetSearch();
      updateActiveLink(page);
      devices.sync();
      focusArticle(target);
    } catch {
      if (request.signal.aborted) return;
      if (fromHistory) location.reload();
      else location.assign(target);
    } finally {
      if (pending === request) {
        pending = undefined;
        main.removeAttribute('aria-busy');
      }
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/tutorial/"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey
      || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const target = new URL(link.href);
    if (target.origin !== location.origin || !target.pathname.startsWith('/tutorial/')) return;
    event.preventDefault();
    if (target.pathname === displayedPath && target.pathname === location.pathname) {
      pending?.abort();
      if (target.href !== location.href) history.pushState(null, '', target);
      resetSearch();
      devices.sync();
      focusArticle(target);
      return;
    }
    navigate(target);
  });
  window.addEventListener('popstate', () => {
    if (location.pathname !== displayedPath) navigate(new URL(location.href), true);
    else {
      pending?.abort();
      devices.sync();
    }
  });
  toggle.addEventListener('click', revealActiveLink);
  if (/-(hp|tablet)$/.test(location.hash)) {
    requestAnimationFrame(() => scrollToTutorialTarget(devices.deviceHash(location.hash)));
  }
  revealActiveLink();
}

if (typeof document !== 'undefined') {
  const devices = activateDevices(document.querySelector('.tutorial-devices'));
  const resetSearch = activateSearch(document.querySelector('.tutorial-search'), devices.tutorialHref);
  activateNavigation(devices, resetSearch);
}
