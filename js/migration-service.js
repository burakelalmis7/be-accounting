// Browser-era JSON import. IDs are deterministic so an interrupted import can
// resume with the same file; unrelated cloud records are never merged.
const Migration = (() => {
  const collections = [
    ['counterparties','counterparties'], ['transactions','transactions'],
    ['invoicesIssued','invoices'], ['invoicesReceived','invoices'],
    ['assets','assets'], ['dividends','dividends'],
    ['vehicleRecords','vehicle_records'], ['notes','notes'],
  ];
  const tables = [...new Set(collections.map(([, table]) => table))];
  let staged = null;

  function preview(raw) {
    const source = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!source?.schemaVersion) throw new Error('Nicht unterstütztes Exportformat: schemaVersion fehlt.');
    const counts = Object.fromEntries(collections.map(([key]) => [key, Array.isArray(source[key]) ? source[key].length : 0]));
    const attachmentCount = (source.transactions || []).reduce((n, item) => n + (item.attachments?.length || 0), 0)
      + Object.keys(source.attachments || {}).length;
    return { source, counts, attachmentCount };
  }

  function validate(source) {
    if (!source.company || !source.settings) throw new Error('Firmenprofil oder Einstellungen fehlen.');
    if (preview(source).attachmentCount) throw new Error('Dieser Export enthält Belege. Der Import wurde gestoppt, damit keine Belege verloren gehen.');
    for (const [key] of collections) {
      if (!Array.isArray(source[key])) throw new Error(`Ungültige Liste: ${key}.`);
      const ids = source[key].map(item => String(item?.id ?? ''));
      if (ids.includes('') || new Set(ids).size !== ids.length) throw new Error(`Fehlende oder doppelte ID in ${key}.`);
    }
    const cp = new Set(source.counterparties.map(x => String(x.id)));
    const tx = new Set(source.transactions.map(x => String(x.id)));
    for (const item of [...source.transactions, ...source.invoicesIssued, ...source.invoicesReceived]) {
      if (item.counterpartyId && !cp.has(String(item.counterpartyId))) throw new Error('Geschäftspartner-Verweis fehlt im Export.');
    }
    for (const item of [...source.invoicesIssued, ...source.invoicesReceived]) {
      if (item.linkedTransactionId && !tx.has(String(item.linkedTransactionId))) throw new Error('Verknüpfte Buchung fehlt im Export.');
      if (!String(item.number || item.invoiceNumber || '').trim()) throw new Error('Eine Rechnung hat keine Nummer.');
    }
    for (const list of [source.invoicesIssued, source.invoicesReceived]) {
      if (new Set(list.map(i => String(i.number || i.invoiceNumber))).size !== list.length) throw new Error('Doppelte Rechnungsnummer im Export.');
    }
    for (const item of source.transactions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) || !['income','expense'].includes(item.type)) throw new Error('Ungültiges Buchungsdatum oder Typ.');
      if (['netAmount','vatAmount','grossAmount'].some(key => !Number.isFinite(Number(item[key])))) throw new Error('Ungültiger Buchungsbetrag.');
    }
  }

  async function digest(value) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return [...bytes].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  async function stableId(companyId, kind, oldId) {
    const hex = await digest(`${companyId}:${kind}:${oldId}`);
    const bytes = Array.from({length:16}, (_,i) => parseInt(hex.slice(i*2,i*2+2),16));
    bytes[6] = (bytes[6] & 15) | 128; // UUIDv8
    bytes[8] = (bytes[8] & 63) | 128;
    const h = bytes.map(x => x.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
  }

  async function buildRows(source, companyId) {
    const maps = {};
    for (const [key] of collections) {
      maps[key] = new Map();
      for (const item of source[key]) maps[key].set(String(item.id), await stableId(companyId,key,item.id));
    }
    const ref = (key,id) => id == null || id === '' ? null : maps[key].get(String(id));
    const rows = Object.fromEntries(tables.map(table => [table, []]));
    for (const [key,table] of collections) for (const legacy of source[key]) {
      const id = ref(key,legacy.id);
      const data = {...legacy,id};
      if ('counterpartyId' in data) data.counterpartyId = ref('counterparties',data.counterpartyId);
      if ('linkedTransactionId' in data) data.linkedTransactionId = ref('transactions',data.linkedTransactionId);
      const validTime = value => value && !Number.isNaN(Date.parse(value));
      const createdAt = validTime(legacy.createdAt) ? legacy.createdAt : new Date().toISOString();
      const updatedAt = validTime(legacy.updatedAt) ? legacy.updatedAt : createdAt;
      // Every row in a bulk insert needs both timestamps. PostgREST otherwise
      // sends NULL for a missing key when another row has that key.
      const row = {id,company_id:companyId,idempotency_key:id,data,created_at:createdAt,updated_at:updatedAt};
      if (key === 'transactions') Object.assign(row, {date:legacy.date,type:legacy.type,counterparty_id:data.counterpartyId || null,invoice_ref:legacy.invoiceRef || null,net_amount:Number(legacy.netAmount),vat_amount:Number(legacy.vatAmount),gross_amount:Number(legacy.grossAmount)});
      if (key === 'invoicesIssued' || key === 'invoicesReceived') Object.assign(row, {kind:key === 'invoicesIssued' ? 'issued' : 'received',number:String(legacy.number || legacy.invoiceNumber),issue_date:legacy.issueDate || null,counterparty_id:data.counterpartyId || null,linked_transaction_id:data.linkedTransactionId || null,status:legacy.status || null});
      rows[table].push(row);
    }
    return rows;
  }

  async function cloudIds(client,table,companyId) {
    const ids = new Set();
    for (let from=0;;from+=1000) {
      const {data,error} = await client.from(table).select('id').eq('company_id',companyId).range(from,from+999);
      if (error) throw error;
      (data || []).forEach(x => ids.add(x.id));
      if (!data || data.length < 1000) return ids;
    }
  }
  const cents = (items,key) => items.reduce((sum,x) => sum + Math.round(Number(x[key] || 0)*100),0);

  async function importSource(raw,onProgress=()=>{}) {
    const {source,counts} = preview(raw);
    validate(source);
    const client = SupabaseClient.get(), companyId = Persistence.currentCompanyId();
    if (!client || !companyId || !Auth.user()) throw new Error('Bitte zuerst anmelden.');
    const fingerprint = await digest(typeof raw === 'string' ? raw : JSON.stringify(source));
    onProgress('Prüfe den Cloud-Bestand …');
    const rows = await buildRows(source,companyId);
    const {data:settingsRow,error:settingsError} = await client.from('settings').select('*').eq('company_id',companyId).single();
    if (settingsError) throw settingsError;
    const prior = settingsRow.data?.legacyImport;
    if (prior?.status === 'complete' && prior.fingerprint === fingerprint) throw new Error('Diese Sicherung wurde bereits vollständig importiert.');
    if (prior && prior.fingerprint !== fingerprint) throw new Error('Eine andere Sicherung wurde bereits importiert oder begonnen. Keine automatische Zusammenführung.');
    const found = {}; let completed = 0;
    for (const table of tables) {
      found[table] = await cloudIds(client,table,companyId);
      const expected = new Set(rows[table].map(x => x.id));
      for (const id of found[table]) if (!prior || !expected.has(id)) throw new Error('Cloud-Bestand enthält bereits andere Datensätze. Import ohne Änderung gestoppt.');
      completed += found[table].size;
    }
    if (completed && prior?.status !== 'in_progress') throw new Error('Cloud-Bestand ist nicht leer.');
    const marker = {fingerprint,status:'in_progress',counts,startedAt:prior?.startedAt || new Date().toISOString()};
    const {error:markerError} = await client.from('settings').update({data:{...settingsRow.data,legacyImport:marker}}).eq('company_id',companyId);
    if (markerError) throw markerError;
    const total = Object.values(rows).reduce((n,list) => n+list.length,0);
    for (const table of tables) {
      const pending = rows[table].filter(x => !found[table].has(x.id));
      for (let i=0;i<pending.length;i+=50) {
        const batch = pending.slice(i,i+50);
        const {error} = await client.from(table).insert(batch);
        if (error) throw new Error(`${table}: ${error.message}. Mit derselben Datei kann der Import fortgesetzt werden.`);
        completed += batch.length;
        onProgress(`${completed} von ${total} Datensätzen übernommen …`);
      }
    }
    onProgress('Vergleiche Mengen und Beträge …');
    const cloud = await Persistence.loadState();
    for (const [key] of collections) if (cloud[key].length !== counts[key]) throw new Error(`Abgleich fehlgeschlagen: ${key}. Import bleibt unvollständig markiert.`);
    for (const key of ['netAmount','vatAmount','grossAmount']) if (cents(cloud.transactions,key) !== cents(source.transactions,key)) throw new Error(`Betragsabgleich fehlgeschlagen: ${key}. Import bleibt unvollständig markiert.`);
    const finished = {...marker,status:'complete',completedAt:new Date().toISOString()};
    const settings = {...source.settings,legacyImport:finished,legacyAuditLog:source.auditLog || []};
    const {error:finishError} = await client.from('settings').update({data:settings,company_snapshot:source.company}).eq('company_id',companyId);
    if (finishError) throw new Error(`Datensätze vorhanden, Firmenprofil aber nicht abgeschlossen: ${finishError.message}`);
    onProgress('Import abgeschlossen.');
    return {counts,total};
  }
  function stage(raw) { const info = preview(raw); staged = raw; return info; }
  async function importStaged(onProgress) {
    if (!staged) throw new Error('Bitte die Sicherungsdatei erneut auswählen.');
    const raw = staged;
    staged = null;
    return importSource(raw,onProgress);
  }
  return {preview,stage,importSource,importStaged};
})();
