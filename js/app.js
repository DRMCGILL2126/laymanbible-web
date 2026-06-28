'use strict';

// ---------------------------------------------------------------------------
// Layman Bible — static web reader. Vanilla JS, no build step.
// Routes (hash):  #/  •  #/book/:id  •  #/read/:id/:chapter
// ---------------------------------------------------------------------------

const APP = document.getElementById('app');
const STORE_LINKS = {
  ios: 'https://apps.apple.com/app/id6760037449',
  android: 'https://play.google.com/store/apps/details?id=com.mcgill.laymanbible',
};

const state = {
  manifest: null,
  bookCache: {},
  toggles: loadJSON('lb_toggles', { chapter: true, verse: true, cultural: true, cross: true, then: true }),
};

// ---- utilities ----
function loadJSON(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return fallback; }
}
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

async function getManifest() {
  if (state.manifest) return state.manifest;
  const r = await fetch('data/manifest.json');
  state.manifest = await r.json();
  return state.manifest;
}
async function getBook(id) {
  if (state.bookCache[id]) return state.bookCache[id];
  const r = await fetch(`data/${id}.json`);
  if (!r.ok) throw new Error('Book not found');
  const d = await r.json();
  state.bookCache[id] = d;
  return d;
}
function bookMeta(id) { return (state.manifest || []).find(b => b.id === id); }

function loading() { APP.innerHTML = `<div class="loading"><div class="spinner"></div>Loading…</div>`; }

// ---- Router ----
async function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  try {
    await getManifest();
    if (parts[0] === 'book' && parts[1]) return renderChapters(parts[1]);
    if (parts[0] === 'read' && parts[1]) return renderReader(parts[1], parseInt(parts[2] || '1', 10));
    return renderHome();
  } catch (e) {
    APP.innerHTML = `<div class="loading">Couldn't load that page.<br><a href="#/">Back to home</a></div>`;
    console.error(e);
  }
}

// ---- Home ----
let homeTestament = 'New Testament';
function renderHome() {
  const m = state.manifest;
  const books = m.filter(b => b.testament === homeTestament);
  APP.innerHTML = `
    <section class="hero">
      <h1>Layman Bible</h1>
      <p>The Bible explained in plain language — every verse, in words you already know.</p>
    </section>
    <div class="testament-tabs">
      <button data-t="Old Testament" class="${homeTestament === 'Old Testament' ? 'active' : ''}">Old Testament</button>
      <button data-t="New Testament" class="${homeTestament === 'New Testament' ? 'active' : ''}">New Testament</button>
    </div>
    <div class="book-grid">
      ${books.map(b => `
        <a class="book-card" href="#/book/${b.id}">
          <div class="bk-name">${esc(b.name)}</div>
          <div class="bk-ch">${b.chapters} ch</div>
        </a>`).join('')}
    </div>`;
  APP.querySelectorAll('.testament-tabs button').forEach(btn =>
    btn.addEventListener('click', () => { homeTestament = btn.dataset.t; renderHome(); }));
}

// ---- Chapter grid ----
async function renderChapters(bookId) {
  loading();
  const meta = bookMeta(bookId);
  const count = meta ? meta.chapters : (await getBook(bookId)).chapters.length;
  const name = meta ? meta.name : bookId;
  APP.innerHTML = `
    <div class="crumbs"><a href="#/">Home</a> › ${esc(name)}</div>
    <h2 class="page-title">${esc(name)}</h2>
    <div class="chapter-grid">
      ${Array.from({ length: count }, (_, i) => i + 1).map(n =>
        `<a class="chapter-cell" href="#/read/${bookId}/${n}">${n}</a>`).join('')}
    </div>`;
}

// ---- Reader ----
function renderToggleBar() {
  const t = state.toggles;
  const allOn = t.chapter && t.verse && t.cultural && t.cross && t.then;
  const chip = (cls, key, label) =>
    `<button class="toggle-chip t-${cls}" data-key="${key}" data-on="${key === 'all' ? allOn : !!t[key]}">
       <span class="dot"></span>${label}</button>`;
  return `<div class="toggle-bar">
    ${chip('all', 'all', 'All')}
    ${chip('chapter', 'chapter', 'Chapter')}
    ${chip('verse', 'verse', 'Verses')}
    ${chip('cultural', 'cultural', 'Cultural')}
    ${chip('cross', 'cross', 'Cross-Ref')}
    ${chip('then', 'then', 'Then / Now')}
  </div>`;
}

async function renderReader(bookId, chapterNum) {
  loading();
  const book = await getBook(bookId);
  const meta = bookMeta(bookId) || { name: book.book?.name || bookId, chapters: book.chapters.length };
  const chapter = book.chapters.find(c => c.number === chapterNum) || book.chapters[0];
  chapterNum = chapter.number;
  const total = book.chapters.length;
  const peopleIndex = indexBy(book.book?.people), placesIndex = indexBy(book.book?.places);

  APP.innerHTML = `
    <div class="crumbs"><a href="#/">Home</a> › <a href="#/book/${bookId}">${esc(meta.name)}</a> › Chapter ${chapterNum}</div>
    <div class="reader-nav">
      <button class="chap-btn" id="prevCh" ${chapterNum <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <div class="reader-title">${esc(meta.name)} ${chapterNum}</div>
      <button class="chap-btn" id="nextCh" ${chapterNum >= total ? 'disabled' : ''}>Next ›</button>
    </div>
    ${renderToggleBar()}
    <div id="readBody"></div>`;

  renderBody(chapter, peopleIndex, placesIndex);

  const go = n => { location.hash = `#/read/${bookId}/${n}`; };
  APP.querySelector('#prevCh')?.addEventListener('click', () => chapterNum > 1 && go(chapterNum - 1));
  APP.querySelector('#nextCh')?.addEventListener('click', () => chapterNum < total && go(chapterNum + 1));
  bindToggles(() => renderBody(chapter, peopleIndex, placesIndex));
}

function bindToggles(rerender) {
  APP.querySelectorAll('.toggle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.key, t = state.toggles;
      if (key === 'all') {
        const turnOn = !(t.chapter && t.verse && t.cultural && t.cross && t.then);
        t.chapter = t.verse = t.cultural = t.cross = t.then = turnOn;
      } else { t[key] = !t[key]; }
      saveJSON('lb_toggles', t);
      // refresh chip states
      APP.querySelector('.toggle-bar').outerHTML = renderToggleBar();
      bindToggles(rerender);
      rerender();
    });
  });
}

function renderBody(chapter, peopleIndex, placesIndex) {
  const t = state.toggles;
  const body = APP.querySelector('#readBody');
  let html = '';

  // Chapter context
  if (t.chapter && chapter.explainer) {
    const ex = chapter.explainer;
    html += `<div class="context-card">
      <h3>📖 Chapter Context</h3>
      <p>${esc(ex.summary || ex.contextInBook || '')}</p>
      ${(ex.themes && ex.themes.length) ? `<div class="context-themes">${ex.themes.map(th => `<span class="theme-pill">${esc(th)}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  // Verses
  html += `<div class="verses">`;
  for (const v of chapter.verses) {
    html += `<span class="verse-block"><span class="verse-num">${v.number}</span><span class="verse-text">${annotate(v)}</span> </span>`;
    if (t.verse && v.explainer)
      html += card('verse', '💡 Verse Note', esc(v.explainer));
    if (t.cultural && v.culturalNotes?.length)
      for (const c of v.culturalNotes) html += card('cultural', '🏺 ' + esc(c.title || 'Cultural Note'), esc(c.note));
    if (t.cross && v.crossReferences?.length)
      html += card('cross', '🔗 Cross-References',
        v.crossReferences.map(x => `<div class="xref"><span class="ref">${esc(x.reference)}</span> — ${esc(x.text || '')}${x.connection ? `<br><i>${esc(x.connection)}</i>` : ''}</div>`).join(''));
    if (t.then && v.thenVsNow)
      html += card('then', '⏳ Then vs Now',
        `<div class="tn-row"><b>Then:</b> ${esc(v.thenVsNow.then)}</div><div class="tn-row"><b>Now:</b> ${esc(v.thenVsNow.now)}</div>`);
  }
  html += `</div>`;

  // Word studies
  if (chapter.wordStudies?.length) {
    html += `<div class="wordstudies"><h3>Word Studies</h3>`;
    for (const w of chapter.wordStudies) {
      html += `<div class="ws-card">
        <div class="ws-head">
          <span class="ws-greek">${esc(w.greek || w.hebrew || '')}</span>
          <span class="ws-translit">${esc(w.transliteration || '')}</span>
          <span class="ws-as">→ <b>${esc(w.translatedAs || '')}</b></span>
        </div>
        <p>${esc(w.meaning || '')}</p>
        ${w.significance ? `<p>${esc(w.significance)}</p>` : ''}
      </div>`;
    }
    html += `</div>`;
  }

  body.innerHTML = html;

  // Annotation clicks (people / places)
  body.querySelectorAll('.verse-anno').forEach(a => a.addEventListener('click', () => {
    const id = a.dataset.id, type = a.dataset.atype;
    const idx = type === 'place' ? placesIndex : peopleIndex;
    const item = idx[id];
    if (item) showModal(item, type);
  }));
}

function card(cls, label, inner) {
  return `<div class="exp-card exp-${cls}"><div class="exp-label">${label}</div>${inner}</div>`;
}

// Wrap annotated words (people/places) in clickable spans using startIndex.
function annotate(v) {
  const text = v.text || '';
  const annos = (v.annotations || []).filter(a => a && Number.isInteger(a.startIndex) && a.word)
    .sort((a, b) => a.startIndex - b.startIndex);
  if (!annos.length) return esc(text);
  let out = '', cursor = 0;
  for (const a of annos) {
    const start = a.startIndex, end = start + a.word.length;
    if (start < cursor || end > text.length || text.substr(start, a.word.length) !== a.word) continue;
    out += esc(text.slice(cursor, start));
    const id = a.personId || a.placeId || a.wordId || '';
    out += `<span class="verse-anno" data-atype="${esc(a.type || 'person')}" data-id="${esc(id)}">${esc(a.word)}</span>`;
    cursor = end;
  }
  out += esc(text.slice(cursor));
  return out;
}

function indexBy(arr) {
  const idx = {};
  (arr || []).forEach(item => { if (item && item.id) idx[item.id] = item; });
  return idx;
}

function showModal(item, type) {
  const fields = [];
  const add = (label, val) => { if (val) fields.push(`<div class="modal-label">${label}</div><p>${esc(val)}</p>`); };
  add('Who is this?', item.description || item.bio || item.summary);
  add('Significance', item.significance || item.role);
  add('Cultural Context', item.culturalContext);
  add('Today', item.modernLocation);
  add('Significance', item.culturalSignificance);
  const modal = el(`<div class="modal-backdrop">
    <div class="modal">
      <button class="modal-close" aria-label="Close">✕</button>
      <h2>${esc(item.name || item.id)}</h2>
      ${item.subtitle || item.role ? `<div class="modal-sub">${esc(item.subtitle || item.role)}</div>` : ''}
      ${fields.join('') || '<p>No additional details.</p>'}
    </div>
  </div>`);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);
}

// ---- Topbar controls: theme + font ----
function initControls() {
  // Theme
  const savedTheme = localStorage.getItem('lb_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('themeBtn');
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lb_theme', next);
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  // Font size
  const savedFont = localStorage.getItem('lb_font') || '19';
  document.documentElement.style.setProperty('--verse-size', savedFont + 'px');
  const panel = document.getElementById('fontPanel'), slider = document.getElementById('fontSlider');
  slider.value = savedFont;
  document.getElementById('fontBtn').addEventListener('click', () => { panel.hidden = !panel.hidden; });
  slider.addEventListener('input', () => {
    document.documentElement.style.setProperty('--verse-size', slider.value + 'px');
    localStorage.setItem('lb_font', slider.value);
  });

  // Store links
  document.getElementById('iosLink').href = STORE_LINKS.ios;
  document.getElementById('androidLink').href = STORE_LINKS.android;
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => { initControls(); router(); });
