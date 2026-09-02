const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

if (!apiCode.includes("invalidateRelatedDeviceCache")) {
  apiCode = apiCode.replace(
    "import { getCache, setCache, invalidateCacheByPrefix, clearAllCache } from './idbCache';",
    "import { getCache, setCache, invalidateCacheByPrefix, clearAllCache, invalidateRelatedDeviceCache } from './idbCache';"
  );
}

// Add cacheTtl to getDashboardStats
apiCode = apiCode.replace(
  "request<{ success: boolean; data: DashboardStats }>('/dashboard/stats')",
  "request<{ success: boolean; data: DashboardStats }>('/dashboard/stats', { cacheTtl: 180 })"
);

// Add cacheTtl to getSubstations
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any[] }>(`/substations${query ? '?' + query : ''}`)",
  "request<{ success: boolean; data: any[] }>(`/substations${query ? '?' + query : ''}`, { cacheTtl: 86400 })"
);

// Add cacheTtl to getSubstation
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any }>(`/substations/${id}`)",
  "request<{ success: boolean; data: any }>(`/substations/${id}`, { cacheTtl: 86400 })"
);

// Add cacheTtl to getFeeders
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any[] }>(`${url}${searchParams.toString() ? '&' + searchParams.toString() : ''}`)",
  "request<{ success: boolean; data: any[] }>(`${url}${searchParams.toString() ? '&' + searchParams.toString() : ''}`, { cacheTtl: 43200 })"
);

// Add cacheTtl to getFeeder
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any }>(`/feeders/${id}`)",
  "request<{ success: boolean; data: any }>(`/feeders/${id}`, { cacheTtl: 43200 })"
);

// Add cacheTtl to getDevices
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any[]; lastDocId?: string; total?: number; page?: number; totalPages?: number }>(`${url}${params.toString() ? '&' + params.toString() : ''}`)",
  "request<{ success: boolean; data: any[]; lastDocId?: string; total?: number; page?: number; totalPages?: number }>(`${url}${params.toString() ? '&' + params.toString() : ''}`, { cacheTtl: 900 })"
);

// Add cacheTtl to getDevice
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any }>(`/devices/${id}`)",
  "request<{ success: boolean; data: any }>(`/devices/${id}`, { cacheTtl: 900 })"
);

// Add cacheTtl to getChecklists
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any[] }>(`/checklists${query ? '?' + query : ''}`)",
  "request<{ success: boolean; data: any[] }>(`/checklists${query ? '?' + query : ''}`, { cacheTtl: 21600 })"
);

// Add cacheTtl to getChecklistPresets
apiCode = apiCode.replace(
  "request<{ success: boolean; data: any[] }>('/checklists/presets')",
  "request<{ success: boolean; data: any[] }>('/checklists/presets', { cacheTtl: 21600 })"
);

fs.writeFileSync('src/lib/api.ts', apiCode);
