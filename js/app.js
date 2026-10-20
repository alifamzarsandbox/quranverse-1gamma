import { config, statuses, tabs } from './config.js';
import { api, getStudents, secureEntryUrl, ApiError } from './api.js';
import { createPresentation } from './presentation.js';
import { createLeaderboard } from './leaderboard.js';
import { createCustomizer } from './customizer.js';
import { applyDemoAvatar } from './avatar-preferences.js';
import { createTeacher } from './teacher.js';
import { normalizeStudents, studentSignature, createSync } from './student-data.js';

const state = {
  studentsById: new Map(),
  activeTab: 'dunia',
  selectedStatus: 'Al-Quran',
  selectedStudentId: null,
  worldSelectedId: null,
};
const byId = id => document.getElementById(id);
const presentation = createPresentation({ intervalMs: config.presentationIntervalMs, inactivityMs: config.inactivityMs });
let presentationTimer;
let toastTimer;
let ownsFullscreen = false;
let world = null;
let worldPromise = null;
let studentsLoaded = false;
let customizer;
let lastSignature = '', lastSyncedAt = 0, readReminder, draftImported = false;
const teacher = createTeacher({
  root: byId('panel-guru'), client: api, entryUrl: secureEntryUrl(config),
  mutate: (method, args) => sync.mutate(async () => {
    const result = await api[method](...args);
    try {
      if (method === 'deleteStudent') {
        if (result.data?.id !== args[1]) throw new Error();
        applyStudents(students().filter(student => student.id !== result.data.id));
        return result.data;
      }
      const saved = normalizeStudents([result.data])[0];
      if (method === 'updateStudent' && saved.id !== args[1]) throw new Error();
      applyStudents([...students().filter(student => student.id !== saved.id), saved]);
      return saved;
    } catch { throw new ApiError('TRANSPORT', 'Jawapan simpanan tidak dapat disahkan. Semak rekod terkini melalui ruang guru.', true); }
  }),
  refresh: () => sync.refresh(), onAuth: value => customizer?.setAuthorization(value),
});
const sync = createSync({
  read: getStudents, onData: applyStudents, onStatus: syncStatus,
  interval: () => presentation.snapshot(performance.now()).active ? 5000 : 15000,
  enabled: () => !document.hidden && navigator.onLine !== false && (config.dataMode !== 'demo' || !studentsLoaded),
});
const leaderboard = createLeaderboard({ root: byId('leaderboard'), onPageCount: count => presentation.setLeaderboardPages(count), onInteract: worldInteraction });
customizer = createCustomizer({
  root: byId('panel-avatar'), mode: config.dataMode,
  secure: api.secure, onSave: (id, draft) => teacher.saveAvatar(id, draft),
  onRequestLogin: () => { switchTab('guru'); teacher.requestLogin(); },
  onOpenSecure: draft => {
    const url = secureEntryUrl(config, draft);
    if (url) window.open(url, '_blank', 'noopener');
    else showToast('Pautan guru belum disediakan. Ikuti panduan persediaan Google dahulu.');
  },
  onSelect: id => { state.selectedStudentId = id; },
  onApply: (id, draft) => {
    const updated = applyDemoAvatar(state.studentsById.get(id), draft, config.dataMode);
    state.studentsById.set(id, updated);
    world?.setStudents(students());
    leaderboard.setStudents(students());
    return updated;
  },
});
customizer.setAuthorization(teacher.signedIn());

function worldInteraction() {
  presentation.interact(performance.now());
  world?.setPresentation(false);
}

async function ensureWorld() {
  if (!studentsLoaded || state.activeTab !== 'dunia') return;
  if (world) { world.setActive(!document.hidden); return; }
  if (worldPromise) return worldPromise;
  byId('world-loading').hidden = false;
  byId('world-fallback').hidden = true;
  worldPromise = (async () => {
    try {
      const { createWorld } = await import('./world.js');
      world = createWorld({
        container: byId('world-map'),
        onSelect: id => selectWorldStudent(id, false),
        onZone: name => selectWorldZone(name),
        onInteract: worldInteraction,
        onAvailability: (available, message) => {
          byId('world-fallback').hidden = available;
          byId('world-camera-tools').hidden = !available;
          if (message) byId('world-error').textContent = message;
        },
      });
      world.setStudents(students());
      world.setActive(state.activeTab === 'dunia' && !document.hidden);
      if (state.worldSelectedId) world.selectStudent(state.worldSelectedId);
      else if (innerWidth < 600) world.focusZone(state.selectedStatus);
      byId('world-camera-tools').hidden = false;
      const current = presentation.snapshot(performance.now());
      world.setPresentation(current.active && !current.paused);
    } catch {
      world?.dispose(); world = null;
      byId('world-error').textContent = 'Paparan 3D tidak dapat dibuka. Anda masih boleh memilih murid dan melihat kemajuan melalui senarai di sebelah atau di bawah.';
      byId('world-fallback').hidden = false;
      byId('world-camera-tools').hidden = true;
    } finally { byId('world-loading').hidden = true; worldPromise = null; }
  })();
  return worldPromise;
}

function selectWorldZone(name) {
  state.selectedStatus = name;
  state.worldSelectedId = null;
  byId('world-student-select').value = '';
  world?.clearSelection();
  world?.focusZone(name);
  worldInteraction();
  document.querySelectorAll('.zone-chip').forEach(zone => zone.setAttribute('aria-pressed', String(zone.dataset.status === name)));
  renderZoneDetails();
}

function selectWorldStudent(id, moveCamera = true) {
  const student = state.studentsById.get(id);
  if (!student) { selectWorldZone(state.selectedStatus); return; }
  state.worldSelectedId = id;
  state.selectedStudentId = id;
  state.selectedStatus = student.status;
  byId('world-student-select').value = id;
  byId('student-select').value = id;
  document.querySelectorAll('.zone-chip').forEach(zone => zone.setAttribute('aria-pressed', String(zone.dataset.status === student.status)));
  world?.selectStudent(id, moveCamera);
  worldInteraction();
  renderZoneDetails(); customizer.select(id);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setPalette(node, status) {
  node.style.setProperty('--zone-color', status.color);
  node.style.setProperty('--zone-pale', status.pale);
  node.style.setProperty('--zone-dark', status.dark);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('ms');
}

function students() { return [...state.studentsById.values()]; }

function showToast(message) {
  clearTimeout(toastTimer);
  byId('toast').textContent = message;
  byId('toast').hidden = false;
  toastTimer = setTimeout(() => { byId('toast').hidden = true; }, 5000);
}

function switchTab(value, { automatic = false } = {}) {
  if (!tabs[value]) value = 'dunia';
  const current = presentation.snapshot(performance.now());
  if (current.active && !automatic) {
    if (value === 'guru' || value === 'avatar') stopPresentation();
    else presentation.select(value, performance.now());
  }
  state.activeTab = value;
  document.body.dataset.view = value;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const selected = button.dataset.tab === value;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    byId(`panel-${button.dataset.tab}`).hidden = !selected;
  }
  const title = byId('page-title');
  title.replaceChildren(document.createTextNode(tabs[value].title), element('span', '', '.'));
  byId('page-description').textContent = tabs[value].description;
  document.title = `${tabs[value].title} — QURANVERSE`;
  if (location.hash !== `#${value}`) history.replaceState(null, '', `#${value}`);
  world?.setActive(value === 'dunia' && !document.hidden);
  leaderboard.setActive(value === 'kedudukan' && !document.hidden);
  customizer.setActive(value === 'avatar' && !document.hidden);
  if (value === 'dunia') ensureWorld();
}

function renderWorld() {
  const all = students();
  byId('zone-grid').replaceChildren();
  for (const status of statuses) {
    const count = all.filter(student => student.status === status.name).length;
    const button = element('button', 'zone-chip');
    button.type = 'button';
    setPalette(button, status);
    button.setAttribute('aria-label', `${status.name}, ${count} murid. Fokus zon.`);
    button.setAttribute('aria-pressed', String(status.name === state.selectedStatus));
    button.dataset.status = status.name;
    button.append(element('span', '', status.name), element('small', '', count));
    button.addEventListener('click', () => selectWorldZone(status.name));
    byId('zone-grid').append(button);
  }
  const khatamCount = all.filter(student => student.status === 'Khatam').length;
  const quranCount = all.filter(student => student.status === 'Al-Quran').length;
  const percentage = all.length ? Math.round((quranCount + khatamCount) / all.length * 100) : 0;
  byId('student-total').textContent = all.length;
  byId('quran-total').textContent = quranCount;
  byId('khatam-total').textContent = khatamCount;
  byId('class-percent').textContent = `${percentage}%`;
  byId('class-progress').style.width = `${percentage}%`;
  byId('world-student-count').textContent = `${all.length} murid`;
  const worldSelect = byId('world-student-select');
  const placeholder = element('option', '', all.length ? 'Pilih seorang murid' : 'Belum ada murid');
  placeholder.value = '';
  worldSelect.replaceChildren(placeholder, ...all.map(student => {
    const option = element('option', '', student.name); option.value = student.id; return option;
  }));
  if (!state.studentsById.has(state.worldSelectedId)) state.worldSelectedId = null;
  worldSelect.value = state.worldSelectedId || '';
  worldSelect.disabled = !all.length;
  world?.setStudents(all);
  renderZoneDetails();
}

function renderZoneDetails() {
  const selected = state.studentsById.get(state.worldSelectedId);
  byId('focus-student').hidden = !selected;
  byId('view-students').hidden = Boolean(selected);
  if (selected) {
    byId('zone-title').textContent = selected.name;
    byId('zone-count').textContent = selected.status === 'Khatam' ? '♛' : '✦';
    byId('zone-description').textContent = selected.status === 'Khatam' ? 'Tahniah! Teruskan mengulang bacaan dengan tekun.' : 'Setiap halaman membawa anda selangkah ke hadapan.';
    const progress = element('li', 'selected-progress');
    const page = element('div');
    page.append(element('strong', '', selected.page), element('small', '', 'Muka surat'));
    progress.append(element('span', '', selected.status), page);
    setPalette(progress, statuses.find(status => status.name === selected.status));
    byId('zone-students').replaceChildren(progress);
    return;
  }
  const status = statuses.find(item => item.name === state.selectedStatus);
  const members = students().filter(student => student.status === status.name);
  byId('zone-title').textContent = `Zon ${status.name}`;
  byId('zone-count').textContent = members.length;
  byId('zone-description').textContent = status.message;
  const list = byId('zone-students');
  list.replaceChildren();
  const previewLimit = 1;
  for (const student of members.slice(0, previewLimit)) {
    const row = element('li');
    setPalette(row, status);
    const monogram = element('span', 'initials', initials(student.name));
    monogram.setAttribute('aria-hidden', 'true');
    const detail = element('div');
    detail.append(element('strong', '', student.name), element('small', '', `Muka surat ${student.page}`));
    row.append(monogram, detail);
    list.append(row);
  }
  if (!members.length) list.append(element('li', 'zone-more', 'Belum ada murid di zon ini.'));
  if (members.length > previewLimit) list.append(element('li', 'zone-more', `Dan ${members.length - previewLimit} lagi rakan seperjalanan.`));
}

function renderDirectory() {
  leaderboard.setStudents(students());
}

function applyStudents(incoming) {
  const normalized = normalizeStudents(incoming), signature = studentSignature(normalized);
  if (studentsLoaded && signature === lastSignature) return;
  lastSignature = signature;
  state.studentsById = new Map(normalized.map(student => [student.id, student]));
  studentsLoaded = true;
  state.selectedStudentId = state.studentsById.has(state.selectedStudentId) ? state.selectedStudentId : normalized[0]?.id;
  renderWorld(); renderDirectory(); teacher.setStudents(students());
  customizer.setStudents(students(), state.selectedStudentId, { preserveDraft: true });
  if (!draftImported && config.initialDraft?.id) {
    draftImported = true; const { id, outfit, color } = config.initialDraft;
    state.selectedStudentId = state.studentsById.has(id) ? id : state.selectedStudentId;
    customizer.setDraft(id, { ...(outfit ? { outfit } : {}), ...(color ? { color } : {}) });
  }
  byId('app-content').hidden = false; byId('load-error').hidden = true; byId('loading').hidden = true; ensureWorld();
}
function syncStatus(status, value) {
  clearTimeout(readReminder);
  if (status === 'reading') {
    if (!studentsLoaded) { byId('loading').hidden = false; byId('load-error').hidden = true; }
    readReminder = setTimeout(() => { byId('data-status').textContent = 'Menunggu jawapan Google… Tiada permintaan bertindih dihantar.'; }, 20000);
    return;
  }
  byId('loading').hidden = true;
  if (status === 'online') {
    lastSyncedAt = value;
    byId('data-status').textContent = config.dataMode === 'demo' ? 'Data contoh · Perubahan sementara sahaja' : `Google Sheets · Dikemas kini ${new Date(value).toLocaleTimeString('ms-MY')}`;
    byId('load-error').hidden = true;
  } else {
    byId('data-status').textContent = `Sambungan terputus${lastSyncedAt ? ` · Data terakhir ${new Date(lastSyncedAt).toLocaleTimeString('ms-MY')}` : ''} · Akan dicuba semula`;
    if (!studentsLoaded) { byId('load-error').hidden = false; byId('load-error').querySelector('p').textContent = value?.message || 'Data terkini belum dapat dibaca. Semak sambungan.'; }
  }
}
function loadStudents() { sync.wake(); }

function updatePresentation() {
  const now = performance.now();
  const activeElement = document.activeElement;
  const focusedControl = activeElement?.matches('input, select, textarea, [contenteditable="true"], .zone-chip:focus, .world-canvas:focus, .world-camera-tools button:focus');
  const next = presentation.tick(now, document.hidden || focusedControl);
  if (next) switchTab(next, { automatic: true });
  const current = presentation.snapshot(now);
  leaderboard.setPaused(current.active && current.paused);
  world?.setPresentation(current.active && !current.paused);
  byId('presentation-status').textContent = current.paused
    ? (focusedControl ? 'Dijeda semasa kawalan dipilih' : `Dijeda · Sambung dalam ${current.seconds}s`)
    : `Paparan seterusnya dalam ${current.seconds}s`;
}

function startPresentation() {
  document.body.classList.add('is-presenting');
  byId('presentation-bar').hidden = false;
  byId('tv-exit').focus();
  switchTab(presentation.start(performance.now()), { automatic: true });
  world?.overview();
  // overview is an interaction; start the presentation clock after framing it.
  presentation.start(performance.now());
  clearInterval(presentationTimer);
  presentationTimer = setInterval(updatePresentation, 250);
  updatePresentation();
  sync.wake();
}

function stopPresentation() {
  presentation.stop();
  leaderboard.setPaused(false);
  world?.setPresentation(false);
  clearInterval(presentationTimer);
  document.body.classList.remove('is-presenting');
  byId('presentation-bar').hidden = true;
  if (ownsFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  ownsFullscreen = false;
  byId('tv-start').focus();
}

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
document.querySelector('.main-nav').addEventListener('keydown', event => {
  const buttons = [...document.querySelectorAll('[data-tab]')];
  const index = buttons.indexOf(event.target);
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
  switchTab(buttons[next].dataset.tab);
});
byId('view-students').addEventListener('click', () => {
  switchTab('kedudukan');
  byId('panel-kedudukan').focus();
});
byId('retry-load').addEventListener('click', loadStudents);
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); switchTab('dunia'); });
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); byId('main').focus(); byId('main').scrollIntoView(); });
byId('world-student-select').addEventListener('change', event => selectWorldStudent(event.target.value));
byId('focus-student').addEventListener('click', () => world?.selectStudent(state.worldSelectedId));
byId('world-overview').addEventListener('click', () => world?.overview());
byId('world-zoom-in').addEventListener('click', () => world?.zoom(1.25));
byId('world-zoom-out').addEventListener('click', () => world?.zoom(.8));
byId('world-left').addEventListener('click', () => world?.rotate(1));
byId('world-right').addEventListener('click', () => world?.rotate(-1));
byId('world-retry').addEventListener('click', () => { world?.dispose(); world = null; ensureWorld(); });
byId('tv-start').addEventListener('click', startPresentation);
byId('tv-exit').addEventListener('click', stopPresentation);
byId('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); ownsFullscreen = true; }
    else showToast('Skrin penuh tidak tersedia. Anda masih boleh menggunakan mod TV.');
  } catch { showToast('Skrin penuh tidak dapat dibuka. Mod TV masih aktif.'); }
});
document.addEventListener('fullscreenchange', () => {
  byId('fullscreen').lastElementChild.textContent = document.fullscreenElement ? 'Keluar skrin penuh' : 'Skrin penuh';
  if (!document.fullscreenElement) ownsFullscreen = false;
});
for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'focusin']) {
  document.addEventListener(type, () => { worldInteraction(); leaderboard.interact(); }, { passive: true });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && presentation.snapshot(performance.now()).active) stopPresentation();
});
document.addEventListener('visibilitychange', () => { worldInteraction(); world?.setActive(state.activeTab === 'dunia' && !document.hidden); leaderboard.setActive(state.activeTab === 'kedudukan' && !document.hidden); customizer.setActive(state.activeTab === 'avatar' && !document.hidden); });
document.addEventListener('visibilitychange', () => sync.wake());
window.addEventListener('online', () => sync.wake());
window.addEventListener('offline', () => syncStatus('offline'));
window.addEventListener('pagehide', event => { sync.stop(); clearTimeout(readReminder); world?.setActive(false); leaderboard.setActive(false); customizer.setActive(false); if (!event.persisted) { world?.dispose(); world = null; leaderboard.dispose(); customizer.dispose(); } });
window.addEventListener('pageshow', event => { if (event.persisted) { sync.start(); world?.setActive(state.activeTab === 'dunia' && !document.hidden); leaderboard.setActive(state.activeTab === 'kedudukan' && !document.hidden); customizer.setActive(state.activeTab === 'avatar' && !document.hidden); } });
window.addEventListener('hashchange', () => switchTab(location.hash.slice(1)));
if (config.dataMode === 'live') {
  byId('data-status').textContent = 'Menunggu rekod Google Sheets…';
  document.querySelector('.demo-badge').textContent = 'Google Sheets';
  document.querySelector('.class-label small').textContent = 'KELAS TASMIK';
  document.querySelector('.class-label strong').textContent = config.className || 'Kelas kita';
}
switchTab(location.hash.slice(1) || config.initialView);
sync.start();
if (navigator.onLine === false) syncStatus('offline');
