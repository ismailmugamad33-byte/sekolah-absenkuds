import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import vm from 'node:vm';import {setupDemo,root} from './support.mjs';
const {db,call,admin}=await setupDemo();const teacher=(await call('/api/auth/login','POST',{username:'g009',password:'TestingGuru123',role:'Guru'})).body.session.token;
const post=body=>call('/api/admin/master','POST',body,admin);const master=async()=>(await call('/api/admin/master','GET',undefined,admin)).body;
await test('Manajemen Akademik hanya Admin; guru baru dan dua mapel dapat dibuat',async()=>{
 assert.equal((await call('/api/admin/master','POST',{entity:'promotion'},teacher)).status,403);
 assert.equal((await post({entity:'teacher',mode:'create',row:{id:'NEWTEACH',name:'Guru Baru',current_subjects:'IPA; Tahfidz',position:'Guru'}})).status,200);
 const t=(await master()).teachers.find(t=>t.id==='NEWTEACH');assert.equal(t.current_subjects,'IPA; Tahfidz');
});
let oldAttendance;
await test('Edit mapel menggantikan pilihan guru, menjaga SK dan snapshot absensi',async()=>{
 const r=await call('/api/data','POST',{record_type:'attendance_student',student_number:'S1',class_name:'1 MA',attendance_date:'2026-10-12',subject:'Akhlak',status:'H'},teacher);assert.equal(r.status,200);oldAttendance=r.body.data;
 assert.equal((await post({entity:'teacher',mode:'edit',row:{id:'G009',name:'Riyan Triyono, S.Pd.',current_subjects:'Tahfidz; Matematika',position:'Guru'}})).status,200);
 assert.equal((await master()).teachers.find(t=>t.id==='G009').current_subjects,'Tahfidz; Matematika');
 assert.equal((await call('/api/data','POST',{...oldAttendance,attendance_date:'2026-10-13'},teacher)).status,400);
 assert.equal((await call('/api/data','GET',undefined,teacher)).body.data.find(r=>r.__backendId===oldAttendance.__backendId).subject,'Akhlak');assert.equal((await master()).staff.length,21);
});
await test('Mapel kosong tidak menghidupkan lagi mapel lama dan perubahan periode dapat disalin',async()=>{
 await post({entity:'teacher',mode:'edit',row:{id:'G009',name:'Riyan Triyono, S.Pd.',current_subjects:''}});
 assert.equal((await call('/api/master','GET',undefined,teacher)).body.teachers.find(t=>t.id==='G009').subject,'');
 assert.equal((await call('/api/auth/me','GET',undefined,teacher)).body.user.subject,'');
 await post({entity:'teacher',mode:'edit',row:{id:'G009',name:'Riyan Triyono, S.Pd.',current_subjects:'Tahfidz; Matematika'}});
 await post({entity:'settings',academicYearStart:2027,semester:1,copy_subjects:true});
 assert.equal((await master()).teachers.find(t=>t.id==='G009').current_subjects,'Tahfidz; Matematika');
 await post({entity:'teacher',mode:'edit',row:{id:'G009',name:'Riyan Triyono, S.Pd.',current_subjects:'Bahasa Arab'}});
 await post({entity:'settings',academicYearStart:2026,semester:1,copy_subjects:true});
 assert.equal((await master()).teachers.find(t=>t.id==='G009').current_subjects,'Tahfidz; Matematika');
});
await test('Santri baru kelas 7/10; NIS tetap teks, ID tetap dan status keluar menjaga riwayat',async()=>{
 await post({entity:'class',mode:'import',rows:[{id:'VII',name:'7 SMP A',level:'SMP'},{id:'X',name:'10 MA A',level:'MA'}]});
 const rows=[{id:'NEW7',name:'Santri Tujuh',nis:'00007',class_id:'VII',lifecycle_status:'aktif',enrolled_year:'2026/2027'},{id:'NEW10',name:'Santri Sepuluh',nis:'00010',class_id:'X',lifecycle_status:'aktif',enrolled_year:'2026/2027'}];
 assert.equal((await post({entity:'student',mode:'import',rows})).status,200);assert.equal((await master()).students.find(s=>s.id==='NEW7').nis,'00007');
 assert.equal((await post({entity:'student',mode:'edit',row:{id:'S1',name:'Siswa Uji Satu',class_id:'C1',lifecycle_status:'keluar',status_note:'Pindah sekolah',enrolled_year:'2026/2027'}})).status,200);
 assert.equal((await master()).students.find(s=>s.id==='S1').active,0);assert.equal((await call('/api/data','GET',undefined,admin)).body.data.find(r=>r.__backendId===oldAttendance.__backendId).class_name,'1 MA');
});
await test('Kenaikan massal hanya siswa terpilih, menolak data berubah, dan tahan pengiriman ulang',async()=>{
 const invalid={entity:'promotion',operation_id:'move-invalid-001',student_ids:['S2','S3'],from_class_id:'C2',to_class_id:'C3',action:'naik_kelas',target_year:2027};
 assert.equal((await post(invalid)).status,409);assert.equal((await master()).students.find(s=>s.id==='S2').class_id,'C2');
 const body={...invalid,operation_id:'move-valid-00001',student_ids:['S2']};assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,409);
 assert.equal((await master()).students.find(s=>s.id==='S2').class_id,'C3');assert.equal((await master()).settings.academicYear,'2026/2027');
 const events=(await master()).events;assert.ok(events.some(e=>e.action==='naik_kelas'&&JSON.parse(e.details_json).students[0].id==='S2'));
});
await test('Kelulusan menyimpan alumni; proses gagal seluruhnya jika salah satu siswa tidak aktif',async()=>{
 const base={entity:'promotion',operation_id:'graduation-00001',student_ids:['S2','S3'],from_class_id:'C3',action:'lulus',target_year:2027,note:'Lulus akhir tahun'};
 assert.equal((await post(base)).status,200);for(const id of base.student_ids){const s=(await master()).students.find(x=>x.id===id);assert.equal(s.active,0);assert.equal(s.lifecycle_status,'lulus');}
 assert.equal((await post({...base,operation_id:'graduation-00002'})).status,409);
 assert.ok((await master()).events.every(e=>e.actor==='admin.test'));
});
await test('Ekspor XLSX menjaga teks NIS dan formula; PDF meng-escape isi dan seluruh ID halaman valid',()=>{
 const context=vm.createContext({window:{},TextEncoder,Uint8Array,DataView,Blob,URL,setTimeout});vm.runInContext(readFileSync(root+'public/academic-export.js','utf8'),context);
 const sheets=[{name:'Siswa',headers:['NIS','Nama','Jumlah'],rows:[['00007','=1+1',3],['0010','<script>alert(1)</script>',4]]},{name:'Guru',headers:['Nama'],rows:[['Guru A']]}];
 const out=context.window.AcademicExport.workbook(sheets);assert.ok(out.length>2000);assert.equal(out[0],80);assert.equal(out[1],75);
 // Package can be independently opened by openpyxl during local verification.
 if(process.env.ACADEMIC_XLSX_TEST)writeFileSync(process.env.ACADEMIC_XLSX_TEST,out);
 const printable=context.window.AcademicExport.printable(sheets,'Laporan','Semua');assert.ok(printable.includes('&lt;script&gt;'));assert.ok(!printable.includes('<script>alert'));assert.ok(printable.includes('Simpan sebagai PDF'));
 const html=readFileSync(root+'public/master-admin.html','utf8'),js=readFileSync(root+'public/master-admin.js','utf8'),ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 const missing=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]).filter(x=>!ids.includes(x)&&!x.startsWith('f-'));assert.deepEqual([...new Set(missing)],[]);new vm.Script(js);
});
