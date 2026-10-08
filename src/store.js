// Keeps the iris group in the browser (IndexedDB) so it is still there next visit. Every call fails quietly.
const DB = 'iris-studio', ST = 'group';

function open() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

export async function loadGroup() {
  try {
    const db = await open();
    const rows = await new Promise(res => {
      const q = db.transaction(ST).objectStore(ST).getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => res([]);
    });
    db.close();
    return rows.sort((a, b) => a.order - b.order);
  } catch (e) { return []; }
}

export async function saveGroup(items) {
  try {
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction(ST, 'readwrite'), s = tx.objectStore(ST);
      s.clear();
      items.forEach((it, i) => s.put({ id: it.id, order: i, name: it.name, prFrac: it.prFrac, prDark: it.prDark, blob: it.blob }));
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) { /* storage blocked or full: the group still works for this visit */ }
}
