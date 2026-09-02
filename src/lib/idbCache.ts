export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

const DB_NAME = 'GridAppCacheDB';
const STORE_NAME = 'api_cache';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
      };
      const req = store.put(entry, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB setCache error:', err);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        if (!entry) return resolve(null);
        if (Date.now() - entry.timestamp > entry.ttl) {
          // expired
          resolve(null);
          // Async cleanup
          deleteCache(key);
        } else {
          resolve(entry.data);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB getCache error:', err);
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // ignore
  }
}

export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB invalidateCache error:', err);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB clearAllCache error:', err);
  }
}

export async function invalidateRelatedDeviceCache(device: any): Promise<void> {
  if (!device) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const key = cursor.key as string;
          
          // Invalidate device specific cache
          if (key === `/devices/${device.id}` || key === `/api/devices/${device.id}`) {
             cursor.delete();
          } 
          // Invalidate related paginated queries
          else if (key.startsWith('/devices?')) {
             const val = cursor.value as CacheEntry<any>;
             if (val && val.data && Array.isArray(val.data.data)) {
                // If it's a paginated list of devices
                const devices = val.data.data;
                const idx = devices.findIndex((d: any) => d.id === device.id);
                if (idx !== -1) {
                   // Instead of just deleting the cache, we can partially invalidate by either deleting it 
                   // or maybe modifying it. For simplicity and to ensure freshness of pagination, 
                   // if the device belongs to this query, we delete this query cache.
                   // Wait, requirement: "Không clear toàn bộ device cache nếu chỉ 1 thiết bị thay đổi. CREATE/UPDATE/DELETE thiết bị → invalidate đúng device + feeder/substation cache liên quan."
                   // So we delete only the queries that actually contain this device, or match its substation/feeder.
                   cursor.delete();
                } else if (
                  (device.substation_id && key.includes(`substation_id=${device.substation_id}`)) ||
                  (device.feeder_id && key.includes(`feeder_id=${device.feeder_id}`))
                ) {
                   // If the query is specifically for this device's substation/feeder, we invalidate it
                   // because a new device might have been added or removed, affecting pagination.
                   cursor.delete();
                }
             }
          }
          // Invalidate related substation cache
          else if (device.substation_id && (key === `/substations/${device.substation_id}` || key === `/api/substations/${device.substation_id}`)) {
             cursor.delete();
          }
          // Invalidate related feeder cache
          else if (device.feeder_id && (key === `/feeders/${device.feeder_id}` || key === `/api/feeders/${device.feeder_id}`)) {
             cursor.delete();
          }
          // Invalidate dashboard stats
          else if (key.includes('/dashboard/stats')) {
             cursor.delete();
          }

          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB invalidateRelatedDeviceCache error:', err);
  }
}
