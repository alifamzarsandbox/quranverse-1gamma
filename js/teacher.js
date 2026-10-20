import { statuses, outfits, avatarColors } from './config.js';
import { avatarDraft, outfitFor } from './avatar-preferences.js';

export function createTeacher({ root, client, mutate, refresh, onAuth = () => {}, entryUrl }) {
  root.innerHTML = `<div class="teacher-shell">
    <div id="teacher-entry" class="teacher-card" hidden><p class="eyebrow">RUANG KHAS GURU</p><h2>Rekod bacaan, dengan mudah.</h2><p>Log masuk dan simpan rekod melalui pautan guru yang selamat.</p><a id="teacher-entry-link" class="button" target="_top" rel="noopener">Buka dashboard guru</a><p id="teacher-entry-note"></p></div>
    <form id="teacher-login" class="teacher-card" hidden><p class="eyebrow">SELAMAT DATANG, GURU</p><h2>Membimbing satu bacaan lagi.</h2><p>Gunakan kata laluan bersama guru.</p><label for="teacher-password">Kata laluan guru</label><input id="teacher-password" type="password" autocomplete="current-password" required maxlength="256"><button class="button" id="teacher-login-button" type="submit">Log masuk</button></form>
    <p id="teacher-message" class="teacher-message" role="status" aria-live="polite"></p>
    <div id="teacher-dashboard" hidden><div class="teacher-toolbar"><div><h2>Rekod murid</h2><p id="teacher-count"></p></div><button id="teacher-logout" class="button button-quiet">Log keluar</button></div>
      <div class="teacher-search-row"><div><label for="teacher-search">Cari murid</label><input id="teacher-search" type="search" placeholder="Taip nama murid…" autocomplete="off"></div><button id="teacher-add" class="button">+ Tambah murid</button></div><div id="teacher-list" class="teacher-list"></div>
    </div>
    <form id="teacher-form" class="teacher-card teacher-editor" hidden><div class="teacher-toolbar"><h2 id="teacher-form-title">Kemas kini bacaan</h2><button id="teacher-cancel" type="button" class="button button-quiet">Tutup</button></div>
      <fieldset id="teacher-fields"><legend class="teacher-sr">Butiran murid</legend><p id="teacher-edit-name" class="teacher-edit-name"></p>
      <div class="teacher-field-row"><div><label for="teacher-status">Status bacaan</label><select id="teacher-status" required></select></div><div><label for="teacher-page">Muka surat</label><input id="teacher-page" type="number" inputmode="numeric" min="1" max="604" step="1" required><small id="teacher-page-hint"></small></div></div>
      <details id="teacher-details"><summary>Nama, jantina dan avatar</summary><label for="teacher-name">Nama penuh</label><input id="teacher-name" maxlength="100" required autocomplete="off"><label for="teacher-gender">Jantina</label><select id="teacher-gender"><option>Lelaki</option><option>Perempuan</option></select><label for="teacher-outfit">Pakaian</label><select id="teacher-outfit"></select><label for="teacher-color">Warna</label><select id="teacher-color"></select></details>
      <div class="teacher-actions"><button id="teacher-save" type="submit" class="button">Simpan bacaan</button><button id="teacher-delete" type="button" class="button teacher-danger">Padam murid</button></div>
      <div id="teacher-delete-confirm" class="teacher-confirm" hidden><p id="teacher-delete-question"></p><button id="teacher-delete-yes" type="button" class="button teacher-danger">Ya, padam murid</button><button id="teacher-delete-no" type="button" class="button button-quiet">Batal</button></div></fieldset>
      <button id="teacher-reconcile" type="button" class="button button-quiet" hidden>Semak rekod terkini sebelum cuba lagi</button><p id="teacher-current" class="teacher-current" role="status"></p>
    </form></div>`;
  const find = id => root.querySelector(`#${id}`);
  let students = new Map(), session = null, busy = false, original = null, editId = null, requestId = null, uncertain = false, appearanceTouched = false, uncertainId = null;
  // Also reachable after an avatar save fails while the record form is closed.
  root.querySelector('.teacher-shell').append(find('teacher-reconcile'), find('teacher-current'));
  const storageKey = 'quranverse-teacher-session';
  function say(text) { find('teacher-message').textContent = text; }
  function store() { try { if (session) sessionStorage.setItem(storageKey, JSON.stringify(session)); else sessionStorage.removeItem(storageKey); } catch { /* Session remains in memory. */ } }
  function signedIn() { return client.secure && session?.expiresAt > Date.now(); }
  function auth() {
    if (!signedIn()) session = null;
    find('teacher-login').hidden = !client.secure || signedIn();
    find('teacher-dashboard').hidden = !signedIn();
    onAuth(signedIn());
  }
  if (client.secure) { try { const saved = JSON.parse(sessionStorage.getItem(storageKey)); if (typeof saved?.token === 'string' && saved.expiresAt > Date.now()) session = saved; } catch { /* No stored session. */ } }
  else {
    find('teacher-entry').hidden = false;
    find('teacher-entry-link').hidden = !entryUrl;
    if (entryUrl) find('teacher-entry-link').href = entryUrl;
    find('teacher-entry-note').textContent = entryUrl ? 'Kata laluan dimasukkan hanya pada pautan guru tersebut.' : 'Pautan guru belum disediakan. Ikuti panduan persediaan Google sebelum menggunakan rekod sebenar. Paparan ini masih menggunakan mod yang ditetapkan.';
  }
  function option(value, label = value) { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; }
  find('teacher-status').replaceChildren(...statuses.map(status => option(status.name)));
  function pageLimit() {
    const maximum = ['Al-Quran', 'Khatam'].includes(find('teacher-status').value) ? 604 : 31;
    find('teacher-page').max = maximum;
    find('teacher-page-hint').textContent = `1–${maximum}; had tepat disemak oleh pelayan.`;
  }
  function appearance(preserve = true) {
    const gender = find('teacher-gender').value, currentOutfit = find('teacher-outfit').value, currentColor = find('teacher-color').value;
    find('teacher-outfit').replaceChildren(...outfits.map(item => option(item.key, item.labels[gender])));
    find('teacher-outfit').value = preserve && outfitFor(currentOutfit) ? currentOutfit : 'sekolah';
    const palette = outfitFor(find('teacher-outfit').value).palettes[gender];
    find('teacher-color').replaceChildren(...palette.map(color => option(color, avatarColors[color].label)));
    find('teacher-color').value = preserve && palette.includes(currentColor) ? currentColor : palette[0];
  }
  function list() {
    const query = find('teacher-search').value.trim().toLocaleLowerCase('ms');
    const matching = [...students.values()].filter(student => student.name.toLocaleLowerCase('ms').includes(query));
    find('teacher-count').textContent = `${students.size} murid · ${matching.length} ditunjukkan`;
    find('teacher-list').replaceChildren(...matching.map(student => {
      const row = document.createElement('article'); row.className = 'teacher-row';
      const detail = document.createElement('div'), name = document.createElement('strong'), progress = document.createElement('p');
      name.textContent = student.name; progress.textContent = `${student.gender} · ${student.status} · Muka surat ${student.page}`;
      detail.append(name, progress);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-quiet'; button.textContent = 'Kemas kini'; button.disabled = busy;
      button.setAttribute('aria-label', `Kemas kini ${student.name}`); button.onclick = () => open(student.id);
      row.append(detail, button); return row;
    }));
    if (!matching.length) { const empty = document.createElement('p'); empty.className = 'teacher-empty'; empty.textContent = students.size ? 'Tiada murid sepadan dengan carian.' : 'Belum ada murid. Tekan “Tambah murid” untuk bermula.'; find('teacher-list').append(empty); }
  }
  function setBusy(value) {
    busy = value; find('teacher-fields').disabled = value; find('teacher-cancel').disabled = value; find('teacher-add').disabled = value;
    find('teacher-logout').disabled = value; find('teacher-save').disabled = value || uncertain; find('teacher-delete').disabled = value || uncertain;
    find('teacher-login-button').disabled = value; find('teacher-reconcile').disabled = value;
    find('teacher-save').textContent = value ? 'Sedang menyimpan…' : editId ? 'Simpan bacaan' : 'Tambah murid'; list();
  }
  function open(id) {
    if (busy) return;
    if (uncertain) { say('Semak rekod terkini dahulu sebelum membuka borang lain.'); return; }
    editId = id || null; original = students.get(id) || null; requestId = crypto.randomUUID(); uncertain = false; appearanceTouched = false;
    const student = original || { name: '', gender: 'Lelaki', status: "Iqra' 1", page: 1, outfit: 'sekolah', color: 'biru' };
    find('teacher-form').hidden = false; find('teacher-dashboard').hidden = true;
    find('teacher-form-title').textContent = original ? 'Kemas kini bacaan' : 'Murid baharu';
    find('teacher-edit-name').textContent = student.name || 'Mulakan perjalanan seorang lagi pembaca.';
    find('teacher-name').value = student.name; find('teacher-gender').value = student.gender;
    find('teacher-status').value = student.status; find('teacher-page').value = student.page; pageLimit();
    appearance(false); const draft = avatarDraft(student); find('teacher-outfit').value = draft.outfit; appearance(true); find('teacher-color').value = draft.color;
    find('teacher-details').open = !original; find('teacher-delete').hidden = !original;
    find('teacher-delete-confirm').hidden = true; find('teacher-reconcile').hidden = true; find('teacher-current').textContent = '';
    setBusy(false); say('');
    (original ? find('teacher-page') : find('teacher-name')).focus();
  }
  function close() { if (busy) return; find('teacher-form').hidden = true; editId = null; original = null; auth(); }
  async function perform(method, args) {
    if (busy) throw new Error('Simpanan masih sedang diproses.');
    if (uncertain) throw new Error('Semak rekod terkini di ruang guru sebelum menghantar semula.');
    if (!signedIn()) { auth(); say('Sesi tamat. Log masuk untuk meneruskan. Pratonton dan borang dikekalkan.'); throw new Error('Sila log masuk sebagai guru dahulu.'); }
    setBusy(true); say('Sedang menyimpan… Tunggu pengesahan pelayan.');
    const reminder = setTimeout(() => say('Pelayan masih belum mengesahkan operasi. Borang dikekalkan; jangan hantar semula.'), 20000);
    try { return await mutate(method, [session.token, ...args]); }
    catch (error) {
      if (error.code === 'AUTH') { session = null; store(); auth(); }
      if (error.uncertain) { uncertain = true; uncertainId = method === 'addStudent' ? null : args[0]; find('teacher-reconcile').hidden = false; }
      say(error.uncertain ? 'Keputusan simpanan belum dapat disahkan. Semak rekod terkini sebelum mencuba lagi.' : error.message);
      throw error;
    } finally { clearTimeout(reminder); setBusy(false); }
  }
  find('teacher-login').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); say('Menyemak kata laluan…');
    const password = find('teacher-password').value; find('teacher-password').value = '';
    try {
      const result = await client.login(password);
      if (typeof result.data?.token !== 'string' || !Number.isFinite(result.data.expiresAt)) throw new Error('Jawapan log masuk tidak sah.');
      session = result.data; store(); auth(); if (!find('teacher-form').hidden) find('teacher-dashboard').hidden = true;
      say('Log masuk berjaya. Pilih murid untuk mengemas kini bacaan.');
    } catch (error) { say(error.message); } finally { setBusy(false); }
  };
  find('teacher-form').onsubmit = async event => {
    event.preventDefault(); if (busy || uncertain) return;
    const fields = { name: find('teacher-name').value.trim(), gender: find('teacher-gender').value, status: find('teacher-status').value, page: Number(find('teacher-page').value), outfit: find('teacher-outfit').value, color: find('teacher-color').value };
    const patch = original ? Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== original[key] && (!['outfit', 'color'].includes(key) || appearanceTouched))) : fields;
    if (!Object.keys(patch).length) { say('Tiada perubahan untuk disimpan.'); return; }
    try { await perform(editId ? 'updateStudent' : 'addStudent', editId ? [editId, patch] : [requestId, fields]); close(); say('Rekod disahkan dan disimpan ke Google Sheets.'); } catch { /* Retain the form. */ }
  };
  find('teacher-delete').onclick = () => { find('teacher-delete-question').textContent = `Padam ${original.name}? Rekod ini akan dikeluarkan daripada kelas.`; find('teacher-delete-confirm').hidden = false; };
  find('teacher-delete-no').onclick = () => { find('teacher-delete-confirm').hidden = true; };
  find('teacher-delete-yes').onclick = async () => { if (busy || uncertain) return; try { await perform('deleteStudent', [editId]); close(); say('Pemadaman disahkan oleh pelayan.'); } catch { /* Keep confirmation and draft. */ } };
  find('teacher-reconcile').onclick = async () => {
    if (busy) return; setBusy(true);
    try {
      if (!await refresh()) throw new Error('Rekod terkini belum tersedia. Tunggu sebentar dan semak semula.');
      const current = students.get(uncertainId);
      find('teacher-current').textContent = uncertainId ? (current ? `Rekod pelayan: ${current.name} · ${current.status} · Muka surat ${current.page} · ${current.outfit} · ${current.color}. Semak sebelum menghantar semula.` : 'Murid tiada dalam rekod pelayan. Tutup borang dan semak senarai.') : 'Senarai disegarkan. Semak sama ada murid telah ditambah. Penghantaran semula borang ini menggunakan ID permintaan yang sama.';
      if (uncertainId && !current && editId) return;
      uncertain = false; find('teacher-reconcile').hidden = true; say('Rekod terkini diterima. Borang anda dikekalkan untuk semakan.');
    } catch (error) { say(error.message); } finally { setBusy(false); }
  };
  find('teacher-search').oninput = list;
  find('teacher-add').onclick = () => open(null); find('teacher-cancel').onclick = close;
  find('teacher-logout').onclick = () => { session = null; store(); close(); auth(); say('Anda telah log keluar.'); };
  find('teacher-status').onchange = pageLimit;
  find('teacher-gender').onchange = () => { appearanceTouched = true; appearance(true); };
  find('teacher-outfit').onchange = () => { appearanceTouched = true; appearance(true); };
  find('teacher-color').onchange = () => { appearanceTouched = true; };
  auth();
  return {
    setStudents(records) { students = new Map(records.map(student => [student.id, student])); list(); },
    signedIn,
    requestLogin() { auth(); say('Log masuk sebagai guru untuk menyimpan avatar. Pilihan pratonton dikekalkan.'); find('teacher-password').focus(); },
    async saveAvatar(id, draft) { const saved = await perform('updateStudent', [id, draft]); say('Avatar disahkan dan disimpan ke Google Sheets.'); return saved; },
  };
}
