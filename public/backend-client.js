(() => {
  const TOKEN_KEY = 'sekolah-absenku-session-token-v1';
  let onDataChanged = null;
  let refreshSequence = 0;
  let token = sessionStorage.getItem(TOKEN_KEY) || '';

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const requestToken=token;
    let response;
    try{response=await fetch(path, { ...options, headers });}catch{return {isOk:false,error:{message:'Koneksi terputus. Periksa jaringan lalu coba lagi.'}};}
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok && body?.isOk !== false) {
      body = { isOk: false, error: { message: body?.error?.message || `HTTP ${response.status}` } };
    }
    if (response.status === 401 && path !== '/api/auth/login' && token===requestToken) {
      token = '';
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('absensi-session-expired'));
    }
    return body;
  }

  async function refreshData() {
    if (!token) {
      if (typeof onDataChanged === 'function') onDataChanged([]);
      return { isOk: true, data: [] };
    }
    const sequence=++refreshSequence, requestToken=token;
    const result = await api('/api/data');
    if(sequence!==refreshSequence||requestToken!==token)return result;
    if (result?.isOk && typeof onDataChanged === 'function') onDataChanged(Array.isArray(result.data) ? result.data : []);
    return result;
  }

  window.absensiBackend = {
    mode: 'cloudflare-d1',
    auth: {
      async me(){return token?api('/api/auth/me'):{isOk:false};},
      async login({ role, username, password, teacherId }) {
        const result = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ role, username, password, teacherId })
        });
        if (result?.isOk && result?.session?.token) {
          token = result.session.token;
          sessionStorage.setItem(TOKEN_KEY, token);
          await refreshData();
        }
        return result;
      },
      async logout() {
        if (token) await api('/api/auth/logout', { method: 'POST' });
        token = '';
        sessionStorage.removeItem(TOKEN_KEY);
        if (typeof onDataChanged === 'function') onDataChanged([]);
        return { isOk: true };
      }
    },
    masterData: {
      async load() {
        return api('/api/master');
      }
    },
    data: {
      refresh: refreshData,
      async init(handler) {
        onDataChanged = typeof handler === 'function' ? handler : handler?.onDataChanged;
        return refreshData();
      },
      async create(payload) {
        const result = await api('/api/data', { method: 'POST', body: JSON.stringify(payload) });
        if (result?.isOk) await refreshData();
        return result;
      },
      async update(record) {
        const result = await api('/api/data', { method: 'PUT', body: JSON.stringify(record) });
        if (result?.isOk) await refreshData();
        return result;
      },
      async delete(record) {
        const result = await api('/api/data', { method: 'DELETE', body: JSON.stringify(record) });
        if (result?.isOk) await refreshData();
        return result;
      }
    },
    admin: {
      async master(){return api('/api/admin/master');},
      async saveMaster(payload){return api('/api/admin/master',{method:'POST',body:JSON.stringify(payload)});},
      async listTeacherUsers() {
        return api('/api/admin/teacher-users');
      },
      async saveTeacherUser(payload) {
        return api('/api/admin/teacher-users', { method: 'POST', body: JSON.stringify(payload) });
      },
      async bulkCreateTeacherUsers() {
        return api('/api/admin/teacher-users/bulk', { method: 'POST', body: '{}' });
      },
      async setTeacherUserActive(teacherId, active) {
        return api('/api/admin/teacher-users/status', { method: 'PATCH', body: JSON.stringify({ teacherId, active }) });
      },
      async resetDynamicData(confirmation) {
        const result = await api('/api/admin/reset-dynamic', { method: 'POST', body: JSON.stringify({ confirmation }) });
        if (result?.isOk) {
          token = '';
          sessionStorage.removeItem(TOKEN_KEY);
          if (typeof onDataChanged === 'function') onDataChanged([]);
        }
        return result;
      }
    }
  };
})();
