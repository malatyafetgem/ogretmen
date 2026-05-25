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

function isMobilePrintViewport() {
  return isMobilePrintDevice();
}

/**
 * Mobil/dokunmatik cihaz tespiti — ana sistemdeki _xprIsMobilePrintDevice() yaklaşımı.
 * Yalnızca ekran genişliğine değil; user-agent, pointer türü ve dokunma noktalarına bakar.
 */
function isMobilePrintDevice() {
  try {
    var ua = (navigator.userAgent || navigator.vendor || '').toString();
    var mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua);
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch(e){}
    var sw = (window.screen && window.screen.width)  ? window.screen.width  : window.innerWidth;
    var sh = (window.screen && window.screen.height) ? window.screen.height : window.innerHeight;
    var smallScreen = Math.min(sw || 0, sh || 0) <= 820;
    return mobileUA || (smallScreen && (coarse || (navigator.maxTouchPoints || 0) > 1));
  } catch(e) {
    return false;
  }
}

function shouldWarnForLandscapePrint(type, orientation) {
  if (orientation !== 'A4 landscape') return false;
  if (!isMobilePrintDevice()) return false;
  return [
    'teacher-sheet',
    'class-sheet',
    'program-list',
    'entry-list',
    'teachers',
    'duty',
    'tasks',
    'class-profile',
    'teacher-profile'
  ].includes(type);
}

/**
 * Yazdırma SONRASI yatay yön ipucunu kullanıcıya gösterir.
 * Yalnızca mobilde ve landscape çıktılarda çağrılır.
 * @param {string} type
 */
function notifyLandscapePrintHintAfterPrint(type) {
  if (!isMobilePrintDevice()) return;
  const isSheet = ['teacher-sheet', 'class-sheet'].includes(type);
  const message = isSheet
    ? 'İpucu: Yatay (landscape) yön seçerseniz çıktı daha iyi görünür.'
    : 'İpucu: Yazdırma ekranından Yatay yönü seçerseniz daha iyi çıktı alırsınız.';
  if (typeof showToast === 'function') showToast(message, 'info');
  else console.info('[teacher-print]', message);
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
 * Yazdırma klonundan gereksiz UI öğelerini doğrudan kaldırır.
 * CSS'e bırakılmaz; DOM'dan çıkarılır — özellikle mobil için kritik.
 * @param {Element} root  - cloneNode(true) ile alınmış kopya
 */
function markHiddenForPrint(root) {
  if (!root) return;

  // Doğrudan kaldırılacak seçiciler (çıktıya kesinlikle girmesin)
  const removeSelectors = [
    '.no-print',
    '.print-hidden',
    '.page-actions',
    '.teacher-action-row',
    '.teacher-selected-preview',
    '.dashboard-search-card',
    '.program-filter-inline',
    '.program-mode-btns',
    '.schedule-toolbar-card',
    '.schedule-health',
    '.report-switch',
    '.task-filter-details',
    '.schedule-filter-details',
    '.obs-toast',
    '.toast',
    '.alert:not(.print-keep)',
    'button:not(.print-keep)',
    '.btn:not(.print-keep):not(.risk-badge)',
    '.scroll-hint',
    '.page-title-row',
    '.app-footer',
    'footer',
    '.bottom-nav',
    '.app-header',
    '.app-sidebar',
    '.obs-topbar',
    // Arama inputları ve filtreler
    'input[type="search"]',
    'input[type="text"].search-input',
    '.search-row',
    '.filter-row',
    // Toolbar kontrol satırları
    '.schedule-toolbar-main',
    '.schedule-view-control',
  ];

  removeSelectors.forEach(sel => {
    try {
      root.querySelectorAll(sel).forEach(el => {
        try { el.remove(); } catch(e) {}
      });
    } catch(e) {}
  });

  // CSS sınıfı ekle (fallback için)
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
    el.open = true;
    const body = el.querySelector(':scope > .disclosure-body');
    if (body) {
      body.hidden = false;
      body.classList.remove('d-none', 'collapse');
      body.style.display = 'block';
      body.style.visibility = 'visible';
      body.style.height = 'auto';
    }
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
      const hasRenderedProgram = !!(section && section.querySelector('.prog-table, .daily-program-grid') && section.textContent.trim());
      if (section && t && (!hasRenderedProgram || mode !== 'day') && typeof buildTeacherProfileSchedule === 'function' && typeof teacherLessons === 'function') {
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

function normalizeProgramListForPrint(root, opts) {
  if (!root || !opts || opts.type !== 'program-list') return;
  root.querySelectorAll('.class-program-list > details.content-disclosure').forEach(detail => {
    const summary = detail.querySelector(':scope > summary');
    const titleText = summary?.querySelector('.disclosure-title strong')?.textContent?.trim()
      || summary?.querySelector('.disclosure-title')?.textContent?.trim()
      || '';
    const metaText = summary?.querySelector('.disclosure-meta')?.textContent?.trim() || '';
    const body = detail.querySelector(':scope > .disclosure-body');
    const section = document.createElement('section');
    section.className = 'print-program-section';

    const head = document.createElement('div');
    head.className = 'print-program-head';
    const title = document.createElement('strong');
    title.className = 'print-program-title';
    title.textContent = titleText;
    head.appendChild(title);
    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'print-program-meta';
      meta.textContent = metaText;
      head.appendChild(meta);
    }

    const content = document.createElement('div');
    content.className = 'print-program-body';
    content.innerHTML = body ? body.innerHTML : '';

    section.appendChild(head);
    section.appendChild(content);
    detail.replaceWith(section);
  });
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

  // Okul adını DB'den al (varsa)
  let schoolName = '';
  try {
    if (typeof DB !== 'undefined' && DB.settings && DB.settings.schoolName) {
      schoolName = DB.settings.schoolName;
    }
  } catch(e) {}

  const schoolRow = schoolName
    ? `<div class="ph-school">${esc(schoolName)}</div>`
    : '';
  const subRow = opts.sub
    ? `<div class="ph-sub">${esc(opts.sub)}</div>`
    : '';

  return `<div class="ph-wrap">
  <div class="ph-left">
    ${schoolRow}
    <div class="ph-title">${esc(opts.title || '')}</div>
    ${subRow}
  </div>
  <div class="ph-right">
    <div class="ph-date">${printDate}</div>
  </div>
</div>`;
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
/* ── CSS değişkenleri (yeni pencere/iframe'de teacher-style.css yüklü değil — inline tanımlanır) ── */
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
html,body { margin:0!important; padding:0!important; height:auto!important; min-height:0!important; overflow:visible!important; }
body { font-family:Arial,sans-serif; font-size:10pt; color:#0f172a; }
body > :last-child,
body > :last-child *:last-child,
.card:last-child,
.profile-card:last-child,
.profile-card > :last-child,
.profile-disclosures:last-child,
.profile-disclosures > :last-child,
.content-disclosure:last-child,
.content-disclosure > .disclosure-body:last-child,
.content-disclosure > .disclosure-body > :last-child,
.print-program-section:last-child,
.table-responsive:last-child {
  margin-bottom:0!important;
  padding-bottom:0!important;
  break-after:auto!important;
  page-break-after:auto!important;
}
body::after { content:none!important; display:none!important; }
a,.contact-link,.teacher-name-link { color:#0f172a!important; text-decoration:none!important; }
.contact-link i { display:none!important; }

/* ── Ortak bileşenler ── */
.card        { border:0; break-inside:auto; page-break-inside:auto; }
.card-header { padding:3px 0; }
.card-body   { padding:0; }
.card-title  { margin:0; font-size:11pt; }
/* Madde 9: üst wrapper margin'ları sıfırla — sonda boş sayfa önleme */
.obs-panel, .card, .profile-card, .mt-2, .mt-3 { margin-top:0!important; }
/* ── Ortak print tokenleri ──────────────────────────────── */
:root {
  --pt-border:     0.65pt solid #94a3b8;
  --pt-border-h:   1.5pt  solid #334155;
  --pt-border-top: 2pt solid #0f172a;
  --pt-head-bg:    #e8ecf2;
  --pt-row-alt:    #f5f7fa;
  --pt-pad-th:     3px 5px;
  --pt-pad-td:     3px 5px;
  --pt-fs-base:    8pt;
  --pt-fs-sm:      7.2pt;
  --pt-fs-xs:      6.2pt;
  --pt-lh:         1.3;
  --pt-cell-h:     6mm;   /* minimum hücre yüksekliği — tüm satırlar eşit */
}
/* ── Tablo temeli ── */
.table { width:100%; border-collapse:collapse; font-size:var(--pt-fs-base); table-layout:fixed; }
.table th,.table td {
  border:var(--pt-border)!important;
  padding:var(--pt-pad-td)!important;
  vertical-align:middle;
  line-height:var(--pt-lh);
  min-height:var(--pt-cell-h);
  height:var(--pt-cell-h);
  overflow-wrap:anywhere; word-break:break-word;
}
.table th {
  padding:var(--pt-pad-th)!important;
  background:var(--pt-head-bg)!important;
  font-weight:700; text-align:left;
  white-space:nowrap;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.table thead th { border-bottom:var(--pt-border-h)!important; }
.table tbody tr:nth-child(even) td {
  background:var(--pt-row-alt)!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
/* Sütun kesme: satır ortasında bölünme yok */
.table tbody tr { break-inside:avoid; page-break-inside:avoid; }
thead { display:table-header-group; }
/* Sütun kesme genel — tablo başlıktan önce kesilmesin */
table { break-inside:auto; }
thead { break-inside:avoid; break-after:avoid; }
.no-print,.page-actions,.schedule-health,.obs-toast,.print-hidden,.app-footer,footer.app-footer,.page-title-row { display:none!important; }
.dashboard-search-card,.teacher-action-row,.teacher-selected-preview,
.program-filter-inline,.program-mode-btns,.schedule-toolbar-card,
.report-switch,.task-filter-details,.schedule-filter-details { display:none!important; }
.profile-info-empty,
details.content-disclosure[data-section-key*="-duty"] { display:none!important; }
.profile-disclosures {
  display:flex!important;
  flex-direction:column!important;
  gap:0!important;
}
.mobile-print .card:last-child,
.mobile-print .content-disclosure:last-child,
.mobile-print .print-program-section:last-child,
.mobile-print .table-responsive:last-child {
  margin-bottom:0!important;
  padding-bottom:0!important;
  break-after:auto!important;
  page-break-after:auto!important;
}
.print-only,.tc-print-full { display:block!important; }
.screen-only,.tc-screen-mask { display:none!important; }
.tc-print-col { display:table-cell!important; }
button:not(.print-keep) { display:none!important; }
.slot-span-note { display:none!important; }
.print-meta { font-size:7.5pt; color:#64748b; text-align:right; margin-bottom:3mm; }

/* ── Yazdırma başlık bandı ── */
/* ── Yazdırma başlık bandı ──────────────────────────────────── */
.ph-wrap {
  display:flex; justify-content:space-between; align-items:flex-start;
  border-bottom:2.5pt solid #0f172a;
  margin-bottom:6mm; padding-bottom:3mm;
  break-after:avoid; page-break-after:avoid;
  gap:8mm;
}
.ph-left  { flex:1 1 auto; min-width:0; }
.ph-right { flex:0 0 auto; text-align:right; }
.ph-school {
  font-size:7.5pt; font-weight:700; color:#475569;
  text-transform:uppercase; letter-spacing:.06em;
  margin-bottom:1.5mm;
}
.ph-title {
  font-size:15pt; font-weight:900; color:#0f172a;
  letter-spacing:-.025em; line-height:1.1;
}
.ph-sub {
  font-size:7.8pt; color:#64748b; margin-top:1.5mm;
  letter-spacing:.01em; line-height:1.4;
}
.ph-date {
  font-size:7.5pt; color:#64748b;
  white-space:nowrap; line-height:1.6;
  padding-top:1mm;
}

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
.content-disclosure > summary .disclosure-title {
  display:flex; align-items:center; gap:2mm;
  font-size:9.5pt; font-weight:800; color:#0f172a; letter-spacing:-.01em;
}
.content-disclosure > summary .disclosure-title i { display:none!important; }
.content-disclosure > summary .disclosure-meta {
  color:#64748b; font-size:7pt;
  padding:1px 4px; border:0.5pt solid #cbd5e1; border-radius:3px;
}
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
  border:var(--pt-border);
  border-radius:4px;
  background:#f8fafc!important;
  padding:2.5mm 3mm;
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
  border:var(--pt-border)!important; padding:2px 4px!important;
  vertical-align:middle; text-align:center; line-height:var(--pt-lh);
}
.prog-table thead th {
  background:var(--pt-head-bg)!important; font-size:var(--pt-fs-sm); font-weight:700;
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
  border:var(--pt-border)!important; padding:2mm 3mm!important; vertical-align:top;
  line-height:var(--pt-lh);
}
.settings-matrix thead th {
  background:var(--pt-head-bg)!important; font-size:var(--pt-fs-base); font-weight:700;
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
.daily-lesson-card  { border:var(--pt-border); padding:2mm; min-height:18mm; break-inside:avoid; }
.daily-lesson-card.has-lesson { border-left:2.5pt solid #1a56db; }
.daily-slot strong,.daily-slot span,.daily-slot small { display:block; line-height:1.1; }
.daily-slot strong { font-size:8.5pt; }
.daily-slot span   { font-size:7.5pt; font-weight:700; }
.daily-slot small  { font-size:6.5pt; color:#475569; }

/* ── soft-chip genel ── */
.soft-chip { display:inline-block; border:1px solid #94a3b8; border-radius:3px; padding:0 2mm; font-size:8pt; margin:1px; }
.free-hours-line,.free-hours-row { display:block; font-size:7.5pt; line-height:1.25; }
.free-hours-row + .free-hours-row { margin-top:.7mm; }
.free-hours-row strong { font-weight:800; }

/* ── section-title-row ── */
.section-title-row {
  display:flex; align-items:baseline; justify-content:space-between;
  border-bottom:var(--pt-border-h); margin-bottom:3mm; padding-bottom:1.5mm;
  break-after:avoid; page-break-after:avoid;
}
.section-title-row h4 { font-size:10.5pt; font-weight:900; margin:0; letter-spacing:-.01em; color:#0f172a; }
.section-title-row .small { font-size:7pt; color:#64748b; }
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
  const sheetTable        = root ? root.querySelector('.schedule-sheet') : null;
  const rawCellCount      = sheetTable ? Number(sheetTable.dataset.cellCount || 0) : 0;
  const isTeacherSheet    = root ? !!root.querySelector('.teacher-sheet') : (type === 'teacher-sheet');
  const isClassTransposed = root ? !!root.querySelector('.class-sheet-transposed') : false;
  const isMobile          = opts && opts.mobile;

  /* ── Kullanılabilir genişlik hesabı ──────────────────────────────
     Landscape A4: 297mm − 2×10mm kenar = 277mm
     Portrait  A4: 210mm − 2×10mm kenar = 190mm (transposed için)   */
  // Öğretmen çarşafında kenar payını 5mm'ye düşürüyoruz → 297-10=287mm kullanılabilir
  const pageW   = isTeacherSheet ? 287 : 277;   // mm
  const nameCol = isTeacherSheet ? 16 : (isClassTransposed ? 24 : 16);
  const dataW   = pageW - nameCol;
  const cells   = rawCellCount > 0 ? rawCellCount : 40;

  /* Her hücre için mm cinsinden genişlik (min 4.5mm, max 9mm) */
  const rawCW   = dataW / cells;
  const cellMm  = Math.min(9, Math.max(4.5, rawCW)).toFixed(2);
  const nameColW = nameCol + 'mm';
  const cellW    = cellMm + 'mm';

  /* Font boyutunu hücre genişliğine göre ölçekle */
  const contentFs = (rawCW >= 7) ? '5.5pt' : (rawCW >= 5.5) ? '4.8pt' : '4.1pt';
  const subFs     = (rawCW >= 7) ? '5pt'   : (rawCW >= 5.5) ? '4.3pt' : '3.8pt';
  const headFs    = (rawCW >= 7) ? '5.5pt' : '5pt';

  /* Satır yüksekliği: tüm satırlar eşit, içeriğe göre değil.
     Öğretmen çarşafında satır sayısı biliniyorsa, tüm tablo tek A4 landscape
     sayfasına sığacak şekilde rowH dinamik olarak kısıtlanır.
     Landscape A4 kullanılabilir yükseklik:
       210mm − 20mm kenar − 15mm başlık (meta+card-header+title+padding)
       − 9.5mm thead (5mm + 4.5mm) = 165.5mm veri alanı
     35 satır baz alınır; gerçek satır sayısı biliniyorsa ona göre hesaplanır. */
  const rowBaseH = (rawCW >= 7) ? 8 : (rawCW >= 5.5) ? 7 : 6; // mm
  let rowH = rowBaseH + 'mm';
  {
    const rowCount = (isTeacherSheet && sheetTable)
      ? (sheetTable.querySelectorAll('tbody tr').length || 35)
      : 35;
    if (isTeacherSheet) {
      const pageH      = 210;   // mm A4
      const marginH    = 10;    // 2×5mm kenar (öğretmen çarşafı için küçültüldü)
      const headerBand = 8;     // meta(~3mm) + card-header+title(~3mm) + boşluk(~2mm)
      const theadH     = 7.5;   // thead iki satır (4mm + 3.5mm)
      const availH     = pageH - marginH - headerBand - theadH;
      const dynH       = Math.floor((availH / rowCount) * 10) / 10; // 0.1mm hassasiyet
      const clampedH   = Math.min(rowBaseH, Math.max(4.0, dynH));
      rowH = clampedH.toFixed(1) + 'mm';
    }
  }

  return `
/* ════════════════════════════════════════
   ÇARŞAF (sheet-print) — yatay A4
   Hesaplanan: nameCol=${nameCol}mm  cellW=${cellMm}mm  cells=${cells}  rowH=${rowH}
   ════════════════════════════════════════ */
${isTeacherSheet ? '@page { size:'+orientation+'; margin:5mm; }' : ''}
.sheet-print { font-size:${contentFs}; }

/* Başlık bandı */
.sheet-print .card-header {
  padding:0; margin-bottom:1mm;
  border-bottom:var(--pt-border-top);
}
.sheet-print .card-title {
  font-size:8.5pt; font-weight:900; letter-spacing:-.01em; color:#0f172a; margin:0;
}
.sheet-print .card-title i,.sheet-print .card-header .text-muted { display:none; }
.sheet-print .print-meta { margin-bottom:1mm; font-size:6.5pt; }
.sheet-print .table-responsive { overflow:visible!important; }

/* Tablo genel */
.sheet-print .schedule-sheet {
  width:100%; table-layout:fixed; border-collapse:collapse;
}
.sheet-print .schedule-sheet thead { display:table-header-group; break-inside:avoid; break-after:avoid; }
.sheet-print .schedule-sheet thead br { display:none; }

/* Tüm hücreler */
.sheet-print .schedule-sheet th,
.sheet-print .schedule-sheet td {
  border:0.4pt solid #94a3b8!important;
  padding:.5mm .4mm!important;
  vertical-align:middle; text-align:center;
  height:${rowH}; max-height:${rowH};
  overflow:hidden; break-inside:avoid;
  line-height:1.15;
}

/* Gün başlığı (colspan) — daha belirgin */
.sheet-print .schedule-sheet thead tr:first-child th {
  background:#334155!important; color:#fff!important;
  font-size:${headFs}; font-weight:800; letter-spacing:.02em;
  border-color:#334155!important;
  height:4mm; min-height:4mm;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
/* Saat başlığı (1, 2, 3...) */
.sheet-print .schedule-sheet thead tr:nth-child(2) th {
  background:var(--pt-head-bg)!important; font-size:${headFs}; font-weight:700;
  height:3.5mm; min-height:3.5mm;
  border-bottom:var(--pt-border-h)!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}

/* Ad/sınıf sütunu */
.sheet-print .schedule-sheet .sheet-name {
  width:${nameColW}!important; min-width:${nameColW}!important; max-width:${nameColW}!important;
  text-align:left; white-space:normal; overflow:hidden;
  overflow-wrap:anywhere; word-break:break-word;
  border-right:var(--pt-border-h)!important;
  background:var(--pt-head-bg)!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-weight:700; font-size:${headFs};
  padding:.5mm 1mm!important;
}

/* İçerik hücresi */
.sheet-print .sheet-cell-content strong,
.sheet-print .sheet-cell-content span { display:block; overflow:hidden; }
.sheet-print .sheet-cell-content strong {
  font-size:${contentFs}; font-weight:800; line-height:1.2;
  white-space:normal; overflow-wrap:anywhere;
}
.sheet-print .sheet-cell-content span {
  font-size:${subFs}; font-weight:600; line-height:1.15;
  color:#475569; margin-top:.2mm;
  white-space:normal; overflow-wrap:anywhere;
}

/* Öğretmen çarşafı — ad sütunu kodu */
.sheet-print .teacher-sheet .sheet-teacher-code {
  display:block; font-size:${contentFs}; font-weight:800; line-height:1.2;
  overflow-wrap:anywhere; white-space:normal;
}

/* Sınıf çarşafı */
.sheet-print .class-sheet .sheet-name { text-align:center; }
.sheet-print .class-sheet tbody br    { display:block; }
.sheet-print .class-sheet tbody small { display:block; margin-left:0; font-size:${subFs}; }
.sheet-print .schedule-sheet small    { font-size:${subFs}; display:inline; color:#334155; margin-left:1px; }

/* Transpozisyon */
.sheet-print .class-sheet-transposed .sheet-day-cell {
  width:13mm!important; min-width:13mm!important; max-width:13mm!important;
  text-align:left!important; font-weight:800; border-right:var(--pt-border-h)!important;
  background:var(--pt-head-bg)!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet-print .class-sheet-transposed .sheet-hour-cell {
  width:9mm!important; min-width:9mm!important; max-width:9mm!important;
  text-align:center!important; font-weight:700;
}
.sheet-print .class-sheet-transposed .sheet-hour-cell small {
  display:block; margin:0; font-size:${subFs}; line-height:1.1; color:#334155;
}

/* Veri hücreleri genişliği */
.sheet-print .teacher-sheet td,
.sheet-print .teacher-sheet thead tr:nth-child(2) th { width:${cellW}; max-width:${cellW}; }
.sheet-print .class-sheet td,
.sheet-print .class-sheet thead tr:nth-child(2) th   { width:${cellW}; max-width:${cellW}; }
.sheet-print .class-sheet-transposed .sheet-class-head,
.sheet-print .class-sheet-transposed td.sheet-filled,
.sheet-print .class-sheet-transposed td.sheet-empty  { width:${cellW}; max-width:${cellW}; }

/* Dolu/boş hücre */
.sheet-print .sheet-filled,.sheet-print .sheet-empty { min-width:0!important; }
.sheet-print .sheet-empty {
  background:#f8fafc!important; color:#cbd5e1;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}

/* Zebra — çift satır hafif gri */
.sheet-print .schedule-sheet tbody tr:nth-child(even) td,
.sheet-print .schedule-sheet tbody tr:nth-child(even) th {
  background:#f5f7fa!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet-print .sheet-filled {
  background:#fff!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet-print .schedule-sheet tbody tr:nth-child(even) .sheet-filled { background:#f0f4ff!important; }

/* Nöbet günü vurgu */
.sheet-print .duty-sheet { outline:.7pt solid #d97706; outline-offset:-1px; }

/* Mobil baskı — biraz daha küçük */
.sheet-print.mobile-print .schedule-sheet th,
.sheet-print.mobile-print .schedule-sheet td {
  padding:.25mm .3mm!important; height:5.5mm; min-height:5.5mm;
}
.sheet-print.mobile-print .sheet-cell-content strong { font-size:3.8pt; }
.sheet-print.mobile-print .sheet-cell-content span   { font-size:3.4pt; }
.sheet-print.mobile-print .class-sheet tbody small   { font-size:3.4pt; }
.sheet-print.mobile-print .class-sheet-transposed .sheet-day-cell  { width:10mm!important; min-width:10mm!important; max-width:10mm!important; font-size:3.8pt; }
.sheet-print.mobile-print .class-sheet-transposed .sheet-hour-cell { width:7.5mm!important; min-width:7.5mm!important; max-width:7.5mm!important; font-size:3.5pt; }
.sheet-print.mobile-print .class-sheet-transposed .sheet-hour-cell small { font-size:3pt; }
.sheet-print.mobile-print .class-sheet .sheet-name { font-size:4pt; }
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
  border:var(--pt-border)!important; padding:2px 3px!important;
  text-align:center; vertical-align:middle; line-height:var(--pt-lh);
  height:var(--pt-cell-h); min-height:var(--pt-cell-h);
}
.program-list-print .teacher-program-board thead th,
.program-list-print .class-program-board thead th {
  background:var(--pt-head-bg)!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.program-list-print .teacher-program-board th:first-child,
.program-list-print .class-program-board th:first-child,
.program-list-print .teacher-program-board td:first-child,
.program-list-print .class-program-board td:first-child {
  text-align:left; border-right:var(--pt-border-h)!important;
}
.program-list-print .teacher-program-board thead,
.program-list-print .class-program-board thead { display:table-header-group; }
.program-list-print .print-program-section {
  border-top:1px solid #dbe3ef; padding-top:1.5mm; margin-bottom:4mm;
  break-inside:avoid; page-break-inside:avoid;
}
.program-list-print .print-program-section:first-child { border-top:0; padding-top:0; }
.program-list-print .print-program-head {
  display:flex; justify-content:space-between; align-items:baseline; gap:4mm;
  margin-bottom:1.5mm; break-after:avoid; page-break-after:avoid;
}
.program-list-print .print-program-title {
  font-size:9.5pt; font-weight:900; color:#0f172a; letter-spacing:-.01em;
}
.program-list-print .print-program-meta {
  font-size:7pt; color:#64748b; white-space:nowrap;
  padding:1px 4px; border:0.5pt solid #cbd5e1; border-radius:3px;
}
.program-list-print.mobile-print .print-program-section { margin-bottom:3mm; break-inside:auto; page-break-inside:auto; }
.program-list-print.mobile-print .print-program-title { font-size:7.5pt; }
.program-list-print.mobile-print .print-program-meta { font-size:6pt; }
.program-list-print.mobile-print .teacher-program-board,
.program-list-print.mobile-print .class-program-board,
.program-list-print.mobile-print .prog-table { font-size:5.8pt; line-height:1; }
.program-list-print.mobile-print .teacher-program-board th,
.program-list-print.mobile-print .teacher-program-board td,
.program-list-print.mobile-print .class-program-board th,
.program-list-print.mobile-print .class-program-board td,
.program-list-print.mobile-print .prog-table th,
.program-list-print.mobile-print .prog-table td { padding:.45px 1px!important; line-height:1; }
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
  border:var(--pt-border)!important; padding:var(--pt-pad-td)!important;
  vertical-align:middle; font-size:var(--pt-fs-base); line-height:var(--pt-lh);
}
.entry-print .schedule-entry-table thead th {
  background:var(--pt-head-bg)!important; font-weight:700; text-align:left;
  padding:var(--pt-pad-th)!important;
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
   Sütunlar: #(1) Ad+TC(2) Branş(3) Tel(4) Email(5) Sınıf(6) Nöbet(7) Ders(8) Görev(9)
   ════════════════════════════════════════ */
.teacher-list-print { font-size:var(--pt-fs-base); }
.teacher-list-print .card { border:0; break-inside:auto; page-break-inside:auto; }
.teacher-list-print .card-header {
  padding:0 0 2.5mm; margin-bottom:4mm;
  border-bottom:var(--pt-border-top);
}
.teacher-list-print .card-title { font-size:11pt; font-weight:900; letter-spacing:-.01em; color:#0f172a; }
.teacher-list-print .table-responsive { overflow:visible!important; }
/* Sabit genişlikler: landscape A4 ≈ 277mm kullanılabilir */
.teacher-list-print .table { table-layout:fixed; }
.teacher-list-print .table th:nth-child(1), .teacher-list-print .table td:nth-child(1) { width:7mm;  text-align:center; }
.teacher-list-print .table th:nth-child(2), .teacher-list-print .table td:nth-child(2) { width:52mm; }
.teacher-list-print .table th:nth-child(3), .teacher-list-print .table td:nth-child(3) { width:30mm; }
.teacher-list-print .table th:nth-child(4), .teacher-list-print .table td:nth-child(4) { width:28mm; }
.teacher-list-print .table th:nth-child(5), .teacher-list-print .table td:nth-child(5) { width:38mm; }
.teacher-list-print .table th:nth-child(6), .teacher-list-print .table td:nth-child(6) { width:18mm; text-align:center; }
.teacher-list-print .table th:nth-child(7), .teacher-list-print .table td:nth-child(7) { width:28mm; }
.teacher-list-print .table th:nth-child(8), .teacher-list-print .table td:nth-child(8) { width:12mm; text-align:center; }
.teacher-list-print .table th:nth-child(9), .teacher-list-print .table td:nth-child(9) { width:12mm; text-align:center; }
/* TC kimlik sütunu her zaman görünür */
.teacher-list-print .table .tc-print-col { display:table-cell!important; }
/* Ad Soyad hücresinde TC küçük satırda */
.teacher-list-print .table td:nth-child(2) small { display:block; font-size:6.5pt; color:#64748b; margin-top:0.5mm; }
.teacher-list-print .table .tc-screen-mask { display:none!important; }
.teacher-list-print .table .tc-print-full  { display:block!important; font-size:6.5pt; color:#64748b; }
/* Zebra */
.teacher-list-print .table tbody tr:nth-child(odd) td { background:#ffffff!important; }

/* Mobil baskı: #(1) Ad(2) TC(3) Branş(4) Tel(5) [Email(6) gizli] Sınıf(7) Nöbet(8) Ders(9) Görev(10) */
.teacher-list-print.mobile-print .table {
  table-layout:fixed; font-size:var(--pt-fs-xs); width:100%;
}
.teacher-list-print.mobile-print .table th,
.teacher-list-print.mobile-print .table td {
  padding:.8px 1.5px!important; line-height:1.05; overflow-wrap:anywhere; word-break:break-word;
}
.teacher-list-print.mobile-print .table th:nth-child(1),
.teacher-list-print.mobile-print .table td:nth-child(1) { width:5mm; }
.teacher-list-print.mobile-print .table th:nth-child(2),
.teacher-list-print.mobile-print .table td:nth-child(2) { width:27mm; }
.teacher-list-print.mobile-print .table th:nth-child(3),
.teacher-list-print.mobile-print .table td:nth-child(3) { width:22mm; }
.teacher-list-print.mobile-print .table th:nth-child(4),
.teacher-list-print.mobile-print .table td:nth-child(4) { width:22mm; }
.teacher-list-print.mobile-print .table th:nth-child(5),
.teacher-list-print.mobile-print .table td:nth-child(5) { width:20mm; }
.teacher-list-print.mobile-print .table th:nth-child(6),
.teacher-list-print.mobile-print .table td:nth-child(6) { width:24mm; }
.teacher-list-print.mobile-print .table th:nth-child(7),
.teacher-list-print.mobile-print .table td:nth-child(7) { width:14mm; }
.teacher-list-print.mobile-print .table th:nth-child(8),
.teacher-list-print.mobile-print .table td:nth-child(8) { width:14mm; }
.teacher-list-print.mobile-print .table th:nth-child(9),
.teacher-list-print.mobile-print .table td:nth-child(9) { width:8mm; }
.teacher-list-print.mobile-print .table th:nth-child(10),
.teacher-list-print.mobile-print .table td:nth-child(10) { width:8mm; }
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
  border:var(--pt-border); border-radius:4px; background:#f8fafc!important;
  padding:2.5mm 3mm; min-height:12mm; margin:0; break-inside:avoid;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .info-line span,
.profile-print .profile-info span {
  font-size:6.2pt; color:#64748b; display:block; text-transform:uppercase;
  letter-spacing:.05em; margin-bottom:1mm; font-weight:600;
}
.profile-print .info-line strong,
.profile-print .profile-info strong {
  font-size:9pt; line-height:1.2; display:block; overflow-wrap:anywhere; color:#0f172a;
}
.profile-print .teacher-weekly-scroll,.profile-print .table-responsive { overflow:visible!important; }
.profile-print .prog-table { width:100%; font-size:7pt; table-layout:fixed; border-collapse:collapse; }
.profile-print .prog-table th,
.profile-print .prog-table td {
  border:var(--pt-border)!important; padding:2px 3px!important;
  text-align:center; vertical-align:middle;
  height:var(--pt-cell-h); min-height:var(--pt-cell-h);
}
.profile-print .prog-table thead th {
  background:var(--pt-head-bg)!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .prog-table thead { display:table-header-group; }
.profile-print .section-body-actions { display:none!important; }
.profile-print .btn-tc-reveal   { display:none!important; }
.profile-print .tc-field::before { content:attr(data-tc); font-size:9pt; font-weight:700; display:block; }
.profile-print .tc-display      { display:none!important; }
.profile-print .free-slot-grid  { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:2mm; }
.profile-print .free-day {
  border:var(--pt-border); border-radius:4px; background:#f8fafc!important;
  padding:2.5mm 2mm; min-height:14mm; break-inside:avoid;
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
  display:flex; gap:6mm; border:var(--pt-border); padding:2mm 4mm; border-radius:4px;
}
.profile-print .duty-profile-box span   { display:block; font-size:7.5pt; color:#64748b; }
.profile-print .duty-profile-box strong { display:block; font-size:9pt; }
/* teachers type — öğretmen listesi tablosu */
.profile-print .table { width:100%; border-collapse:collapse; font-size:8.5pt; }
.profile-print .table th,.profile-print .table td {
  border:var(--pt-border)!important; padding:var(--pt-pad-td)!important; vertical-align:middle;
}
.profile-print .table thead th {
  background:var(--pt-head-bg)!important; font-weight:700;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.profile-print .table thead { display:table-header-group; }
.profile-print .table tbody tr { break-inside:avoid; page-break-inside:avoid; }
.profile-print .table-responsive { overflow:visible!important; }
.profile-print.mobile-print { font-size:8pt; }
.profile-print.mobile-print .ph-wrap { margin-bottom:3mm; padding-bottom:1.5mm; }
.profile-print.mobile-print .profile-disclosures { padding:0!important; }
.profile-print.mobile-print .content-disclosure { break-inside:auto; page-break-inside:auto; }
.profile-print.mobile-print .content-disclosure > .disclosure-body { padding:2mm 0; }
.profile-print.mobile-print .profile-info-grid-print { grid-template-columns:repeat(2,minmax(0,1fr)); gap:2mm!important; }
.profile-print.mobile-print .profile-info { min-height:10mm; padding:1.8mm 2mm; }
.profile-print.mobile-print .profile-info strong { font-size:7.8pt; }
.profile-print.mobile-print .prog-table { font-size:6.2pt; }
.profile-print.mobile-print .prog-table th,
.profile-print.mobile-print .prog-table td { padding:1px 2px!important; line-height:1.05; }
.profile-print.mobile-print .free-slot-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
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
.duty-print { font-size:var(--pt-fs-base); }
.duty-print .duty-matrix {
  width:100%; border-collapse:collapse; table-layout:fixed;
}
.duty-print .duty-matrix th,
.duty-print .duty-matrix td {
  border:var(--pt-border)!important;
  padding:2.5mm 3mm!important;
  vertical-align:middle; line-height:var(--pt-lh);
  height:var(--pt-cell-h); min-height:var(--pt-cell-h);
}
.duty-print .duty-matrix thead th {
  background:var(--pt-head-bg)!important;
  font-size:var(--pt-fs-base); font-weight:700; text-align:center;
  border-bottom:var(--pt-border-h)!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  white-space:nowrap;
}
.duty-print .duty-matrix thead { display:table-header-group; break-inside:avoid; break-after:avoid; }
.duty-print .duty-matrix tbody tr { break-inside:avoid; page-break-inside:avoid; }
.duty-print .duty-matrix tbody tr:nth-child(even) td { background:var(--pt-row-alt)!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.duty-print .duty-place-head { text-align:left!important; font-weight:800; white-space:normal; border-right:var(--pt-border-h)!important; width:22mm; }
.duty-print .duty-filled-cell { background:#dbeafe!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.duty-print .duty-empty-cell  { color:#cbd5e1; text-align:center; }
.duty-print .duty-cell strong { display:block; font-size:var(--pt-fs-base); font-weight:700; }
.duty-print .duty-cell span   { display:block; font-size:var(--pt-fs-sm); color:#475569; }
.duty-print.mobile-print .duty-matrix { table-layout:fixed; width:100%; font-size:var(--pt-fs-xs); }
.duty-print.mobile-print .duty-matrix th,
.duty-print.mobile-print .duty-matrix td { padding:1mm .6mm!important; line-height:1.05; }
.duty-print.mobile-print .duty-matrix thead th { font-size:var(--pt-fs-xs); }
.duty-print.mobile-print .duty-place-head { width:18mm; min-width:18mm; max-width:18mm; font-size:var(--pt-fs-xs); white-space:normal; }
.duty-print.mobile-print .duty-cell strong { font-size:var(--pt-fs-xs); line-height:1; }
.duty-print.mobile-print .duty-cell span { display:none; }
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
.tasks-print { font-size:var(--pt-fs-base); }
.tasks-print .chip-wrap { display:none!important; }
.tasks-print .card-header {
  padding:0 0 2.5mm; margin-bottom:4mm;
  border-bottom:var(--pt-border-top);
}
.tasks-print .card-title { font-size:11pt; font-weight:900; letter-spacing:-.01em; color:#0f172a; }
.tasks-print .table-responsive { overflow:visible!important; }
.tasks-print .table-actions { display:none!important; }
/* Sabit genişlikler: landscape A4 ≈ 277mm */
.tasks-print .table { table-layout:fixed; }
.tasks-print .table th:nth-child(1), .tasks-print .table td:nth-child(1) { width:40mm; }
.tasks-print .table th:nth-child(2), .tasks-print .table td:nth-child(2) { width:40mm; }
.tasks-print .table th:nth-child(3), .tasks-print .table td:nth-child(3) { width:60mm; }
.tasks-print .table th:nth-child(4), .tasks-print .table td:nth-child(4) { width:55mm; }
.tasks-print .table th:nth-child(5), .tasks-print .table td:nth-child(5) { width:22mm; text-align:center; }
.tasks-print .table th:nth-child(6), .tasks-print .table td:nth-child(6) { width:22mm; text-align:center; }
/* Öğretmen hücresinde branş alt satırda */
.tasks-print .table td:nth-child(1) small { display:block; font-size:6.5pt; color:#64748b; }
.tasks-print.mobile-print .table { font-size:var(--pt-fs-xs); }
.tasks-print.mobile-print .table th,
.tasks-print.mobile-print .table td { padding:.8px 1.5px!important; line-height:1.05; }
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
  border:var(--pt-border); padding:2.5mm 3mm; min-width:40mm; font-size:var(--pt-fs-base);
  break-inside:avoid; border-radius:4px; background:#f8fafc!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.free-print .free-query-card strong { display:block; font-size:9pt; font-weight:800; color:#0f172a; }
.free-print .free-query-card span   { display:block; font-size:var(--pt-fs-sm); color:#475569; margin-top:.5mm; }
.free-print .free-query-card small  { display:block; font-size:7pt; color:#64748b; margin-top:1mm; }
.free-print .free-report-note { font-size:8pt; color:#475569; margin-bottom:3mm; }
.free-print .free-day-overview { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:3mm; }
.free-print .free-day-summary {
  border:var(--pt-border); padding:2.5mm 3mm; min-width:38mm; break-inside:avoid;
  border-radius:4px; background:#f8fafc!important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.free-print .free-day-summary strong { display:block; font-weight:800; font-size:9pt; color:#0f172a; }
.free-print .free-day-summary span   { display:block; font-size:var(--pt-fs-sm); color:#64748b; margin-bottom:1mm; }
.free-print .free-slot-grid { display:flex; flex-wrap:wrap; gap:2mm; }
.free-print .table-responsive { overflow:visible!important; }
.free-print .table { width:100%; border-collapse:collapse; }
.free-print .table th,.free-print .table td {
  border:var(--pt-border)!important; padding:var(--pt-pad-td)!important; font-size:var(--pt-fs-base);
}
.free-print .table thead th {
  background:var(--pt-head-bg)!important; font-weight:700;
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
   7. YAZDIRMA MOTORU — MOBİL: yeni pencere / MASAÜSTÜ: gizli iframe
   ────────────────────────────────────────────────────────────── */

/**
 * Yazdırma hedefini açar (HTML yazmaz — yalnızca hedefi oluşturur/döndürür).
 * Mobil/dokunmatik cihazlarda: window.open (yeni sekme/pencere) — ana sistem xPR() yaklaşımı.
 * Masaüstünde: gizli iframe — mevcut davranış korunur.
 *
 * @param {boolean} [forceMobile] - Test için zorla mobil mod
 * @returns {{ type: 'win'|'iframe', ref: Window|HTMLIFrameElement }|null}
 */
function openPrintFrame(forceMobile) {
  const useMobile = (forceMobile === true) || isMobilePrintDevice();

  if (useMobile) {
    // ── MOBİL: yeni pencere/sekme ──────────────────────────────
    const printWin = window.open('', '_blank', 'width=900,height=820,scrollbars=yes');
    if (!printWin) {
      if (typeof showToast === 'function') {
        showToast('Açılır pencere engellendi! Tarayıcı ayarlarından izin verin.', 'warning', 6000);
      }
      return null;
    }
    return { type: 'win', ref: printWin };
  }

  // ── MASAÜSTÜ: gizli iframe ───────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;';
  document.body.appendChild(iframe);
  return { type: 'iframe', ref: iframe };
}

/**
 * Yazdırma hedefine HTML yazar, yüklenmeyi bekler, yazdırır ve temizler.
 * HTML yazma + bekleme + print tek bu fonksiyonda yönetilir; çift tetiklenme engellenir.
 *
 * @param {{ type: 'win'|'iframe', ref: Window|HTMLIFrameElement }} handle
 * @param {string}   printHtml      - Tam HTML belgesi
 * @param {Function} [onAfterPrint] - Yazdırma/kapanma sonrası opsiyonel callback
 */
function printFrameAndCleanup(handle, printHtml, onAfterPrint) {
  if (!handle || !handle.ref) return;

  const _done = typeof onAfterPrint === 'function' ? onAfterPrint : () => {};

  if (handle.type === 'win') {
    // ── MOBİL: yeni pencere modu ────────────────────────────────
    const printWin = handle.ref;

    try {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } catch(err) {
      if (typeof showToast === 'function') showToast('Yazdırma penceresi hazırlanamadı.', 'error', 4000);
      try { printWin.close(); } catch(e) {}
      _done();
      return;
    }

    // Yüklemeyi bekle → yazdır.
    // setupDone: load + timeout'un ikisi de tetiklenirse sadece ilki çalışır.
    let setupDone = false;
    let printed = false;

    const doPrint = () => {
      if (printed) return;
      printed = true;
      try { printWin.print(); } catch(e) {}
      setTimeout(_done, 500);
    };

    const waitAndPrint = () => {
      if (setupDone) return;
      setupDone = true;

      const waitImages = () => Promise.all(
        Array.prototype.slice.call(printWin.document.images || []).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        })
      );
      const waitFonts = () =>
        (printWin.document.fonts && printWin.document.fonts.ready)
          ? printWin.document.fonts.ready.catch(() => {})
          : Promise.resolve();

      Promise.all([waitImages(), waitFonts()]).then(() => setTimeout(doPrint, 250));
      setTimeout(doPrint, 2500); // güvenlik: Promise resolve olmazsa bile yazdır
    };

    try { printWin.addEventListener('load', waitAndPrint, { once: true }); } catch(e) {}
    setTimeout(waitAndPrint, 900); // iOS/Android'de load bazen ateşlenmiyor

    return;
  }

  // ── MASAÜSTÜ: iframe modu ────────────────────────────────────
  const iframe = handle.ref;
  if (!iframe) { _done(); return; }

  // HTML yaz
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
  } catch(err) {
    try { iframe.remove(); } catch(e) {}
    _done();
    return;
  }

  // iframe hazır bekleme: load + timeout fallback (ikisi de tetiklenirse sadece ilki çalışır)
  let iframeReady = false;

  const fireIframePrint = () => {
    if (iframeReady) return;
    iframeReady = true;

    const win = iframe.contentWindow;
    if (!win) { try { iframe.remove(); } catch(e) {} _done(); return; }

    let cleaned = false;
    const fallback = setTimeout(cleanup, 8000);

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(fallback);
      try { iframe.remove(); } catch(e) {}
      _done();
    }

    try { win.addEventListener('afterprint', cleanup, { once: true }); } catch(e) {}

    // rAF + küçük gecikme — render tamamlanmadan print() çağrılmasını önler
    const raf = win.requestAnimationFrame || window.requestAnimationFrame || (fn => setTimeout(fn, 16));
    raf(() => setTimeout(() => {
      win.focus();
      try { win.print(); } catch(e) { cleanup(); }
    }, 100));
  };

  try { iframe.addEventListener('load', fireIframePrint, { once: true }); } catch(e) {}
  setTimeout(fireIframePrint, 500); // load ateşlenmezse fallback
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

  // is-printing class — @media print fallback için
  document.body.classList.add('is-printing');
  document.body.dataset.printTarget = opts.sourceId || '';

  const _cleanupBodyClass = () => {
    document.body.classList.remove('is-printing');
    delete document.body.dataset.printTarget;
  };

  try {
    // Body class
    let bodyClass = resolveBodyClass(opts.type);
    if (!bodyClass) {
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
    if (isMobilePrintDevice()) {
      bodyClass = `${bodyClass} mobile-print`.trim();
    }

    // Sayfa yönü
    const orientation = resolvePrintOrientation(opts.type, opts.orientation, root, opts.sourceId);
    // Landscape uyarısı: yazdırma ÖNCE değil, SONRA gösterilecek
    const _shouldWarnLandscape = shouldWarnForLandscapePrint(opts.type, orientation);

    // CSS
    const css = buildPrintCss(opts.type, orientation, root, opts);

    // Başlık meta
    const meta = getAutoMetaSafe(opts.type, opts.sourceId, root);
    if (opts.title && ['tasks', 'teachers'].includes(opts.type)) meta.title = opts.title;
    if (!meta.title && opts.title) meta.title = opts.title;
    const headerHtml = buildPrintHeader(meta, root);

    // DOM hazırlık
    const rootClone = root.cloneNode(true);
    expandScrollableAreas(rootClone);
    openDisclosureForPrint(rootClone);
    prepareProfileProgramForPrint(rootClone, opts);
    normalizeProgramListForPrint(rootClone, opts);
    dedupePrintHeadings(rootClone, meta);
    markHiddenForPrint(rootClone);  // güçlendirilmiş klon temizliği

    // Güvenli escapeHtml
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s));
    const printTitle = esc(meta.title || opts.title || 'Yazdır');
    const browserPrintTitle = opts.type === 'teacher-profile' ? '&#8203;' : printTitle;

    const printHtml = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${browserPrintTitle}</title><style>${css}</style></head><body class="${bodyClass}">${headerHtml}${rootClone.outerHTML}</body></html>`;

    const handle = openPrintFrame();
    if (!handle) {
      // Pencere açılamadı (popup engeli vb.)
      setPrintButtonBusy(opts.button, false);
      _cleanupBodyClass();
      return;
    }

    const _onAfterPrint = () => {
      setPrintButtonBusy(opts.button, false);
      _cleanupBodyClass();
      // Landscape uyarısını yazdırma SONRASI göster
      if (_shouldWarnLandscape) notifyLandscapePrintHintAfterPrint(opts.type);
    };

    printFrameAndCleanup(handle, printHtml, _onAfterPrint);
    // iframe modunda buton hemen serbest; yeni pencere modunda _onAfterPrint halleder
    if (handle.type === 'iframe') {
      setPrintButtonBusy(opts.button, false);
    }

    // Güvenlik: buton ve body class takılı kalmasın
    setTimeout(() => {
      setPrintButtonBusy(opts.button, false);
      _cleanupBodyClass();
    }, 10000);

  } catch (err) {
    setPrintButtonBusy(opts.button, false);
    _cleanupBodyClass();
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
