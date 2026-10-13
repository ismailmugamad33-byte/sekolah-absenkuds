import {academicLog,parseSubjects,saveSubjects,promoteStudents} from './academic.js';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(message,status=400)=>response({isOk:false,error:{message}},status);
const clean=v=>String(v??'').trim();

export async function getSettings(db) {
  const rows=(await db.prepare('SELECT key,value FROM app_settings').all()).results||[];
  const value=Object.fromEntries(rows.map(r=>[r.key,r.value]));
  const academicYearStart=Number(value.academicYearStart)||2026;
  return {academicYearStart,academicYear:`${academicYearStart}/${academicYearStart+1}`,semester:Number(value.semester)||1};
}

export async function teacherSubjects(db) {
  const teachers=(await db.prepare('SELECT id,subject FROM teachers').all()).results||[];
  const settings=await getSettings(db);
  const assignments=(await db.prepare('SELECT teacher_id,subject FROM teaching_assignments WHERE academic_year=? AND semester=? ORDER BY id').bind(settings.academicYear,settings.semester).all()).results||[];
  const map=new Map(teachers.map(t=>[t.id,[t.subject].filter(Boolean)]));
  for(const a of assignments){const parts=map.get(a.teacher_id)||[];if(!parts.includes(a.subject))parts.push(a.subject);map.set(a.teacher_id,parts);}
  const overrides=(await db.prepare('SELECT teacher_id,subjects_json FROM teacher_subject_overrides WHERE academic_year=? AND semester=?').bind(settings.academicYear,settings.semester).all()).results||[];
  for(const r of overrides)map.set(r.teacher_id,JSON.parse(r.subjects_json));
  return new Map([...map].map(([id,subjects])=>[id,parseSubjects(subjects.flatMap(s=>s.split(/[;&]/))).join('; ')]));
}

export async function adminMaster(request,db,actor) {
  if(request.method==='GET'){
    const results=await Promise.all(['teachers','students','classes','sk_staff','teaching_assignments'].map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY ${t==='sk_staff'?'source_no':t==='teaching_assignments'?'id':'name'}`).all()));
    const subjects=await teacherSubjects(db);for(const t of results[0].results||[])t.current_subjects=subjects.get(t.id)||'';
    const events=(await db.prepare('SELECT * FROM academic_events ORDER BY created_at DESC,id DESC').all()).results||[];
    const subject_overrides=(await db.prepare('SELECT * FROM teacher_subject_overrides ORDER BY academic_year,semester,teacher_id').all()).results||[];
    return response({isOk:true,events,subject_overrides,...Object.fromEntries(['teachers','students','classes','staff','assignments'].map((key,i)=>[key,results[i].results||[]])),settings:await getSettings(db)});
  }
  if(request.method!=='POST')return fail('Metode tidak didukung.',405);
  let body;try{body=await request.json();}catch{return fail('JSON tidak valid.');}
  if(!body||typeof body!=='object'||Array.isArray(body))return fail('Data tidak valid.');
  const settings=await getSettings(db);
  if(body.entity==='promotion')return promoteStudents(db,body,actor,settings);
  if(body.entity==='settings'){
    const year=Number(body.academicYearStart),semester=Number(body.semester);
    if(!Number.isInteger(year)||year<2000||year>2199||![1,2].includes(semester))return fail('Tahun ajaran atau semester tidak valid.');
    const statements=[db.prepare("INSERT INTO app_settings(key,value) VALUES('academicYearStart',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(year)),db.prepare("INSERT INTO app_settings(key,value) VALUES('semester',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(semester))];
    if(body.copy_subjects===true&&(year!==settings.academicYearStart||semester!==settings.semester)){
      const subjects=await teacherSubjects(db),targetYear=`${year}/${year+1}`;
      const existing=new Set(((await db.prepare('SELECT teacher_id FROM teacher_subject_overrides WHERE academic_year=? AND semester=?').bind(targetYear,semester).all()).results||[]).map(r=>r.teacher_id));
      for(const [id,value] of subjects)if(!existing.has(id))statements.push(saveSubjects(db,id,targetYear,semester,parseSubjects(value)));
    }
    statements.push(academicLog(db,actor,'settings','settings',{before:settings,after:{academicYear:`${year}/${year+1}`,semester},copy_subjects:body.copy_subjects===true}));
    await db.batch(statements);
    return response({isOk:true,settings:await getSettings(db)});
  }
  const table={teacher:'teachers',student:'students',class:'classes'}[body.entity];
  if(!table)return fail('Jenis master tidak dikenal.');
  const rows=Array.isArray(body.rows)?body.rows:[body.row];
  if(!rows.length||rows.length>100)return fail('Isi 1–100 baris per impor.');
  const statements=[],seen=new Set(),beforeRows=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i];if(!row||typeof row!=='object')return fail(`Baris ${i+1} tidak valid.`);
    const id=clean(row.id),name=clean(row.name);let active=Number(row.active??1);
    if(body.entity==='student'&&row.lifecycle_status)active=row.lifecycle_status==='aktif'?1:0;
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||!name||name.length>160||![0,1].includes(active))return fail(`Baris ${i+1}: ID, nama atau status tidak valid.`);
    if(seen.has(id))return fail(`ID ${id} berulang dalam impor.`);seen.add(id);
    const existing=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
    beforeRows.push(existing||null);
    if(body.mode==='create'&&existing)return fail(`ID ${id} sudah ada. Gunakan Edit.`,409);
    if(body.mode==='edit'&&!existing)return fail(`ID ${id} tidak ditemukan.`,404);
    if(!['create','edit','import'].includes(body.mode))return fail('Mode perubahan tidak valid.');
    if(body.entity==='teacher'){
      const subject=Object.hasOwn(row,'subject')?clean(row.subject):(existing?.subject||''),position=clean(row.position)||'Guru';
      if(subject.length>1000||position.length>160)return fail(`Baris ${i+1}: mapel atau jabatan terlalu panjang.`);
      statements.push(db.prepare(`INSERT INTO teachers(id,name,subject,position,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,subject=excluded.subject,position=excluded.position,active=excluded.active`).bind(id,name,subject,position,active));
      if(Object.hasOwn(row,'current_subjects')){
        let subjects;try{subjects=parseSubjects(row.current_subjects);}catch(e){return fail(e.message);}
        statements.push(saveSubjects(db,id,settings.academicYear,settings.semester,subjects));
      }
      if(!active){
        statements.push(db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE teacher_id=?)').bind(id));
        statements.push(db.prepare('UPDATE users SET active=0 WHERE teacher_id=?').bind(id));
      }
    }else if(body.entity==='student'){
      const classId=clean(row.class_id),nis=clean(row.nis),nisn=clean(row.nisn);
      const lifecycle=clean(row.lifecycle_status)||(active?'aktif':'nonaktif'),note=clean(row.status_note??existing?.status_note),enrolled=clean(row.enrolled_year??existing?.enrolled_year??settings.academicYear);
      if(!['aktif','lulus','keluar','nonaktif'].includes(lifecycle)||note.length>500|| (enrolled&&!/^(20\d{2}|21\d{2})\/(20\d{2}|22\d{2}|21\d{2})$/.test(enrolled)) || (enrolled&&Number(enrolled.slice(5))!==Number(enrolled.slice(0,4))+1))return fail(`Baris ${i+1}: status, catatan, atau tahun masuk tidak valid.`);
      if(nis.length>64||nisn.length>64)return fail(`Baris ${i+1}: NIS/NISN terlalu panjang.`);
      const c=await db.prepare('SELECT id FROM classes WHERE id=? AND active=1').bind(classId).first();
      if(!c && !(existing && !active && existing.class_id===classId))return fail(`Baris ${i+1}: kelas ${classId} tidak aktif atau tidak ditemukan.`);
      for(const [field,value] of [['nis',nis],['nisn',nisn]])if(value){
        if(rows.slice(0,i).some(r=>clean(r[field])===value))return fail(`Baris ${i+1}: ${field.toUpperCase()} berulang.`);
        const duplicate=await db.prepare(`SELECT id FROM students WHERE ${field}=? AND id<>?`).bind(value,id).first();
        if(duplicate)return fail(`Baris ${i+1}: ${field.toUpperCase()} sudah digunakan ${duplicate.id}.`,409);
      }
      statements.push(db.prepare(`INSERT INTO students(id,nis,nisn,name,class_id,active,lifecycle_status,status_note,enrolled_year) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nis=excluded.nis,nisn=excluded.nisn,name=excluded.name,class_id=excluded.class_id,active=excluded.active,lifecycle_status=excluded.lifecycle_status,status_note=excluded.status_note,enrolled_year=excluded.enrolled_year,updated_at=CURRENT_TIMESTAMP`).bind(id,nis,nisn,name,classId,active,lifecycle,note,enrolled));
    }else{
      const level=clean(row.level);if(!['SD','SMP','MA'].includes(level))return fail(`Baris ${i+1}: jenjang wajib SD, SMP atau MA.`);
      if(!active && await db.prepare('SELECT id FROM students WHERE class_id=? AND active=1 LIMIT 1').bind(id).first())return fail('Pindahkan atau nonaktifkan siswa aktif sebelum menonaktifkan kelas.');
      if(existing && name!==existing.name && await db.prepare('SELECT id FROM student_attendance WHERE class_id=? LIMIT 1').bind(id).first())return fail('Nama kelas yang memiliki riwayat tidak diubah. Buat kelas baru agar laporan lama tetap akurat.');
      statements.push(db.prepare(`INSERT INTO classes(id,name,level,active) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,level=excluded.level,active=excluded.active`).bind(id,name,level,active));
    }
  }
  statements.push(academicLog(db,actor,body.mode,body.entity,{before:beforeRows,rows:rows.map(r=>({...r}))}));
  try{await db.batch(statements);}catch(error){
    if(/UNIQUE|constraint/i.test(String(error?.message||error)))return fail('Data berbenturan dengan master yang ada. Tidak ada baris yang disimpan.',409);
    throw error;
  }
  return response({isOk:true,saved:rows.length});
}
