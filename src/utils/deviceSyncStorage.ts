import { Device } from '../types';

export interface DeviceSyncCacheData {
  devices: Device[];
  lastSyncTimestamp: string;
  savedAt: number;
}

const DB_NAME = 'GridAppCacheDB';
const STORE_NAME = 'device_sync_store';
const DB_VERSION = 2; // Incremented for dedicated store
const SYNC_CACHE_KEY = 'grid_devices_incremental_cache';
const FALLBACK_STORAGE_KEY = 'grid_devices_sync_fallback_v1';

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('api_cache')) {
        db.createObjectStore('api_cache');
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get cached devices and last sync timestamp from IndexedDB (or fallback to localStorage)
 */
export async function getDeviceSyncCache(): Promise<DeviceSyncCacheData | null> {
  try {
    const db = await openSyncDB();
    const result = await new Promise<DeviceSyncCacheData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SYNC_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (result && Array.isArray(result.devices) && typeof result.lastSyncTimestamp === 'string') {
      return result;
    }
  } catch (idbErr) {
    console.warn('[deviceSyncStorage] IDB read failed, attempting localStorage fallback:', idbErr);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.devices) && typeof parsed.lastSyncTimestamp === 'string') {
        return parsed as DeviceSyncCacheData;
      }
    }
  } catch (lsErr) {
    console.warn('[deviceSyncStorage] localStorage fallback read failed:', lsErr);
  }

  return null;
}

/**
 * Persist cached devices and last sync timestamp to IndexedDB & fallback
 */
export async function saveDeviceSyncCache(devices: Device[], lastSyncTimestamp: string): Promise<void> {
  if (!Array.isArray(devices) || !lastSyncTimestamp) return;

  const data: DeviceSyncCacheData = {
    devices,
    lastSyncTimestamp,
    savedAt: Date.now()
  };

  try {
    const db = await openSyncDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, SYNC_CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn('[deviceSyncStorage] IDB save failed:', idbErr);
  }

  // Also save fallback in localStorage if within quota limits
  try {
    const serialized = JSON.stringify(data);
    // Only save in localStorage if < 4MB to prevent QuotaExceededError
    if (serialized.length < 4 * 1024 * 1024) {
      localStorage.setItem(FALLBACK_STORAGE_KEY, serialized);
    }
  } catch (lsErr) {
    // Ignore localStorage quota errors
  }
}

/**
 * Clear cached devices sync data
 */
export async function clearDeviceSyncCache(): Promise<void> {
  try {
    const db = await openSyncDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(SYNC_CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // ignore
  }

  try {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Merges delta devices (updates, additions, soft-deletions) into local cached list
 */
export function mergeDeviceDelta(localDevices: Device[], deltaDevices: (Device & { isDeleted?: boolean })[]): Device[] {
  if (!deltaDevices || deltaDevices.length === 0) {
    return localDevices;
  }

  const map = new Map<string, Device>();
  for (const item of localDevices) {
    const key = String(item.id || item.device_id);
    map.set(key, item);
  }

  for (const deltaItem of deltaDevices) {
    const key = String(deltaItem.id || deltaItem.device_id);
    if (deltaItem.isDeleted) {
      map.delete(key);
    } else {
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...deltaItem } : deltaItem);
    }
  }

  return Array.from(map.values());
}
