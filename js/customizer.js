import { avatarColors, outfits, statuses } from './config.js';
import { avatarDraft, changeOutfit, outfitFor } from './avatar-preferences.js';

export function createCustomizer({ root, onApply, onSelect, mode, secure = false, onSave, onRequestLogin, onOpenSecure }) {
  const find = id => root.querySelector(`#${id}`);
  let records = new Map(), selectedId = null, draft = null;
  let preview = null, loading = false, active = false, disposed = false, graphicsAvailable = false, authorized = false, saving = false;
  if (mode !== 'demo') {
    root.querySelector('.avatar-demo-note strong').textContent = secure ? 'Simpanan dilindungi kata laluan guru' : 'Simpan melalui ruang guru';
    root.querySelector('.avatar-demo-note span').textContent = secure ? 'Pratonton tidak mengubah rekod. Simpanan hanya disahkan selepas jawapan pelayan diterima.' : 'Buka pautan guru, log masuk dan semak pratonton sebelum menyimpan. Tiada perubahan dihantar secara automatik.';
  }
  function draftMessage() { return mode === 'demo' ? 'Pratonton dikemas kini. Tekan “Gunakan dalam demo” untuk melihatnya di semua paparan.' : 'Pratonton dikemas kini. Semak pilihan sebelum menyimpan melalui guru.'; }
  function message(text) { find('avatar-feedback').textContent = text; }
  function availability(available) {
    graphicsAvailable = available;
    find('avatar-fallback').hidden = available || !records.has(selectedId);
    find('avatar-camera-tools').hidden = !available || !records.has(selectedId);
    find('avatar-retry').hidden = available;
  }
  async function ensurePreview() {
    if (!active || disposed || loading || preview || !draft) return;
    loading = true;
    find('avatar-fallback-text').textContent = 'Menyediakan avatar anda…';
    try {
      const { createAvatarPreview } = await import('./avatar-preview.js');
      if (disposed || !draft) return;
      preview = createAvatarPreview(find('avatar-stage'), availability);
      preview.setStudent({ ...records.get(selectedId), ...draft });
      preview.setActive(active);
      availability(true);
    } catch {
      preview?.dispose(); preview = null; availability(false);
    } finally {
      loading = false;
      find('avatar-fallback-text').textContent = 'Pratonton 3D tidak tersedia. Pilihan pakaian dan warna masih boleh digunakan.';
    }
  }
  function render() {
    const student = records.get(selectedId);
    const hasStudent = Boolean(student);
    find('avatar-editor').disabled = !hasStudent || saving;
    find('student-select').disabled = !hasStudent || saving;
    find('profile-name').textContent = student?.name || 'Belum ada murid';
    find('profile-progress').textContent = student ? `${student.status} · Muka surat ${student.page}` : 'Tambah murid melalui guru apabila sambungan tersedia.';
    find('avatar-summary').textContent = student ? `${outfitFor(draft.outfit).labels[student.gender]} · ${avatarColors[draft.color].label}` : '';
    find('avatar-crown-label').hidden = student?.status !== 'Khatam';
    find('avatar-monogram').textContent = student ? student.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('') : '?';
    const status = statuses.find(item => item.name === student?.status);
    root.style.setProperty('--avatar-accent', status?.color || '#159A72');
    find('avatar-stage').hidden = !hasStudent;
    find('avatar-camera-tools').hidden = !hasStudent || !graphicsAvailable;
    find('avatar-fallback').hidden = !hasStudent || graphicsAvailable;
    const changed = hasStudent && (draft.outfit !== student.outfit || draft.color !== student.color);
    find('avatar-apply').disabled = !changed || saving;
    find('avatar-apply').textContent = saving ? 'Sedang menyimpan…' : mode === 'demo' ? 'Gunakan dalam demo ↗' : secure ? (authorized ? 'Simpan avatar' : 'Log masuk guru untuk menyimpan') : 'Buka ruang guru untuk menyimpan';
    find('avatar-reset').disabled = !changed;
    find('avatar-draft-label').textContent = changed ? 'PRATONTON BELUM DIGUNAKAN' : 'PENAMPILAN SEMASA';
    for (const button of find('outfit-options').children) {
      const item = outfitFor(button.dataset.outfit);
      button.querySelector('strong').textContent = item.labels[student?.gender || 'Lelaki'];
      button.setAttribute('aria-pressed', String(item.key === draft?.outfit));
    }
    const palette = hasStudent ? outfitFor(draft.outfit).palettes[student.gender] : [];
    // Keep controls in place during selection so keyboard focus is preserved.
    const group = find('color-options');
    if (group.dataset.palette !== palette.join('|')) {
      group.dataset.palette = palette.join('|');
      group.replaceChildren(...palette.map(key => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'avatar-swatch'; button.dataset.color = key;
        const swatch = document.createElement('span'); swatch.className = 'swatch-disc'; swatch.style.background = avatarColors[key].hex; swatch.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = avatarColors[key].label;
        button.append(swatch, label);
        button.addEventListener('click', () => { draft = { ...draft, color: key }; render(); message(draftMessage()); });
        return button;
      }));
    }
    for (const button of group.children) button.setAttribute('aria-pressed', String(button.dataset.color === draft?.color));
    preview?.setStudent(hasStudent ? { ...student, ...draft } : null);
    ensurePreview();
  }
  function select(id) {
    selectedId = records.has(id) ? id : records.keys().next().value || null;
    find('student-select').value = selectedId || '';
    const student = records.get(selectedId);
    draft = avatarDraft(student);
    message(student && (draft.outfit !== student.outfit || draft.color !== student.color)
      ? 'Pilihan asal tidak tersedia. Pilihan gantian ditunjukkan dalam pratonton sahaja.'
      : mode === 'demo' ? 'Cuba gaya baharu. Perubahan hanya digunakan selepas anda menekan butang demo.' : 'Cuba gaya baharu. Pratonton belum disimpan ke rekod kelas.');
    render(); preview?.reset();
  }
  for (const outfit of outfits) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'outfit-option'; button.dataset.outfit = outfit.key;
    const number = document.createElement('span'); number.className = 'outfit-number'; number.textContent = outfit.symbol;
    const label = document.createElement('strong');
    const mark = document.createElement('span'); mark.className = 'outfit-check'; mark.textContent = '✓'; mark.setAttribute('aria-hidden', 'true');
    button.append(number, label, mark);
    button.addEventListener('click', () => { draft = changeOutfit(records.get(selectedId), draft, outfit.key); render(); message('Pratonton pakaian dikemas kini. Tiga warna pilihan tersedia di bawah.'); });
    find('outfit-options').append(button);
  }
  find('student-select').addEventListener('change', event => { select(event.target.value); onSelect(selectedId); });
  find('avatar-reset').addEventListener('click', () => { select(selectedId); message('Pratonton dikembalikan kepada penampilan semasa.'); });
  find('avatar-apply').addEventListener('click', async () => {
    if (!draft || saving || find('avatar-apply').disabled) return;
    if (mode !== 'demo' && !secure) { onOpenSecure?.({ id: selectedId, ...draft }); return; }
    if (mode !== 'demo' && !authorized) { onRequestLogin?.(); return; }
    saving = true; render();
    try {
      const student = mode === 'demo' ? await onApply(selectedId, { ...draft }) : await onSave(selectedId, { ...draft });
      records.set(selectedId, student);
      message(mode === 'demo' ? 'Penampilan demo dikemas kini di Dunia Quranverse dan Kedudukan Tasmik. Tidak disimpan ke Google Sheets.' : 'Avatar disahkan dan disimpan ke Google Sheets.');
    } catch (error) { message(error.message || 'Perubahan tidak dapat disahkan. Pratonton dikekalkan.'); }
    finally { saving = false; render(); }
  });
  find('avatar-left').addEventListener('click', () => preview?.rotate(1));
  find('avatar-right').addEventListener('click', () => preview?.rotate(-1));
  find('avatar-zoom-in').addEventListener('click', () => preview?.zoom(1.18));
  find('avatar-zoom-out').addEventListener('click', () => preview?.zoom(.85));
  find('avatar-camera-reset').addEventListener('click', () => preview?.reset());
  find('avatar-retry').addEventListener('click', () => { preview?.dispose(); preview = null; ensurePreview(); });
  return {
    setStudents(students, id = selectedId, { preserveDraft = false } = {}) {
      const previous = records.get(selectedId), previousId = selectedId, previousDraft = draft;
      const dirty = previous && draft && (draft.outfit !== previous.outfit || draft.color !== previous.color);
      records = new Map(students.map(student => [student.id, student]));
      const selectNode = find('student-select');
      selectNode.replaceChildren(...students.map(student => {
        const option = document.createElement('option'); option.value = student.id; option.textContent = student.name; return option;
      }));
      if (!students.length) { const option = document.createElement('option'); option.textContent = 'Belum ada murid'; selectNode.append(option); }
      selectNode.disabled = !students.length;
      if (preserveDraft && dirty && previousId === id && records.get(id)?.gender === previous.gender) {
        selectedId = id; draft = previousDraft; selectNode.value = id; render();
      } else select(id);
    },
    setAuthorization(value) { authorized = value; if (draft) render(); },
    setDraft(id, preferences) {
      if (!records.has(id)) return;
      select(id); draft = avatarDraft({ ...records.get(id), ...preferences }); render();
      message('Pratonton daripada pautan diterima. Semak pilihan dan log masuk sebagai guru sebelum menyimpan.');
    },
    select,
    setActive(value) { active = value; preview?.setActive(value); ensurePreview(); },
    dispose() { disposed = true; preview?.dispose(); preview = null; },
  };
}
