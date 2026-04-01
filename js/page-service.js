// ============================================================
// MODUL: SEITEN
// ============================================================
const Pages = {};

// ── DASHBOARD ──────────────────────────────────────────────
Pages.dashboard = function() {
  const s = State.get();
  const yr = s.settings.accountingYear;
  const txns = s.transactions.filter(t=>t.date&&t.date.startsWith(String(yr)));
  const revenue = txns.filter(t=>t.type==='income').reduce((a,t)=>a+(t.netAmount||0),0);
  const expenses = txns.filter(t=>t.type==='expense').reduce((a,t)=>a+(t.grossAmount||0),0);
  const profit = revenue - expenses;
  const tax = Tax.citEstimate(s.transactions, yr);
  const vat = Tax.vatSummary(s.transactions, yr, null);
  const unpaidInvoices = s.invoicesIssued.filter(i=>i.status==='unpaid');
  const unpaidTotal = unpaidInvoices.reduce((a,i)=>a+(i.totalGross||i.amount||0),0);

  const warns = [];
  const txMissingVat = s.transactions.filter(t=>!t.vatTreatment);
  if (txMissingVat.length) warns.push(`${txMissingVat.length} Buchung(en) ohne steuerliche Einordnung`);
  if (unpaidInvoices.length) warns.push(`${unpaidInvoices.length} unbezahlte Rechnung(en) (${fmtMoney(unpaidTotal)})`);

  const warningsHTML = warns.map(w=>`<div class="warning-bar">⚠ ${esc(w)}</div>`).join('');

  return `
    <div class="section-header">
      <div><div class="section-title">Dashboard</div><div class="section-sub">${yr} · Übersicht</div></div>
    </div>
    ${warningsHTML}
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card"><div class="card-title">Einnahmen (netto)</div><div class="card-value green">${fmtMoney(revenue)}</div><div class="card-sub">Jahr ${yr}</div></div>
      <div class="card"><div class="card-title">Ausgaben</div><div class="card-value red">${fmtMoney(expenses)}</div><div class="card-sub">Jahr ${yr}</div></div>
      <div class="card"><div class="card-title">Gewinn (Schätzung)</div><div class="card-value ${profit>=0?'green':'red'}">${fmtMoney(profit)}</div><div class="card-sub">vor Steuern</div></div>
      <div class="card"><div class="card-title">Körperschaftsteuer (Schätzung)</div><div class="card-value yellow">${fmtMoney(tax.taxPayable)}</div><div class="card-sub">Steuersatz ${fmtPct(tax.rate)}</div></div>
    </div>
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><div class="card-title">USt. abzuführen</div><div class="card-value mono ${vat.balance>=0?'red':'green'}">${fmtMoney(vat.balance)}</div><div class="card-sub">Ausgangs-USt.: ${fmtMoney(vat.outputVat)} · Vorsteuer: ${fmtMoney(vat.inputVat)}</div></div>
      <div class="card"><div class="card-title">Offene Forderungen</div><div class="card-value yellow">${fmtMoney(unpaidTotal)}</div><div class="card-sub">${unpaidInvoices.length} Rechnungen</div></div>
      <div class="card"><div class="card-title">Buchungen ${yr}</div><div class="card-value mono">${txns.length}</div><div class="card-sub">${txns.filter(t=>t.type==='income').length} Einnahmen · ${txns.filter(t=>t.type==='expense').length} Ausgaben</div></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Letzte Buchungen</div>
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>Datum</th><th>Beschreibung</th><th>Typ</th><th class="text-right">Betrag</th></tr></thead>
            <tbody>
              ${s.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>`
              <tr>
                <td class="mono">${fmtDate(t.date)}</td>
                <td>${esc(t.description)}</td>
                <td>${t.type==='income'?'<span class="badge badge-green">Einnahme</span>':'<span class="badge badge-red">Ausgabe</span>'}</td>
                <td class="text-right ${t.type==='income'?'amount-pos':'amount-neg'}">${fmtMoney(t.grossAmount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Körperschaftsteuer-Schätzung ${yr}</div>
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Einnahmen</span><span class="mono">${fmtMoney(tax.revenue)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Abzugsfähige Ausgaben</span><span class="mono">${fmtMoney(tax.expenses)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Bemessungsgrundlage</span><span class="mono">${fmtMoney(tax.taxBase)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Steuersatz</span><span class="mono">${fmtPct(tax.rate)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Berechnete Steuer</span><span class="mono">${fmtMoney(tax.citEstimated)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Mindeststeuer</span><span class="mono">${fmtMoney(tax.minTax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600"><span>Geschätzte Steuer</span><span class="mono yellow">${fmtMoney(tax.taxPayable)}</span></div>
          <div class="tax-notice">* Dies ist eine unverbindliche Schätzung. Kein Ersatz für steuerliche Beratung.</div>
        </div>
      </div>
    </div>`;
};

// ── BUCHUNGSFORMULAR ────────────────────────────────────────
function txFormHTML(t={}, type='income') {
  const dir = t.type||type;
  const attachments = Array.isArray(t.attachments) ? t.attachments : [];
  return `
    <div class="form-row form-row-3">
      <div class="form-group"><label>Datum *</label><input type="date" id="f-date" value="${t.date||dateStr()}" required></div>
      <div class="form-group"><label>Typ *</label>
        <select id="f-type" onchange="txFormTypeChange()">
          <option value="income" ${dir==='income'?'selected':''}>Einnahme</option>
          <option value="expense" ${dir==='expense'?'selected':''}>Ausgabe</option>
        </select>
      </div>
      <div class="form-group"><label>Kategorie *</label>
        <select id="f-category">${categoryOptions(dir)}</select>
      </div>
    </div>
    <div class="form-group"><label>Beschreibung *</label><input type="text" id="f-desc" value="${esc(t.description||'')}" placeholder="Kurze Beschreibung der Buchung"></div>
    <div class="form-row form-row-2">
      <div class="form-group"><label>Geschäftspartner</label><select id="f-cp">${counterpartyOptions()}</select></div>
      <div class="form-group"><label>Belegnummer</label><input type="text" id="f-ref" value="${esc(t.invoiceRef||t.receiptRef||'')}" placeholder="RE-2026-001"></div>
    </div>
    <div class="form-row form-row-3">
      <div class="form-group"><label>Nettobetrag (€) *</label><input type="number" id="f-net" value="${t.netAmount||''}" step="0.01" min="0.01" oninput="txFormCalcVat()"></div>
      <div class="form-group"><label>USt.-Satz</label><select id="f-vatrate" onchange="txFormCalcVat()">${vatRateOptions()}</select></div>
      <div class="form-group"><label>USt.-Betrag (€)</label><input type="number" id="f-vat" value="${t.vatAmount||0}" step="0.01" readonly style="opacity:.6"></div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group"><label>Steuerliche Einordnung *</label><select id="f-vattr">${vatTreatmentOptions(dir==='income'?'income':'expense')}</select></div>
      <div class="form-group"><label>Zahlungsstatus</label>
        <select id="f-pay">
          <option value="paid" ${t.paymentStatus==='paid'?'selected':''}>Bezahlt</option>
          <option value="unpaid" ${t.paymentStatus==='unpaid'?'selected':''}>Offen</option>
          <option value="partial" ${t.paymentStatus==='partial'?'selected':''}>Teilweise bezahlt</option>
        </select>
      </div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group">
        <label>FTT-Klassifizierung</label>
        <select id="f-ftt">
          <option value="">Automatisch aus Typ ableiten</option>
          <option value="debit" ${t.fttType==='debit'?'selected':''}>Belastung manuell steuerpflichtig</option>
          <option value="cash" ${t.fttType==='cash'?'selected':''}>Barabhebung</option>
          <option value="card" ${t.fttType==='card'?'selected':''}>Kartenzahlung / Kartenfall</option>
          <option value="exempt" ${t.fttType==='exempt'?'selected':''}>Befreit</option>
          <option value="internal" ${t.fttType==='internal'?'selected':''}>Interne Überweisung</option>
        </select>
      </div>
      <div class="form-group"><label><input type="checkbox" id="f-deduct" ${t.deductible!==false?'checked':''}> Steuerlich abzugsfähig</label></div>
    </div>
    <div class="form-group"><label>Anhänge (PDF/JPG/PNG)</label><input type="file" id="f-attachments" accept="application/pdf,image/jpeg,image/png" multiple></div>
    <div class="tax-notice">Anhänge werden lokal im Browser gespeichert und beim JSON-Export mitgenommen. Wegen der Größe bitte Belege komprimiert halten.</div>
    <div id="f-attachment-list">${attachments.length ? attachments.map((att, idx) => `<div style="display:flex;align-items:center;gap:6px;margin-top:6px"><span class="badge badge-gray">${getAttachmentIcon(att)}</span><a href="#" onclick="openAttachmentByData(event, '${escAttr(att.dataUrl || '')}', '${escAttr(att.name || 'Datei')}')" style="color:var(--text2);text-decoration:none">${esc(att.name || `Anhang ${idx+1}`)}</a><button class="btn btn-ghost btn-icon btn-sm" onclick="removeTxAttachment(${idx})">✕</button></div>`).join('') : '<span class="muted">Keine Anhänge</span>'}</div>
    <div class="form-group"><label>Notiz</label><textarea id="f-note" rows="2">${esc(t.notes||'')}</textarea></div>`;
}


window.txFormTypeChange = function() {
  const type = document.getElementById('f-type')?.value;
  const catEl = document.getElementById('f-category');
  const vatEl = document.getElementById('f-vattr');
  if (catEl) catEl.innerHTML = categoryOptions(type);
  if (vatEl) vatEl.innerHTML = vatTreatmentOptions(type==='income'?'income':'expense');
};
window.txFormCalcVat = function() {
  const net = parseFloat(document.getElementById('f-net')?.value)||0;
  const rate = parseFloat(document.getElementById('f-vatrate')?.value)||0;
  const vat = Math.round(net*rate*100)/100;
  const vatEl = document.getElementById('f-vat');
  if (vatEl) vatEl.value = vat.toFixed(2);
};

function renderTxAttachmentEditor() {
  const target = document.getElementById('f-attachment-list');
  if (!target) return;
  const attachments = Array.isArray(window._editingTxAttachments) ? window._editingTxAttachments : [];
  target.innerHTML = attachments.length
    ? attachments.map((att, i) => `
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
        <span class="badge badge-gray">${getAttachmentIcon(att)}</span>
        <a href="#" onclick="openAttachmentByData(event, '${escAttr(att.dataUrl || '')}', '${escAttr(att.name || 'Datei')}')" style="color:var(--text2);text-decoration:none">${esc(att.name || `Anhang ${i+1}`)}</a>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="removeTxAttachment(${i})">✕</button>
      </div>`).join('')
    : '<span class="muted">Keine Anhänge</span>';
}

async function bindTxAttachmentEvents(existing) {
  window._editingTxAttachments = Array.isArray(existing?.attachments) ? [...existing.attachments] : [];
  renderTxAttachmentEditor();
  const input = document.getElementById('f-attachments');
  if (!input) return;
  input.onchange = async e => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      window._editingTxAttachments.push({
        id: uid(),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size || 0,
        dataUrl,
        uploadedAt: now()
      });
    }
    renderTxAttachmentEditor();
    e.target.value = '';
  };
}

async function readTxForm(existingId) {
  const existing = existingId ? State.get().transactions.find(t => t.id === existingId) : null;
  const net = parseFloat(document.getElementById('f-net').value)||0;
  const rate = parseFloat(document.getElementById('f-vatrate').value)||0;
  const vat = Math.round(net*rate*100)/100;
  return {
    id: existingId || uid(),
    date: document.getElementById('f-date').value,
    type: document.getElementById('f-type').value,
    category: document.getElementById('f-category').value,
    description: document.getElementById('f-desc').value,
    counterpartyId: document.getElementById('f-cp').value||null,
    invoiceRef: document.getElementById('f-ref').value,
    netAmount: net,
    vatRate: rate,
    vatAmount: vat,
    grossAmount: net+vat,
    vatTreatment: document.getElementById('f-vattr').value,
    paymentStatus: document.getElementById('f-pay').value,
    fttType: document.getElementById('f-ftt').value||null,
    deductible: document.getElementById('f-deduct').checked,
    notes: document.getElementById('f-note').value,
    attachments: Array.isArray(window._editingTxAttachments) ? [...window._editingTxAttachments] : [],
    currency: 'EUR',
    updatedAt: now(),
    createdAt: existing?.createdAt || now(),
  };
}

function openTxModal(existingId) {
  const s = State.get();
  const existing = existingId ? s.transactions.find(t=>t.id===existingId) : null;
  window._editingTxAttachments = Array.isArray(existing?.attachments) ? [...existing.attachments] : [];
  const title = existing ? 'Buchung bearbeiten' : 'Neue Buchung';
  openModal(title, txFormHTML(existing||{}, 'income'),
    `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary btn-sm" onclick="saveTx(${existingId?`'${existingId}'`:'null'})">Speichern</button>`);
  setTimeout(()=>{
    if (existing) {
      const catEl=document.getElementById('f-category'); if(catEl)catEl.value=existing.category||'';
      const vatEl=document.getElementById('f-vatrate'); if(vatEl)vatEl.value=existing.vatRate||0;
      const vattr=document.getElementById('f-vattr'); if(vattr)vattr.value=existing.vatTreatment||'';
      const cpEl=document.getElementById('f-cp'); if(cpEl)cpEl.value=existing.counterpartyId||'';
    }
    bindTxAttachmentEvents(existing);
  },30);
}
window.openTxModal = openTxModal;

window.openAttachmentByData = function(event, dataUrl, name='Anhang') {
  if (event) event.preventDefault();
  const title = esc(name || 'Anhang');
  const isPdf = (dataUrl || '').startsWith('data:application/pdf');
  const body = isPdf
    ? `<div style="background:#0b0c10;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;height:72vh"><iframe src="${dataUrl}" style="border:0;width:100%;height:100%"></iframe></div>`
    : `<div style="background:#0b0c10;border:1px solid var(--border);border-radius:var(--radius);overflow:auto;display:flex;align-items:center;justify-content:center;min-height:72vh"><img src="${dataUrl}" alt="${escAttr(name)}" style="max-width:100%;max-height:70vh;object-fit:contain"></div>`;
  openModal(title, body, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button><button class="btn btn-primary btn-sm" onclick="downloadAttachment('${escAttr(dataUrl)}','${escAttr(name)}')">Neu öffnen</button>`, 'wide');
};
window.downloadAttachment = function(dataUrl, name='Anhang') {
  const w = window.open('about:blank', '_blank');
  if (!w) return;
  if ((dataUrl || '').startsWith('data:application/pdf')) {
    w.document.write(`<title>${escAttr(name)}</title><iframe src="${dataUrl}" style="border:0;width:100vw;height:100vh"></iframe>`);
  } else {
    w.document.write(`<title>${escAttr(name)}</title><div style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" alt="${escAttr(name)}" style="max-width:98vw;max-height:98vh"></div>`);
  }
  w.document.close();
};
window.removeTxAttachment = function(idx) {
  if (!Array.isArray(window._editingTxAttachments)) return;
  window._editingTxAttachments.splice(idx, 1);
  renderTxAttachmentEditor();
};

window.saveTx = async function(existingId) {
  const t = await readTxForm(existingId);
  const errors = Validate.transaction(t);
  if (errors.length) { showToast(errors[0], 'error'); return; }
  State.set(s => {
    if (existingId) {
      const i = s.transactions.findIndex(x=>x.id===existingId);
      if (i>=0) { t.createdAt = s.transactions[i].createdAt; s.transactions[i]=t; }
    } else {
      s.transactions.push(t);
    }
  });
  closeModal(); window._editingTxAttachments = []; showToast('Buchung gespeichert', 'success');
  UI.render(UI.currentTab);
};

window.deleteTx = function(id) {
  confirm('Diese Buchung wirklich löschen?', ()=>{
    State.set(s=>{ s.transactions = s.transactions.filter(t=>t.id!==id); });
    showToast('Buchung gelöscht', 'warn'); UI.render(UI.currentTab);
  });
};

// ── EINNAHMEN ──────────────────────────────────────────────

Pages.income = function() {
  const s = State.get();
  const yr = s.settings.accountingYear;
  const rows = getIssuedInvoiceIncomeRows(yr);
  const invoiceRows = rows.filter(r => r.rowType === 'invoice');
  const manualRows = rows.filter(r => r.rowType === 'manual');
  const total = rows.reduce((a,r)=>a+(r.netAmount||0),0);
  const unpaid = invoiceRows.filter(r=>r.paymentStatus==='unpaid' || r.paymentStatus==='partial').reduce((a,r)=>a+(r.grossAmount||0),0);

  return `
    <div class="section-header">
      <div><div class="section-title">Einnahmen</div><div class="section-sub">${yr} · Rechnungen und manuelle Einnahmen</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="UI.render('invoices')">Zu Rechnungen</button>
        <button class="btn btn-primary btn-sm" onclick="openTxModal(null,'income')">+ Manuelle Einnahme</button>
      </div>
    </div>
    <div class="info-bar">Ausgangsrechnungen werden hier automatisch als Einnahmen angezeigt. Beim Speichern einer Rechnung wird die verknüpfte Einnahmenbuchung mitgeführt.</div>
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><div class="card-title">Einnahmen gesamt (netto)</div><div class="card-value green">${fmtMoney(total)}</div></div>
      <div class="card"><div class="card-title">Offene Rechnungen</div><div class="card-value yellow">${fmtMoney(unpaid)}</div></div>
      <div class="card"><div class="card-title">Rechnungen / manuell</div><div class="card-value mono">${invoiceRows.length} / ${manualRows.length}</div></div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Datum</th><th>Quelle</th><th>Beschreibung</th><th>Partner</th><th>Steuer</th><th class="text-right">Netto</th><th class="text-right">USt.</th><th class="text-right">Brutto</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr>
                <td class="mono">${fmtDate(r.date)}</td>
                <td>${r.rowType==='invoice' ? `<span class="badge badge-blue">Rechnung</span><br><span style="font-size:10px;color:var(--text3)">${esc(r.number || '–')}</span>` : `<span class="badge badge-green">Manuell</span>`}</td>
                <td>${esc(r.description || '')}</td>
                <td class="muted">${esc(cpName(r.counterpartyId))}</td>
                <td><span class="badge badge-gray">${esc(r.vatTreatment || '–')}</span></td>
                <td class="text-right mono">${fmtMoney(r.netAmount)}</td>
                <td class="text-right mono muted">${fmtMoney(r.vatAmount)}</td>
                <td class="text-right mono amount-pos">${fmtMoney(r.grossAmount)}</td>
                <td>${r.paymentStatus==='paid' ? '<span class="badge badge-green">Bezahlt</span>' : r.paymentStatus==='partial' ? '<span class="badge badge-blue">Teilbezahlt</span>' : '<span class="badge badge-yellow">Offen</span>'}</td>
                <td style="white-space:nowrap">
                  ${r.rowType==='invoice'
                    ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="openInvoicePreview('${r.id}','issued')" title="Vorschau">👁</button><button class="btn btn-ghost btn-icon btn-sm" onclick="openInvoiceModal('${r.id}','issued')" title="Rechnung bearbeiten">✎</button>`
                    : `<button class="btn btn-ghost btn-icon btn-sm" onclick="openTxModal('${r.id}')" title="Buchung bearbeiten">✎</button>`}
                </td>
              </tr>`).join('') : `<tr><td colspan="10"><div class="empty">Keine Einnahmen vorhanden</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
};

// ── AUSGABEN ───────────────────────────────────────────────
Pages.expenses = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const txns = s.transactions.filter(t=>t.type==='expense'&&t.date&&t.date.startsWith(String(yr)));
  const total = txns.reduce((a,t)=>a+(t.grossAmount||0),0);
  const nonDeduct = txns.filter(t=>t.deductible===false).reduce((a,t)=>a+(t.grossAmount||0),0);
  return `
    <div class="section-header">
      <div><div class="section-title">Ausgaben</div><div class="section-sub">${yr} · ${txns.length} Buchungen</div></div>
      <button class="btn btn-primary btn-sm" onclick="openTxModal(null,'expense')">+ Neue Ausgabe</button>
    </div>
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><div class="card-title">Gesamtausgaben (brutto)</div><div class="card-value red">${fmtMoney(total)}</div></div>
      <div class="card"><div class="card-title">Nicht abzugsfähig</div><div class="card-value yellow">${fmtMoney(nonDeduct)}</div></div>
      <div class="card"><div class="card-title">Buchungen</div><div class="card-value mono">${txns.length}</div></div>
    </div>
    ${txTable(txns, 'expense')}`;
};

// ── ALLE BUCHUNGEN ─────────────────────────────────────────
Pages.transactions = function(opts={}) {
  const s = State.get(); const yr = s.settings.accountingYear;
  let txns = s.transactions.filter(t=>t.date&&t.date.startsWith(String(yr)));
  const search = opts.search||''; const typeF = opts.type||''; const catF = opts.cat||'';
  if (search) txns = txns.filter(t=>(t.description||'').toLowerCase().includes(search.toLowerCase())||(t.invoiceRef||'').toLowerCase().includes(search.toLowerCase()));
  if (typeF) txns = txns.filter(t=>t.type===typeF);
  if (catF) txns = txns.filter(t=>t.category===catF);
  txns = txns.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="section-header">
      <div><div class="section-title">Alle Buchungen</div><div class="section-sub">${yr}</div></div>
      <button class="btn btn-primary btn-sm" onclick="openTxModal()">+ Neue Buchung</button>
    </div>
    <div class="filters">
      <input type="text" placeholder="🔍 Suchen..." value="${esc(search)}" oninput="UI.render('transactions',{search:this.value,type:'${typeF}',cat:'${catF}'})">
      <select onchange="UI.render('transactions',{search:'${esc(search)}',type:this.value,cat:'${catF}'})">
        <option value="" ${!typeF?'selected':''}>Alle Typen</option>
        <option value="income" ${typeF==='income'?'selected':''}>Einnahmen</option>
        <option value="expense" ${typeF==='expense'?'selected':''}>Ausgaben</option>
      </select>
      <select onchange="UI.render('transactions',{search:'${esc(search)}',type:'${typeF}',cat:this.value})">
        <option value="">Alle Kategorien</option>
        ${[...INCOME_CATEGORIES,...EXPENSE_CATEGORIES].map(c=>`<option value="${c}" ${catF===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="exportCSV()">⬇ CSV</button>
    </div>
    ${txTable(txns, 'both')}`;
};

function txTable(txns, mode) {
  if (!txns.length) return `<div class="empty"><div class="empty-icon">📋</div>Keine Buchungen vorhanden</div>`;
  return `<div class="card" style="padding:0"><div class="table-wrap"><table>
    <thead><tr>
      <th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th>Partner</th>
      ${mode==='both'?'<th>Typ</th>':''}
      <th>USt.</th><th class="text-right">Netto</th><th class="text-right">USt.</th><th class="text-right">Brutto</th>
      <th>Status</th><th>Anhänge</th><th></th>
    </tr></thead>
    <tbody>
    ${txns.map(t=>`<tr>
      <td class="mono">${fmtDate(t.date)}</td>
      <td>${esc(t.description)}${t.invoiceRef?`<br><span style="font-size:10px;color:var(--text3)">${esc(t.invoiceRef)}</span>`:''}${t.attachments?.length?`<div class="attachment-list">${t.attachments.slice(0,2).map((att,idx)=>`<button class="attachment-chip" style="cursor:pointer;border:none" onclick="openAttachment('${t.id}',${idx})">📎 ${esc(att.name || 'Datei')}</button>`).join('')}${t.attachments.length>2?`<span class="attachment-chip">+${t.attachments.length-2}</span>`:''}</div>`:''}</td>
      <td class="muted">${esc(t.category||'')}</td>
      <td class="muted">${esc(cpName(t.counterpartyId))}</td>
      ${mode==='both'?`<td>${t.type==='income'?'<span class="badge badge-green">Einnahme</span>':'<span class="badge badge-red">Ausgabe</span>'}</td>`:''}
      <td><span class="badge badge-gray">${fmtPct(t.vatRate||0)}</span></td>
      <td class="text-right mono">${fmtMoney(t.netAmount)}</td>
      <td class="text-right mono muted">${fmtMoney(t.vatAmount)}</td>
      <td class="text-right mono ${t.type==='income'?'amount-pos':'amount-neg'}">${fmtMoney(t.grossAmount)}</td>
      <td>${t.paymentStatus==='paid'?'<span class="badge badge-green">Bezahlt</span>':t.paymentStatus==='partial'?'<span class="badge badge-blue">Teilbezahlt</span>':'<span class="badge badge-yellow">Offen</span>'}</td>
      <td>${Array.isArray(t.attachments) && t.attachments.length ? `<button class="btn btn-ghost btn-sm" onclick="previewTransactionAttachments('${t.id}')">${t.attachments.length} Datei(en)</button>` : '<span class="muted">–</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openTxModal('${t.id}')" title="Bearbeiten">✎</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteTx('${t.id}')" title="Löschen" style="color:var(--red)">✕</button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table></div></div>`;
}

// ── RECHNUNGEN ─────────────────────────────────────────────
Pages.invoices = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const issued = s.invoicesIssued.filter(i=>i.issueDate&&i.issueDate.startsWith(String(yr)));
  const received = s.invoicesReceived.filter(i=>i.issueDate&&i.issueDate.startsWith(String(yr)));
  const tabs = [
    { id:'issued', label:`Ausgestellt (${issued.length})` },
    { id:'received', label:`Empfangen (${received.length})` },
  ];
  const activeTab = window._invoiceTab || 'issued';
  const list = activeTab==='issued' ? issued : received;
  const total = list.reduce((a,i)=>a+(i.totalGross||i.amount||0),0);
  const unpaid = list.filter(i=>!['paid','cancelled'].includes(i.status)).reduce((a,i)=>a+(i.totalGross||i.amount||0),0);
  return `
    <div class="section-header">
      <div><div class="section-title">Rechnungen</div><div class="section-sub">${yr}</div></div>
      <button class="btn btn-primary btn-sm" onclick="openInvoiceModal(null,'${activeTab}')">+ Neue Rechnung</button>
    </div>
    <div class="tabs">
      ${tabs.map(t=>`<div class="tab ${activeTab===t.id?'active':''}" onclick="window._invoiceTab='${t.id}';UI.render('invoices')">${t.label}</div>`).join('')}
    </div>
    <div class="info-bar">Ausgangsrechnungen unterstützen jetzt Positionszeilen, Vorschau und PDF-Erstellung über den Browser-Druckdialog.</div>
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><div class="card-title">Gesamt</div><div class="card-value mono">${fmtMoney(total)}</div></div>
      <div class="card"><div class="card-title">Offen</div><div class="card-value yellow">${fmtMoney(unpaid)}</div></div>
      <div class="card"><div class="card-title">Anzahl</div><div class="card-value mono">${list.length}</div></div>
    </div>
    ${invoiceTable(list, activeTab)}`;
};
function invoiceTable(list, type) {
  if (!list.length) return `<div class="empty"><div class="empty-icon">📄</div>Keine Rechnungen vorhanden</div>`;
  return `<div class="card" style="padding:0"><div class="table-wrap"><table>
    <thead><tr><th>Nummer</th><th>Partner</th><th>Leistungszeitraum</th><th>Steuer</th><th class="text-right">Gesamt</th><th>Status</th><th>Anhänge</th><th></th></tr></thead><tbody>
    ${list.map(i=>{ const overdue=!['paid','cancelled'].includes(i.status)&&i.dueDate&&i.dueDate<dateStr(); return `<tr>
      <td class="mono">${esc(i.number)}</td>
      <td>${esc(cpName(i.counterpartyId))}<br><span style="font-size:10px;color:var(--text3)">${fmtDate(i.issueDate)} · fällig ${fmtDate(i.dueDate)}</span></td>
      <td class="mono">${fmtDate(i.servicePeriodFrom)} – ${fmtDate(i.servicePeriodTo)}</td>
      <td><span class="badge ${i.reverseCharge?'badge-blue':(i.totalVat>0?'badge-green':'badge-gray')}">${esc(invoiceTaxLabel(i))}</span></td>
      <td class="text-right mono">${fmtMoney(i.totalGross||i.amount)}</td>
      <td>${overdue&&i.status!=='paid'?'<span class="badge badge-red">Überfällig</span>':invoiceStatusBadge(i.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openInvoiceModal('${i.id}','${type}')" title="Bearbeiten">✎</button>
        ${type==='issued'?`<button class="btn btn-ghost btn-icon btn-sm" onclick="openInvoicePreview('${i.id}','${type}')" title="Vorschau">👁</button><button class="btn btn-ghost btn-icon btn-sm" onclick="printInvoice('${i.id}','${type}',true)" title="PDF erstellen">🖨</button>`:''}
        ${i.status!=='paid'?`<button class="btn btn-ghost btn-sm" onclick="markInvoicePaid('${i.id}','${type}')">✓ Bezahlt</button>`:''}
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteInvoice('${i.id}','${type}')" style="color:var(--red)" title="Löschen">✕</button>
      </td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}
function renderLineItemsEditor(lines) {
  const normalized = (lines && lines.length ? lines : [{ id: uid(), positionNumber: 1, description: '', quantity: 1, unit: (State.get().settings.invoice||defaultInvoiceSettings()).defaultUnit || 'h', unitPrice: 0, vatRate: 0 }]);
  return `<div class="invoice-line-grid invoice-line-head"><div>Pos.</div><div>Beschreibung</div><div>Menge</div><div>Einheit</div><div>Preis</div><div>USt.-Satz</div><div></div></div>${normalized.map((line, idx) => `<div class="invoice-line-grid" data-line-row="${idx}"><div><input type="number" data-line-field="positionNumber" value="${esc(line.positionNumber || idx+1)}"></div><div><textarea data-line-field="description" style="min-height:42px">${esc(line.description || '')}</textarea></div><div><input type="number" data-line-field="quantity" step="0.01" min="0.01" value="${esc(line.quantity || 1)}"></div><div><input type="text" data-line-field="unit" value="${esc(line.unit || 'h')}"></div><div><input type="number" data-line-field="unitPrice" step="0.01" min="0" value="${esc(line.unitPrice || 0)}"></div><div><select data-line-field="vatRate"><option value="0" ${(line.vatRate||0)===0?'selected':''}>0%</option>${(State.get().settings.vatRates||DEFAULT_VAT_RATES).map(v=>`<option value="${v.rate}" ${Number(line.vatRate)===Number(v.rate)?'selected':''}>${v.label}</option>`).join('')}</select></div><div><button class="btn btn-ghost btn-icon btn-sm" onclick="removeInvoiceLine(${idx})">✕</button></div></div>`).join('')}`;
}
function openInvoiceModal(id, type) {
  const s = State.get(); const arr = type==='issued' ? s.invoicesIssued : s.invoicesReceived; const existing = id ? arr.find(i=>i.id===id) : null; const cfg = s.settings.invoice || defaultInvoiceSettings(); const cpType = type==='issued' ? 'customer' : 'supplier'; const invoiceNumber = existing?.number || (type==='issued' ? buildInvoiceNumber() : `EING-${String((s.invoicesReceived||[]).length+1).padStart(4,'0')}`); const issueDate = existing?.issueDate || dateStr(); const vatTreatment = existing?.vatTreatment || (type==='issued' ? 'eu_b2b_rc_income' : 'domestic_taxable_expense');
  const body = `<div class="form-row form-row-3"><div class="form-group"><label>Rechnungsnummer *</label><input type="text" id="if-num" value="${esc(invoiceNumber)}"></div><div class="form-group"><label>Geschäftspartner *</label><select id="if-cp" onchange="prefillInvoiceCounterparty()">${counterpartyOptions(cpType)}</select></div><div class="form-group"><label>Status</label><select id="if-status"><option value="draft" ${existing?.status==='draft'?'selected':''}>Entwurf</option><option value="unpaid" ${!existing || existing?.status==='unpaid'?'selected':''}>Offen</option><option value="paid" ${existing?.status==='paid'?'selected':''}>Bezahlt</option><option value="partial" ${existing?.status==='partial'?'selected':''}>Teilbezahlt</option><option value="cancelled" ${existing?.status==='cancelled'?'selected':''}>Storniert</option></select></div></div><div class="form-row form-row-3"><div class="form-group"><label>Ausstellungsdatum *</label><input type="date" id="if-issue" value="${issueDate}"></div><div class="form-group"><label>Fälligkeitsdatum *</label><input type="date" id="if-due" value="${existing?.dueDate || addDays(issueDate, cfg.dueDays || 15)}"></div><div class="form-group"><label>Ansprechpartner</label><input type="text" id="if-contact" value="${esc(existing?.contactPerson || '')}"></div></div><div class="form-row form-row-2"><div class="form-group"><label>Leistungszeitraum von</label><input type="date" id="if-spf" value="${existing?.servicePeriodFrom || issueDate}"></div><div class="form-group"><label>Leistungszeitraum bis</label><input type="date" id="if-spt" value="${existing?.servicePeriodTo || issueDate}"></div></div><div class="form-row form-row-2"><div class="form-group"><label>Steuerliche Einordnung</label><select id="if-vt">${vatTreatmentOptions(type==='issued' ? 'income' : 'expense')}</select></div><div class="form-group"><label>Währung</label><input type="text" id="if-currency" value="${esc(existing?.currency || s.settings.currency || 'EUR')}"></div></div><div class="form-group"><label>Einleitungstext</label><textarea id="if-intro">${esc(existing?.introText || cfg.standardIntroText || '')}</textarea></div><div class="form-group"><label>Zahlungsbedingungen</label><textarea id="if-payterms">${esc(existing?.paymentTermsText || cfg.standardPaymentTerms || '')}</textarea></div><div class="form-group"><label>Steuerhinweis</label><textarea id="if-taxnote">${esc(existing?.taxNoteText || (vatTreatment==='eu_b2b_rc_income' ? cfg.standardReverseChargeNote : cfg.standardVatNote || ''))}</textarea></div><div class="form-group"><label>Grußformel</label><textarea id="if-closing">${esc(existing?.closingText || cfg.standardClosingText || '')}</textarea></div><hr class="sep"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="card-title" style="margin-bottom:0">Positionen</div><button class="btn btn-ghost btn-sm" onclick="addInvoiceLine()">+ Position</button></div><div id="invoice-lines-editor">${renderLineItemsEditor(existing?.lineItems)}</div><div class="info-bar" id="invoice-totals-preview" style="margin-top:14px"></div><div class="form-group"><label>Interne Notiz</label><textarea id="if-note">${esc(existing?.internalNote || '')}</textarea></div>`;
  openModal(existing?'Rechnung bearbeiten':'Neue Rechnung', body, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>${type==='issued' ? `<button class="btn btn-ghost btn-sm" onclick="previewInvoiceDraft(${id?`'${id}'`:'null'},'${type}')">Vorschau</button>` : ''}<button class="btn btn-primary btn-sm" onclick="saveInvoice(${id?`'${id}'`:'null'},'${type}')">Speichern</button>`, 'wide');
  setTimeout(()=>{ const cpEl=document.getElementById('if-cp'); if(cpEl) cpEl.value = existing?.counterpartyId || ''; document.getElementById('if-vt').value = vatTreatment; bindInvoiceEditorEvents(); updateInvoiceTotalsPreview(); }, 20);
}
window.openInvoiceModal = openInvoiceModal;
function bindInvoiceEditorEvents() { document.querySelectorAll('#invoice-lines-editor input, #invoice-lines-editor select, #invoice-lines-editor textarea, #if-vt').forEach(el => { el.oninput = () => { syncTaxNoteSuggestion(); updateInvoiceTotalsPreview(); }; el.onchange = () => { syncTaxNoteSuggestion(); updateInvoiceTotalsPreview(); }; }); }
function prefillInvoiceCounterparty() { const cp = getCounterpartyById(document.getElementById('if-cp')?.value || ''); if (!cp) return; const contact = document.getElementById('if-contact'); if (contact && !contact.value) contact.value = cp.contactPerson || ''; }
window.prefillInvoiceCounterparty = prefillInvoiceCounterparty;
function collectInvoiceLines() { return [...document.querySelectorAll('#invoice-lines-editor [data-line-row]')].map((row, idx) => { const get = name => row.querySelector(`[data-line-field="${name}"]`)?.value; return { id: row.dataset.lineId || uid(), positionNumber: parseInt(get('positionNumber') || idx + 1, 10), description: get('description') || '', quantity: parseFloat(get('quantity') || 0), unit: get('unit') || 'h', unitPrice: parseFloat(get('unitPrice') || 0), vatRate: parseFloat(get('vatRate') || 0), }; }).filter(line => line.description || line.quantity || line.unitPrice); }
function draftInvoiceFromForm(id, type) { const s = State.get(); const cp = getCounterpartyById(document.getElementById('if-cp').value || ''); return normalizeInvoice({ id: id || uid(), number: document.getElementById('if-num').value, invoiceNumber: document.getElementById('if-num').value, counterpartyId: document.getElementById('if-cp').value, issueDate: document.getElementById('if-issue').value, dueDate: document.getElementById('if-due').value, servicePeriodFrom: document.getElementById('if-spf').value, servicePeriodTo: document.getElementById('if-spt').value, contactPerson: document.getElementById('if-contact').value, status: document.getElementById('if-status').value, currency: document.getElementById('if-currency').value || s.settings.currency || 'EUR', vatTreatment: document.getElementById('if-vt').value, introText: document.getElementById('if-intro').value, paymentTermsText: document.getElementById('if-payterms').value, taxNoteText: document.getElementById('if-taxnote').value, closingText: document.getElementById('if-closing').value, internalNote: document.getElementById('if-note').value, lineItems: collectInvoiceLines(), recipientSnapshot: cp ? { customerName: cp.name || '', addressLine1: cp.address || '', addressLine2: cp.address2 || '', zip: cp.zip || '', city: cp.city || '', country: cp.country || '', vatId: cp.vatNumber || '', contactPerson: document.getElementById('if-contact').value || cp.contactPerson || '', } : undefined, reverseCharge: document.getElementById('if-vt').value === 'eu_b2b_rc_income', vatExempt: document.getElementById('if-vt').value === 'vat_exempt', updatedAt: now() }, type); }
function updateInvoiceTotalsPreview() { const box = document.getElementById('invoice-totals-preview'); if (!box) return; const inv = draftInvoiceFromForm(null, window._invoiceTab || 'issued'); box.innerHTML = `<strong>Summen:</strong> Netto ${fmtMoney(inv.subtotalNet)} · USt. ${fmtMoney(inv.totalVat)} · Gesamt ${fmtMoney(inv.totalGross)} <span class="muted">· ${esc(invoiceTaxLabel(inv))}</span>`; }
function syncTaxNoteSuggestion() { const vatTreatment = document.getElementById('if-vt')?.value; const field = document.getElementById('if-taxnote'); const cfg = State.get().settings.invoice || defaultInvoiceSettings(); if (!field) return; if (vatTreatment === 'eu_b2b_rc_income' && (!field.value || field.dataset.auto === 'true')) { field.value = cfg.standardReverseChargeNote || ''; field.dataset.auto = 'true'; } else if (vatTreatment !== 'eu_b2b_rc_income' && (!field.value || field.dataset.auto === 'true')) { field.value = cfg.standardVatNote || ''; field.dataset.auto = 'true'; } }
window.addInvoiceLine = function() { const c=document.getElementById('invoice-lines-editor'); const lines=collectInvoiceLines(); lines.push({ id: uid(), positionNumber: lines.length + 1, description: '', quantity: 1, unit: (State.get().settings.invoice||defaultInvoiceSettings()).defaultUnit || 'h', unitPrice: 0, vatRate: 0 }); c.innerHTML = renderLineItemsEditor(lines); bindInvoiceEditorEvents(); updateInvoiceTotalsPreview(); };
window.removeInvoiceLine = function(idx) { const c=document.getElementById('invoice-lines-editor'); const lines=collectInvoiceLines(); lines.splice(idx,1); c.innerHTML = renderLineItemsEditor(lines.length ? lines : null); bindInvoiceEditorEvents(); updateInvoiceTotalsPreview(); };
window.previewInvoiceDraft = function(id, type) { const inv = draftInvoiceFromForm(id, type); const errors = Validate.invoice(inv); if (errors.length) { showToast(errors[0], 'error'); return; } openModal(`Rechnung ${inv.number} – Vorschau`, generateInvoiceDocument(inv), `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button>`, 'wide'); };
window.saveInvoice = function(id, type) { const inv = draftInvoiceFromForm(id, type); const errors = Validate.invoice(inv); if (errors.length) { showToast(errors[0], 'error'); return; } State.set(s=>{ const arr = type==='issued' ? s.invoicesIssued : s.invoicesReceived; const idx = arr.findIndex(i=>i.id===id); const prev = idx >= 0 ? arr[idx] : null; inv.createdAt = prev?.createdAt || inv.createdAt || now(); inv.updatedAt = now(); inv.documentMeta.updatedAt = now(); if (idx>=0) arr[idx]=inv; else arr.push(inv); if (type === 'issued') { if (idx < 0 && s.settings.invoice) s.settings.invoice.nextNumber = (s.settings.invoice.nextNumber || 1) + 1; const txData = { id: prev?.linkedTransactionId || inv.linkedTransactionId || uid(), date: inv.issueDate, type: 'income', category: 'Softwareentwicklung', description: (inv.lineItems[0]?.description || `Rechnung ${inv.number}`).slice(0, 200), counterpartyId: inv.counterpartyId, netAmount: inv.subtotalNet, vatRate: inv.subtotalNet ? (inv.totalVat / inv.subtotalNet) : 0, vatAmount: inv.totalVat, grossAmount: inv.totalGross, vatTreatment: inv.vatTreatment, paymentStatus: inv.status === 'paid' ? 'paid' : 'unpaid', invoiceRef: inv.number, createdAt: prev?.createdAt || now(), updatedAt: now(), deductible: true, currency: inv.currency || 'EUR' }; const txIdx = s.transactions.findIndex(t => t.id === txData.id || t.invoiceRef === inv.number); if (txIdx >= 0) s.transactions[txIdx] = { ...s.transactions[txIdx], ...txData }; else s.transactions.push(txData); inv.linkedTransactionId = txData.id; if (idx>=0) arr[idx]=inv; else arr[arr.length-1]=inv; } }); closeModal(); showToast('Rechnung gespeichert','success'); UI.render('invoices'); };
window.markInvoicePaid = function(id, type) { State.set(s=>{ const arr = type==='issued' ? s.invoicesIssued : s.invoicesReceived; const inv = arr.find(i=>i.id===id); if(inv) { inv.status='paid'; inv.updatedAt = now(); if (type==='issued' && inv.linkedTransactionId) { const tx = s.transactions.find(t=>t.id===inv.linkedTransactionId || t.invoiceRef===inv.number); if (tx) tx.paymentStatus = 'paid'; } } }); showToast('Rechnung als bezahlt markiert','success'); UI.render('invoices'); };
window.deleteInvoice = function(id, type) { confirm('Rechnung löschen?', ()=>{ State.set(s=>{ const arr = type==='issued' ? s.invoicesIssued : s.invoicesReceived; const inv = arr.find(i=>i.id===id); if (type==='issued' && inv?.linkedTransactionId) s.transactions = s.transactions.filter(t=>t.id!==inv.linkedTransactionId); if(type==='issued') s.invoicesIssued=s.invoicesIssued.filter(i=>i.id!==id); else s.invoicesReceived=s.invoicesReceived.filter(i=>i.id!==id); }); showToast('Rechnung gelöscht','warn'); UI.render('invoices'); }); };

// ── ANLAGEVERMÖGEN ─────────────────────────────────────────
Pages.assets = function() {
  const s = State.get();
  return `
    <div class="section-header">
      <div><div class="section-title">Anlagevermögen</div><div class="section-sub">${s.assets.length} Einträge</div></div>
      <button class="btn btn-primary btn-sm" onclick="openAssetModal()">+ Neues Wirtschaftsgut</button>
    </div>
    ${s.assets.length ? `<div class="card" style="padding:0"><div class="table-wrap"><table>
      <thead><tr><th>Bezeichnung</th><th>Datum</th><th>Kategorie</th><th class="text-right">Anschaffungskosten</th><th>Nutzungsdauer</th><th class="text-right">Jährl. AfA</th><th></th></tr></thead>
      <tbody>
      ${s.assets.map(a=>{
        const dep = Tax.assetDepreciation(a);
        return `<tr>
          <td>${esc(a.name)}</td>
          <td class="mono">${fmtDate(a.purchaseDate)}</td>
          <td class="muted">${esc(a.category||'')}</td>
          <td class="text-right mono">${fmtMoney(a.acquisitionCost)}</td>
          <td class="text-center">${a.depreciationYears} Jahre</td>
          <td class="text-right mono">${fmtMoney(dep.annual)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openAssetModal('${a.id}')">✎</button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteAsset('${a.id}')" style="color:var(--red)">✕</button>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div></div>` : `<div class="empty"><div class="empty-icon">◈</div>Kein Anlagevermögen erfasst</div>`}`;
};

function openAssetModal(id) {
  const s = State.get(); const a = id ? s.assets.find(x=>x.id===id) : null;
  openModal(a?'Wirtschaftsgut bearbeiten':'Neues Wirtschaftsgut',
    `<div class="form-group"><label>Bezeichnung *</label><input type="text" id="a-name" value="${esc(a?.name||'')}"></div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>Anschaffungsdatum *</label><input type="date" id="a-date" value="${a?.purchaseDate||dateStr()}"></div>
       <div class="form-group"><label>Kategorie</label><input type="text" id="a-cat" value="${esc(a?.category||'')}" placeholder="IT-Ausstattung"></div>
     </div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>Anschaffungskosten (€) *</label><input type="number" id="a-cost" value="${a?.acquisitionCost||''}" step="0.01" min="0.01"></div>
       <div class="form-group"><label>Nutzungsdauer (Jahre) *</label><input type="number" id="a-yrs" value="${a?.depreciationYears||4}" min="1" max="40"></div>
     </div>
     <div class="form-group"><label>Notiz</label><textarea id="a-desc">${esc(a?.description||'')}</textarea></div>`,
    `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary btn-sm" onclick="saveAsset(${id?`'${id}'`:'null'})">Speichern</button>`);
}
window.openAssetModal = openAssetModal;
window.saveAsset = function(id) {
  const a = {
    id: id||uid(), name: document.getElementById('a-name').value,
    purchaseDate: document.getElementById('a-date').value,
    category: document.getElementById('a-cat').value,
    acquisitionCost: parseFloat(document.getElementById('a-cost').value)||0,
    depreciationYears: parseInt(document.getElementById('a-yrs').value)||4,
    description: document.getElementById('a-desc').value,
    createdAt: id?undefined:now(), updatedAt: now(),
  };
  const errors = Validate.asset(a);
  if (errors.length) { showToast(errors[0], 'error'); return; }
  State.set(s=>{
    const idx=s.assets.findIndex(x=>x.id===id);
    if(idx>=0){a.createdAt=s.assets[idx].createdAt;s.assets[idx]=a;}else s.assets.push(a);
  });
  closeModal(); showToast('Wirtschaftsgut gespeichert','success'); UI.render('assets');
};
window.deleteAsset = function(id) {
  confirm('Wirtschaftsgut löschen?',()=>{ State.set(s=>{s.assets=s.assets.filter(a=>a.id!==id);}); showToast('Gelöscht','warn'); UI.render('assets'); });
};

// ── DIVIDENDEN ─────────────────────────────────────────────
Pages.dividends = function() {
  const s = State.get();
  const whtRate = s.settings.dividendWhtRate || DIVIDEND_DEFAULT_WHT;
  const totalGross = s.dividends.reduce((a,d)=>a+(d.grossDividend||0),0);
  const totalWht = s.dividends.reduce((a,d)=>a+(d.whtAmount||0),0);
  const totalNet = s.dividends.reduce((a,d)=>a+(d.netPayout||0),0);
  return `
    <div class="section-header">
      <div><div class="section-title">Dividenden</div><div class="section-sub">${s.dividends.length} Einträge <span class="config-badge">KONFIGURIERBAR</span></div></div>
      <button class="btn btn-primary btn-sm" onclick="openDividendModal()">+ Neue Dividende</button>
    </div>
    <div class="info-bar">ℹ Dividenden sind keine Betriebsausgaben. Kapitalertragsteuer: ${fmtPct(whtRate)}. <strong>Aktuellen Steuersatz bitte mit dem Steuerberater abstimmen.</strong></div>
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><div class="card-title">Bruttodividende</div><div class="card-value mono">${fmtMoney(totalGross)}</div></div>
      <div class="card"><div class="card-title">Kapitalertragsteuer</div><div class="card-value yellow">${fmtMoney(totalWht)}</div></div>
      <div class="card"><div class="card-title">Nettauszahlung</div><div class="card-value green">${fmtMoney(totalNet)}</div></div>
    </div>
    ${s.dividends.length ? `<div class="card" style="padding:0"><div class="table-wrap"><table>
      <thead><tr><th>Gewinnjahr</th><th>Beschluss</th><th>Auszahlung</th><th class="text-right">Brutto</th><th class="text-right">KESt %</th><th class="text-right">KESt Betrag</th><th class="text-right">Netto</th><th>Notiz</th><th></th></tr></thead>
      <tbody>
      ${s.dividends.map(d=>`<tr>
        <td class="mono">${d.profitYear||'–'}</td>
        <td class="mono">${fmtDate(d.resolutionDate)}</td>
        <td class="mono">${fmtDate(d.paymentDate)}</td>
        <td class="text-right mono">${fmtMoney(d.grossDividend)}</td>
        <td class="text-right mono">${fmtPct(d.whtRate||whtRate)}</td>
        <td class="text-right mono red">${fmtMoney(d.whtAmount)}</td>
        <td class="text-right mono green">${fmtMoney(d.netPayout)}</td>
        <td class="muted">${esc(d.shareholderNote||'')}</td>
        <td><button class="btn btn-ghost btn-icon btn-sm" onclick="deleteDividend('${d.id}')" style="color:var(--red)">✕</button></td>
      </tr>`).join('')}
      </tbody>
    </table></div></div>` : `<div class="empty"><div class="empty-icon">◎</div>Keine Dividendeneinträge vorhanden</div>`}`;
};

function openDividendModal() {
  const s = State.get(); const whtRate = s.settings.dividendWhtRate || DIVIDEND_DEFAULT_WHT;
  openModal('Neue Dividende',
    `<div class="form-row form-row-2">
      <div class="form-group"><label>Gewinnjahr</label><input type="number" id="d-yr" value="${s.settings.accountingYear}" min="2000"></div>
      <div class="form-group"><label>Beschlussdatum</label><input type="date" id="d-res" value="${dateStr()}"></div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group"><label>Auszahlungsdatum</label><input type="date" id="d-pay" value="${dateStr()}"></div>
      <div class="form-group"><label>Bruttodividende (€)</label><input type="number" id="d-gross" step="0.01" min="0.01" oninput="calcDividend()"></div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group"><label>KESt-Satz (%) <span class="config-badge">KONFIGURIERBAR</span></label><input type="number" id="d-wht" value="${(whtRate*100).toFixed(0)}" min="0" max="100" step="0.5" oninput="calcDividend()"></div>
      <div class="form-group"><label>Nettoauszahlung (€)</label><input type="number" id="d-net" readonly style="opacity:.6"></div>
    </div>
    <div class="form-group"><label>Notiz zum Gesellschafter</label><input type="text" id="d-note" placeholder="Name / Anteil"></div>
    <div class="tax-notice">* Der KESt-Satz muss mit einem Steuerberater abgestimmt werden. Die Höhe hängt von den jeweiligen Umständen ab.</div>`,
    `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary btn-sm" onclick="saveDividend()">Speichern</button>`);
}
window.openDividendModal = openDividendModal;
window.calcDividend = function() {
  const gross = parseFloat(document.getElementById('d-gross')?.value)||0;
  const whtPct = parseFloat(document.getElementById('d-wht')?.value)||0;
  const wht = Math.round(gross * whtPct/100 * 100)/100;
  const netEl = document.getElementById('d-net'); if(netEl) netEl.value=(gross-wht).toFixed(2);
};
window.saveDividend = function() {
  const gross = parseFloat(document.getElementById('d-gross').value)||0;
  const whtPct = parseFloat(document.getElementById('d-wht').value)||0;
  const whtAmt = Math.round(gross*whtPct/100*100)/100;
  if (!gross||gross<=0) { showToast('Bitte gültigen Betrag eingeben','error'); return; }
  State.set(s=>s.dividends.push({
    id: uid(), profitYear: parseInt(document.getElementById('d-yr').value),
    resolutionDate: document.getElementById('d-res').value,
    paymentDate: document.getElementById('d-pay').value,
    grossDividend: gross, whtRate: whtPct/100, whtAmount: whtAmt,
    netPayout: gross-whtAmt, shareholderNote: document.getElementById('d-note').value,
    createdAt: now(), updatedAt: now(),
  }));
  closeModal(); showToast('Dividende gespeichert','success'); UI.render('dividends');
};
window.deleteDividend = function(id) {
  confirm('Dividendeneintrag löschen?',()=>{ State.set(s=>{s.dividends=s.dividends.filter(d=>d.id!==id);}); showToast('Gelöscht','warn'); UI.render('dividends'); });
};

// ── GESCHÄFTSPARTNER ───────────────────────────────────────
Pages.counterparties = function() {
  const s = State.get();
  return `
    <div class="section-header">
      <div><div class="section-title">Geschäftspartner</div><div class="section-sub">${s.counterparties.length} Partner</div></div>
      <button class="btn btn-primary btn-sm" onclick="openCpModal()">+ Neuer Partner</button>
    </div>
    <div class="card" style="padding:0"><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Adresse</th><th>Steuerdaten</th><th>Kontakt</th><th>Typ</th><th></th></tr></thead>
      <tbody>
      ${s.counterparties.length ? s.counterparties.map(c=>`<tr>
        <td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.country||'')}</span></td>
        <td class="muted">${esc([c.address, c.address2, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–')}</td>
        <td class="mono muted">IČO: ${esc(c.ico||'–')}<br>DIČ: ${esc(c.dic||'–')}<br>USt.-ID: ${esc(c.vatNumber||'–')}</td>
        <td class="muted">${esc(c.contactPerson||'–')}<br>${esc(c.email||'–')}</td>
        <td>${c.type==='customer'?'<span class="badge badge-blue">Kunde</span>':c.type==='supplier'?'<span class="badge badge-purple">Lieferant</span>':'<span class="badge badge-gray">Beides</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openCpModal('${c.id}')">Bearbeiten</button> <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteCp('${c.id}')" style="color:var(--red)">✕</button></td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Keine Geschäftspartner</div></td></tr>'}
      </tbody>
    </table></div></div>`;
};
function openCpModal(id=null) {
  const s = State.get();
  const cp = id ? s.counterparties.find(x => x.id === id) : null;
  openModal(cp ? 'Geschäftspartner bearbeiten' : 'Neuer Geschäftspartner',
    `<div class="form-group"><label>Name *</label><input type="text" id="cp-name" value="${esc(cp?.name||'')}" placeholder="Firma GmbH"></div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>Land</label><input type="text" id="cp-country" value="${esc(cp?.country||'DE')}" maxlength="2"></div>
       <div class="form-group"><label>Typ</label><select id="cp-type"><option value="customer" ${cp?.type==='customer'?'selected':''}>Kunde</option><option value="supplier" ${cp?.type==='supplier'?'selected':''}>Lieferant</option><option value="both" ${!cp || cp?.type==='both'?'selected':''}>Beides</option></select></div>
     </div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>Straße / Adresszeile 1</label><input type="text" id="cp-address" value="${esc(cp?.address||'')}"></div>
       <div class="form-group"><label>Adresszeile 2</label><input type="text" id="cp-address2" value="${esc(cp?.address2||'')}"></div>
     </div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>PLZ</label><input type="text" id="cp-zip" value="${esc(cp?.zip||'')}"></div>
       <div class="form-group"><label>Stadt</label><input type="text" id="cp-city" value="${esc(cp?.city||'')}"></div>
     </div>
     <div class="form-row form-row-3">
       <div class="form-group"><label>IČO / Registernummer</label><input type="text" id="cp-ico" value="${esc(cp?.ico||'')}"></div>
       <div class="form-group"><label>DIČ / Steuernummer</label><input type="text" id="cp-dic" value="${esc(cp?.dic||'')}"></div>
       <div class="form-group"><label>USt.-ID / UID</label><input type="text" id="cp-vat" value="${esc(cp?.vatNumber||'')}"></div>
     </div>
     <div class="form-row form-row-2">
       <div class="form-group"><label>Ansprechpartner</label><input type="text" id="cp-contact" value="${esc(cp?.contactPerson||'')}"></div>
       <div class="form-group"><label>Telefon</label><input type="text" id="cp-phone" value="${esc(cp?.phone||'')}"></div>
     </div>
     <div class="form-group"><label>E-Mail</label><input type="email" id="cp-email" value="${esc(cp?.email||'')}"></div>
     <div class="form-group"><label>Notiz</label><textarea id="cp-notes">${esc(cp?.notes||'')}</textarea></div>`,
    `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary btn-sm" onclick="saveCp(${id?`'${id}'`:'null'})">Speichern</button>`);
}
window.openCpModal = openCpModal;
window.saveCp = function(id=null) {
  const name = document.getElementById('cp-name').value.trim();
  if (!name) { showToast('Name ist erforderlich','error'); return; }
  const payload = {
    id: id || uid(), name,
    country: document.getElementById('cp-country').value,
    type: document.getElementById('cp-type').value,
    address: document.getElementById('cp-address').value,
    address2: document.getElementById('cp-address2').value,
    zip: document.getElementById('cp-zip').value,
    city: document.getElementById('cp-city').value,
    ico: document.getElementById('cp-ico').value,
    dic: document.getElementById('cp-dic').value,
    vatNumber: document.getElementById('cp-vat').value,
    contactPerson: document.getElementById('cp-contact').value,
    phone: document.getElementById('cp-phone').value,
    email: document.getElementById('cp-email').value,
    notes: document.getElementById('cp-notes').value,
    updatedAt: now(),
    createdAt: id ? undefined : now(),
  };
  State.set(s=>{
    const idx = s.counterparties.findIndex(c=>c.id===id);
    if (idx >= 0) {
      payload.createdAt = s.counterparties[idx].createdAt || now();
      s.counterparties[idx] = { ...s.counterparties[idx], ...payload };
    } else {
      s.counterparties.push(payload);
    }
  });
  closeModal(); showToast('Partner gespeichert','success'); UI.render('counterparties');
};
window.deleteCp = function(id) {
  confirm('Geschäftspartner löschen?',()=>{ State.set(s=>{s.counterparties=s.counterparties.filter(c=>c.id!==id);}); showToast('Gelöscht','warn'); UI.render('counterparties'); });
};

// ── STEUERN ────────────────────────────────────────────────
Pages.taxes = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const vat = Tax.vatSummary(s.transactions, yr, null);
  const cit = Tax.citEstimate(s.transactions, yr);
  const ftt = Tax.fttSummary(s.transactions, yr);
  const divWht = s.dividends.filter(d=>d.profitYear===yr).reduce((a,d)=>a+(d.whtAmount||0),0);
  const quarterVAT = [1,2,3,4].map(q=>({ q, ...Tax.vatSummary(s.transactions, yr, q) }));
  return `
    <div class="section-header"><div class="section-title">Steuerübersicht ${yr}</div></div>
    <div class="warning-bar">⚠ Diese Übersicht ist UNVERBINDLICH. Kein Ersatz für steuerliche oder buchhalterische Beratung.</div>
    <div class="info-bar">Für die Transaktionssteuer verwendet die App nun standardmäßig die gesetzliche Logik mit steuerpflichtigen Belastungen, Barabhebungen und Kartengebühr. Die Parameter können in den Einstellungen angepasst werden.</div>
    <div class="grid grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">Umsatzsteuer (gesamtes Jahr)</div>
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Ausgangs-USt.</span><span class="mono red">${fmtMoney(vat.outputVat)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Vorsteuer</span><span class="mono green">${fmtMoney(vat.inputVat)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Reverse-Charge-Basis</span><span class="mono">${fmtMoney(vat.rcBase)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600"><span>${vat.balance>=0?'Zahllast':'Vorsteuerüberhang'}</span><span class="mono ${vat.balance>=0?'red':'green'}">${fmtMoney(Math.abs(vat.balance))}</span></div>
        </div>
        <div class="card-title" style="margin-top:12px">USt. nach Quartal</div>
        ${quarterVAT.map(q=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px"><span class="muted">Q${q.q}</span><span>Ausgang: <span class="mono">${fmtMoney(q.outputVat)}</span> · Vorsteuer: <span class="mono">${fmtMoney(q.inputVat)}</span> · Saldo: <span class="mono ${q.balance>=0?'red':'green'}">${fmtMoney(q.balance)}</span></span></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">Körperschaftsteuer (KSt) <span class="config-badge">KONFIGURIERBAR</span></div>
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Steuerpflichtige Einnahmen</span><span class="mono">${fmtMoney(cit.revenue)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Abzugsfähige Ausgaben</span><span class="mono">${fmtMoney(cit.expenses)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Gewinn</span><span class="mono">${fmtMoney(cit.profit)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Bemessungsgrundlage</span><span class="mono">${fmtMoney(cit.taxBase)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Steuersatz</span><span class="mono">${fmtPct(cit.rate)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Berechnete KSt</span><span class="mono">${fmtMoney(cit.citEstimated)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Mindeststeuer</span><span class="mono">${fmtMoney(cit.minTax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600"><span>Geschätzte KSt</span><span class="mono yellow">${fmtMoney(cit.taxPayable)}</span></div>
        </div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Kapitalertragsteuer auf Dividenden <span class="config-badge">KONFIGURIERBAR</span></div>
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span class="muted">Jahr ${yr} – gesamt</span><span class="mono">${fmtMoney(divWht)}</span></div>
          <div class="tax-notice">Der Steuersatz hängt vom Wohnsitzland des Gesellschafters und dem geltenden Doppelbesteuerungsabkommen ab.</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Transaktionssteuer (DzFT) <span class="config-badge">KONFIGURIERBAR</span></div>
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Automatische Belastungen</span><span class="mono">${fmtMoney(ftt.autoDebitTax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Manuell steuerpflichtig markiert</span><span class="mono">${fmtMoney(ftt.manualDebitTax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Barabhebungen</span><span class="mono">${fmtMoney(ftt.cashTax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Unternehmenskarten (jährlich)</span><span class="mono">${fmtMoney(ftt.cardFee)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Bemessungsgrundlage Belastungen</span><span class="mono">${fmtMoney(ftt.taxableDebitBase)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">Interne / befreite Bewegungen</span><span class="mono">${ftt.internalCount + ftt.exemptCount}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600"><span>DzFT gesamt</span><span class="mono yellow">${fmtMoney(ftt.total)}</span></div>
          <div class="tax-notice">Standardlogik: Ausgaben ab Wirksamkeitsdatum werden automatisch als steuerpflichtige Belastungen behandelt. Einnahmen werden nicht automatisch belastet. Ausnahmen können pro Buchung über „FTT-Klassifizierung“ gesetzt werden.</div>
        </div>
      </div>
    </div>`;
};

// ── BERICHTE ───────────────────────────────────────────────
Pages.reports = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const txns = s.transactions.filter(t=>t.date&&t.date.startsWith(String(yr)));
  const byCustomer = {};
  txns.filter(t=>t.type==='income').forEach(t=>{
    const k = t.counterpartyId||'_none';
    byCustomer[k] = (byCustomer[k]||0) + (t.netAmount||0);
  });
  const byCat = {};
  txns.filter(t=>t.type==='expense').forEach(t=>{
    const k = t.category||'Sonstiges';
    byCat[k] = (byCat[k]||0) + (t.grossAmount||0);
  });
  const monthly = {};
  for (let m=1;m<=12;m++) { monthly[m]={income:0,expense:0}; }
  txns.forEach(t=>{
    const m = parseInt(t.date.slice(5,7));
    if (t.type==='income') monthly[m].income += (t.netAmount||0);
    else monthly[m].expense += (t.grossAmount||0);
  });
  const monthNames=['','Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `
    <div class="section-header">
      <div><div class="section-title">Berichte</div><div class="section-sub">${yr}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="exportCSV()">⬇ CSV Buchungen</button>
        <button class="btn btn-ghost btn-sm" onclick="exportTaxCSV()">⬇ CSV Steuerübersicht</button>
      </div>
    </div>
    <div class="grid grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">Monatliche Übersicht</div>
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>Monat</th><th class="text-right">Einnahmen</th><th class="text-right">Ausgaben</th><th class="text-right">Gewinn</th></tr></thead>
            <tbody>
            ${Object.entries(monthly).map(([m,v])=>{
              const profit=v.income-v.expense;
              return `<tr><td>${monthNames[parseInt(m)]}</td><td class="text-right mono green">${fmtMoney(v.income)}</td><td class="text-right mono red">${fmtMoney(v.expense)}</td><td class="text-right mono ${profit>=0?'green':'red'}">${fmtMoney(profit)}</td></tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Einnahmen nach Kunde</div>
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>Partner</th><th class="text-right">Betrag</th></tr></thead>
            <tbody>
            ${Object.entries(byCustomer).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(cpName(k==='_none'?null:k))}</td><td class="text-right mono green">${fmtMoney(v)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Ausgaben nach Kategorie</div>
      <div class="table-wrap" style="margin-top:8px">
        <table>
          <thead><tr><th>Kategorie</th><th class="text-right">Betrag</th><th>Anteil</th></tr></thead>
          <tbody>
          ${(()=>{
            const total = Object.values(byCat).reduce((a,v)=>a+v,0)||1;
            return Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr>
              <td>${esc(k)}</td>
              <td class="text-right mono red">${fmtMoney(v)}</td>
              <td><div style="display:flex;align-items:center;gap:8px"><div style="width:80px;height:6px;background:var(--border);border-radius:3px"><div style="width:${Math.round(v/total*100)}%;height:6px;background:var(--red);border-radius:3px"></div></div>${(v/total*100).toFixed(1)}%</div></td>
            </tr>`).join('');
          })()}
          </tbody>
        </table>
      </div>
    </div>`;
};

// ── EINSTELLUNGEN ──────────────────────────────────────────
Pages.settings = function() {
  const s = State.get(); const c = s.company; const cfg = s.settings;
  return `
    <div class="section-title" style="margin-bottom:16px">Einstellungen</div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Unternehmensprofil</div>
        <div class="form-group" style="margin-top:8px"><label>Name</label><input type="text" id="s-name" value="${esc(c.name)}"></div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>IČO (Reg.-Nr.)</label><input type="text" id="s-ico" value="${esc(c.ico)}"></div>
          <div class="form-group"><label>DIČ (Steuer-Nr.)</label><input type="text" id="s-dic" value="${esc(c.dic)}"></div>
        </div>
        <div class="form-group"><label>IČ DPH (USt.-ID)</label><input type="text" id="s-icdph" value="${esc(c.icDph)}"></div>
        <div class="form-group"><label>Adresse</label><input type="text" id="s-addr" value="${esc(c.address)}"></div>
        <div class="form-row form-row-2">
          <div class="form-group"><label>Stadt</label><input type="text" id="s-city" value="${esc(c.city)}"></div>
          <div class="form-group"><label>PLZ</label><input type="text" id="s-zip" value="${esc(c.zip)}"></div>
        </div>
        <div class="form-row form-row-2"><div class="form-row form-row-2"><div class="form-group"><label>IBAN</label><input type="text" id="s-iban" value="${esc(c.bankIBAN)}"></div><div class="form-group"><label>BIC</label><input type="text" id="s-bic" value="${esc(c.bankBIC)}"></div></div><div class="form-group"><label>BIC</label><input type="text" id="s-bic" value="${esc(c.bankBIC)}"></div></div>
        <div class="form-group"><label>Logo für Rechnungen</label><input type="file" id="s-logo" accept="image/*"></div>
        ${c.logoDataUrl ? `<div style="margin-bottom:12px"><img src="${c.logoDataUrl}" alt="Logo" style="max-height:50px;max-width:180px;object-fit:contain"></div>` : ''}
        <button class="btn btn-primary btn-sm" onclick="saveCompany()">Profil speichern</button>
      </div>
      <div class="card">
        <div class="card-title">Steuereinstellungen</div>
        <div class="form-row form-row-2" style="margin-top:8px">
          <div class="form-group"><label>Geschäftsjahr</label><input type="number" id="s-yr" value="${cfg.accountingYear}" min="2020" max="2035"></div>
          <div class="form-group"><label>USt.-pflichtig</label><select id="s-vatreg"><option value="true" ${c.isVatRegistered?'selected':''}>Ja</option><option value="false" ${!c.isVatRegistered?'selected':''}>Nein</option></select></div>
        </div>
        <div class="form-group"><label>KESt-Satz auf Dividenden (%) <span class="config-badge">KONFIGURIERBAR</span></label><input type="number" id="s-divwht" value="${((cfg.dividendWhtRate||DIVIDEND_DEFAULT_WHT)*100).toFixed(0)}" min="0" max="100" step="0.5"></div>
        <div class="card-title" style="margin-top:12px">Transaktionssteuer (DzFT) <span class="config-badge">KONFIGURIERBAR</span></div>
        <div class="form-row form-row-3" style="margin-top:8px">
          <div class="form-group"><label>Wirksam ab</label><input type="date" id="s-ftt-from" value="${esc((cfg.fttRules||FTT_RULES).effectiveFrom || '2025-04-01')}"></div>
          <div class="form-group"><label>Belastungen (%)</label><input type="number" id="s-ftt-debit" value="${(((cfg.fttRules||FTT_RULES).debitRate||0)*100).toFixed(2)}" step="0.01" min="0"></div>
          <div class="form-group"><label>Barabhebung (%)</label><input type="number" id="s-ftt-cash" value="${(((cfg.fttRules||FTT_RULES).cashRate||0)*100).toFixed(2)}" step="0.01" min="0"></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label>Cap pro Belastung (€)</label><input type="number" id="s-ftt-cap" value="${(cfg.fttRules||FTT_RULES).debitCapPerTx ?? 40}" step="0.01" min="0"></div>
          <div class="form-group"><label>Unternehmenskarten (Anzahl)</label><input type="number" id="s-ftt-cards" value="${(cfg.fttRules||FTT_RULES).businessCardCount ?? 0}" min="0"></div>
          <div class="form-group"><label>Gebühr je Karte / Jahr (€)</label><input type="number" id="s-ftt-cardfee" value="${(cfg.fttRules||FTT_RULES).cardAnnualFee ?? 2}" step="0.01" min="0"></div>
        </div>
        <div class="tax-notice">Standardmäßig werden ab Wirksamkeitsdatum alle Ausgaben automatisch als steuerpflichtige Belastungen behandelt, sofern sie nicht explizit als befreit oder intern markiert sind. Einnahmen werden nicht automatisch belastet.</div>
        <hr class="sep">
        <div class="card-title">Rechnungsvorlage</div>
        <div class="form-row form-row-2" style="margin-top:8px"><div class="form-group"><label>Nächste Nummer</label><input type="number" id="s-inv-next" value="${(cfg.invoice||cfg).nextNumber || 1}" min="1"></div><div class="form-group"><label>Präfix</label><input type="text" id="s-inv-prefix" value="${esc((cfg.invoice||cfg).prefix || '')}" placeholder="RE-"></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label>Nummernformat</label><select id="s-inv-format"><option value="plain" ${((cfg.invoice||cfg).numberingFormat||'plain')==='plain'?'selected':''}>Nur laufende Nummer</option><option value="year-seq" ${((cfg.invoice||cfg).numberingFormat||'plain')==='year-seq'?'selected':''}>Jahr-Laufnummer</option><option value="prefix-year-seq" ${((cfg.invoice||cfg).numberingFormat||'plain')==='prefix-year-seq'?'selected':''}>Präfix-Jahr-Laufnummer</option></select></div><div class="form-group"><label>Zahlungsziel (Tage)</label><input type="number" id="s-inv-due" value="${(cfg.invoice||cfg).dueDays || 15}" min="1"></div></div>
        <div class="form-group"><label>Standard-Einleitung</label><textarea id="s-inv-intro">${esc((cfg.invoice||cfg).standardIntroText || '')}</textarea></div>
        <div class="form-group"><label>Standard-Zahlungsbedingungen</label><textarea id="s-inv-pay">${esc((cfg.invoice||cfg).standardPaymentTerms || '')}</textarea></div>
        <div class="form-group"><label>Standard-Reverse-Charge-Hinweis</label><textarea id="s-inv-rc">${esc((cfg.invoice||cfg).standardReverseChargeNote || '')}</textarea></div>
        <div class="form-group"><label>Signaturname</label><input type="text" id="s-inv-sign" value="${esc((cfg.invoice||cfg).signatureName || '')}"></div>
        <button class="btn btn-primary btn-sm" onclick="saveSettings()">Einstellungen speichern</button>
        <hr class="sep">
        <div class="card-title">Import / Export</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          <button class="btn btn-ghost btn-sm" onclick="UI.exportJSON()">⬇ Gesamten Zustand exportieren (JSON)</button>
          <button class="btn btn-ghost btn-sm" onclick="UI.importJSON()">⬆ Zustand importieren (JSON)</button>
          <button class="btn btn-ghost btn-sm" onclick="exportCSV()">⬇ Buchungen exportieren (CSV)</button>
        </div>
        <hr class="sep">
        <div class="card-title" style="color:var(--red)">Gefahrenzone</div>
        <button class="btn btn-danger btn-sm" style="margin-top:8px" onclick="resetApp()">♻ Anwendung zurücksetzen</button>
      </div>
    </div>`;
};

window.saveCompany = function() {
  State.set(s=>{
    s.company.name = document.getElementById('s-name').value;
    s.company.ico = document.getElementById('s-ico').value;
    s.company.dic = document.getElementById('s-dic').value;
    s.company.icDph = document.getElementById('s-icdph').value;
    s.company.address = document.getElementById('s-addr').value;
    s.company.city = document.getElementById('s-city').value;
    s.company.zip = document.getElementById('s-zip').value;
    s.company.bankIBAN = document.getElementById('s-iban').value;
    s.company.bankBIC = document.getElementById('s-bic').value;
    s.company.bankBIC = document.getElementById('s-bic').value;
  });
  const logoFile = document.getElementById('s-logo')?.files?.[0];
  if (logoFile) {
    const reader = new FileReader();
    reader.onload = ev => {
      State.set(st => { st.company.logoDataUrl = ev.target.result; });
      showToast('Profil inklusive Logo gespeichert','success');
      UI.render('settings');
    };
    reader.readAsDataURL(logoFile);
  } else {
    showToast('Profil gespeichert','success');
  }
};
window.saveSettings = function() {
  State.set(s=>{
    s.settings.accountingYear = parseInt(document.getElementById('s-yr').value);
    s.company.isVatRegistered = document.getElementById('s-vatreg').value==='true';
    s.settings.dividendWhtRate = parseFloat(document.getElementById('s-divwht').value)/100;
    s.settings.fttRules = {
      ...(s.settings.fttRules || FTT_RULES),
      effectiveFrom: document.getElementById('s-ftt-from').value || '2025-04-01',
      debitRate: (parseFloat(document.getElementById('s-ftt-debit').value) || 0) / 100,
      cashRate: (parseFloat(document.getElementById('s-ftt-cash').value) || 0) / 100,
      debitCapPerTx: parseFloat(document.getElementById('s-ftt-cap').value) || 0,
      cashCapPerTx: null,
      businessCardCount: parseInt(document.getElementById('s-ftt-cards').value, 10) || 0,
      cardAnnualFee: parseFloat(document.getElementById('s-ftt-cardfee').value) || 0,
    };
    s.settings.invoice = {
      ...(s.settings.invoice || defaultInvoiceSettings()),
      nextNumber: parseInt(document.getElementById('s-inv-next').value, 10) || 1,
      prefix: document.getElementById('s-inv-prefix').value || '',
      numberingFormat: document.getElementById('s-inv-format').value,
      dueDays: parseInt(document.getElementById('s-inv-due').value, 10) || 15,
      standardIntroText: document.getElementById('s-inv-intro').value,
      standardPaymentTerms: document.getElementById('s-inv-pay').value,
      standardReverseChargeNote: document.getElementById('s-inv-rc').value,
      signatureName: document.getElementById('s-inv-sign').value,
    };
  });
  showToast('Einstellungen gespeichert','success'); UI.render(UI.currentTab);
};
window.resetApp = function() {
  confirm('Wirklich alle Daten zurücksetzen? Diese Aktion ist unwiderruflich!', ()=>{
    State.reset(); showToast('Anwendung zurückgesetzt','warn'); UI.render('dashboard');
  });
};

// ── EXPORTE ────────────────────────────────────────────────
window.exportCSV = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const txns = s.transactions.filter(t=>t.date&&t.date.startsWith(String(yr)));
  const rows = [['Datum','Typ','Kategorie','Partner','Beschreibung','Steuerl. Einordnung','Netto','USt.-Satz','USt.-Betrag','Brutto','Zahlungsstatus','Belegnummer','Abzugsfähig']];
  txns.forEach(t=>rows.push([
    t.date, t.type==='income'?'Einnahme':'Ausgabe', t.category||'', cpName(t.counterpartyId),
    t.description, t.vatTreatment||'',
    t.netAmount, t.vatRate, t.vatAmount, t.grossAmount,
    t.paymentStatus==='paid'?'Bezahlt':'Offen', t.invoiceRef||'', t.deductible!==false?'Ja':'Nein'
  ]));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`buchungen-${yr}.csv`; a.click();
  showToast('CSV exportiert','success');
};
window.exportTaxCSV = function() {
  const s = State.get(); const yr = s.settings.accountingYear;
  const vat = Tax.vatSummary(s.transactions, yr, null);
  const cit = Tax.citEstimate(s.transactions, yr);
  const rows = [['Kennzahl','Wert'],
    ['Jahr', yr],['Einnahmen (netto)', cit.revenue],['Ausgaben', cit.expenses],
    ['Gewinn', cit.profit],['Körperschaftsteuer-Basis', cit.taxBase],['Steuersatz KSt', cit.rate],
    ['Geschätzte KSt', cit.taxPayable],['Mindeststeuer', cit.minTax],
    ['Ausgangs-USt.', vat.outputVat],['Vorsteuer', vat.inputVat],['USt.-Saldo', vat.balance],
    ['DzFT automatische Belastungen', Tax.fttSummary(s.transactions, yr).autoDebitTax],['DzFT manuelle Belastungen', Tax.fttSummary(s.transactions, yr).manualDebitTax],['DzFT Barabhebungen', Tax.fttSummary(s.transactions, yr).cashTax],['DzFT Kartengebühr', Tax.fttSummary(s.transactions, yr).cardFee],['DzFT gesamt', Tax.fttSummary(s.transactions, yr).total],
  ];
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`steueruebersicht-${yr}.csv`; a.click();
  showToast('Steuerübersicht CSV exportiert','success');
};

// ============================================================
// MODUL: UI-CONTROLLER
// ============================================================
const UI = (() => {
  let _tab = 'dashboard';
  const TITLES = {
    dashboard:'Dashboard', income:'Einnahmen', expenses:'Ausgaben',
    transactions:'Alle Buchungen', invoices:'Rechnungen', assets:'Anlagevermögen',
    dividends:'Dividenden', counterparties:'Geschäftspartner',
    taxes:'Steuern', reports:'Berichte', settings:'Einstellungen',
  };

  function syncYearSwitcher() {
    const s = State.get();
    const el = document.getElementById('year-switcher');
    if (!el) return;
    const current = String(s.settings.accountingYear || new Date().getFullYear());
    el.innerHTML = yearsWithData().map(y => `<option value="${y}" ${String(y)===current?'selected':''}>${y}</option>`).join('');
  }

  function render(tab, opts) {
    _tab = tab;
    document.querySelectorAll('.nav-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.tab===tab);
    });
    document.getElementById('topbar-title').textContent = TITLES[tab]||tab;
    const s = State.get();
    document.getElementById('topbar-period').textContent = `Geschäftsjahr ${s.settings.accountingYear}`;
    syncYearSwitcher();
    const page = Pages[tab];
    const content = document.getElementById('content');
    content.innerHTML = page ? page(opts) : `<div class="empty">Seite nicht gefunden</div>`;
    content.scrollTop = 0;
  }

  function exportJSON() { State.exportJSON(); showToast('JSON exportiert','success'); }
  function importJSON() { document.getElementById('file-input').click(); }
  function changeYear(year) {
    State.set(s => { s.settings.accountingYear = parseInt(year, 10); });
    render(_tab);
  }

  return { render, exportJSON, importJSON, changeYear, get currentTab() { return _tab; } };
})();

