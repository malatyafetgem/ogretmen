/* ============================================================
   teacher-print.js  —  Öğretmen Bilgi Sistemi Yazdırma Motoru
   Merkezi printDocument() + printSchedule() motoru.
   Merkezi yazdırma motoru. teacher-ui.js içinde artık yazdırma kodu yoktur.
   ============================================================ */

/* ──────────────────────────────────────────────────────────────
   1. SEÇENEK NORMALİZASYON
   ────────────────────────────────────────────────────────────── */

/**
 * Kullanıcıdan gelen options nesnesini güvenli ve tam hale getirir.
 * @param {Object} options
 * @returns {Object}
 */
function normalizePrintOptions(options) {
  if (!options || typeof options !== 'object') options = {};
  return {
    sourceId:    options.sourceId    || '',
    type:        options.type        || '',
    title:       options.title       || 'Yazdır',
    orientation: options.orientation || 'auto',   // 'auto' | 'portrait' | 'landscape'
    button:      options.button      || null,
    html:        options.html        || null,      // doğrudan HTML (opsiyonel, V1'de kullanılmaz)
  };
}

/* ──────────────────────────────────────────────────────────────
   2. BODY CLASS ve SAYFA YÖNÜ
   ────────────────────────────────────────────────────────────── */

/**
 * Yazdırma tipine göre body class döndürür.
 * Tür bilinmiyorsa DOM'daki class tespiti için boş string döner.
 * @param {string} type
 * @returns {string}
 */
function resolveBodyClass(type) {
  const map = {
    'teacher-sheet':   'sheet-print',
    'class-sheet':     'sheet-print',
    'teacher-profile': 'profile-print',
    'class-profile':   'profile-print',
    'teachers':        'teacher-list-print',
    'duty':            'duty-print',
    'tasks':           'tasks-print',
    'entry-list':      'entry-print',
    'program-list':    'program-list-print',
    'free':            'free-print',
    'schedule':        '',                   // printSchedule kendi belirler
  };
  return map[type] || '';
}

/**
 * Sayfa yönünü belirler.
 * orientation='auto' ise DOM'u inceleyerek karar verir.
 * @param {string} type
 * @param {string} requested  - 'auto' | 'portrait' | 'landscape'
 * @param {Element|null} root
 * @param {string} sourceId
 * @returns {'A4 portrait'|'A4 landscape'}
 */
function resolvePrintOrientation(type, requested, root, sourceId) {
  if (requested === 'portrait')  return 'A4 portrait';
  if (requested === 'landscape') return 'A4 landscape';

  // type ile kesin karar
  if (type === 'teacher-profile') {
    const mode = (typeof currentProgramMode !== 'undefined') ? currentProgramMode : '';
    if (mode !== 'day') return 'A4 landscape';
  }
  if ([
    'teacher-sheet',
    'class-sheet',
    'program-list',
    'entry-list',
    'teachers',
    'duty',
    'tasks',
    'class-profile'
  ].includes(type)) return 'A4 landscape';

  // DOM'da .schedule-sheet varsa çarşaf → landscape
  if (root && root.querySelector('.schedule-sheet')) return 'A4 landscape';
  if (root && shouldUseLandscapeForPrint(root)) return 'A4 landscape';

  return 'A4 portrait';
}

/**
 * DOM geniş tablo/program içeriyorsa otomatik landscape seçer.
 * @param {Element} root
 * @returns {boolean}
 */
function shouldUseLandscapeForPrint(root) {
  if (!root) return false;
  if (root.querySelector('.prog-table, .teacher-program-board, .class-program-board, .duty-matrix')) return true;
  const tables = Array.from(root.querySelectorAll('table'));
  return tables.some(table => {
    const headRow = table.querySelector('thead tr:last-child') || table.querySelector('tr');
    if (!headRow) return false;
    const cells = Array.from(headRow.children);
    const count = cells.reduce((sum, cell) => sum + Number(cell.getAttribute('colspan') || 1), 0);
    return count >= 5;
  });
}

/* ──────────────────────────────────────────────────────────────
   3. DOM HAZIRLIK FONKSİYONLARI
   ────────────────────────────────────────────────────────────── */

/**
 * Yazdırmada gizlenmesi gereken elemanları işaretler.
 * remove() KULLANILMAZ; CSS gizleme tercih edilir.
 * @param {Element} root
 */
function markHiddenForPrint(root) {
  // Şu an CSS .no-print ile zaten gizleniyor; bu fonksiyon
  // gerekirse ek print-hidden class eklemek için hazır bırakılmıştır.
  if (!root) return;
  root.querySelectorAll('.schedule-health, .obs-toast, .page-actions').forEach(el => {
    el.classList.add('print-hidden');
  });
}

/**
 * overflow:hidden olan scroll alanlarını yazdırma öncesi açar.
 * Mevcut scroll değeri saklanmaz; iframe kopyasında önemli değil.
 * @param {Element} root
 */
function expandScrollableAreas(root) {
  if (!root) return;
  root.querySelectorAll('.table-responsive, .teacher-weekly-scroll, .sheet-scroll').forEach(el => {
    el.style.overflow = 'visible';
    el.style.maxHeight = 'none';
  });
}

/**
 * Kapalı <details> / disclosure bölümlerini yazdırma için açar.
 * @param {Element} root
 */
function openDisclosureForPrint(root) {
  if (!root) return;
  root.querySelectorAll('details.content-disclosure').forEach(el => {
    el.setAttribute('open', '');
  });
}

function isEmptyProfilePrintValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return true;
  return text === '—' || text === '-' || /^kayıt yok$/i.test(text);
}

function prepareProfileInfoCardsForPrint(root) {
  if (!root) return;
  const firstInfo = root.querySelector('.profile-info');
  const infoRow = firstInfo ? firstInfo.closest('.row') : null;
  if (infoRow) infoRow.classList.add('profile-info-grid-print');

  root.querySelectorAll('.profile-info').forEach(info => {
    const valueEl = info.querySelector('strong');
    const rawValue = valueEl?.classList.contains('tc-field')
      ? (valueEl.getAttribute('data-tc') || valueEl.textContent)
      : valueEl?.textContent;
    if (isEmptyProfilePrintValue(rawValue)) {
      const wrapper = info.closest('[class*="col-"]') || info;
      wrapper.classList.add('print-hidden');
    }
  });
}

function hideTeacherDutySectionForPrint(root) {
  if (!root) return;
  root.querySelectorAll('details.content-disclosure[data-section-key*="-duty"]').forEach(el => {
    el.classList.add('print-hidden');
  });
}

/**
 * Profil çıktılarında program bölümünü niyete göre hazırlar.
 * Öğretmen/sınıf için gün açıkça seçilmediyse haftalık program basılır.
 * @param {Element} root
 * @param {Object} opts
 */
function prepareProfileProgramForPrint(root, opts) {
  if (!root || !opts) return;
  try {
    if (opts.type === 'teacher-profile') {
      const section = root.querySelector('#teacherProgramSection');
      const id = (typeof selectedTeacherId !== 'undefined') ? selectedTeacherId : '';
      const t = id && typeof teacherById === 'function' ? teacherById(id) : null;
      const mode = (typeof currentProgramMode !== 'undefined') ? currentProgramMode : '';
      if (section && t && mode !== 'day' && typeof buildTeacherProfileSchedule === 'function' && typeof teacherLessons === 'function') {
        section.innerHTML = `<div class="program-section-content">${buildTeacherProfileSchedule(t, teacherLessons(id))}</div>`;
        const meta = section.closest('details')?.querySelector('.disclosure-meta');
        if (meta) meta.textContent = 'Haftalık Program';
      }
      root.querySelectorAll('.program-filter-inline, .program-mode-btns').forEach(el => el.classList.add('print-hidden'));
      prepareProfileInfoCardsForPrint(root);
      hideTeacherDutySectionForPrint(root);
      return;
    }

    if (opts.type === 'class-profile') {
      const daily = root.querySelector('details.content-disclosure[data-section-key*="-daily-"]');
      const weekly = root.querySelector('details.content-disclosure[data-section-key*="-weekly"]');
      if (weekly) weekly.setAttribute('open', '');
      if (daily) daily.classList.add('print-hidden');
    }
  } catch (e) {
    console.warn('[teacher-print] profil program hazırlığı atlandı:', e);
  }
}

function normalizePrintHeadingText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (typeof plainKey === 'function') return plainKey(value);
  return value.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Üst yazdırma başlığı ile aynı olan iç kart başlıklarını gizler.
 * @param {Element} root
 * @param {{ title:string }} meta
 */
function dedupePrintHeadings(root, meta) {
  if (!root || !meta || !meta.title) return;
  const printTitleKey = normalizePrintHeadingText(meta.title);
  if (!printTitleKey) return;
  root.querySelectorAll('.card-header').forEach(header => {
    const title = header.querySelector('.card-title');
    if (title && normalizePrintHeadingText(title.textContent) === printTitleKey) {
      header.classList.add('print-hidden');
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   4. META / BAŞLIK BİLGİSİ TOPLAMA
   ────────────────────────────────────────────────────────────── */

/**
 * Ders programı ekranından filtre özetini güvenle toplar.
 * @returns {{ title: string, filterText: string }}
 */
function getSchedulePrintMetaSafe() {
  try {
    const titleEl = document.querySelector('#schedulePrintArea .card-title');
    const title   = titleEl ? titleEl.textContent.trim() : 'Ders Programı';
    let filterText = '';
    if (typeof scheduleFilterDescriptors === 'function' && typeof scheduleFilters === 'function') {
      const f     = scheduleFilters();
      const parts = scheduleFilterDescriptors(f).filter(d => d.value);
      filterText  = parts.map(d => `${d.label}: ${d.value}`).join(' · ');
    }
    return { title, filterText };
  } catch (e) {
    return { title: 'Ders Programı', filterText: '' };
  }
}

/**
 * Öğretmen profili başlık bilgisini güvenle toplar.
 * @param {Element} root
 * @returns {{ name: string, branch: string }}
 */
function getTeacherProfileMetaSafe(root) {
  try {
    // card-header yoksa DB'den al
    if (root && !root.querySelector('.card-header')) {
      const id = (typeof selectedTeacherId !== 'undefined') ? selectedTeacherId : null;
      const t  = (id && typeof teacherById === 'function') ? teacherById(id) : null;
      return {
        name:   t ? (typeof teacherName === 'function' ? teacherName(t) : '') : 'Öğretmen Profili',
        branch: t ? (t.branch || '') : '',
      };
    }
    // card-header varsa → sınıf profili
    const h = root ? root.querySelector('.card-header .card-title') : null;
    return { name: h ? h.textContent.trim() : 'Profil', branch: '' };
  } catch (e) {
    return { name: 'Profil', branch: '' };
  }
}

/**
 * type ve sourceId'ye göre uygun meta toplayıcıyı çağırır.
 * @param {string} type
 * @param {string} sourceId
 * @param {Element|null} root
 * @returns {{ title: string, sub: string }}
 */
function getAutoMetaSafe(type, sourceId, root) {
  try {
    if (type === 'teacher-profile') {
      const m = getTeacherProfileMetaSafe(root);
      return { title: m.name, sub: m.branch };
    }
    if (type === 'class-profile') {
      const m = getTeacherProfileMetaSafe(root);
      return { title: m.name, sub: '' };
    }
    if (['teacher-sheet','class-sheet','schedule','entry-list','program-list','free'].includes(type)) {
      const m = getSchedulePrintMetaSafe();
      return { title: m.title, sub: m.filterText };
    }
    // Diğerleri: card-title'dan al
    const titleEl = root ? root.querySelector('.card-title') : null;
    return { title: titleEl ? titleEl.textContent.trim() : '', sub: '' };
  } catch (e) {
    return { title: '', sub: '' };
  }
}

/* ──────────────────────────────────────────────────────────────
   5. BAŞLIK BANDI HTML
   ────────────────────────────────────────────────────────────── */

/**
 * Yazdırma başlık bandı HTML'ini üretir.
 * @param {{ title: string, sub: string }} opts
 * @param {Element|null} root  (kullanılmıyor, ileride genişletme için)
 * @returns {string}
 */
function buildPrintHeader(opts, root) {
  const printDate = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  return `<div class="ph-wrap"><div class="ph-title"><strong>${esc(opts.title || '')}</strong>${opts.sub ? `<span>${esc(opts.sub)}</span>` : ''}</div><span class="ph-date">${printDate}</span></div>`;
}

/* ──────────────────────────────────────────────────────────────
   6. CSS ÜRETİCİLERİ
   ────────────────────────────────────────────────────────────── */

/**
 * Tüm print CSS'ini birleştirir.
 * @param {string} type
 * @param {string} orientation  - 'A4 portrait' | 'A4 landscape'
 * @param {Element|null} root
 * @param {Object} opts
 * @returns {string}
 */
function buildPrintCss(type, orientation, root, opts) {
  return [
    buildBasePrintCss(orientation),
    buildPrintTypeCss(type, root, opts),
  ].join('\n');
}

/**
 * Tüm modlar için ortak temel CSS.
 * @param {string} orientation
 * @returns {string}
 */
function buildBasePrintCss(orientation) {
  return `
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
@page { size:${orientation}; margin:10mm; }
* { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:10pt; color:#0f172a; }
a { color:#0f172a; text-decoration:none; }

/* ── Ortak bileşenler ── */
.card        { border:0; break-inside:auto; page-break-inside:auto; }
.card-header { padding:3px 0; }
.card-body   { padding:0; }
.card-title  { margin:0; font-size:11pt; }
.table { width:100%; border-collapse:collapse; }
.table th,.table td { border:1px solid #cbd5e1!important; padding:3px 5px!important; vertical-align:middle; }
.table th { background:#f1f5f9!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
thead { display:table-header-group; }
.no-print,.page-actions,.schedule-health,.obs-toast,.print-hidden { display:none!important; }
.dashboard-search-card,.teacher-action-row,.teacher-selected-preview,
.program-filter-inline,.program-mode-btns,.schedule-toolbar-card,
.report-switch,.task-filter-details,.schedule-filter-details { display:none!important; }
.profile-info-empty,
details.content-disclosure[data-section-key*="-duty"] { display:none!important; }
.print-only,.tc-print-full { display:block!important; }
.screen-only,.tc-screen-mask { display:none!important; }
.tc-print-col { display:table-cell!important; }
button:not(.print-keep) { display:none!important; }
.slot-span-note { display:none!important; }
.print-meta { font-size:7.5pt; color:#64748b; text-align:right; margin-bottom:3mm; }

/* ── Yazdırma başlık bandı ── */
.ph-wrap {
  display:flex; justify-content:space-between; align-items:baseline;
  border-bottom:2pt solid #111827; margin-bottom:5mm; padding-bottom:2mm;
  break-after:avoid; page-break-after:avoid;
}
.ph-title strong { font-size:13pt; font-weight:800; display:block; }
.ph-title span   { font-size:8.5pt; color:#475569; display:block; margin-top:1mm; }
.ph-date         { font-size:8pt; color:#64748b; white-space:nowrap; }

/* ── Disclosure (tüm modlar) ── */
.content-disclosure { display:block!important; border-top:1px solid #dbe3ef; }
.content-disclosure:first-child { border-top:0; }
.content-disclosure > summary {
  display:flex!important; align-items:center; justify-content:space-between; gap:4mm;
  padding:2mm 0 1.5mm; margin:0; break-after:avoid; page-break-after:avoid;
  list-style:none;
}
.content-disclosure > summary::-webkit-details-marker { display:none!important; }
.content-disclosure > summary::after { display:none!important; }
.content-disclosure > summary .disclosure-title { display:flex; align-items:center; gap:2mm; font-weight:700; }
.content-disclosure > summary .disclosure-title i { display:none!important; }
.content-disclosure > summary .disclosure-meta { color:#64748b; font-size:7.5pt; }
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
.class-board-slot span,.teacher-board-slot span     { font-size:6.5pt; font-weight:700; }
.class-board-slot small,.teacher-board-slot small   { font-size:6pt; color:#475569; }
.teacher-weekly-scroll { overflow:visible!important; }
.prog-table { width:100%; border-collapse:collapse; }
.row { display:flex; flex-wrap:wrap; gap:6px; }
.col-6,.col-lg-3,.col-lg-5,.col-lg-6,.col-lg-7 { flex:1 1 0; }

.profile-info-grid-print {
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:2mm!important;
}
.profile-info-grid-print > [class*="col-"] {
  width:auto!important; max-width:none!important; flex:none!important; padding:0!important;
}
.profile-info {
  border:0.8pt solid #334155;
  border-radius:3px;
  background:#f8fafc!important;
  padding:2mm 2.4mm;
  min-height:12mm;
  break-inside:avoid;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-info span {
  display:block; font-size:6.6pt; color:#64748b;
  text-transform:uppercase; letter-spacing:.025em; margin-bottom:1mm;
}
.profile-info strong {
  display:block; font-size:8.5pt; line-height:1.15; overflow-wrap:anywhere;
}

/* ── prog-table (haftalık program tablolar) ── */
.prog-table { width:100%; border-collapse:collapse; break-inside:avoid; }
.prog-table th,.prog-table td {
  border:1pt solid #334155!important; padding:2px 4px!important;
  vertical-align:middle; text-align:center;
}
.prog-table thead th {
  background:#e2e8f0!important; font-size:7.5pt; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.prog-table tbody td:first-child { text-align:left; font-weight:600; }
.prog-table .prog-slot strong { font-size:7.5pt; }
.prog-table .prog-slot span   { font-size:6.5pt; font-weight:700; }
.prog-table .prog-slot small  { font-size:6pt; color:#475569; }
.prog-table .prog-empty { color:#94a3b8; font-size:7pt; }

/* ── settings-matrix ── */
.settings-matrix { width:100%; border-collapse:collapse; }
.settings-matrix th,.settings-matrix td {
  border:1pt solid #334155!important; padding:2mm 3mm!important; vertical-align:top;
}
.settings-matrix thead th {
  background:#e2e8f0!important; font-size:9pt; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}

/* ── Sayfa geçişi kuralları ── */
.content-disclosure { break-inside:auto; page-break-inside:auto; }
.profile-card       { break-inside:auto; page-break-inside:auto; }
.card-header,
.section-title-row,
h3,h4               { break-after:avoid; page-break-after:avoid; }

/* ── Günlük program ── */
.daily-program-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; }
.daily-lesson-card  { border:1pt solid #334155; padding:2mm; min-height:18mm; break-inside:avoid; }
.daily-lesson-card.has-lesson { border-left:2.5pt solid #1a56db; }
.daily-slot strong,.daily-slot span,.daily-slot small { display:block; line-height:1.1; }
.daily-slot strong { font-size:8.5pt; }
.daily-slot span   { font-size:7.5pt; font-weight:700; }
.daily-slot small  { font-size:6.5pt; color:#475569; }

/* ── soft-chip genel ── */
.soft-chip { display:inline-block; border:1px solid #94a3b8; border-radius:3px; padding:0 2mm; font-size:8pt; margin:1px; }

/* ── section-title-row ── */
.section-title-row {
  display:flex; align-items:baseline; justify-content:space-between;
  border-bottom:1.5pt solid #111827; margin-bottom:3mm; padding-bottom:1.5mm;
}
.section-title-row h4 { font-size:10pt; font-weight:700; margin:0; }
.section-title-row .small { font-size:7.5pt; color:#64748b; }
`;
}

/**
 * Type'a göre özel CSS bloğunu çağırır.
 * @param {string} type
 * @param {Element|null} root
 * @param {Object} opts
 * @returns {string}
 */
function buildPrintTypeCss(type, root, opts) {
  if (type === 'teacher-sheet' || type === 'class-sheet') return buildSheetPrintCss(type, root, opts);
  if (type === 'entry-list')                               return buildListPrintCss(type, root, opts);
  if (type === 'program-list')                             return buildWeeklyProgramPrintCss(type, root, opts);
  if (type === 'teachers')                                 return buildTeacherListPrintCss(type, root, opts);
  if (type === 'teacher-profile' || type === 'class-profile') return buildProfilePrintCss(type, root, opts);
  if (type === 'duty')                                     return buildDutyPrintCss(type, root, opts);
  if (type === 'tasks')                                    return buildTasksPrintCss(type, root, opts);
  if (type === 'free')                                     return buildFreePrintCss(type, root, opts);
  // 'schedule' ve bilinmeyen tipler için DOM tespiti ile karar ver
  return buildAutoTypeCss(root, opts);
}

/**
 * Çarşaf (sheet-print) CSS — data-cell-count ile dinamik hücre genişliği.
 * @param {string} type
 * @param {Element|null} root
 * @param {Object} opts
 * @returns {string}
 */
function buildSheetPrintCss(type, root, opts) {
  // data-cell-count oku
  const sheetTable     = root ? root.querySelector('.schedule-sheet') : null;
  const cellCount      = sheetTable ? Number(sheetTable.dataset.cellCount || 0) : 0;
  const isTeacherSheet = root ? !!root.querySelector('.teacher-sheet') : (type === 'teacher-sheet');
  const nameColW       = isTeacherSheet ? '22mm' : '15mm';
  const cellW          = cellCount > 0
    ? `calc((100% - ${nameColW}) / ${cellCount})`
    : `calc((100% - ${nameColW}) / 40)`;

  return `
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
.sheet-print .sheet-cell-content strong,
.sheet-print .sheet-cell-content span {
  display:block; line-height:1.04; white-space:normal; overflow:hidden;
}
.sheet-print .sheet-cell-content strong { font-size:4.25pt; font-weight:800; }
.sheet-print .sheet-cell-content span   { font-size:3.95pt; font-weight:700; margin-top:.15mm; }
.sheet-print .schedule-sheet thead { display:table-header-group; }
.sheet-print .schedule-sheet thead br { display:none; }
.sheet-print .schedule-sheet small { font-size:4.25pt; display:inline; color:#111; margin-left:1px; }
.sheet-print .teacher-sheet { font-size:4.15pt; }
.sheet-print .class-sheet   { font-size:4.8pt; }
.sheet-print .class-sheet tbody br    { display:block; }
.sheet-print .class-sheet tbody small { display:block; margin-left:0; font-size:4.45pt; }
.sheet-print .teacher-sheet .sheet-name {
  width:${nameColW}!important; min-width:${nameColW}!important; max-width:${nameColW}!important;
  text-align:left; white-space:normal; overflow:hidden; line-height:1.03;
  overflow-wrap:anywhere; word-break:normal;
}
.sheet-print .teacher-sheet .sheet-name .sheet-teacher-code {
  display:block; max-width:100%; white-space:normal; overflow:hidden; text-overflow:clip;
}
.sheet-print .teacher-sheet .sheet-name .sheet-teacher-code {
  font-size:4.25pt; line-height:1.05; font-weight:800;
}
.sheet-print .class-sheet .sheet-name {
  width:${nameColW}!important; min-width:${nameColW}!important; max-width:${nameColW}!important;
  text-align:center;
}
.sheet-print .teacher-sheet td,
.sheet-print .teacher-sheet thead tr:nth-child(2) th { width:${cellW}; }
.sheet-print .class-sheet td,
.sheet-print .class-sheet thead tr:nth-child(2) th   { width:${cellW}; }
.sheet-print .schedule-sheet th,
.sheet-print .schedule-sheet td { border:0.4pt solid #64748b!important; }
.sheet-print .schedule-sheet .sheet-name { border-right:1.5pt solid #334155!important; }
.sheet-print .schedule-sheet thead th {
  background:#e2e8f0!important; font-size:4.5pt; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet-print .sheet-filled,.sheet-print .sheet-empty { min-width:0!important; }
.sheet-print .sheet-empty {
  background:#f8fafc!important; color:#94a3b8;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet-print .duty-sheet { box-shadow:inset 0 0 0 .6pt #d97706; }
`;
}

/**
 * Haftalık program listesi (program-list-print) CSS.
 */
function buildWeeklyProgramPrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   PROGRAM LİSTESİ (program-list-print)
   ════════════════════════════════════════ */
.program-list-print .class-program-list { display:flex; flex-direction:column; gap:0; }
.program-list-print .content-disclosure {
  break-inside:avoid; page-break-inside:avoid; border-top:1px solid #dbe3ef;
  padding-top:1mm; margin-bottom:3mm;
}
.program-list-print .content-disclosure:first-child { border-top:0; }
.program-list-print .table-responsive { overflow:visible!important; }
.program-list-print .disclosure-meta  { font-size:7pt; color:#475569; }

/* Board tabloları */
.program-list-print .teacher-program-board,
.program-list-print .class-program-board {
  font-size:7.5pt; width:100%; border-collapse:collapse; table-layout:fixed;
}
.program-list-print .teacher-program-board th,
.program-list-print .teacher-program-board td,
.program-list-print .class-program-board th,
.program-list-print .class-program-board td {
  border:0.8pt solid #475569!important; padding:1.5px 3px!important;
  text-align:center; vertical-align:middle;
}
.program-list-print .teacher-program-board thead th,
.program-list-print .class-program-board thead th {
  background:#e2e8f0!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.program-list-print .teacher-program-board th:first-child,
.program-list-print .class-program-board th:first-child,
.program-list-print .teacher-program-board td:first-child,
.program-list-print .class-program-board td:first-child {
  text-align:left; border-right:1.5pt solid #334155!important;
}
.program-list-print .teacher-program-board thead,
.program-list-print .class-program-board thead { display:table-header-group; }
`;
}

/**
 * Ders kayıtları listesi (entry-print) CSS.
 */
function buildListPrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   KAYIT LİSTESİ (entry-print)
   ════════════════════════════════════════ */
.entry-print .schedule-sheet,
.entry-print .class-program-list { display:none!important; }
.entry-print .schedule-entry-list { display:block!important; border-top:0; padding-top:0; }
.entry-print .section-title-row   { margin-bottom:4mm; }
.entry-print h4 { margin:0; font-size:12pt; }
.entry-print .schedule-entry-table { width:100%; border-collapse:collapse; }
.entry-print .schedule-entry-table th,
.entry-print .schedule-entry-table td {
  border:0.8pt solid #334155!important; padding:2px 4px!important;
  vertical-align:middle; font-size:8.5pt;
}
.entry-print .schedule-entry-table thead th {
  background:#e2e8f0!important; font-weight:700; text-align:left;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.entry-print .schedule-entry-table thead { display:table-header-group; }
.entry-print .schedule-entry-table tbody tr { break-inside:avoid; page-break-inside:avoid; }
.entry-print .table-responsive { overflow:visible!important; }
`;
}

/**
 * Öğretmen listesi (teacher-list-print) CSS.
 */
function buildTeacherListPrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   ÖĞRETMEN LİSTESİ (teacher-list-print) — yatay A4
   ════════════════════════════════════════ */
.teacher-list-print { font-size:8pt; }
.teacher-list-print .card { border:0; break-inside:auto; page-break-inside:auto; }
.teacher-list-print .card-header {
  padding:0 0 2mm; margin-bottom:2mm; border-bottom:1.5pt solid #111827;
}
.teacher-list-print .card-title { font-size:10.5pt; font-weight:800; }
.teacher-list-print .table-responsive { overflow:visible!important; }
.teacher-list-print .table {
  width:100%; border-collapse:collapse; table-layout:auto; font-size:7.8pt;
}
.teacher-list-print .table th,
.teacher-list-print .table td {
  border:0.7pt solid #334155!important; padding:1.4px 3px!important;
  vertical-align:middle; line-height:1.15;
}
.teacher-list-print .table thead th {
  background:#e2e8f0!important; font-weight:700; text-align:left;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.teacher-list-print .table thead { display:table-header-group; }
.teacher-list-print .table tbody tr { break-inside:avoid; page-break-inside:avoid; }
`;
}

/**
 * Öğretmen / Sınıf profili (profile-print) CSS.
 */
function buildProfilePrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   PROFİL (profile-print) — dikey A4
   ════════════════════════════════════════ */
.profile-print { font-size:9pt; }
.profile-print .profile-card    { border:0; break-inside:auto; page-break-inside:auto; }
.profile-print .profile-header  { margin-bottom:3mm; }
.profile-print .profile-disclosures { padding:0 2mm!important; }
.profile-print .content-disclosure { break-inside:avoid; page-break-inside:avoid; }
.profile-print .profile-info-grid-print {
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:2mm!important;
}
.profile-print .profile-info-grid-print > [class*="col-"] {
  width:auto!important; max-width:none!important; flex:none!important; padding:0!important;
}
.profile-print .info-line,
.profile-print .profile-info {
  border:0.8pt solid #334155; border-radius:3px; background:#f8fafc!important;
  padding:2mm 2.4mm; min-height:12mm; margin:0; break-inside:avoid;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .info-line span,
.profile-print .profile-info span {
  font-size:6.6pt; color:#64748b; display:block; text-transform:uppercase;
  letter-spacing:.025em; margin-bottom:1mm;
}
.profile-print .info-line strong,
.profile-print .profile-info strong { font-size:8.5pt; line-height:1.15; display:block; overflow-wrap:anywhere; }
.profile-print .teacher-weekly-scroll,.profile-print .table-responsive { overflow:visible!important; }
.profile-print .prog-table { width:100%; font-size:7pt; table-layout:fixed; border-collapse:collapse; }
.profile-print .prog-table th,
.profile-print .prog-table td {
  border:0.8pt solid #475569!important; padding:1.5px 3px!important;
  text-align:center; vertical-align:middle;
}
.profile-print .prog-table thead th {
  background:#e2e8f0!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .prog-table thead { display:table-header-group; }
.profile-print .section-body-actions { display:none!important; }
.profile-print .btn-tc-reveal   { display:none!important; }
.profile-print .tc-field::before { content:attr(data-tc); font-size:9pt; font-weight:700; display:block; }
.profile-print .tc-display      { display:none!important; }
.profile-print .free-slot-grid  { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:2mm; }
.profile-print .free-day {
  border:0.8pt solid #334155; border-radius:3px; background:#f8fafc!important;
  padding:2mm; min-height:14mm; break-inside:avoid;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .free-day strong {
  display:block; font-size:8pt; font-weight:800; margin:0 0 1mm;
}
.profile-print .free-day .text-muted {
  color:#64748b!important; font-size:7.5pt;
}
.profile-print .free-day .soft-chip {
  border:0.7pt solid #94a3b8; border-radius:3px; padding:0.5mm 1.6mm;
  margin:0.5mm; font-size:7.5pt; background:#fff!important;
}
.profile-print .free-day .chip-free-day {
  background:#dcfce7!important; color:#166534!important; font-weight:800;
}
.profile-print .duty-profile-box {
  display:flex; gap:6mm; border:1pt solid #334155; padding:2mm 4mm; border-radius:4px;
}
.profile-print .duty-profile-box span   { display:block; font-size:7.5pt; color:#64748b; }
.profile-print .duty-profile-box strong { display:block; font-size:9pt; }
/* teachers type — öğretmen listesi tablosu */
.profile-print .table { width:100%; border-collapse:collapse; font-size:8.5pt; }
.profile-print .table th,.profile-print .table td {
  border:0.8pt solid #334155!important; padding:2px 5px!important; vertical-align:middle;
}
.profile-print .table thead th {
  background:#e2e8f0!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .table thead { display:table-header-group; }
.profile-print .table tbody tr { break-inside:avoid; page-break-inside:avoid; }
.profile-print .table-responsive { overflow:visible!important; }
`;
}

/**
 * Nöbet çizelgesi (duty-print) CSS.
 */
function buildDutyPrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   NÖBET ÇİZELGESİ (duty-print) — yatay A4
   ════════════════════════════════════════ */
.duty-print { font-size:8.7pt; }
.duty-print .duty-matrix { width:100%; border-collapse:collapse; }
.duty-print .duty-matrix th,
.duty-print .duty-matrix td {
  border:1pt solid #334155!important; padding:2mm 2.6mm!important; vertical-align:middle;
}
.duty-print .duty-matrix thead th {
  background:#e2e8f0!important; font-size:9pt; font-weight:700; text-align:center;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.duty-print .duty-matrix thead { display:table-header-group; }
.duty-print .duty-matrix tbody tr { break-inside:avoid; page-break-inside:avoid; }
.duty-print .duty-place-head { text-align:left!important; font-weight:700; white-space:nowrap; border-right:1.5pt solid #334155!important; }
.duty-print .duty-filled-cell { background:#dbeafe!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.duty-print .duty-empty-cell  { color:#94a3b8; text-align:center; }
.duty-print .duty-cell strong { display:block; font-size:9pt; }
.duty-print .duty-cell span   { display:block; font-size:7.5pt; color:#475569; }
`;
}

/**
 * Görev listesi (tasks-print) CSS.
 */
function buildTasksPrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   GÖREV LİSTESİ (tasks-print) — yatay A4
   ════════════════════════════════════════ */
.tasks-print { font-size:8.3pt; }
.tasks-print .chip-wrap,.tasks-print .obs-panel:first-child { display:none!important; }
.tasks-print .table { width:100%; border-collapse:collapse; }
.tasks-print .table th,.tasks-print .table td {
  border:0.8pt solid #334155!important; font-size:7.6pt; padding:1.6px 3px!important; vertical-align:middle;
}
.tasks-print .table thead th {
  background:#e2e8f0!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.tasks-print .table thead { display:table-header-group; }
.tasks-print .table tbody tr { break-inside:avoid; page-break-inside:avoid; }
.tasks-print .table-responsive { overflow:visible!important; }
.tasks-print .table-actions { display:none!important; }
`;
}

/**
 * Boş saat raporu (free-print) CSS.
 */
function buildFreePrintCss(type, root, opts) {
  return `
/* ════════════════════════════════════════
   BOŞ SAAT RAPORU (free-print) — dikey A4
   ════════════════════════════════════════ */
.free-print .free-report-block { break-inside:avoid; page-break-inside:avoid; margin-bottom:6mm; }
.free-print .free-query-grid   { display:flex; flex-wrap:wrap; gap:3mm; }
.free-print .free-query-card {
  border:1pt solid #334155; padding:2mm 3mm; min-width:42mm; font-size:8.5pt;
  break-inside:avoid; border-radius:3px;
}
.free-print .free-query-card strong { display:block; font-size:9pt; font-weight:700; }
.free-print .free-query-card span   { display:block; font-size:7.5pt; color:#475569; }
.free-print .free-query-card small  { display:block; font-size:7pt; color:#64748b; margin-top:1mm; }
.free-print .free-report-note { font-size:8pt; color:#475569; margin-bottom:3mm; }
.free-print .free-day-overview { display:flex; flex-wrap:wrap; gap:3mm; }
.free-print .free-day-summary {
  border:1pt solid #cbd5e1; padding:2mm 3mm; min-width:38mm; break-inside:avoid;
}
.free-print .free-day-summary strong { display:block; font-weight:700; font-size:9pt; }
.free-print .free-day-summary span   { display:block; font-size:7.5pt; color:#64748b; margin-bottom:1mm; }
.free-print .free-slot-grid { display:flex; flex-wrap:wrap; gap:2mm; }
.free-print .table-responsive { overflow:visible!important; }
.free-print .table { width:100%; border-collapse:collapse; }
.free-print .table th,.free-print .table td {
  border:0.8pt solid #334155!important; padding:2px 4px!important; font-size:8pt;
}
.free-print .table thead th {
  background:#e2e8f0!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.free-print .table thead { display:table-header-group; }
`;
}

/**
 * type bilinmiyorsa DOM'a bakarak uygun CSS'i seçer.
 * @param {Element|null} root
 * @param {Object} opts
 * @returns {string}
 */
function buildAutoTypeCss(root, opts) {
  if (!root) return '';
  if (root.querySelector('.schedule-sheet'))    return buildSheetPrintCss('auto', root, opts);
  if (root.querySelector('.schedule-entry-table')) return buildListPrintCss('auto', root, opts);
  if (root.querySelector('.class-program-list'))   return buildWeeklyProgramPrintCss('auto', root, opts);
  if (root.querySelector('.profile-card'))         return buildProfilePrintCss('auto', root, opts);
  if (root.querySelector('.duty-matrix'))          return buildDutyPrintCss('auto', root, opts);
  if (root.querySelector('#tasksContent'))         return buildTasksPrintCss('auto', root, opts);
  if (root.querySelector('.free-report-block'))    return buildFreePrintCss('auto', root, opts);
  return '';
}

/* ──────────────────────────────────────────────────────────────
   7. IFRAME YAZDIRMA VE TEMİZLİK
   ────────────────────────────────────────────────────────────── */

/**
 * Verilen HTML içeriğiyle gizli bir iframe açar ve döndürür.
 * @param {string} printHtml  - Tam HTML belgesi
 * @returns {HTMLIFrameElement}
 */
function openPrintFrame(printHtml) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(printHtml);
  doc.close();

  return iframe;
}

/**
 * iframe'i yazdırır, afterprint veya timeout fallback ile temizler.
 * @param {HTMLIFrameElement} iframe
 */
function printFrameAndCleanup(iframe) {
  if (!iframe || !iframe.contentWindow) return;

  const win = iframe.contentWindow;
  let cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    try { iframe.remove(); } catch (e) { /* sessiz */ }
  }

  try {
    win.addEventListener('afterprint', cleanup, { once: true });
  } catch (e) { /* eski tarayıcılarda afterprint yoksa timeout yeterli */ }

  // Timeout fallback: afterprint tetiklenmese bile 8 saniyede temizle
  const fallback = setTimeout(cleanup, 8000);

  win.focus();
  try {
    win.print();
  } catch (e) {
    cleanup();
  }
}

/* ──────────────────────────────────────────────────────────────
   8. BUTON VE HATA YÖNETİMİ
   ────────────────────────────────────────────────────────────── */

/**
 * Yazdırma butonunu meşgul/hazır duruma getirir.
 * @param {Element|null} button
 * @param {boolean} busy
 */
function setPrintButtonBusy(button, busy) {
  if (!button) return;
  if (busy) {
    button.dataset.printOrigHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Hazırlanıyor…';
  } else {
    button.disabled = false;
    if (button.dataset.printOrigHtml) {
      button.innerHTML = button.dataset.printOrigHtml;
      delete button.dataset.printOrigHtml;
    }
  }
}

/**
 * Kullanıcıya yazdırma hatasını bildirir.
 * @param {string} message
 */
function notifyPrintError(message) {
  if (typeof showToast === 'function') {
    showToast(message || 'Yazdırma sırasında hata oluştu.', 'warning');
  } else {
    console.warn('[teacher-print]', message);
  }
}

/* ──────────────────────────────────────────────────────────────
   9. ANA MOTOR: printDocument()
   ────────────────────────────────────────────────────────────── */

/**
 * Merkezi yazdırma motoru.
 *
 * Kullanım:
 *   printDocument({ sourceId: 'teacherProfile', type: 'teacher-profile', title: 'Öğretmen Profili', button: this })
 *   printDocument({ sourceId: 'dutyPrintArea',  type: 'duty',            title: 'Nöbet Çizelgesi',  button: this })
 *
 * @param {Object} options
 * @param {string}       options.sourceId    - Kaynak DOM elemanı id'si
 * @param {string}       options.type        - Yazdırma tipi (resolveBodyClass ile eşleşir)
 * @param {string}       [options.title]     - Başlık (otomatik tespit edilirse kullanılmaz)
 * @param {string}       [options.orientation] - 'auto' | 'portrait' | 'landscape'
 * @param {Element|null} [options.button]    - Yazdır butonu (busy state için)
 */
function printDocument(options) {
  const opts = normalizePrintOptions(options);

  // Kaynak elemanı bul
  const root = opts.sourceId
    ? (typeof getEl === 'function' ? getEl(opts.sourceId) : document.getElementById(opts.sourceId))
    : null;

  if (!root) {
    notifyPrintError('Yazdırılacak içerik bulunamadı.');
    return;
  }

  setPrintButtonBusy(opts.button, true);

  try {
    // Body class
    let bodyClass = resolveBodyClass(opts.type);
    if (!bodyClass) {
      // DOM tespiti ile belirle
      const isSheet       = !!root.querySelector('.schedule-sheet');
      const isEntryList   = !!root.querySelector('.schedule-entry-table');
      const isProgramList = !isSheet && !isEntryList && !!root.querySelector('.class-program-list');
      const isProfile     = !isSheet && !isEntryList && !isProgramList && !!root.querySelector('.profile-card');
      const isDuty        = !isSheet && !isEntryList && !isProgramList && !isProfile && !!root.querySelector('.duty-matrix');
      const isTasks       = !isSheet && !isEntryList && !isProgramList && !isProfile && !isDuty && !!root.querySelector('#tasksContent');
      const isFree        = !isSheet && !isEntryList && !isProgramList && !isProfile && !isDuty && !isTasks && !!root.querySelector('.free-report-block');
      bodyClass = isSheet ? 'sheet-print' : isEntryList ? 'entry-print' : isProgramList ? 'program-list-print'
               : isProfile ? 'profile-print' : isDuty ? 'duty-print' : isTasks ? 'tasks-print'
               : isFree ? 'free-print' : '';
    }

    // Sayfa yönü
    const orientation = resolvePrintOrientation(opts.type, opts.orientation, root, opts.sourceId);

    // CSS
    const css = buildPrintCss(opts.type, orientation, root, opts);

    // Başlık meta
    const meta = getAutoMetaSafe(opts.type, opts.sourceId, root);
    if (opts.title && ['tasks', 'teachers'].includes(opts.type)) meta.title = opts.title;
    if (!meta.title && opts.title) meta.title = opts.title;
    const headerHtml = buildPrintHeader(meta, root);

    // DOM hazırlık (iframe kopyasına taşınmadan önce orijinal DOM'da gerek yok;
    // outerHTML snapshot alındıktan sonra çalıştırılır)
    const rootClone = root.cloneNode(true);
    expandScrollableAreas(rootClone);
    openDisclosureForPrint(rootClone);
    prepareProfileProgramForPrint(rootClone, opts);
    dedupePrintHeadings(rootClone, meta);
    markHiddenForPrint(rootClone);

    // Güvenli escapeHtml
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s));
    const printTitle = esc(meta.title || opts.title || 'Yazdır');
    const browserPrintTitle = opts.type === 'teacher-profile' ? '&#8203;' : printTitle;

    const printHtml = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${browserPrintTitle}</title><style>${css}</style></head><body class="${bodyClass}">${headerHtml}${rootClone.outerHTML}</body></html>`;

    const iframe = openPrintFrame(printHtml);

    // doc.write ile doldurulan iframe'lerde onload güvenilmez (özellikle mobil).
    // Kısa bir timeout sonra doğrudan yazdır.
    setTimeout(() => {
      printFrameAndCleanup(iframe);
      setPrintButtonBusy(opts.button, false);
    }, 300);

    // Güvenlik: buton takılı kalmasın
    setTimeout(() => setPrintButtonBusy(opts.button, false), 5000);

  } catch (err) {
    setPrintButtonBusy(opts.button, false);
    notifyPrintError('Yazdırma hazırlanırken hata oluştu.');
    console.error('[teacher-print] printDocument hatası:', err);
  }
}

/* ──────────────────────────────────────────────────────────────
   10. DERS PROGRAMI ÖZEL MOTOR: printSchedule()
   ────────────────────────────────────────────────────────────── */

/**
 * Ders programı ekranı için özel yazdırma motoru.
 * Aktif görünüm moduna (çarşaf, liste, kayıt, boş saat) göre
 * doğru type ve sourceId'yi otomatik seçer.
 *
 * Kullanım (index.html):
 *   onclick="printSchedule(this)"
 *
 * @param {Element|null} button
 */
function printSchedule(button) {
  try {
    // Aktif görünüm modunu oku
    const viewMode = (typeof getEl === 'function' && getEl('scheduleViewMode'))
      ? getEl('scheduleViewMode').value
      : '';

    // Görünüm moduna göre type ve sourceId belirle
    let type, sourceId, title;

    if (viewMode === 'teacherSheet' || viewMode === 'classSheet') {
      type     = viewMode === 'teacherSheet' ? 'teacher-sheet' : 'class-sheet';
      sourceId = 'schedulePrintArea';
      title    = viewMode === 'teacherSheet' ? 'Öğretmen Çarşaf Programı' : 'Sınıf Çarşaf Programı';
    } else if (viewMode === 'free') {
      type     = 'free';
      sourceId = 'schedulePrintArea';
      title    = 'Boş Saat Raporu';
    } else if (viewMode === 'classList' || viewMode === 'teacherPrograms') {
      type     = 'program-list';
      sourceId = 'schedulePrintArea';
      title    = viewMode === 'classList' ? 'Sınıf Programları' : 'Öğretmen Programları';
    } else {
      // Varsayılan: DOM tespiti ile
      type     = 'schedule';
      sourceId = 'schedulePrintArea';
      title    = 'Ders Programı';
    }

    printDocument({ sourceId, type, title, button });

  } catch (err) {
    notifyPrintError('Ders programı yazdırılamadı.');
    console.error('[teacher-print] printSchedule hatası:', err);
  }
}
