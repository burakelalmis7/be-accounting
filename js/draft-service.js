// IndexedDB is deliberately scoped by user and company. It is a recovery copy,
// not proof that a server-side save succeeded.
const Drafts = (() => {
  const DB = 'becoding-drafts-v1'; const STORE = 'drafts';
  let context = { userId: null, companyId: null };
  let timers = new Map(); let sequences = new Map(); let pending = new Set();
  function open() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  function key(kind, recordId='new') { return `${context.userId}:${context.companyId}:${kind}:${recordId}`; }
  function setContext(userId, companyId) { context = { userId, companyId }; }
  async function put(kind, recordId, content, baseVersion=null) {
    if (!context.userId || !context.companyId) return null;
    const item = { key: key(kind, recordId), userId: context.userId, companyId: context.companyId, kind, recordId: recordId || 'new', content, baseVersion, updatedAt: now(), cloudSynced: false };
    const db = await open(); await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(item); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); return item;
  }
  async function get(kind, recordId='new') { if (!context.userId || !context.companyId) return null; const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).get(key(kind, recordId)); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
  async function remove(kind, recordId='new') { if (!context.userId || !context.companyId) return; const db = await open(); await new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key(kind, recordId)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); pending.delete(key(kind, recordId)); }
  function cancel(kind, recordId='new') { const draftKey = key(kind, recordId); clearTimeout(timers.get(draftKey)); timers.delete(draftKey); sequences.set(draftKey, (sequences.get(draftKey) || 0) + 1); }
  function schedule(kind, recordId, readContent, baseVersion, statusElement) {
    const draftKey = key(kind, recordId); const seq = (sequences.get(draftKey) || 0) + 1; sequences.set(draftKey, seq); pending.add(draftKey); clearTimeout(timers.get(draftKey));
    const save = async () => { try { await put(kind, recordId, readContent(), baseVersion); if (sequences.get(draftKey) === seq) setStatus(statusElement, 'local', 'Nur auf diesem Gerät gesichert'); } catch (error) { setStatus(statusElement, 'error', 'Lokale Sicherung fehlgeschlagen'); } };
    timers.set(draftKey, setTimeout(save, 1000));
    return () => save();
  }
  function setStatus(element, kind, text) { const el = typeof element === 'string' ? document.getElementById(element) : element; if (el) { el.className = `form-status ${kind}`; el.textContent = text; } }
  function hasUnsynced() { return pending.size > 0; }
  return { setContext, put, get, remove, cancel, schedule, setStatus, hasUnsynced };
})();
