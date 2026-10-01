// ============================================================
// MODUL: ZUSTAND (STATE)
// ============================================================
const State = (() => {
  const STORAGE_KEY = 'becoding_v1';

  function empty() {
    return {
      schemaVersion: SCHEMA_VERSION,
      appMeta: { createdAt: now(), updatedAt: now() },
      company: {
        name: 'BE-Coding s.r.o.', ico: '55657648', dic: '2122045343', icDph: 'SK2122045343',
        address: 'Drotárska cesta 9', city: 'Bratislava', zip: '811 03', country: 'SK',
        isVatRegistered: true, vatRegisteredSince: '',
        bankIBAN: 'SK27 1100 0000 0029 4316 0244', bankBIC: 'TATRSKBX',
        logoDataUrl: '',
      },
      settings: {
        accountingYear: new Date().getFullYear(),
        currency: 'EUR',
        vatRates: DEFAULT_VAT_RATES,
        citRules: DEFAULT_CIT_RULES,
        minTaxRules: DEFAULT_MIN_TAX,
        fttRules: FTT_RULES,
        dividendWhtRate: DIVIDEND_DEFAULT_WHT,
        invoice: defaultInvoiceSettings(),
        schemaVersion: SCHEMA_VERSION,
      },
      counterparties: [],
      transactions: [],
      invoicesIssued: [],
      invoicesReceived: [],
      assets: [],
      dividends: [],
      vehicleRecords: [],
      auditLog: [],
      notes: [],
      attachments: {},
    };
  }

  let _state = null;
  let _authContext = { userId: null, companyId: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw, jsonSafeReviver);
        _state = migrate(parsed);
      } else {
        _state = empty();
      }
    } catch(e) {
      console.error('Fehler beim Laden des Zustands', e);
      _state = empty();
    }
  }

  function migrate(s) {
    const base = empty();
    const merged = {
      ...base,
      ...s,
      company: { ...base.company, ...(s.company||{}) },
      settings: { ...base.settings, ...(s.settings||{}), invoice: { ...base.settings.invoice, ...((s.settings||{}).invoice||{}) } },
    };
    merged.counterparties = (merged.counterparties || []).map(cp => ({
      id: cp.id || uid(),
      name: cp.name || '',
      country: cp.country || 'SK',
      type: cp.type || 'both',
      ico: cp.ico || '',
      dic: cp.dic || '',
      vatNumber: cp.vatNumber || cp.icDph || '',
      address: cp.address || cp.addressLine1 || '',
      address2: cp.address2 || cp.addressLine2 || '',
      zip: cp.zip || '',
      city: cp.city || '',
      contactPerson: cp.contactPerson || '',
      email: cp.email || '',
      phone: cp.phone || '',
      notes: cp.notes || '',
      createdAt: cp.createdAt || now(),
      updatedAt: cp.updatedAt || cp.createdAt || now(),
    }));
    merged.transactions = (merged.transactions || []).map(t => ({ ...t, attachments: Array.isArray(t.attachments) ? t.attachments : [] }));
    merged.invoicesIssued = (s.invoicesIssued||[]).map((inv, idx) => normalizeInvoice(inv, 'issued', idx));
    merged.invoicesReceived = (s.invoicesReceived||[]).map((inv, idx) => normalizeInvoice(inv, 'received', idx));
    return merged;
  }

  function save() {
    if (!_state) return;
    _state.appMeta.updatedAt = now();
    if (_authContext.userId) return;
    // Kept only as a recoverable legacy source for the guided migration.
    // Cloud sessions never call this as their source of truth.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state, jsonSafeReplacer));
  }

  function jsonSafeReplacer(_key, value) {
    return value === Infinity ? '__BE_INFINITY__' : value;
  }

  function jsonSafeReviver(_key, value) {
    return value === '__BE_INFINITY__' ? Infinity : value;
  }

  function get() { return _state; }

  function set(updater) {
    if (typeof updater === 'function') updater(_state);
    else Object.assign(_state, updater);
    save();
  }

  function reset() { _state = empty(); save(); }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ ..._state, exportedAt: now() }, jsonSafeReplacer, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `becoding-buchhaltung-${dateStr()}.json`; a.click();
  }

  function importJSON(data) {
    const parsed = JSON.parse(data, jsonSafeReviver);
    if (!parsed.schemaVersion) throw new Error('Ungültiges JSON-Format');
    _state = migrate(parsed);
    save();
  }

  function seedDemo() {
    const yr = new Date().getFullYear();
    const cp1 = uid(); const cp2 = uid(); const cp3 = uid();
    _state.counterparties = [
      { id: cp1, name: 'Fratch', country: 'DE', vatNumber: 'DE359394804', type: 'customer', address: 'c/o SF17 CoWorkingspace', address2: 'Schönfeldstraße 17', zip: '80539', city: 'München', contactPerson: 'Philipp Thomaschweski', createdAt: now(), updatedAt: now() },
      { id: cp2, name: 'TechStart s.r.o.', country: 'SK', ico: '12345678', dic: '2020000000', vatNumber: 'SK2020000000', type: 'customer', address: 'Nivy 1', zip: '821 05', city: 'Bratislava', createdAt: now(), updatedAt: now() },
      { id: cp3, name: 'Office Supplies a.s.', country: 'SK', ico: '87654321', dic: '2121000000', vatNumber: 'SK2121000000', type: 'supplier', address: 'Karadžičova 8', zip: '821 08', city: 'Bratislava', createdAt: now(), updatedAt: now() },
    ];
    const txns = [
      { id: uid(), date: `${yr}-01-15`, type: 'income', category: 'IT-Beratung', description: 'Beratung – Acme Q1', counterpartyId: cp1, netAmount: 4800, vatRate: 0, vatAmount: 0, grossAmount: 4800, vatTreatment: 'eu_b2b_rc_income', paymentStatus: 'paid', invoiceRef: 'RE-2024-001', createdAt: now(), updatedAt: now(), deductible: true, currency: 'EUR' },
      { id: uid(), date: `${yr}-02-10`, type: 'income', category: 'Softwareentwicklung', description: 'Portalentwicklung – TechStart', counterpartyId: cp2, netAmount: 6500, vatRate: 0.23, vatAmount: 1495, grossAmount: 7995, vatTreatment: 'domestic_taxable_income', paymentStatus: 'paid', invoiceRef: 'RE-2024-002', createdAt: now(), updatedAt: now(), deductible: true, currency: 'EUR' },
      { id: uid(), date: `${yr}-02-28`, type: 'expense', category: 'Software & Lizenzen', description: 'JetBrains All Products Pack', counterpartyId: null, netAmount: 600, vatRate: 0.23, vatAmount: 138, grossAmount: 738, vatTreatment: 'domestic_taxable_expense', paymentStatus: 'paid', invoiceRef: 'BEL-2024-001', createdAt: now(), updatedAt: now(), deductible: true, currency: 'EUR' },
      { id: uid(), date: `${yr}-03-05`, type: 'expense', category: 'Rechts- & Buchhaltungskosten', description: 'Buchhalter Q1', counterpartyId: null, netAmount: 350, vatRate: 0.23, vatAmount: 80.5, grossAmount: 430.5, vatTreatment: 'domestic_taxable_expense', paymentStatus: 'paid', invoiceRef: 'BEL-2024-002', createdAt: now(), updatedAt: now(), deductible: true, currency: 'EUR' },
      { id: uid(), date: `${yr}-04-20`, type: 'income', category: 'IT-Beratung', description: 'Sicherheitsaudit – Acme', counterpartyId: cp1, netAmount: 3200, vatRate: 0, vatAmount: 0, grossAmount: 3200, vatTreatment: 'eu_b2b_rc_income', paymentStatus: 'unpaid', invoiceRef: 'RE-2024-003', createdAt: now(), updatedAt: now(), deductible: true, currency: 'EUR' },
    ];
    _state.transactions = txns;
    _state.invoicesIssued = [normalizeInvoice({
      id: uid(), number: '0034', issueDate: `${yr}-02-28`, dueDate: `${yr}-03-15`,
      servicePeriodFrom: `${yr}-02-01`, servicePeriodTo: `${yr}-02-28`, counterpartyId: cp1,
      amount: 13367.20, status: 'paid', vatTreatment: 'eu_b2b_rc_income', contactPerson: 'Thomaschweski',
      introText: 'vielen Dank für Ihr Vertrauen in meine Dienstleistung. Ich stelle Ihnen hiermit folgende Leistungen in Rechnung:',
      paymentTermsText: 'Zahlung innerhalb von 15 Tagen ab Rechnungseingang ohne Abzüge.',
      taxNoteText: 'Die Rechnungsausweis erfolgt ohne Umsatzsteuer, da die Steuerschuldnerschaft des Leistungsempfängers greift (Reverse-Charge-Verfahren).',
      closingText: 'Mit freundlichen Grüßen',
      lineItems: [{ id: uid(), positionNumber: 1, description: 'Softwareentwicklung (Faktor-IOS Produktivbetreuung)', quantity: 124, unit: 'h', unitPrice: 107.8, vatRate: 0 }],
      linkedTransactionId: txns[1].id,
      createdAt: now(), updatedAt: now()
    }, 'issued', 0)];
    _state.assets = [
      { id: uid(), name: 'MacBook Pro 16"', purchaseDate: `${yr}-01-10`, acquisitionCost: 2800, depreciationYears: 4, category: 'IT-Ausstattung', description: '', createdAt: now(), updatedAt: now() },
    ];
    save();
  }

  function replace(next) { _state = migrate(next); }
  function setAuthContext(userId, companyId) { _authContext = { userId, companyId }; }
  function authContext() { return { ..._authContext }; }
  function cloudState(data) {
    const base = empty();
    return migrate({ ...base, ...data, appMeta: { createdAt: data.appMeta?.createdAt || now(), updatedAt: now() } });
  }
  function legacySnapshot() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw, jsonSafeReviver)) : null;
  }
  return { load, get, set, save, reset, exportJSON, importJSON, replace, cloudState, setAuthContext, authContext, legacySnapshot };
})();
