(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function measureHeader() {
    document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
  }

  measureHeader();
  if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);

  const nav = header.querySelector('.site-nav');
  const links = nav.querySelector('.nav-links');
  const catalog = nav.querySelector('.catalog-nav');
  const narrow = matchMedia('(max-width: 46rem)');
  const menu = document.createElement('button');
  menu.className = 'site-menu-toggle';
  menu.type = 'button';
  menu.hidden = true;
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', 'menu-situs');
  menu.innerHTML = '<span class="site-menu-icon" aria-hidden="true"></span> Menu';

  const drawer = document.createElement('dialog');
  if (typeof drawer.showModal !== 'function') return;
  drawer.id = 'menu-situs';
  drawer.className = 'site-drawer';
  drawer.setAttribute('aria-labelledby', 'judul-menu-situs');
  drawer.innerHTML = `<div class="site-drawer-heading">
    <h2 id="judul-menu-situs">Menu situs</h2>
    <button class="site-drawer-close" type="button" autofocus><span aria-hidden="true">×</span> Tutup</button>
  </div>
  <nav aria-label="Navigasi utama"></nav>`;
  const drawerNav = drawer.querySelector('nav');
  nav.append(menu);
  header.append(drawer);
  nav.classList.add('site-nav-ready');

  function resetDrawer() {
    drawer.classList.remove('is-closing');
    menu.setAttribute('aria-expanded', 'false');
  }

  function finishClose() {
    drawer.close();
    resetDrawer();
  }

  function arrangeLinks() {
    if (narrow.matches) {
      drawerNav.append(links);
      menu.hidden = false;
    } else {
      if (drawer.open) finishClose();
      nav.insertBefore(links, catalog ?? menu);
      menu.hidden = true;
    }
    measureHeader();
  }

  async function closeDrawer() {
    if (!drawer.open || drawer.classList.contains('is-closing')) return;
    drawer.classList.add('is-closing');
    const animations = drawer.getAnimations?.() ?? [];
    if (animations.length) await Promise.allSettled(animations.map(animation => animation.finished));
    if (drawer.open && drawer.classList.contains('is-closing')) finishClose();
  }

  menu.addEventListener('click', () => {
    drawer.showModal();
    menu.setAttribute('aria-expanded', 'true');
  });
  drawer.querySelector('.site-drawer-close').addEventListener('click', closeDrawer);
  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeDrawer();
  });
  drawer.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDrawer();
  });
  drawer.addEventListener('close', () => {
    if (!drawer.open) resetDrawer();
  });
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer && event.clientX < drawer.getBoundingClientRect().left) closeDrawer();
  });
  links.addEventListener('click', (event) => {
    if (drawer.open && event.target.closest('a')) closeDrawer();
  });
  narrow.addEventListener('change', arrangeLinks);
  arrangeLinks();
})();
