// ============================================================
// MODUL: HILFSFUNKTIONEN
// ============================================================
function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function now() { return new Date().toISOString(); }
function dateStr(d) { return (d || new Date()).toISOString().slice(0,10); }
function fmtDate(s) { if (!s) return '–'; return s.slice(0,10); }
function fmtMoney(n, sign=false) {
  if (n === null || n === undefined || isNaN(n)) return '–';
  const abs = Math.abs(n).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
  if (sign && n < 0) return `−${abs} €`;
  if (sign && n > 0) return `+${abs} €`;
  return `${abs} €`;
}
function fmtPct(r) { return (r*100).toFixed(0)+'%'; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function yearsWithData() {
  const s = State.get();
  const years = new Set([String(s.settings.accountingYear || new Date().getFullYear())]);
  [s.transactions, s.invoicesIssued, s.invoicesReceived, s.assets, s.dividends].forEach(arr => (arr || []).forEach(item => {
    const candidate = item?.date || item?.issueDate || item?.purchaseDate || (item?.profitYear ? `${item.profitYear}-01-01` : '');
    if (candidate && String(candidate).length >= 4) years.add(String(candidate).slice(0,4));
  }));
  const current = new Date().getFullYear();
  for (let y=current-2; y<=current+3; y++) years.add(String(y));
  return Array.from(years).filter(Boolean).sort();
}
function formatCounterpartyFull(cp) {
  if (!cp) return '–';
  const lines = [cp.name, cp.address, cp.address2, [cp.zip, cp.city].filter(Boolean).join(' '), cp.country].filter(Boolean);
  return lines.join(', ');
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function getAttachmentIcon(att) {
  const type = (att?.mimeType || '').toLowerCase();
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('jpeg') || type.includes('jpg') || type.includes('png') || type.includes('image')) return 'IMG';
  return 'FILE';
}
function renderAttachmentList(attachments, compact=false) {
  if (!attachments || !attachments.length) return compact ? '<span class="muted">–</span>' : '';
  return attachments.map((att, idx) => `<div style="display:flex;align-items:center;gap:6px;margin-top:${compact?0:6}px"><span class="badge badge-gray">${getAttachmentIcon(att)}</span><a href="#" onclick="openAttachmentByData(event, '${escAttr(att.dataUrl || '')}', '${escAttr(att.name || 'Datei')}')" style="color:var(--text2);text-decoration:none">${esc(att.name || `Anhang ${idx+1}`)}</a></div>`).join('');
}


function addDays(dateString, days) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() + (parseInt(days,10) || 0));
  return dateStr(d);
}
function moneyRound(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }
function formatQty(n) {
  const num = parseFloat(n || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function textToHtml(text) { return esc(text || '').replace(/\n/g, '<br>'); }
function getCounterpartyById(id) { return State.get().counterparties.find(c => c.id === id) || null; }
function getAvailableYears() {
  const s = State.get();
  const years = new Set();
  const current = Number(s.settings.accountingYear || new Date().getFullYear());
  for (let y=current-3; y<=current+3; y++) years.add(y);
  [...(s.transactions||[]), ...(s.invoicesIssued||[]), ...(s.invoicesReceived||[]), ...(s.dividends||[])].forEach(item => {
    const d = item.date || item.issueDate || item.paymentDate || item.resolutionDate;
    if (d && /^\d{4}/.test(String(d))) years.add(Number(String(d).slice(0,4)));
    if (item.profitYear) years.add(Number(item.profitYear));
  });
  return [...years].filter(Boolean).sort((a,b)=>b-a);
}
function setAccountingYear(year) {
  const y = parseInt(year, 10);
  if (!y) return;
  State.set(s => { s.settings.accountingYear = y; });
}
function attachmentsHtml(list=[]) {
  if (!list.length) return '';
  return `<div class="attachment-list">${list.map((att, idx)=>`<span class="attachment-chip">📎 ${esc(att.name || `Datei ${idx+1}`)}</span>`).join('')}</div>`;
}
function openAttachment(txId, idx) {
  const tx = State.get().transactions.find(t=>t.id===txId);
  const att = tx?.attachments?.[idx];
  if (!att?.dataUrl) return;
  const win = window.open();
  if (!win) return;
  win.document.write(`<title>${esc(att.name || 'Beleg')}</title><iframe src="${att.dataUrl}" style="border:0;width:100vw;height:100vh"></iframe>`);
  win.document.close();
}
window.openAttachment = openAttachment;

window.previewTransactionAttachments = function(txId) {
  const tx = State.get().transactions.find(t => t.id === txId);
  if (!tx || !Array.isArray(tx.attachments) || !tx.attachments.length) {
    showToast('Keine Anhänge vorhanden', 'warn');
    return;
  }
  const buttons = tx.attachments.map((att, idx) =>
    `<button class="btn btn-ghost btn-sm" onclick="openAttachmentByData(event, '${escAttr(att.dataUrl || '')}', '${escAttr(att.name || `Datei ${idx+1}`)}')">${esc(att.name || `Datei ${idx+1}`)}</button>`
  ).join('');
  const first = tx.attachments[0];
  const preview = (first.mimeType || '').includes('pdf')
    ? `<div style="background:#0b0c10;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;height:68vh;margin-top:12px"><iframe src="${first.dataUrl}" style="border:0;width:100%;height:100%"></iframe></div>`
    : `<div style="background:#0b0c10;border:1px solid var(--border);border-radius:var(--radius);overflow:auto;display:flex;align-items:center;justify-content:center;min-height:68vh;margin-top:12px"><img src="${first.dataUrl}" alt="${escAttr(first.name || 'Anhang')}" style="max-width:100%;max-height:66vh;object-fit:contain"></div>`;
  openModal(`Belege – ${tx.description || 'Ausgabe'}`, `<div class="muted" style="margin-bottom:10px">Datei auswählen oder den ersten Beleg direkt in der Vorschau ansehen.</div><div style="display:flex;gap:8px;flex-wrap:wrap">${buttons}</div>${preview}`, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button>`, 'wide');
};


// ============================================================
// MODUL: UI-HILFSFUNKTIONEN
// ============================================================
function showToast(msg, type='info') {
  const icons = { info:'ℹ', success:'✓', error:'✕', warn:'⚠' };
  const colors = { info: 'var(--blue)', success: 'var(--green)', error: 'var(--red)', warn: 'var(--yellow)' };
  const t = document.createElement('div'); t.className = 'toast-msg';
  t.innerHTML = `<span style="color:${colors[type]}">${icons[type]}</span> ${esc(msg)}`;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function openModal(titleText, bodyHTML, footerHTML='', size='default') {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal ${size==='wide' ? 'modal-wide' : ''}">
        <div class="modal-header">
          <div class="modal-title">${esc(titleText)}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>
    </div>`;
}
function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

function confirm(msg, onYes) {
  window.__confirmAction = typeof onYes === 'function' ? onYes : null;
  openModal('Bestätigen', `<p style="color:var(--text)">${esc(msg)}</p>`,
    `<button class="btn btn-ghost btn-sm" onclick="window.__confirmAction=null;closeModal()">Abbrechen</button>
     <button class="btn btn-danger btn-sm" onclick="const action=window.__confirmAction;window.__confirmAction=null;closeModal();if(action)action()">Bestätigen</button>`);
}

function vatTreatmentOptions(dir='both') {
  return VAT_TREATMENTS
    .filter(v => v.direction === dir || v.direction === 'both')
    .map(v => `<option value="${v.code}">${v.label}${v.configurable?' *':''}</option>`).join('');
}
function vatRateOptions() {
  const s = State.get();
  return (s.settings.vatRates||DEFAULT_VAT_RATES).map(r=>`<option value="${r.rate}">${r.label}</option>`).join('');
}
function counterpartyOptions(type=null) {
  const s = State.get();
  const list = type ? s.counterparties.filter(c=>c.type===type||c.type==='both') : s.counterparties;
  return ['<option value="">– Geschäftspartner –</option>', ...list.map(c=>`<option value="${c.id}">${esc(c.name)}${c.city ? ' · ' + esc(c.city) : ''}</option>`)].join('');
}
function cpName(id) {
  const s = State.get(); const c = s.counterparties.find(x=>x.id===id);
  return c ? c.name : '–';
}
function categoryOptions(type) {
  const cats = type==='income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return cats.map(c=>`<option value="${c}">${c}</option>`).join('');
}
