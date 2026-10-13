import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker from '../src/index.js';
export const root=fileURLToPath(new URL('../',import.meta.url));
export class TestD1 {
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON');}
 prepare(sql){const self=this;const build=(params=[])=>({bind(...p){return build(p)},async first(){return self.sqlite.prepare(sql).get(...params)||null},async all(){return {results:self.sqlite.prepare(sql).all(...params)}},async run(){return {success:true,meta:self.sqlite.prepare(sql).run(...params)}}});return build();}
 async batch(statements){this.sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
export function fixture(legacy=true){
 const db=new TestD1();db.sqlite.exec(readFileSync(root+'migrations/0001_initial_schema.sql','utf8'));
 if(legacy){
 const teachers=[['G001','Margi Wibowo, M.Pd.','Kepala Sekolah'],['G002','Erma Puji Lestari','Bahasa Jawa'],['G003','Lina Adriana, S.Pd.','IPS'],['G004','Maryatun','Seni Budaya'],['G005','Nurul Hidayah, S.Pd.','Fikih & Kemuhammadiyahan'],['G006','Feti Fatimah, S.Pd.','Matematika'],['G007','Mira Widawati, S.Pd','Bahasa Indonesia'],['G008','Nurani Haningrum, S.Pd.','IPA'],['G009','Riyan Triyono, S.Pd.',"Bahasa Arab & Qur'an Hadits"],['G010','Asrifatu A.S, S.Pd','Bahasa Inggris'],['G011','Azhar Umar Said','Aqidah Akhlak'],['G012','Muhammad Farid Riza','PPkn'],['G013','Naufal Rauf','Tarikh'],['G014','Endar Syahputra, S.Pd.','Olahraga'],['G015','Jalu Nugroho, S.M','Informatika']];
 for(const t of teachers)db.sqlite.prepare('INSERT INTO teachers(id,name,subject) VALUES(?,?,?)').run(...t);
 }
 for(const f of ['0002_auth_sessions.sql','0003_student_attendance_per_teacher.sql','0004_master_sk_settings.sql','0005_attendance_subject.sql','0006_academic_management.sql'])db.sqlite.exec(readFileSync(root+'migrations/'+f,'utf8'));
 const env={DB:db,AUTH_PEPPER:'local-test-pepper-never-use-in-production',ASSETS:{async fetch(request){try{let path=new URL(request.url).pathname;if(path==='/')path='/index.html';if(path.includes('..'))return new Response('',{status:403});const raw=readFileSync(root+'public'+path);return new Response(raw,{headers:{'content-type':path.endsWith('.js')?'text/javascript':'text/html'}});}catch{return new Response('Not found',{status:404});}}}};
 async function call(path,method='GET',body,token=''){
  const r=await worker.fetch(new Request('http://localhost'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
  return {status:r.status,body:await r.json()};
 }
 return {db,env,call};
}
export async function setupDemo(){const ctx=fixture();const {call}=ctx;await call('/api/setup/admin','POST',{username:'admin.test',password:'TestingAdmin123'});const a=await call('/api/auth/login','POST',{username:'admin.test',password:'TestingAdmin123',role:'Admin'});ctx.admin=a.body.session.token;await call('/api/admin/teacher-users','POST',{teacherId:'G009',username:'g009',password:'TestingGuru123'},ctx.admin);await call('/api/admin/teacher-users','POST',{teacherId:'G011',username:'g011',password:'TestingGuru123'},ctx.admin);await call('/api/admin/master','POST',{entity:'class',mode:'import',rows:[{id:'C1',name:'1 MA',level:'MA'},{id:'C2',name:'2 MA',level:'MA'},{id:'C3',name:'3 MA',level:'MA'}]},ctx.admin);await call('/api/admin/master','POST',{entity:'student',mode:'import',rows:[{id:'S1',name:'Siswa Uji Satu',nis:'001',class_id:'C1'},{id:'S2',name:'Siswa Uji Dua',nis:'002',class_id:'C2'},{id:'S3',name:'Siswa Uji Tiga',nis:'003',class_id:'C3'}]},ctx.admin);return ctx;}
