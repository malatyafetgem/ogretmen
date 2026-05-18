function renderSettings(){
  const dayValue=getEl('classProgramDay')?.value||window.settingsProgramDay||schoolDays()[0]||'Pazartesi';
  window.settingsProgramDay=dayValue;
  getEl('settingsContent').innerHTML=`
    <section class="settings-group">
      <div class="settings-group-head"><h3>Günlük İşler</h3><p>İçe aktarma, yedekleme ve sık kullanılan program işlemleri.</p></div>
      <div class="row g-3">
        <div class="col-lg-6">${buildImportSettings()}</div>
        <div class="col-lg-6">${buildBackupSettings()}</div>
        <div class="col-12">${buildDutySettings()}</div>
        <div class="col-12">${buildClassProgramSettings(dayValue)}</div>
      </div>
    </section>
    <section class="settings-group">
      <div class="settings-group-head"><h3>Ders Kuralları</h3><p>Aynı anda aynı sınıfta birden fazla öğretmenin girebileceği ders çiftleri.</p></div>
      <div class="row g-3">
        <div class="col-12">${buildSharedLessonSettings()}</div>
      </div>
    </section>
    <section class="settings-group">
      <div class="settings-group-head"><h3>Okul Yapısı</h3><p>Günler, ders saatleri ve ders adları gibi temel tanımlar.</p></div>
      <div class="row g-3">
        <div class="col-12">${buildCalendarSettings()}</div>
        <div class="col-12">${buildSubjectSettings()}</div>
      </div>
    </section>`;
}

function buildImportSettings(){
  return `<div class="card obs-panel h-100"><div class="card-header"><h3 class="card-title">Excel / CSV İçe Aktar</h3></div><div class="card-body">
    <div class="import-block">
      <h4>Öğretmen Bilgileri</h4>
      <p class="text-muted small">Excel veya CSV dosyası yükleyin; sihirbaz sizi sütun eşleştirme adımlarından geçirecek. T.C. Kimlik No esas alınır: mevcut kayıtlar güncellenir, yeni kayıtlar eklenir.</p>
      <input type="file" class="form-control" accept=".xlsx,.xls,.csv" onchange="importTeacherFile(event)">
    </div>
    <div class="import-block">
      <div class="section-title-row">
        <h4>Ders Programı</h4>
        <button class="btn btn-sm btn-outline-secondary no-print" onclick="downloadScheduleTemplate()"><i class="fas fa-download me-1"></i>Şablonu İndir</button>
      </div>
      <p class="text-muted small mb-3">Her satır tek ders kaydıdır. Başlıklar: ${SCHEDULE_IMPORT_FIELDS.join(', ')}</p>
      <div class="row g-2 align-items-end">
        <div class="col-md-5"><label class="form-label">İçe Aktarma Biçimi</label><select id="scheduleImportMode" class="form-select"><option value="replace">Mevcut programı değiştir</option><option value="append">Mevcut programa ekle</option></select></div>
        <div class="col-md-7"><label class="form-label">Ders Programı Dosyası</label><input type="file" class="form-control" accept=".xlsx,.xls,.csv" onchange="importScheduleFile(event)"></div>
      </div>
      <div id="scheduleImportFeedback" class="import-feedback mt-2"></div>
    </div>
  
  </div></div>`;
}

function buildBackupSettings(){
  return `<div class="card obs-panel h-100"><div class="card-header"><h3 class="card-title">Yedekleme</h3></div><div class="card-body d-grid gap-2"><button class="btn btn-outline-primary" onclick="exportBackup()">Yedeği İndir</button><input type="file" class="form-control" accept=".json" onchange="importBackup(event)"><details class="danger-tools"><summary>Gelişmiş işlemleri göster</summary><div class="d-grid gap-2 mt-2"><button class="btn btn-outline-secondary" onclick="loadDemoData()">Örnek Veri Ekle</button><button class="btn btn-outline-danger" onclick="resetAllData()">Tüm Verileri Sıfırla</button></div></details></div></div>`;
}

function buildCalendarSettings(){
  const dayRows=schoolDays().map((day,i)=>daySettingsRow(day,i)).join('');
  const timeRows=schoolHours().map((hour,i)=>lessonTimeRow(lessonTimeByHour(hour)||{hour,start:'',end:''},i)).join('');
  return `<div class="card obs-panel"><div class="card-header d-flex align-items-center justify-content-between"><h3 class="card-title"><i class="fas fa-clock me-2"></i>Günler ve Ders Saatleri</h3><div class="page-actions no-print"><button class="btn btn-sm btn-outline-secondary" onclick="addDaySettingsRow()">Gün Ekle</button><button class="btn btn-sm btn-outline-secondary" onclick="addLessonTimeRow()">Saat Ekle</button><button class="btn btn-sm btn-primary" onclick="saveCalendarSettings()">Kaydet</button></div></div><div class="card-body"><p class="text-muted small">Program, nöbet, boş saat ve çarşaf raporları bu gün/saat listesinden beslenir. Gün adı değişirse mevcut program ve nöbet kayıtları yeni ada aktarılır.</p><div class="row g-3"><div class="col-lg-5"><div class="table-responsive"><table class="table settings-matrix mb-0"><thead><tr><th>Gün</th><th class="no-print">İşlem</th></tr></thead><tbody id="daySettingsBody">${dayRows}</tbody></table></div></div><div class="col-lg-7"><div class="table-responsive"><table class="table settings-matrix mb-0"><thead><tr><th>Ders</th><th>Başlangıç</th><th>Bitiş</th><th class="no-print">İşlem</th></tr></thead><tbody id="lessonTimeBody">${timeRows}</tbody></table></div></div></div></div></div>`;
}

function daySettingsRow(day,index){
  return `<tr class="day-settings-row" data-original-day="${escapeHtml(day||'')}" data-row="${index}"><td><input class="form-control form-control-sm day-name-input" value="${escapeHtml(day||'')}" placeholder="Gün adı"></td><td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function lessonTimeRow(item,index){
  return `<tr class="lesson-time-row" data-row="${index}"><td><input type="number" min="1" class="form-control form-control-sm lesson-hour-input" value="${escapeHtml(item.hour||'')}" placeholder="Ders"></td><td><input type="time" class="form-control form-control-sm lesson-start-input" value="${escapeHtml(item.start||'')}"></td><td><input type="time" class="form-control form-control-sm lesson-end-input" value="${escapeHtml(item.end||'')}"></td><td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function addDaySettingsRow(){
  getEl('daySettingsBody').insertAdjacentHTML('beforeend',daySettingsRow('',Date.now()));
}

function addLessonTimeRow(){
  const next=Math.max(0,...schoolHours())+1;
  getEl('lessonTimeBody').insertAdjacentHTML('beforeend',lessonTimeRow({hour:next,start:'',end:''},Date.now()));
}

function saveCalendarSettings(){
  const dayRows=[...document.querySelectorAll('#daySettingsBody .day-settings-row')];
  const days=[], dayKeys=new Set(), dayMap=new Map();
  for(const row of dayRows){
    const oldName=row.dataset.originalDay||'';
    const day=row.querySelector('.day-name-input').value.replace(/\s+/g,' ').trim();
    if(!day) continue;
    const key=plainKey(day);
    if(dayKeys.has(key)){ showToast('Aynı gün adı iki kez yazılmış.','warning'); return; }
    dayKeys.add(key);
    days.push(day);
    if(oldName&&oldName!==day) dayMap.set(oldName,day);
  }
  if(!days.length){ showToast('En az bir gün tanımlı olmalı.','warning'); return; }
  const timeRows=[...document.querySelectorAll('#lessonTimeBody .lesson-time-row')];
  const times=[], hourKeys=new Set();
  for(const row of timeRows){
    const hour=Number(row.querySelector('.lesson-hour-input').value);
    const start=row.querySelector('.lesson-start-input').value;
    const end=row.querySelector('.lesson-end-input').value;
    if(!Number.isFinite(hour)||hour<=0) continue;
    if(hourKeys.has(hour)){ showToast('Aynı ders saati iki kez yazılmış.','warning'); return; }
    if((start&&!end)||(!start&&end)){ showToast(`${hour}. ders için başlangıç ve bitiş birlikte girilmeli.`, 'warning'); return; }
    if(start&&end&&timeToMinutes(start)>=timeToMinutes(end)){ showToast(`${hour}. derste bitiş saati başlangıçtan sonra olmalı.`, 'warning'); return; }
    hourKeys.add(hour);
    times.push({hour,start,end});
  }
  if(!times.length){ showToast('En az bir ders saati tanımlı olmalı.','warning'); return; }
  times.sort((a,b)=>a.hour-b.hour);
  dayMap.forEach((newDay,oldDay)=>{
    DB.schedules.forEach(s=>{ if(s.day===oldDay) s.day=newDay; });
    DB.teachers.forEach(t=>{ if(t.dutyDay===oldDay) t.dutyDay=newDay; if(t.freeDay===oldDay) t.freeDay=newDay; });
  });
  DB.settings.days=days;
  DB.settings.hours=times.map(t=>t.hour);
  DB.settings.lessonTimes=times;
  saveDB();
  hydrateStaticSelects();
  renderAll();
  showToast('Gün ve ders saatleri kaydedildi.','success');
}

function buildDutySettings(){
  const days=schoolDays();
  const assignments={};
  DB.teachers.forEach(t=>{ if(t.dutyDay&&t.dutyPlace) assignments[`${t.dutyPlace}__${t.dutyDay}`]=t.id; });
  const rows=getDutyPlaces().map((place,i)=>dutyPlaceRow(place,i,assignments)).join('');
  return `<div class="card obs-panel"><div class="card-header d-flex align-items-center justify-content-between"><h3 class="card-title"><i class="fas fa-clipboard-check me-2"></i>Nöbet Düzeni</h3><div class="page-actions no-print"><button class="btn btn-sm btn-outline-secondary" onclick="addDutyPlaceRow()">Satır Ekle</button><button class="btn btn-sm btn-primary" onclick="saveDutyMatrix()">Kaydet</button></div></div><div class="card-body"><p class="text-muted small">Sütunlar günleri, satırlar nöbet yerlerini gösterir. Nöbet yeri adını değiştirip kaydedebilir veya yeni satır ekleyebilirsiniz.</p><div class="table-responsive"><table class="table settings-matrix mb-0"><thead><tr><th>Nöbet Yeri</th>${days.map(d=>`<th>${d}</th>`).join('')}<th class="no-print">İşlem</th></tr></thead><tbody id="dutyMatrixBody">${rows}</tbody></table></div></div></div>`;
}

function dutyPlaceRow(place,index,assignments={}){
  const cells=schoolDays().map(day=>`<td><select class="form-select form-select-sm duty-teacher-select" data-day="${day}">${teacherSelectOptions(assignments[`${place}__${day}`]||'', 'Boş')}</select></td>`).join('');
  return `<tr class="duty-place-row" data-row="${index}"><td class="place-cell"><input class="form-control form-control-sm duty-place-input" value="${escapeHtml(place)}" placeholder="Nöbet yeri"></td>${cells}<td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function addDutyPlaceRow(){
  getEl('dutyMatrixBody').insertAdjacentHTML('beforeend',dutyPlaceRow('',Date.now(),{}));
}

function saveDutyMatrix(){
  const rows=[...document.querySelectorAll('#dutyMatrixBody .duty-place-row')];
  const places=[], placeKeys=new Set(), assignments=[], usedTeachers=new Set();
  for(const row of rows){
    const place=row.querySelector('.duty-place-input').value.trim();
    if(!place) continue;
    const key=normalizeText(place);
    if(placeKeys.has(key)){ showToast('Aynı nöbet yeri iki kez yazılmış.','warning'); return; }
    placeKeys.add(key);
    places.push(place);
    for(const day of schoolDays()){
      const teacherId=row.querySelector(`select[data-day="${day}"]`)?.value||'';
      if(!teacherId) continue;
      if(usedTeachers.has(teacherId)){ showToast('Bir öğretmen aynı nöbet çizelgesinde yalnızca bir kez seçilebilir.','warning',5000); return; }
      usedTeachers.add(teacherId);
      assignments.push({teacherId,day,place});
    }
  }
  DB.teachers.forEach(t=>{ t.dutyDay=''; t.dutyPlace=''; });
  assignments.forEach(a=>{ const t=teacherById(a.teacherId); if(t){ t.dutyDay=a.day; t.dutyPlace=a.place; } });
  DB.settings=DB.settings||{};
  DB.settings.dutyPlaces=places;
  saveDB();
  renderAll();
  showToast('Nöbet düzeni kaydedildi.','success');
}

function getDutyPlaces(){
  return dutyPlaceList();
}

function buildClassProgramSettings(dayValue){
  const days=schoolDays(), hours=schoolHours();
  const dayOptions=days.map(d=>`<option value="${escapeHtml(d)}" ${d===dayValue?'selected':''}>${escapeHtml(d)}</option>`).join('');
  const rows=(DB.settings.classes||CLASS_LIST).map((cls,i)=>classProgramRow(cls,cls,dayValue,i)).join('');
  return `<div class="card obs-panel"><div class="card-header d-flex align-items-center justify-content-between"><h3 class="card-title"><i class="fas fa-calendar-days me-2"></i>Ders Programı Hızlı Düzenleme</h3><div class="page-actions no-print"><button class="btn btn-sm btn-outline-secondary" onclick="addClassProgramRow()">Sınıf Ekle</button><button class="btn btn-sm btn-primary" onclick="saveClassProgramMatrix()">Kaydet</button></div></div><div class="card-body"><div class="row g-2 align-items-end"><div class="col-md-3"><label class="form-label">Gün</label><select id="classProgramDay" class="form-select" onchange="window.settingsProgramDay=this.value; renderSettings()">${dayOptions}</select></div><div class="col-md-9"><p class="text-muted small mb-0">Bu tablo seçili günü düzenler. Sütunlar ders saatlerini, satırlar sınıfları gösterir. Öğretmen listesi alfabetiktir; kaydedince ders adı öğretmenin branşından alınır.</p></div></div><div class="table-responsive mt-3"><table class="table settings-matrix mb-0"><thead><tr><th>Sınıf</th>${hours.map(h=>`<th>${h}. Ders<br><small>${escapeHtml(lessonTimeByHour(h)?.start||'')}</small></th>`).join('')}<th class="no-print">İşlem</th></tr></thead><tbody id="classProgramBody">${rows}</tbody></table></div></div></div>`;
}

function classProgramRow(className,originalClass,day,index){
  const hours=schoolHours();
  const cells=hours.map(hour=>{
    const item=DB.schedules.find(s=>s.className===className&&s.day===day&&Number(s.hour)===Number(hour));
    return `<td><select class="form-select form-select-sm class-program-teacher" data-hour="${hour}">${teacherSelectOptions(item?.teacherId||'', 'Boş')}</select></td>`;
  }).join('');
  return `<tr class="class-program-row" data-original-class="${escapeHtml(originalClass||'')}" data-row="${index}"><td class="place-cell"><input class="form-control form-control-sm class-name-input" value="${escapeHtml(className||'')}" placeholder="Örn: 9A"></td>${cells}<td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function addClassProgramRow(){
  const day=getEl('classProgramDay')?.value||window.settingsProgramDay||schoolDays()[0]||'Pazartesi';
  getEl('classProgramBody').insertAdjacentHTML('beforeend',classProgramRow('', '', day, Date.now()));
}

function removeSettingsRow(btn){
  const row=btn.closest('tr');
  if(row&&confirm('Bu satır kaldırılacak. Kaydetmeden kesinleşmez.')) row.remove();
}

function saveClassProgramMatrix(){
  const day=getEl('classProgramDay')?.value||window.settingsProgramDay||schoolDays()[0];
  const rows=[...document.querySelectorAll('#classProgramBody .class-program-row')];
  const oldClasses=DB.settings.classes||CLASS_LIST, classNames=[], classKeys=new Set(), maps=[];
  for(const row of rows){
    const oldName=row.dataset.originalClass||'';
    const className=cleanClassName(row.querySelector('.class-name-input').value);
    if(!className) continue;
    const key=normalizeText(className);
    if(classKeys.has(key)){ showToast('Aynı sınıf iki kez yazılmış.','warning'); return; }
    classKeys.add(key);
    classNames.push(className);
    maps.push({oldName,className,row});
  }
  // Conflict check: same teacher assigned to multiple classes at same day+hour
  for(const hour of schoolHours()){
    const used=new Map();
    for(const item of maps){
      const teacherId=item.row.querySelector(`select[data-hour="${hour}"]`)?.value||'';
      if(!teacherId) continue;
      if(used.has(teacherId)){
        showToast(`${day} ${hour}. derste aynı öğretmen birden fazla sınıfa seçilmiş.`, 'warning', 6000);
        return;
      }
      used.set(teacherId,item.className);
    }
  }
  maps.forEach(m=>{ if(m.oldName&&m.oldName!==m.className) DB.schedules.forEach(s=>{ if(s.className===m.oldName) s.className=m.className; }); });
  const allowed=new Set(classNames), oldSet=new Set(oldClasses);
  DB.schedules=DB.schedules.filter(s=>!(oldSet.has(s.className)&&!allowed.has(s.className)));
  // Remove existing entries for this day for all managed classes
  DB.schedules=DB.schedules.filter(s=>!(allowed.has(s.className)&&s.day===day));
  maps.forEach(m=>{
    schoolHours().forEach(hour=>{
      const teacherId=m.row.querySelector(`select[data-hour="${hour}"]`)?.value||'';
      if(!teacherId) return;
      const t=teacherById(teacherId);
      const time=lessonTimeByHour(hour);
      const subject=t?.subjects?.[0]||t?.branch||'Ders';
      DB.schedules.push({id:uid('s'),teacherId,className:m.className,subject,day,hour,startTime:time?.start||'',endTime:time?.end||'',note:''});
    });
  });
  DB.settings.classes=classNames;
  saveDB();
  renderAll();
  showToast('Ders programı hızlı düzenleme kaydedildi.','success');
}

function buildSubjectSettings(){
  const rows=(DB.settings.subjects||subjectSettings()).map((item,i)=>subjectSettingsRow(item,i)).join('');
  return `<div class="card obs-panel"><div class="card-header d-flex align-items-center justify-content-between"><h3 class="card-title"><i class="fas fa-book-open me-2"></i>Dersler ve Kısaltmalar</h3><div class="page-actions no-print"><button class="btn btn-sm btn-outline-secondary" onclick="addSubjectSettingsRow()">Ders Ekle</button><button class="btn btn-sm btn-primary" onclick="saveSubjectSettings()">Kaydet</button></div></div><div class="card-body"><p class="text-muted small">Çarşaf program ve sınıf/öğretmen özetlerinde kullanılan ders adları ve kısa kodlar burada tutulur.</p><div class="table-responsive"><table class="table settings-matrix mb-0 subject-settings-table"><thead><tr><th>Ders Adı</th><th>Kısaltma</th><th class="no-print">İşlem</th></tr></thead><tbody id="subjectSettingsBody">${rows}</tbody></table></div></div></div>`;
}

function subjectSettingsRow(item,index){
  return `<tr class="subject-settings-row" data-row="${index}"><td><input class="form-control form-control-sm subject-name-input" value="${escapeHtml(item.name||'')}" placeholder="Ders adı"></td><td><input class="form-control form-control-sm subject-code-input" value="${escapeHtml(item.code||'')}" placeholder="Kısaltma"></td><td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function addSubjectSettingsRow(){
  getEl('subjectSettingsBody').insertAdjacentHTML('beforeend',subjectSettingsRow({name:'',code:''},Date.now()));
}

function saveSubjectSettings(){
  const rows=[...document.querySelectorAll('#subjectSettingsBody .subject-settings-row')];
  const subjects=[], keys=new Set();
  for(const row of rows){
    const name=row.querySelector('.subject-name-input').value.replace(/\s+/g,' ').trim();
    const code=row.querySelector('.subject-code-input').value.replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
    if(!name) continue;
    const key=plainKey(name);
    if(keys.has(key)){ showToast('Aynı ders adı iki kez yazılmış.','warning'); return; }
    keys.add(key);
    subjects.push({name,code:code||subjectCode(name)});
  }
  if(!subjects.length){ showToast('En az bir ders tanımlı olmalı.','warning'); return; }
  DB.settings.subjects=subjects;
  SUBJECT_SETTINGS_RUNTIME=normalizeSubjectSettings(subjects).map(s=>({...s,key:plainKey(s.name)}));
  saveDB();
  renderAll();
  showToast('Ders ve kısaltma listesi kaydedildi.','success');
}

function buildSharedLessonSettings(){
  const pairs=(DB.settings.sharedLessonPairs||[]);
  const subjects=subjectSettings().sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  const baseOpts=subjects.map(s=>`<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
  const rows=pairs.map((pair,i)=>sharedLessonRow(pair,i,baseOpts)).join('');
  return `<div class="card obs-panel"><div class="card-header d-flex align-items-center justify-content-between"><h3 class="card-title"><i class="fas fa-link me-2"></i>Ortak Ders Çiftleri</h3><div class="page-actions no-print"><button class="btn btn-sm btn-outline-secondary" onclick="addSharedLessonRow()">Çift Ekle</button><button class="btn btn-sm btn-primary" onclick="saveSharedLessonSettings()">Kaydet</button></div></div><div class="card-body"><p class="text-muted small">Aynı sınıfta aynı saatte birlikte işlenen ders çiftleri. Bu çiftler çakışma uyarısı üretmez.</p><table class="table settings-matrix mb-0"><thead><tr><th>1. Ders</th><th style="width:28px"></th><th>2. Ders</th><th class="no-print" style="width:56px">İşlem</th></tr></thead><tbody id="sharedLessonBody">${rows||`<tr id="sharedLessonEmpty"><td colspan="4" class="text-muted text-center py-3">Henüz ortak ders çifti eklenmedi.</td></tr>`}</tbody></table></div></div>`;
}

function sharedLessonRow(pair,index,baseOpts){
  if(!baseOpts){
    const subjects=subjectSettings().sort((a,b)=>a.name.localeCompare(b.name,'tr'));
    baseOpts=subjects.map(s=>`<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
  }
  const mkSel=(val,cls)=>`<select class="form-select form-select-sm ${cls}"><option value="">— Ders seçin —</option>${baseOpts.replace(`value="${escapeHtml(val)}"`,`value="${escapeHtml(val)}" selected`)}</select>`;
  return `<tr class="shared-lesson-row" data-row="${index}"><td>${mkSel(pair[0]||'','shared-subject-1')}</td><td class="text-center text-muted fw-bold">+</td><td>${mkSel(pair[1]||'','shared-subject-2')}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger" onclick="removeSettingsRow(this)">Sil</button></td></tr>`;
}

function addSharedLessonRow(){
  const body=getEl('sharedLessonBody');
  const empty=getEl('sharedLessonEmpty'); if(empty) empty.remove();
  const subjects=subjectSettings().sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  const baseOpts=subjects.map(s=>`<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
  body.insertAdjacentHTML('beforeend',sharedLessonRow(['',''],Date.now(),baseOpts));
}

function saveSharedLessonSettings(){
  const rows=[...document.querySelectorAll('#sharedLessonBody .shared-lesson-row')];
  const pairs=[];
  for(const row of rows){
    const a=row.querySelector('.shared-subject-1').value.trim();
    const b=row.querySelector('.shared-subject-2').value.trim();
    if(!a||!b){ showToast('Her çiftin iki dersi de dolu olmalı.','warning'); return; }
    if(plainKey(a)===plainKey(b)){ showToast('Aynı ders iki kez yazılamaz.','warning'); return; }
    pairs.push([a,b]);
  }
  DB.settings.sharedLessonPairs=pairs;
  saveDB();
  renderSettings();
  showToast('Ortak ders çiftleri kaydedildi.','success');
}

function teacherSelectOptions(selected='', emptyLabel='Seçiniz'){
  const teachers=sortedTeachers();
  return `<option value="">${emptyLabel}</option>`+teachers.map(t=>`<option value="${t.id}" ${t.id===selected?'selected':''}>${escapeHtml(teacherName(t))}</option>`).join('');
}

// Seed yükleme fonksiyonları kaldırıldı — veriler yalnızca Firebase'den gelir

/* ─────────────────────────────────────────────────
   Öğretmen İçe Aktarma Sihirbazı
───────────────────────────────────────────────── */

let _tiExcelData  = [];   // parse edilen satırlar
let _tiHeaders    = [];   // Excel başlıkları
let _tiWizardStep = 0;    // 0 = zorunlu alanlar, 1 = ek alanlar
let _tiPendingData = null; // önizleme verisi

// Sistem alanı map: key → { label, header (tahmin için), fieldKey (teacher objesindeki alan adı) }
const TI_SYSTEM_FIELDS = [
  { key:'phone',        label:'Cep Telefonu', header:'CEP TELEFONU',  fieldKey:'phone' },
  { key:'email',        label:'E-posta',       header:'E-POSTA',       fieldKey:'email' },
  { key:'classAdvisor', label:'Sınıf',         header:'SINIFI',        fieldKey:'classAdvisor' },
  { key:'club',         label:'Kulüp',         header:'KULÜP',         fieldKey:'club' },
  { key:'project',      label:'Proje',         header:'PROJE',         fieldKey:'project' },
  { key:'freeDay',      label:'Boş Gün',       header:'BOŞ GÜN',       fieldKey:'freeDay' },
  { key:'dutyDay',      label:'Nöbet Günü',    header:'NÖBET GÜNÜ',    fieldKey:'dutyDay' },
  { key:'dutyPlace',    label:'Nöbet Yeri',    header:'NÖBET YERİ',    fieldKey:'dutyPlace' },
];

function importTeacherFile(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  if(!window.XLSX){
    showToast('Excel içe aktarma için XLSX kütüphanesi gerekir.','warning',6000);
    e.target.value = ''; return;
  }
  if(!/\.(xlsx|xls|xlsm|csv)$/i.test(f.name)){
    showToast('Sadece Excel/CSV dosyaları yüklenebilir.','error');
    e.target.value = ''; return;
  }
  const r = new FileReader();
  r.onerror = () => { showToast('Dosya okunamadı.','danger'); e.target.value = ''; };
  r.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array', raw:false});
      let sheet = null;
      for(const sn of wb.SheetNames){ const s = wb.Sheets[sn]; if(s && s['!ref']){ sheet = s; break; } }
      if(!sheet) throw new Error('Dosyada dolu sayfa bulunamadı.');
      _tiExcelData = XLSX.utils.sheet_to_json(sheet, {defval:'', raw:false});
      if(!_tiExcelData.length) throw new Error('Sayfada veri satırı bulunamadı.');
      const range = XLSX.utils.decode_range(sheet['!ref']);
      _tiHeaders = [];
      for(let C = range.s.c; C <= range.e.c; C++){
        const cell = sheet[XLSX.utils.encode_cell({c:C, r:range.s.r})];
        if(cell && cell.v !== undefined && String(cell.v).trim() !== '')
          _tiHeaders.push(String(cell.v).trim());
      }
      if(!_tiHeaders.length) throw new Error('Başlık satırı okunamadı.');
      _tiWizardStep = 0;
      _tiRenderWizardStep();
      bootstrap.Modal.getOrCreateInstance(getEl('teacherImportWizardModal')).show();
    } catch(err){
      showToast('Hata: ' + (err.message || 'Bilinmeyen hata'), 'danger');
    }
    e.target.value = '';
  };
  r.readAsArrayBuffer(f);
}

// Ortak yardımcı: başlık tahmin eder
function _tiGuess(label){
  const norm = s => s.toLocaleLowerCase('tr-TR').replace(/[\s\.]+/g,'');
  const t = norm(label);
  return _tiHeaders.find(col => norm(col) === t || norm(col).includes(t)) || '';
}

// Ortak yardımcı: sütun <option> listesi
function _tiColOpts(selected='', allowEmpty=false){
  let html = allowEmpty ? '<option value="">— Boş Geç —</option>' : '<option value="">— Sütun Seçin —</option>';
  _tiHeaders.forEach(col => {
    const sel = selected && col.toLocaleLowerCase('tr-TR') === selected.toLocaleLowerCase('tr-TR');
    html += `<option value="${escapeHtml(col)}" ${sel?'selected':''}>${escapeHtml(col)}</option>`;
  });
  return html;
}

// Adım geçişlerinde zorunlu alan seçimlerini sakla
let _tiStep1Saved = {};
function _tiSaveStep1(){
  _tiStep1Saved = {
    tc:     getEl('tiColTc')?.value     || '',
    first:  getEl('tiColFirst')?.value  || '',
    last:   getEl('tiColLast')?.value   || '',
    branch: getEl('tiColBranch')?.value || '',
  };
}

const TI_WIZ_STEPS = [
  { title:'1. Zorunlu Alanlar' },
  { title:'2. Ek Alanlar' },
];

function _tiRenderWizardStep(){
  const step = _tiWizardStep;
  const progHtml = `<div class="ti-wizard-progress">
    <div class="ti-wizard-step-row">
      ${TI_WIZ_STEPS.map((s,i)=>`<div class="ti-wizard-step-label ${i===step?'is-active':i<step?'is-complete':''}">${i<step?'✓ ':''}${s.title}</div>`).join('')}
    </div>
    <div class="progress ti-prog-bar-wrap"><div class="progress-bar ti-prog-bar" style="width:${Math.round(((step+1)/TI_WIZ_STEPS.length)*100)}%"></div></div>
  </div>`;

  let stepHtml = '';

  if(step === 0){
    // ── Adım 1: Zorunlu Alanlar ──
    const s = _tiStep1Saved;
    stepHtml = `
      <div class="ti-section">
        <div class="ti-section-head"><i class="fas fa-lock me-1"></i> Zorunlu Alanlar</div>
        <div class="ti-field-row">
          <label class="ti-field-label">T.C. Kimlik No <span class="text-danger">*</span></label>
          <select id="tiColTc" class="form-select form-select-sm">${_tiColOpts(s.tc||_tiGuess('T.C. KİMLİK NO'))}</select>
        </div>
        <div class="ti-field-row">
          <label class="ti-field-label">Adı <span class="text-danger">*</span></label>
          <select id="tiColFirst" class="form-select form-select-sm">${_tiColOpts(s.first||_tiGuess('ADI'))}</select>
        </div>
        <div class="ti-field-row">
          <label class="ti-field-label">Soyadı <span class="text-danger">*</span></label>
          <select id="tiColLast" class="form-select form-select-sm">${_tiColOpts(s.last||_tiGuess('SOYADI'))}</select>
        </div>
        <div class="ti-field-row">
          <label class="ti-field-label">Branşı <span class="text-danger">*</span></label>
          <select id="tiColBranch" class="form-select form-select-sm">${_tiColOpts(s.branch||_tiGuess('BRANŞI'))}</select>
        </div>
      </div>`;
  } else {
    // ── Adım 2: Ek Alanlar ──
    stepHtml = `
      <div class="ti-section">
        <div class="ti-section-head d-flex align-items-center justify-content-between">
          <span><i class="fas fa-sliders-h me-1"></i> Ek Alanlar <span class="ti-section-sub">İsteğe bağlı — profil kartına eklenir</span></span>
          <button class="btn btn-sm btn-outline-primary" onclick="tiAddExtraRow()"><i class="fas fa-plus me-1"></i>Alan Ekle</button>
        </div>
        <div id="tiExtraContainer"></div>
        <p class="text-muted small ti-extra-hint">Her satırda soldan Excel sütununu seçin, sağa profilde görünecek adı yazın.</p>
      </div>`;
  }

  getEl('teacherImportWizardBody').innerHTML = progHtml + stepHtml;

  // Adım 2'deyse önceki satırları geri yükle
  if(step === 1){
    (_tiExtraRows || []).forEach(r => tiAddExtraRow(r.col, r.label));
    if(!(_tiExtraRows||[]).length){
      // Sistem alanlarından tahmin ederek başlangıç satırları ekle
      TI_SYSTEM_FIELDS.forEach(def => {
        const col = _tiGuess(def.header);
        if(col) tiAddExtraRow(col, def.label);
      });
    }
  }

  // Footer
  const btnBack = step > 0
    ? `<button type="button" class="btn btn-outline-secondary" onclick="tiWizardNav(-1)"><i class="fas fa-arrow-left me-1"></i>Geri</button>`
    : `<button type="button" class="btn btn-outline-secondary" onclick="cancelTeacherImport()">İptal</button>`;
  const btnNext = step < TI_WIZ_STEPS.length - 1
    ? `<button type="button" class="btn btn-primary ms-auto" onclick="tiWizardNav(1)">İleri <i class="fas fa-arrow-right ms-1"></i></button>`
    : `<button type="button" class="btn btn-primary ms-auto" onclick="processTeacherImport()">Önizle <i class="fas fa-eye ms-1"></i></button>`;

  getEl('teacherImportWizardFooter').innerHTML = btnBack + btnNext;
}

// Sihirbaz gezinme
let _tiExtraRows = []; // { col, label } — adım 2 satırları bellekte
function tiWizardNav(dir){
  if(_tiWizardStep === 0 && dir === 1){
    // Zorunlu alan kontrolü
    if(!getEl('tiColTc')?.value)     { showToast('T.C. Kimlik No sütununu seçin.','warning'); return; }
    if(!getEl('tiColFirst')?.value)  { showToast('Adı sütununu seçin.','warning'); return; }
    if(!getEl('tiColLast')?.value)   { showToast('Soyadı sütununu seçin.','warning'); return; }
    if(!getEl('tiColBranch')?.value) { showToast('Branşı sütununu seçin.','warning'); return; }
    _tiSaveStep1();
  }
  if(_tiWizardStep === 1 && dir === -1){
    // Adım 2'den geri gelirken mevcut satırları kaydet
    _tiSaveExtraRows();
  }
  _tiWizardStep = Math.max(0, Math.min(TI_WIZ_STEPS.length - 1, _tiWizardStep + dir));
  _tiRenderWizardStep();
}

function _tiSaveExtraRows(){
  _tiExtraRows = [];
  document.querySelectorAll('.ti-extra-row').forEach(row => {
    const col   = row.querySelector('.ti-extra-col')?.value  || '';
    const label = row.querySelector('.ti-extra-label-in')?.value.trim() || '';
    if(col || label) _tiExtraRows.push({col, label});
  });
}

// Satır ekle: sol = sütun dropdown, sağ = etiket text input
function tiAddExtraRow(selectedCol='', typedLabel=''){
  const container = getEl('tiExtraContainer');
  if(!container) return;
  const div = document.createElement('div');
  div.className = 'ti-extra-row';
  div.innerHTML = `
    <select class="form-select form-select-sm ti-extra-col">
      ${_tiColOpts(selectedCol, true)}
    </select>
    <i class="fas fa-arrow-right ti-extra-arrow"></i>
    <input type="text" class="form-control form-control-sm ti-extra-label-in" placeholder="Profilde görünecek ad (örn: Görev)" value="${escapeHtml(typedLabel)}">
    <button class="btn btn-sm btn-outline-danger ti-extra-remove" onclick="this.closest('.ti-extra-row').remove()" title="Kaldır"><i class="fas fa-times"></i></button>`;
  container.appendChild(div);
}

function processTeacherImport(){
  _tiSaveExtraRows();

  const colTc     = _tiStep1Saved.tc;
  const colFirst  = _tiStep1Saved.first;
  const colLast   = _tiStep1Saved.last;
  const colBranch = _tiStep1Saved.branch;

  // Ek alan eşlemeleri: { col, label, fieldKey (sistem alanı varsa), isExtra (serbest ise) }
  const extraMappings = _tiExtraRows.filter(r => r.col && r.label).map(r => {
    const sys = TI_SYSTEM_FIELDS.find(f => f.label === r.label || f.header === r.label.toLocaleUpperCase('tr-TR'));
    return { col: r.col, label: r.label, fieldKey: sys ? sys.fieldKey : null };
  });

  const toAdd = [], toUpdate = [], errRows = [];
  const tcSeen = new Set();

  _tiExcelData.forEach((row, idx) => {
    const rowNum = idx + 2;
    const rawTc    = String(row[colTc]     || '').replace(/\D+/g,'').trim();
    const firstName = String(row[colFirst] || '').trim();
    const lastName  = String(row[colLast]  || '').trim();
    const branch    = String(row[colBranch]|| '').trim();

    if(!rawTc)               { errRows.push({rowNum, reason:'T.C. Kimlik No boş'}); return; }
    if(rawTc.length !== 11)  { errRows.push({rowNum, reason:`T.C. geçersiz (${rawTc.length} hane)`}); return; }
    if(!firstName)           { errRows.push({rowNum, reason:'Adı boş'}); return; }
    if(!lastName)            { errRows.push({rowNum, reason:'Soyadı boş'}); return; }
    if(!branch)              { errRows.push({rowNum, reason:'Branşı boş'}); return; }
    if(tcSeen.has(rawTc))    { errRows.push({rowNum, reason:'Aynı T.C. iki kez'}); return; }
    tcSeen.add(rawTc);

    const hashed   = tcHash(rawTc);
    const existing = DB.teachers.find(t => t.id === hashed || String(t._tcRaw||'') === rawTc);

    const rec = {
      phone:'', email:'', classAdvisor:'', club:'', project:'',
      freeDay:'', dutyDay:'', dutyPlace:'', scheduleNote:'',
      ...(existing || {}),
      id: hashed, _tcRaw: rawTc, firstName, lastName,
      branch: typeof normalizeBranchName === 'function' ? normalizeBranchName(branch) : branch,
      extraFields: { ...(existing?.extraFields || {}) },
    };

    // Ek alanları uygula
    extraMappings.forEach(m => {
      const val = String(row[m.col] || '').trim();
      if(!val) return;
      if(m.fieldKey === 'classAdvisor') rec.classAdvisor = cleanClassName(val);
      else if(m.fieldKey)               rec[m.fieldKey]  = val;
      else                              rec.extraFields[m.label] = val; // serbest alan
    });

    if(existing) toUpdate.push(rec);
    else toAdd.push(rec);
  });

  _tiPendingData = { toAdd, toUpdate, errRows, extraMappings };

  // ── Önizleme ──
  let html = `<div class="ti-preview-summary">
    <div class="ti-preview-box ti-preview-add"><strong>${toAdd.length}</strong><span>Yeni Kayıt</span></div>
    <div class="ti-preview-box ti-preview-upd"><strong>${toUpdate.length}</strong><span>Güncellenecek</span></div>
    <div class="ti-preview-box ti-preview-err"><strong>${errRows.length}</strong><span>Hatalı Satır</span></div>
  </div>`;

  if(toAdd.length + toUpdate.length === 0){
    html += `<div class="alert alert-warning mt-3">İçe aktarılacak geçerli kayıt bulunamadı.</div>`;
  } else {
    const preview = [...toAdd, ...toUpdate].slice(0, 10);
    const extraHeads = extraMappings.map(m => `<th>${escapeHtml(m.label)}</th>`).join('');
    const rows = preview.map(t => {
      const isUpd = toUpdate.includes(t);
      const badge = isUpd ? '<span class="ti-badge-upd">Güncelle</span>' : '<span class="ti-badge-add">Yeni</span>';
      const extras = extraMappings.map(m => {
        const val = m.fieldKey ? (t[m.fieldKey]||'') : (t.extraFields?.[m.label]||'');
        return `<td>${escapeHtml(String(val))}</td>`;
      }).join('');
      return `<tr><td>${badge}</td><td>${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</td><td>${escapeHtml(t.branch)}</td>${extras}</tr>`;
    }).join('');
    html += `<div class="table-responsive mt-3"><table class="table table-sm table-hover mb-0">
      <thead><tr><th>Durum</th><th>Ad Soyad</th><th>Branş</th>${extraHeads}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    if(toAdd.length + toUpdate.length > 10)
      html += `<p class="text-muted small mt-2">İlk 10 kayıt gösteriliyor; toplamda ${toAdd.length + toUpdate.length} kayıt işlenecek.</p>`;
  }

  if(errRows.length){
    html += `<div class="table-responsive mt-3"><table class="table table-sm mb-0">
      <thead><tr><th>Satır</th><th>Hata</th></tr></thead>
      <tbody>${errRows.map(e=>`<tr><td><strong>${escapeHtml(String(e.rowNum))}</strong></td><td class="text-danger">${escapeHtml(e.reason)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  getEl('teacherImportPreviewBody').innerHTML = html;
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportWizardModal')).hide();
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportPreviewModal')).show();
}

function confirmTeacherImport(){
  if(!_tiPendingData){ cancelTeacherImport(); return; }
  const { toAdd, toUpdate } = _tiPendingData;

  toUpdate.forEach(rec => {
    const idx = DB.teachers.findIndex(t => t.id === rec.id || String(t._tcRaw||'') === rec._tcRaw);
    if(idx >= 0) DB.teachers[idx] = rec;
    else DB.teachers.push(rec);
  });
  toAdd.forEach(rec => DB.teachers.push(rec));

  saveDB();
  renderAll();
  showToast(`${toAdd.length} yeni, ${toUpdate.length} güncelleme tamamlandı.`, 'success');
  cancelTeacherImport();
}

function cancelTeacherImport(){
  _tiPendingData  = null;
  _tiExcelData    = [];
  _tiHeaders      = [];
  _tiExtraRows    = [];
  _tiStep1Saved   = {};
  _tiWizardStep   = 0;
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportWizardModal')).hide();
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportPreviewModal')).hide();
}

function backToTeacherImportWizard(){
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportPreviewModal')).hide();
  _tiWizardStep = 1;
  _tiRenderWizardStep();
  bootstrap.Modal.getOrCreateInstance(getEl('teacherImportWizardModal')).show();
}
function downloadScheduleTemplate(){
  if(!window.XLSX){ showToast('Şablon üretmek için XLSX kütüphanesi gerekir.','warning'); return; }
  const example=[{
    'SINIF':'9A',
    'GÜN':'Pazartesi',
    'DERS SAATİ':1,
    'ÖĞRETMEN T.C.':'',
    'ÖĞRETMEN':'Öğretmen Adı SOYADI',
    'DERS':'Matematik',
    'BAŞLANGIÇ':'08:15',
    'BİTİŞ':'08:55',
    'NOT':''
  }];
  const wb=XLSX.utils.book_new(), ws=XLSX.utils.json_to_sheet(example,{header:SCHEDULE_IMPORT_FIELDS});
  XLSX.utils.book_append_sheet(wb,ws,'Ders Programı');
  XLSX.writeFile(wb,'ders-programi-sablonu.xlsx');
}
function importScheduleFile(e){
  const f=e.target.files&&e.target.files[0];
  if(!f) return;
  if(!window.XLSX){ showToast('Excel içe aktarma için internet bağlantısı veya XLSX kütüphanesi gerekir.','warning',6000); e.target.value=''; return; }
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:'array'}), ws=wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      const parsed=parseScheduleRows(rows);
      if(parsed.errors.length){
        renderScheduleImportFeedback(parsed.errors,'danger');
        showToast(`${parsed.errors.length} satır kontrol edilmeli. Ders programı içe aktarılmadı.`,'warning',6000);
        e.target.value='';
        return;
      }
      const mode=getEl('scheduleImportMode')?.value||'replace';
      const nextSchedules=mode==='append' ? [...DB.schedules,...parsed.items] : parsed.items;
      const conflicts=scheduleImportConflicts(nextSchedules);
      if(conflicts.length){
        renderScheduleImportFeedback(conflicts,'danger');
        showToast('Çakışma bulunduğu için içe aktarma yapılmadı.','warning',6000);
        e.target.value='';
        return;
      }
      applyImportedSchedule(parsed,mode);
      renderScheduleImportFeedback([`${parsed.items.length} ders kaydı içe aktarıldı.`, `${parsed.classes.length} sınıf, ${parsed.subjects.length} ders ve ${parsed.lessonTimes.length} ders saati işlendi.`],'success');
      showToast(`${parsed.items.length} ders kaydı içe aktarıldı.`,'success');
    }catch(err){
      renderScheduleImportFeedback(['Dosya okunamadı. Başlıkları ve ilk sayfayı kontrol edin.'],'danger');
      showToast('Ders programı dosyası okunamadı.','danger');
    }
    e.target.value='';
  };
  r.readAsArrayBuffer(f);
}
function parseScheduleRows(rows){
  const items=[], errors=[], classes=new Map(), subjects=new Map(), lessonTimes=new Map();
  rows.forEach((row,index)=>{
    const line=index+2, get=rowLookup(row);
    const className=cleanClassName(get('SINIF','Sınıf'));
    const rawDay=get('GÜN','Gün');
    const day=schoolDays().find(d=>plainKey(d)===plainKey(rawDay))||'';
    const hour=Number(get('DERS SAATİ','Ders Saati','Saat'));
    const teacher=teacherByImportValue(get('ÖĞRETMEN T.C.','Öğretmen TC','T.C. Kimlik No'),get('ÖĞRETMEN','Öğretmen'));
    const rawSubject=get('DERS','Ders');
    const subject=rawSubject?normalizeSubjectName(rawSubject, teacher?.id||''):'';
    const start=get('BAŞLANGIÇ','Başlangıç');
    const end=get('BİTİŞ','Bitiş');
    const note=get('NOT','Not');
    if(!className) errors.push(`${line}. satır: sınıf boş.`);
    if(!day) errors.push(`${line}. satır: gün tanınmadı (${rawDay||'boş'}).`);
    if(!Number.isFinite(hour)||hour<=0) errors.push(`${line}. satır: ders saati geçersiz.`);
    if(!teacher) errors.push(`${line}. satır: öğretmen bulunamadı.`);
    if(!subject) errors.push(`${line}. satır: ders boş.`);
    if((start&&!end)||(!start&&end)) errors.push(`${line}. satır: başlangıç ve bitiş birlikte girilmeli.`);
    if(start&&end&&timeToMinutes(start)>=timeToMinutes(end)) errors.push(`${line}. satır: bitiş saati başlangıçtan sonra olmalı.`);
    if(errors.length && errors[errors.length-1].startsWith(`${line}.`)) return;
    if(!schoolHours().includes(hour) && !(start&&end)) errors.push(`${line}. satır: ${hour}. ders sistemde yok; yeni saat için başlangıç ve bitiş girilmeli.`);
    if(errors.length && errors[errors.length-1].startsWith(`${line}.`)) return;
    if(start&&end){
      const existing=lessonTimes.get(hour);
      const pair=`${start}-${end}`;
      if(existing&&existing!==pair){ errors.push(`${line}. satır: ${hour}. ders için farklı saat aralıkları var.`); return; }
      lessonTimes.set(hour,pair);
    }
    classes.set(className,className);
    subjects.set(plainKey(subject),subject);
    const time=lessonTimeByHour(hour);
    items.push({id:uid('s'),teacherId:teacher.id,className,subject,day,hour,startTime:start||time?.start||'',endTime:end||time?.end||'',note});
  });
  if(!rows.length) errors.push('Dosyada okunabilir ders kaydı bulunamadı.');
  return {items,errors,classes:[...classes.values()],subjects:[...subjects.values()],lessonTimes:[...lessonTimes.entries()].map(([hour,pair])=>{ const [start,end]=pair.split('-'); return {hour:Number(hour),start,end}; })};
}
function scheduleImportConflicts(items){
  const issues=[], byTeacher=new Map(), byClass=new Map();
  items.forEach(s=>{
    const teacherKey=`${s.teacherId}__${s.day}__${s.hour}`, classKey=`${s.className}__${s.day}__${s.hour}`;
    if(!byTeacher.has(teacherKey)) byTeacher.set(teacherKey,[]);
    if(!byClass.has(classKey)) byClass.set(classKey,[]);
    byTeacher.get(teacherKey).push(s);
    byClass.get(classKey).push(s);
  });
  [...byTeacher.values()].filter(group=>group.length>1).slice(0,6).forEach(group=>{
    const s=group[0], t=teacherById(s.teacherId);
    issues.push(`${teacherName(t)} için ${s.day} ${lessonHourLabel(s.hour)} çakışıyor.`);
  });
  [...byClass.values()].filter(group=>group.length>1&&!isAllowedSharedClassSlot(group)).slice(0,6).forEach(group=>{
    const s=group[0];
    issues.push(`${s.className} için ${s.day} ${lessonHourLabel(s.hour)} çakışıyor.`);
  });
  return issues;
}
function applyImportedSchedule(parsed,mode){
  if(mode==='replace') DB.schedules=parsed.items;
  else DB.schedules.push(...parsed.items);
  DB.settings.subjects=DB.settings.subjects||subjectSettings().map(s=>({name:s.name,code:s.code}));
  const classKeys=new Set((DB.settings.classes||[]).map(plainKey));
  parsed.classes.forEach(cls=>{ if(!classKeys.has(plainKey(cls))){ DB.settings.classes.push(cls); classKeys.add(plainKey(cls)); } });
  const subjectKeys=new Set((DB.settings.subjects||subjectSettings()).map(s=>plainKey(s.name)));
  parsed.subjects.forEach(subject=>{
    const key=plainKey(subject);
    if(!subjectKeys.has(key)){ DB.settings.subjects.push({name:subject,code:subjectCode(subject)}); subjectKeys.add(key); }
  });
  const timeMap=new Map((DB.settings.lessonTimes||LESSON_TIMES).map(t=>[Number(t.hour),{...t}]));
  parsed.lessonTimes.forEach(item=>timeMap.set(Number(item.hour),item));
  DB.settings.lessonTimes=[...timeMap.values()].sort((a,b)=>a.hour-b.hour);
  DB.settings.hours=[...new Set([...(DB.settings.hours||[]),...DB.settings.lessonTimes.map(t=>Number(t.hour))])].sort((a,b)=>a-b);
  saveDB();
  hydrateStaticSelects();
  renderAll();
}
function renderScheduleImportFeedback(lines,type='info'){
  const target=getEl('scheduleImportFeedback');
  if(!target) return;
  const list=(lines||[]).slice(0,8).map(line=>`<li>${escapeHtml(line)}</li>`).join('');
  target.innerHTML=list?`<div class="import-feedback-box feedback-${type}"><strong>${type==='success'?'İçe aktarma tamamlandı':'İçe aktarma kontrolü'}</strong><ul>${list}</ul>${lines.length>8?`<span>İlk 8 kayıt gösteriliyor.</span>`:''}</div>`:'';
}
function exportBackup(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}), a=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10), version=window.OBS_APP_VERSION||'yerel';
  a.href=URL.createObjectURL(blob);
  a.download=`ogretmen-bilgi-yedek-${version}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Yedek indirildi.','success');
}
function importBackup(e){ const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(!Array.isArray(d.teachers)||!Array.isArray(d.schedules))throw Error(); DB=normalizeDB(d); saveDB(); renderAll(); showToast('Yedek geri yüklendi.','success'); }catch(err){ showToast('Yedek dosyası uygun değil.','danger'); } e.target.value=''; }; r.readAsText(f,'utf-8'); }
function resetAllData(){ if(!confirm('Tüm veriler silinsin mi?'))return; DB=makeEmptyDB(); saveDB(); renderAll(); }
function loadDemoData(){ const demo=[['Ayşe','Yılmaz','Matematik','9A','Pazartesi','A Blok','Cuma'],['Mehmet','Kaya','Edebiyat','10B','Çarşamba','Bahçe','Salı'],['Elif','Demir','Biyoloji','11C','Perşembe','B Blok','Perşembe'],['Selim','Arslan','Fizik','12A','Salı','C Blok','Pazartesi']].map(x=>({id:uid('t'),firstName:x[0],lastName:x[1],identityNo:'',branch:x[2],phone:'',email:'',classAdvisor:x[3],club:'',project:'',dutyDay:x[4],dutyPlace:x[5],freeDay:x[6],scheduleNote:''})); DB.teachers.push(...demo); const [a,b,c,d]=demo; DB.schedules.push({id:uid('s'),teacherId:a.id,className:'9A',subject:'Matematik',day:'Pazartesi',hour:1,startTime:'08:15',endTime:'08:55',note:''},{id:uid('s'),teacherId:a.id,className:'9A',subject:'Matematik',day:'Pazartesi',hour:2,startTime:'09:05',endTime:'09:45',note:''},{id:uid('s'),teacherId:b.id,className:'10B',subject:'Edebiyat',day:'Salı',hour:3,startTime:'09:55',endTime:'10:35',note:''},{id:uid('s'),teacherId:c.id,className:'11C',subject:'Biyoloji',day:'Perşembe',hour:5,startTime:'11:35',endTime:'12:15',note:'Lab'},{id:uid('s'),teacherId:d.id,className:'12A',subject:'Fizik',day:'Salı',hour:1,startTime:'08:15',endTime:'08:55',note:''}); DB.tasks=DB.tasks||[]; DB.tasks.push({id:uid('g'),teacherId:a.id,kind:'Demo',title:'Örnek Görev',description:'Deneme amaçlı görev',details:'',startDate:'',endDate:''}); saveDB(); renderAll(); showToast('Örnek veri eklendi.','success'); }
