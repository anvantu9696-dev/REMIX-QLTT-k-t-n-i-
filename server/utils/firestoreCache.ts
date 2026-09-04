// In-memory caching and Firebase monitoring logger
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  namespace?: string;
}

export const TTL_USER_PROFILE = 15 * 60 * 1000; // 15 mins (900,000 ms)
export const TTL_MASTER_DATA = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)
export const TTL_DEVICES_LIST = 3 * 60 * 1000; // 3 mins (180,000 ms)
export const TTL_ACTIVE_DEVICES = 5 * 60 * 1000; // 5 mins (300,000 ms)
export const TTL_DASHBOARD_STATS = 5 * 60 * 1000; // 5 mins (300,000 ms)

const memoryCache = new Map<string, CacheEntry<any>>();

// Map to store ongoing promises for keys to prevent duplicate concurrent reads
const ongoingRequests = new Map<string, Promise<any>>();
const invalidationTimestamps = new Map<string, number>();

export async function getOrFetchCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  namespace?: string
): Promise<T> {
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
      setCached(key, data, ttlMs, namespace);
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

export function setCached<T>(key: string, data: T, ttlMs: number = 60000, namespace?: string): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    namespace
  });
}

export function invalidateKey(key: string): void {
  const now = Date.now();
  memoryCache.delete(key);
  invalidationTimestamps.set(key, now);
  for (const k of ongoingRequests.keys()) {
    if (k === key) {
      invalidationTimestamps.set(k, now);
    }
  }
}

export function invalidateNamespace(namespace: string): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (
      entry.namespace === namespace ||
      key === namespace ||
      key.startsWith(`${namespace}_`) ||
      key.startsWith(`${namespace}:`) ||
      key.startsWith(namespace)
    ) {
      memoryCache.delete(key);
    }
  }
  
  invalidationTimestamps.set(namespace, now);
  for (const key of ongoingRequests.keys()) {
    if (
      key === namespace ||
      key.startsWith(`${namespace}_`) ||
      key.startsWith(`${namespace}:`) ||
      key.startsWith(namespace)
    ) {
      invalidationTimestamps.set(key, now);
    }
  }
}

export function invalidateCache(prefixOrKey: string): void {
  invalidateNamespace(prefixOrKey);
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
