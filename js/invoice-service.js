function buildInvoiceNumber(previewYear=null) {
  const s = State.get();
  const cfg = s.settings.invoice || defaultInvoiceSettings();
  const year = String(previewYear || s.settings.accountingYear || new Date().getFullYear());
  const next = String(cfg.nextNumber || 1).padStart(4, '0');
  const prefix = cfg.prefix || '';
  const fmt = cfg.numberingFormat || 'plain';
  if (fmt === 'year-seq') return `${year}-${next}`;
  if (fmt === 'prefix-year-seq') return `${prefix || 'RE'}-${year}-${next}`;
  if (prefix) return `${prefix}${next}`;
  return next;
}
function invoiceTypeFromVatTreatment(vatTreatment) {
  if (vatTreatment === 'eu_b2b_rc_income') return 'reverse_charge';
  if (vatTreatment === 'vat_exempt') return 'vat_exempt';
  return 'standard';
}
function normalizeInvoice(raw, kind='issued', idx=0) {
  const s = State.get ? State.get() : null;
  const settings = s?.settings?.invoice || defaultInvoiceSettings();
  const company = s?.company || {};
  const cp = raw.counterpartyId && s ? getCounterpartyById(raw.counterpartyId) : null;
  const oldAmount = moneyRound(raw.amount || raw.grossAmount || 0);
  const lineItems = (raw.lineItems && raw.lineItems.length ? raw.lineItems : [{
    id: uid(),
    positionNumber: 1,
    description: raw.description || raw.vs || raw.notes || 'Leistung',
    quantity: 1,
    unit: settings.defaultUnit || 'h',
    unitPrice: oldAmount,
    vatRate: raw.vatRate || 0,
  }]).map((line, lineIdx) => {
    const quantity = parseFloat(line.quantity || 1) || 1;
    const unitPrice = moneyRound(line.unitPrice != null ? line.unitPrice : line.lineNetAmount || 0);
    const vatRate = parseFloat(line.vatRate || 0) || 0;
    const lineNetAmount = moneyRound(line.lineNetAmount != null ? line.lineNetAmount : quantity * unitPrice);
    const vatAmount = moneyRound(line.vatAmount != null ? line.vatAmount : lineNetAmount * vatRate);
    return {
      id: line.id || uid(),
      positionNumber: line.positionNumber || lineIdx + 1,
      description: line.description || 'Leistung',
      quantity,
      unit: line.unit || settings.defaultUnit || 'h',
      unitPrice,
      lineNetAmount,
      vatRate,
      vatAmount,
      lineGrossAmount: moneyRound(line.lineGrossAmount != null ? line.lineGrossAmount : lineNetAmount + vatAmount),
    };
  });
  const subtotalNet = moneyRound(lineItems.reduce((a, line) => a + line.lineNetAmount, 0));
  const totalVat = moneyRound(lineItems.reduce((a, line) => a + line.vatAmount, 0));
  const totalGross = moneyRound(lineItems.reduce((a, line) => a + line.lineGrossAmount, 0));
  const issueDate = raw.issueDate || raw.date || dateStr();
  const dueDate = raw.dueDate || addDays(issueDate, settings.dueDays || 15);
  const vatTreatment = raw.vatTreatment || (kind === 'issued' ? 'eu_b2b_rc_income' : 'domestic_taxable_expense');
  const invoiceType = raw.invoiceType || invoiceTypeFromVatTreatment(vatTreatment);
  const sender = {
    companyName: raw.senderSnapshot?.companyName || company.name || 'BE-Coding s.r.o.',
    addressLine: raw.senderSnapshot?.addressLine || company.address || '',
    zip: raw.senderSnapshot?.zip || company.zip || '',
    city: raw.senderSnapshot?.city || company.city || '',
    country: raw.senderSnapshot?.country || company.country || 'SK',
    ico: raw.senderSnapshot?.ico || company.ico || '',
    dic: raw.senderSnapshot?.dic || company.dic || '',
    icDph: raw.senderSnapshot?.icDph || company.icDph || '',
    iban: raw.senderSnapshot?.iban || company.bankIBAN || '',
    bic: raw.senderSnapshot?.bic || company.bankBIC || '',
    logoDataUrl: raw.senderSnapshot?.logoDataUrl || company.logoDataUrl || '',
  };
  const recipient = {
    customerName: raw.recipientSnapshot?.customerName || cp?.name || '',
    addressLine1: raw.recipientSnapshot?.addressLine1 || cp?.addressLine1 || cp?.address || '',
    addressLine2: raw.recipientSnapshot?.addressLine2 || cp?.addressLine2 || '',
    zip: raw.recipientSnapshot?.zip || cp?.zip || '',
    city: raw.recipientSnapshot?.city || cp?.city || '',
    country: raw.recipientSnapshot?.country || cp?.country || '',
    vatId: raw.recipientSnapshot?.vatId || cp?.vatNumber || '',
    taxNumber: raw.recipientSnapshot?.taxNumber || cp?.dic || '',
    registrationNumber: raw.recipientSnapshot?.registrationNumber || cp?.ico || '',
    contactPerson: raw.recipientSnapshot?.contactPerson || cp?.contactPerson || raw.contactPerson || '',
  };
  const taxNoteText = raw.taxNoteText || (invoiceType === 'reverse_charge' ? settings.standardReverseChargeNote : settings.standardVatNote);
  return {
    id: raw.id || uid(),
    // Keep the cloud revision for optimistic writes after State.migrate().
    version: raw.version ?? null,
    number: raw.number || raw.invoiceNumber || (raw.deferNumber ? '' : `${String(idx + 1).padStart(4, '0')}`),
    invoiceNumber: raw.invoiceNumber || raw.number || (raw.deferNumber ? '' : `${String(idx + 1).padStart(4, '0')}`),
    invoiceType,
    issueDate,
    dueDate,
    servicePeriodFrom: raw.servicePeriodFrom || issueDate,
    servicePeriodTo: raw.servicePeriodTo || issueDate,
    currency: raw.currency || 'EUR',
    status: raw.status || 'draft',
    counterpartyId: raw.counterpartyId || '',
    contactPerson: raw.contactPerson || recipient.contactPerson || '',
    introText: raw.introText || settings.standardIntroText,
    paymentTermsText: raw.paymentTermsText || settings.standardPaymentTerms,
    taxNoteText,
    closingText: raw.closingText || settings.standardClosingText,
    internalNote: raw.internalNote || raw.notes || '',
    senderSnapshot: sender,
    recipientSnapshot: recipient,
    lineItems,
    subtotalNet,
    totalVat,
    totalGross,
    amount: totalGross,
    vatTreatment,
    reverseCharge: raw.reverseCharge != null ? !!raw.reverseCharge : invoiceType === 'reverse_charge',
    vatExempt: raw.vatExempt != null ? !!raw.vatExempt : invoiceType === 'vat_exempt',
    documentMeta: {
      createdAt: raw.documentMeta?.createdAt || raw.createdAt || now(),
      updatedAt: raw.documentMeta?.updatedAt || raw.updatedAt || now(),
      pdfFileNameSuggestion: raw.documentMeta?.pdfFileNameSuggestion || `Rechnung_${raw.number || raw.invoiceNumber || String(idx+1).padStart(4, '0')}.pdf`,
      lockedPdfSnapshot: raw.documentMeta?.lockedPdfSnapshot || null,
    },
    linkedTransactionId: raw.linkedTransactionId || null,
    deferNumber: !!raw.deferNumber,
    createdAt: raw.createdAt || now(),
    updatedAt: raw.updatedAt || now(),
  };
}
function invoiceStatusBadge(status) {
  const map = { draft:'<span class="badge badge-gray">Entwurf</span>', unpaid:'<span class="badge badge-yellow">Offen</span>', paid:'<span class="badge badge-green">Bezahlt</span>', partial:'<span class="badge badge-blue">Teilbezahlt</span>', cancelled:'<span class="badge badge-red">Storniert</span>' };
  return map[status] || '<span class="badge badge-gray">–</span>';
}
function invoiceTaxLabel(inv) {
  if (inv.reverseCharge) return 'Reverse Charge';
  if (inv.vatExempt) return 'USt.-frei';
  if ((inv.totalVat || 0) > 0) return 'mit USt.';
  return 'ohne USt.';
}

function getIssuedInvoiceIncomeRows(year) {
  const s = State.get();
  const invoices = (s.invoicesIssued || []).filter(i => i.issueDate && i.issueDate.startsWith(String(year)));
  const linkedTxIds = new Set(invoices.map(i => i.linkedTransactionId).filter(Boolean));
  const invoiceRows = invoices.map(inv => {
    const tx = (s.transactions || []).find(t => t.id === inv.linkedTransactionId || t.invoiceRef === inv.number);
    return {
      id: inv.id,
      rowType: 'invoice',
      date: inv.issueDate,
      number: inv.number,
      description: inv.lineItems?.[0]?.description || `Rechnung ${inv.number}`,
      counterpartyId: inv.counterpartyId,
      category: tx?.category || 'Rechnungsumsatz',
      netAmount: inv.subtotalNet || 0,
      vatAmount: inv.totalVat || 0,
      grossAmount: inv.totalGross || 0,
      paymentStatus: inv.status === 'paid' ? 'paid' : (inv.status === 'partial' ? 'partial' : 'unpaid'),
      vatTreatment: inv.vatTreatment || '',
      linkedTransactionId: tx?.id || null,
      attachments: [],
    };
  });
  const manualRows = (s.transactions || []).filter(t =>
    t.type === 'income' &&
    t.date &&
    t.date.startsWith(String(year)) &&
    !linkedTxIds.has(t.id) &&
    !(t.invoiceRef && invoices.some(inv => inv.number === t.invoiceRef))
  ).map(t => ({ ...t, rowType: 'manual', number: t.invoiceRef || '–' }));
  return [...invoiceRows, ...manualRows].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}

function syncIssuedInvoicesToIncomeTransactions() {
  State.set(s => {
    (s.invoicesIssued || []).forEach(inv => {
      const existingIdx = s.transactions.findIndex(t => t.id === inv.linkedTransactionId || t.invoiceRef === inv.number);
      const txId = existingIdx >= 0 ? s.transactions[existingIdx].id : (inv.linkedTransactionId || uid());
      const txData = {
        id: txId,
        date: inv.issueDate,
        type: 'income',
        category: s.transactions[existingIdx]?.category || 'Rechnungsumsatz',
        description: (inv.lineItems?.[0]?.description || `Rechnung ${inv.number}`).slice(0, 200),
        counterpartyId: inv.counterpartyId,
        netAmount: inv.subtotalNet || 0,
        vatRate: inv.subtotalNet ? ((inv.totalVat || 0) / inv.subtotalNet) : 0,
        vatAmount: inv.totalVat || 0,
        grossAmount: inv.totalGross || 0,
        vatTreatment: inv.vatTreatment || 'eu_b2b_rc_income',
        paymentStatus: inv.status === 'paid' ? 'paid' : (inv.status === 'partial' ? 'partial' : 'unpaid'),
        invoiceRef: inv.number,
        createdAt: s.transactions[existingIdx]?.createdAt || now(),
        updatedAt: now(),
        deductible: true,
        currency: inv.currency || 'EUR',
        attachments: s.transactions[existingIdx]?.attachments || []
      };
      inv.linkedTransactionId = txId;
      if (existingIdx >= 0) s.transactions[existingIdx] = { ...s.transactions[existingIdx], ...txData };
      else s.transactions.push(txData);
    });
  });
}
function generateInvoiceDocument(inv) {
  const cfg = State.get().settings.invoice || defaultInvoiceSettings();
  const sender = inv.senderSnapshot || {};
  const recipient = inv.recipientSnapshot || {};

  const senderLine = [
    sender.companyName || '',
    sender.addressLine || '',
    [sender.zip, sender.city].filter(Boolean).join(' ')
  ].filter(Boolean).join(' - ');

  const recipientLines = [
    recipient.customerName || '',
    recipient.addressLine1 || '',
    recipient.addressLine2 || '',
    [recipient.zip, recipient.city].filter(Boolean).join(' '),
    recipient.country === 'DE' ? 'Deutschland' : (recipient.country || '')
  ].filter(Boolean);

  const lineRows = (inv.lineItems || []).map(line => `
    <tr>
      <td>${esc(String(line.positionNumber || ''))}.</td>
      <td>${textToHtml(line.description || '')}</td>
      <td>${esc(formatQty(line.quantity))} ${esc(line.unit || '')}</td>
      <td>${fmtMoney(line.unitPrice)}</td>
      <td>${fmtMoney(line.lineNetAmount)}</td>
    </tr>
  `).join('');

  const issueDate = fmtDate(inv.issueDate);
  const issueDateDisplay = issueDate !== '–'
          ? `${issueDate.slice(8,10)}.${issueDate.slice(5,7)}.${issueDate.slice(0,4)}`
          : '–';

  const serviceFrom = fmtDate(inv.servicePeriodFrom);
  const serviceTo = fmtDate(inv.servicePeriodTo);

  const serviceFromDisplay = serviceFrom !== '–'
          ? `${serviceFrom.slice(8,10)}.${serviceFrom.slice(5,7)}.${serviceFrom.slice(0,4)}`
          : '–';

  const serviceToDisplay = serviceTo !== '–'
          ? `${serviceTo.slice(8,10)}.${serviceTo.slice(5,7)}.${serviceTo.slice(0,4)}`
          : '–';

  const reverseChargeNote = inv.taxNoteText
          ? textToHtml(inv.taxNoteText)
          : '';

  return `
  <div class="invoice-preview-shell">
    <div class="invoice-preview">
      <div class="invoice-top-line"></div>

      <div class="invoice-topbar">
        <div class="invoice-brand-title">RECHNUNG</div>
        <div class="invoice-logo-wrap">
          ${
          sender.logoDataUrl
                  ? `<img src="${sender.logoDataUrl}" alt="Logo">`
                  : `<div style="font-size:24px;font-weight:700;letter-spacing:.18em;">BE-CODING</div>`
  }
        </div>
      </div>

      <div class="invoice-company-line">${esc(senderLine)}</div>

      <div class="invoice-party-meta-row">
        <div class="invoice-party-block">
          ${recipientLines.map(line => `<div>${esc(line)}</div>`).join('')}
          ${recipient.vatId ? `<div class="uid-line">UID: ${esc(recipient.vatId)}</div>` : ''}
        </div>

        <div class="invoice-meta-right">
          <table class="invoice-meta-table">
            <tr>
              <td>Rechnung Nr.:</td>
              <td>${esc(inv.number || '')}</td>
            </tr>
            <tr>
              <td>Rechnungsdatum:</td>
              <td>${esc(issueDateDisplay)}</td>
            </tr>
            <tr>
              <td>Ansprechpartner:</td>
              <td>${textToHtml((inv.contactPerson || '').replace(/\s+/g, ' ').trim()).replace(' ', '<br>')}</td>
            </tr>
          </table>
          <div class="invoice-meta-date-right">${esc(issueDateDisplay)}</div>
        </div>
      </div>

      <div class="invoice-title-line">RECHNUNG NR. ${esc(inv.number || '')}</div>
      <div class="invoice-period">Leistungszeitraum: ${esc(serviceFromDisplay)} – ${esc(serviceToDisplay)}</div>

      <div class="invoice-body-text">${textToHtml(cfg.standardGreeting || 'Sehr geehrte Damen und Herren,')}</div>
      <div class="invoice-body-text">${textToHtml(inv.introText || '')}</div>

      <table class="invoice-table">
        <colgroup>
          <col><col><col><col><col>
        </colgroup>
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Beschreibung</th>
            <th>Menge</th>
            <th>Stundensatz</th>
            <th>Gesamtpreis</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
      </table>

      <div class="invoice-table-sep"></div>

      <div class="invoice-summary">
        <div class="invoice-summary-row">
          <span>Summe Netto</span>
          <span>${fmtMoney(inv.subtotalNet)}</span>
        </div>
        <div class="invoice-summary-row">
          <span>USt. ${fmtPct(inv.subtotalNet ? (inv.totalVat / inv.subtotalNet) : 0)}</span>
          <span>${fmtMoney(inv.totalVat)}</span>
        </div>
        <div class="invoice-summary-row total">
          <span>Gesamtsumme</span>
          <span>${fmtMoney(inv.totalGross)}</span>
        </div>
      </div>

      <div class="invoice-payment-line">
        Zahlungsbedingungen: ${textToHtml(inv.paymentTermsText || '')}
      </div>

      ${reverseChargeNote ? `<div class="invoice-tax-note">${reverseChargeNote}</div>` : ''}

      <div class="invoice-signoff">
        ${textToHtml(inv.closingText || '')}<br>
        ${esc(cfg.signatureName || '')}
      </div>

      <div class="invoice-footer">
        <div>${esc(sender.companyName || '')}</div>
        <div>${esc(sender.addressLine || '')}</div>
        <div>${esc([sender.city || '', sender.zip || ''].filter(Boolean).join(' '))}</div>

        <div class="invoice-footer-block">
          <div class="row"><div>IČO:</div><div>${esc(sender.ico || '')}</div></div>
          <div class="row"><div>DIČ:</div><div>${esc(sender.dic || '')}</div></div>
          <div class="row"><div>IČ DPH (VAT):</div><div>${esc(sender.icDph || '')}</div></div>
        </div>

        <div class="invoice-footer-block">
          <div class="row"><div>IBAN:</div><div>${esc(sender.iban || '')}</div></div>
          <div class="row"><div>BIC:</div><div>${esc(sender.bic || '')}</div></div>
        </div>
      </div>

      <div class="invoice-bottom-line"></div>
    </div>
  </div>`;
}
function openInvoicePreview(id, type='issued') {
  const s = State.get();
  const arr = type === 'issued' ? s.invoicesIssued : s.invoicesReceived;
  const inv = arr.find(i => i.id === id);
  if (!inv) return;
  openModal(`Rechnung ${inv.number} – Vorschau`, generateInvoiceDocument(inv), `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button><button class="btn btn-ghost btn-sm" onclick="printInvoice('${inv.id}','${type}', false)">Drucken</button><button class="btn btn-primary btn-sm" onclick="printInvoice('${inv.id}','${type}', true)">PDF erstellen</button>`, 'wide');
}
function printInvoice(id, type='issued', isPdf=true) {
  const s = State.get();
  const arr = type === 'issued' ? s.invoicesIssued : s.invoicesReceived;
  const inv = arr.find(i => i.id === id);
  if (!inv) return;
  const printRoot = document.getElementById('print-root');
  printRoot.innerHTML = generateInvoiceDocument(inv);
  document.body.classList.add('print-mode');
  const before = document.title;
  document.title = `Rechnung_${inv.number}`;
  setTimeout(() => {
    window.print();
    document.title = before;
    document.body.classList.remove('print-mode');
    printRoot.innerHTML = '';
    showToast(isPdf ? 'Druckdialog geöffnet – als PDF speichern' : 'Druckdialog geöffnet', 'success');
  }, 60);
}
window.openInvoicePreview = openInvoicePreview;
window.printInvoice = printInvoice;
