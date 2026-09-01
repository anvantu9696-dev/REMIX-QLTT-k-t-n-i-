// In-memory caching and Firebase monitoring logger

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number = 60000): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

export function invalidateCache(prefixOrKey: string): void {
  for (const key of memoryCache.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      memoryCache.delete(key);
    }
  }
}

export function clearAllCache(): void {
  memoryCache.clear();
}

// Development and monitoring loggers
export function logFirebaseRead(collection: string, queryDesc: string, count: number): void {
  console.log(`[FIREBASE READ] Collection: ${collection} | Query: ${queryDesc} | Count: ${count}`);
}

export function logFirebaseWrite(collection: string, docId: string, action: string = 'WRITE'): void {
  console.log(`[FIREBASE WRITE] Collection: ${collection} | Doc: ${docId} | Action: ${action}`);
}

export function logCacheHit(entity: string, key?: string): void {
  console.log(`[CACHE HIT] Entity: ${entity}${key ? ` | Key: ${key}` : ''}`);
}
