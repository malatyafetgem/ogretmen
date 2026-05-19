function hydrateStaticSelects(){
  const days=schoolDays(), hours=schoolHours();
  const dayBlank='<option value="">Seçiniz</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
  ['tFreeDay','tDutyDay','sDay'].forEach(id=>{ const el=getEl(id); if(el) el.innerHTML=dayBlank; });
  const dayFilter=getEl('scheduleDayFilter'); if(dayFilter) dayFilter.innerHTML='<option value="">Tüm Günler</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
  const teacherDay=getEl('teacherProfileDay'), teacherDayValue=teacherDay?.value||todayName()||days[0]; if(teacherDay) teacherDay.innerHTML=days.map(d=>`<option value="${d}" ${d===teacherDayValue?'selected':''}>${d}</option>`).join('');
  const classDay=getEl('classProfileDay'); if(classDay) classDay.innerHTML=days.map(d=>`<option value="${d}" ${d===(todayName()||days[0])?'selected':''}>${d}</option>`).join('');
  const hourEl=getEl('sHour'); if(hourEl) hourEl.innerHTML=hours.map(h=>`<option value="${h}">${h}. Ders</option>`).join('');
  const hourFilter=getEl('scheduleHourFilter'); if(hourFilter) hourFilter.innerHTML='<option value="">Tüm Saatler</option>'+hours.map(h=>`<option value="${h}">${h}. Ders</option>`).join('');
  fillDynamicSelects();
}
function fillDynamicSelects(){
  const keepValue=(el,value)=>{ if(el && [...el.options].some(o=>o.value===value)) el.value=value; };
  const teachers=sortedTeachers();
  const tOpts='<option value="">Tüm Öğretmenler</option>'+teachers.map(t=>`<option value="${t.id}">${escapeHtml(teacherName(t))}</option>`).join('');
  const tf=getEl('scheduleTeacherFilter'), tfValue=tf?.value||''; if(tf){ tf.innerHTML=tOpts; keepValue(tf,tfValue); }
  const teacherOpts=teachers.map(t=>`<option value="${t.id}">${escapeHtml(teacherName(t))}</option>`).join('');
  const tp=getEl('teacherProfileSelect'), tpValue=tp?.value||selectedTeacherId||''; if(tp){ tp.innerHTML='<option value="">Öğretmen seçiniz</option>'+teacherOpts; keepValue(tp,tpValue||teachers[0]?.id||''); }
  const st=getEl('sTeacher'), stValue=st?.value||''; if(st){ st.innerHTML=teacherOpts; keepValue(st,stValue); }
  const tt=getEl('taskTeacher'), ttValue=tt?.value||''; if(tt){ tt.innerHTML=teacherOpts; keepValue(tt,ttValue); }
  const trt=getEl('taskReportTeacher'), trtValue=trt?.value||''; if(trt){ trt.innerHTML=tOpts; keepValue(trt,trtValue); }
  const taskKinds=['Kulüp','Kurul','Komisyon','Zümre Başkanlığı','Belirli Gün ve Haftalar','Diğer',...(DB.tasks||[]).map(t=>t.kind||'Genel')];
  const taskKindList=getEl('taskKindOptions'); if(taskKindList) taskKindList.innerHTML=[...new Set(taskKinds.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).map(k=>`<option value="${escapeHtml(k)}"></option>`).join('');
  const grades=[...new Set((DB.settings.classes||CLASS_LIST).map(c=>classGrade(c)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b)||String(a).localeCompare(String(b),'tr'));
  const gf=getEl('scheduleGradeFilter'), gfValue=gf?.value||''; if(gf){ gf.innerHTML='<option value="">Tüm Seviyeler</option>'+grades.map(g=>`<option value="${g}">${g}. Sınıflar</option>`).join(''); keepValue(gf,gfValue); }
  const selectedGrade=getEl('scheduleGradeFilter')?.value||'';
  const scheduleClasses=(DB.settings.classes||CLASS_LIST).filter(c=>!selectedGrade||classGrade(c)===String(selectedGrade));
  const cOpts='<option value="">Tüm Sınıflar</option>'+scheduleClasses.map(c=>`<option value="${c}">${c}</option>`).join('');
  const cf=getEl('scheduleClassFilter'), cfValue=cf?.value||''; if(cf){ cf.innerHTML=cOpts; keepValue(cf,cfValue); }
  const sc=getEl('sClass'), scValue=sc?.value||''; if(sc){ sc.innerHTML=DB.settings.classes.map(c=>`<option value="${c}">${c}</option>`).join(''); keepValue(sc,scValue); }
  const cps=getEl('classProfileSelect'), cpsValue=cps?.value||''; if(cps){ cps.innerHTML=DB.settings.classes.map(c=>`<option value="${c}">${c}</option>`).join(''); keepValue(cps,cpsValue||DB.settings.classes[0]||''); }
}
function sTab(id){
  if(['schedule','duty','tasks'].includes(id)){ window.reportMode=id; id='reports'; }
  if(!getEl(id)) id='dashboard';
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active-pane'));
  getEl(id).classList.add('active-pane');
  document.querySelectorAll('.nav-link[id^="nav-"],.bnav-item').forEach(a=>a.classList.remove('active'));
  if(getEl('nav-'+id)) getEl('nav-'+id).classList.add('active');
  if(getEl('bnav-'+id)) getEl('bnav-'+id).classList.add('active');
  history.replaceState(null,'','#'+id);
  if(id==='teachers') renderTeachers();
  if(id==='classes') renderClasses();
  if(id==='reports') renderReports();
  if(id==='settings') renderSettings();
  return false;
}
function renderAll(){ fillDynamicSelects(); renderDashboard(); renderTeachers(); renderClasses(); renderReports(); renderSettings(); }
function setReportMode(mode='schedule'){
  window.reportMode=mode;
  syncReportPrimaryAction(mode);
  ['schedule','teachers','duty','tasks'].forEach(key=>{
    const pane=getEl('reportPane-'+key), btn=getEl('reportBtn-'+key);
    if(pane) pane.classList.toggle('d-none', key!==mode);
    if(btn){ btn.classList.toggle('btn-primary', key===mode); btn.classList.toggle('btn-outline-secondary', key!==mode); }
  });
  if(mode==='schedule') renderSchedule();
  if(mode==='teachers') renderTeacherReport();
  if(mode==='duty') renderDuty();
  if(mode==='tasks') renderTasks();
}
function syncReportPrimaryAction(mode='schedule'){
  const button=getEl('reportPrimaryAction');
  if(!button) return;
  const actions={
    schedule:{label:'Ders Ekle',icon:'fas fa-plus',handler:'openScheduleModal()'},
    teachers:{label:'Öğretmen Ekle',icon:'fas fa-plus',handler:'openTeacherModal()'},
    tasks:{label:'Görev Ekle',icon:'fas fa-plus',handler:'openTaskModal()'}
  };
  const action=actions[mode];
  button.classList.toggle('d-none',!action);
  if(!action) return;
  button.setAttribute('onclick',action.handler);
  button.innerHTML=`<i class="${action.icon} me-1"></i>${action.label}`;
}
function renderReports(){ setReportMode(window.reportMode||'schedule'); }
function showToast(msg,type='info',timeout=3000){ const c=getEl('toastContainer'), t=document.createElement('div'); t.className='obs-toast obs-toast-'+type; t.innerHTML=`<i class="fas fa-circle-info"></i><span>${escapeHtml(msg)}</span>`; c.appendChild(t); setTimeout(()=>t.remove(),timeout); }
const disclosureState=new Map();
function rememberDisclosure(el){
  if(el?.dataset?.sectionKey) disclosureState.set(el.dataset.sectionKey, !!el.open);
}
function disclosureSection({key,title,icon='fas fa-circle',meta='',content='',open=false}){
  const isOpen=disclosureState.has(key)?disclosureState.get(key):open;
  return `<details class="content-disclosure" data-section-key="${escapeHtml(key)}" ${isOpen?'open':''} ontoggle="rememberDisclosure(this)">
    <summary><span class="disclosure-title"><i class="${icon}"></i><strong>${escapeHtml(title)}</strong></span>${meta?`<span class="disclosure-meta">${escapeHtml(meta)}</span>`:''}</summary>
    <div class="disclosure-body">${content}</div>
  </details>`;
}
function printArea(id,title='Yazdir'){
  const a=getEl(id);
  if(!a){ showToast('Yazdırılacak içerik bulunamadı.','warning'); return; }

  /* ── Görünüm tespiti ── */
  const isSheet       = !!a.querySelector('.schedule-sheet');
  const isEntryList   = !!a.querySelector('.schedule-entry-table');
  const isProgramList = !isSheet && !isEntryList && !!a.querySelector('.class-program-list');
  const isProfile     = !isSheet && !isEntryList && !isProgramList && !!a.querySelector('.profile-card');
  const isDuty        = !isSheet && !isEntryList && !isProgramList && !isProfile && !!a.querySelector('.duty-matrix');
  const isTasks       = !isSheet && !isEntryList && !isProgramList && !isProfile && !isDuty && !!a.querySelector('#tasksContent');
  const isFree        = !isSheet && !isEntryList && !isProgramList && !isProfile && !isDuty && !isTasks && !!a.querySelector('.free-report-block');

  const bodyClass = isSheet        ? 'sheet-print'
                  : isEntryList    ? 'entry-print'
                  : isProgramList  ? 'program-list-print'
                  : isProfile      ? 'profile-print'
                  : isDuty         ? 'duty-print'
                  : isTasks        ? 'tasks-print'
                  : isFree         ? 'free-print'
                  : '';

  /* ── Sayfa yönü: yalnızca çarşaf görünümleri yatay ── */
  const pageSize = isSheet ? 'A4 landscape' : 'A4 portrait';

  /* ── Çarşaf: dinamik hücre genişliği ── */
  const sheetTable = a.querySelector('.schedule-sheet');
  const cellCount  = sheetTable ? Number(sheetTable.dataset.cellCount||0) : 0;
  const isTeacherSheet = !!a.querySelector('.teacher-sheet');
  const nameColW   = isTeacherSheet ? '28mm' : '15mm';
  const cellW      = cellCount > 0
    ? `calc((100% - ${nameColW}) / ${cellCount})`
    : `calc((100% - ${nameColW}) / 40)`;

  /* ── Yazdırma başlığı: ne yazdırıldığı + filtre bilgisi ── */
  const printDate = new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});

  function printHeaderHtml(){
    // Öğretmen profili — DB'den doğrudan al (card-header yok)
    if(isProfile && typeof selectedTeacherId !== 'undefined' && !a.querySelector('.card-header')){
      const t = typeof teacherById === 'function' ? teacherById(selectedTeacherId) : null;
      const name   = t ? (typeof teacherName === 'function' ? teacherName(t) : '') : 'Öğretmen Profili';
      const branch = t ? (t.branch||'') : '';
      return `<div class="ph-wrap"><div class="ph-title"><strong>${escapeHtml(name)}</strong>${branch?`<span>${escapeHtml(branch)}</span>`:''}</div><span class="ph-date">${printDate}</span></div>`;
    }
    // Sınıf profili — card-header'dan al (zaten var)
    if(isProfile){
      const h = a.querySelector('.card-header .card-title');
      const title = h ? h.textContent.trim().replace(/^.\s*/,'') : 'Sınıf Profili';
      return `<div class="ph-wrap"><div class="ph-title"><strong>${escapeHtml(title)}</strong></div><span class="ph-date">${printDate}</span></div>`;
    }
    // Program görünümleri — başlık + aktif filtreler
    if(isSheet || isProgramList || isEntryList || isFree){
      const titleEl = a.querySelector('.card-title');
      const title   = titleEl ? titleEl.textContent.trim().replace(/^.\s*/,'') : 'Ders Programı';
      // scheduleFilterDescriptors global fonksiyonu varsa filtre özetini al
      let filterText = '';
      if(typeof scheduleFilterDescriptors === 'function' && typeof scheduleFilters === 'function'){
        const f = scheduleFilters();
        const parts = scheduleFilterDescriptors(f).filter(d=>d.value);
        filterText = parts.map(d=>`${d.label}: ${d.value}`).join(' · ');
      }
      return `<div class="ph-wrap"><div class="ph-title"><strong>${escapeHtml(title)}</strong>${filterText?`<span>${escapeHtml(filterText)}</span>`:''}</div><span class="ph-date">${printDate}</span></div>`;
    }
    // Diğerleri (nöbet, görev listesi, öğretmen listesi) — card-title'dan al
    const titleEl = a.querySelector('.card-title');
    const title   = titleEl ? titleEl.textContent.trim().replace(/^.\s*/,'') : '';
    return `<div class="ph-wrap"><div class="ph-title"><strong>${escapeHtml(title)}</strong></div><span class="ph-date">${printDate}</span></div>`;
  }

  const metaHtml = printHeaderHtml();

  const printStyle = `
/* ── CSS değişkenleri (iframe'de teacher-style.css yüklü değil) ── */
:root {
  --c-ink:       #111827;
  --c-ink-2:     #374151;
  --c-muted:     #6b7280;
  --c-blue:      #1a56db;
  --c-orange:    #f59e0b;
  --c-green:     #057a55;
  --c-red:       #e02424;
  --c-bg:        #f9fafb;
  --c-surface:   #ffffff;
  --c-border:    #e5e7eb;
  --border-ink:       2px solid #111827;
  --border-ink-thick: 2.5px solid #111827;
  --border-light:     1px solid #e5e7eb;
  --border-dashed:    1.5px dashed #9ca3af;
  --r:   4px;
  --r-sm: 2px;
}
@page { size:${pageSize}; margin:10mm; }
*  { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:10pt; color:#0f172a; }
a  { color:#0f172a; text-decoration:none; }

/* ── Ortak bileşenler ── */
.card        { border:0; break-inside:avoid; }
.card-header { padding:3px 0; }
.card-body   { padding:0; }
.card-title  { margin:0; font-size:11pt; }
.table { width:100%; border-collapse:collapse; }
.table th,.table td { border:1px solid #cbd5e1!important; padding:3px 5px!important; vertical-align:middle; }
.table th { background:#f1f5f9!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.no-print,.page-actions,.schedule-health,.obs-toast { display:none!important; }
button:not(.print-keep) { display:none!important; }
.slot-span-note { display:none!important; }
.print-meta { font-size:7.5pt; color:#64748b; text-align:right; margin-bottom:3mm; }

/* ── Yazdırma başlık bandı ── */
.ph-wrap {
  display:flex; justify-content:space-between; align-items:baseline;
  border-bottom:2pt solid #111827; margin-bottom:5mm; padding-bottom:2mm;
}
.ph-title strong { font-size:13pt; font-weight:800; display:block; }
.ph-title span   { font-size:8.5pt; color:#475569; display:block; margin-top:1mm; }
.ph-date         { font-size:8pt; color:#64748b; white-space:nowrap; }

/* ── Disclosure (tüm modlar) ── */
.content-disclosure { display:block!important; border-top:1px solid #dbe3ef; }
.content-disclosure:first-child { border-top:0; }
.content-disclosure > summary { display:none!important; }
.content-disclosure > .disclosure-body,
.content-disclosure:not([open]) > .disclosure-body { display:block!important; padding:3mm 0; }

/* ── Program kartı ortak ── */
.lesson-hour-label  { display:block; font-weight:700; white-space:nowrap; }
.lesson-time-sub    { display:block; font-size:6.5pt; line-height:1.05; color:#334155; font-weight:600; }
.lesson-board-hour  { display:block; font-weight:700; }
.prog-slot strong,.prog-slot span,.prog-slot small { display:block; line-height:1.1; }
.class-program-board,.teacher-program-board { table-layout:fixed; font-size:7.5pt; width:100%; }
.class-program-board th,.class-program-board td,
.teacher-program-board th,.teacher-program-board td { text-align:center; vertical-align:middle; padding:2px 3px!important; word-break:break-word; }
.class-program-board th:first-child,.teacher-program-board th:first-child { text-align:left; width:19mm; }
.class-board-slot strong,.class-board-slot span,.class-board-slot small,
.teacher-board-slot strong,.teacher-board-slot span,.teacher-board-slot small { display:block; line-height:1.05; }
.class-board-slot strong,.teacher-board-slot strong { font-size:7.5pt; }
.class-board-slot span,.teacher-board-slot span   { font-size:6.5pt; font-weight:700; }
.class-board-slot small,.teacher-board-slot small  { font-size:6pt; color:#475569; }
.teacher-weekly-scroll { overflow:visible!important; }
.prog-table { width:100%; border-collapse:collapse; }
.row { display:flex; flex-wrap:wrap; gap:6px; }
.col-6,.col-lg-3,.col-lg-5,.col-lg-6,.col-lg-7 { flex:1 1 0; }

/* ── Günlük program ── */
.daily-program-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; }
.daily-lesson-card  { border:1px solid #cbd5e1; padding:2mm; min-height:18mm; break-inside:avoid; }
.daily-lesson-card.has-lesson { border-left:2pt solid #2563eb; }
.daily-slot strong,.daily-slot span,.daily-slot small { display:block; line-height:1.1; }
.daily-slot strong { font-size:8.5pt; }
.daily-slot span   { font-size:7.5pt; font-weight:700; }
.daily-slot small  { font-size:6.5pt; color:#475569; }

/* ════════════════════════════════════════
   ÇARŞAF (sheet-print) — yatay A4
   ════════════════════════════════════════ */
.sheet-print { font-size:5pt; }
.sheet-print .card-header { padding:0 0 1.5mm; }
.sheet-print .card-title  { font-size:7.4pt; margin:0; }
.sheet-print .card-title i,.sheet-print .card-header .text-muted { display:none; }
.sheet-print .table-responsive { overflow:visible!important; }
.sheet-print .schedule-sheet {
  width:100%; table-layout:fixed; border-collapse:collapse; line-height:.92;
}
.sheet-print .schedule-sheet th,
.sheet-print .schedule-sheet td {
  padding:.35mm .4mm!important; line-height:.92; height:auto;
  white-space:normal; overflow:hidden; text-align:center; break-inside:avoid;
}
.sheet-print .schedule-sheet thead { display:table-header-group; }
.sheet-print .schedule-sheet thead br,
.sheet-print .teacher-sheet br { display:none; }
.sheet-print .schedule-sheet small { font-size:4.25pt; display:inline; color:#111; margin-left:1px; }
.sheet-print .teacher-sheet { font-size:4.35pt; }
.sheet-print .class-sheet   { font-size:4.8pt; }
.sheet-print .class-sheet tbody br    { display:block; }
.sheet-print .class-sheet tbody small { display:block; margin-left:0; font-size:4.45pt; }
.sheet-print .teacher-sheet .sheet-name {
  width:${nameColW}!important; min-width:${nameColW}!important; max-width:${nameColW}!important;
  text-align:left;
}
.sheet-print .class-sheet .sheet-name {
  width:${nameColW}!important; min-width:${nameColW}!important; max-width:${nameColW}!important;
  text-align:center;
}
.sheet-print .teacher-sheet td,
.sheet-print .teacher-sheet thead tr:nth-child(2) th { width:${cellW}; }
.sheet-print .class-sheet td,
.sheet-print .class-sheet thead tr:nth-child(2) th   { width:${cellW}; }
.sheet-print .sheet-filled,.sheet-print .sheet-empty { min-width:0!important; }
.sheet-print .duty-sheet { box-shadow:inset 0 0 0 .6pt #d97706; }

/* ════════════════════════════════════════
   KAYIT LİSTESİ (entry-print)
   ════════════════════════════════════════ */
.entry-print .schedule-sheet,
.entry-print .class-program-list { display:none!important; }
.entry-print .schedule-entry-list { display:block!important; border-top:0; padding-top:0; }
.entry-print .section-title-row   { display:flex; align-items:center; justify-content:space-between; margin-bottom:6mm; }
.entry-print h4 { margin:0; font-size:12pt; }

/* ════════════════════════════════════════
   PROGRAM LİSTESİ (program-list-print)
   ════════════════════════════════════════ */
.program-list-print .class-program-list { display:flex; flex-direction:column; gap:0; }
.program-list-print .content-disclosure {
  break-inside:avoid; page-break-inside:avoid; border-top:1px solid #dbe3ef;
}
.program-list-print .content-disclosure:first-child { border-top:0; }
.program-list-print .teacher-program-board,
.program-list-print .class-program-board { font-size:7.5pt; width:100%; }
.program-list-print .table-responsive   { overflow:visible!important; }
.program-list-print .disclosure-meta    { font-size:7pt; color:#475569; }

/* ════════════════════════════════════════
   PROFİL (profile-print) — dikey A4
   ════════════════════════════════════════ */
.profile-print { font-size:9pt; }
.profile-print .profile-card    { border:0; }
.profile-print .profile-header  { margin-bottom:3mm; }
.profile-print .profile-disclosures { padding:0 2mm!important; }
.profile-print .info-line       { margin-bottom:2mm; }
.profile-print .info-line span  { font-size:7.5pt; color:#64748b; display:block; }
.profile-print .info-line strong { font-size:9pt; display:block; }
.profile-print .teacher-weekly-scroll { overflow:visible!important; }
.profile-print .prog-table { width:100%; font-size:7pt; table-layout:fixed; }
.profile-print .section-body-actions { display:none!important; }
.profile-print .btn-tc-reveal   { display:none!important; }
.profile-print .tc-field::before { content:attr(data-tc); font-size:9pt; font-weight:700; display:block; }
.profile-print .tc-display      { display:none!important; }
.profile-print .free-slot-grid  { display:flex; flex-wrap:wrap; gap:2mm; }
.profile-print .soft-chip       { display:inline-block; border:1px solid #cbd5e1; border-radius:3px; padding:0 2mm; font-size:8pt; }
.profile-print .duty-profile-box { display:flex; gap:6mm; border:1px solid #cbd5e1; padding:2mm 4mm; border-radius:4px; }
.profile-print .duty-profile-box span  { display:block; font-size:7.5pt; color:#64748b; }
.profile-print .duty-profile-box strong { display:block; font-size:9pt; }

/* ════════════════════════════════════════
   NÖBET ÇİZELGESİ (duty-print) — dikey A4
   ════════════════════════════════════════ */
.duty-print { font-size:9pt; }
.duty-print .duty-matrix { width:100%; border-collapse:collapse; }
.duty-print .duty-matrix th,
.duty-print .duty-matrix td {
  border:1pt solid #334155!important; padding:2.5mm 3mm!important; vertical-align:middle;
}
.duty-print .duty-matrix thead th { background:#f1f5f9!important; font-size:9pt; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.duty-print .duty-place-head { text-align:left!important; font-weight:700; white-space:nowrap; }
.duty-print .duty-filled-cell { background:#eff6ff!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.duty-print .duty-empty-cell  { color:#94a3b8; text-align:center; }
.duty-print .duty-cell strong { display:block; font-size:9pt; }
.duty-print .duty-cell span   { display:block; font-size:7.5pt; color:#475569; }

/* ════════════════════════════════════════
   GÖREV LİSTESİ (tasks-print) — dikey A4
   ════════════════════════════════════════ */
.tasks-print { font-size:9pt; }
.tasks-print .chip-wrap,.tasks-print .obs-panel:first-child { display:none!important; }
.tasks-print .table th,.tasks-print .table td { font-size:8pt; padding:2px 4px!important; }
.tasks-print .table-actions { display:none!important; }

/* ════════════════════════════════════════
   BOŞ SAAT RAPORU (free-print) — dikey A4
   ════════════════════════════════════════ */
.free-print .free-report-block  { break-inside:avoid; margin-bottom:6mm; }
.free-print .free-query-grid    { display:flex; flex-wrap:wrap; gap:3mm; }
.free-print .free-day-card      { border:1pt solid #cbd5e1; padding:2mm; min-width:38mm; font-size:8pt; break-inside:avoid; }
.free-print .free-report-note   { font-size:8pt; color:#475569; margin-bottom:3mm; }
.free-print .free-day-overview  { display:flex; flex-wrap:wrap; gap:3mm; }
.free-print .free-slot-grid     { display:flex; flex-wrap:wrap; gap:2mm; }
.free-print .soft-chip          { display:inline-block; border:1px solid #cbd5e1; border-radius:3px; padding:0 2mm; font-size:8pt; margin:1px; }
.free-print .section-title-row h4 { font-size:10pt; margin:0 0 2mm; }
`;

  /* ── iframe ile yazdır ── */
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    win.focus();
    setTimeout(() => {
      win.print();
      setTimeout(() => iframe.remove(), 1200);
    }, 250);
  };

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${printStyle}</style></head><body class="${bodyClass}">${metaHtml}${a.outerHTML}</body></html>`);
  doc.close();
}
function dashboardCard(label,value,icon,tone,sub=''){ return `<div class="metric-card metric-${tone}"><span class="metric-icon"><i class="${icon}"></i></span><div><div class="metric-label">${label}</div><div class="metric-value">${value}</div>${sub?`<div class="metric-sub">${sub}</div>`:''}</div></div>`; }
function emptyState(text){ return `<div class="empty-state"><i class="fas fa-circle-info"></i><span>${escapeHtml(text)}</span></div>`; }
