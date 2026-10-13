const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(message,status=400)=>json({isOk:false,error:{message}},status);
export function academicLog(db,actor,action,entity,details){return db.prepare('INSERT INTO academic_events(id,actor,action,entity,details_json) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),String(actor?.username||actor?.user_id||'Admin'),action,entity,JSON.stringify(details));}
export function parseSubjects(value){
 const list=Array.isArray(value)?value:String(value??'').split(/[;&]/);
 const subjects=[...new Set(list.map(s=>String(s).trim()).filter(Boolean))];
 if(subjects.length>50||subjects.some(s=>s.length>160)||JSON.stringify(subjects).length>5000)throw Error('Maksimal 50 mapel, masing-masing 160 karakter.');
 return subjects;
}
export function saveSubjects(db,id,year,semester,subjects){return db.prepare(`INSERT INTO teacher_subject_overrides(teacher_id,academic_year,semester,subjects_json) VALUES(?,?,?,?) ON CONFLICT(teacher_id,academic_year,semester) DO UPDATE SET subjects_json=excluded.subjects_json,updated_at=CURRENT_TIMESTAMP`).bind(id,year,semester,JSON.stringify(subjects));}
export async function promoteStudents(db,body,actor,settings){
 const ids=body.student_ids,from=String(body.from_class_id||''),to=String(body.to_class_id||''),kind=body.action,note=String(body.note||'').trim(),operation=String(body.operation_id||'');
 if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)return fail('Pilih 1–100 siswa yang berbeda.');
 if(!['naik_kelas','lulus','keluar'].includes(kind)||!from||note.length>500||!/^[a-zA-Z0-9_-]{8,64}$/.test(operation))return fail('Tindakan, kelas asal, catatan atau ID proses tidak valid.');
 const year=Number(body.target_year);if(!Number.isInteger(year)||year<2000||year>2199)return fail('Tahun ajaran tujuan tidak valid.');
 if(await db.prepare('SELECT id FROM academic_operations WHERE id=?').bind(operation).first())return fail('Proses ini sudah tersimpan. Muat ulang untuk melihat hasilnya.',409);
 if(kind==='naik_kelas'){
  if(from===to)return fail('Kelas tujuan harus berbeda dari kelas asal.');
  if(!await db.prepare('SELECT id FROM classes WHERE id=? AND active=1').bind(to).first())return fail('Pilih kelas tujuan aktif.');
 }
 const placeholders=ids.map(()=>'?').join(',');
 const rows=(await db.prepare(`SELECT * FROM students WHERE id IN (${placeholders})`).bind(...ids).all()).results||[];
 if(rows.length!==ids.length||rows.some(r=>r.class_id!==from||r.active!==1))return fail('Data siswa berubah atau tidak aktif. Muat ulang daftar sebelum memproses.',409);
 const status=kind==='naik_kelas'?'aktif':kind,active=kind==='naik_kelas'?1:0;
 const details={source_period:settings.academicYear,target_period:`${year}/${year+1}`,from_class_id:from,to_class_id:kind==='naik_kelas'?to:from,note,students:rows.map(r=>({id:r.id,name:r.name,from_class_id:r.class_id,to_class_id:kind==='naik_kelas'?to:r.class_id,before_status:r.lifecycle_status,after_status:status}))};
 try{await db.batch([
  db.prepare(`INSERT INTO academic_operations(id,expected_count,actual_count) SELECT ?,?,COUNT(*) FROM students WHERE id IN (${placeholders}) AND class_id=? AND active=1`).bind(operation,ids.length,...ids,from),
  db.prepare(`UPDATE students SET class_id=?,active=?,lifecycle_status=?,status_note=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).bind(kind==='naik_kelas'?to:from,active,status,note,...ids),
  academicLog(db,actor,kind,'student',details)
 ]);}catch(e){if(/constraint|UNIQUE/i.test(String(e.message)))return fail('Data berubah atau proses sudah pernah disimpan. Tidak ada perubahan yang diterapkan. Muat ulang.',409);throw e;}
 return json({isOk:true,saved:ids.length});
}
