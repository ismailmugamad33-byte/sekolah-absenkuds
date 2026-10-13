import { adminMaster, getSettings, teacherSubjects } from './master-data.js';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const SESSION_TTL_HOURS = 12;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return await handleHealth(env);
      }

      if (url.pathname === '/setup-admin' && request.method === 'GET') {
        return htmlResponse(adminSetupPage());
      }

      if (url.pathname === '/manage-users' && request.method === 'GET') {
        return htmlResponse(userManagementPage());
      }

      if (url.pathname.startsWith('/api/')) {
        if (!env.DB) return json({ ok: false, error: { message: 'Binding D1 DB belum tersedia.' } }, 503);
        await ensureSystemTables(env.DB);

        if (url.pathname === '/api/setup/status' && request.method === 'GET') {
          return await setupStatus(env.DB);
        }
        if (url.pathname === '/api/setup/admin' && request.method === 'POST') {
          return await setupAdmin(request, env);
        }
        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          return await login(request, env);
        }
        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(auth.sessionId).run();
          return json({ isOk: true });
        }
        if (url.pathname === '/api/admin/master') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await adminMaster(request, env.DB, auth.user);
        }
        if (url.pathname === '/api/auth/me' && request.method === 'GET') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          const u=auth.user;
          if(u.role==='Guru'){const subjects=await teacherSubjects(env.DB);u.subject=subjects.get(u.teacher_id)??u.subject;}
          return json({isOk:true,session:{role:u.role},user:{id:u.teacher_id||u.user_id,name:u.teacher_name||'Admin Akademik',subject:u.subject||'',position:u.position||'Admin'}});
        }
        if (url.pathname === '/api/master' && request.method === 'GET') {
          return await masterData(request, env.DB);
        }
        if (url.pathname === '/api/data' && request.method === 'GET') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          return await listData(env.DB, auth.user);
        }
        if (url.pathname === '/api/data' && request.method === 'POST') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          return await createData(request, env.DB, auth.user);
        }
        if (url.pathname === '/api/data' && request.method === 'PUT') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          return await updateData(request, env.DB, auth.user);
        }
        if (url.pathname === '/api/data' && request.method === 'DELETE') {
          const auth = await requireAuth(request, env.DB);
          if (!auth.ok) return auth.response;
          return await deleteData(request, env.DB, auth.user);
        }
        if (url.pathname === '/api/admin/teacher-users' && request.method === 'GET') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await listTeacherUsers(env.DB);
        }
        if (url.pathname === '/api/admin/teacher-users' && request.method === 'POST') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await saveTeacherUser(request, env.DB, env.AUTH_PEPPER);
        }
        if (url.pathname === '/api/admin/teacher-users/bulk' && request.method === 'POST') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await bulkCreateTeacherUsers(env.DB, env.AUTH_PEPPER);
        }
        if (url.pathname === '/api/admin/teacher-users/status' && request.method === 'PATCH') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await setTeacherUserStatus(request, env.DB);
        }
        if (url.pathname === '/api/admin/reset-dynamic' && request.method === 'POST') {
          const auth = await requireAdmin(request, env.DB);
          if (!auth.ok) return auth.response;
          return await resetDynamicData(request, env.DB);
        }

        return json({ ok: false, error: { message: 'Endpoint API tidak ditemukan.' } }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ ok: false, isOk: false, error: { message: 'Terjadi kendala pada server.' } }, 500);
    }
  }
};

async function handleHealth(env) {
  if (!env.DB) {
    return json({ ok: true, app: 'Sekolah Absenku', backend: 'Cloudflare Worker', database: 'binding-missing' });
  }
  try {
    await ensureSystemTables(env.DB);
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM classes) AS classes,
        (SELECT COUNT(*) FROM teachers) AS teachers,
        (SELECT COUNT(*) FROM students) AS students,
        (SELECT COUNT(*) FROM users) AS users
    `).first();
    const attendanceSchema = await env.DB.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='student_attendance'`).first();
    const schemaSql = String(attendanceSchema?.sql || '');
    const attendanceScope = /UNIQUE\s*\(\s*student_id\s*,\s*class_id\s*,\s*attendance_date\s*,\s*teacher_id\s*,\s*subject\s*\)/i.test(schemaSql)?'per-teacher-subject': /UNIQUE\s*\(\s*student_id\s*,\s*class_id\s*,\s*attendance_date\s*,\s*teacher_id\s*\)/i.test(schemaSql)
      ? 'per-teacher'
      : 'legacy';
    const masterSchema=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('app_settings','sk_staff','teaching_assignments')").first();
    return json({
      ok: true,
      academic_schema: (await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('teacher_subject_overrides','academic_events','academic_operations')").first())?.n===3?'ready':'missing',
      master_schema: Number(masterSchema?.n)===3?'ready':'missing',
      app: 'Sekolah Absenku',
      backend: 'Cloudflare Worker',
      database: 'connected',
      auth_secret: env.AUTH_PEPPER ? 'configured' : 'missing',
      attendance_scope: attendanceScope,
      counts
    });
  } catch (error) {
    return json({ ok: false, app: 'Sekolah Absenku', backend: 'Cloudflare Worker', database: 'error', error: String(error?.message || error) }, 500);
  }
}

async function ensureSystemTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)').run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_teacher_unique ON users(teacher_id) WHERE teacher_id IS NOT NULL').run();
}

async function setupStatus(db) {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM users ').first();
  return json({ ok: true, needsAdmin: Number(row?.total || 0) === 0 });
}

async function setupAdmin(request, env) {
  const db = env.DB;
  if (!env.AUTH_PEPPER) return json({ isOk: false, error: { message: 'Secret AUTH_PEPPER belum dikonfigurasi di Cloudflare.' } }, 503);
  const current = await db.prepare('SELECT COUNT(*) AS total FROM users').first();
  if (Number(current?.total || 0) > 0) {
    return json({ isOk: false, error: { message: 'Setup awal sudah ditutup karena akun pengguna sudah ada.' } }, 409);
  }

  const body = await readJson(request);
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!validUsername(username)) return json({ isOk: false, error: { message: 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.' } }, 400);
  if (password.length < 10) return json({ isOk: false, error: { message: 'Kata sandi minimal 10 karakter.' } }, 400);

  const passwordHash = await hashPassword(password, env.AUTH_PEPPER);
  await db.prepare(`
    INSERT INTO users (id, username, password_hash, role, teacher_id, active)
    VALUES (?, ?, ?, 'Admin', NULL, 1)
  `).bind('ADM001', username, passwordHash).run();

  return json({ isOk: true, message: 'Akun Admin berhasil dibuat.', username });
}

async function login(request, env) {
  const db = env.DB;
  if (!env.AUTH_PEPPER) return json({ isOk: false, error: { message: 'Secret autentikasi server belum dikonfigurasi.' } }, 503);
  const body = await readJson(request);
  const requestedRole = String(body.role || '').trim();
  const username = String(body.username || body.teacherId || '').trim().toLowerCase();
  const password = String(body.password || '');
  const teacherId = String(body.teacherId || '').trim();

  if (!username || !password) {
    return authError('Username dan kata sandi wajib diisi.');
  }

  const user = await db.prepare(`
    SELECT u.id AS user_id, u.username, u.password_hash, u.role, u.teacher_id, u.active,
           t.id AS t_id, t.name AS teacher_name, t.subject, t.position, t.active AS teacher_active
    FROM users u
    LEFT JOIN teachers t ON t.id = u.teacher_id
    WHERE lower(u.username) = lower(?)
    LIMIT 1
  `).bind(username).first();

  if (!user || Number(user.active) !== 1 || !(await verifyPassword(password, user.password_hash, env.AUTH_PEPPER))) {
    return authError('Username atau kata sandi salah.');
  }
  if (user.role === 'Guru' && Number(user.teacher_active) !== 1) return authError('Data guru sudah dinonaktifkan.');
  if (requestedRole && user.role !== requestedRole) return authError('Jenis akses tidak sesuai dengan akun ini.');
  if (user.role === 'Guru' && teacherId && user.teacher_id !== teacherId) return authError('Akun guru yang dipilih tidak sesuai.');

  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  const sessionId = crypto.randomUUID();
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600000).toISOString();
  await db.prepare('INSERT INTO sessions (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, tokenHash, user.user_id, expiresAt).run();

  if(user.role==='Guru') { const subjects=await teacherSubjects(db); user.subject=subjects.get(user.teacher_id)??user.subject; }
  const profile = user.role === 'Guru'
    ? { id: user.t_id, name: user.teacher_name, subject: user.subject || '', position: user.position || 'Guru' }
    : { id: user.user_id, name: 'Admin Akademik', subject: 'Administrasi', position: 'Admin' };

  return json({
    isOk: true,
    user: profile,
    session: { id: sessionId, token, role: user.role, expiresAt }
  });
}

async function masterData(request, db) {
  const teachersResult = await db.prepare(`
    SELECT id, name, subject, position
    FROM teachers
    WHERE active = 1
    ORDER BY id
  `).all();
  const subjects=await teacherSubjects(db);
  const settings=await getSettings(db);
  const teachers = (teachersResult.results || []).map((t, index) => ({ ...t, subject:subjects.get(t.id)??t.subject, no: index + 1 }));

  const auth = await optionalAuth(request, db);
  if (!auth) return json({ isOk: true, teachers, settings, students: [] });

  const studentsResult = await db.prepare(`
    SELECT s.id, s.nis, s.nisn, s.name, c.name AS class_name, c.level
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.active = 1 AND c.active = 1
    ORDER BY c.name, s.name
  `).all();
  const students = (studentsResult.results || []).map((s, index) => ({
    id: s.id,
    displayId: s.nisn || s.nis || '',
    name: s.name,
    className: s.class_name,
    level: s.level,
    no: index + 1
  }));

  const classes=(await db.prepare('SELECT id,name,level FROM classes WHERE active=1 ORDER BY name').all()).results||[];
  return json({ isOk: true, teachers, students, classes, settings });
}

async function listData(db, user) {
  const studentAttendanceSql = user.role === 'Admin'
    ? `SELECT sa.id, sa.attendance_date, sa.status, sa.note, sa.time_in, sa.time_out, sa.created_at, sa.subject,
              s.id AS student_id, s.name AS student_name,
              c.name AS class_name,
              t.id AS teacher_id, t.name AS teacher_name
       FROM student_attendance sa
       JOIN students s ON s.id = sa.student_id
       JOIN classes c ON c.id = sa.class_id
       JOIN teachers t ON t.id = sa.teacher_id
       ORDER BY sa.attendance_date DESC, t.name, s.name`
    : `SELECT sa.id, sa.attendance_date, sa.status, sa.note, sa.time_in, sa.time_out, sa.created_at, sa.subject,
              s.id AS student_id, s.name AS student_name,
              c.name AS class_name,
              t.id AS teacher_id, t.name AS teacher_name
       FROM student_attendance sa
       JOIN students s ON s.id = sa.student_id
       JOIN classes c ON c.id = sa.class_id
       JOIN teachers t ON t.id = sa.teacher_id
       WHERE sa.teacher_id = ?
       ORDER BY sa.attendance_date DESC, s.name`;
  const studentAttendance = user.role === 'Admin'
    ? await db.prepare(studentAttendanceSql).all()
    : await db.prepare(studentAttendanceSql).bind(user.teacher_id).all();

  const teacherAttendanceSql = user.role === 'Admin'
    ? `SELECT ta.id, ta.attendance_date, ta.check_in, ta.check_out, ta.note, ta.created_at,
              t.id AS teacher_id, t.name AS teacher_name, t.subject
       FROM teacher_attendance ta JOIN teachers t ON t.id = ta.teacher_id
       ORDER BY ta.attendance_date DESC, t.name`
    : `SELECT ta.id, ta.attendance_date, ta.check_in, ta.check_out, ta.note, ta.created_at,
              t.id AS teacher_id, t.name AS teacher_name, t.subject
       FROM teacher_attendance ta JOIN teachers t ON t.id = ta.teacher_id
       WHERE ta.teacher_id = ? ORDER BY ta.attendance_date DESC`;
  const teacherAttendance = user.role === 'Admin'
    ? await db.prepare(teacherAttendanceSql).all()
    : await db.prepare(teacherAttendanceSql).bind(user.teacher_id).all();

  const journalSql = user.role === 'Admin'
    ? `SELECT j.id, j.journal_date, j.material, j.start_time, j.end_time, j.duration_minutes, j.challenges, j.created_at, j.subject, j.class_name,
              t.id AS teacher_id, t.name AS teacher_name
       FROM teacher_journals j JOIN teachers t ON t.id = j.teacher_id
       ORDER BY j.journal_date DESC, t.name`
    : `SELECT j.id, j.journal_date, j.material, j.start_time, j.end_time, j.duration_minutes, j.challenges, j.created_at, j.subject, j.class_name,
              t.id AS teacher_id, t.name AS teacher_name
       FROM teacher_journals j JOIN teachers t ON t.id = j.teacher_id
       WHERE j.teacher_id = ? ORDER BY j.journal_date DESC`;
  const journals = user.role === 'Admin'
    ? await db.prepare(journalSql).all()
    : await db.prepare(journalSql).bind(user.teacher_id).all();

  const subjects=await teacherSubjects(db);
  for(const r of (teacherAttendance.results||[]))r.subject=subjects.get(r.teacher_id)??r.subject;
  const records = [
    ...(studentAttendance.results || []).map(mapStudentAttendance),
    ...(teacherAttendance.results || []).map(mapTeacherAttendance),
    ...(journals.results || []).map(mapJournal)
  ];

  return json({ isOk: true, data: records });
}

async function createData(request, db, user) {
  const payload = await readJson(request);
  const type = String(payload.record_type || '').trim();
  if (type === 'attendance_student') return createStudentAttendance(db, user, payload);
  if (type === 'attendance_teacher') return createTeacherAttendance(db, user, payload);
  if (type === 'teacher_journal') return createJournal(db, user, payload);
  return json({ isOk: false, error: { message: 'Jenis data tidak didukung.' } }, 400);
}

async function validSubject(db, teacherId, subject) {
  const subjects=(await teacherSubjects(db)).get(teacherId)||'';
  return Boolean(subject)&&subjects.split(/[;&]/).map(s=>s.trim()).filter(Boolean).includes(subject);
}
async function validJournalClass(db, name) {
  return Boolean(name)&&Boolean(await db.prepare('SELECT id FROM classes WHERE name=? AND active=1').bind(name).first());
}

async function createStudentAttendance(db, user, payload) {
  if (user.role !== 'Guru') return forbidden();
  const studentId = String(payload.student_number || '').trim();
  const date = String(payload.attendance_date || '').trim();
  const status = String(payload.status || '').trim();
  const className = String(payload.class_name || '').trim();
  const subject=String(payload.subject||'').trim();
  if(!await validSubject(db,user.teacher_id,subject))return badRequest('Pilih satu mapel yang terdaftar pada akun guru.');
  if (!studentId || !validDate(date) || !['H','S','I','A','D'].includes(status)) return badRequest('Data absensi siswa tidak lengkap.');

  const relation = await db.prepare(`
    SELECT s.id AS student_id, c.id AS class_id, c.name AS class_name
    FROM students s JOIN classes c ON c.id = s.class_id
    WHERE s.id = ? AND c.name = ? AND s.active = 1 AND c.active=1
    LIMIT 1
  `).bind(studentId, className).first();
  if (!relation) return badRequest('Siswa atau kelas tidak ditemukan pada master data.');

  const [timeIn, timeOut] = [null, null]; // Jam siswa dikelola Admin.
  const id = crypto.randomUUID();
  try {
    await db.prepare(`
      INSERT INTO student_attendance
      (id, student_id, class_id, teacher_id, attendance_date, status, note, time_in, time_out, subject)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, relation.student_id, relation.class_id, user.teacher_id, date, status, String(payload.display_name || '').trim(), timeIn, timeOut, subject).run();
  } catch (error) {
    if (/UNIQUE|constraint/i.test(String(error?.message || error))) return json({ isOk: false, error: { message: 'Absensi siswa oleh guru ini pada kelas, tanggal, dan mapel tersebut sudah ada.' } }, 409);
    throw error;
  }
  return getMappedRecord(db, `sa:${id}`, user);
}

async function createTeacherAttendance(db, user, payload) {
  if (user.role !== 'Guru') return forbidden();
  const date = String(payload.attendance_date || '').trim();
  if (!validDate(date)) return badRequest('Tanggal kehadiran guru tidak valid.');
  if (!validTimePair(payload.check_in_time, true)) return badRequest('Jam masuk dan keluar wajib valid; jam keluar tidak boleh lebih awal.');
  const [checkIn, checkOut] = splitTimes(payload.check_in_time);
  const id = crypto.randomUUID();
  try {
    await db.prepare(`
      INSERT INTO teacher_attendance (id, teacher_id, attendance_date, check_in, check_out, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, user.teacher_id, date, checkIn, checkOut, String(payload.display_name || 'Kehadiran guru')).run();
  } catch (error) {
    if (/UNIQUE|constraint/i.test(String(error?.message || error))) return json({ isOk: false, error: { message: 'Kehadiran guru untuk tanggal tersebut sudah ada.' } }, 409);
    throw error;
  }
  return getMappedRecord(db, `ta:${id}`, user);
}

async function createJournal(db, user, payload) {
  if (user.role !== 'Guru') return forbidden();
  const date = String(payload.attendance_date || '').trim();
  const subject=String(payload.subject||'').trim(),className=String(payload.class_name||'').trim();
  if(!await validSubject(db,user.teacher_id,subject))return badRequest('Pilih satu mapel yang terdaftar pada akun guru.');
  if(!await validJournalClass(db,className))return badRequest('Pilih kelas aktif untuk jurnal.');
  const material = String(payload.journal_material || '').trim();
  const start = String(payload.teaching_start || '').trim();
  const end = String(payload.teaching_end || '').trim();
  if (!validDate(date) || !material || !validTime(start) || !validTime(end) || end <= start) return badRequest('Data jurnal tidak lengkap atau jam mengajar tidak valid.');
  const id = crypto.randomUUID();
  const duration = durationMinutes(start, end);
  await db.prepare(`
    INSERT INTO teacher_journals
    (id, teacher_id, journal_date, material, start_time, end_time, duration_minutes, challenges, subject, class_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.teacher_id, date, material, start, end, duration, String(payload.teaching_challenges || '').trim(),subject,className).run();
  return getMappedRecord(db, `tj:${id}`, user);
}

async function updateData(request, db, user) {
  const payload = await readJson(request);
  const ref = parseBackendId(payload.__backendId);
  if (!ref) return badRequest('Record ID tidak valid.');

  if (ref.kind === 'sa') {
    const existing = await db.prepare('SELECT * FROM student_attendance WHERE id = ?').bind(ref.id).first();
    if (!existing) return notFound();
    if (user.role !== 'Admin' && existing.teacher_id !== user.teacher_id) return forbidden();
    if(Object.hasOwn(payload,'subject')&&String(payload.subject)!==existing.subject)return badRequest('Mapel absensi tersimpan tidak dapat diubah. Pilih mapel di halaman absensi untuk catatan terpisah.');
    const status = String(payload.status || existing.status);
    const date = String(payload.attendance_date || existing.attendance_date);
    if (!['H','S','I','A','D'].includes(status) || !validDate(date)) return badRequest('Tanggal atau status tidak valid.');
    const changeTimes = user.role === 'Admin' && Object.hasOwn(payload,'check_in_time');
    if(changeTimes && !validTimePair(payload.check_in_time, false)) return badRequest('Format atau urutan jam siswa tidak valid.');
    const [timeIn, timeOut] = changeTimes ? splitTimes(payload.check_in_time) : [existing.time_in, existing.time_out];
    try {
      await db.prepare(`UPDATE student_attendance SET attendance_date=?, status=?, note=?, time_in=?, time_out=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(date, status, String(payload.display_name ?? existing.note ?? ''), timeIn, timeOut, ref.id).run();
    } catch (error) {
      if (/UNIQUE|constraint/i.test(String(error?.message || error))) return json({ isOk: false, error: { message: 'Absensi siswa oleh guru yang sama pada kelas, tanggal, dan mapel tersebut sudah ada.' } }, 409);
      throw error;
    }
    return getMappedRecord(db, payload.__backendId, user);
  }

  if (ref.kind === 'ta') {
    const existing = await db.prepare('SELECT * FROM teacher_attendance WHERE id = ?').bind(ref.id).first();
    if (!existing) return notFound();
    if (user.role !== 'Admin' && existing.teacher_id !== user.teacher_id) return forbidden();
    const date = String(payload.attendance_date || existing.attendance_date);
    const times=Object.hasOwn(payload,'check_in_time')?payload.check_in_time:`${existing.check_in||''}|${existing.check_out||''}`;
    if(!validDate(date)||!validTimePair(times,true)) return badRequest('Tanggal atau jam kehadiran guru tidak valid.');
    const [checkIn, checkOut] = splitTimes(times);
    await db.prepare(`UPDATE teacher_attendance SET attendance_date=?, check_in=?, check_out=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(date, checkIn, checkOut, String(payload.display_name || existing.note || ''), ref.id).run();
    return getMappedRecord(db, payload.__backendId, user);
  }

  if (ref.kind === 'tj') {
    const existing = await db.prepare('SELECT * FROM teacher_journals WHERE id = ?').bind(ref.id).first();
    if (!existing) return notFound();
    if (user.role !== 'Guru' || existing.teacher_id !== user.teacher_id) return forbidden();
    const subject=String(payload.subject??existing.subject).trim(),className=String(payload.class_name??existing.class_name).trim();
    if(subject!==existing.subject&&!await validSubject(db,user.teacher_id,subject))return badRequest('Mapel jurnal tidak terdaftar pada guru.');
    if(className!==existing.class_name&&!await validJournalClass(db,className))return badRequest('Kelas jurnal tidak aktif atau tidak ditemukan.');
    const date = String(payload.attendance_date || existing.journal_date);
    const material = String(payload.journal_material || existing.material);
    const start = String(payload.teaching_start || existing.start_time);
    const end = String(payload.teaching_end || existing.end_time);
    if (!validDate(date) || !material || !validTime(start) || !validTime(end) || end <= start) return badRequest('Data jurnal tidak valid.');
    await db.prepare(`UPDATE teacher_journals SET subject=?, class_name=?, journal_date=?, material=?, start_time=?, end_time=?, duration_minutes=?, challenges=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(subject,className,date, material, start, end, durationMinutes(start,end), String(payload.teaching_challenges || ''), ref.id).run();
    return getMappedRecord(db, payload.__backendId, user);
  }

  return badRequest('Jenis record tidak didukung.');
}

async function deleteData(request, db, user) {
  const payload = await readJson(request);
  const ref = parseBackendId(payload.__backendId);
  if (!ref) return badRequest('Record ID tidak valid.');

  if (ref.kind === 'sa') {
    const row = await db.prepare('SELECT teacher_id FROM student_attendance WHERE id=?').bind(ref.id).first();
    if (!row) return notFound();
    if (user.role !== 'Admin' && row.teacher_id !== user.teacher_id) return forbidden();
    await db.prepare('DELETE FROM student_attendance WHERE id=?').bind(ref.id).run();
  } else if (ref.kind === 'ta') {
    const row = await db.prepare('SELECT teacher_id FROM teacher_attendance WHERE id=?').bind(ref.id).first();
    if (!row) return notFound();
    if (user.role !== 'Admin' && row.teacher_id !== user.teacher_id) return forbidden();
    await db.prepare('DELETE FROM teacher_attendance WHERE id=?').bind(ref.id).run();
  } else if (ref.kind === 'tj') {
    const row = await db.prepare('SELECT teacher_id FROM teacher_journals WHERE id=?').bind(ref.id).first();
    if (!row) return notFound();
    if (user.role !== 'Guru' || row.teacher_id !== user.teacher_id) return forbidden();
    await db.prepare('DELETE FROM teacher_journals WHERE id=?').bind(ref.id).run();
  } else {
    return badRequest('Jenis record tidak didukung.');
  }
  return json({ isOk: true });
}

async function resetDynamicData(request, db) {
  const body = await readJson(request);
  if (String(body.confirmation || '') !== 'HAPUS SEMUA DATA') {
    return json({ isOk: false, error: { message: 'Konfirmasi reset tidak valid.' } }, 400);
  }

  const before = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM student_attendance) AS student_attendance,
      (SELECT COUNT(*) FROM teacher_attendance) AS teacher_attendance,
      (SELECT COUNT(*) FROM teacher_journals) AS teacher_journals,
      (SELECT COUNT(*) FROM sessions) AS sessions
  `).first();

  await db.batch([
    db.prepare('DELETE FROM student_attendance'),
    db.prepare('DELETE FROM teacher_attendance'),
    db.prepare('DELETE FROM teacher_journals'),
    db.prepare('DELETE FROM sessions')
  ]);

  return json({
    isOk: true,
    message: 'Seluruh data dinamis berhasil dihapus.',
    deleted: {
      student_attendance: Number(before?.student_attendance || 0),
      teacher_attendance: Number(before?.teacher_attendance || 0),
      teacher_journals: Number(before?.teacher_journals || 0),
      sessions: Number(before?.sessions || 0)
    },
    sessionCleared: true
  });
}

async function getMappedRecord(db, backendId, user) {
  const ref = parseBackendId(backendId);
  if (!ref) return badRequest('Record ID tidak valid.');
  let row;
  if (ref.kind === 'sa') {
    row = await db.prepare(`
      SELECT sa.id, sa.attendance_date, sa.status, sa.note, sa.time_in, sa.time_out, sa.created_at, sa.subject,
             s.id AS student_id, s.name AS student_name, c.name AS class_name,
             t.id AS teacher_id, t.name AS teacher_name
      FROM student_attendance sa JOIN students s ON s.id=sa.student_id JOIN classes c ON c.id=sa.class_id JOIN teachers t ON t.id=sa.teacher_id
      WHERE sa.id=?
    `).bind(ref.id).first();
    return json({ isOk: true, data: mapStudentAttendance(row) });
  }
  if (ref.kind === 'ta') {
    row = await db.prepare(`SELECT ta.id, ta.attendance_date, ta.check_in, ta.check_out, ta.note, ta.created_at, t.id AS teacher_id, t.name AS teacher_name, t.subject FROM teacher_attendance ta JOIN teachers t ON t.id=ta.teacher_id WHERE ta.id=?`).bind(ref.id).first();
    row.subject=(await teacherSubjects(db)).get(row.teacher_id)??row.subject;
    return json({ isOk: true, data: mapTeacherAttendance(row) });
  }
  row = await db.prepare(`SELECT j.id, j.journal_date, j.material, j.start_time, j.end_time, j.duration_minutes, j.challenges, j.created_at, j.subject, j.class_name, t.id AS teacher_id, t.name AS teacher_name FROM teacher_journals j JOIN teachers t ON t.id=j.teacher_id WHERE j.id=?`).bind(ref.id).first();
  return json({ isOk: true, data: mapJournal(row) });
}

function mapStudentAttendance(r) {
  return {
    __backendId: `sa:${r.id}`,
    record_type: 'attendance_student',
    attendance_date: r.attendance_date,
    student_number: r.student_id,
    student_name: r.student_name,
    class_name: r.class_name,
    status: r.status,
    check_in_time: `${r.time_in || ''}|${r.time_out || ''}`,
    display_name: r.note || '',
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name,
    subject: r.subject || '',
    input_by: `${r.teacher_name} (${r.teacher_id})`,
    created_at: r.created_at
  };
}

function mapTeacherAttendance(r) {
  return {
    __backendId: `ta:${r.id}`,
    record_type: 'attendance_teacher',
    attendance_date: r.attendance_date,
    student_number: r.teacher_id,
    student_name: r.teacher_name,
    class_name: '',
    status: 'H',
    check_in_time: `${r.check_in || ''}|${r.check_out || ''}`,
    display_name: r.note || 'Kehadiran guru',
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name,
    subject: r.subject || '',
    input_by: r.teacher_name,
    created_at: r.created_at
  };
}

function mapJournal(r) {
  return {
    __backendId: `tj:${r.id}`,
    record_type: 'teacher_journal',
    subject: r.subject||'',
    class_name: r.class_name||'',
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name,
    attendance_date: r.journal_date,
    journal_material: r.material,
    teaching_start: r.start_time,
    teaching_end: r.end_time,
    teaching_duration: durationLabel(r.duration_minutes),
    teaching_challenges: r.challenges || '',
    created_at: r.created_at
  };
}

async function listTeacherUsers(db) {
  const result = await db.prepare(`
    SELECT t.id, t.name, t.subject, u.username, u.active AS user_active
    FROM teachers t LEFT JOIN users u ON u.teacher_id=t.id
    WHERE t.active=1 ORDER BY t.id
  `).all();
  return json({ isOk: true, teachers: result.results || [] });
}

async function saveTeacherUser(request, db, pepper) {
  if (!pepper) return json({ isOk: false, error: { message: 'Secret autentikasi server belum dikonfigurasi.' } }, 503);
  const body = await readJson(request);
  const teacherId = String(body.teacherId || '').trim();
  const username = String(body.username || teacherId).trim().toLowerCase();
  const password = String(body.password || '');
  if (!teacherId || !validUsername(username)) return badRequest('Data akun guru tidak valid.');
  if (password.length < 10) return badRequest('Kata sandi guru minimal 10 karakter.');
  const teacher = await db.prepare('SELECT id FROM teachers WHERE id=? AND active=1').bind(teacherId).first();
  if (!teacher) return notFound('Guru tidak ditemukan.');
  const conflict = await db.prepare('SELECT id FROM users WHERE lower(username)=lower(?) AND (teacher_id IS NULL OR teacher_id<>?)').bind(username,teacherId).first();
  if(conflict) return json({isOk:false,error:{message:'Username sudah digunakan akun lain.'}},409);
  const passwordHash = await hashPassword(password, pepper);
  const existing = await db.prepare('SELECT id FROM users WHERE teacher_id=? LIMIT 1').bind(teacherId).first();
  if (existing) {
    await db.batch([db.prepare(`UPDATE users SET username=?, password_hash=?, role='Guru', active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(username,passwordHash,existing.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(existing.id)]);
  } else {
    await db.prepare(`INSERT INTO users (id, username, password_hash, role, teacher_id, active) VALUES (?, ?, ?, 'Guru', ?, 1)`)
      .bind(`USR-${teacherId}`, username, passwordHash, teacherId).run();
  }
  return json({ isOk: true, teacherId, username });
}

async function bulkCreateTeacherUsers(db, pepper) {
  if (!pepper) return json({ isOk: false, error: { message: 'Secret autentikasi server belum dikonfigurasi.' } }, 503);
  const result = await db.prepare(`
    SELECT t.id, t.name
    FROM teachers t
    LEFT JOIN users u ON u.teacher_id=t.id
    WHERE t.active=1 AND u.id IS NULL
    ORDER BY t.id
  `).all();
  const missing = result.results || [];
  const credentials = [];
  for (const teacher of missing) {
    const username = String(teacher.id).toLowerCase();
    const password = `Ds-${randomToken(9)}`;
    const passwordHash = await hashPassword(password, pepper);
    await db.prepare(`INSERT INTO users (id, username, password_hash, role, teacher_id, active) VALUES (?, ?, ?, 'Guru', ?, 1)`)
      .bind(`USR-${teacher.id}`, username, passwordHash, teacher.id).run();
    credentials.push({ teacherId: teacher.id, name: teacher.name, username, password });
  }
  return json({ isOk: true, created: credentials.length, credentials });
}

async function setTeacherUserStatus(request, db) {
  const body = await readJson(request);
  const teacherId = String(body.teacherId || '').trim();
  const active = body.active === true || body.active === 1 || body.active === '1';
  if (!teacherId) return badRequest('ID guru wajib diisi.');
  const user = await db.prepare(`SELECT id FROM users WHERE teacher_id=? AND role='Guru' LIMIT 1`).bind(teacherId).first();
  if (!user) return notFound('Akun guru belum dibuat.');
  await db.prepare('UPDATE users SET active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(active ? 1 : 0, user.id).run();
  if (!active) await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
  return json({ isOk: true, teacherId, active });
}

async function requireAdmin(request, db) {
  const auth = await requireAuth(request, db);
  if (!auth.ok) return auth;
  if (auth.user.role !== 'Admin') return { ok: false, response: forbidden() };
  return auth;
}

async function requireAuth(request, db) {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: json({ isOk: false, error: { kind: 'auth', message: 'Sesi login diperlukan.' } }, 401) };
  const user = await sessionUser(db, token);
  if (!user) return { ok: false, response: json({ isOk: false, error: { kind: 'auth', message: 'Sesi sudah berakhir. Silakan login kembali.' } }, 401) };
  return { ok: true, user, sessionId: user.session_id };
}

async function optionalAuth(request, db) {
  const token = bearerToken(request);
  if (!token) return null;
  return sessionUser(db, token);
}

async function sessionUser(db, token) {
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const row = await db.prepare(`
    SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.username, u.role, u.teacher_id, u.active,
           t.name AS teacher_name, t.subject, t.position
    FROM sessions s JOIN users u ON u.id=s.user_id
    LEFT JOIN teachers t ON t.id=u.teacher_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND (u.role='Admin' OR t.active=1) LIMIT 1
  `).bind(tokenHash, now).first();
  return row || null;
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await hmacSha256(pepper, concatBytes(salt, new TextEncoder().encode(password)));
  return `hmac-sha256$${bytesToBase64Url(salt)}$${bytesToBase64Url(digest)}`;
}

async function verifyPassword(password, stored, pepper) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'hmac-sha256' || !pepper) return false;
  const salt = base64UrlToBytes(parts[1]);
  const expected = base64UrlToBytes(parts[2]);
  const actual = await hmacSha256(pepper, concatBytes(salt, new TextEncoder().encode(password)));
  return timingSafeEqual(actual, expected);
}

let hmacKeyPromise = null;
let hmacKeySecret = '';
async function hmacSha256(secret, data) {
  if (!hmacKeyPromise || hmacKeySecret !== secret) {
    hmacKeySecret = secret;
    hmacKeyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  const key = await hmacKeyPromise;
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function randomToken(length) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function splitTimes(value) {
  const [a = '', b = ''] = String(value || '|').split('|');
  return [validTime(a) ? a : null, validTime(b) ? b : null];
}

function durationMinutes(start, end) {
  if (!validTime(start) || !validTime(end)) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function durationLabel(minutes) {
  const n = Number(minutes || 0);
  const h = Math.floor(n / 60), m = n % 60;
  return h ? `${h} jam${m ? ` ${m} menit` : ''}` : `${m} menit`;
}

function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>'2200-12-31') return false;
  const d=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
function validTimePair(value, required) {
  const parts=String(value??'|').split('|');
  if(parts.length!==2) return false;
  const [a,b]=parts;
  if(required&&(!a||!b)) return false;
  return (!a||validTime(a))&&(!b||validTime(b))&&(!a||!b||b>=a);
}
function validTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function validUsername(value) { return /^[a-z0-9._-]{3,64}$/i.test(value); }
function parseBackendId(value) {
  const match = String(value || '').match(/^(sa|ta|tj):([a-zA-Z0-9-]+)$/);
  return match ? { kind: match[1], id: match[2] } : null;
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function authError(message) { return json({ isOk: false, error: { kind: 'auth', message } }, 401); }
function badRequest(message) { return json({ isOk: false, error: { message } }, 400); }
function forbidden() { return json({ isOk: false, error: { message: 'Anda tidak memiliki izin untuk tindakan ini.' } }, 403); }
function notFound(message = 'Data tidak ditemukan.') { return json({ isOk: false, error: { message } }, 404); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function htmlResponse(html, status = 200) { return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } }); }

function adminSetupPage() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup Admin · Sekolah Absenku</title><style>body{font-family:Arial,sans-serif;background:#f4f8fc;color:#17324d;margin:0;padding:24px}.card{max-width:520px;margin:7vh auto;background:#fff;border:1px solid #dce7f1;border-radius:18px;padding:28px;box-shadow:0 8px 28px #143f6e14}label{display:block;font-weight:700;font-size:13px;margin:16px 0 6px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px}button{width:100%;margin-top:20px;padding:13px;border:0;border-radius:10px;background:#1769e0;color:#fff;font-weight:700;font-size:16px;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}.muted{font-size:13px;color:#64748b;line-height:1.5}.ok{color:#166534}.err{color:#b91c1c}</style></head><body><main class="card"><h1>Setup Admin Pertama</h1><p class="muted">Halaman ini hanya dapat dipakai ketika tabel <b>users</b> masih kosong. Setelah akun Admin dibuat, setup akan terkunci otomatis.</p><form id="f"><label>Username Admin</label><input id="u" value="admin.akademik" autocomplete="username" required><label>Kata sandi baru</label><input id="p" type="password" minlength="10" autocomplete="new-password" required><label>Ulangi kata sandi</label><input id="p2" type="password" minlength="10" autocomplete="new-password" required><button id="b">Buat Akun Admin</button></form><p id="m" class="muted"></p></main><script>const f=document.getElementById('f'),m=document.getElementById('m'),b=document.getElementById('b'),u=document.getElementById('u'),p=document.getElementById('p'),p2=document.getElementById('p2');f.addEventListener('submit',async e=>{e.preventDefault();const password=p.value;if(password!==p2.value){m.className='err';m.textContent='Kata sandi tidak sama.';return}b.disabled=true;m.className='muted';m.textContent='Menyimpan...';const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const r=await fetch('/api/setup/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u.value,password}),signal:c.signal});let j={};try{j=await r.json()}catch{}if(r.ok&&j.isOk){m.className='ok';m.innerHTML='Akun Admin berhasil dibuat. <a href="/">Kembali ke aplikasi</a>.';f.style.display='none'}else{m.className='err';m.textContent=j.error?.message||('Setup gagal. HTTP '+r.status)}}catch(err){m.className='err';m.textContent=err.name==='AbortError'?'Server terlalu lama merespons. Periksa konfigurasi Worker.':'Tidak dapat menghubungi server.'}finally{clearTimeout(timer);b.disabled=false}});</script></body></html>`;
}

function userManagementPage() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Akun Guru · Sekolah Absenku</title><style>body{font-family:Arial,sans-serif;background:#f4f8fc;color:#17324d;margin:0;padding:24px}.card{max-width:760px;margin:4vh auto;background:#fff;border:1px solid #dce7f1;border-radius:18px;padding:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}label{display:block;font-weight:700;font-size:13px;margin:12px 0 6px}input,select{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px}button{margin-top:18px;padding:12px 18px;border:0;border-radius:9px;background:#1769e0;color:white;font-weight:700}.muted{font-size:13px;color:#64748b}.ok{color:#166534}.err{color:#b91c1c}@media(max-width:600px){.grid{grid-template-columns:1fr}}</style></head><body><main class="card"><h1>Kelola Akun Guru</h1><p class="muted">Login dulu sebagai Admin pada aplikasi di tab yang sama. Halaman ini membaca sesi Admin dari sessionStorage.</p><form id="f"><div class="grid"><div><label>Guru</label><select id="t" required></select></div><div><label>Username</label><input id="u" required></div></div><label>Kata sandi / kata sandi baru</label><input id="p" type="password" minlength="10" required><button>Simpan Akun Guru</button></form><p id="m" class="muted"></p></main><script>const key='sekolah-absenku-session-token-v1',token=sessionStorage.getItem(key)||'',t=document.getElementById('t'),u=document.getElementById('u'),p=document.getElementById('p'),m=document.getElementById('m');async function load(){if(!token){m.className='err';m.textContent='Belum ada sesi Admin. Login ke aplikasi terlebih dahulu.';return}const r=await fetch('/api/admin/teacher-users',{headers:{authorization:'Bearer '+token}}),j=await r.json();if(!j.isOk){m.className='err';m.textContent=j.error?.message||'Tidak dapat membaca data.';return}t.innerHTML=j.teachers.map(x=>'<option value="'+x.id+'">'+x.id+' — '+x.name+(x.username?' · akun: '+x.username:'')+'</option>').join('');u.value=t.value;t.onchange=()=>u.value=t.value}document.getElementById('f').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/admin/teacher-users',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({teacherId:t.value,username:u.value,password:p.value})}),j=await r.json();m.className=j.isOk?'ok':'err';m.textContent=j.isOk?'Akun guru berhasil disimpan.':(j.error?.message||'Gagal menyimpan akun.');if(j.isOk){p.value='';load()}};load();</script></body></html>`;
}
