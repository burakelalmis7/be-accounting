// Central data access. Calls are explicit and await a server response; State is
// only updated after a confirmed write. Updates use optimistic version checks.
const Persistence = (() => {
  const PAGE_SIZE = 1000;
  const entityTable = { counterparties: 'counterparties', transactions: 'transactions', invoicesIssued: 'invoices', invoicesReceived: 'invoices', assets: 'assets', dividends: 'dividends', vehicleRecords: 'vehicle_records', notes: 'notes' };
  let companyId = null;
  function requireClient() { const client = SupabaseClient.get(); if (!client || !companyId) throw new Error('Keine aktive Cloud-Verbindung zur Firma.'); return client; }
  function currentCompanyId() { return companyId; }
  async function findCompany() {
    const client = SupabaseClient.get(); const { data, error } = await client.from('company_members').select('company_id, companies(*)').limit(1).single();
    if (error) throw new Error(error.message === 'PGRST116' ? 'Für dieses Konto ist noch keine Firma eingerichtet.' : error.message);
    companyId = data.company_id; return data.companies;
  }
  async function all(table, query) { let from = 0, rows = []; while (true) { const { data, error } = await query().range(from, from + PAGE_SIZE - 1); if (error) throw error; rows = rows.concat(data || []); if (!data || data.length < PAGE_SIZE) return rows; from += PAGE_SIZE; } }
  function fromRow(row) {
    return { ...row.data, id: row.id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, companyId: row.company_id,
      ...(row.kind ? { kind: row.kind, number: row.number, invoiceNumber: row.number, issueDate: row.issue_date, counterpartyId: row.counterparty_id, linkedTransactionId: row.linked_transaction_id, status: row.status } : {}),
      ...(row.type ? { date: row.date, type: row.type, counterpartyId: row.counterparty_id, invoiceRef: row.invoice_ref, netAmount: Number(row.net_amount), vatAmount: Number(row.vat_amount), grossAmount: Number(row.gross_amount) } : {}) };
  }
  async function loadState() {
    const client = requireClient();
    const [settings, counterparties, transactions, invoices, assets, dividends, vehicleRecords, notes] = await Promise.all([
      client.from('settings').select('*').eq('company_id', companyId).maybeSingle(),
      all('counterparties', () => client.from('counterparties').select('*').eq('company_id', companyId).order('created_at')),
      all('transactions', () => client.from('transactions').select('*').eq('company_id', companyId).order('date')),
      all('invoices', () => client.from('invoices').select('*').eq('company_id', companyId).order('issue_date')),
      all('assets', () => client.from('assets').select('*').eq('company_id', companyId)),
      all('dividends', () => client.from('dividends').select('*').eq('company_id', companyId)),
      all('vehicle_records', () => client.from('vehicle_records').select('*').eq('company_id', companyId)),
      all('notes', () => client.from('notes').select('*').eq('company_id', companyId)),
    ]);
    if (settings.error) throw settings.error;
    const inv = invoices.map(fromRow);
    return State.cloudState({ company: settings.data?.company_snapshot || {}, settings: settings.data?.data || {}, counterparties: counterparties.map(fromRow), transactions: transactions.map(fromRow), invoicesIssued: inv.filter(i => i.kind === 'issued'), invoicesReceived: inv.filter(i => i.kind === 'received'), assets: assets.map(fromRow), dividends: dividends.map(fromRow), vehicleRecords: vehicleRecords.map(fromRow), notes: notes.map(fromRow) });
  }
  function row(entity, data) {
    const payload = { id: data.id, company_id: companyId, version: data.version || 1, idempotency_key: data.idempotencyKey || crypto.randomUUID(), data: { ...data, version: undefined, companyId: undefined, idempotencyKey: undefined } };
    if (entity === 'transactions') Object.assign(payload, { date: data.date || null, type: data.type || null, counterparty_id: data.counterpartyId || null, invoice_ref: data.invoiceRef || null, net_amount: data.netAmount ?? null, vat_amount: data.vatAmount ?? null, gross_amount: data.grossAmount ?? null });
    return payload;
  }
  async function saveEntity(collection, entity) {
    const client = requireClient(); const table = entityTable[collection]; if (!table) throw new Error(`Unbekannter Datensatztyp ${collection}`);
    const payload = row(collection, entity); if (collection === 'invoicesIssued' || collection === 'invoicesReceived') { payload.kind = collection === 'invoicesIssued' ? 'issued' : 'received'; payload.number = entity.number; payload.issue_date = entity.issueDate; payload.counterparty_id = entity.counterpartyId || null; }
    if (!entity.version) { const { data, error } = await client.from(table).insert(payload).select().single(); if (error) throw error; return fromRow(data); }
    const update = { data: payload.data, idempotency_key: payload.idempotency_key };
    if (collection === 'transactions') Object.assign(update, { date: payload.date, type: payload.type, counterparty_id: payload.counterparty_id, invoice_ref: payload.invoice_ref, net_amount: payload.net_amount, vat_amount: payload.vat_amount, gross_amount: payload.gross_amount });
    if (collection === 'invoicesIssued' || collection === 'invoicesReceived') Object.assign(update, { kind: payload.kind, number: payload.number, issue_date: payload.issue_date, counterparty_id: payload.counterparty_id });
    const { data, error } = await client.from(table).update(update).eq('id', entity.id).eq('company_id', companyId).eq('version', entity.version).select().maybeSingle();
    if (error) throw error; if (!data) { const conflict = new Error('Neuere Version vorhanden'); conflict.code = 'VERSION_CONFLICT'; throw conflict; } return fromRow(data);
  }
  async function saveSettings(state) {
    const client = requireClient(); const { data, error } = await client.from('settings').upsert({ company_id: companyId, data: state.settings, company_snapshot: state.company }, { onConflict: 'company_id' }).select().single(); if (error) throw error; return data;
  }
  async function saveIssuedInvoice(invoice) {
    const client = requireClient(); const payload = { ...invoice, companyId, idempotencyKey: invoice.idempotencyKey || crypto.randomUUID() }; const { data, error } = await client.rpc('save_issued_invoice', { p_invoice: payload, p_expected_version: invoice.version || null, p_idempotency_key: payload.idempotencyKey }); if (error) { if (error.message?.includes('VERSION_CONFLICT')) { const conflict = new Error('Neuere Version vorhanden'); conflict.code = 'VERSION_CONFLICT'; throw conflict; } throw error; } return { invoice: fromRow(data.invoice), transactionId: data.transactionId };
  }
  async function deleteEntity(collection, entity) { const client = requireClient(); const table = entityTable[collection]; const { error } = await client.from(table).delete().eq('id', entity.id).eq('company_id', companyId).eq('version', entity.version); if (error) throw error; }
  return { findCompany, loadState, saveEntity, saveIssuedInvoice, saveSettings, deleteEntity, currentCompanyId };
})();
