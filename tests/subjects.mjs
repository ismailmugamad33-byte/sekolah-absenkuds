import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {setupDemo,TestD1,root} from './support.mjs';
const {db,call,admin}=await setupDemo();
const token=(await call('/api/auth/login','POST',{username:'g009',password:'TestingGuru123',role:'Guru'})).body.session.token;
const base={record_type:'attendance_student',student_number:'S1',class_name:'1 MA',attendance_date:'2026-10-12',status:'H',subject:'Akhlak'};
let a,b;
await test('Guru, siswa, kelas, tanggal sama: dua mapel tersimpan terpisah dan duplikat mapel ditolak',async()=>{
 a=await call('/api/data','POST',base,token);b=await call('/api/data','POST',{...base,subject:'Bahasa Arab',status:'I'},token);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.body.data.__backendId,b.body.data.__backendId);
 assert.equal(a.body.data.subject,'Akhlak');assert.equal(b.body.data.subject,'Bahasa Arab');
 assert.equal((await call('/api/data','POST',base,token)).status,409);
 const edit=await call('/api/data','PUT',{...a.body.data,status:'S'},token);assert.equal(edit.status,200);
 const rows=(await call('/api/data','GET',undefined,token)).body.data;
 assert.equal(rows.find(r=>r.subject==='Akhlak').status,'S');assert.equal(rows.find(r=>r.subject==='Bahasa Arab').status,'I');
 assert.equal((await call('/api/health')).body.attendance_scope,'per-teacher-subject');
});
await test('API menolak mapel kosong, gabungan mapel, mapel guru lain, serta pemindahan mapel absensi',async()=>{
 for(const subject of ['', 'Akhlak; Bahasa Arab','Ekonomi'])assert.equal((await call('/api/data','POST',{...base,subject},token)).status,400);
 for(const actor of [token,admin])assert.equal((await call('/api/data','PUT',{...a.body.data,subject:'Bahasa Arab'},actor)).status,400);
});
await test('Snapshot mapel riwayat bertahan sesudah perubahan master; jurnal menyimpan mapel dan kelas',async()=>{
 const journal={record_type:'teacher_journal',attendance_date:'2026-10-12',subject:'Akhlak',class_name:'1 MA',journal_material:'Materi satu',teaching_start:'08:00',teaching_end:'09:00'};
 const j=await call('/api/data','POST',journal,token);assert.equal(j.status,200);assert.equal(j.body.data.subject,'Akhlak');assert.equal(j.body.data.class_name,'1 MA');
 const edited=await call('/api/data','PUT',{...j.body.data,subject:'Bahasa Arab',class_name:'2 MA'},token);assert.equal(edited.status,200);assert.equal(edited.body.data.class_name,'2 MA');assert.equal(edited.body.data.subject,'Bahasa Arab');
 for(const changes of [{subject:''},{subject:'Ekonomi'},{class_name:'tidak ada'}])assert.equal((await call('/api/data','POST',{...journal,...changes},token)).status,400);
 assert.equal((await call('/api/data','PUT',{...edited.body.data,subject:'Ekonomi'},token)).status,400);
 await call('/api/admin/master','POST',{entity:'teacher',mode:'edit',row:{id:'G009',name:'Riyan Triyono, S.Pd.',subject:'Bahasa Arab; Mapel Baru',active:1}},admin);
 const records=(await call('/api/data','GET',undefined,admin)).body.data;assert.equal(records.find(r=>r.__backendId===a.body.data.__backendId).subject,'Akhlak');assert.equal(records.find(r=>r.__backendId===b.body.data.__backendId).subject,'Bahasa Arab');
});
await test('Migrasi 0003 lalu 0005 mempertahankan seluruh kolom lama, ID, jam dan jurnal tanpa menebak mapel',()=>{
 const d=new TestD1();d.sqlite.exec(readFileSync(root+'migrations/0001_initial_schema.sql','utf8'));
 d.sqlite.exec("INSERT INTO teachers(id,name,subject) VALUES('T','Guru','A; B'); INSERT INTO classes(id,name,level) VALUES('C','X','MA'); INSERT INTO students(id,name,class_id) VALUES('S','Siswa','C'); INSERT INTO student_attendance(id,student_id,class_id,teacher_id,attendance_date,status,note,time_in,time_out) VALUES('OLD','S','C','T','2026-10-10','I','Keterangan','07:00','12:00'); INSERT INTO teacher_journals(id,teacher_id,journal_date,material,start_time,end_time) VALUES('J','T','2026-10-10','Materi','08:00','09:00');");
 const old=d.sqlite.prepare('SELECT * FROM student_attendance').get(),j=d.sqlite.prepare('SELECT * FROM teacher_journals').get();
 d.sqlite.exec(readFileSync(root+'migrations/0003_student_attendance_per_teacher.sql','utf8'));assert.deepEqual(d.sqlite.prepare('SELECT * FROM student_attendance').get(),old);
 d.sqlite.exec(readFileSync(root+'migrations/0005_attendance_subject.sql','utf8'));
 const {subject,...rest}=d.sqlite.prepare('SELECT * FROM student_attendance').get();assert.equal(subject,'');assert.deepEqual({...rest},{...old});
 const {subject:js,class_name,...jr}=d.sqlite.prepare('SELECT * FROM teacher_journals').get();assert.equal(js,'');assert.equal(class_name,'');assert.deepEqual({...jr},{...j});assert.deepEqual(d.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
await test('Guard migrasi mapel menolak pengulangan sebelum riwayat yang sudah punya mapel diubah',()=>{
 const before=db.sqlite.prepare('SELECT * FROM student_attendance ORDER BY id').all();
 assert.throws(()=>db.sqlite.exec(readFileSync(root+'migrations/0005_attendance_subject.sql','utf8')),/CHECK constraint/);
 assert.deepEqual(db.sqlite.prepare('SELECT * FROM student_attendance ORDER BY id').all(),before);
});
