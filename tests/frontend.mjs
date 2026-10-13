import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {root,setupDemo} from './support.mjs';
const {call,admin}=await setupDemo();let token='';
class Element{
 constructor(){this._value='';this._html='';this.options=[];this.textContent='';this.classList={add(){},remove(){},toggle(){},contains(){return true}};}
 set innerHTML(html){this._html=html;this.options=[...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m=>({value:m[1],text:m[2]}));this._value=this.options[0]?.value||'';}
 get innerHTML(){return this._html;}
 set value(v){this._value=this.options.length&&!this.options.some(x=>x.value===v)?'':String(v);}
 get value(){return this._value;}
 querySelector(){return null;}
 addEventListener(){}
}
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const ctx=vm.createContext({console,Date,Map,Set,URL,crypto,setTimeout,clearTimeout,Event,window:{addEventListener(){},absensiBackend:{masterData:{async load(){return (await call('/api/master','GET',undefined,token)).body;}}}},document:{getElementById:element,addEventListener(){},querySelectorAll(){return []}},lucide:{createIcons(){}}});
const html=readFileSync(root+'public/index.html','utf8');const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');vm.runInContext(inline,ctx);
await test('Pilihan kelas diperbarui dari master setelah login pertama (termasuk 2 MA dan 3 MA)',async()=>{await vm.runInContext('loadMasterData()',ctx);assert.equal(element('g-class').options.length,1);token=admin;await vm.runInContext('loadMasterData()',ctx);assert.deepEqual(element('g-class').options.map(x=>x.value),['','1 MA','2 MA','3 MA']);assert.equal(element('g-class').value,'1 MA');element('g-class').value='3 MA';await vm.runInContext('loadMasterData()',ctx);assert.equal(element('g-class').value,'3 MA');});
await test('Kontrol tahun ajaran mengikuti database dan filter kelas menggunakan jenjang master',async()=>{await call('/api/admin/master','POST',{entity:'settings',academicYearStart:2028,semester:2},admin);await vm.runInContext('loadMasterData()',ctx);assert.equal(element('academic-year-label').textContent,'2028/2029 · Semester 2');assert.match(element('a-semester').innerHTML,/2028\/2029/);assert.deepEqual([...vm.runInContext("classOptions('MA')",ctx)],['1 MA','2 MA','3 MA']);});
await test('Tanggal kalender ketat dan catatan kosong tetap dikirim',()=>{assert.equal(vm.runInContext("isValidDate('2026-02-30')",ctx),false);assert.equal(vm.runInContext("isValidDate('2028-02-29')",ctx),true);vm.runInContext("account={id:'G009',name:'Guru'}",ctx);const p=vm.runInContext("buildStudentAttendancePayload({id:'S1',name:'Siswa'},'H','2026-10-12','1 MA',{note:''})",ctx);assert.ok(Object.hasOwn(p,'display_name'));assert.equal(p.display_name,'');assert.equal(Object.hasOwn(p,'check_in_time'),false);});
await test('Semua referensi ID statis frontend ditemukan dan inline JavaScript valid',()=>{const ids=[...html.replace(/<script[\s\S]*?<\/script>/g,'').matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);const missing=[...inline.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]).filter(id=>!ids.includes(id));assert.deepEqual([...new Set(missing)],[]);new vm.Script(readFileSync(root+'public/master-admin.js','utf8'));new vm.Script(readFileSync(root+'public/backend-client.js','utf8'));});
await test('Pilihan mapel memisahkan draf, payload, dan pencarian absensi tersimpan',()=>{
 vm.runInContext("role='Guru';account={id:'T',name:'Guru',subject:'Ilmu Hadits; Tahfidz'};teachers=[account];refreshSubjectControls();",ctx);
 assert.deepEqual(element('g-subject').options.map(o=>o.value),['','Ilmu Hadits','Tahfidz']);assert.equal(element('g-subject').value,'');
 element('g-subject').value='Ilmu Hadits';vm.runInContext("ensureDraft({id:'S'},'2026-10-12','1 MA').status='H'",ctx);
 element('g-subject').value='Tahfidz';assert.equal(vm.runInContext("getDraft({id:'S'},'2026-10-12','1 MA')",ctx),null);
 vm.runInContext("ensureDraft({id:'S'},'2026-10-12','1 MA').status='I'",ctx);
 assert.equal(vm.runInContext("buildStudentAttendancePayload({id:'S',name:'Siswa'},'I','2026-10-12','1 MA').subject",ctx),'Tahfidz');
 element('g-subject').value='Ilmu Hadits';assert.equal(vm.runInContext("getDraft({id:'S'},'2026-10-12','1 MA').status",ctx),'H');
});
await test('Alur simpan dua mapel dan edit satu mapel tidak menimpa yang lain; matriks punya dua baris',async()=>{
 ctx.window.absensiBackend.data={async create(payload){return {isOk:true,data:{...payload,__backendId:'sa:'+crypto.randomUUID()}}},async update(payload){return {isOk:true,data:payload}}};
 vm.runInContext("attendanceDrafts.clear();records=[];students=[{id:'S',name:'Siswa',className:'1 MA',displayId:'001'}];classes=['1 MA'];teacherClasses=['1 MA'];",ctx);
 element('g-class').value='1 MA';element('g-date').value='2026-10-12';
 for(const [subject,status] of [['Ilmu Hadits','H'],['Tahfidz','I']]){element('g-subject').value=subject;vm.runInContext(`ensureDraft(students[0],'2026-10-12','1 MA').status='${status}'`,ctx);await vm.runInContext('saveAttendance()',ctx);}
 assert.equal(vm.runInContext('records.length',ctx),2);assert.equal(element('g-subject').disabled,false);
 element('g-subject').value='Ilmu Hadits';vm.runInContext("ensureDraft(students[0],'2026-10-12','1 MA').status='S'",ctx);await vm.runInContext('saveAttendance()',ctx);
 assert.equal(vm.runInContext('records.length',ctx),2);assert.equal(vm.runInContext("records.find(r=>r.subject==='Tahfidz').status",ctx),'I');assert.equal(vm.runInContext("records.find(r=>r.subject==='Ilmu Hadits').status",ctx),'S');
 element('matrix-month').value='10';element('matrix-year').value='2026';vm.runInContext('renderMatrixPreview()',ctx);assert.equal((element('matrix-rows').innerHTML.match(/<tr>/g)||[]).length,2);assert.match(element('matrix-rows').innerHTML,/Ilmu Hadits/);assert.match(element('matrix-rows').innerHTML,/Tahfidz/);
 vm.runInContext("role='Admin';renderHistory()",ctx);assert.match(element('history-list').innerHTML,/Ilmu Hadits/);assert.match(element('history-list').innerHTML,/Tahfidz/);
});
