const DB_NAME = 'ComodaImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

function openImageDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedImage(url) {
  if (!url) return null;
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result) : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function cacheImage(url) {
  if (!url) return null;
  try {
    // Check if already cached
    let cached = await getCachedImage(url);
    if (cached) return cached;

    // Fetch and store
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const blob = await res.blob();
    
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, url);
      tx.oncomplete = () => resolve(URL.createObjectURL(blob));
      tx.onerror = () => resolve(url); // fallback to original url
    });
  } catch (e) {
    console.error('Failed to cache image:', url, e);
    return url; // fallback to original
  }
}
