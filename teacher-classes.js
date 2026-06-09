let selectedClassName='';

function classLink(className,label=''){
  const cls=cleanClassName(className);
  return `<a href="#classes" class="teacher-name-link" onclick="return goClassProfile('${escapeInlineJsString(cls)}')">${escapeHtml(label||cls)}</a>`;
}

function goClassProfile(className){
  const cls=cleanClassName(className);
  if(!cls) return false;
  selectedClassName=cls;
  const select=getEl('classProfileSelect');
  if(select) select.value=cls;
  sTab('classes');
  renderClasses();
  return false;
}

// Sınıf program seçili günü (buton bazlı, öğretmen profiliyle aynı mantık)
let selectedClassProgramDay='';

function renderClasses(){
  fillDynamicSelects();
  const select=getEl('classProfileSelect');
  if(!select) return;
  const classes=DB.settings.classes||CLASS_LIST;
  const cls=cleanClassName(select.value||selectedClassName||classes[0]||'');
  if(cls&&select.value!==cls&&[...select.options].some(o=>o.value===cls)) select.value=cls;
  selectedClassName=cls;
  const items=classScheduleItems(cls);
  const advisor=DB.teachers.find(t=>cleanClassName(t.classAdvisor)===cls);
  const advisorHtml=advisor?` <span style="font-weight:normal;font-size:0.7em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">(${escapeHtml(teacherName(advisor))})</span>`:'';
  getEl('classProfileContent').innerHTML=cls?`<div class="card obs-panel profile-card"><div class="card-header profile-header"><div><h3 class="card-title"><i class="fas fa-users me-2"></i>${escapeHtml(cls)}${advisorHtml}</h3></div></div><div class="card-body profile-disclosures">
    ${disclosureSection({key:`class-${cls}-program`,title:'Program',icon:'fas fa-calendar-days',meta:'Sınıf Programı',content:buildClassProgramContent(cls),open:false})}
    ${disclosureSection({key:`class-${cls}-subjects`,title:'Ders Dağılımı',icon:'fas fa-book-open',meta:`${classSubjectSummary(cls).length} ders`,content:buildClassSubjectTable(cls)})}
  </div></div>`:emptyState('Sınıf seçiniz.');
}

function buildClassProgramContent(cls){
  const days=schoolDays();
  const today=todayName();
  // Bugün ders günüyse o günü, değilse haftalık başlat
  const useDay=today&&days.includes(today);
  const activeDay=useDay?today:'';
  const dayBtns=days.map(d=>`<button class="prog-mode-btn${activeDay===d?' prog-mode-active':''}" data-class-day="${escapeHtml(d)}" onclick="selectClassDay('${escapeInlineJsString(d)}')">${escapeHtml(d)}</button>`).join('');
  const weeklyActive=!useDay?' prog-mode-active':'';
  const btns=`<div class="program-mode-btns" id="classProgramModeBtns">${dayBtns}<button class="prog-mode-btn${weeklyActive}" data-class-day="weekly" onclick="setClassProgramMode('weekly')">Haftalık</button></div>`;
  let initialContent='';
  if(useDay){
    selectedClassProgramDay=activeDay;
    initialContent=`<div class="program-section-content">${buildClassDailySchedule(cls,activeDay)}</div>`;
  } else {
    selectedClassProgramDay='';
    initialContent=`<div class="program-section-content">${buildClassWeeklySchedule(cls)}</div>`;
  }
  return `<div class="program-filter-inline">${btns}</div><div id="classProgramSection" class="teacher-program-section">${initialContent}</div>`;
}

function setClassProgramMode(mode){
  selectedClassProgramDay=mode==='weekly'?'':selectedClassProgramDay;
  document.querySelectorAll('[data-class-day]').forEach(btn=>btn.classList.toggle('prog-mode-active',btn.dataset.classDay===mode));
  const section=getEl('classProgramSection'); if(!section) return;
  if(mode==='weekly'){
    selectedClassProgramDay='';
    section.innerHTML=`<div class="program-section-content">${buildClassWeeklySchedule(selectedClassName)}</div>`;
  }
}

function selectClassDay(day){
  selectedClassProgramDay=day;
  document.querySelectorAll('[data-class-day]').forEach(btn=>btn.classList.toggle('prog-mode-active',btn.dataset.classDay===day));
  const section=getEl('classProgramSection'); if(!section) return;
  section.innerHTML=`<div class="program-section-content">${buildClassDailySchedule(selectedClassName,day)}</div>`;
}

function classScheduleItems(className){
  return DB.schedules.filter(s=>s.className===className).sort((a,b)=>dayOrder(a.day)-dayOrder(b.day)||hourOrder(a.hour)-hourOrder(b.hour)||String(a.subject).localeCompare(String(b.subject),'tr'));
}

function buildClassDailySchedule(className, day){
  const cards=schoolHours().map(hour=>{
    const slots=DB.schedules.filter(s=>s.className===className&&s.day===day&&Number(s.hour)===hour);
    return `<div class="daily-lesson-card${slots.length?' has-lesson':''}"><div class="daily-lesson-hour">${lessonHourCell(hour)}</div>${slots.length?classDailySlotHtml(slots):'<span class="text-muted">—</span>'}</div>`;
  }).join('');
  return `<div class="daily-program-grid">${cards}</div>`;
}

function buildClassWeeklySchedule(className){
  const days=schoolDays(), hours=schoolHours();
  const hourHeads=hours.map(hour=>`<th class="prog-th-hour">${lessonBoardHeader(hour)}</th>`).join('');
  const timeHeads=hours.map(hour=>{ const t=lessonTimeByHour(hour); return `<th class="prog-th-time">${t?.start&&t?.end?`${escapeHtml(t.start)}<br><span>${escapeHtml(t.end)}</span>`:''}</th>`; }).join('');
  const rows=days.map(day=>`<tr><th class="prog-th-day">${escapeHtml(day)}</th>${classProgramRowCells(className,day,hours)}</tr>`).join('');
  return `<div class="teacher-weekly-scroll"><table class="prog-table mb-0"><thead><tr><th class="prog-th-day"></th>${hourHeads}</tr><tr><th class="prog-th-day prog-th-sub">Saat</th>${timeHeads}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function classProgramRowCells(className, day, hours, teacherId=''){
  const cells=[];
  for(let i=0;i<hours.length;i++){
    const hour=hours[i];
    const slots=DB.schedules.filter(s=>s.className===className&&s.day===day&&Number(s.hour)===Number(hour)&&(!teacherId||s.teacherId===teacherId));
    const span=slots.length ? classProgramSlotSpan(className,day,i,hours,slots,teacherId) : 1;
    cells.push(`<td colspan="${span}" class="${slots.length?'prog-td-filled':'prog-td-empty'}">${slots.length?classBoardSlotHtml(slots):''}</td>`);
    i+=span-1;
  }
  return cells.join('');
}

function classProgramSlotSpan(className, day, hourIndex, hours, slots, teacherId=''){
  const signature=scheduleSlotSignature(slots);
  if(!signature) return 1;
  let span=1;
  for(let i=hourIndex+1;i<hours.length;i++){
    if(hours[i]!==hours[i-1]+1) break;
    const next=DB.schedules.filter(s=>s.className===className&&s.day===day&&Number(s.hour)===Number(hours[i])&&(!teacherId||s.teacherId===teacherId));
    if(scheduleSlotSignature(next)!==signature) break;
    span++;
  }
  return span;
}

function classSlotHtml(s){
  const t=teacherById(s.teacherId);
  const note=scheduleNoteText(s);
  return `<div class="class-slot"><strong>${escapeHtml(displaySubjectName(s.subject))}</strong><span>${teacherLink(t)}</span>${note?`<small>${escapeHtml(note)}</small>`:''}</div>`;
}

function classBoardSlotHtml(slots){
  const rawSubject=[...new Set(slots.map(s=>displaySubjectName(s.subject)))].join('/');
  const subject=rawSubject.length>12 ? [...new Set(slots.map(s=>subjectCode(s.subject)))].join('/') : rawSubject;
  const teachers=[...new Set(slots.map(s=>compactTeacherCode(teacherById(s.teacherId))))].join('/');
  const notes=[...new Set(slots.map(scheduleNoteText).filter(Boolean))].join('/');
  return `<div class="prog-slot"><strong>${escapeHtml(subject)}</strong><span>${escapeHtml(teachers)}</span>${notes?`<small>${escapeHtml(notes)}</small>`:''}</div>`;
}

function classDailySlotHtml(slots){
  const subjects=[...new Set(slots.map(s=>displaySubjectName(s.subject)))].join(' / ');
  const teachers=[...new Set(slots.map(s=>teacherName(teacherById(s.teacherId))))].join(' / ');
  const notes=[...new Set(slots.map(scheduleNoteText).filter(Boolean))].join(' / ');
  return `<div class="daily-slot class-daily-slot"><strong class="slot-subject">${escapeHtml(subjects)}</strong><span class="slot-teacher">${escapeHtml(teachers)}</span>${notes?`<small>${escapeHtml(notes)}</small>`:''}</div>`;
}

function classSubjectSummary(className){
  const map=new Map();
  mergeSameHourLessons(classScheduleItems(className),'class').forEach(s=>{
    const subjectLabel=[...new Set((s.subjects||[s.subject]).map(displaySubjectName))].join(' / ');
    const key=plainKey(subjectLabel), item=map.get(key)||{subject:subjectLabel,code:subjectCode(subjectLabel),hours:0,teachers:new Map()};
    item.hours++;
    (s.records||[s]).forEach(record=>{
      const t=teacherById(record.teacherId);
      if(t) item.teachers.set(t.id,t);
    });
    map.set(key,item);
  });
  return [...map.values()].sort((a,b)=>a.subject.localeCompare(b.subject,'tr'));
}

function buildClassSubjectTable(className){
  const rows=classSubjectSummary(className).map(item=>`<tr><td><strong>${escapeHtml(item.subject)}</strong></td><td>${[...item.teachers.values()].map(t=>teacherLink(t)).join(', ')||'—'}</td><td>${item.hours}</td></tr>`).join('');
  return `${rows?`<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Ders</th><th>Öğretmen</th><th>Saat</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('Bu sınıf için ders kaydı yok.')}`;
}

function openClassInReports(className){
  sTab('reports');
  setReportMode('schedule');
  const view=getEl('scheduleViewMode'), teacher=getEl('scheduleTeacherFilter'), cls=getEl('scheduleClassFilter'), grade=getEl('scheduleGradeFilter'), day=getEl('scheduleDayFilter'), hour=getEl('scheduleHourFilter');
  if(view) view.value='classList';
  if(teacher) teacher.value='';
  if(cls) cls.value=cleanClassName(className);
  if(grade) grade.value='';
  if(day) day.value='';
  if(hour) hour.value='';
  renderSchedule();
}
