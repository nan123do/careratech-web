(() => {
  const hero = document.querySelector('#showcase');
  const selector = hero.querySelector('.selector');
  const stage = hero.querySelector('.stage');
  const image = stage.querySelector('img');
  const entries = Array.from(document.querySelectorAll('[data-cover]'));
  const order = entry => Number(entry.dataset.showcaseOrder ?? Infinity);
  entries.sort((a, b) => order(a) - order(b));
  const slides = entries.map(entry => ({
    entry,
    name: entry.querySelector('.identity h3, strong').textContent,
    category: entry.querySelector('.identity p, h2').textContent,
    icon: entry.dataset.icon || entry.querySelector('.identity img')?.getAttribute('src'),
    link: entry.querySelector('.entry-links .button, .utility-link'),
  }));
  if (!slides.length) return;

  let current = 0;
  const buttons = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = slide.name;
    button.addEventListener('click', () => show(index));
    selector.append(button);
    return button;
  });

  // Each field has one shared grid cell. Inactive variants reserve their
  // natural size at the current width, including when the user zooms in.
  const copy = hero.querySelector('.slide-copy');
  const fields = Array.from(copy.children, original => {
    const slot = document.createElement('div');
    slot.className = 'slide-field';
    original.replaceWith(slot);
    return { slot, original };
  });
  const panels = slides.map(({ entry, name, category, icon, link }) => {
    const nodes = fields.map(({ original, slot }) => {
      const node = original.cloneNode(true);
      slot.append(node);
      return node;
    });
    const [label, heading, summary, actions] = nodes;
    label.querySelector('span').textContent = name;
    label.querySelector('small').textContent = category;
    const logo = label.querySelector('img');
    logo.hidden = !icon;
    if (icon) logo.src = icon;
    heading.textContent = entry.dataset.title || entry.querySelector('.description h4')?.textContent || name;
    summary.textContent = entry.dataset.summary || entry.querySelector('.description p, p').textContent;
    const cta = actions.querySelector('.button');
    cta.replaceWith(link.cloneNode(true));
    return nodes;
  });

  function show(index) {
    current = (index + slides.length) % slides.length;
    const { entry } = slides[current];
    const data = entry.dataset;
    panels.forEach((nodes, i) => nodes.forEach(node => {
      node.inert = i !== current;
    }));
    stage.dataset.product = entry.id;
    image.src = data.cover;
    image.alt = data.alt;
    const prop = stage.querySelector('.prop');
    prop.replaceChildren();
    const template = entry.querySelector('template');
    if (template) prop.append(template.content.cloneNode(true));
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    const rect = buttons[current].getBoundingClientRect();
    const bounds = selector.getBoundingClientRect();
    if (rect.right > bounds.right) selector.scrollLeft += rect.right - bounds.right;
    if (rect.left < bounds.left) selector.scrollLeft -= bounds.left - rect.left;
  }

  selector.addEventListener('keydown', event => {
    const i = buttons.indexOf(event.target);
    if (i < 0) return;
    const targets = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: slides.length - 1 };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    show(targets[event.key]);
    buttons[current].focus({ preventScroll: true });
  });

  let start;
  stage.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { start = null; });
  stage.addEventListener('touchend', event => {
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.clientX;
    const dy = event.changedTouches[0].clientY - start.clientY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    start = null;
  }, { passive: true });

  selector.hidden = slides.length < 2;
  show(0);
})();
