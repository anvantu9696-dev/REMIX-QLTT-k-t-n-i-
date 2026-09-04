import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api, getAuthToken } from '../lib/api';
import { Device, Substation, Feeder } from '../types';
import { useAuth } from './AuthContext';
import { getDeviceSyncCache, saveDeviceSyncCache, mergeDeviceDelta } from '../utils/deviceSyncStorage';

interface DataContextType {
  devices: Device[];
  substations: Substation[];
  feeders: Feeder[];
  auditLogs: any[];
  
  loadingDevices: boolean;
  loadingSubstations: boolean;
  loadingFeeders: boolean;
  loadingAuditLogs: boolean;
  isSyncing: boolean;

  fetchDevices: (force?: boolean) => Promise<Device[]>;
  fetchSubstations: (force?: boolean) => Promise<Substation[]>;
  fetchFeeders: (force?: boolean) => Promise<Feeder[]>;
  fetchAuditLogs: (force?: boolean) => Promise<any[]>;
  fetchAllMasterData: (force?: boolean) => Promise<void>;
  syncAllData: () => Promise<void>;
  filterDevices: (filters?: {
    substation_id?: string | number;
    feeder_id?: string | number;
    device_type?: string;
    search?: string;
    switch_status?: string;
    scada_status?: string;
    battery_status?: string;
  }) => Device[];
  getDeviceById: (id: string | number) => Device | undefined;

  // Device Cache Mutators
  addDeviceInCache: (device: Device) => void;
  updateDeviceInCache: (id: string | number, updated: Partial<Device>) => void;
  deleteDeviceFromCache: (id: string | number) => void;

  // Feeder Cache Mutators
  addFeederInCache: (feeder: Feeder) => void;
  updateFeederInCache: (id: string | number, updated: Partial<Feeder>) => void;
  deleteFeederFromCache: (id: string | number) => void;

  // Substation Cache Mutators
  addSubstationInCache: (substation: Substation) => void;
  updateSubstationInCache: (id: string | number, updated: Partial<Substation>) => void;
  deleteSubstationFromCache: (id: string | number) => void;

  // Audit Logs Mutators
  addAuditLogInCache: (log: any) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuth();

  const [devices, setDevices] = useState<Device[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [loadingDevices, setLoadingDevices] = useState<boolean>(false);
  const [loadingSubstations, setLoadingSubstations] = useState<boolean>(false);
  const [loadingFeeders, setLoadingFeeders] = useState<boolean>(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [hasLoadedDevices, setHasLoadedDevices] = useState<boolean>(false);
  const [hasLoadedSubstations, setHasLoadedSubstations] = useState<boolean>(false);
  const [hasLoadedFeeders, setHasLoadedFeeders] = useState<boolean>(false);
  const [hasLoadedAuditLogs, setHasLoadedAuditLogs] = useState<boolean>(false);

  // Refs for stable callbacks
  const devicesRef = useRef<Device[]>([]);
  const substationsRef = useRef<Substation[]>([]);
  const feedersRef = useRef<Feeder[]>([]);
  const auditLogsRef = useRef<any[]>([]);

  const hasLoadedDevicesRef = useRef<boolean>(false);
  const hasLoadedSubstationsRef = useRef<boolean>(false);
  const hasLoadedFeedersRef = useRef<boolean>(false);
  const hasLoadedAuditLogsRef = useRef<boolean>(false);

  // Keep refs in sync with state
  devicesRef.current = devices;
  substationsRef.current = substations;
  feedersRef.current = feeders;
  auditLogsRef.current = auditLogs;

  hasLoadedDevicesRef.current = hasLoadedDevices;
  hasLoadedSubstationsRef.current = hasLoadedSubstations;
  hasLoadedFeedersRef.current = hasLoadedFeeders;
  hasLoadedAuditLogsRef.current = hasLoadedAuditLogs;

  // Fetch Devices with Incremental / Delta Sync
  const fetchDevices = useCallback(async (force = false): Promise<Device[]> => {
    if (!getAuthToken()) {
      return [];
    }

    // 1. Try reading existing sync cache from IndexedDB / localStorage
    let cachedSync = null;
    try {
      cachedSync = await getDeviceSyncCache();
    } catch (e) {
      console.warn('[DataContext] Error reading local device sync cache:', e);
    }

    const hasValidLocalCache = !!(cachedSync && Array.isArray(cachedSync.devices) && cachedSync.devices.length > 0 && cachedSync.lastSyncTimestamp);

    // 2. Incremental Sync path (if not forcing full refresh and local data exists)
    if (!force && hasValidLocalCache && cachedSync) {
      // Hydrate memory state immediately if currently empty
      if (devicesRef.current.length === 0) {
        devicesRef.current = cachedSync.devices;
        setDevices(cachedSync.devices);
        hasLoadedDevicesRef.current = true;
        setHasLoadedDevices(true);
      }

      setLoadingDevices(true);
      try {
        const res = await api.getDevices({
          updated_after: cachedSync.lastSyncTimestamp
        });

        if (res.success) {
          const newSyncTimestamp = res.last_sync_timestamp || new Date().toISOString();

          if (res.is_delta) {
            if (Array.isArray(res.data) && res.data.length > 0) {
              const baseList = devicesRef.current.length > 0 ? devicesRef.current : cachedSync.devices;
              const merged = mergeDeviceDelta(baseList, res.data);
              devicesRef.current = merged;
              hasLoadedDevicesRef.current = true;
              setDevices(merged);
              setHasLoadedDevices(true);
              await saveDeviceSyncCache(merged, newSyncTimestamp);
              return merged;
            } else {
              // Server has 0 updates -> maintain local cache with updated timestamp
              await saveDeviceSyncCache(devicesRef.current.length > 0 ? devicesRef.current : cachedSync.devices, newSyncTimestamp);
              return devicesRef.current.length > 0 ? devicesRef.current : cachedSync.devices;
            }
          } else if (Array.isArray(res.data)) {
            // Full list fallback from server
            devicesRef.current = res.data;
            hasLoadedDevicesRef.current = true;
            setDevices(res.data);
            setHasLoadedDevices(true);
            await saveDeviceSyncCache(res.data, newSyncTimestamp);
            return res.data;
          }
        }
      } catch (deltaErr: any) {
        if (deltaErr?.status === 401 || deltaErr?.message?.includes('đăng nhập')) {
          return [];
        }
        console.warn('[DataContext] Incremental sync error, falling back to cached devices:', deltaErr);
        return devicesRef.current.length > 0 ? devicesRef.current : cachedSync.devices;
      } finally {
        setLoadingDevices(false);
      }

      return devicesRef.current;
    }

    // 3. Full Fetch path (force === true OR no valid local cache)
    setLoadingDevices(true);
    try {
      const res = await api.getDevices({ limit: 1000, forceRefresh: true });
      if (res.success && Array.isArray(res.data)) {
        const newSyncTimestamp = res.last_sync_timestamp || new Date().toISOString();
        devicesRef.current = res.data;
        hasLoadedDevicesRef.current = true;
        setDevices(res.data);
        setHasLoadedDevices(true);
        await saveDeviceSyncCache(res.data, newSyncTimestamp);
        return res.data;
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('đăng nhập')) {
        return [];
      }
      console.error('[DataContext] Error fetching devices full list:', err);
    } finally {
      setLoadingDevices(false);
    }
    return devicesRef.current;
  }, []);

  // Fetch Substations
  const fetchSubstations = useCallback(async (force = false): Promise<Substation[]> => {
    if (!force && hasLoadedSubstationsRef.current) {
      return substationsRef.current;
    }
    if (!getAuthToken()) {
      return [];
    }
    setLoadingSubstations(true);
    try {
      const res = await api.getSubstations(undefined, { forceRefresh: force });
      if (res.success && Array.isArray(res.data)) {
        substationsRef.current = res.data;
        hasLoadedSubstationsRef.current = true;
        setSubstations(res.data);
        setHasLoadedSubstations(true);
        return res.data;
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('đăng nhập')) {
        return [];
      }
      console.error('[DataContext] Error fetching substations:', err);
    } finally {
      setLoadingSubstations(false);
    }
    return substationsRef.current;
  }, []);

  // Fetch Feeders
  const fetchFeeders = useCallback(async (force = false): Promise<Feeder[]> => {
    if (!force && hasLoadedFeedersRef.current) {
      return feedersRef.current;
    }
    if (!getAuthToken()) {
      return [];
    }
    setLoadingFeeders(true);
    try {
      const res = await api.getFeeders(undefined, { forceRefresh: force });
      if (res.success && Array.isArray(res.data)) {
        feedersRef.current = res.data;
        hasLoadedFeedersRef.current = true;
        setFeeders(res.data);
        setHasLoadedFeeders(true);
        return res.data;
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('đăng nhập')) {
        return [];
      }
      console.error('[DataContext] Error fetching feeders:', err);
    } finally {
      setLoadingFeeders(false);
    }
    return feedersRef.current;
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (force = false): Promise<any[]> => {
    if (!force && hasLoadedAuditLogsRef.current) {
      return auditLogsRef.current;
    }
    if (!getAuthToken()) {
      return [];
    }
    setLoadingAuditLogs(true);
    try {
      const res = await api.getAuditLogs({ limit: 20 });
      if (res.success && Array.isArray(res.data)) {
        auditLogsRef.current = res.data;
        hasLoadedAuditLogsRef.current = true;
        setAuditLogs(res.data);
        setHasLoadedAuditLogs(true);
        return res.data;
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('đăng nhập')) {
        return [];
      }
      console.error('[DataContext] Error fetching audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
    return auditLogsRef.current;
  }, []);

  // Fetch All Master Data in parallel on initial load or background
  const fetchAllMasterData = useCallback(async (force = false) => {
    if (!getAuthToken()) return;
    await Promise.all([
      fetchSubstations(force),
      fetchFeeders(force),
      fetchDevices(force)
    ]);
  }, [fetchSubstations, fetchFeeders, fetchDevices]);

  // Sync All Data with loading state and user notification
  const syncAllData = useCallback(async () => {
    if (!getAuthToken()) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        fetchSubstations(true),
        fetchFeeders(true),
        fetchDevices(true)
      ]);
      toast.success('Đã đồng bộ dữ liệu mới nhất');
    } catch (err) {
      console.error('[DataContext] Error syncing data:', err);
      toast.error('Có lỗi xảy ra khi đồng bộ dữ liệu');
    } finally {
      setIsSyncing(false);
    }
  }, [fetchSubstations, fetchFeeders, fetchDevices]);

  // Pre-fetch master data only when user is authenticated
  const userId = user?.id;
  useEffect(() => {
    if (!isAuthLoading && userId && getAuthToken()) {
      fetchAllMasterData();
    } else if (!isAuthLoading && !userId) {
      setDevices([]);
      setSubstations([]);
      setFeeders([]);
      setAuditLogs([]);
      devicesRef.current = [];
      substationsRef.current = [];
      feedersRef.current = [];
      auditLogsRef.current = [];
      hasLoadedDevicesRef.current = false;
      hasLoadedSubstationsRef.current = false;
      hasLoadedFeedersRef.current = false;
      hasLoadedAuditLogsRef.current = false;
      setHasLoadedDevices(false);
      setHasLoadedSubstations(false);
      setHasLoadedFeeders(false);
      setHasLoadedAuditLogs(false);
    }
  }, [userId, isAuthLoading, fetchAllMasterData]);

  // Mutators
  const addDeviceInCache = useCallback((newDevice: Device) => {
    setDevices(prev => {
      const next = [newDevice, ...prev.filter(d => String(d.id) !== String(newDevice.id))];
      devicesRef.current = next;
      getDeviceSyncCache().then(cached => {
        const timestamp = cached?.lastSyncTimestamp || new Date().toISOString();
        saveDeviceSyncCache(next, timestamp);
      }).catch(() => {});
      return next;
    });
  }, []);

  const updateDeviceInCache = useCallback((id: string | number, updatedFields: Partial<Device>) => {
    setDevices(prev => {
      const next = prev.map(d => String(d.id) === String(id) ? { ...d, ...updatedFields } : d);
      devicesRef.current = next;
      getDeviceSyncCache().then(cached => {
        const timestamp = cached?.lastSyncTimestamp || new Date().toISOString();
        saveDeviceSyncCache(next, timestamp);
      }).catch(() => {});
      return next;
    });
  }, []);

  const deleteDeviceFromCache = useCallback((id: string | number) => {
    setDevices(prev => {
      const next = prev.filter(d => String(d.id) !== String(id));
      devicesRef.current = next;
      getDeviceSyncCache().then(cached => {
        const timestamp = cached?.lastSyncTimestamp || new Date().toISOString();
        saveDeviceSyncCache(next, timestamp);
      }).catch(() => {});
      return next;
    });
  }, []);

  const addFeederInCache = useCallback((newFeeder: Feeder) => {
    setFeeders(prev => {
      const next = [newFeeder, ...prev.filter(f => String(f.id) !== String(newFeeder.id))];
      feedersRef.current = next;
      return next;
    });
  }, []);

  const updateFeederInCache = useCallback((id: string | number, updatedFields: Partial<Feeder>) => {
    setFeeders(prev => {
      const next = prev.map(f => String(f.id) === String(id) ? { ...f, ...updatedFields } : f);
      feedersRef.current = next;
      return next;
    });
  }, []);

  const deleteFeederFromCache = useCallback((id: string | number) => {
    setFeeders(prev => {
      const next = prev.filter(f => String(f.id) !== String(id));
      feedersRef.current = next;
      return next;
    });
  }, []);

  const addSubstationInCache = useCallback((newSub: Substation) => {
    setSubstations(prev => {
      const next = [newSub, ...prev.filter(s => String(s.id) !== String(newSub.id))];
      substationsRef.current = next;
      return next;
    });
  }, []);

  const updateSubstationInCache = useCallback((id: string | number, updatedFields: Partial<Substation>) => {
    setSubstations(prev => {
      const next = prev.map(s => String(s.id) === String(id) ? { ...s, ...updatedFields } : s);
      substationsRef.current = next;
      return next;
    });
  }, []);

  const deleteSubstationFromCache = useCallback((id: string | number) => {
    setSubstations(prev => {
      const next = prev.filter(s => String(s.id) !== String(id));
      substationsRef.current = next;
      return next;
    });
  }, []);

  const addAuditLogInCache = useCallback((log: any) => {
    setAuditLogs(prev => {
      const next = [log, ...prev];
      auditLogsRef.current = next;
      return next;
    });
  }, []);

  const getDeviceById = useCallback((id: string | number): Device | undefined => {
    return devicesRef.current.find(d => String(d.id) === String(id) || String(d.device_id) === String(id));
  }, []);

  const filterDevices = useCallback((filters?: {
    substation_id?: string | number;
    feeder_id?: string | number;
    device_type?: string;
    search?: string;
    switch_status?: string;
    scada_status?: string;
    battery_status?: string;
  }): Device[] => {
    if (!filters) return devicesRef.current;
    return devicesRef.current.filter(d => {
      if (filters.substation_id && String(filters.substation_id) !== '' && String(filters.substation_id) !== 'all' && String(filters.substation_id) !== 'ALL') {
        const numSubId = Number(filters.substation_id);
        const matchStr = String(d.substation_id) === String(filters.substation_id);
        const matchNum = !isNaN(numSubId) && Number(d.substation_id) === numSubId;
        if (!matchStr && !matchNum) return false;
      }
      if (filters.feeder_id && String(filters.feeder_id) !== '' && String(filters.feeder_id) !== 'all' && String(filters.feeder_id) !== 'ALL') {
        const numFeedId = Number(filters.feeder_id);
        const matchStr = String(d.feeder_id) === String(filters.feeder_id);
        const matchNum = !isNaN(numFeedId) && Number(d.feeder_id) === numFeedId;
        if (!matchStr && !matchNum) return false;
      }
      if (filters.device_type && filters.device_type !== 'all' && filters.device_type !== '') {
        const dt = filters.device_type.toUpperCase();
        const dType = (d.device_type || '').toUpperCase() === 'RCL' ? 'REC' : (d.device_type || '').toUpperCase();
        if (dt === 'REC' && dType !== 'REC') return false;
        if (dt !== 'REC' && dType !== dt) return false;
      }
      if (filters.switch_status && filters.switch_status !== 'all' && filters.switch_status !== '' && d.switch_status !== filters.switch_status) {
        return false;
      }
      if (filters.scada_status && filters.scada_status !== 'all' && filters.scada_status !== '' && d.scada_status !== filters.scada_status) {
        return false;
      }
      if (filters.battery_status && filters.battery_status !== 'all' && filters.battery_status !== '' && d.battery_status !== filters.battery_status) {
        return false;
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const matchId = (d.device_id || '').toLowerCase().includes(q);
        const matchCode = (d.device_code || '').toLowerCase().includes(q);
        const matchName = (d.name || '').toLowerCase().includes(q);
        const matchPole = (d.pole_number || '').toLowerCase().includes(q);
        if (!matchId && !matchCode && !matchName && !matchPole) return false;
      }
      return true;
    });
  }, []);

  return (
    <DataContext.Provider
      value={{
        devices,
        substations,
        feeders,
        auditLogs,
        loadingDevices,
        loadingSubstations,
        loadingFeeders,
        loadingAuditLogs,
        isSyncing,
        fetchDevices,
        fetchSubstations,
        fetchFeeders,
        fetchAuditLogs,
        fetchAllMasterData,
        syncAllData,
        filterDevices,
        getDeviceById,
        addDeviceInCache,
        updateDeviceInCache,
        deleteDeviceFromCache,
        addFeederInCache,
        updateFeederInCache,
        deleteFeederFromCache,
        addSubstationInCache,
        updateSubstationInCache,
        deleteSubstationFromCache,
        addAuditLogInCache
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
