'use strict';
window.LibraryStore = (() => {
  let database;
  async function open() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('epub-library-v1', 2);
      request.onupgradeneeded = () => {
        for (const name of ['books','positions','annotations','organization']) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, {keyPath:'id'});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  window.ReaderData = {
    all: name => run(name,'readonly',s=>s.getAll()),
    put: (name,value) => run(name,'readwrite',s=>s.put(value)),
    remove: (name,id) => run(name,'readwrite',s=>s.delete(id))
  };
  async function run(store, mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = operation(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('儲存已中止'));
    });
  }
  return {all: () => run('books','readonly',s=>s.getAll()),get:id=>run('books','readonly',s=>s.get(id)),put:book=>run('books','readwrite',s=>s.put(book)),remove:id=>run('books','readwrite',s=>s.delete(id)),position:id=>run('positions','readonly',s=>s.get(id)),savePosition:p=>run('positions','readwrite',s=>s.put(p)),removePosition:async id=>{await run('positions','readwrite',s=>s.delete(id));await run('positions','readwrite',s=>s.delete(id+':web'));}};
})();
