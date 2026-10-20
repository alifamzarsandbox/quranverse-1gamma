import { statuses, validReadingPage } from './config.js';

export function normalizeNickname(value) {
  return typeof value === 'string' && value.trim() && !/[\x00-\x1f\x7f]/.test(value) ? value : '';
}

export function normalizeStudents(input) {
  if (!Array.isArray(input)) throw new Error('Data murid tidak sah.');
  const ids = new Set();
  return input.map(student => {
    if (!student || typeof student.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(student.id) || ids.has(student.id) ||
        typeof student.name !== 'string' || !student.name.trim() || student.name.length > 100 || !['Lelaki', 'Perempuan'].includes(student.gender) ||
        !statuses.some(status => status.name === student.status) || !validReadingPage(student.status, student.page) ||
        !Number.isSafeInteger(student.bil) || student.bil < 1 || typeof student.outfit !== 'string' || typeof student.color !== 'string') throw new Error('Data murid tidak sah. Semak ID dan medan wajib dalam helaian.');
    ids.add(student.id);
    return Object.freeze({ ...Object.fromEntries(['id', 'bil', 'name', 'gender', 'status', 'page', 'outfit', 'color'].map(key => [key, student[key]])), nickname: normalizeNickname(student.nickname) });
  });
}
export function studentSignature(students) {
  return JSON.stringify([...students].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createSync({ read, onData, onStatus = () => {}, interval = () => 15000, enabled = () => true, clock = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let timer, pending = null, stopped = true, writing = false, generation = 0, failures = 0;
  function queue(delay) { cancel(timer); if (!stopped && enabled() && !writing) timer = schedule(() => refresh().catch(() => {}), delay); }
  function refresh() {
    if (pending) return pending;
    if (writing || stopped || !enabled()) return Promise.resolve(false);
    cancel(timer); const started = clock(), version = generation;
    pending = (async () => {
      try {
        onStatus('reading'); const result = await Promise.resolve().then(read);
        if (version !== generation || stopped) return false;
        const data = normalizeStudents(result.data); onData(data); failures = 0; onStatus('online', clock()); return true;
      } catch (error) { if (version === generation && !stopped) { failures++; onStatus('offline', error); } throw error; }
      finally { pending = null; queue(version !== generation ? 0 : failures ? Math.min(30000, 10000 * 2 ** (failures - 1)) : Math.max(0, interval() - (clock() - started))); }
    })();
    return pending;
  }
  return {
    start() { stopped = false; queue(0); }, refresh,
    wake() { queue(0); },
    async mutate(work) {
      if (writing) throw new Error('Simpanan masih sedang diproses.');
      writing = true; generation++; cancel(timer);
      try { return await work(); }
      finally { writing = false; generation++; queue(0); }
    },
    stop() { stopped = true; generation++; cancel(timer); },
  };
}
