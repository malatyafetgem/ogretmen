function hydrateStaticSelects(){
  const days=schoolDays(), hours=schoolHours();
  const dayBlank='<option value="">Seçiniz</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
  ['tFreeDay','tDutyDay','sDay'].forEach(id=>{ const el=getEl(id); if(el) el.innerHTML=dayBlank; });
  const dayFilter=getEl('scheduleDayFilter'); if(dayFilter) dayFilter.innerHTML='<option value="">Tüm Günler</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
  const teacherDay=getEl('teacherProfileDay'), teacherDayValue=teacherDay?.value||todayName()||days[0]; if(teacherDay) teacherDay.innerHTML=days.map(d=>`<option value="${d}" ${d===teacherDayValue?'selected':''}>${d}</option>`).join('');
  const classDay=getEl('classProfileDay');
  if(classDay){
    const current=classDay.value||'weekly';
    classDay.innerHTML='<option value="weekly">Haftalık</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
    classDay.value=[...classDay.options].some(o=>o.value===current)?current:'weekly';
  }
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
  if(id==='settings' && typeof isAdminUser==='function' && !isAdminUser()){
    showToast('Ayarlar sayfası yalnızca admin hesabıyla açılabilir.','warning');
    id='dashboard';
  }
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
function renderAll(){
  fillDynamicSelects();
  renderDashboard();
  renderTeachers();
  renderClasses();
  renderReports();
  if(typeof isAdminUser==='function' && !isAdminUser()){
    const settings=getEl('settingsContent');
    if(settings) settings.innerHTML='';
  } else {
    renderSettings();
  }
}
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
function dashboardCard(label,value,icon,tone,sub=''){ return `<div class="metric-card metric-${tone}"><span class="metric-icon"><i class="${icon}"></i></span><div><div class="metric-label">${label}</div><div class="metric-value">${value}</div>${sub?`<div class="metric-sub">${sub}</div>`:''}</div></div>`; }
function emptyState(text){ return `<div class="empty-state"><i class="fas fa-circle-info"></i><span>${escapeHtml(text)}</span></div>`; }
