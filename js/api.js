import { config } from './config.js';
import { mockStudents } from './mock-data.js';

export class ApiError extends Error {
  constructor(code, message, uncertain = false) { super(message); this.code = code; this.uncertain = uncertain; }
}
export function isAppsScriptUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === 'https://script.google.com' && !url.username && !url.password && !url.search && !url.hash &&
      /^\/(?:macros\/s|a\/macros\/[A-Za-z0-9.-]+\/s)\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname);
  } catch { return false; }
}
export function checkedResponse(result) {
  if (!result || typeof result.ok !== 'boolean') throw new ApiError('TRANSPORT', 'Jawapan pelayan tidak sah.', true);
  if (!result.ok) throw new ApiError(result.error?.code || 'SERVER', result.error?.message || 'Operasi tidak dapat diselesaikan.', !['AUTH', 'LOGIN', 'COOLDOWN', 'VALIDATION', 'NOT_FOUND', 'CONFLICT', 'DATA', 'SCHEMA', 'SETUP', 'BUSY'].includes(result.error?.code));
  return result;
}
export function createApi({ settings = config, rpc = globalThis.google?.script?.run, fetcher = globalThis.fetch } = {}) {
  const secure = settings.dataMode === 'live' && settings.transport === 'rpc' && Boolean(rpc);
  function call(method, args) {
    if (!secure) return Promise.reject(new ApiError('ENTRY', 'Buka ruang guru yang selamat untuk menyimpan perubahan.'));
    return new Promise((resolve, reject) => {
      // A pending RPC stays pending until Google invokes a callback; no overlapping read retries.
      const runner = rpc.withSuccessHandler(resolve).withFailureHandler(() => reject(new ApiError('TRANSPORT', 'Sambungan terputus. Keputusan operasi belum dapat disahkan.', true)));
      runner[method](...args);
    }).then(checkedResponse);
  }
  return {
    secure,
    async getStudents() {
      if (settings.dataMode === 'demo') return { ok: true, data: mockStudents.map(student => ({ ...student })) };
      if (settings.dataMode !== 'live') throw new ApiError('SETUP', 'Mod data tidak sah.');
      if (settings.transport === 'rpc') return call('getStudents', []);
      if (!isAppsScriptUrl(settings.publicReadUrl)) throw new ApiError('SETUP', 'Sambungan Google Sheets belum disediakan.');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetcher(settings.publicReadUrl + '?action=getStudents&t=' + Date.now(), { signal: controller.signal, redirect: 'follow', cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error();
        return checkedResponse(await response.json());
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('TRANSPORT', 'Data terkini tidak dapat dibaca. Semak sambungan atau gunakan pautan aplikasi Google.');
      } finally { clearTimeout(timer); }
    },
    login: password => call('login', [password]),
    addStudent: (token, requestId, fields) => call('addStudent', [token, requestId, fields]),
    updateStudent: (token, id, patch) => call('updateStudent', [token, id, patch]),
    deleteStudent: (token, id) => call('deleteStudent', [token, id]),
  };
}
export const api = createApi();
export const getStudents = () => api.getStudents();

export function secureEntryUrl(settings, draft = {}) {
  if (!isAppsScriptUrl(settings.teacherUrl)) return null;
  const url = new URL(settings.teacherUrl); url.searchParams.set('view', draft.id ? 'avatar' : 'guru');
  for (const key of ['id', 'outfit', 'color']) if (typeof draft[key] === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(draft[key])) url.searchParams.set(key, draft[key]);
  return url.href;
}
