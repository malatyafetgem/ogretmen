/* ============================================================
   teacher-print.js  —  Öğretmen Bilgi Sistemi Yazdırma Motoru
   v3 — Tüm statik CSS kuralları teacher-style.css'e taşındı.
   JS yalnızca mantık + çarşaf için tek dinamik CSS hesabı içerir.
   ============================================================

   MİMARİ (v3)
   ───────────
   • window.open tabanlı; ana CSS dosyaları (Bootstrap, Font-Awesome,
     teacher-style.css) otomatik bağlanır — collectPageStylesheets().
   • Statik print CSS (başlık bandı, print-title-row, mobil modlar)
     tamamen teacher-style.css @media print bloğuna taşındı.
   • JS'de kalan tek CSS üretimi: çarşaf hücre genişliği (buildSheetCellCss).
     Bu değer data-cell-count runtime attribute'una bağlı olduğundan
     statik CSS'e yazılamaz.
   • Mobil mod: detectPrintDevice() → body.print-tablet / body.print-phone
     class'ı yazdırma penceresine eklenir; kurallar CSS'te tanımlıdır.
   • print-title-row: injectPrintTitleRows() tüm tablolara ekler;
     görünürlük kuralı CSS'tedir.
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. SEÇENEK NORMALİZASYON
   ────────────────────────────────────────────────────────────── */

function normalizePrintOptions(options) {
  if (!options || typeof options !== 'object') options = {};
  return {
    sourceId   : options.sourceId    || '',
    type       : options.type        || '',
    title      : options.title       || 'Yazdır',
    orientation: options.orientation || 'auto',
    button     : options.button      || null,
  };
}

/* ──────────────────────────────────────────────────────────────
   2. SAYFA YÖNETİMİ
   ────────────────────────────────────────────────────────────── */

function resolveBodyClass(type) {
  const map = {
    'teacher-sheet'  : 'sheet-print',
    'class-sheet'    : 'sheet-print',
    'teacher-profile': 'profile-print',
    'class-profile'  : 'profile-print',
    'teachers'       : 'teacher-list-print',
    'duty'           : 'duty-print',
    'tasks'          : 'tasks-print',
    'entry-list'     : 'entry-print',
    'program-list'   : 'program-list-print',
    'free'           : 'free-print',
    'schedule'       : '',
  };
  return map[type] || '';
}

function resolvePrintOrientation(type, requested, root) {
  if (requested === 'portrait')  return 'A4 portrait';
  if (requested === 'landscape') return 'A4 landscape';

  if (type === 'teacher-profile') {
    const mode = (typeof currentProgramMode !== 'undefined') ? currentProgramMode : '';
    if (mode !== 'day') return 'A4 landscape';
  }
  if ([
    'teacher-sheet', 'class-sheet', 'program-list',
    'entry-list', 'teachers', 'duty', 'tasks', 'class-profile',
  ].includes(type)) return 'A4 landscape';

  if (root && root.querySelector('.schedule-sheet'))     return 'A4 landscape';
  if (root && shouldUseLandscapeForPrint(root))          return 'A4 landscape';
  return 'A4 portrait';
}

function shouldUseLandscapeForPrint(root) {
  if (!root) return false;
  if (root.querySelector('.prog-table, .teacher-program-board, .class-program-board, .duty-matrix')) return true;
  return Array.from(root.querySelectorAll('table')).some(tbl => {
    const headRow = tbl.querySelector('thead tr:last-child') || tbl.querySelector('tr');
    if (!headRow) return false;
    const count = Array.from(headRow.children)
      .reduce((s, c) => s + Number(c.getAttribute('colspan') || 1), 0);
    return count >= 5;
  });
}

/* ──────────────────────────────────────────────────────────────
   3. MOBİL TESPİT
   ────────────────────────────────────────────────────────────── */

/**
 * Ekran genişliğine göre yazdırma cihaz modunu döndürür.
 * Dönen değer, yazdırma penceresinin body'sine class olarak eklenir.
 * CSS kuralları teacher-style.css'te body.print-tablet / body.print-phone
 * seçicileriyle tanımlıdır.
 * @returns {'phone'|'tablet'|'desktop'}
 */
function detectPrintDevice() {
  const w = window.innerWidth || document.documentElement.clientWidth || 1280;
  if (w <= 480) return 'phone';
  if (w <= 768) return 'tablet';
  return 'desktop';
}

/* ──────────────────────────────────────────────────────────────
   4. DOM HAZIRLIK FONKSİYONLARI
   ────────────────────────────────────────────────────────────── */

function markHiddenForPrint(root) {
  if (!root) return;
  root.querySelectorAll('.schedule-health, .obs-toast, .page-actions').forEach(el => {
    el.classList.add('print-hidden');
  });
}

function expandScrollableAreas(root) {
  if (!root) return;
  root.querySelectorAll('.table-responsive, .teacher-weekly-scroll, .sheet-scroll').forEach(el => {
    el.style.overflow  = 'visible';
    el.style.maxHeight = 'none';
  });
}

function openDisclosureForPrint(root) {
  if (!root) return;
  root.querySelectorAll('details.content-disclosure').forEach(el => {
    el.setAttribute('open', '');
  });
}

function prepareProfileProgramForPrint(root, opts) {
  if (!root || !opts) return;
  try {
    if (opts.type === 'teacher-profile') {
      const section = root.querySelector('#teacherProgramSection');
      const id      = (typeof selectedTeacherId !== 'undefined') ? selectedTeacherId : '';
      const t       = id && typeof teacherById === 'function' ? teacherById(id) : null;
      const mode    = (typeof currentProgramMode !== 'undefined') ? currentProgramMode : '';
      if (section && t && mode !== 'day' &&
          typeof buildTeacherProfileSchedule === 'function' &&
          typeof teacherLessons === 'function') {
        section.innerHTML = `<div class="program-section-content">${buildTeacherProfileSchedule(t, teacherLessons(id))}</div>`;
        const meta = section.closest('details')?.querySelector('.disclosure-meta');
        if (meta) meta.textContent = 'Haftalık Program';
      }
      root.querySelectorAll('.program-filter-inline, .program-mode-btns').forEach(el =>
        el.classList.add('print-hidden'));
      return;
    }
    if (opts.type === 'class-profile') {
      const daily  = root.querySelector('details.content-disclosure[data-section-key*="-daily-"]');
      const weekly = root.querySelector('details.content-disclosure[data-section-key*="-weekly"]');
      if (weekly) weekly.setAttribute('open', '');
      if (daily)  daily.classList.add('print-hidden');
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

function dedupePrintHeadings(root, meta) {
  if (!root || !meta || !meta.title) return;
  const key = normalizePrintHeadingText(meta.title);
  if (!key) return;
  root.querySelectorAll('.card-header').forEach(header => {
    const title = header.querySelector('.card-title');
    if (title && normalizePrintHeadingText(title.textContent) === key)
      header.classList.add('print-hidden');
  });
}

/* ──────────────────────────────────────────────────────────────
   5. PRINT-TITLE-ROW — TÜM TABLOLARDA SAYFA BAŞI BAŞLIK TEKRARI
   ────────────────────────────────────────────────────────────── */

/**
 * Klonlanan DOM içindeki her tabloya print-title-row ekler.
 * Görünürlük kuralı teacher-style.css @media print bloğundadır.
 * @param {Element} root
 */
function injectPrintTitleRows(root) {
  if (!root) return;
  root.querySelectorAll('table').forEach(tbl => {
    const thead = tbl.querySelector('thead');
    if (!thead) return;
    if (thead.querySelector('tr.print-title-row')) return;

    const originalRows = Array.from(thead.querySelectorAll('tr:not(.print-title-row)'));
    if (!originalRows.length) return;

    originalRows.forEach(row => {
      const clone = row.cloneNode(true);
      clone.classList.add('print-title-row');
      clone.style.display = 'none'; // ekranda gizli; CSS ile print'te gösterilir
      thead.appendChild(clone);
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   6. META / BAŞLIK BİLGİSİ TOPLAMA
   ────────────────────────────────────────────────────────────── */

function getSchedulePrintMetaSafe() {
  try {
    const titleEl  = document.querySelector('#schedulePrintArea .card-title');
    const title    = titleEl ? titleEl.textContent.trim() : 'Ders Programı';
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

function getTeacherProfileMetaSafe(root) {
  try {
    if (root && !root.querySelector('.card-header')) {
      const id = (typeof selectedTeacherId !== 'undefined') ? selectedTeacherId : null;
      const t  = (id && typeof teacherById === 'function') ? teacherById(id) : null;
      return {
        name  : t ? (typeof teacherName === 'function' ? teacherName(t) : '') : 'Öğretmen Profili',
        branch: t ? (t.branch || '') : '',
      };
    }
    const h = root ? root.querySelector('.card-header .card-title') : null;
    return { name: h ? h.textContent.trim() : 'Profil', branch: '' };
  } catch (e) {
    return { name: 'Profil', branch: '' };
  }
}

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
    const titleEl = root ? root.querySelector('.card-title') : null;
    return { title: titleEl ? titleEl.textContent.trim() : '', sub: '' };
  } catch (e) {
    return { title: '', sub: '' };
  }
}

/* ──────────────────────────────────────────────────────────────
   7. BAŞLIK BANDI HTML
   ────────────────────────────────────────────────────────────── */

function buildPrintHeader(opts) {
  const printDate = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const esc = (typeof escapeHtml === 'function')
    ? escapeHtml
    : s => String(s).replace(/[&<>"']/g, c =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return `<div class="ph-wrap">
    <div class="ph-title">
      <strong>${esc(opts.title || '')}</strong>
      ${opts.sub ? `<span>${esc(opts.sub)}</span>` : ''}
    </div>
    <span class="ph-date">${printDate}</span>
  </div>`;
}

/* ──────────────────────────────────────────────────────────────
   8. ÇARŞAF HÜCRE GENİŞLİĞİ CSS (tek kalan dinamik CSS üretimi)
   Tüm diğer print CSS kuralları teacher-style.css'e taşındı.
   Yalnızca data-cell-count runtime değerine bağlı bu hesap burada kalır.
   ────────────────────────────────────────────────────────────── */

/**
 * Çarşaf yazdırması için dinamik hücre genişliği CSS'i üretir.
 * data-cell-count değeri runtime'da dolu olduğundan statik CSS'e yazılamaz.
 * @param {string} type  – 'teacher-sheet' | 'class-sheet'
 * @param {Element|null} root
 * @returns {string}
 */
function buildSheetCellCss(type, root) {
  const sheetTable = root ? root.querySelector('.schedule-sheet') : null;
  const cellCount  = sheetTable ? Number(sheetTable.dataset.cellCount || 0) : 0;
  const isTeacher  = type === 'teacher-sheet';
  const nameColW   = isTeacher ? '22mm' : '15mm';
  const cellW      = cellCount > 0
    ? `calc((100% - ${nameColW}) / ${cellCount})`
    : `calc((100% - ${nameColW}) / 40)`;
  return `@media print {
  .teacher-sheet .sheet-name { width:${nameColW} !important; min-width:${nameColW} !important; max-width:${nameColW} !important; }
  .class-sheet   .sheet-name { width:${nameColW} !important; min-width:${nameColW} !important; max-width:${nameColW} !important; }
  .teacher-sheet td, .teacher-sheet thead tr:nth-child(2) th { width:${cellW}; }
  .class-sheet   td, .class-sheet   thead tr:nth-child(2) th { width:${cellW}; }
}`;
}

/* ──────────────────────────────────────────────────────────────
   9. PENCERE AÇMA VE YAZDIRMA
   ────────────────────────────────────────────────────────────── */

/**
 * CSS bağlantılarını mevcut sayfadaki <link> elementlerinden toplar.
 * Bootstrap, Font-Awesome ve teacher-style.css otomatik dahil edilir.
 * @returns {string}
 */
function collectPageStylesheets() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(l => l.href ? `<link rel="stylesheet" href="${l.href}">` : '')
    .filter(Boolean)
    .join('\n');
}

/**
 * Yeni yazdırma penceresi açar, içeriği yazar ve döndürür.
 * Mobil tarayıcılarda cross-window load event dinlemesi güvenilmez
 * olduğundan printHtml içinde inline script ile tetikleme yapılır.
 * @param {string} printHtml
 * @returns {Window|null}
 */
function openPrintWindow(printHtml) {
  const win = window.open('', '_blank', 'width=900,height=820,scrollbars=yes');
  if (!win) return null;
  // Mobil popup blocker bypass için önce geçici içerik yaz
  win.document.write('<!doctype html><html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial,sans-serif;padding:20px">Önizleme hazırlanıyor\u2026</body></html>');
  win.document.close();
  // Asıl içeriği yaz (printHtml içinde inline yazdırma scripti vardır)
  win.document.open();
  win.document.write(printHtml);
  win.document.close();
  return win;
}

/**
 * Yazdırma penceresi kapanma yönetimi.
 * Yazdırmayı tetiklemez — tetikleme printHtml içindeki inline script üstlenir.
 * Bu fonksiyon yalnızca afterprint / timeout ile pencereyi kapatır.
 * @param {Window} win
 */
function printWindowAndCleanup(win) {
  if (!win) return;
  let closed = false;
  function closeWin() {
    if (closed) return;
    closed = true;
    try { win.close(); } catch (e) { /* sessiz */ }
  }
  try {
    win.addEventListener('afterprint', closeWin, { once: true });
  } catch (e) { /* eski tarayıcı */ }
  setTimeout(closeWin, 10000);
}

/* ──────────────────────────────────────────────────────────────
   10. BUTON VE HATA YÖNETİMİ
   ────────────────────────────────────────────────────────────── */

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

function notifyPrintError(message) {
  if (typeof showToast === 'function') {
    showToast(message || 'Yazdırma sırasında hata oluştu.', 'warning');
  } else {
    console.warn('[teacher-print]', message);
  }
}

/* ──────────────────────────────────────────────────────────────
   11. ANA MOTOR: printDocument()
   ────────────────────────────────────────────────────────────── */

/**
 * Merkezi yazdırma motoru.
 *
 * Kullanım:
 *   printDocument({ sourceId:'teacherProfile', type:'teacher-profile', title:'Öğretmen Profili', button:this })
 *   printDocument({ sourceId:'dutyPrintArea',  type:'duty',            title:'Nöbet Çizelgesi',  button:this })
 *
 * @param {Object} options
 */
function printDocument(options) {
  const opts = normalizePrintOptions(options);

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

    // Mobil cihaz tespiti → body class olarak eklenecek
    const device      = detectPrintDevice();
    const deviceClass = device === 'phone' ? 'print-tablet print-phone'
                      : device === 'tablet' ? 'print-tablet'
                      : '';

    // Sayfa yönü — yalnızca çarşaf dışı tipler için @page üretilir
    const orientation = resolvePrintOrientation(opts.type, opts.orientation, root);

    // DOM klonu + hazırlık
    const rootClone = root.cloneNode(true);
    expandScrollableAreas(rootClone);
    openDisclosureForPrint(rootClone);
    prepareProfileProgramForPrint(rootClone, opts);

    // Başlık meta
    const meta = getAutoMetaSafe(opts.type, opts.sourceId, rootClone);
    if (opts.title && ['tasks', 'teachers'].includes(opts.type)) meta.title = opts.title;
    if (!meta.title && opts.title) meta.title = opts.title;

    dedupePrintHeadings(rootClone, meta);
    markHiddenForPrint(rootClone);
    injectPrintTitleRows(rootClone);

    // Sayfa yönü CSS + çarşaf ise dinamik hücre genişliği
    const isSheet  = opts.type === 'teacher-sheet' || opts.type === 'class-sheet';
    const extraCss = isSheet
      ? buildSheetCellCss(opts.type, rootClone)
      : `@page { size:${orientation}; margin:10mm; }`;

    const stylesheets = collectPageStylesheets();
    const headerHtml  = buildPrintHeader(meta);

    const esc        = (typeof escapeHtml === 'function') ? escapeHtml : s => String(s);
    const printTitle = esc(meta.title || opts.title || 'Yazdır');

    // Mobil bilgi notu (ekranda görünür, yazdırılmaz)
    const mobileNote = device !== 'desktop'
      ? `<div class="no-print" style="background:#fef9c3;border:1px solid #f59e0b;border-radius:4px;padding:8px 12px;margin-bottom:10px;font-size:12px;">
           <strong>Mobil yazdırma:</strong> Tarayıcı ayarlarından sayfa boyutunu A4 seçin.
           ${device === 'phone' ? 'Geniş tablolar için yatay (landscape) yönü tercih edin.' : ''}
         </div>`
      : '';

    const printHtml = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${printTitle}</title>
  ${stylesheets}
  <style>${extraCss}</style>
</head>
<body class="${[bodyClass, deviceClass].filter(Boolean).join(' ')}">
  ${mobileNote}
  ${headerHtml}
  ${rootClone.outerHTML}
  <script>
(function(){
  var printed = false;
  function doPrint(){ if(printed) return; printed = true; window.focus(); window.print(); }
  function waitImages(){
    return Promise.all(Array.prototype.slice.call(document.images).map(function(img){
      if(img.complete) return Promise.resolve();
      return new Promise(function(res){ img.onload = res; img.onerror = res; });
    }));
  }
  function waitFonts(){
    return document.fonts && document.fonts.ready ? document.fonts.ready.catch(function(){}) : Promise.resolve();
  }
  window.addEventListener('load', function(){
    Promise.all([waitImages(), waitFonts()]).then(function(){ setTimeout(doPrint, 250); });
    setTimeout(doPrint, 2500);
  });
})();
  <\/script>
</body>
</html>`;

    const win = openPrintWindow(printHtml);

    if (!win) {
      notifyPrintError('Yazdırma penceresi açılamadı. Lütfen popup engelleyiciyi kapatın.');
      setPrintButtonBusy(opts.button, false);
      return;
    }

    printWindowAndCleanup(win);
    setTimeout(() => setPrintButtonBusy(opts.button, false), 500);

  } catch (err) {
    setPrintButtonBusy(opts.button, false);
    notifyPrintError('Yazdırma hazırlanırken hata oluştu.');
    console.error('[teacher-print] printDocument hatası:', err);
  }
}

/* ──────────────────────────────────────────────────────────────
   12. DERS PROGRAMI ÖZEL MOTOR: printSchedule()
   ────────────────────────────────────────────────────────────── */

/**
 * Ders programı ekranı için özel yazdırma motoru.
 * Aktif görünüm moduna göre doğru type/sourceId seçer.
 *
 * Kullanım (index.html):
 *   onclick="printSchedule(this)"
 *
 * @param {Element|null} button
 */
function printSchedule(button) {
  try {
    const viewMode = (typeof getEl === 'function' && getEl('scheduleViewMode'))
      ? getEl('scheduleViewMode').value
      : '';

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
