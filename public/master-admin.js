'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=window.absensiBackend.admin;
let data={},tab='teacher',saving=false,editMode='create',pendingRows=null,pendingMove=null;
const plural={teacher:'teachers',student:'students',class:'classes'},title={teacher:'Guru & Mapel',student:'Data Siswa',class:'Data Kelas',sk:'Sumber SK MA · Ganjil 2026/2027'};
const columns={teacher:['id','name','current_subjects','position','active'],student:['id','name','nis','nisn','class_id','lifecycle_status','enrolled_year','status_note'],class:['id','name','level','active']};
const states={aktif:'Aktif',lulus:'Lulus',keluar:'Keluar',nonaktif:'Nonaktif'};
const className=id=>data.classes.find(c=>c.id===id)?.name||id||'—';
const studentStatus=r=>r.lifecycle_status||(Number(r.active)===1?'aktif':'nonaktif');
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function errorAt(id,text){$(id).textContent=text;$(id).classList.toggle('hidden',!text);}
function options(id,items,empty='Pilih'){const old=$(id).value;$(id).innerHTML=`<option value="">${empty}</option>`+items.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('');if(items.some(([v])=>v===old))$(id).value=old;}
async function reload(){const r=await api.master();if(!r.isOk)throw Error(r.error?.message||'Data gagal dimuat.');data=r;render();}
function render(){
 $('stats').innerHTML=[['teachers','Guru'],['students','Siswa'],['classes','Kelas']].map(([k,t])=>`<span><b>${(data[k]||[]).filter(r=>Number(r.active)===1).length}</b>${t} aktif</span>`).join('')+`<span><b>${data.students.filter(s=>studentStatus(s)==='lulus').length}</b>Alumni</span>`;
 $('period').textContent=`Tahun ajaran ${data.settings.academicYear} · Semester ${data.settings.semester} — Pengaturan mapel mengikuti periode ini.`;
 const isList=Object.hasOwn(title,tab);$('listing').classList.toggle('hidden',!isList);
 for(const id of ['settings','promotion','exports','events'])$(id).classList.toggle('hidden',tab!==id);
 $('year').value=data.settings.academicYearStart;$('semester').value=data.settings.semester;
 if(tab==='promotion'){renderPromotion();return;}if(tab==='events'){renderEvents();return;}if(!isList)return;
 const source=tab==='sk',rows=source?data.staff:data[plural[tab]]||[],query=$('search').value.toLowerCase();
 const af=$('active-filter'),previous=af.value;const filters=tab==='student'?Object.entries(states):[['1','Aktif'],['0','Nonaktif']];af.innerHTML='<option value="">Semua status</option>'+filters.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');if(filters.some(([v])=>v===previous))af.value=previous;
 options('class-filter',data.classes.map(c=>[c.id,c.name]),'Semua kelas');$('class-filter').classList.toggle('hidden',tab!=='student');
 $('list-title').textContent=title[tab];['add','import','active-filter'].forEach(id=>$(id).classList.toggle('hidden',source));
 $('help').textContent=source?'Dokumen penugasan awal dipertahankan sebagai arsip. Perubahan mapel operasional dilakukan lewat Edit Guru.':tab==='teacher'?'Tambah atau edit nama, jabatan, dan seluruh mapel guru untuk periode aktif. Pisahkan beberapa mapel dengan titik koma. Akun login dibuat melalui menu Akun Guru.':tab==='student'?'Tambahkan santri kelas 7 atau kelas 10 ke kelas tujuan yang sudah dibuat. Edit status untuk siswa keluar/lulus, atau gunakan Kenaikan & Kelulusan untuk memproses banyak siswa. Riwayat tetap tersimpan.':'Contoh nama: 7 SMP A, 8 SMP A, 9 SMP A, 10 MA A, 11 MA A, 12 MA A. Gunakan ID tetap; buat kelas baru jika perlu agar riwayat tetap tepat.';
 const heads=source?['No','Nama sesuai SK','Tugas','Mapel · kelas · JP','ID terkait','Catatan']:tab==='teacher'?['ID','Nama / jabatan','Mapel periode aktif','Status','Aksi']:tab==='student'?['ID','Nama','NIS / NISN','Kelas','Tahun masuk','Status / catatan','Aksi']:['ID','Nama','Jenjang','Status','Aksi'];
 $('thead').innerHTML='<tr>'+heads.map(x=>`<th>${x}</th>`).join('')+'</tr>';
 const filtered=rows.filter(r=>(source||!af.value||(tab==='student'?studentStatus(r):String(r.active))===af.value)&&(tab!=='student'||!$('class-filter').value||r.class_id===$('class-filter').value)&&JSON.stringify(r).toLowerCase().includes(query));
 $('tbody').innerHTML=filtered.map(r=>{
  if(source)return `<tr><td>${r.source_no}</td><td>${esc(r.name)}</td><td>${esc(r.status)}<br>${esc(r.position)}</td><td>${esc(r.source_subject||'—')}<br>${esc(r.source_class||'—')} · ${r.total_jp||0} JP</td><td>${esc(r.teacher_id||'Tanpa akun guru')}</td><td>${esc(r.notes||'—')}</td></tr>`;
  const active=Number(r.active)===1,actions=`<td><div class="actions"><button data-edit="${esc(r.id)}">Edit</button>${tab==='student'?'':`<button data-toggle="${esc(r.id)}" class="${active?'danger':''}">${active?'Nonaktifkan':'Aktifkan'}</button>`}</div></td>`;
  const status=`<td><span class="tag ${active?'':'off'}">${tab==='student'?states[studentStatus(r)]:(active?'Aktif':'Nonaktif')}</span>${tab==='student'&&r.status_note?`<br><small>${esc(r.status_note)}</small>`:''}</td>`;
  const cells=tab==='teacher'?`<td>${esc(r.name)}<br><small>${esc(r.position)}</small></td><td>${esc(r.current_subjects??r.subject??'')||'Belum ada mapel'}</td>`:tab==='student'?`<td>${esc(r.name)}</td><td>${esc(r.nis||'—')}<br>${esc(r.nisn||'—')}</td><td>${esc(className(r.class_id))}</td><td>${esc(r.enrolled_year||'Belum tercatat')}</td>`:`<td>${esc(r.name)}</td><td>${esc(r.level)}</td>`;
  return `<tr><td>${esc(r.id)}</td>${cells}${status}${actions}</tr>`;
 }).join('')||`<tr><td colspan="${heads.length}">Tidak ada data.</td></tr>`;
}
function field(id,label,value='',extra=''){return `<div><label for="f-${id}">${label}</label><input id="f-${id}" name="${id}" value="${esc(value)}" ${extra}></div>`;}
function openEditor(id){
 const row=id?data[plural[tab]].find(r=>r.id===id):{};editMode=id?'edit':'create';
 $('edit-title').textContent=`${id?'Edit':'Tambah'} ${title[tab]}`;$('edit-note').textContent=tab==='teacher'?`Mapel yang disimpan berlaku untuk ${data.settings.academicYear}, semester ${data.settings.semester}. Daftar ini menggantikan pilihan mapel guru pada periode tersebut; jurnal dan absensi lama tetap utuh.`:id?'ID dipertahankan agar riwayat tetap terhubung. Status Lulus/Keluar menyimpan siswa dalam arsip.':'Gunakan ID unik. Buat kelas tujuan dahulu jika belum ada.';
 let html=field('id','ID',row.id,'required pattern="[a-zA-Z0-9_-]{1,64}" maxlength="64" '+(id?'readonly':''))+field('name','Nama',row.name,'required maxlength="160"');
 if(tab==='teacher')html+=field('current_subjects','Mapel periode aktif — pisahkan dengan titik koma',row.current_subjects??row.subject??'','maxlength="5000" placeholder="Contoh: Ilmu Hadits; Tahfidz"')+field('position','Jabatan',row.position||'Guru','maxlength="160"');
 if(tab==='student')html+=field('nis','NIS',row.nis,'maxlength="64"')+field('nisn','NISN',row.nisn,'maxlength="64"')+`<div><label for="f-class_id">Kelas</label><select id="f-class_id" name="class_id" required><option value="">Pilih kelas</option>${data.classes.filter(c=>Number(c.active)===1||c.id===row.class_id).map(c=>`<option value="${esc(c.id)}" ${c.id===row.class_id?'selected':''}>${esc(c.name)}${Number(c.active)!==1?' (nonaktif)':''}</option>`).join('')}</select></div>`+field('enrolled_year','Tahun masuk',row.enrolled_year??data.settings.academicYear,'placeholder="2026/2027" pattern="[0-9]{4}/[0-9]{4}"')+`<div><label for="f-lifecycle_status">Status siswa</label><select id="f-lifecycle_status" name="lifecycle_status">${Object.entries(states).map(([v,t])=>`<option value="${v}" ${v===studentStatus({...row,active:row.active??1})?'selected':''}>${t}</option>`).join('')}</select></div>`+field('status_note','Catatan status / perpindahan',row.status_note,'maxlength="500"');
 if(tab==='class')html+=`<div><label for="f-level">Jenjang</label><select id="f-level" name="level">${['SD','SMP','MA'].map(v=>`<option ${v===row.level?'selected':''}>${v}</option>`).join('')}</select></div>`;
 if(tab!=='student')html+=`<div><label for="f-active">Status</label><select id="f-active" name="active"><option value="1">Aktif</option><option value="0" ${Number(row.active)===0?'selected':''}>Nonaktif</option></select></div>`;
 $('fields').innerHTML=html;errorAt('edit-error','');$('editor').showModal();$('f-name').focus();
}
async function save(payload){if(saving)return false;saving=true;try{const r=await api.saveMaster(payload);if(!r.isOk)throw Error(r.error?.message||'Gagal menyimpan.');await reload();message(`${r.saved||1} perubahan berhasil disimpan.`);return true;}finally{saving=false;}}
$('tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b||saving)return;tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$('search').value='';$('active-filter').value='';render();};
$('search').oninput=render;$('active-filter').onchange=render;$('class-filter').onchange=render;
$('refresh').onclick=async()=>{try{await reload();message('Data terbaru telah dimuat.');}catch(e){message(e.message,true);}};
$('add').onclick=()=>openEditor();$('cancel-edit').onclick=()=>{if(!saving)$('editor').close();};
$('edit-form').onsubmit=async e=>{e.preventDefault();if(saving)return;$('submit-edit').disabled=true;try{const row=Object.fromEntries(new FormData(e.target));if(await save({entity:tab,mode:editMode,row}))$('editor').close();}catch(e){errorAt('edit-error',e.message);}finally{$('submit-edit').disabled=false;}};
$('tbody').onclick=async e=>{const b=e.target.closest('[data-edit],[data-toggle]');if(!b||saving)return;if(b.dataset.edit)return openEditor(b.dataset.edit);const row=data[plural[tab]].find(r=>r.id===b.dataset.toggle),active=Number(row.active)===1?0:1;if(!confirm(`${active?'Aktifkan':'Nonaktifkan'} ${row.name}? Riwayat tetap disimpan.${tab==='teacher'&&!active?' Akses login guru juga dinonaktifkan.':''}`))return;try{await save({entity:tab,mode:'edit',row:{...row,active}});}catch(e){message(e.message,true);}};
$('settings-form').onsubmit=async e=>{e.preventDefault();if(saving)return;if(!confirm(`Aktifkan tahun ajaran ${$('year').value}/${Number($('year').value)+1}, semester ${$('semester').value}? Kelas siswa tidak berubah otomatis.`))return;try{if(await save({entity:'settings',academicYearStart:$('year').value,semester:$('semester').value,copy_subjects:$('copy-subjects').checked}))message('Periode aktif diperbarui. Periksa mapel guru dan proses kenaikan kelas bila diperlukan.');}catch(e){message(e.message,true);}};
function parseCSV(input){
 const text=String(input).replace(/^\uFEFF/,''),lines=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))lines.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Tanda kutip CSV belum ditutup.');row.push(cell);if(row.some(x=>x.trim()))lines.push(row);
 const headers=(lines.shift()||[]).map(x=>x.trim());if(headers.join(',')!==columns[tab].join(','))throw Error('Kolom CSV harus sesuai template dan dipisahkan koma.');
 if(!lines.length||lines.length>100)throw Error('Isi 1–100 baris.');
 return lines.map((r,i)=>{if(r.length!==headers.length)throw Error(`Jumlah kolom baris ${i+2} tidak sesuai.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
$('import').onclick=()=>{pendingRows=null;$('csv-text').value='';$('csv-file').value='';$('preview').textContent='';$('submit-import').disabled=true;$('csv-columns').textContent=columns[tab].join(',')+(tab==='student'?'\nStatus: aktif / lulus / keluar / nonaktif. Tahun masuk: 2026/2027.':'');errorAt('import-error','');$('importer').showModal();};
$('cancel-import').onclick=()=>{if(!saving)$('importer').close();};
$('csv-file').onchange=async()=>{const f=$('csv-file').files[0];if(!f)return;if(f.size>500000)return errorAt('import-error','Ukuran CSV maksimal 500 KB.');$('csv-text').value=await f.text();pendingRows=null;$('submit-import').disabled=true;};
$('csv-text').oninput=()=>{pendingRows=null;$('submit-import').disabled=true;};
$('check-import').onclick=()=>{try{pendingRows=parseCSV($('csv-text').value);const existing=new Set(data[plural[tab]].map(r=>r.id)),update=pendingRows.filter(r=>existing.has(r.id)).length;$('preview').innerHTML=`<p>${pendingRows.length} baris: ${pendingRows.length-update} baru, ${update} diperbarui.</p><div class="table-scroll"><table><thead><tr>${columns[tab].map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${pendingRows.map(r=>`<tr>${columns[tab].map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;errorAt('import-error','');$('submit-import').disabled=false;}catch(e){pendingRows=null;$('submit-import').disabled=true;errorAt('import-error',e.message);}};
$('submit-import').onclick=async()=>{if(!pendingRows||saving)return;if(!confirm(`Simpan ${pendingRows.length} baris yang telah diperiksa? ID yang sudah ada akan diperbarui.`))return;try{if(await save({entity:tab,mode:'import',rows:pendingRows}))$('importer').close();}catch(e){errorAt('import-error',e.message);}};
$('template').onclick=()=>AcademicExport.download(new Blob(['\uFEFF'+columns[tab].join(',')+'\r\n'],{type:'text/csv;charset=utf-8'}),`template-${tab}.csv`);
function renderPromotion(){
 const selected=new Set([...document.querySelectorAll('[data-move-student]:checked')].map(x=>x.value));
 const active=data.classes.filter(c=>Number(c.active)===1).map(c=>[c.id,c.name]);options('move-from',active,'Pilih kelas asal');options('move-to',active.filter(([id])=>id!==$('move-from').value),'Pilih kelas tujuan');
 if(!$('move-year').value)$('move-year').value=data.settings.academicYearStart;
 $('move-to-wrap').classList.toggle('hidden',$('move-action').value!=='naik_kelas');
 const rows=data.students.filter(s=>s.class_id===$('move-from').value&&Number(s.active)===1);
 $('move-rows').innerHTML=rows.map(s=>`<tr><td><input type="checkbox" data-move-student value="${esc(s.id)}" ${selected.has(s.id)?'checked':''} aria-label="Pilih ${esc(s.name)}"></td><td>${esc(s.id)}<br><small>${esc(s.nis||'')}</small></td><td>${esc(s.name)}</td><td>${esc(className(s.class_id))}</td></tr>`).join('')||'<tr><td colspan="4">Pilih kelas asal yang memiliki siswa aktif.</td></tr>';updateMoveCount();
}
function updateMoveCount(){const boxes=[...document.querySelectorAll('[data-move-student]')],n=boxes.filter(x=>x.checked).length;$('move-count').textContent=`${n} dari ${boxes.length} siswa dipilih`;$('move-all').checked=!!boxes.length&&n===boxes.length;$('review-move').disabled=!n||n>100;}
$('move-from').onchange=()=>{$('move-rows').innerHTML='';renderPromotion();};$('move-action').onchange=renderPromotion;$('move-rows').onchange=updateMoveCount;
$('move-all').onchange=()=>{document.querySelectorAll('[data-move-student]').forEach(x=>x.checked=$('move-all').checked);updateMoveCount();};
$('review-move').onclick=()=>{const ids=[...document.querySelectorAll('[data-move-student]:checked')].map(x=>x.value),action=$('move-action').value,to=$('move-to').value,year=Number($('move-year').value);if(!ids.length||ids.length>100)return message('Pilih 1–100 siswa.',true);if(action==='naik_kelas'&&!to)return message('Pilih kelas tujuan.',true);if(!Number.isInteger(year)||year<2000||year>2199)return message('Tahun tujuan tidak valid.',true);
 pendingMove={entity:'promotion',operation_id:crypto.randomUUID(),student_ids:ids,from_class_id:$('move-from').value,to_class_id:to,action,target_year:year,note:$('move-note').value};
 $('move-summary').innerHTML=`<p><b>${ids.length} siswa</b> dari ${esc(className(pendingMove.from_class_id))} → <b>${action==='naik_kelas'?esc(className(to)):states[action]}</b></p><p>Periode tujuan ${year}/${year+1}. Tahun ajaran aktif tetap ${esc(data.settings.academicYear)} sampai Anda mengubahnya di tab Tahun Ajaran.</p><p>${esc(pendingMove.note)}</p><ol>${ids.map(id=>`<li>${esc(data.students.find(s=>s.id===id)?.name||id)} · ${esc(id)}</li>`).join('')}</ol><p class="muted">Riwayat absensi tetap pada kelas semula. Periksa semua nama sebelum menyimpan.</p>`;errorAt('move-error','');$('move-preview').showModal();};
$('cancel-move').onclick=()=>{if(!saving)$('move-preview').close();};
$('confirm-move').onclick=async()=>{if(!pendingMove||saving)return;$('confirm-move').disabled=true;try{if(await save(pendingMove)){$('move-preview').close();pendingMove=null;}}catch(e){errorAt('move-error',e.message);}finally{$('confirm-move').disabled=false;}};
function eventDetail(e){try{const d=JSON.parse(e.details_json);if(d.students)return `${d.students.length} siswa: ${className(d.from_class_id)} → ${className(d.to_class_id)} · ${d.target_period}\n${d.students.map(s=>`${s.id} ${s.name}: ${states[s.before_status]||s.before_status} → ${states[s.after_status]||s.after_status}`).join('\n')}\n${d.note||''}`;if(d.rows)return d.rows.map(r=>`${r.id} · ${r.name}${r.current_subjects!==undefined?' · Mapel: '+(r.current_subjects||'Kosong'):''}${r.class_id?' · '+className(r.class_id):''}${r.lifecycle_status?' · '+states[r.lifecycle_status]:''}`).join('\n');return JSON.stringify(d,null,2);}catch{return e.details_json;}}
function renderEvents(){$('events-rows').innerHTML=(data.events||[]).map(e=>`<tr><td>${esc(e.created_at)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)} · ${esc(e.entity)}</td><td class="detail">${esc(eventDetail(e))}</td></tr>`).join('')||'<tr><td colspan="4">Belum ada perubahan sejak fitur Manajemen Akademik diaktifkan.</td></tr>';}
function exportSheets(records,kind){
 const sheets=[],add=(key,name,headers,rows)=>{if(kind==='all'||kind===key)sheets.push({name,headers,rows});},missing='Belum ditentukan (data lama)';
 add('teachers','Guru dan Mapel',['ID','Nama','Jabatan','Mapel periode aktif','Status','Tahun ajaran','Semester'],data.teachers.map(t=>[t.id,t.name,t.position,t.current_subjects??t.subject,Number(t.active)===1?'Aktif':'Nonaktif',data.settings.academicYear,data.settings.semester]));
 add('students','Siswa',['ID','Nama','NIS','NISN','Kelas sekarang','Status','Tahun masuk','Catatan'],data.students.map(s=>[s.id,s.name,s.nis,s.nisn,className(s.class_id),states[studentStatus(s)],s.enrolled_year,s.status_note]));
 add('classes','Kelas',['ID','Nama','Jenjang','Status'],data.classes.map(c=>[c.id,c.name,c.level,Number(c.active)===1?'Aktif':'Nonaktif']));
 add('assignments','Penugasan SK',['ID guru','Nama guru','Mapel','Kelas','JP','Tahun ajaran','Semester'],data.assignments.map(a=>[a.teacher_id,data.teachers.find(t=>t.id===a.teacher_id)?.name||a.teacher_id,a.subject,a.source_class,a.jp,a.academic_year,a.semester]));
 add('assignments','Pengaturan Mapel',['ID guru','Nama guru','Tahun ajaran','Semester','Mapel'],(data.subject_overrides||[]).map(a=>[a.teacher_id,data.teachers.find(t=>t.id===a.teacher_id)?.name||a.teacher_id,a.academic_year,a.semester,JSON.parse(a.subjects_json).join('; ')]));
 add('assignments','Sumber SK',['Nomor','Nama','Status','Jabatan','Mapel sumber','Kelas','JP','Catatan'],data.staff.map(s=>[s.source_no,s.name,s.status,s.position,s.source_subject,s.source_class,s.total_jp,s.notes]));
 add('attendance_student','Absensi Siswa',['Tanggal','ID siswa','Nama siswa','Kelas','Mapel','Status','Jam','Keterangan','ID guru','Guru'],records.filter(r=>r.record_type==='attendance_student').map(r=>[r.attendance_date,r.student_number,r.student_name,r.class_name,r.subject||missing,r.status,r.check_in_time,r.display_name,r.teacher_id,r.teacher_name]));
 add('attendance_teacher','Kehadiran Guru',['Tanggal','ID guru','Nama guru','Jam masuk dan keluar','Catatan'],records.filter(r=>r.record_type==='attendance_teacher').map(r=>[r.attendance_date,r.teacher_id,r.teacher_name,r.check_in_time,r.display_name]));
 add('teacher_journal','Jurnal Mengajar',['Tanggal','ID guru','Guru','Mapel','Kelas','Materi','Mulai','Selesai','Durasi','Kendala'],records.filter(r=>r.record_type==='teacher_journal').map(r=>[r.attendance_date,r.teacher_id,r.teacher_name,r.subject||missing,r.class_name||missing,r.journal_material,r.teaching_start,r.teaching_end,r.teaching_duration,r.teaching_challenges]));
 add('settings','Tahun Ajaran',['Tahun awal','Tahun ajaran aktif','Semester'],[[data.settings.academicYearStart,data.settings.academicYear,data.settings.semester]]);
 add('events','Log Akademik',['Waktu','Admin','Tindakan','Data','Rincian'],(data.events||[]).map(e=>[e.created_at,e.actor,e.action,e.entity,eventDetail(e)]));
 return sheets;
}
function exportBounds(){const period=$('export-period').value;if(period==='all')return {from:'',to:'',label:'Seluruh periode'};if(period==='current'){const y=data.settings.academicYearStart;return {from:`${y}-07-01`,to:`${y+1}-06-30`,label:`Tahun ajaran ${y}/${y+1}`};}const from=$('export-from').value,to=$('export-to').value;if(!from||!to||to<from)throw Error('Lengkapi rentang tanggal yang benar.');return {from,to,label:`${from} s.d. ${to}`};}
$('export-period').onchange=()=>{for(const id of ['export-from','export-to'])$(id).disabled=$('export-period').value!=='custom';};
let exporting=false;
async function exportData(format){
 if(exporting)return;
 let printWindow=null;
 if(format==='pdf'){printWindow=window.open('','_blank');if(!printWindow)return errorAt('export-status','Izinkan pop-up untuk membuka laporan PDF.');printWindow.document.write('<p>Menyiapkan laporan…</p>');}
 exporting=true;for(const id of ['export-excel','export-pdf','export-json'])$(id).disabled=true;
 try{
  await reload();const bounds=format==='json'?{from:'',to:'',label:'Seluruh periode'}:exportBounds();
 const r=await window.absensiBackend.data.refresh();if(!r.isOk)throw Error(r.error?.message||'Riwayat gagal dimuat.');
  const all=r.data||[],records=all.filter(r=>(!bounds.from||r.attendance_date>=bounds.from)&&(!bounds.to||r.attendance_date<=bounds.to)),sheets=exportSheets(records,$('export-kind').value),date=new Date().toLocaleDateString('en-CA'),filename=`sekolah-absenku-${date}`;
  if(format==='json'){
   const {isOk,...master}=data;AcademicExport.download(new Blob([JSON.stringify({format:'sekolah-absenku-academic-v1',exported_at:new Date().toISOString(),master,records:all},null,2)],{type:'application/json'}),filename+'-salinan.json');
  }else if(format==='xlsx')AcademicExport.excel(sheets,filename+'.xlsx');
  else{printWindow.document.open();printWindow.document.write(AcademicExport.printable(sheets,'Sekolah Absenku · Laporan Akademik',`${bounds.label} · Diekspor ${date} · Data master keadaan terbaru`));printWindow.document.close();}
  errorAt('export-status',format==='pdf'?'Laporan terbuka. Klik Cetak / Simpan sebagai PDF, lalu pilih tujuan Simpan sebagai PDF.':'File selesai disiapkan. Periksa folder unduhan.');
 }catch(e){if(printWindow)printWindow.close();errorAt('export-status',e.message);}finally{exporting=false;for(const id of ['export-excel','export-pdf','export-json'])$(id).disabled=false;}
}
$('export-excel').onclick=()=>exportData('xlsx');$('export-pdf').onclick=()=>exportData('pdf');$('export-json').onclick=()=>exportData('json');
window.addEventListener('absensi-session-expired',()=>{document.querySelectorAll('dialog[open]').forEach(x=>x.close());$('workspace').classList.add('hidden');message('Sesi telah berakhir. Kembali ke dashboard untuk login.',true);});
(async()=>{try{await reload();$('workspace').classList.remove('hidden');message(window.absensiBackend.mode==='review-local'?'Mode review: perubahan hanya tersimpan sementara pada halaman ini.':'Akses Admin aktif. Perubahan akademik akan dicatat dalam log.');}catch(e){message(e.message+' Silakan kembali ke dashboard dan login sebagai Admin.',true);}})();
