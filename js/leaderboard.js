import { statuses } from './config.js';

const priorities = new Map(statuses.map((status, index) => [status.name, index]));
export function rankStudents(students) {
  const ids = new Set();
  for (const student of students) {
    if (!student.id || ids.has(student.id) || !priorities.has(student.status) || !Number.isInteger(student.page) || student.page < 1) throw new Error('Rekod kedudukan tidak sah.');
    ids.add(student.id);
  }
  return [...students].sort((a, b) => priorities.get(a.status) - priorities.get(b.status) || b.page - a.page || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function boardLayout(width, availableHeight, count) {
  const paginated = width >= 1100;
  const columns = paginated ? 3 : width >= 620 ? 2 : 1;
  const maxRows = paginated ? Math.max(1, Math.min(10, Math.floor((availableHeight + 8) / 78))) : Math.max(1, Math.ceil(count / columns));
  const capacity = paginated ? columns * maxRows : Math.max(1, count);
  return { columns, rows: Math.max(1, Math.min(maxRows, Math.ceil(count / columns))), capacity, pages: Math.max(1, Math.ceil(count / capacity)), paginated };
}
export function matchingStudentIds(students, query) {
  const text = query.trim().toLocaleLowerCase('ms');
  return text ? students.filter(student => student.name.toLocaleLowerCase('ms').includes(text)).map(student => student.id) : [];
}

// All cards stay keyed by student ID. Only the current readable page is displayed.
export function createLeaderboard({ root, onPageCount = () => {}, onInteract = () => {} }) {
  const find = selector => root.querySelector(selector);
  const grid = find('.ranking-grid');
  const search = find('input');
  const cards = new Map();
  const thumbnails = new Map();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let ranked = [], matches = [], layout = boardLayout(1200, 780, 0), page = 0;
  let active = false, paused = false, disposed = false, nextPageAt = 0, resumeAt = 0;
  let thumbnailRenderer, thumbnailPromise, thumbnailFailed = false, thumbnailBusy = false;
  let thumbnailGeneration = 0, pendingFrame = 0, animations = [];
  let autoAdvances = 0;
  const node = (tag, className, text) => { const result = document.createElement(tag); result.className = className; if (text !== undefined) result.textContent = text; return result; };
  function interact() { resumeAt = performance.now() + 30_000; onInteract(); }
  function thumbnailKey(student) { return `${student.id}|${student.gender}|${student.outfit}|${student.color}|${student.status === 'Khatam'}`; }
  async function updateThumbnails() {
    if (!active || disposed || thumbnailFailed || thumbnailBusy) return;
    thumbnailBusy = true;
    const generation = thumbnailGeneration;
    try {
      thumbnailPromise ||= import('./avatar-thumbnail.js').then(module => module.createAvatarThumbnailRenderer());
      thumbnailRenderer ||= await thumbnailPromise;
      if (disposed) { thumbnailRenderer.dispose(); return; }
      for (const student of ranked) {
        if (!active || disposed || generation !== thumbnailGeneration) break;
        const key = thumbnailKey(student);
        let cached = thumbnails.get(student.id);
        if (cached?.key !== key) {
          cached = { key, url: thumbnailRenderer.render(student) };
          thumbnails.set(student.id, cached);
        }
        const portrait = cards.get(student.id)?.querySelector('.rank-avatar');
        if (portrait && portrait.dataset.key !== key) {
          const image = node('img', '', ''); image.alt = ''; image.src = cached.url; image.width = 60; image.height = 66;
          portrait.replaceChildren(image); portrait.dataset.key = key;
        }
        // Yield between pupils; never create one WebGL context per card.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch { thumbnailFailed = true; }
    finally {
      thumbnailBusy = false;
      if (!disposed && active && generation !== thumbnailGeneration) updateThumbnails();
    }
  }
  function makeCard(student) {
    const card = node('article', 'rank-card'); card.dataset.studentId = student.id;
    card.append(node('span', 'rank-number'), node('span', 'rank-avatar'));
    const detail = node('div', 'rank-detail'); detail.append(node('h3', 'rank-name'), node('span', 'rank-status'));
    const progress = node('div', 'rank-progress'); progress.append(node('strong', ''), node('small', '', 'Muka surat'));
    card.append(detail, progress); return card;
  }
  function paint(animate = false) {
    animations.forEach(animation => animation.cancel()); animations = [];
    const before = new Map();
    if (animate && active && !reduceMotion.matches) for (const [id, card] of cards) if (!card.hidden) before.set(id, card.getBoundingClientRect());
    const start = layout.paginated ? page * layout.capacity : 0;
    const end = layout.paginated ? start + layout.capacity : ranked.length;
    const matching = new Set(matches);
    const fragment = document.createDocumentFragment();
    ranked.forEach((student, index) => {
      const card = cards.get(student.id);
      const palette = statuses[priorities.get(student.status)];
      card.style.setProperty('--zone-color', palette.color); card.style.setProperty('--zone-pale', palette.pale); card.style.setProperty('--zone-dark', palette.dark);
      card.dataset.rank = index + 1;
      card.classList.toggle('is-top-three', index < 3);
      card.classList.toggle('is-match', matching.has(student.id));
      card.classList.toggle('has-long-name', student.name.length > 27);
      card.hidden = index < start || index >= end;
      card.querySelector('.rank-number').textContent = String(index + 1).padStart(2, '0');
      card.querySelector('.rank-number').setAttribute('aria-label', `Kedudukan ${index + 1}`);
      card.querySelector('.rank-name').textContent = student.name;
      card.querySelector('.rank-name').title = student.name;
      card.querySelector('.rank-status').textContent = student.status;
      card.querySelector('.rank-progress strong').textContent = student.page;
      card.setAttribute('aria-label', `Kedudukan ${index + 1}. ${student.name}. ${student.status}. Muka surat ${student.page}.`);
      const portrait = card.querySelector('.rank-avatar');
      portrait.setAttribute('aria-hidden', 'true');
      if (!portrait.childElementCount) portrait.textContent = student.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('');
      fragment.append(card);
    });
    grid.append(fragment);
    grid.style.setProperty('--ranking-columns', layout.columns);
    grid.style.setProperty('--ranking-rows', layout.rows);
    grid.classList.toggle('is-paginated', layout.paginated);
    root.dataset.capacity = layout.capacity; root.dataset.page = page + 1; root.dataset.pages = layout.pages;
    root.dataset.students = ranked.length;
    find('.ranking-empty').hidden = ranked.length > 0;
    find('.ranking-count').textContent = `${ranked.length} murid`;
    find('.ranking-page').textContent = `Halaman ${page + 1} daripada ${layout.pages}`;
    find('.ranking-range').textContent = ranked.length ? `Kedudukan ${start + 1}–${Math.min(end, ranked.length)}` : 'Belum ada murid';
    find('.ranking-pagination').hidden = layout.pages < 2;
    find('.ranking-search-result').textContent = search.value.trim() ? `${matches.length} padanan diserlahkan · Semua murid kekal dalam senarai` : 'Cari nama untuk menyerlahkan murid';
    for (const [id, previous] of before) {
      const card = cards.get(id);
      if (!card || card.hidden) continue;
      const current = card.getBoundingClientRect();
      const x = previous.left - current.left, y = previous.top - current.top;
      if (x || y) animations.push(card.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' }));
    }
    updateThumbnails();
  }
  function measure() {
    if (!active || disposed) return;
    const next = boardLayout(root.clientWidth, innerHeight - grid.getBoundingClientRect().top - 68, ranked.length);
    const changed = JSON.stringify(next) !== JSON.stringify(layout);
    layout = next; page = Math.min(page, layout.pages - 1);
    if (changed) { nextPageAt = performance.now() + 12_000; onPageCount(layout.pages); }
    if (changed) paint();
  }
  function scheduleMeasure() { cancelAnimationFrame(pendingFrame); pendingFrame = requestAnimationFrame(measure); }
  const resizeObserver = new ResizeObserver(scheduleMeasure); resizeObserver.observe(root);
  window.addEventListener('resize', scheduleMeasure);
  search.addEventListener('input', searchChanged);
  function searchChanged() {
    interact(); matches = matchingStudentIds(ranked, search.value);
    if (matches.length && layout.paginated) page = Math.floor(ranked.findIndex(student => student.id === matches[0]) / layout.capacity);
    paint();
  }
  function changePage(direction) { interact(); page = (page + direction + layout.pages) % layout.pages; nextPageAt = performance.now() + 12_000; paint(); }
  const previous = () => changePage(-1), next = () => changePage(1);
  find('.ranking-previous').addEventListener('click', previous); find('.ranking-next').addEventListener('click', next);
  const timer = setInterval(() => {
    if (!active || disposed || document.hidden || layout.pages < 2) return;
    const now = performance.now();
    const focused = root.contains(document.activeElement) && document.activeElement.matches('input, button');
    root.dataset.autoAdvances = autoAdvances;
    root.dataset.autoPaused = String(paused || focused || now < resumeAt);
    if (paused || focused || now < resumeAt) { nextPageAt = now + 12_000; return; }
    if (now >= nextPageAt) { page = (page + 1) % layout.pages; autoAdvances++; root.dataset.autoAdvances = autoAdvances; nextPageAt = now + 12_000; paint(); }
  }, 250);
  return {
    setStudents(students) {
      const nextRanked = rankStudents(students);
      const keep = new Set(nextRanked.map(student => student.id));
      for (const [id, card] of cards) if (!keep.has(id)) { card.remove(); cards.delete(id); thumbnails.delete(id); }
      for (const student of nextRanked) if (!cards.has(student.id)) cards.set(student.id, makeCard(student));
      ranked = nextRanked; thumbnailGeneration++; matches = matchingStudentIds(ranked, search.value);
      const nextLayout = boardLayout(root.clientWidth || 1200, innerHeight - grid.getBoundingClientRect().top - 68, ranked.length);
      if (nextLayout.capacity !== layout.capacity || nextLayout.pages !== layout.pages) nextPageAt = performance.now() + 12_000;
      layout = nextLayout; page = Math.min(page, layout.pages - 1); onPageCount(layout.pages);
      paint(true); scheduleMeasure();
    },
    setActive(value) { const entering = value && !active; active = Boolean(value); if (entering) { page = 0; nextPageAt = performance.now() + 12_000; scheduleMeasure(); updateThumbnails(); } },
    setPaused(value) { paused = Boolean(value); },
    interact,
    dispose() {
      disposed = true; clearInterval(timer); cancelAnimationFrame(pendingFrame); resizeObserver.disconnect(); window.removeEventListener('resize', scheduleMeasure);
      search.removeEventListener('input', searchChanged); find('.ranking-previous').removeEventListener('click', previous); find('.ranking-next').removeEventListener('click', next);
      animations.forEach(animation => animation.cancel()); thumbnailRenderer?.dispose(); cards.clear(); thumbnails.clear(); grid.replaceChildren();
    },
  };
}
