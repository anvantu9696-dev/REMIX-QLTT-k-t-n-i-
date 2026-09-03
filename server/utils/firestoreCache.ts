// In-memory caching and Firebase monitoring logger
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();

// Map to store ongoing promises for keys to prevent duplicate concurrent reads
const ongoingRequests = new Map<string, Promise<any>>();
const invalidationTimestamps = new Map<string, number>();

export async function getOrFetchCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = memoryCache.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    logCacheHit('dedup', key);
    return entry.data as T;
  }
  
  if (ongoingRequests.has(key)) {
    return ongoingRequests.get(key) as Promise<T>;
  }

  const fetchStartTime = Date.now();
  const promise = fetcher().then(data => {
    ongoingRequests.delete(key);
    // STALE CACHE RACE FIX: only set cache if it wasn't invalidated during the fetch
    const lastInvalidated = invalidationTimestamps.get(key) || 0;
    if (lastInvalidated <= fetchStartTime) {
      setCached(key, data, ttlMs);
    }
    return data;
  }).catch(err => {
    ongoingRequests.delete(key);
    throw err;
  });

  ongoingRequests.set(key, promise);
  return promise;
}

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
  const now = Date.now();
  for (const key of memoryCache.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      memoryCache.delete(key);
    }
  }
  
  // Mark invalidation timestamp to prevent in-flight requests from setting stale data
  if (prefixOrKey.includes('_')) {
    // exact key or prefix? usually we just set for the exact prefix
    invalidationTimestamps.set(prefixOrKey, now);
    
    // Also check ongoing requests to mark their keys if prefix matches
    for (const key of ongoingRequests.keys()) {
       if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
          invalidationTimestamps.set(key, now);
       }
    }
  } else {
    invalidationTimestamps.set(prefixOrKey, now);
  }
}

export function clearAllCache(): void {
  memoryCache.clear();
  invalidationTimestamps.clear();
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
